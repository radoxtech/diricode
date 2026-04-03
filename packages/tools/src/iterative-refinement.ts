import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

export const IterativeRefinementParamsSchema = z.object({
  goal: z.string().describe("Success condition description"),
  verifyTool: z.string().describe("Tool to verify progress (e.g., 'bash')"),
  verifyCommand: z.string().describe("Command to check goal (e.g., 'npm test')"),
  verifyExpectedExitCode: z.number().default(0).describe("Expected success exit code"),
  maxIterations: z.number().default(10).describe("Max iterations"),
  stuckDetection: z.object({
    enabled: z.boolean(),
    noProgressThreshold: z.number().default(3).describe("Iterations without progress before stuck"),
    compareOutputs: z.boolean(),
  }),
  fixTool: z.string().describe("Tool to use for fixing the issue"),
  fixParams: z.record(z.any()).describe("Parameters to pass to the fix tool"),
  costLimit: z.number().optional().describe("Max cost per iteration"),
});

export type IterativeRefinementParams = z.infer<typeof IterativeRefinementParamsSchema>;

export interface IterativeRefinementResult {
  success: boolean;
  iterations: number;
  finalResult: unknown;
  stuckDetected: boolean;
  stoppedBy: "goal-achieved" | "max-iterations" | "stuck-detected" | "cost-limit" | "error";
  iterationHistory: {
    iteration: number;
    verificationResult: unknown;
    fixResult: unknown;
    progress: "forward" | "backward" | "stuck";
  }[];
}

const engineToolRegistry: Record<string, Tool> = {};

export function registerIterativeRefinementTools(tools: Tool[]): void {
  for (const tool of tools) {
    engineToolRegistry[tool.name] = tool;
  }
}

function normalizeOutput(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  const obj = result as Record<string, unknown>;
  if (typeof obj.stdout === "string" && typeof obj.stderr === "string") {
    return (obj.stdout + obj.stderr).trim();
  }
  try {
    return JSON.stringify(result).trim();
  } catch {
    return "";
  }
}

export const iterativeRefinementTool: Tool<IterativeRefinementParams, IterativeRefinementResult> = {
  name: "iterative-refinement",
  description:
    "Automatic execute-verify-correct loop with intelligent stop conditions and stuck detection.",
  parameters: IterativeRefinementParamsSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  execute: async (
    params: IterativeRefinementParams,
    context: ToolContext,
  ): Promise<ToolResult<IterativeRefinementResult>> => {
    context.emit("tool.start", { name: "iterative-refinement", params });
    const startTime = Date.now();

    const verifyTool = engineToolRegistry[params.verifyTool];
    if (!verifyTool) {
      throw new ToolError(
        "TOOL_NOT_FOUND",
        `Verify tool '${params.verifyTool}' is not registered with the engine.`,
      );
    }

    const fixTool = engineToolRegistry[params.fixTool];
    if (!fixTool) {
      throw new ToolError(
        "TOOL_NOT_FOUND",
        `Fix tool '${params.fixTool}' is not registered with the engine.`,
      );
    }

    const iterationHistory: IterativeRefinementResult["iterationHistory"] = [];
    let stoppedBy: IterativeRefinementResult["stoppedBy"] = "max-iterations";
    let stuckDetected = false;
    let success = false;
    let finalResult: unknown = null;

    let stuckCounter = 0;
    let previousOutput = "";

    for (let i = 1; i <= params.maxIterations; i++) {
      // 1. Verify Phase
      const verifyParams = {
        command: params.verifyCommand,
      };
      const vr = await verifyTool.execute(verifyParams, context);
      const verificationResult = vr.data;

      finalResult = verificationResult;

      // Check success condition
      const vrObj = verificationResult as Record<string, unknown>;
      const exitCode = typeof vrObj.exitCode === "number" ? vrObj.exitCode : 0;
      if (exitCode === params.verifyExpectedExitCode) {
        success = true;
        stoppedBy = "goal-achieved";
        iterationHistory.push({
          iteration: i,
          verificationResult,
          fixResult: null,
          progress: "forward",
        });
        break;
      }

      // Check stuck condition BEFORE fixing
      let progress: "forward" | "backward" | "stuck" = "forward";
      const currentOutput = normalizeOutput(verificationResult);

      if (params.stuckDetection.enabled && i > 1) {
        if (params.stuckDetection.compareOutputs && currentOutput === previousOutput) {
          progress = "stuck";
          stuckCounter++;
        } else {
          progress = "forward";
          stuckCounter = 0;
        }

        if (stuckCounter >= params.stuckDetection.noProgressThreshold) {
          stuckDetected = true;
          stoppedBy = "stuck-detected";
          iterationHistory.push({
            iteration: i,
            verificationResult,
            fixResult: null,
            progress: "stuck",
          });
          break;
        }
      }

      previousOutput = currentOutput;

      // 2. Fix Phase
      let fixResult: unknown;
      const fixProgress: "forward" | "backward" | "stuck" = progress;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!stuckDetected && !success) {
        try {
          const injectedFixParams = {
            ...params.fixParams,
            verificationResult: verificationResult,
          };
          const fr = await fixTool.execute(injectedFixParams, context);
          fixResult = fr.data;
        } catch (err) {
          iterationHistory.push({
            iteration: i,
            verificationResult,
            fixResult: { error: String(err) },
            progress: "stuck",
          });
          throw err;
        }

        iterationHistory.push({
          iteration: i,
          verificationResult,
          fixResult,
          progress: fixProgress,
        });

        const currentCost = 0;
        if (params.costLimit && currentCost > params.costLimit) {
          stoppedBy = "cost-limit";
          break;
        }
      }
    }

    const result: IterativeRefinementResult = {
      success,
      iterations: iterationHistory.length,
      finalResult,
      stuckDetected,
      stoppedBy,
      iterationHistory,
    };

    context.emit("tool.end", { name: "iterative-refinement", duration: Date.now() - startTime });
    return { success: true, data: result };
  },
};
