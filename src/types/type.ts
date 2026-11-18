import type { UserRole } from "../models/user.model";

export interface CreateStoreInput {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
}

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// Datos del usuario autenticado que viajan en el JWT y se guardan en res.locals.auth.
export interface AuthPayload {
  sub: string;
  role: UserRole;
  storeId: string | null;
}

export interface QueueStatsDTO {
  storeId: string;
  waitingCount: number;
  currentlyServing: number | null;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  averageServiceMinutes: number | null;
  estimatedWaitMinutes: number | null;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}
