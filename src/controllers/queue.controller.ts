import { Request, Response } from "express";
import { queueService } from "../services/queue.service";

export const queueController = {
	async join(req: Request, res: Response) {
		const ticket = await queueService.joinQueue(String(req.params.storeId));
		res.status(201).json(ticket);
	},

	async getStatus(req: Request, res: Response) {
		const status = await queueService.getQueueStatus(String(req.params.storeId));
		res.status(200).json(status);
	},

	// Feature 4
	async callNext(req: Request, res: Response) {
		const result = await queueService.callNext(String(req.params.storeId));
		res.status(200).json(result);
	},

	async updateTicketStatus(req: Request, res: Response) {
		const ticket = await queueService.updateTicketStatus(
			String(req.params.storeId),
			String(req.params.ticketId),
			req.body.status
		);
		res.status(200).json(ticket);
	},
};
