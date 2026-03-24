import type { MiddlewareHandler } from "hono";

/**
 * Middleware that adds `API-Version: v1` header to all responses.
 */
export const versionMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  c.res.headers.set("API-Version", "v1");
};
