import { describe, expect, it, vi } from "vitest";
import { createCodeWriterAgent } from "../index.js";
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

const REQUIRED_TOOL_NAMES = [
  "file-read",
  "file-write",
  "file-edit",
  "glob",
  "grep",
  "ast-grep",
  "lsp-symbols",
  "diagnostics",
  "bash",
] as const;

function makeAllTools(overrides: Partial<Record<string, ToolResult>> = {}): Tool[] {
  return REQUIRED_TOOL_NAMES.map((name) => {
    const defaultResult: ToolResult = { success: true, data: {} };
    return makeTool(name, overrides[name] ?? defaultResult);
  });
}

function findEmitCall(emit: MockFn, eventName: string): [string, unknown] | undefined {
  return (emit.mock.calls as [string, unknown][]).find(([event]) => event === eventName);
}

describe("createCodeWriterAgent", () => {
  describe("metadata", () => {
    it("returns an Agent with name 'code-writer'", () => {
      const agent = createCodeWriterAgent({ tools: makeAllTools() });
      expect(agent.metadata.name).toBe("code-writer");
    });

    it("allows heavy tier", () => {
      const agent = createCodeWriterAgent({ tools: makeAllTools() });
      expect(agent.metadata.allowedTiers).toContain("heavy");
    });

    it("has primary domain 'coding'", () => {
      const agent = createCodeWriterAgent({ tools: makeAllTools() });
      expect(agent.metadata.capabilities.primary).toBe("coding");
    });

    it("has expected specialization and model attributes", () => {
      const agent = createCodeWriterAgent({ tools: makeAllTools() });
      const caps = agent.metadata.capabilities;
      expect(caps.specialization).toContain("implementation");
      expect(caps.specialization).toContain("refactoring");
      expect(caps.specialization).toContain("multi-file");
      expect(caps.modelAttributes).toContain("reasoning");
      expect(caps.modelAttributes).toContain("agentic");
    });

    it("has non-empty description", () => {
      const agent = createCodeWriterAgent({ tools: makeAllTools() });
      expect(agent.metadata.description.length).toBeGreaterThan(0);
    });

    it("has toolPolicy with allowedTools set to required tools", () => {
      const agent = createCodeWriterAgent({ tools: makeAllTools() });
      expect(agent.metadata.toolPolicy).toBeDefined();
      expect(agent.metadata.toolPolicy?.allowedTools).toBeDefined();
      const allowed = agent.metadata.toolPolicy?.allowedTools ?? [];
      expect(allowed).toContain("file-read");
      expect(allowed).toContain("file-write");
      expect(allowed).toContain("file-edit");
      expect(allowed).toContain("glob");
      expect(allowed).toContain("grep");
      expect(allowed).toContain("ast-grep");
      expect(allowed).toContain("lsp-symbols");
      expect(allowed).toContain("diagnostics");
      expect(allowed).toContain("bash");
    });

    it("toolPolicy does not include dangerous tools", () => {
      const agent = createCodeWriterAgent({ tools: makeAllTools() });
      const allowed = agent.metadata.toolPolicy?.allowedTools ?? [];
      expect(allowed).not.toContain("git-commit");
      expect(allowed).not.toContain("git-push");
      expect(allowed).not.toContain("bash-execute");
    });
  });

  describe("execute", () => {
    it("emits agent.started at the beginning", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("implement feature X", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ agentId: "code-writer" }),
      );
    });

    it("includes parentAgentId in agent.started event", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx, emit } = makeContext({
        tools: makeAllTools(),
        parentAgentId: "dispatcher",
      });

      await agent.execute("implement feature X", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ parentAgentId: "dispatcher" }),
      );
    });

    it("truncates long input to 200 chars in agent.started event", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });
      const longInput = "implement " + "x".repeat(300);

      await agent.execute(longInput, ctx);

      const startedCall = findEmitCall(emit, "agent.started");
      expect(startedCall).toBeDefined();
      const payload = startedCall?.[1] as { input: string } | undefined;
      expect(payload?.input.length).toBeLessThanOrEqual(200);
    });

    it("emits agent.completed on success", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("implement feature X", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.completed",
        expect.objectContaining({ agentId: "code-writer", success: true }),
      );
    });

    it("returns success: true when all tools present", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.success).toBe(true);
    });

    it("output string mentions the input task", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.output).toContain("implement feature X");
    });

    it("returns non-negative toolCalls", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.toolCalls).toBeGreaterThanOrEqual(0);
    });

    it("returns positive tokensUsed for non-empty input", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it("emits code-writer.tools-verified event after tool check passes", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: makeAllTools() });

      await agent.execute("implement feature X", ctx);

      expect(emit).toHaveBeenCalledWith(
        "code-writer.tools-verified",
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          availableTools: expect.any(Array),
        }),
      );
    });

    it("calls glob tool during execution", async () => {
      const allTools = makeAllTools();
      const globTool = allTools.find((t) => t.name === "glob");

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      await agent.execute("implement feature X", ctx);

      expect(globTool?.execute).toHaveBeenCalled();
    });

    it("calls diagnostics tool during execution", async () => {
      const allTools = makeAllTools();
      const diagTool = allTools.find((t) => t.name === "diagnostics");

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      await agent.execute("implement feature X", ctx);

      expect(diagTool?.execute).toHaveBeenCalled();
    });

    it("emits code-writer.diagnostics-checked when diagnostics succeed", async () => {
      const diagResult: ToolResult = {
        success: true,
        data: { diagnostics: [], errorCount: 0, warningCount: 0, infoCount: 0, raw: "" },
      };
      const allTools = makeAllTools({ diagnostics: diagResult });

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx, emit } = makeContext({ tools: allTools });

      await agent.execute("implement feature X", ctx);

      expect(emit).toHaveBeenCalledWith(
        "code-writer.diagnostics-checked",
        expect.objectContaining({ errors: 0 }),
      );
    });

    it("reflects diagnostic error count in output when errors present", async () => {
      const diagResult: ToolResult = {
        success: true,
        data: { diagnostics: [], errorCount: 3, warningCount: 0, infoCount: 0, raw: "" },
      };
      const allTools = makeAllTools({ diagnostics: diagResult });

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.output).toContain("3");
    });

    it("output contains 'clean' when zero diagnostic errors", async () => {
      const diagResult: ToolResult = {
        success: true,
        data: { diagnostics: [], errorCount: 0, warningCount: 0, infoCount: 0, raw: "" },
      };
      const allTools = makeAllTools({ diagnostics: diagResult });

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.output).toContain("clean");
    });

    it("still succeeds when diagnostics tool throws (graceful degradation)", async () => {
      const allTools = makeAllTools();
      const diagTool = allTools.find((t) => t.name === "diagnostics");
      if (diagTool) {
        (diagTool.execute as MockFn).mockRejectedValue(new Error("tsc not found"));
      }

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.success).toBe(true);
    });

    it("still succeeds when glob tool throws (graceful degradation)", async () => {
      const allTools = makeAllTools();
      const globToolItem = allTools.find((t) => t.name === "glob");
      if (globToolItem) {
        (globToolItem.execute as MockFn).mockRejectedValue(new Error("permission denied"));
      }

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.success).toBe(true);
    });

    it("uses tools from context, not from config", async () => {
      const configTools: Tool[] = [];
      const agent = createCodeWriterAgent({ tools: configTools });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result = await agent.execute("implement feature X", ctx);

      expect(result.success).toBe(true);
    });

    it("agent is reusable across multiple executions", async () => {
      const agent = createCodeWriterAgent({ tools: [] });

      for (let i = 0; i < 3; i++) {
        const { ctx } = makeContext({ tools: makeAllTools() });
        const result = await agent.execute(`task ${String(i)}`, ctx);
        expect(result.success).toBe(true);
      }
    });

    it("conforms to Agent interface shape", () => {
      const agent = createCodeWriterAgent({ tools: [] });

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

      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({
        tools: allTools,
        workspaceRoot: "/my-project",
      });

      await agent.execute("implement feature X", ctx);

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
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: allTools, emit });

      await agent.execute("implement feature X", ctx);

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
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("implement feature X", ctx);

      expect(result).toHaveProperty("success");
    });

    it("result has output string", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("implement feature X", ctx);

      expect(typeof result.output).toBe("string");
    });

    it("result has toolCalls number", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("implement feature X", ctx);

      expect(typeof result.toolCalls).toBe("number");
    });

    it("result has tokensUsed number", async () => {
      const agent = createCodeWriterAgent({ tools: [] });
      const { ctx } = makeContext({ tools: makeAllTools() });

      const result: AgentResult = await agent.execute("implement feature X", ctx);

      expect(typeof result.tokensUsed).toBe("number");
    });
  });
});
