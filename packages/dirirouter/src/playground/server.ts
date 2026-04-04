import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { BootstrapResult } from "./types.js";
import { pickRoute } from "./routes/pick.js";

export function createApp(ctx: BootstrapResult) {
  const app = new Hono();

  // Middleware
  app.use("*", cors()); // Allow all origins — dev tool
  app.use("*", logger()); // Request logging

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Placeholder root
  app.get("/", (c) => c.text("DiriRouter Playground — loading..."));

  app.post("/api/pick", pickRoute(ctx));

  return app;
}
