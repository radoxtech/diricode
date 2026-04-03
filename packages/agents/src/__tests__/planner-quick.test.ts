import { describe, expect, it, vi } from "vitest";
import { AgentError, createPlannerQuickAgent } from "../index.js";
import type { AgentContext, AgentResult } from "../index.js";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";

type MockFn = ReturnType<typeof vi.fn>;

function makeContext(overrides?: Partial<AgentContext>): { ctx: AgentContext; emit: MockFn } {
  const emit = vi.fn();
  const ctx: AgentContext = {
    workspaceRoot: "/workspace",
    sessionId: "session-123",
    tools: [],
    emit,
    ...overrides,
  };
  return { ctx, emit };
}

function makeTool(name: string, executeResult?: ToolResult): Tool {
  return {
    name,
    description: `${name} tool`,
    parameters: { parse: (v: unknown) => v } as unknown as Tool["parameters"],
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    execute: vi
      .fn()
      .mockResolvedValue(executeResult ?? { success: true, data: {} }) as Tool["execute"],
  };
}

const REQUIRED_TOOL_NAMES = ["file-read", "glob", "grep"] as const;

function makeAllTools(overrides: Partial<Record<string, ToolResult>> = {}): Tool[] {
  return REQUIRED_TOOL_NAMES.map((name) => {
    const defaultResult: ToolResult = { success: true, data: {} };
    return makeTool(name, overrides[name] ?? defaultResult);
  });
}

function findEmitCall(emit: MockFn, eventName: string): [string, unknown] | undefined {
  return (emit.mock.calls as [string, unknown][]).find(([event]) => event === eventName);
}

