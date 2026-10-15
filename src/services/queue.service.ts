import { isValidObjectId } from "mongoose";
import { storeRepository } from "../repositories/store.repository";
import { queueRepository } from "../repositories/queue.repository";
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
		const [lastTicketNumber, waitingCount] = await Promise.all([
			queueRepository.findLastTicketNumber(storeId),
			queueRepository.countWaitingTickets(storeId),
		]);

		return { storeId, lastTicketNumber, waitingCount };
	},
};