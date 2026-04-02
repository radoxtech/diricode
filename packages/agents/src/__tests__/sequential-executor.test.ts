import { describe, expect, it, vi } from "vitest";
import { AgentRegistry, createSequentialTaskExecutor } from "../index.js";
import type {
  Agent,
  AgentContext,
  AgentResult,
  CheckpointPersistence,
  PlannedTask,
} from "../index.js";

type MockFn = ReturnType<typeof vi.fn>;

function makeAgent(name: string, success = true): Agent {
  return {
    metadata: {
      name,
      description: `${name} agent`,
      tier: "medium",
      category: "code",
      capabilities: [],
      tags: [],
    },
    execute: (_input: string, _context: AgentContext): Promise<AgentResult> =>
      Promise.resolve({
        success,
        output: success ? `${name}:done` : `${name}:failed`,
        toolCalls: 2,
        tokensUsed: 100,
      }),
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

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
function createMockCheckpointRepository(): CheckpointPersistence {
  const mockUpsert = vi.fn((checkpoint: any) => ({
    ...checkpoint,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
  const mockToSummary = vi.fn((checkpoint: any, totalTasks: any) => ({
    executionId: checkpoint.executionId,
    turnId: checkpoint.turnId,
    sessionId: checkpoint.sessionId,
    planId: checkpoint.planId,
    lastValidTaskIndex: checkpoint.lastValidCheckpointIndex,
    totalTasks,
    completedCount: checkpoint.completedTasks.filter((t: any) => t.success).length,
    failedCount: checkpoint.completedTasks.filter((t: any) => !t.success).length,
    status: checkpoint.status,
    createdAt: checkpoint.createdAt,
  }));
  return {
    upsert: mockUpsert as CheckpointPersistence["upsert"],
    toCheckpointSummaryFromCheckpoint:
      mockToSummary as CheckpointPersistence["toCheckpointSummaryFromCheckpoint"],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

describe("createSequentialTaskExecutor", () => {
  describe("executePlan", () => {
    it("emits sequential.execution.started at the start", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder"));
      const checkpointRepo = createMockCheckpointRepository();
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx, emit } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "write code", blockedBy: [] },
      ];

      await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      expect(emit).toHaveBeenCalledWith(
        "sequential.execution.started",
        expect.objectContaining({
          executionId: expect.any(String) as unknown as string,
          turnId: "turn-1",
          planId: "plan-1",
          totalTasks: 1,
          abortOnFailure: true,
        }),
      );
    });

    it("executes tasks sequentially (one at a time)", async () => {
      const registry = new AgentRegistry();
      const callOrder: string[] = [];
      const agent1: Agent = {
        metadata: {
          name: "agent-1",
          description: "first agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: async (_input: string, _ctx: AgentContext) => {
          callOrder.push("agent-1-start");
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push("agent-1-end");
          return { success: true, output: "done", toolCalls: 0, tokensUsed: 0 };
        },
      };
      const agent2: Agent = {
        metadata: {
          name: "agent-2",
          description: "second agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: async (_input: string, _ctx: AgentContext) => {
          callOrder.push("agent-2-start");
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push("agent-2-end");
          return { success: true, output: "done", toolCalls: 0, tokensUsed: 0 };
        },
      };
      registry.register(agent1);
      registry.register(agent2);
      const checkpointRepo = createMockCheckpointRepository();
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "first task", blockedBy: [] },
        { id: "task-2", description: "second task", blockedBy: [] },
      ];

      await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      expect(callOrder).toEqual(["agent-1-start", "agent-1-end", "agent-2-start", "agent-2-end"]);
    });

    it("emits task.completed after each task completes", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder"));
      const checkpointRepo = createMockCheckpointRepository();
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx, emit } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "write code", blockedBy: [] },
        { id: "task-2", description: "test code", blockedBy: ["task-1"] },
      ];

      await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      const completedCalls = (emit.mock.calls as [string, unknown][]).filter(
        ([event]) => event === "task.completed",
      );
      expect(completedCalls.length).toBe(2);
    });

    it("emits sequential.execution.completed when all tasks succeed", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder"));
      const checkpointRepo = createMockCheckpointRepository();
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx, emit } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "write code", blockedBy: [] },
      ];

      await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      const completedCall = findEmitCall(emit, "sequential.execution.completed");
      expect(completedCall).toBeDefined();
      const payload = completedCall?.[1] as { aborted: boolean; completedCount: number };
      expect(payload.aborted).toBe(false);
      expect(payload.completedCount).toBe(1);
    });

    it("stops downstream execution when task fails and abortOnFailure is true", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("success-agent", true));
      registry.register(makeAgent("fail-agent", false));
      const checkpointRepo = createMockCheckpointRepository();
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx, emit } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "success task", blockedBy: [] },
        { id: "task-2", description: "fail task", blockedBy: [] },
        { id: "task-3", description: "never runs", blockedBy: ["task-2"] },
      ];

      const result = await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      expect(result.aborted).toBe(true);
      expect(result.failedTaskId).toBe("task-2");
      expect(result.completedTasks.length).toBe(2);

      const abortedCall = findEmitCall(emit, "sequential.execution.aborted");
      expect(abortedCall).toBeDefined();
    });

    it("respects task dependencies", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder"));
      const checkpointRepo = createMockCheckpointRepository();
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "write first code", blockedBy: [] },
        { id: "task-2", description: "write second code", blockedBy: ["task-1"] },
        { id: "task-3", description: "write third code", blockedBy: ["task-2"] },
      ];

      const result = await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      expect(result.aborted).toBe(false);
      expect(result.completedTasks.length).toBe(3);
    });

    it("aborts when dependency task fails", async () => {
      const registry = new AgentRegistry();
      const successAgent: Agent = {
        metadata: {
          name: "success",
          description: "success agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: () =>
          Promise.resolve({ success: true, output: "done", toolCalls: 0, tokensUsed: 0 }),
      };
      const failAgent: Agent = {
        metadata: {
          name: "fail",
          description: "fail agent",
          tier: "medium",
          category: "code",
          capabilities: [],
          tags: [],
        },
        execute: () =>
          Promise.resolve({ success: false, output: "failed", toolCalls: 0, tokensUsed: 0 }),
      };
      registry.register(successAgent);
      registry.register(failAgent);
      const checkpointRepo = createMockCheckpointRepository();
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "success task", blockedBy: [] },
        { id: "task-2", description: "fail task", blockedBy: ["task-1"] },
        {
          id: "task-3",
          description: "never runs due to dependency failure",
          blockedBy: ["task-2"],
        },
      ];

      const result = await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      expect(result.aborted).toBe(true);
      expect(result.completedTasks.length).toBe(2);
      expect(result.completedTasks[0]?.success).toBe(true);
      expect(result.completedTasks[1]?.success).toBe(false);
    });

    it("saves checkpoint after each task via checkpointRepository", async () => {
      const registry = new AgentRegistry();
      registry.register(makeAgent("coder"));
      const checkpointRepo = createMockCheckpointRepository();
      const upsertSpy = vi.spyOn(checkpointRepo, "upsert");
      const executor = createSequentialTaskExecutor({
        registry,
        checkpointRepository: checkpointRepo,
      });
      const { ctx } = makeContext();

      const tasks: readonly PlannedTask[] = [
        { id: "task-1", description: "write code", blockedBy: [] },
      ];

      await executor.executePlan(tasks, ctx, "turn-1", "plan-1");

      expect(upsertSpy).toHaveBeenCalled();
    });
  });
});
