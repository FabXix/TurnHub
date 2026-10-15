import { Request, Response } from "express";
import { storeService } from "../services/store.service";

export const storeController = {
  async create(req: Request, res: Response) {
    const store = await storeService.registerStore(req.body);
    res.status(201).json(store);
  },
};