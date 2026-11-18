import { Request, Response } from "express";
import { storeService } from "../services/store.service";
import { getAuth } from "../middlewares/auth";

export const storeController = {
  async create(req: Request, res: Response) {
    const store = await storeService.registerStore(req.body, getAuth(res).sub);
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
