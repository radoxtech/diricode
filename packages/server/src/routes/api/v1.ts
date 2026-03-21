import { Hono } from "hono";
import { eventsRouter } from "./events.js";

export const v1Router = new Hono();

v1Router.get("/", (c) => {
  return c.json({ success: true, data: { version: "v1" } });
});

v1Router.route("/events", eventsRouter);
