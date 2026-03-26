import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DelegationGraph,
  serializeContext,
  createHandoffEnvelope,
  createDelegationResult,
  ProtocolEngine,
} from "../protocol.js";
import type {
  AgentContext,
  AgentResult,
  Agent,
  ParentChildGraphNode,
  ResultPropagationContract,
} from "@diricode/core";
import {
  DEFAULT_INHERITANCE_RULES,
  MAX_DELEGATION_DEPTH,
  wouldCreateCycle,
  generateExecutionId,
  generateHandoffId,
} from "@diricode/core";

describe("protocol exports", () => {
  it("exports DEFAULT_INHERITANCE_RULES with summary mode", () => {
    expect(DEFAULT_INHERITANCE_RULES.mode).toBe("summary");
    expect(DEFAULT_INHERITANCE_RULES.maxTokens).toBe(2000);
    expect(DEFAULT_INHERITANCE_RULES.includeHistory).toBe(true);
    expect(DEFAULT_INHERITANCE_RULES.includeToolResults).toBe(false);
  });

  it("exports MAX_DELEGATION_DEPTH as 10", () => {
    expect(MAX_DELEGATION_DEPTH).toBe(10);
  });
});

describe("DelegationGraph", () => {
  let graph: DelegationGraph;

  beforeEach(() => {
    graph = new DelegationGraph();
  });

  describe("registerNode", () => {
    it("registers a root node with depth 0", () => {
      const node = graph.registerNode({
        executionId: "exec-1",
        agentName: "test-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "code",
      });

      expect(node.executionId).toBe("exec-1");
      expect(node.agentName).toBe("test-agent");
      expect(node.parentExecutionId).toBeNull();
      expect(node.depth).toBe(0);
      expect(node.childExecutionIds).toEqual([]);
      expect(node.status).toBe("running");
    });

    it("registers a child node with incremented depth", () => {
      graph.registerNode({
        executionId: "parent",
        agentName: "parent-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      const child = graph.registerNode({
        executionId: "child",
        agentName: "child-agent",
        parentExecutionId: "parent",
        tier: "medium",
        category: "code",
      });

      expect(child.depth).toBe(1);
      expect(child.parentExecutionId).toBe("parent");
    });

    it("links child to parent", () => {
      graph.registerNode({
        executionId: "parent",
        agentName: "parent-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      graph.registerNode({
        executionId: "child",
        agentName: "child-agent",
        parentExecutionId: "parent",
        tier: "medium",
        category: "code",
      });

      const parent = graph.getNode("parent");
      expect(parent?.childExecutionIds).toContain("child");
    });

    it("handles multi-level nesting", () => {
      graph.registerNode({
        executionId: "root",
        agentName: "root-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      graph.registerNode({
        executionId: "level1",
        agentName: "level1-agent",
        parentExecutionId: "root",
        tier: "medium",
        category: "code",
      });

      const level2 = graph.registerNode({
        executionId: "level2",
        agentName: "level2-agent",
        parentExecutionId: "level1",
        tier: "light",
        category: "utility",
      });

      expect(level2.depth).toBe(2);
    });
  });

  describe("completeNode", () => {
    it("marks node as completed with success", () => {
      graph.registerNode({
        executionId: "exec-1",
        agentName: "test-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "code",
      });

      const completed = graph.completeNode("exec-1", true);

      expect(completed?.status).toBe("completed");
      expect(completed?.completedAt).toBeInstanceOf(Date);
    });

    it("marks node as failed", () => {
      graph.registerNode({
        executionId: "exec-1",
        agentName: "test-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "code",
      });

      const completed = graph.completeNode("exec-1", false);

      expect(completed?.status).toBe("failed");
    });

    it("returns null for non-existent node", () => {
      const result = graph.completeNode("non-existent", true);
      expect(result).toBeNull();
    });
  });

  describe("getNode", () => {
    it("returns node by execution ID", () => {
      graph.registerNode({
        executionId: "exec-1",
        agentName: "test-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "code",
      });

      const node = graph.getNode("exec-1");

      expect(node?.agentName).toBe("test-agent");
    });

    it("returns null for non-existent node", () => {
      const node = graph.getNode("non-existent");
      expect(node).toBeNull();
    });
  });

  describe("getChildren", () => {
    it("returns all children of a parent", () => {
      graph.registerNode({
        executionId: "parent",
        agentName: "parent-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      graph.registerNode({
        executionId: "child1",
        agentName: "child1-agent",
        parentExecutionId: "parent",
        tier: "medium",
        category: "code",
      });

      graph.registerNode({
        executionId: "child2",
        agentName: "child2-agent",
        parentExecutionId: "parent",
        tier: "medium",
        category: "research",
      });

      const children = graph.getChildren("parent");

      expect(children).toHaveLength(2);
      expect(children.map((c) => c.executionId)).toContain("child1");
      expect(children.map((c) => c.executionId)).toContain("child2");
    });

    it("returns empty array for node with no children", () => {
      graph.registerNode({
        executionId: "leaf",
        agentName: "leaf-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "code",
      });

      const children = graph.getChildren("leaf");

      expect(children).toEqual([]);
    });

    it("returns empty array for non-existent parent", () => {
      const children = graph.getChildren("non-existent");
      expect(children).toEqual([]);
    });
  });

  describe("wouldCreateCycle", () => {
    it("detects direct cycle", () => {
      graph.registerNode({
        executionId: "a",
        agentName: "agent-a",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      graph.registerNode({
        executionId: "b",
        agentName: "agent-b",
        parentExecutionId: "a",
        tier: "medium",
        category: "code",
      });

      expect(graph.wouldCreateCycle("b", "a")).toBe(true);
    });

    it("detects indirect cycle", () => {
      graph.registerNode({
        executionId: "a",
        agentName: "agent-a",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      graph.registerNode({
        executionId: "b",
        agentName: "agent-b",
        parentExecutionId: "a",
        tier: "medium",
        category: "code",
      });

      graph.registerNode({
        executionId: "c",
        agentName: "agent-c",
        parentExecutionId: "b",
        tier: "light",
        category: "utility",
      });

      expect(graph.wouldCreateCycle("c", "a")).toBe(true);
    });

    it("returns false for valid delegation", () => {
      graph.registerNode({
        executionId: "a",
        agentName: "agent-a",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      graph.registerNode({
        executionId: "b",
        agentName: "agent-b",
        parentExecutionId: "a",
        tier: "medium",
        category: "code",
      });

      expect(graph.wouldCreateCycle("a", "new-child")).toBe(false);
    });
  });

  describe("exceedsMaxDepth", () => {
    it("returns false at depth 0", () => {
      graph.registerNode({
        executionId: "root",
        agentName: "root-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      expect(graph.exceedsMaxDepth("root")).toBe(false);
    });

    it("returns false just under max depth", () => {
      let lastId: string | null = null;

      for (let i = 0; i < MAX_DELEGATION_DEPTH - 1; i++) {
        const id = `level-${String(i)}`;
        graph.registerNode({
          executionId: id,
          agentName: `agent-${String(i)}`,
          parentExecutionId: lastId,
          tier: "medium",
          category: "code",
        });
        lastId = id;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const finalParentId = lastId!;
      expect(graph.exceedsMaxDepth(finalParentId)).toBe(false);
    });

    it("returns true at max depth", () => {
      let lastId: string | null = null;

      for (let i = 0; i <= MAX_DELEGATION_DEPTH; i++) {
        const id = `level-${String(i)}`;
        graph.registerNode({
          executionId: id,
          agentName: `agent-${String(i)}`,
          parentExecutionId: lastId,
          tier: "medium",
          category: "code",
        });
        lastId = id;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const finalParentId = lastId!;
      expect(graph.exceedsMaxDepth(finalParentId)).toBe(true);
    });
  });

  describe("getRoots", () => {
    it("returns all root nodes", () => {
      graph.registerNode({
        executionId: "root1",
        agentName: "root1-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "strategy",
      });

      graph.registerNode({
        executionId: "root2",
        agentName: "root2-agent",
        parentExecutionId: null,
        tier: "heavy",
        category: "code",
      });

      graph.registerNode({
        executionId: "child",
        agentName: "child-agent",
        parentExecutionId: "root1",
        tier: "medium",
        category: "code",
      });

      const roots = graph.getRoots();

      expect(roots).toHaveLength(2);
      expect(roots.map((r) => r.executionId)).toContain("root1");
      expect(roots.map((r) => r.executionId)).toContain("root2");
    });

    it("returns empty array for empty graph", () => {
      expect(graph.getRoots()).toEqual([]);
    });
  });
});

describe("serializeContext", () => {
  const mockContext: AgentContext = {
    workspaceRoot: "/workspace",
    sessionId: "session-123",
    tools: [],
    emit: vi.fn(),
  };

  it("isolated mode returns only relevant files", () => {
    const result = serializeContext(
      mockContext,
      { mode: "isolated", includeFiles: ["/file1.ts", "/file2.ts"] },
      [],
    );

    expect(result.summary).toBeDefined();
    expect(result.messages).toBeUndefined();
    expect(result.artifactReferences).toHaveLength(2);
    expect(result.artifactReferences?.map((r) => r.uri)).toEqual(["/file1.ts", "/file2.ts"]);
  });

  it("isolated mode returns empty references when none specified", () => {
    const result = serializeContext(mockContext, { mode: "isolated" }, []);

    expect(result.artifactReferences).toBeUndefined();
  });

  it("summary mode includes summary and files", () => {
    const result = serializeContext(mockContext, { mode: "summary" }, []);

    expect(result.summary).toBeDefined();
    expect(result.summary).toContain("session-123");
    expect(result.summary).toContain("/workspace");
  });

  it("summary mode includes key decisions", () => {
    const result = serializeContext(mockContext, { mode: "summary" }, []);

    expect(result.keyDecisions).toBeDefined();
    expect(Array.isArray(result.keyDecisions)).toBe(true);
  });

  it("full mode includes conversation history when includeHistory is true", () => {
    const conversation = [{ role: "user", content: "hello" }];

    const result = serializeContext(
      mockContext,
      { mode: "full", includeHistory: true },
      conversation,
    );

    expect(result.messages).toEqual(conversation);
  });

  it("full mode excludes history when includeHistory is false", () => {
    const conversation = [{ role: "user", content: "hello" }];

    const result = serializeContext(
      mockContext,
      { mode: "full", includeHistory: false },
      conversation,
    );

    expect(result.messages).toEqual([]);
  });

  it("estimates token count for isolated mode", () => {
    const result = serializeContext(
      mockContext,
      { mode: "isolated", includeFiles: ["/file.ts"] },
      [],
    );

    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it("estimates token count for summary mode", () => {
    const result = serializeContext(mockContext, { mode: "summary" }, []);

    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it("estimates token count for full mode", () => {
    const conversation = [{ role: "user", content: "hello world" }];

    const result = serializeContext(
      mockContext,
      { mode: "full", includeHistory: true },
      conversation,
    );

    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it("throws for invalid mode", () => {
    expect(() => {
      serializeContext(mockContext, { mode: "invalid" as "isolated" }, []);
    }).toThrow("Invalid inheritance mode");
  });
});

describe("createHandoffEnvelope", () => {
  const mockContext: AgentContext = {
    workspaceRoot: "/workspace",
    sessionId: "session-123",
    tools: [],
    emit: vi.fn(),
  };

  it("creates envelope with all required fields", () => {
    const envelope = createHandoffEnvelope({
      parentExecutionId: "parent-1",
      parentAgentName: "parent-agent",
      sessionId: "session-123",
      workspaceRoot: "/workspace",
      taskInput: "do something",
      parentContext: mockContext,
    });

    expect(envelope.handoffId).toMatch(/^handoff_/);
    expect(envelope.childExecutionId).toMatch(/^exec_/);
    expect(envelope.parent.executionId).toBe("parent-1");
    expect(envelope.parent.agentName).toBe("parent-agent");
    expect(envelope.parent.sessionId).toBe("session-123");
    expect(envelope.goal.taskDescription).toBe("do something");
    expect(envelope.goal.successCriteria).toEqual([]);
    expect(envelope.workspaceRoot).toBe("/workspace");
    expect(envelope.timestamp).toBeInstanceOf(Date);
  });

  it("uses default inheritance rules when not specified", () => {
    const envelope = createHandoffEnvelope({
      parentExecutionId: "parent-1",
      parentAgentName: "parent-agent",
      sessionId: "session-123",
      workspaceRoot: "/workspace",
      taskInput: "do something",
      parentContext: mockContext,
    });

    expect(envelope.inheritanceRules.mode).toBe("summary");
    expect(envelope.inheritanceRules.maxTokens).toBe(2000);
  });

  it("uses custom inheritance rules when specified", () => {
    const envelope = createHandoffEnvelope({
      parentExecutionId: "parent-1",
      parentAgentName: "parent-agent",
      sessionId: "session-123",
      workspaceRoot: "/workspace",
      taskInput: "do something",
      inheritanceRules: { mode: "isolated", maxTokens: 500 },
      parentContext: mockContext,
    });

    expect(envelope.inheritanceRules.mode).toBe("isolated");
    expect(envelope.inheritanceRules.maxTokens).toBe(500);
  });

  it("includes serialized context based on rules", () => {
    const envelope = createHandoffEnvelope({
      parentExecutionId: "parent-1",
      parentAgentName: "parent-agent",
      sessionId: "session-123",
      workspaceRoot: "/workspace",
      taskInput: "do something",
      inheritanceRules: { mode: "summary" },
      parentContext: mockContext,
    });

    expect(envelope.context).toBeDefined();
    expect(envelope.context.summary).toBeDefined();
    expect(envelope.context.tokenCount).toBeGreaterThanOrEqual(0);
  });

  it("generates unique IDs for each call", () => {
    const envelope1 = createHandoffEnvelope({
      parentExecutionId: "parent-1",
      parentAgentName: "parent-agent",
      sessionId: "session-123",
      workspaceRoot: "/workspace",
      taskInput: "task 1",
      parentContext: mockContext,
    });

    const envelope2 = createHandoffEnvelope({
      parentExecutionId: "parent-1",
      parentAgentName: "parent-agent",
      sessionId: "session-123",
      workspaceRoot: "/workspace",
      taskInput: "task 2",
      parentContext: mockContext,
    });

    expect(envelope1.handoffId).not.toBe(envelope2.handoffId);
    expect(envelope1.childExecutionId).not.toBe(envelope2.childExecutionId);
  });
});

describe("createDelegationResult", () => {
  const mockEnvelope = createHandoffEnvelope({
    parentExecutionId: "parent-1",
    parentAgentName: "parent-agent",
    sessionId: "session-123",
    workspaceRoot: "/workspace",
    taskInput: "do something",
    parentContext: {
      workspaceRoot: "/workspace",
      sessionId: "session-123",
      tools: [],
      emit: vi.fn(),
    },
  });

  const mockResult: AgentResult = {
    success: true,
    output: "completed successfully",
    toolCalls: 5,
    tokensUsed: 1000,
  };

  it("creates delegation result with base fields", () => {
    const result = createDelegationResult(
      mockResult,
      mockEnvelope,
      DEFAULT_INHERITANCE_RULES as unknown as ResultPropagationContract,
    );

    expect(result.executionId).toBe(mockEnvelope.childExecutionId);
    expect(result.parentExecutionId).toBe("parent-1");
    expect(result.success).toBe(true);
    expect(result.output).toBe("completed successfully");
    expect(result.toolCalls).toBe(5);
    expect(result.tokensUsed).toBe(1000);
  });

  it("includes conversation history when contract specifies", () => {
    const result = createDelegationResult(mockResult, mockEnvelope, {
      integrationMode: "full",
      includeFullHistory: true,
      applyCondenser: false,
    });

    expect(result.conversationHistory).toBeDefined();
    expect(Array.isArray(result.conversationHistory)).toBe(true);
  });

  it("excludes conversation history when contract specifies", () => {
    const result = createDelegationResult(mockResult, mockEnvelope, {
      integrationMode: "summary",
      includeFullHistory: false,
      applyCondenser: false,
    });

    expect(result.conversationHistory).toBeUndefined();
  });

  it("includes summary when applyCondenser is true", () => {
    const result = createDelegationResult(mockResult, mockEnvelope, {
      integrationMode: "summary",
      includeFullHistory: false,
      applyCondenser: true,
    });

    expect(result.summary).toBeDefined();
  });

  it("calculates token count", () => {
    const result = createDelegationResult(mockResult, mockEnvelope, {
      integrationMode: "summary",
      includeFullHistory: false,
      applyCondenser: false,
    });

    expect(result.tokenCount).toBeGreaterThanOrEqual(0);
  });

  it("includes timing information", () => {
    const result = createDelegationResult(mockResult, mockEnvelope, {
      integrationMode: "summary",
      includeFullHistory: false,
      applyCondenser: false,
    });

    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeInstanceOf(Date);
    expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
  });
});

describe("ProtocolEngine", () => {
  let engine: ProtocolEngine;
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockContext: AgentContext;

  beforeEach(() => {
    engine = new ProtocolEngine();
    mockEmit = vi.fn();
    mockContext = {
      workspaceRoot: "/workspace",
      sessionId: "session-123",
      tools: [],
      emit: mockEmit,
    };
  });

  describe("executeDelegation", () => {
    it("executes child agent and returns delegation result", async () => {
      const mockAgent: Agent = {
        metadata: {
          name: "test-agent",
          description: "Test agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "done",
          toolCalls: 3,
          tokensUsed: 500,
        }),
      };

      const envelope = createHandoffEnvelope({
        parentExecutionId: "parent-1",
        parentAgentName: "parent-agent",
        sessionId: "session-123",
        workspaceRoot: "/workspace",
        taskInput: "test task",
        parentContext: mockContext,
      });

      const result = await engine.executeDelegation(
        {
          envelope,
          resultContract: {
            integrationMode: "summary",
            includeFullHistory: false,
            applyCondenser: false,
          },
        },
        mockAgent,
        mockContext,
        mockEmit,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe("done");
      expect(result.executionId).toBe(envelope.childExecutionId);
    });

    it("registers child in graph before execution", async () => {
      const mockAgent: Agent = {
        metadata: {
          name: "child-agent",
          description: "Child agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "done",
          toolCalls: 0,
          tokensUsed: 0,
        }),
      };

      const envelope = createHandoffEnvelope({
        parentExecutionId: "parent-1",
        parentAgentName: "parent-agent",
        sessionId: "session-123",
        workspaceRoot: "/workspace",
        taskInput: "test",
        parentContext: mockContext,
      });

      await engine.executeDelegation(
        {
          envelope,
          resultContract: {
            integrationMode: "summary",
            includeFullHistory: false,
            applyCondenser: false,
          },
        },
        mockAgent,
        mockContext,
        mockEmit,
      );

      const node = engine.graph.getNode(envelope.childExecutionId);
      expect(node).toBeDefined();
      expect(node?.agentName).toBe("child-agent");
      expect(node?.parentExecutionId).toBe("parent-1");
    });

    it("emits delegation.child.started event", async () => {
      const mockAgent: Agent = {
        metadata: {
          name: "test-agent",
          description: "Test agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "done",
          toolCalls: 0,
          tokensUsed: 0,
        }),
      };

      const envelope = createHandoffEnvelope({
        parentExecutionId: "parent-1",
        parentAgentName: "parent-agent",
        sessionId: "session-123",
        workspaceRoot: "/workspace",
        taskInput: "test",
        parentContext: mockContext,
      });

      await engine.executeDelegation(
        {
          envelope,
          resultContract: {
            integrationMode: "summary",
            includeFullHistory: false,
            applyCondenser: false,
          },
        },
        mockAgent,
        mockContext,
        mockEmit,
      );

      expect(mockEmit).toHaveBeenCalledWith(
        "delegation.child.started",
        expect.objectContaining({
          handoffId: envelope.handoffId,
          childExecutionId: envelope.childExecutionId,
          childAgent: "test-agent",
        }),
      );
    });

    it("emits delegation.child.completed on success", async () => {
      const mockAgent: Agent = {
        metadata: {
          name: "test-agent",
          description: "Test agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "done",
          toolCalls: 5,
          tokensUsed: 100,
        }),
      };

      const envelope = createHandoffEnvelope({
        parentExecutionId: "parent-1",
        parentAgentName: "parent-agent",
        sessionId: "session-123",
        workspaceRoot: "/workspace",
        taskInput: "test",
        parentContext: mockContext,
      });

      await engine.executeDelegation(
        {
          envelope,
          resultContract: {
            integrationMode: "summary",
            includeFullHistory: false,
            applyCondenser: false,
          },
        },
        mockAgent,
        mockContext,
        mockEmit,
      );

      expect(mockEmit).toHaveBeenCalledWith(
        "delegation.child.completed",
        expect.objectContaining({
          handoffId: envelope.handoffId,
          childExecutionId: envelope.childExecutionId,
          success: true,
          toolCalls: 5,
          tokensUsed: 100,
        }),
      );
    });

    it("emits delegation.child.failed on error", async () => {
      const mockAgent: Agent = {
        metadata: {
          name: "test-agent",
          description: "Test agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: vi.fn().mockRejectedValue(new Error("Execution failed")),
      };

      const envelope = createHandoffEnvelope({
        parentExecutionId: "parent-1",
        parentAgentName: "parent-agent",
        sessionId: "session-123",
        workspaceRoot: "/workspace",
        taskInput: "test",
        parentContext: mockContext,
      });

      await expect(
        engine.executeDelegation(
          {
            envelope,
            resultContract: {
              integrationMode: "summary",
              includeFullHistory: false,
              applyCondenser: false,
            },
          },
          mockAgent,
          mockContext,
          mockEmit,
        ),
      ).rejects.toThrow("Execution failed");

      expect(mockEmit).toHaveBeenCalledWith(
        "delegation.child.failed",
        expect.objectContaining({
          handoffId: envelope.handoffId,
          childExecutionId: envelope.childExecutionId,
          error: "Execution failed",
        }),
      );
    });

    it("marks node as failed in graph on error", async () => {
      const mockAgent: Agent = {
        metadata: {
          name: "test-agent",
          description: "Test agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: vi.fn().mockRejectedValue(new Error("Execution failed")),
      };

      const envelope = createHandoffEnvelope({
        parentExecutionId: "parent-1",
        parentAgentName: "parent-agent",
        sessionId: "session-123",
        workspaceRoot: "/workspace",
        taskInput: "test",
        parentContext: mockContext,
      });

      try {
        await engine.executeDelegation(
          {
            envelope,
            resultContract: {
              integrationMode: "summary",
              includeFullHistory: false,
              applyCondenser: false,
            },
          },
          mockAgent,
          mockContext,
          mockEmit,
        );
      } catch {
        // Expected
      }

      const node = engine.graph.getNode(envelope.childExecutionId);
      expect(node?.status).toBe("failed");
    });
  });
});

describe("wouldCreateCycle utility", () => {
  const makeNode = (partial: Partial<ParentChildGraphNode>): ParentChildGraphNode => ({
    executionId: partial.executionId ?? "test",
    agentName: partial.agentName ?? "test-agent",
    parentExecutionId: partial.parentExecutionId ?? null,
    childExecutionIds: partial.childExecutionIds ?? [],
    tier: partial.tier ?? "medium",
    category: partial.category ?? "code",
    depth: partial.depth ?? 0,
    startedAt: partial.startedAt ?? new Date(),
    completedAt: partial.completedAt ?? null,
    status: partial.status ?? "running",
  });

  it("detects direct parent-child cycle", () => {
    const graph = new Map([
      [
        "parent",
        makeNode({ executionId: "parent", parentExecutionId: null, childExecutionIds: ["child"] }),
      ],
      [
        "child",
        makeNode({ executionId: "child", parentExecutionId: "parent", childExecutionIds: [] }),
      ],
    ]);

    expect(wouldCreateCycle("child", "parent", graph)).toBe(true);
  });

  it("detects grandparent cycle", () => {
    const graph = new Map([
      [
        "grandparent",
        makeNode({
          executionId: "grandparent",
          parentExecutionId: null,
          childExecutionIds: ["parent"],
        }),
      ],
      [
        "parent",
        makeNode({
          executionId: "parent",
          parentExecutionId: "grandparent",
          childExecutionIds: ["child"],
        }),
      ],
      [
        "child",
        makeNode({ executionId: "child", parentExecutionId: "parent", childExecutionIds: [] }),
      ],
    ]);

    expect(wouldCreateCycle("child", "grandparent", graph)).toBe(true);
  });

  it("returns false for valid delegation to new node", () => {
    const graph = new Map<string, ParentChildGraphNode>([
      [
        "parent",
        makeNode({ executionId: "parent", parentExecutionId: null, childExecutionIds: [] }),
      ],
    ]);

    expect(wouldCreateCycle("parent", "new-child", graph)).toBe(false);
  });

  it("returns false for self-reference check on new node", () => {
    const graph = new Map<string, ParentChildGraphNode>();

    expect(wouldCreateCycle("parent", "child", graph)).toBe(false);
  });
});

describe("ID generators", () => {
  it("generateExecutionId creates unique IDs", () => {
    const id1 = generateExecutionId();
    const id2 = generateExecutionId();

    expect(id1).toMatch(/^exec_/);
    expect(id2).toMatch(/^exec_/);
    expect(id1).not.toBe(id2);
  });

  it("generateHandoffId creates unique IDs", () => {
    const id1 = generateHandoffId();
    const id2 = generateHandoffId();

    expect(id1).toMatch(/^handoff_/);
    expect(id2).toMatch(/^handoff_/);
    expect(id1).not.toBe(id2);
  });
});
