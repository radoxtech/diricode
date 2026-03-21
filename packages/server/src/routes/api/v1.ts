import { Hono } from "hono";

export const v1Router = new Hono();

v1Router.get("/", (c) => {
  return c.json({ success: true, data: { version: "v1" } });
});
