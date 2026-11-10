import { isValidObjectId } from "mongoose";
import { storeRepository } from "../repositories/store.repository";
import { queueRepository } from "../repositories/queue.repository";
import { ALLOWED_TRANSITIONS, TICKET_STATUS, TicketStatus } from "../models/ticket.model";
import { AppError } from "../types/type";

const MAX_TICKET_CREATION_ATTEMPTS = 5;

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

		// Si dos solicitudes leen el mismo último turno, el índice único provoca
		// una colisión en una de ellas y el siguiente intento calcula otro número. MAx 5 veces
		for (let attempt = 0; attempt < MAX_TICKET_CREATION_ATTEMPTS; attempt += 1) {
			const lastTicketNumber = await queueRepository.findLastTicketNumber(storeId);
			try {
				return await queueRepository.createTicket(storeId, lastTicketNumber + 1);
			} catch (error) {
				if (!isDuplicateKeyError(error) || attempt === MAX_TICKET_CREATION_ATTEMPTS - 1) {
					throw error;
				}
			}
		}

		throw new AppError(500, "No fue posible generar el turno");
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

	// Feature 4: llama al siguiente turno en espera y finaliza el que estaba en atención.
	async callNext(storeId: string) {
		await ensureStoreExists(storeId);

		const previous = await queueRepository.findServingTicket(storeId);
		const current = await queueRepository.takeNextWaitingTicket(storeId);
		if (!current) {
			throw new AppError(404, "No hay turnos en espera");
		}

		let previousTicket = null;
		if (previous) {
			previousTicket = await queueRepository.updateTicketStatus(
				String(previous._id),
				TICKET_STATUS.SERVING,
				TICKET_STATUS.COMPLETED
			);
		}

		return { previousTicket, currentTicket: current };
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
