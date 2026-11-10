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

	findTicketInStore(storeId: string, ticketId: string) {
		return Ticket.findOne({ _id: ticketId, storeId });
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
