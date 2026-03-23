import { Hono } from "hono";
import { eventsRouter } from "./events.js";
import { sessionsRouter } from "./sessions.js";
import { versionMiddleware } from "../../middleware/version.js";
import { openapiSchema } from "../../openapi/schema.js";

export const v1Router = new Hono();

v1Router.use("*", versionMiddleware);

v1Router.get("/", (c) => {
  return c.json({ success: true, data: { version: "v1" } });
});

v1Router.get("/openapi.json", (c) => {
  return c.json(openapiSchema);
});

v1Router.route("/events", eventsRouter);
v1Router.route("/sessions", sessionsRouter);
