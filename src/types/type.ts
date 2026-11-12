export interface CreateStoreInput {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
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