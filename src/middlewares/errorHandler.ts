import { Request, Response, NextFunction } from "express";
import { AppError } from "../types/type";

interface MongoLikeError {
  code?: number;
  codeName?: string;
  keyPattern?: Record<string, unknown>;
  name?: string;
}

// Traduce un error 11000 al mensaje de la entidad/índice que realmente chocó.
function duplicateKeyMessage(err: MongoLikeError): string {
  const fields = Object.keys(err.keyPattern ?? {});
  if (fields.includes("ticketNumber")) {
    return "No fue posible asignar el número de turno, intenta de nuevo";
  }
  if (fields.length === 1 && fields[0] === "storeId") {
    return "Ya hay un turno en atención en esta tienda, intenta de nuevo";
  }
  if (fields.includes("email")) {
    return "Ya existe una cuenta con ese correo";
  }
  if (fields.includes("name")) {
    return "Ya existe una empresa registrada con ese nombre";
  }
  return "El registro ya existe";
}

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

  const mongoErr = (typeof err === "object" && err !== null ? err : {}) as MongoLikeError;

  if (mongoErr.code === 11000) {
    return res.status(409).json({ error: duplicateKeyMessage(mongoErr) });
  }

  if (mongoErr.name === "CastError") {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  console.error(err);

  // Las transacciones requieren que MongoDB corra como replica set (Atlas o docker-compose del repo).
  if (mongoErr.code === 20 || mongoErr.codeName === "IllegalOperation") {
    return res
      .status(500)
      .json({ error: "La base de datos no soporta transacciones; MongoDB debe ejecutarse como replica set" });
  }

  return res.status(500).json({ error: "Error interno del servidor" });
}
