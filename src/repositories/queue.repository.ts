import { Types } from "mongoose";
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

	// Toma de forma atómica el turno en espera más antiguo (FIFO) y lo pasa a "en atención".
	takeNextWaitingTicket(storeId: string) {
		return Ticket.findOneAndUpdate(
			{ storeId, status: TICKET_STATUS.WAITING },
			{ $set: { status: TICKET_STATUS.SERVING, calledAt: new Date() } },
			{ sort: { ticketNumber: 1 }, returnDocument: "after" }
		);
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
