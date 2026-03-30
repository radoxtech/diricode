import { describe, expect, it, vi, beforeEach } from "vitest";
import { BackgroundTaskManager } from "../background-task-manager.js";
import type { AgentRegistry } from "../registry.js";
import type {
  BackgroundTaskRepository,
  BackgroundTaskRecord,
  TaskPayload,
  ContextSnapshot,
  ResultPayload,
} from "@diricode/memory";
import type { Agent, AgentContext, AgentResult, AgentMetadata } from "@diricode/core";

type MockFn = ReturnType<typeof vi.fn>;

function createMockRepository(): BackgroundTaskRepository {
  const records = new Map<string, BackgroundTaskRecord>();
  let idCounter = 0;

  return {
    create: vi.fn((record) => {
      const fullRecord: BackgroundTaskRecord = {
        ...record,
        createdAt: new Date().toISOString(),
        progress: 0,
      };
      records.set(record.jobId, fullRecord);
      return fullRecord;
    }),
    getById: vi.fn((jobId) => records.get(jobId)),
    getByParentExecutionId: vi.fn((parentExecutionId) =>
      Array.from(records.values()).filter((r) => r.parentExecutionId === parentExecutionId),
    ),
    getBySessionId: vi.fn(() => []),
    getActive: vi.fn(() => []),
    updateStatus: vi.fn(),
    markRunning: vi.fn(),
    markCompleted: vi.fn((jobId, result) => {
      const record = records.get(jobId);
      if (record) {
        record.status = "completed";
        record.resultPayload = result;
        record.completedAt = new Date().toISOString();
      }
    }),
    markFailed: vi.fn((jobId, error) => {
      const record = records.get(jobId);
      if (record) {
        record.status = "failed";
        record.errorDetails = error;
        record.completedAt = new Date().toISOString();
      }
    }),
    markCancelled: vi.fn(),
    updateProgress: vi.fn(),
    setEstimatedCompletion: vi.fn(),
    getStatusCounts: vi.fn(() => ({
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    })),
  } as unknown as BackgroundTaskRepository;
}

function createMockAgent(name: string, tier: AgentMetadata["tier"] = "heavy"): Agent {
  return {
    metadata: {
      name,
      description: `${name} agent`,
      tier,
      category: "code",
      capabilities: [],
      tags: [],
      toolPolicy: { allowedTools: ["read", "write"] },
    },
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: `${name}:done`,
      toolCalls: 2,
      tokensUsed: 100,
    } as AgentResult),
  };
}

function createMockRegistry(agents: Agent[] = []): AgentRegistry {
  const agentMap = new Map(agents.map((a) => [a.metadata.name, a]));

  return {
    register: vi.fn(),
    get: vi.fn((name: string) => agentMap.get(name)),
    search: vi.fn(() => []),
    getAll: vi.fn(() => Array.from(agentMap.values())),
  } as unknown as AgentRegistry;
}

function createMockContext(overrides?: Partial<AgentContext>): { ctx: AgentContext; emit: MockFn } {
  const emit = vi.fn();
  return {
    ctx: {
      workspaceRoot: "/workspace",
      sessionId: "session-123",
      tools: [],
      emit,
      ...overrides,
    },
    emit,
  };
}

