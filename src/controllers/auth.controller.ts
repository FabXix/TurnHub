import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { getAuth } from "../middlewares/auth";

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  },

  async me(_req: Request, res: Response) {
    const user = await authService.me(getAuth(res).sub);
    res.status(200).json(user);
  },

  async createOperator(req: Request, res: Response) {
    const operator = await authService.createOperator(String(req.params.storeId), req.body);
    res.status(201).json(operator);
  },
};
