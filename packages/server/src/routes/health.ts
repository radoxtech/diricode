import { Hono } from "hono";
import type { SuccessEnvelope } from "../middleware/error.js";

interface HealthResponse {
  status: "ok";
  timestamp: number;
}

export const healthRouter = new Hono();

healthRouter.get("/", (c) => {
  const response: SuccessEnvelope<HealthResponse> = {
    success: true,
    data: {
      status: "ok",
      timestamp: Date.now(),
    },
  };
  return c.json(response);
});