describe("createPlannerQuickAgent", () => {
  describe("metadata", () => {
    it("returns an Agent with name 'planner-quick'", () => {
      const agent = createPlannerQuickAgent({ tools: makeAllTools() });
      expect(agent.metadata.name).toBe("planner-quick");
    });

    it("allows medium tier", () => {
      const agent = createPlannerQuickAgent({ tools: makeAllTools() });
      expect(agent.metadata.allowedTiers).toContain("medium");
    });

    it("has primary domain 'planning'", () => {
      const agent = createPlannerQuickAgent({ tools: makeAllTools() });
      expect(agent.metadata.capabilities.primary).toBe("planning");
    });

    it("has expected specialization and model attributes", () => {
      const agent = createPlannerQuickAgent({ tools: makeAllTools() });
      const caps = agent.metadata.capabilities;
      expect(caps.specialization).toContain("task-decomposition");
      expect(caps.specialization).toContain("operational-plan");
      expect(caps.modelAttributes).toContain("reasoning");
      expect(caps.modelAttributes).toContain("speed");
    });

    it("has non-empty description", () => {
      const agent = createPlannerQuickAgent({ tools: makeAllTools() });
      expect(agent.metadata.description.length).toBeGreaterThan(0);
    });
  });

  describe("execute", () => {
    it("emits agent.started at the beginning", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("plan the feature implementation", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ agentId: "planner-quick" }),
      );
    });

    it("includes parentAgentId in agent.started event", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx, emit } = makeContext({
        tools: makeAllTools(),
        parentAgentId: "dispatcher",
      });

      await agent.execute("plan the feature implementation", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ parentAgentId: "dispatcher" }),
      );
    });

    it("truncates long input to 200 chars in agent.started event", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });
      const longInput = "plan " + "x".repeat(300);

      await agent.execute(longInput, ctx);

      const startedCall = findEmitCall(emit, "agent.started");
      expect(startedCall).toBeDefined();
      const payload = startedCall?.[1] as { input: string } | undefined;
      expect(payload?.input.length).toBeLessThanOrEqual(200);
    });

    it("emits agent.completed on success", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("plan the feature implementation", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.completed",
        expect.objectContaining({ agentId: "planner-quick", success: true }),
      );
    });

    it("returns success: true when all tools present", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("plan the feature implementation", ctx);

      expect(result.success).toBe(true);
    });

    it("output contains plan structure with success criteria", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("plan the feature implementation", ctx);

      expect(result.output).toContain("# Quick Plan");
      expect(result.output).toContain("## Task");
      expect(result.output).toContain("## Success Criteria");
      expect(result.output).toContain("## Steps");
    });

    it("output mentions the input task", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("implement user authentication", ctx);

      expect(result.output).toContain("implement user authentication");
    });

    it("returns non-negative toolCalls", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("plan the feature implementation", ctx);

      expect(result.toolCalls).toBeGreaterThanOrEqual(0);
    });

    it("returns positive tokensUsed for non-empty input", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("plan the feature implementation", ctx);

      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it("throws AgentError(MISSING_TOOLS) when no tools provided", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: [] });

      await expect(agent.execute("plan the feature implementation", ctx)).rejects.toThrow(
        AgentError,
      );
    });

    it("AgentError has MISSING_TOOLS code when tools are absent", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: [] });

      let caught: AgentError | undefined;
      try {
        await agent.execute("plan the feature implementation", ctx);
      } catch (e) {
        if (e instanceof AgentError) caught = e;
      }

      expect(caught?.code).toBe("MISSING_TOOLS");
    });

    it("throws AgentError when only some required tools are present", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({
        tools: [makeTool("file-read"), makeTool("glob")],
      });

      await expect(agent.execute("plan the feature implementation", ctx)).rejects.toThrow(
        AgentError,
      );
    });

    it("MISSING_TOOLS error message lists the missing tool names", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({
        tools: [makeTool("file-read")],
      });

      let caught: AgentError | undefined;
      try {
        await agent.execute("plan the feature implementation", ctx);
      } catch (e) {
        if (e instanceof AgentError) caught = e;
      }

      expect(caught?.message).toMatch(/grep/);
    });

    it("emits planner-quick.tools-verified after tool check passes", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("plan the feature implementation", ctx);

      expect(emit).toHaveBeenCalledWith(
        "planner-quick.tools-verified",
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          availableTools: expect.any(Array),
        }),
      );
    });

    it("calls glob tool during execution", async () => {
      const allTools = makeAllTools();
      const globTool = allTools.find((t) => t.name === "glob");

      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      await agent.execute("plan the feature implementation", ctx);

      expect(globTool?.execute).toHaveBeenCalled();
    });

    it("calls grep tool during execution", async () => {
      const allTools = makeAllTools();
      const grepTool = allTools.find((t) => t.name === "grep");

      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      await agent.execute("plan the feature implementation", ctx);

      expect(grepTool?.execute).toHaveBeenCalled();
    });

    it("emits planner-quick.repo-scanned when glob succeeds", async () => {
      const globResult: ToolResult = {
        success: true,
        data: { files: ["a.ts", "b.ts"], count: 2 },
      };
      const allTools = makeAllTools({ glob: globResult });

      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: allTools });

      await agent.execute("plan the feature implementation", ctx);

      expect(emit).toHaveBeenCalledWith(
        "planner-quick.repo-scanned",
        expect.objectContaining({ fileCount: 2 }),
      );
    });

    it("still succeeds when glob tool throws (graceful degradation)", async () => {
      const allTools = makeAllTools();
      const globToolItem = allTools.find((t) => t.name === "glob");
      if (globToolItem) {
        (globToolItem.execute as MockFn).mockRejectedValue(new Error("permission denied"));
      }

      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("plan the feature implementation", ctx);

      expect(result.success).toBe(true);
    });

    it("still succeeds when grep tool throws (graceful degradation)", async () => {
      const allTools = makeAllTools();
      const grepToolItem = allTools.find((t) => t.name === "grep");
      if (grepToolItem) {
        (grepToolItem.execute as MockFn).mockRejectedValue(new Error("search failed"));
      }

      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("plan the feature implementation", ctx);

      expect(result.success).toBe(true);
    });

    it("uses tools from context, not from config", async () => {
      const configTools: Tool[] = [];
      const agent = createPlannerQuickAgent({ tools: configTools });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("plan the feature implementation", ctx);

      expect(result.success).toBe(true);
    });

    it("agent is reusable across multiple executions", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });

      for (let i = 0; i < 3; i++) {
        const { ctx } = makeContext({ tools: makeAllTools() });
        const result = await agent.execute(`task ${String(i)}`, ctx);
        expect(result.success).toBe(true);
      }
    });

    it("conforms to Agent interface shape", () => {
      const agent = createPlannerQuickAgent({ tools: [] });

      expect(agent).toHaveProperty("metadata");
      expect(agent).toHaveProperty("execute");
      expect(typeof agent.execute).toBe("function");
      expect(agent.metadata).toHaveProperty("name");
      expect(agent.metadata).toHaveProperty("allowedTiers");
      expect(agent.metadata).toHaveProperty("capabilities");
    });
  });

  describe("tool context forwarding", () => {
    it("passes workspaceRoot to tool execute calls", async () => {
      const allTools = makeAllTools();
      const globToolItem = allTools.find((t) => t.name === "glob");

      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({
        tools: allTools,
        workspaceRoot: "/my-project",
      });

      await agent.execute("plan the feature implementation", ctx);

      if (globToolItem) {
        const calls = (globToolItem.execute as MockFn).mock.calls as [unknown, ToolContext][];
        if (calls.length > 0) {
          expect(calls[0]?.[1]?.workspaceRoot).toBe("/my-project");
        }
      }
    });

    it("passes emit function to tool execute calls", async () => {
      const allTools = makeAllTools();
      const globToolItem = allTools.find((t) => t.name === "glob");

      const emit = vi.fn();
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools, emit });

      await agent.execute("plan the feature implementation", ctx);

      if (globToolItem) {
        const calls = (globToolItem.execute as MockFn).mock.calls as [unknown, ToolContext][];
        if (calls.length > 0) {
          expect(calls[0]?.[1]?.emit).toBe(emit);
        }
      }
    });
  });

  describe("AgentResult shape", () => {
    it("result has success field", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("plan the feature implementation", ctx);

      expect(result).toHaveProperty("success");
    });

    it("result has output string", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("plan the feature implementation", ctx);

      expect(typeof result.output).toBe("string");
    });

    it("result has toolCalls number", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("plan the feature implementation", ctx);

      expect(typeof result.toolCalls).toBe("number");
    });

    it("result has tokensUsed number", async () => {
      const agent = createPlannerQuickAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("plan the feature implementation", ctx);

      expect(typeof result.tokensUsed).toBe("number");
    });
  });
});
