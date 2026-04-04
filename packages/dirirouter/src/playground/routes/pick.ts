import { z } from "zod";
import { randomUUID } from "crypto";
import type { Context } from "hono";
import type { BootstrapResult } from "../bootstrap.js";
import { PickRequestSchema } from "../types.js";
import type { DecisionRequest, DecisionResponse } from "@diricode/dirirouter";
import { readPlaygroundState } from "../model-state.js";

export function pickRoute() {
  return async (c: Context) => {
    const bootstrap = c.get("bootstrap") as BootstrapResult;
    try {
      const body: unknown = await c.req.json();
      const validated = PickRequestSchema.parse(body);

      const chatId = randomUUID();
      const requestId = randomUUID();

      const { disabledModels } = readPlaygroundState();
      const userExcluded = validated.constraints?.excludedModels ?? [];
      const mergedExcluded = [...new Set([...userExcluded, ...disabledModels])];

      const baseConstraints = validated.constraints ?? {};
      const constraints =
        mergedExcluded.length > 0
          ? { ...baseConstraints, excludedModels: mergedExcluded }
          : Object.keys(baseConstraints).length > 0
            ? baseConstraints
            : undefined;

      const decisionRequest: DecisionRequest = {
        chatId,
        requestId,
        agent: validated.agent,
        task: validated.task,
        modelDimensions: validated.modelDimensions,
        ...(constraints !== undefined && { constraints }),
      };

      const decisionResponse: DecisionResponse = await bootstrap.diriRouter.pick(
        decisionRequest,
        chatId,
      );

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
