import { describe, it, expect, vi } from "vitest";
import {
  createMockConfig,
  createMockAgent,
  createMockTool,
  createMockSession,
} from "../factories.js";

describe("factories", () => {
  describe("createMockConfig", () => {
    it("returns a valid DiriCodeConfig", () => {
      const config = createMockConfig();
      expect(config.providers.openai).toBeDefined();
      expect(config.agents.testAgent).toBeDefined();
    });

    it("accepts fully-specified custom providers", () => {
      const config = createMockConfig({
        providers: {
          openai: {
            apiKey: "sk-test",
            defaultModel: "gpt-4o-mini",
            maxRetries: 5,
            timeoutMs: 60_000,
          },
        },
      });
      expect(config.providers.openai?.apiKey).toBe("sk-test");
      expect(config.providers.openai?.defaultModel).toBe("gpt-4o-mini");
      expect(config.providers.openai?.maxRetries).toBe(5);
    });

    it("accepts fully-specified custom agents", () => {
      const config = createMockConfig({
        agents: {
          myAgent: {
            provider: "anthropic",
            model: "claude-3-opus",
            tools: [],
            maxTurns: 10,
          },
        },
      });
      expect(config.agents.myAgent?.provider).toBe("anthropic");
      expect(config.agents.myAgent?.model).toBe("claude-3-opus");
    });

    it("sets memory backend", () => {
      const config = createMockConfig({ memoryBackend: "sqlite" });
      expect(config.memory.backend).toBe("sqlite");
    });

    it("sets work mode options", () => {
      const config = createMockConfig({
        workMode: { autonomy: "full-auto", verbosity: "verbose" },
      });
      expect(config.workMode.autonomy).toBe("full-auto");
      expect(config.workMode.verbosity).toBe("verbose");
    });

    it("sets project name", () => {
      const config = createMockConfig({ projectName: "my-project" });
      expect(config.project.name).toBe("my-project");
    });
  });

  describe("createMockAgent", () => {
    it("returns an Agent with default metadata", () => {
      const agent = createMockAgent();
      expect(agent.metadata.name).toBe("test-agent");
      expect(agent.metadata.allowedTiers).toContain("medium");
    });

    it("accepts custom metadata overrides", () => {
      const agent = createMockAgent({
        name: "custom-agent",
        allowedTiers: ["heavy"],
        capabilities: {
          primary: "coding",
          specialization: ["code-generation"],
          modelAttributes: ["reasoning", "agentic"],
        },
      });
      expect(agent.metadata.name).toBe("custom-agent");
      expect(agent.metadata.allowedTiers).toContain("heavy");
      expect(agent.metadata.capabilities.primary).toBe("coding");
      expect(agent.metadata.capabilities.specialization).toContain("code-generation");
    });

    it("execute returns a successful result by default", async () => {
      const agent = createMockAgent();
      const result = await agent.execute("hello", {
        workspaceRoot: "/tmp",
        sessionId: "s1",
        tools: [],
        emit: vi.fn(),
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain("hello");
      expect(result.toolCalls).toBe(0);
      expect(result.tokensUsed).toBe(10);
    });

    it("uses custom executeFn when provided", async () => {
      const agent = createMockAgent({
        executeFn: (input, _ctx) =>
          Promise.resolve({
            success: true,
            output: `processed: ${input}`,
            toolCalls: 2,
            tokensUsed: 50,
          }),
      });
      const result = await agent.execute("test", {
        workspaceRoot: "/tmp",
        sessionId: "s1",
        tools: [],
        emit: vi.fn(),
      });
      expect(result.output).toBe("processed: test");
      expect(result.toolCalls).toBe(2);
    });
  });

  describe("createMockTool", () => {
    it("returns a Tool with default values", () => {
      const tool = createMockTool();
      expect(tool.name).toBe("mock-tool");
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
      expect(tool.annotations.idempotentHint).toBe(true);
    });

    it("accepts custom overrides", () => {
      const tool = createMockTool({
        name: "write-tool",
        description: "Writes files",
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      });
      expect(tool.name).toBe("write-tool");
      expect(tool.annotations.destructiveHint).toBe(true);
    });

    it("execute returns success by default", async () => {
      const tool = createMockTool();
      const result = await tool.execute({}, { workspaceRoot: "/tmp", emit: vi.fn() });
      expect(result.success).toBe(true);
    });

    it("uses custom executeFn when provided", async () => {
      const tool = createMockTool({
        executeFn: (params) => Promise.resolve({ success: true, data: { written: params } }),
      });
      const result = await tool.execute(
        { path: "/tmp/test.txt" },
        { workspaceRoot: "/tmp", emit: vi.fn() },
      );
      expect(result.success).toBe(true);
      const data = result.data as { written: { path: string } };
      expect(data.written.path).toBe("/tmp/test.txt");
    });
  });

  describe("createMockSession", () => {
    it("returns a session with generated id and default status", () => {
      const session = createMockSession();
      expect(session.id).toBeDefined();
      expect(session.status).toBe("created");
      expect(session.messages).toEqual([]);
    });

    it("accepts custom options", () => {
      const session = createMockSession({
        id: "custom-id",
        status: "active",
        metadata: { userId: "u1" },
        messages: [
          {
            id: "m1",
            sessionId: "custom-id",
            role: "user",
            content: "hello",
            metadata: {},
            createdAt: new Date(),
          },
        ],
      });
      expect(session.id).toBe("custom-id");
      expect(session.status).toBe("active");
      expect(session.metadata.userId).toBe("u1");
      expect(session.messages).toHaveLength(1);
    });

    it("has createdAt and updatedAt set to now", () => {
      const before = new Date();
      const session = createMockSession();
      const after = new Date();
      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
