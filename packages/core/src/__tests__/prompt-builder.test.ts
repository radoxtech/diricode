import { describe, expect, it } from "vitest";
import { PromptBuilder, DEFAULT_BUDGET } from "../agents/prompt-builder.js";
import type { AgentMetadata, Tool } from "../index.js";

function makeMetadata(overrides?: Partial<AgentMetadata>): AgentMetadata {
  return {
    name: "test-agent",
    description: "A test agent for unit testing",
    allowedTiers: ["medium"],
    capabilities: {
      primary: "coding",
      specialization: ["test", "unit"],
      modelAttributes: ["reasoning", "agentic"],
    },
    ...overrides,
  };
}

function makeTool(name: string, description = `${name} tool`): Tool {
  return {
    name,
    description,
    parameters: { parse: (v: unknown) => v } as Tool["parameters"],
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    execute: async () => {
      await Promise.resolve();
      return { success: true, data: {} };
    },
  };
}

describe("PromptBuilder", () => {
  describe("constructor", () => {
    it("accepts AgentMetadata config", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      expect(pb).toBeDefined();
    });

    it("uses DEFAULT_BUDGET when no budget provided", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const result = pb.build("hello", []);
      expect(result.tokenBudget).toEqual(DEFAULT_BUDGET);
    });

    it("accepts custom budget", () => {
      const customBudget = { ...DEFAULT_BUDGET, system: { maxTokens: 500 } };
      const pb = new PromptBuilder({ metadata: makeMetadata(), budget: customBudget });
      const result = pb.build("hello", []);
      expect(result.tokenBudget.system.maxTokens).toBe(500);
    });

    it("accepts workspaceRoot option", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata(), workspaceRoot: "/project" });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("/project");
    });

    it("accepts custom systemTemplate", () => {
      const pb = new PromptBuilder({
        metadata: makeMetadata(),
        systemTemplate: "Agent: {{agentName}} | Workspace: {{workspaceRoot}}",
      });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("Agent: test-agent");
      expect(result.systemPrompt).toContain("Workspace:");
    });
  });

  describe("build", () => {
    it("returns BuiltPrompt with systemPrompt and userMessage", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const result = pb.build("write a function", []);
      expect(result).toHaveProperty("systemPrompt");
      expect(result).toHaveProperty("userMessage");
      expect(result).toHaveProperty("tokenEstimate");
      expect(result).toHaveProperty("modelHints");
      expect(result).toHaveProperty("tokenBudget");
    });

    it("systemPrompt contains agent name from metadata", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("test-agent");
    });

    it("systemPrompt contains agent description from metadata", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("A test agent for unit testing");
    });

    it("userMessage is the input string", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const result = pb.build("implement feature X", []);
      expect(result.userMessage).toBe("implement feature X");
    });

    it("toolsSection contains tool names when tools are bound", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.bindTools([makeTool("file-read"), makeTool("file-write")], ["file-read", "file-write"]);
      const result = pb.build("hello", []);
      expect(result.toolsSection).toContain("file-read");
      expect(result.toolsSection).toContain("file-write");
    });

    it("toolsSection is present even when empty", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.bindTools([], []);
      const result = pb.build("hello", []);
      expect(result.toolsSection).toBeDefined();
    });

    it("modelHints defaults to empty object when not set", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const result = pb.build("hello", []);
      expect(result.modelHints).toEqual({});
    });

    it("tokenEstimate is a positive number", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const result = pb.build("hello world", []);
      expect(result.tokenEstimate).toBeGreaterThan(0);
    });
  });

  describe("injectRepoMap", () => {
    it("appends repo map to systemPrompt", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.injectRepoMap({ rootPath: "/project", files: [{ path: "src/index.ts", type: "file" }] });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("src/index.ts");
    });

    it("returns this for chaining", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const ret = pb.injectRepoMap({ rootPath: "/p", files: [] });
      expect(ret).toBe(pb);
    });
  });

  describe("injectFiles", () => {
    it("appends files to systemPrompt", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.injectFiles([{ path: "src/main.ts", content: "const x = 1;" }]);
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("src/main.ts");
      expect(result.systemPrompt).toContain("const x = 1;");
    });

    it("accumulates files across multiple calls", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.injectFiles([{ path: "a.ts", content: "a" }]);
      pb.injectFiles([{ path: "b.ts", content: "b" }]);
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("a.ts");
      expect(result.systemPrompt).toContain("b.ts");
    });

    it("returns this for chaining", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const ret = pb.injectFiles([]);
      expect(ret).toBe(pb);
    });
  });

  describe("injectHistory", () => {
    it("appends history to systemPrompt", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.injectHistory([{ role: "user", content: "hello", timestamp: 0 }]);
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("user: hello");
    });

    it("formats history with role prefix", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.injectHistory([
        { role: "user", content: "task 1", timestamp: 0 },
        { role: "assistant", content: "done", timestamp: 1 },
      ]);
      const result = pb.build("task 2", []);
      expect(result.systemPrompt).toContain("user: task 1");
      expect(result.systemPrompt).toContain("assistant: done");
    });

    it("returns this for chaining", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const ret = pb.injectHistory([]);
      expect(ret).toBe(pb);
    });
  });

  describe("injectPlan", () => {
    it("appends plan to systemPrompt", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.injectPlan({
        tasks: [{ id: "t1", description: "write tests", status: "pending" }],
        currentTaskId: "t1",
      });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("write tests");
    });

    it("returns this for chaining", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const ret = pb.injectPlan({ tasks: [] });
      expect(ret).toBe(pb);
    });
  });

  describe("bindTools", () => {
    it("filters tools to those matching capabilities", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const tools = [makeTool("file-read"), makeTool("file-write"), makeTool("bash")];
      pb.bindTools(tools, ["file-read", "file-write"]);
      const result = pb.build("hello", []);
      expect(result.toolsSection).toContain("file-read");
      expect(result.toolsSection).toContain("file-write");
    });

    it("returns this for chaining", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const ret = pb.bindTools([], []);
      expect(ret).toBe(pb);
    });
  });

  describe("withModelHints", () => {
    it("sets tier hint", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.withModelHints({ tier: "heavy" });
      const result = pb.build("hello", []);
      expect(result.modelHints.tier).toBe("heavy");
    });

    it("sets capabilities hint", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.withModelHints({
        capabilities: {
          primary: "coding",
          specialization: ["backend"],
          modelAttributes: ["reasoning", "agentic"],
        },
      });
      const result = pb.build("hello", []);
      expect(result.modelHints.capabilities?.modelAttributes).toEqual(["reasoning", "agentic"]);
    });

    it("sets contextSize hint", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      pb.withModelHints({ contextSize: "extended" });
      const result = pb.build("hello", []);
      expect(result.modelHints.contextSize).toBe("extended");
    });

    it("returns this for chaining", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const ret = pb.withModelHints({});
      expect(ret).toBe(pb);
    });
  });

  describe("withCustomVars", () => {
    it("merges custom vars into template substitution", () => {
      const pb = new PromptBuilder({
        metadata: makeMetadata(),
        systemTemplate: "Custom: {{customKey}}",
      });
      pb.withCustomVars({ customKey: "customValue" });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("customValue");
    });

    it("overwrites previous custom vars", () => {
      const pb = new PromptBuilder({
        metadata: makeMetadata(),
        systemTemplate: "Version: {{version}}",
      });
      pb.withCustomVars({ version: "v1" });
      pb.withCustomVars({ version: "v2" });
      const result = pb.build("hello", []);
      expect(result.systemPrompt).toContain("v2");
      expect(result.systemPrompt).not.toContain("v1");
    });

    it("returns this for chaining", () => {
      const pb = new PromptBuilder({ metadata: makeMetadata() });
      const ret = pb.withCustomVars({});
      expect(ret).toBe(pb);
    });
  });

  describe("chaining", () => {
    it("supports fluent builder pattern", () => {
      const result = new PromptBuilder({ metadata: makeMetadata() })
        .injectRepoMap({ rootPath: "/p", files: [{ path: "a.ts", type: "file" }] })
        .injectFiles([{ path: "b.ts", content: "code" }])
        .injectHistory([{ role: "user", content: "prev", timestamp: 0 }])
        .injectPlan({ tasks: [{ id: "1", description: "task", status: "pending" }] })
        .bindTools([makeTool("read"), makeTool("write")], ["read"])
        .withModelHints({ tier: "heavy" })
        .withCustomVars({ version: "1.0" })
        .build("current input", []);

      expect(result.systemPrompt).toContain("a.ts");
      expect(result.systemPrompt).toContain("b.ts");
      expect(result.systemPrompt).toContain("prev");
      expect(result.systemPrompt).toContain("task");
      expect(result.toolsSection).toContain("read");
      expect(result.modelHints.tier).toBe("heavy");
    });
  });
});
