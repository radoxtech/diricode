import { describe, expect, test, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createDispatcher } from "../dispatcher.js";
import { AgentRegistry } from "../registry.js";
import type { AgentContext, Tool, ToolContext, Agent } from "@diricode/core";
import {
  BoundaryViolationError,
  DISPATCHER_CONTRACT,
  enforceDispatcherBoundary,
} from "@diricode/core";

describe("DC-CORE-015: Dispatcher Boundary Enforcement", () => {
  let registry: AgentRegistry;
  let dispatcher: ReturnType<typeof createDispatcher>;
  let context: AgentContext;
  let emitFn: ReturnType<typeof vi.fn>;

  const mockWriteTool: Tool = {
    name: "file_write",
    description: "Mutates files",
    parameters: z.object({}),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    execute: (_params: unknown) => {
      return Promise.resolve({ success: true, data: {} as unknown });
    },
  };

  const mockBashTool: Tool = {
    name: "bash",
    description: "Executes commands",
    parameters: z.object({}),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    execute: (_params: unknown) => {
      return Promise.resolve({ success: true, data: {} as unknown });
    },
  };

  const mockClassifyTool: Tool = {
    name: "classify_intent",
    description: "Classifies intent",
    parameters: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    execute: (_params: unknown) => {
      return Promise.resolve({ success: true, data: {} as unknown });
    },
  };

  beforeEach(() => {
    registry = new AgentRegistry();

    const dummyAgent: Agent = {
      metadata: {
        name: "code_agent",
        description: "Handles code tasks",
        allowedTiers: ["heavy"],
        capabilities: {
          primary: "coding",
          specialization: [],
          modelAttributes: ["reasoning", "agentic"],
        },
      },
      execute: () => {
        return Promise.resolve({ success: true, output: "done", toolCalls: 0, tokensUsed: 0 });
      },
    };
    registry.register(dummyAgent);

    dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });

    emitFn = vi.fn();
    context = {
      workspaceRoot: "/test",
      sessionId: "session-1",
      tools: [mockWriteTool, mockBashTool, mockClassifyTool],
      emit: emitFn,
    };
  });

  describe("Permitted Behaviors", () => {
    test("Dispatcher can classify intent and discover agents", async () => {
      await dispatcher.execute("Please write a new function", context);

      expect(emitFn).toHaveBeenCalledWith("dispatcher.intent.classified", expect.any(Object));

      expect(emitFn).toHaveBeenCalledWith(
        "dispatcher.agent.selected",
        expect.objectContaining({
          agent: "code_agent",
        }),
      );
    });

    test("Dispatcher can delegate to specialists and emit observability events", async () => {
      await dispatcher.execute("Please implement code feature X", context);

      expect(emitFn).toHaveBeenCalledWith(
        "dispatcher.boundary.checked",
        expect.objectContaining({
          allowedTools: DISPATCHER_CONTRACT.allowedTools,
          enforced: true,
        }),
      );
      expect(emitFn).toHaveBeenCalledWith(
        "dispatcher.delegation.created",
        expect.objectContaining({
          agent: "code_agent",
        }),
      );
    });
  });

  describe("Prohibited Behaviors", () => {
    test("Dispatcher attempting to use file_write throws BoundaryViolationError", async () => {
      const safeTools = enforceDispatcherBoundary(context.tools, emitFn);

      const writeTool = safeTools.find((t) => t.name === "file_write");
      const classifyTool = safeTools.find((t) => t.name === "classify_intent");

      expect(writeTool).toBeDefined();
      expect(classifyTool).toBeDefined();

      if (!classifyTool || !writeTool) return;

      const result = await classifyTool.execute({}, {} as ToolContext);
      expect(result.success).toBe(true);

      await expect(writeTool.execute({}, {} as ToolContext)).rejects.toThrow(
        BoundaryViolationError,
      );

      expect(emitFn).toHaveBeenCalledWith(
        "dispatcher.boundary.violation.tool_attempt",
        expect.objectContaining({
          type: "dispatcher.boundary.violation.tool_attempt",
          attemptedAction: "file_write",
          severity: "error",
        }),
      );
    });

    test("Dispatcher attempting to use bash throws BoundaryViolationError", async () => {
      const safeTools = enforceDispatcherBoundary(context.tools, emitFn);
      const bashTool = safeTools.find((t) => t.name === "bash");

      expect(bashTool).toBeDefined();

      if (!bashTool) return;

      await expect(bashTool.execute({}, {} as ToolContext)).rejects.toThrow(BoundaryViolationError);
    });

    test("Error messages are clear and actionable", async () => {
      const safeTools = enforceDispatcherBoundary(context.tools, emitFn);
      const bashTool = safeTools.find((t) => t.name === "bash");

      expect(bashTool).toBeDefined();

      if (!bashTool) return;

      let error: Error | null = null;
      try {
        await bashTool.execute({}, {} as ToolContext);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeInstanceOf(BoundaryViolationError);
      expect(error?.message).toMatch(
        /Dispatcher is prohibited from using mutating or unauthorized tool: bash/,
      );
    });
  });
});
