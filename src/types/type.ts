export interface CreateStoreInput {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
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