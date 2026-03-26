import { describe, expect, it, vi } from "vitest";
import { AgentError, createCodeExplorerAgent } from "../index.js";
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

const REQUIRED_TOOL_NAMES = ["file-read", "glob", "grep", "ast-grep", "lsp-symbols"] as const;

function makeAllTools(overrides: Partial<Record<string, ToolResult>> = {}): Tool[] {
  return REQUIRED_TOOL_NAMES.map((name) => {
    const defaultResult: ToolResult = { success: true, data: {} };
    return makeTool(name, overrides[name] ?? defaultResult);
  });
}

function findEmitCall(emit: MockFn, eventName: string): [string, unknown] | undefined {
  return (emit.mock.calls as [string, unknown][]).find(([event]) => event === eventName);
}

describe("createCodeExplorerAgent", () => {
  describe("metadata", () => {
    it("returns an Agent with name 'code-explorer'", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      expect(agent.metadata.name).toBe("code-explorer");
    });

    it("has tier 'medium'", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      expect(agent.metadata.tier).toBe("medium");
    });

    it("has category 'research'", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      expect(agent.metadata.category).toBe("research");
    });

    it("has all required capabilities", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      const caps = agent.metadata.capabilities;
      expect(caps).toContain("file-read");
      expect(caps).toContain("glob");
      expect(caps).toContain("grep");
      expect(caps).toContain("ast-grep");
      expect(caps).toContain("lsp-symbols");
      expect(caps).toContain("codebase-search");
      expect(caps).toContain("pattern-discovery");
      expect(caps).toContain("file-navigation");
    });

    it("has 'exploration' tag", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      expect(agent.metadata.tags).toContain("exploration");
    });

    it("has 'medium' tag", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      expect(agent.metadata.tags).toContain("medium");
    });

    it("has 'research' tag", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      expect(agent.metadata.tags).toContain("research");
    });

    it("has non-empty description", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      expect(agent.metadata.description.length).toBeGreaterThan(0);
    });

    it("does not include write capabilities", () => {
      const agent = createCodeExplorerAgent({ tools: makeAllTools() });
      const caps = agent.metadata.capabilities;
      expect(caps).not.toContain("file-write");
      expect(caps).not.toContain("file-edit");
      expect(caps).not.toContain("bash");
      expect(caps).not.toContain("code-generation");
    });
  });

  describe("execute", () => {
    it("emits agent.started at the beginning", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("find auth patterns", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ agentId: "code-explorer" }),
      );
    });

    it("includes parentAgentId in agent.started event", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx, emit } = makeContext({
        tools: makeAllTools(),
        parentAgentId: "dispatcher",
      });

      await agent.execute("find auth patterns", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ parentAgentId: "dispatcher" }),
      );
    });

    it("truncates long input to 200 chars in agent.started event", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });
      const longInput = "find " + "x".repeat(300);

      await agent.execute(longInput, ctx);

      const startedCall = findEmitCall(emit, "agent.started");
      expect(startedCall).toBeDefined();
      const payload = startedCall?.[1] as { input: string } | undefined;
      expect(payload?.input.length).toBeLessThanOrEqual(200);
    });

    it("emits agent.completed on success", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("find auth patterns", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.completed",
        expect.objectContaining({ agentId: "code-explorer", success: true }),
      );
    });

    it("returns success: true when all tools present", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.success).toBe(true);
    });

    it("output string mentions the input task", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.output).toContain("find auth patterns");
    });

    it("returns non-negative toolCalls", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.toolCalls).toBeGreaterThanOrEqual(0);
    });

    it("returns positive tokensUsed for non-empty input", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it("throws AgentError(MISSING_TOOLS) when no tools provided", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: [] });

      await expect(agent.execute("find auth patterns", ctx)).rejects.toThrow(AgentError);
    });

    it("AgentError has MISSING_TOOLS code when tools are absent", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: [] });

      let caught: AgentError | undefined;
      try {
        await agent.execute("find auth patterns", ctx);
      } catch (e) {
        if (e instanceof AgentError) caught = e;
      }

      expect(caught?.code).toBe("MISSING_TOOLS");
    });

    it("throws AgentError when only some required tools are present", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({
        tools: [makeTool("file-read"), makeTool("glob")],
      });

      await expect(agent.execute("find auth patterns", ctx)).rejects.toThrow(AgentError);
    });

    it("MISSING_TOOLS error message lists the missing tool names", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({
        tools: [makeTool("file-read")],
      });

      let caught: AgentError | undefined;
      try {
        await agent.execute("find auth patterns", ctx);
      } catch (e) {
        if (e instanceof AgentError) caught = e;
      }

      expect(caught?.message).toMatch(/grep/);
    });

    it("emits code-explorer.tools-verified event after tool check passes", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("find auth patterns", ctx);

      expect(emit).toHaveBeenCalledWith(
        "code-explorer.tools-verified",
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          availableTools: expect.any(Array),
        }),
      );
    });

    it("calls glob tool during execution", async () => {
      const allTools = makeAllTools();
      const globTool = allTools.find((t) => t.name === "glob");

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      await agent.execute("find auth patterns", ctx);

      expect(globTool?.execute).toHaveBeenCalled();
    });

    it("calls grep tool during execution", async () => {
      const allTools = makeAllTools();
      const grepTool = allTools.find((t) => t.name === "grep");

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      await agent.execute("find auth patterns", ctx);

      expect(grepTool?.execute).toHaveBeenCalled();
    });

    it("calls lsp-symbols tool during execution", async () => {
      const allTools = makeAllTools();
      const lspTool = allTools.find((t) => t.name === "lsp-symbols");

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      await agent.execute("find auth patterns", ctx);

      expect(lspTool?.execute).toHaveBeenCalled();
    });

    it("emits code-explorer.grep-completed when grep succeeds", async () => {
      const grepResult: ToolResult = {
        success: true,
        data: { matchCount: 5 },
      };
      const allTools = makeAllTools({ grep: grepResult });

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: allTools });

      await agent.execute("find auth patterns", ctx);

      expect(emit).toHaveBeenCalledWith(
        "code-explorer.grep-completed",
        expect.objectContaining({ matches: 5 }),
      );
    });

    it("emits code-explorer.symbols-indexed when lsp-symbols succeeds", async () => {
      const lspResult: ToolResult = {
        success: true,
        data: { symbolCount: 42 },
      };
      const allTools = makeAllTools({ "lsp-symbols": lspResult });

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: allTools });

      await agent.execute("find auth patterns", ctx);

      expect(emit).toHaveBeenCalledWith(
        "code-explorer.symbols-indexed",
        expect.objectContaining({ symbolCount: 42 }),
      );
    });

    it("output contains file count info", async () => {
      const globResult: ToolResult = {
        success: true,
        data: { count: 25 },
      };
      const allTools = makeAllTools({ glob: globResult });

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.output).toContain("25");
    });

    it("output contains grep match count", async () => {
      const grepResult: ToolResult = {
        success: true,
        data: { matchCount: 7 },
      };
      const allTools = makeAllTools({ grep: grepResult });

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.output).toContain("7");
    });

    it("still succeeds when grep tool throws (graceful degradation)", async () => {
      const allTools = makeAllTools();
      const grepToolItem = allTools.find((t) => t.name === "grep");
      if (grepToolItem) {
        (grepToolItem.execute as MockFn).mockRejectedValue(new Error("pattern error"));
      }

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.success).toBe(true);
    });

    it("still succeeds when glob tool throws (graceful degradation)", async () => {
      const allTools = makeAllTools();
      const globToolItem = allTools.find((t) => t.name === "glob");
      if (globToolItem) {
        (globToolItem.execute as MockFn).mockRejectedValue(new Error("permission denied"));
      }

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.success).toBe(true);
    });

    it("still succeeds when lsp-symbols tool throws (graceful degradation)", async () => {
      const allTools = makeAllTools();
      const lspToolItem = allTools.find((t) => t.name === "lsp-symbols");
      if (lspToolItem) {
        (lspToolItem.execute as MockFn).mockRejectedValue(new Error("lsp not available"));
      }

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.success).toBe(true);
    });

    it("uses tools from context, not from config", async () => {
      const configTools: Tool[] = [];
      const agent = createCodeExplorerAgent({ tools: configTools });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("find auth patterns", ctx);

      expect(result.success).toBe(true);
    });

    it("agent is reusable across multiple executions", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });

      for (let i = 0; i < 3; i++) {
        const { ctx } = makeContext({ tools: makeAllTools() });
        const result = await agent.execute(`search ${String(i)}`, ctx);
        expect(result.success).toBe(true);
      }
    });

    it("conforms to Agent interface shape", () => {
      const agent = createCodeExplorerAgent({ tools: [] });

      expect(agent).toHaveProperty("metadata");
      expect(agent).toHaveProperty("execute");
      expect(typeof agent.execute).toBe("function");
      expect(agent.metadata).toHaveProperty("name");
      expect(agent.metadata).toHaveProperty("tier");
      expect(agent.metadata).toHaveProperty("category");
      expect(agent.metadata).toHaveProperty("capabilities");
      expect(agent.metadata).toHaveProperty("tags");
    });
  });

  describe("tool context forwarding", () => {
    it("passes workspaceRoot to tool execute calls", async () => {
      const allTools = makeAllTools();
      const globToolItem = allTools.find((t) => t.name === "glob");

      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({
        tools: allTools,
        workspaceRoot: "/my-project",
      });

      await agent.execute("find auth patterns", ctx);

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
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools, emit });

      await agent.execute("find auth patterns", ctx);

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
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("find auth patterns", ctx);

      expect(result).toHaveProperty("success");
    });

    it("result has output string", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("find auth patterns", ctx);

      expect(typeof result.output).toBe("string");
    });

    it("result has toolCalls number", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("find auth patterns", ctx);

      expect(typeof result.toolCalls).toBe("number");
    });

    it("result has tokensUsed number", async () => {
      const agent = createCodeExplorerAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("find auth patterns", ctx);

      expect(typeof result.tokensUsed).toBe("number");
    });
  });
});
