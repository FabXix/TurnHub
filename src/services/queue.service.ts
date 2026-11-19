import { isValidObjectId } from "mongoose";
import { storeRepository } from "../repositories/store.repository";
import { queueRepository } from "../repositories/queue.repository";
import { ALLOWED_TRANSITIONS, TICKET_STATUS, TICKET_STATUS_LABELS, TicketStatus } from "../models/ticket.model";
import { AppError, QueueStatsDTO } from "../types/type";

const MAX_TICKET_CREATION_ATTEMPTS = 5;
const MAX_LISTED_TICKETS = 200;

function validateStoreId(storeId: string) {
	if (!isValidObjectId(storeId)) {
		throw new AppError(400, "Identificador de empresa inválido");
	}
}

async function ensureStoreExists(storeId: string) {
	validateStoreId(storeId);
	const store = await storeRepository.findById(storeId);
	if (!store) {
		throw new AppError(404, "Empresa no encontrada");
	}
}

function isDuplicateKeyError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: number }).code === 11000
	);
}

export const queueService = {
	async joinQueue(storeId: string) {
		await ensureStoreExists(storeId);

		// El número sale de un contador atómico ($inc) en la tienda, así que dos solicitudes
		// simultáneas nunca reciben el mismo número. El índice único (storeId, ticketNumber)
		// queda como red de seguridad: si choca (datos previos al contador), se sincroniza
		// el contador con el último turno real y se reintenta.
		for (let attempt = 0; attempt < MAX_TICKET_CREATION_ATTEMPTS; attempt += 1) {
			const ticketNumber = await storeRepository.nextTicketNumber(storeId);
			if (ticketNumber === null) {
				throw new AppError(404, "Empresa no encontrada");
			}
			try {
				return await queueRepository.createTicket(storeId, ticketNumber);
			} catch (error) {
				if (!isDuplicateKeyError(error)) {
					throw error;
				}
				const lastTicketNumber = await queueRepository.findLastTicketNumber(storeId);
				await storeRepository.syncTicketSeq(storeId, lastTicketNumber);
			}
		}

		// Se agotaron los reintentos por colisiones con otras solicitudes simultáneas.
		throw new AppError(503, "La fila tiene mucha demanda en este momento, intenta tomar turno de nuevo");
	},

	async getQueueStatus(storeId: string) {
		await ensureStoreExists(storeId);
		const [lastTicketNumber, waitingCount, servingTicket] = await Promise.all([
			queueRepository.findLastTicketNumber(storeId),
			queueRepository.countWaitingTickets(storeId),
			queueRepository.findServingTicket(storeId),
		]);

		return {
			storeId,
			lastTicketNumber,
			waitingCount,
			currentTicketNumber: servingTicket?.ticketNumber ?? null,
		};
	},

	async getQueueStats(storeId: string): Promise<QueueStatsDTO> {
		await ensureStoreExists(storeId);
		const stats = await queueRepository.getQueueStats(storeId);
		const averageServiceMinutes =
			stats.averageServiceMinutes === null
				? null
				: Math.round(stats.averageServiceMinutes * 100) / 100;

		return {
			storeId,
			waitingCount: stats.waitingCount,
			currentlyServing: stats.currentlyServing,
			completedCount: stats.completedCount,
			cancelledCount: stats.cancelledCount,
			noShowCount: stats.noShowCount,
			averageServiceMinutes,
			estimatedWaitMinutes:
				averageServiceMinutes === null
					? null
					: Math.ceil(stats.waitingCount * averageServiceMinutes),
		};
	},

	// Feature 4: llama al siguiente turno en espera y finaliza el que estaba en atención (transacción).
	async callNext(storeId: string) {
		await ensureStoreExists(storeId);

		const result = await queueRepository.advanceQueue(storeId);
		if (!result) {
			throw new AppError(404, "No hay turnos en espera");
		}
		return result;
	},

	// Feature 5: consulta un turno con su posición en la fila.
	async getTicket(storeId: string, ticketId: string) {
		await ensureStoreExists(storeId);
		if (!isValidObjectId(ticketId)) {
			throw new AppError(400, "Identificador de turno inválido");
		}

		const ticket = await queueRepository.findTicketInStore(storeId, ticketId);
		if (!ticket) {
			throw new AppError(404, "Turno no encontrado");
		}

		let aheadOfYou: number | null = null;
		let position: number | null = null;
		if (ticket.status === TICKET_STATUS.WAITING) {
			aheadOfYou = await queueRepository.countWaitingBefore(storeId, ticket.ticketNumber);
			position = aheadOfYou + 1;
		}

		return {
			id: ticket._id,
			storeId,
			ticketNumber: ticket.ticketNumber,
			status: ticket.status,
			statusLabel: TICKET_STATUS_LABELS[ticket.status as TicketStatus],
			position,
			aheadOfYou,
			createdAt: ticket.createdAt,
			calledAt: ticket.calledAt,
			finishedAt: ticket.finishedAt,
		};
	},

	// Feature 4: lista de turnos para el panel del personal (para poder cancelar o cerrar turnos).
	async listTickets(storeId: string, statusQuery?: string) {
		await ensureStoreExists(storeId);
		let statuses: TicketStatus[] | null = null;
		if (statusQuery) {
			const valid = Object.values(TICKET_STATUS) as string[];
			const requested = statusQuery.split(",").map((s) => s.trim()).filter(Boolean);
			const invalid = requested.filter((s) => !valid.includes(s));
			if (invalid.length) {
				throw new AppError(400, `Estado inválido: ${invalid.join(", ")}. Usa: ${valid.join(", ")}`);
			}
			statuses = requested as TicketStatus[];
		}
		const tickets = await queueRepository.listTickets(storeId, statuses, MAX_LISTED_TICKETS);
		return tickets.map((t) => ({
			...t,
			statusLabel: TICKET_STATUS_LABELS[t.status as TicketStatus],
		}));
	},

	// Feature 4: cambia manualmente el estado de un turno respetando las transiciones permitidas.
	async updateTicketStatus(storeId: string, ticketId: string, newStatus: TicketStatus) {
		await ensureStoreExists(storeId);
		if (!isValidObjectId(ticketId)) {
			throw new AppError(400, "Identificador de turno inválido");
		}

		const ticket = await queueRepository.findTicketInStore(storeId, ticketId);
		if (!ticket) {
			throw new AppError(404, "Turno no encontrado");
		}

		const currentStatus = ticket.status as TicketStatus;
		if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) {
			throw new AppError(
				409,
				`No se puede cambiar un turno de "${currentStatus}" a "${newStatus}"`
			);
		}

		const updated = await queueRepository.updateTicketStatus(ticketId, currentStatus, newStatus);
		if (!updated) {
			throw new AppError(409, "El turno cambió de estado, intenta de nuevo");
		}
		return updated;
	},
};
