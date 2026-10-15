import { Ticket } from "../models/ticket.model";

export const queueRepository = {
	createTicket(storeId: string, ticketNumber: number) {
		return Ticket.create({ storeId, ticketNumber, status: "en espera" });
	},

	async findLastTicketNumber(storeId: string): Promise<number> {
		const lastTicket = await Ticket.findOne({ storeId })
			.sort({ ticketNumber: -1 })
			.select({ ticketNumber: 1 })
			.lean();

		return lastTicket?.ticketNumber ?? 0;
	},

	countWaitingTickets(storeId: string) {
		return Ticket.countDocuments({ storeId, status: "en espera" });
	},
};