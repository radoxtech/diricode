import { z } from "zod";
import { randomUUID } from "crypto";
import type { Context } from "hono";
import type { BootstrapResult } from "../types.js";
import { PickRequestSchema } from "../types.js";
import type { DecisionRequest, DecisionResponse } from "@diricode/dirirouter";

/**
 * POST /api/pick handler: validates request, generates chatId/requestId,
 * and returns full DecisionResponse from diriRouter.pick().
 */
export function pickRoute(ctx: BootstrapResult) {
  return async (c: Context) => {
    try {
      const body: unknown = await c.req.json();
      const validated = PickRequestSchema.parse(body);

      const chatId = randomUUID();
      const requestId = randomUUID();

      const decisionRequest: DecisionRequest = {
        chatId,
        requestId,
        agent: validated.agent,
        task: validated.task,
        modelDimensions: validated.modelDimensions,
        ...(validated.constraints && { constraints: validated.constraints }),
      };

      const decisionResponse: DecisionResponse = await ctx.diriRouter.pick(decisionRequest, chatId);

      return c.json(decisionResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "Validation error",
            details: error.errors,
          },
          400,
        );
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      return c.json(
        {
          error: "Internal server error",
          message: errorMessage,
        },
        500,
      );
    }
  };
}
