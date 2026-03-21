import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors.js";
import { errorMiddleware } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import { v1Router } from "./routes/api/v1.js";

export function createApp(): Hono {
  const app = new Hono();

  app.use("*", corsMiddleware);
  app.use("*", errorMiddleware);

  app.route("/health", healthRouter);
  app.route("/api/v1", v1Router);

  return app;
}
