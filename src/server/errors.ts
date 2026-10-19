import "server-only";

import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export interface PublicError {
  error: string;
  code: string;
  requestId?: string;
  details?: unknown;
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(
      "VALIDATION_ERROR",
      400,
      "The request contains invalid or incomplete data.",
      error.issues.slice(0, 12).map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AppError("REQUEST_ABORTED", 499, "The request was cancelled.");
  }
  if (error instanceof Error && /timeout|timed out|aborted/i.test(error.message)) {
    return new AppError("UPSTREAM_TIMEOUT", 504, "A connected service took too long to respond.");
  }
  return new AppError("INTERNAL_ERROR", 500, "The server could not complete the request.");
}

export function publicError(error: unknown, requestId?: string): PublicError {
  const appError = asAppError(error);
  return {
    error: appError.message,
    code: appError.code,
    requestId,
    ...(appError.details === undefined ? {} : { details: appError.details }),
  };
}

export function logServerError(error: unknown, requestId: string, route: string) {
  const appError = asAppError(error);
  if (appError.status < 500) return;
  const cause = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error);
  console.error("[CLON API]", { requestId, route, code: appError.code, cause });
}

