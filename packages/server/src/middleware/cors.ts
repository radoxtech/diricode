import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4173",
] as const;

export const corsMiddleware: MiddlewareHandler = cors({
  origin: ALLOWED_ORIGINS as unknown as string[],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 86400,
  credentials: true,
});
