import { HTTPException } from "hono/http-exception";
import type { Context, MiddlewareHandler } from "hono";

export interface ErrorDetail {
  code: string;
  message: string;
}

export interface ErrorEnvelope {
  success: false;
  error: ErrorDetail;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

function buildErrorEnvelope(code: string, message: string): ErrorEnvelope {
  return { success: false, error: { code, message } };
}

export const errorMiddleware: MiddlewareHandler = async (c: Context, next): Promise<void> => {
  try {
    await next();
  } catch (err) {
    if (err instanceof HTTPException) {
      const envelope = buildErrorEnvelope(`HTTP_${err.status.toString()}`, err.message);
      c.res = c.json(envelope, err.status);
      return;
    }

    const message = err instanceof Error ? err.message : "Internal server error";
    const envelope = buildErrorEnvelope("INTERNAL_SERVER_ERROR", message);
    c.res = c.json(envelope, 500);
  }
};