describe("BackgroundTaskManager", () => {
  let manager: BackgroundTaskManager;
  let repository: BackgroundTaskRepository;
  let registry: AgentRegistry;

  beforeEach(() => {
    repository = createMockRepository();
    registry = createMockRegistry();
    manager = new BackgroundTaskManager({
      registry,
      repository,
    });
  });

  describe("startJob", () => {
    it("creates a background task for HEAVY tier agents", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      const result = await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      expect(result.jobId).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.worktreePath).toContain("bg-task");
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          childAgentName: "code-writer",
          agentTier: "heavy",
          parentExecutionId: "parent-exec-123",
          parentAgentName: "dispatcher",
        }),
      );
    });

    it("emits background_task.created event", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx, emit } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      expect(emit).toHaveBeenCalledWith(
        "background_task.created",
        expect.objectContaining({
          childAgentName: "code-writer",
          status: "pending",
        }),
      );
    });

    it("throws error for non-HEAVY tier agents", async () => {
      const mediumAgent = createMockAgent("quick-fix", "medium");
      registry = createMockRegistry([mediumAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Quick fix" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      await expect(
        manager.startJob(
          { agentName: "quick-fix", task, context: contextSnapshot },
          ctx,
          "parent-exec-123",
          "dispatcher",
        ),
      ).rejects.toThrow("Background tasks only supported for HEAVY tier agents");
    });

    it("throws error when agent not found", async () => {
      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Some task" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      await expect(
        manager.startJob(
          { agentName: "nonexistent", task, context: contextSnapshot },
          ctx,
          "parent-exec-123",
          "dispatcher",
        ),
      ).rejects.toThrow("Agent not found: nonexistent");
    });

    it("stores tool allowlist from agent policy", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          toolAllowlist: expect.arrayContaining(["read", "write"]),
        }),
      );
    });
  });

  describe("checkStatus", () => {
    it("returns current status of a task", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      const startResult = await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      const status = manager.checkStatus(startResult.jobId);

      expect(status.jobId).toBe(startResult.jobId);
      expect(status.status).toBeDefined();
      expect(status.progress).toBe(0);
    });

    it("throws error for non-existent task", () => {
      expect(() => manager.checkStatus("non-existent-id")).toThrow("Background task not found");
    });
  });

  describe("getResult", () => {
    it("returns result for completed task", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      const startResult = await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      await manager.waitForCompletion(startResult.jobId);

      const result = manager.getResult(startResult.jobId);

      expect(result.jobId).toBe(startResult.jobId);
      expect(result.status).toBe("completed");
      expect(result.result).toBeDefined();
    });

    it("throws error for incomplete task", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      (heavyAgent.execute as MockFn).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Slow task" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      const startResult = await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      expect(() => manager.getResult(startResult.jobId)).toThrow(/Task .* is not complete/);
    });
  });

  describe("cancelJob", () => {
    it("cancels a pending task", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      (heavyAgent.execute as MockFn).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx, emit } = createMockContext();
      const task: TaskPayload = { description: "Long task" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      const startResult = await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      await manager.cancelJob(startResult.jobId, ctx);

      expect(repository.markCancelled).toHaveBeenCalledWith(startResult.jobId);
      expect(emit).toHaveBeenCalledWith(
        "background_task.cancelled",
        expect.objectContaining({ jobId: startResult.jobId }),
      );
    });
  });

  describe("parent/child relationship", () => {
    it("tracks parent execution ID", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-456",
        "dispatcher",
      );

      const tasks = manager.getTasksByParent("parent-exec-456");
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0]?.parentExecutionId).toBe("parent-exec-456");
    });

    it("emits status transition events", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx, emit } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      expect(emit).toHaveBeenCalledWith("background_task.created", expect.any(Object));
    });
  });

  describe("tool allowlist enforcement", () => {
    it("preserves tool policy from agent metadata", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      (
        heavyAgent as { metadata: { toolPolicy?: { allowedTools: string[] } } }
      ).metadata.toolPolicy = {
        allowedTools: ["read", "write", "edit"],
      };
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          toolAllowlist: ["read", "write", "edit"],
        }),
      );
    });
  });

  describe("waitForCompletion", () => {
    it("returns result when task completes", async () => {
      const heavyAgent = createMockAgent("code-writer", "heavy");
      registry = createMockRegistry([heavyAgent]);
      manager = new BackgroundTaskManager({ registry, repository });

      const { ctx } = createMockContext();
      const task: TaskPayload = { description: "Write some code" };
      const contextSnapshot: ContextSnapshot = { mode: "isolated" };

      const startResult = await manager.startJob(
        { agentName: "code-writer", task, context: contextSnapshot },
        ctx,
        "parent-exec-123",
        "dispatcher",
      );

      const result = await manager.waitForCompletion(startResult.jobId);

      expect(result.success).toBe(true);
      expect(result.output).toBe("code-writer:done");
    });
  });
});
