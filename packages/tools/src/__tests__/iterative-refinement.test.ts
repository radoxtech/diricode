import { describe, expect, it, vi } from "vitest";
import type { Tool, ToolContext } from "@diricode/core";
import { z } from "zod";
import {
  iterativeRefinementTool,
  registerIterativeRefinementTools,
} from "../iterative-refinement.js";

const mockContext: ToolContext = {
  workspaceRoot: "/mock/workspace",
  emit: vi.fn(),
};

describe("Iterative Refinement Engine", () => {
  it("should achieve the goal in 1 iteration if verify succeeds immediately", async () => {
    const mockVerifyTool: Tool = {
      name: "mock-verify",
      description: "Mock Verify Tool",
      parameters: z.object({ command: z.string() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      execute: () => Promise.resolve({ success: true, data: { exitCode: 0, output: "Success" } }),
    };

    const mockFixTool: Tool = {
      name: "mock-fix",
      description: "Mock Fix Tool",
      parameters: z.object({}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      execute: () => Promise.resolve({ success: true, data: {} }),
    };

    registerIterativeRefinementTools([mockVerifyTool, mockFixTool]);

    const result = await iterativeRefinementTool.execute(
      {
        goal: "Pass tests",
        verifyTool: "mock-verify",
        verifyCommand: "test",
        verifyExpectedExitCode: 0,
        maxIterations: 5,
        stuckDetection: { enabled: true, noProgressThreshold: 3, compareOutputs: true },
        fixTool: "mock-fix",
        fixParams: {},
      },
      mockContext,
    );

    expect(result.success).toBe(true);
    expect(result.data.iterations).toBe(1);
    expect(result.data.stoppedBy).toBe("goal-achieved");
    expect(result.data.stuckDetected).toBe(false);
  });

  it("should detect stuck loop if output remains the same", async () => {
    const mockVerifyTool: Tool = {
      name: "mock-verify-fail",
      description: "Mock Verify Tool Fail",
      parameters: z.object({ command: z.string() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      execute: () => Promise.resolve({ success: true, data: { exitCode: 1, output: "Error X" } }),
    };

    const mockFixTool: Tool = {
      name: "mock-fix-noop",
      description: "Mock Fix Tool Noop",
      parameters: z.object({}),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      execute: () => Promise.resolve({ success: true, data: {} }),
    };

    registerIterativeRefinementTools([mockVerifyTool, mockFixTool]);

    const result = await iterativeRefinementTool.execute(
      {
        goal: "Pass tests",
        verifyTool: "mock-verify-fail",
        verifyCommand: "test",
        verifyExpectedExitCode: 0,
        maxIterations: 5,
        stuckDetection: { enabled: true, noProgressThreshold: 3, compareOutputs: true },
        fixTool: "mock-fix-noop",
        fixParams: {},
      },
      mockContext,
    );

    expect(result.success).toBe(true);
    expect(result.data.iterations).toBe(4);
    expect(result.data.stoppedBy).toBe("stuck-detected");
    expect(result.data.stuckDetected).toBe(true);
  });
});
