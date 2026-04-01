import { describe, expect, test, vi, beforeEach } from "vitest";
import { createDispatcher } from "../dispatcher.js";
import { AgentRegistry } from "../registry.js";
import type { AgentContext, Tool, ToolContext, Agent } from "@diricode/core";
import { BoundaryViolationError, DISPATCHER_CONTRACT, enforceDispatcherBoundary } from "@diricode/core";


vi.mock("../sandbox.js", () => ({
  executeInSandbox: vi.fn().mockResolvedValue({
    success: true,
    output: "Mocked success",
    totalToolCalls: 1,
    totalTokens: 100,
    stopReason: "success",
  }),
}));

describe("DC-CORE-015: Dispatcher Boundary Enforcement", () => {
  let registry: AgentRegistry;
  let dispatcher: ReturnType<typeof createDispatcher>;
  let context: AgentContext;
  let emitFn: ReturnType<typeof vi.fn>;

  const mockWriteTool: Tool = {
    name: "file_write",
    description: "Mutates files",
    parameters: {} as any,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    execute: async () => ({ success: true, data: {} }),
  };

  const mockBashTool: Tool = {
    name: "bash",
    description: "Executes commands",
    parameters: {} as any,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    execute: async () => ({ success: true, data: {} }),
  };

  const mockClassifyTool: Tool = {
    name: "classify_intent",
    description: "Classifies intent",
    parameters: {} as any,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    execute: async () => ({ success: true, data: {} }),
  };

  beforeEach(() => {
    registry = new AgentRegistry();

    
    const dummyAgent: Agent = {
      metadata: {
        name: "code_agent",
        description: "Handles code tasks",
        tier: "heavy",
        category: "code",
        capabilities: [],
        tags: [],
      },
      execute: async () => ({ success: true, output: "done", toolCalls: 0, tokensUsed: 0 }),
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

      const writeTool = safeTools.find((t) => t.name === "file_write")!;
      const classifyTool = safeTools.find((t) => t.name === "classify_intent")!;

      
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
      const bashTool = safeTools.find((t) => t.name === "bash")!;

      await expect(bashTool.execute({}, {} as ToolContext)).rejects.toThrow(BoundaryViolationError);
    });

    test("Error messages are clear and actionable", async () => {
      
      const safeTools = enforceDispatcherBoundary(context.tools, emitFn);
      const bashTool = safeTools.find((t) => t.name === "bash")!;

      let error: Error | null = null;
      try {
        await bashTool.execute({}, {} as ToolContext);
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeInstanceOf(BoundaryViolationError);
      expect(error!.message).toMatch(
        /Dispatcher is prohibited from using mutating or unauthorized tool: bash/,
      );
    });
  });
});
