import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { AppError } from "../types/type";

export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      return next(new AppError(400, "Datos inválidos", details));
    }
    req.body = result.data;
    next();
  };