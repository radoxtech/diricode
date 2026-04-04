import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { BootstrapResult } from "./bootstrap.js";
import { setBootstrap } from "./routes/status.js";
import { getStatus } from "./routes/status.js";
import { getModels, patchModelToggle } from "./routes/models.js";
import { pickRoute } from "./routes/pick.js";
import { createChatRouter } from "./routes/chat.js";
import { renderPlayground } from "./html.js";

export function createApp(bootstrap: BootstrapResult): Hono {
  const app = new Hono();

  app.use("*", (c: Context, next: Next) => {
    setBootstrap(c, bootstrap);
    return next();
  });

  app.use("*", cors());
  app.use("*", logger());

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/", (c) => c.html(renderPlayground()));

  app.get("/api/status", getStatus);
  app.get("/api/models", getModels);
  app.patch("/api/models/toggle", patchModelToggle);
  app.post("/api/pick", pickRoute());
  app.route("/api/chat", createChatRouter(bootstrap.diriRouter, bootstrap.registry));

  return app;
}
