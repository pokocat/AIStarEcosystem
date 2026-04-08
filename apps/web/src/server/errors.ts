import type { ApiErrorShape } from "@/types/contracts/api";

export class ServerAppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, payload: ApiErrorShape) {
    super(payload.message);
    this.name = "ServerAppError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export function toApiError(error: unknown): { status: number; error: ApiErrorShape } {
  if (error instanceof ServerAppError) {
    return {
      status: error.status,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    };
  }

  return {
    status: 500,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Unknown server error"
    }
  };
}
