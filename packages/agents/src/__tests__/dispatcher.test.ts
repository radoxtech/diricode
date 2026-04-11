import { describe, expect, it, vi } from "vitest";
import { AgentError, AgentRegistry, createDispatcher } from "../index.js";
import type { Agent, AgentContext, AgentResult } from "../index.js";
import type { DiriRouter } from "@diricode/dirirouter";

type MockFn = ReturnType<typeof vi.fn>;

function makeAgent(name: string, keywords: string[] = []): Agent {
  return {
    metadata: {
      name,
      description: `${name} agent ${keywords.join(" ")}`,
      allowedTiers: ["medium"],
      capabilities: {
        primary: "coding",
        specialization: keywords,
        modelAttributes: ["reasoning"],
      },
    },
    execute: (_input: string, _context: AgentContext): Promise<AgentResult> =>
      Promise.resolve({ success: true, output: `${name}:done`, toolCalls: 2, tokensUsed: 100 }),
  };
}

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

function findEmitCall(emit: MockFn, eventName: string): [string, unknown] | undefined {
  return (emit.mock.calls as [string, unknown][]).find(([event]) => event === eventName);
}

describe("createDispatcher", () => {
  it("returns an Agent with correct metadata", () => {
    const registry = new AgentRegistry();
    const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });

    expect(dispatcher.metadata.name).toBe("dispatcher");
    expect(dispatcher.metadata.allowedTiers).toContain("heavy");
    expect(dispatcher.metadata.capabilities.primary).toBe("coding");
    expect(dispatcher.metadata.capabilities.specialization).toContain("orchestration");
    expect(dispatcher.metadata.capabilities.specialization).toContain("routing");
    expect(dispatcher.metadata.capabilities.specialization).toContain("delegation");
    expect(dispatcher.metadata.capabilities.modelAttributes).toContain("reasoning");
    expect(dispatcher.metadata.capabilities.modelAttributes).toContain("agentic");
  });

  describe("execute", () => {
    it("emits agent.started at the start of execution", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write", "implement"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext();

      await dispatcher.execute("write some code", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ agentId: "dispatcher" }),
      );
    });

    it("emits dispatcher.intent-classified event", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext();

      await dispatcher.execute("write some code", ctx);

      expect(emit).toHaveBeenCalledWith(
        "dispatcher.intent-classified",
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          intent: expect.objectContaining({ primary: expect.any(String) }),
        }),
      );
    });

    it("emits dispatcher.candidates-found event", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write", "implement"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext();

      await dispatcher.execute("write some code", ctx);

      expect(emit).toHaveBeenCalledWith(
        "dispatcher.candidates-found",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expect.objectContaining({ candidates: expect.any(Array) }),
      );
    });

    it("emits dispatcher.agent-selected event", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write", "code"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext();

      await dispatcher.execute("write some code", ctx);

      expect(emit).toHaveBeenCalledWith(
        "dispatcher.agent-selected",
        expect.objectContaining({ agent: "coder" }),
      );
    });

    it("emits agent.completed at the end of execution", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext();

      await dispatcher.execute("write some code", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.completed",
        expect.objectContaining({ agentId: "dispatcher", success: true }),
      );
    });

    it("delegates to the best matching agent and returns its result", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write", "implement"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx } = makeContext();

      const result = await dispatcher.execute("write some code", ctx);

      expect(result.success).toBe(true);
      expect(result.output).toBe("coder:done");
    });

    it("sets parentAgentId to 'dispatcher' in child context", async () => {
      const registry = new AgentRegistry();
      let capturedContext: AgentContext | undefined;

      const agent: Agent = {
        metadata: {
          name: "coder",
          description: "write code",
          allowedTiers: ["medium"],
          capabilities: {
            primary: "coding",
            specialization: ["write"],
            modelAttributes: ["reasoning"],
          },
        },
        execute: (_input: string, childCtx: AgentContext): Promise<AgentResult> => {
          capturedContext = childCtx;
          return Promise.resolve({ success: true, output: "done", toolCalls: 0, tokensUsed: 0 });
        },
      };

      registry.register(agent);
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx } = makeContext();

      await dispatcher.execute("write some code", ctx);

      expect(capturedContext?.parentAgentId).toBe("dispatcher");
    });

    it("throws AgentError when no agent matches the intent", async () => {
      const registry = new AgentRegistry();
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx } = makeContext();

      await expect(dispatcher.execute("xyznonexistent", ctx)).rejects.toThrow(AgentError);
    });

    it("AgentError has NO_AGENT_FOUND code when no match", async () => {
      const registry = new AgentRegistry();
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx } = makeContext();

      let caught: AgentError | undefined;
      try {
        await dispatcher.execute("xyznonexistent", ctx);
      } catch (e) {
        if (e instanceof AgentError) caught = e;
      }

      expect(caught).toBeDefined();
      expect(caught?.code).toBe("NO_AGENT_FOUND");
    });

    it("includes parentAgentId from parent context in agent.started event", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext({ parentAgentId: "orchestrator" });

      await dispatcher.execute("write some code", ctx);

      expect(emit).toHaveBeenCalledWith(
        "agent.started",
        expect.objectContaining({ parentAgentId: "orchestrator" }),
      );
    });

    it("truncates long input to 200 chars in agent.started event", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write", "code"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext();
      const longInput = "write " + "x".repeat(300);

      await dispatcher.execute(longInput, ctx);

      const startedCall = findEmitCall(emit, "agent.started");
      expect(startedCall).toBeDefined();
      const payload = startedCall?.[1] as { input: string } | undefined;
      expect(payload?.input.length).toBeLessThanOrEqual(200);
    });
  });

  describe("intent classification", () => {
    const keywordCases: [string, string][] = [
      ["write a function", "coding"],
      ["implement the feature", "coding"],
      ["create a new module", "coding"],
      ["add error handling", "coding"],
      ["build the project", "coding"],
      ["review my PR", "review"],
      ["check for bugs", "review"],
      ["verify the output", "review"],
      ["test the logic", "review"],
      ["plan the architecture", "planning"],
      ["design the system", "planning"],
      ["architect the solution", "planning"],
      ["find the bug", "research"],
      ["search for examples", "research"],
      ["explore the codebase", "research"],
      ["look for patterns", "research"],
      ["commit the changes", "utility"],
      ["deploy to production", "utility"],
      ["format the file", "utility"],
      ["lint the code", "utility"],
    ];

    for (const [input, expectedCategory] of keywordCases) {
      it(`classifies "${input}" as "${expectedCategory}"`, async () => {
        const registry = new AgentRegistry();
        const agent: Agent = {
          metadata: {
            name: "target",
            description: input,
            allowedTiers: ["medium"],
            capabilities: {
              primary: expectedCategory as Agent["metadata"]["capabilities"]["primary"],
              specialization: input.split(" "),
              modelAttributes: ["reasoning"],
            },
          },
          execute: () =>
            Promise.resolve({ success: true, output: "done", toolCalls: 0, tokensUsed: 0 }),
        };
        registry.register(agent);

        const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
        const { ctx, emit } = makeContext();

        await dispatcher.execute(input, ctx);

        const classifiedCall = findEmitCall(emit, "dispatcher.intent-classified");
        expect(classifiedCall).toBeDefined();
        const payload = classifiedCall?.[1] as { intent: { primary: string } } | undefined;
        expect(payload?.intent.primary).toBe(expectedCategory);
      });
    }

    it("defaults to 'coding' domain for unrecognized input", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["xyzrandom", "stuff"]));
      const dispatcher = createDispatcher({ registry, maxDelegationDepth: 5 });
      const { ctx, emit } = makeContext();

      try {
        await dispatcher.execute("xyzrandom stuff", ctx);
      } catch {
        // Expected: dispatcher may throw if no agent matches
      }

      const classifiedCall = findEmitCall(emit, "dispatcher.intent-classified");
      if (classifiedCall) {
        const payload = classifiedCall[1] as { intent: { primary: string } };
        expect(payload.intent.primary).toBe("coding");
      }
    });
  });

  describe("with DiriRouter", () => {
    it("calls diriRouter.chat() with a DecisionRequest when diriRouter is provided", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write", "implement"]));

      const mockChat = vi.fn().mockResolvedValue({
        text: "router response",
        provider: "openai",
        model: "gpt-4o",
      });

      const mockDiriRouter = {
        pick: vi.fn(),
        chat: mockChat,
        stream: vi.fn(),
        getProvider: vi.fn(),
        getModelConfig: vi.fn(),
        resolver: {},
        router: {},
      };

      const dispatcher = createDispatcher({
        registry,
        maxDelegationDepth: 5,
        diriRouter: mockDiriRouter as unknown as DiriRouter,
      });

      const { ctx } = makeContext();
      await dispatcher.execute("write some code", ctx);

      expect(mockChat).toHaveBeenCalledTimes(1);
      expect(mockDiriRouter.pick).not.toHaveBeenCalled();
      const chatCall = mockChat.mock.calls[0]?.[0] as
        | {
            prompt: string;
            chatId: string;
            request: {
              agent: { id: string };
              task: { type: string };
              chatId: string;
              requestId: string;
              modelDimensions: { tier: string };
            };
          }
        | undefined;
      expect(chatCall?.prompt).toBe("write some code");
      expect(chatCall?.request.agent.id).toBe("coder");
      expect(chatCall?.request.task.type).toBe("coding");
      expect(chatCall?.request.chatId).toBe(chatCall?.chatId);
      expect(chatCall?.request.modelDimensions.tier).toBe("medium");
    });

    it("emits dispatcher.model-resolved with selectionSource=diri-router when DiriRouter chat succeeds", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write"]));

      const mockChat = vi.fn().mockResolvedValue({
        text: "router response",
        provider: "openai",
        model: "gpt-4o",
      });

      const mockDiriRouter = {
        pick: vi.fn(),
        chat: mockChat,
        stream: vi.fn(),
        getProvider: vi.fn(),
        getModelConfig: vi.fn(),
        resolver: {},
        router: {},
      };

      const dispatcher = createDispatcher({
        registry,
        maxDelegationDepth: 5,
        diriRouter: mockDiriRouter as unknown as DiriRouter,
      });

      const { ctx, emit } = makeContext();
      await dispatcher.execute("write some code", ctx);

      const modelResolvedCall = findEmitCall(emit, "dispatcher.model-resolved");
      expect(modelResolvedCall).toBeDefined();
      const payload = modelResolvedCall?.[1] as Record<string, unknown>;
      expect(payload.selectionSource).toBe("diri-router");
      expect(payload.model).toBe("gpt-4o");
      expect(payload.provider).toBe("openai");
    });

    it("propagates DiriRouter chat failures", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder", ["write"]));

      const mockChat = vi.fn().mockRejectedValue(new Error("router unavailable"));

      const mockDiriRouter = {
        pick: vi.fn(),
        chat: mockChat,
        stream: vi.fn(),
        getProvider: vi.fn(),
        getModelConfig: vi.fn(),
        resolver: {},
        router: {},
      };

      const dispatcher = createDispatcher({
        registry,
        maxDelegationDepth: 5,
        diriRouter: mockDiriRouter as unknown as DiriRouter,
      });

      const { ctx } = makeContext();
      await expect(dispatcher.execute("write some code", ctx)).rejects.toThrow(
        "router unavailable",
      );
    });
  });
});
