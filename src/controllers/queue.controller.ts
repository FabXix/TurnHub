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
};