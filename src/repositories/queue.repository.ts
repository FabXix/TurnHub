import mongoose, { Types } from "mongoose";
import { AppError } from "../types/type";
import { Ticket, TICKET_STATUS, TicketStatus } from "../models/ticket.model";

const FINAL_STATUSES: TicketStatus[] = [
	TICKET_STATUS.COMPLETED,
	TICKET_STATUS.CANCELLED,
	TICKET_STATUS.NO_SHOW,
];

export const queueRepository = {
	createTicket(storeId: string, ticketNumber: number) {
		return Ticket.create({ storeId, ticketNumber, status: TICKET_STATUS.WAITING });
	},

	async findLastTicketNumber(storeId: string): Promise<number> {
		const lastTicket = await Ticket.findOne({ storeId })
			.sort({ ticketNumber: -1 })
			.select({ ticketNumber: 1 })
			.lean();

		return lastTicket?.ticketNumber ?? 0;
	},

	countWaitingTickets(storeId: string) {
		return Ticket.countDocuments({ storeId, status: TICKET_STATUS.WAITING });
	},

	// Feature 4
	findServingTicket(storeId: string) {
		return Ticket.findOne({ storeId, status: TICKET_STATUS.SERVING });
	},

	async getQueueStats(storeId: string) {
		const storeObjectId = new Types.ObjectId(storeId);
		const [counts, servingTicket, average] = await Promise.all([
			Ticket.aggregate([
				{ $match: { storeId: storeObjectId } },
				{
					$group: {
						_id: null,
						waitingCount: {
							$sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.WAITING] }, 1, 0] },
						},
						completedCount: {
							$sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.COMPLETED] }, 1, 0] },
						},
						cancelledCount: {
							$sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.CANCELLED] }, 1, 0] },
						},
						noShowCount: {
							$sum: { $cond: [{ $eq: ["$status", TICKET_STATUS.NO_SHOW] }, 1, 0] },
						},
					},
				},
			]),
			Ticket.findOne({ storeId, status: TICKET_STATUS.SERVING })
				.select({ ticketNumber: 1 })
				.lean(),
			Ticket.aggregate([
				{
					$match: {
						storeId: storeObjectId,
						status: TICKET_STATUS.COMPLETED,
						calledAt: { $ne: null },
						finishedAt: { $ne: null },
					},
				},
				{ $sort: { finishedAt: -1 } },
				{ $limit: 20 },
				{
					$group: {
						_id: null,
						averageServiceMinutes: {
							$avg: {
								$divide: [{ $subtract: ["$finishedAt", "$calledAt"] }, 60000],
							},
						},
					},
				},
			]),
		]);

		return {
			waitingCount: counts[0]?.waitingCount ?? 0,
			completedCount: counts[0]?.completedCount ?? 0,
			cancelledCount: counts[0]?.cancelledCount ?? 0,
			noShowCount: counts[0]?.noShowCount ?? 0,
			currentlyServing: servingTicket?.ticketNumber ?? null,
			averageServiceMinutes: average[0]?.averageServiceMinutes ?? null,
		};
	},

	// Lista los turnos de una tienda (opcionalmente filtrados por estado) en orden de llegada.
	listTickets(storeId: string, statuses: TicketStatus[] | null, limit: number) {
		const filter: Record<string, unknown> = { storeId };
		if (statuses && statuses.length) filter.status = { $in: statuses };
		return Ticket.find(filter).sort({ ticketNumber: 1 }).limit(limit).lean();
	},

	findTicketInStore(storeId: string, ticketId: string) {
		return Ticket.findOne({ _id: ticketId, storeId });
	},

	// Feature 5: turnos en espera con número menor (los que están delante en la fila).
	countWaitingBefore(storeId: string, ticketNumber: number) {
		return Ticket.countDocuments({
			storeId,
			status: TICKET_STATUS.WAITING,
			ticketNumber: { $lt: ticketNumber },
		});
	},

	// Feature 4 / RN-19, RN-20, RN-21: avanza la fila como una sola unidad.
	// Dentro de una transacción: finaliza el turno en atención y promueve el siguiente en espera (FIFO).
	// Si algo falla, MongoDB revierte ambos cambios. Si dos llamadas compiten, la transacción
	// detecta el conflicto de escritura y la reintenta con los datos actualizados.
	// Devuelve null si no hay turnos en espera (en ese caso no se modifica nada).
	async advanceQueue(storeId: string) {
		const session = await mongoose.startSession();
		try {
			let result: { previousTicket: unknown; currentTicket: unknown } | null = null;

			await session.withTransaction(async () => {
				result = null;
				const next = await Ticket.findOne({ storeId, status: TICKET_STATUS.WAITING })
					.sort({ ticketNumber: 1 })
					.session(session);
				if (!next) return;

				const now = new Date();
				// Primero se libera el lugar de "serving" para respetar el índice parcial único.
				const previousTicket = await Ticket.findOneAndUpdate(
					{ storeId, status: TICKET_STATUS.SERVING },
					{ $set: { status: TICKET_STATUS.COMPLETED, finishedAt: now } },
					{ session, returnDocument: "after" }
				);

				const currentTicket = await Ticket.findOneAndUpdate(
					{ _id: next._id, status: TICKET_STATUS.WAITING },
					{ $set: { status: TICKET_STATUS.SERVING, calledAt: now } },
					{ session, returnDocument: "after" }
				);
				if (!currentTicket) {
					// Lanzar dentro de la transacción la aborta y revierte el paso anterior.
					throw new AppError(409, "La fila cambió mientras se avanzaba, intenta de nuevo");
				}

				result = { previousTicket, currentTicket };
			});

			return result as { previousTicket: unknown; currentTicket: unknown } | null;
		} finally {
			await session.endSession();
		}
	},

	// Solo actualiza si el turno sigue en el estado esperado (evita carreras entre solicitudes).
	updateTicketStatus(ticketId: string, fromStatus: TicketStatus, toStatus: TicketStatus) {
		const update: Record<string, unknown> = { status: toStatus };
		if (toStatus === TICKET_STATUS.SERVING) update.calledAt = new Date();
		if (FINAL_STATUSES.includes(toStatus)) update.finishedAt = new Date();

		return Ticket.findOneAndUpdate(
			{ _id: ticketId, status: fromStatus },
			{ $set: update },
			{ returnDocument: "after" }
		);
	},
};
