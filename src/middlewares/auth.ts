import { Request, Response, NextFunction } from "express";
import { UserRole } from "../models/user.model";
import { authService } from "../services/auth.service";
import { AppError, AuthPayload } from "../types/type";

export function getAuth(res: Response): AuthPayload {
  return res.locals.auth as AuthPayload;
}

// 401 si no hay token Bearer válido. Guarda el usuario en res.locals.auth.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new AppError(401, "Se requiere iniciar sesión"));
  }
  try {
    res.locals.auth = authService.verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

// 403 si el rol del usuario no está en la lista.
export const authorize =
  (...roles: UserRole[]) =>
  (_req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(getAuth(res).role)) {
      return next(new AppError(403, "Tu rol no tiene permiso para esta operación"));
    }
    next();
  };

// 403 si el usuario no es dueño u operador de la tienda indicada en :storeId.
export async function requireStoreAccess(req: Request, res: Response, next: NextFunction) {
  await authService.assertCanManageStore(getAuth(res), String(req.params.storeId));
  next();
}
