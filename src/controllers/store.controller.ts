import { Request, Response } from "express";
import { storeService } from "../services/store.service";

export const storeController = {
  async create(req: Request, res: Response) {
    const store = await storeService.registerStore(req.body);
    res.status(201).json(store);
  },

  async getAll(_req: Request, res: Response) {
    const stores = await storeService.listStores();
    res.json(stores);
  },

  async getById(req: Request, res: Response) {
    const store = await storeService.getStore(String(req.params.id));
    res.json(store);
  },
};