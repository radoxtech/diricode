import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { renderPlayground } from "./html.js";

export function createApp(): Hono {
  const app = new Hono();

  app.use("*", cors());
  app.use("*", logger());

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/", (c) => c.html(renderPlayground({})));

  return app;
}
