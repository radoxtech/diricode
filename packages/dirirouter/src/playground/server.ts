import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { renderPlayground } from "./html.js";
import type { BootstrapResult } from "./types.js";
import { pickRoute } from "./routes/pick.js";

export function createApp(ctx: BootstrapResult) {
  const app = new Hono();

  app.use("*", cors());
  app.use("*", logger());

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/", (c) => c.html(renderPlayground({})));

  app.post("/api/pick", pickRoute(ctx));

  return app;
}
