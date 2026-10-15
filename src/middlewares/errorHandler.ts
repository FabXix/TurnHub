import { Request, Response, NextFunction } from "express";
import { AppError } from "../types/type";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ error: err.message, details: err.details });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "JSON mal formado" });
  }

  if (typeof err === "object" && err !== null && (err as any).code === 11000) {
    return res
      .status(409)
      .json({ error: "Ya existe una empresa registrada con ese nombre" });
  }

  console.error(err);
  return res.status(500).json({ error: "Error interno del servidor" });
}