import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export function createApp() {
  const app = new Hono();

  // Middleware
  app.use("*", cors()); // Allow all origins — dev tool
  app.use("*", logger()); // Request logging

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Placeholder root
  app.get("/", (c) => c.text("DiriRouter Playground — loading..."));

  return app;
}
