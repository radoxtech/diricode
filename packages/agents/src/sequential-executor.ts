import type {
  AgentContext,
  Checkpoint,
  CheckpointPersistence,
  CheckpointStatus,
  CheckpointSummary,
  PlannedTask,
  SequentialExecutorConfig,
  SequentialExecutionResult,
  TaskExecutionResult,
} from "@diricode/core";
import {
  DEFAULT_SEQUENTIAL_EXECUTOR_CONFIG,
  createTaskStartedEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createCheckpointSavedEvent,
  createSequentialExecutionStartedEvent,
  createSequentialExecutionCompletedEvent,
  createSequentialExecutionAbortedEvent,
  generateExecutionId,
  AgentError,
} from "@diricode/core";
import type { AgentRegistry } from "./registry.js";
import { createHandoffEnvelope } from "./protocol.js";
import {
  DEFAULT_INHERITANCE_RULES,
  createPolicyEnforcingToolRegistry,
  createFilterPolicyForCategory,
  filterContextForHandoff,
} from "@diricode/core";

export interface SequentialExecutorOptions {
  readonly registry: AgentRegistry;
  readonly checkpointRepository: CheckpointPersistence;
  readonly config?: Partial<SequentialExecutorConfig>;
}

export function createSequentialTaskExecutor(options: SequentialExecutorOptions): {
  executePlan: (
    tasks: readonly PlannedTask[],
    context: AgentContext,
    turnId: string,
    planId: string,
  ) => Promise<SequentialExecutionResult>;
} {
  const config = { ...DEFAULT_SEQUENTIAL_EXECUTOR_CONFIG, ...options.config };

  function emit(context: AgentContext, event: unknown): void {
    context.emit((event as { type: string }).type, event);
  }

  function classifyIntent(input: string): { category: string; confidence: number } {
    const lower = input.toLowerCase();
    const words = lower.split(/\s+/);
    const KEYWORD_MAP: readonly (readonly [readonly string[], string])[] = [
      [["write", "implement", "create", "add", "build"], "code"],
      [["review", "check", "verify", "test"], "quality"],
      [["plan", "design", "architect"], "strategy"],
      [["find", "search", "explore", "look"], "research"],
      [["commit", "deploy", "format", "lint"], "utility"],
    ];
    for (const [keywords, category] of KEYWORD_MAP) {
      for (const keyword of keywords) {
        if (words.includes(keyword)) {
          return { category, confidence: 1.0 };
        }
      }
    }
    for (const [keywords, category] of KEYWORD_MAP) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return { category, confidence: 0.5 };
        }
      }
    }
    return { category: "code", confidence: 0.5 };
  }

  async function executeTask(
    task: PlannedTask,
    taskIndex: number,
    context: AgentContext,
    turnId: string,
    planId: string,
    executionId: string,
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    emit(
      context,
      createTaskStartedEvent(
        executionId,
        turnId,
        context.sessionId,
        planId,
        taskIndex,
        task.id,
        task.description,
      ),
    );

    const _intent = classifyIntent(task.description);
    const candidates = options.registry.search(task.description);

    if (candidates.length === 0) {
      throw new AgentError("NO_AGENT_FOUND", `No suitable agent found for task: ${task.id}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- noUncheckedIndexedAccess requires this
    const selected = candidates[0]!;
    const agent = options.registry.get(selected.agent.name);

    const filterPolicy = createFilterPolicyForCategory(
      agent.metadata.category as
        | "code"
        | "quality"
        | "strategy"
        | "research"
        | "utility"
        | "command",
    );
    const { filteredContext } = filterContextForHandoff(
      context,
      DEFAULT_INHERITANCE_RULES,
      filterPolicy,
      agent.metadata.category,
      agent.metadata.toolPolicy,
    );

    const envelope = createHandoffEnvelope({
      parentExecutionId: executionId,
      parentAgentName: "sequential-executor",
      sessionId: context.sessionId,
      workspaceRoot: context.workspaceRoot,
      taskInput: task.description,
      inheritanceRules: DEFAULT_INHERITANCE_RULES,
      parentContext: context,
      filteredContext,
    });

    const childContext: AgentContext = {
      ...context,
      parentAgentId: "sequential-executor",
      sessionId: envelope.parent.sessionId,
      turnId,
      tools: createPolicyEnforcingToolRegistry(
        context.tools,
        agent.metadata.toolPolicy ?? {},
        agent.metadata.name,
        context.emit,
      ),
    };

    const result = await agent.execute(task.description, childContext);
    const durationMs = Date.now() - startTime;

    emit(
      context,
      createTaskCompletedEvent(
        executionId,
        turnId,
        context.sessionId,
        planId,
        taskIndex,
        task.id,
        result.success,
        durationMs,
      ),
    );

    const taskResult: TaskExecutionResult = {
      taskId: task.id,
      success: result.success,
      output: result.output,
      toolCalls: result.toolCalls,
      tokensUsed: result.tokensUsed,
      artifactsSummary: [],
      error: result.success ? undefined : result.output,
      stoppedReason: result.success ? "completed" : "failed",
    };

    return taskResult;
  }

  function saveCheckpoint(
    context: AgentContext,
    executionId: string,
    turnId: string,
    planId: string,
    completedTasks: readonly TaskExecutionResult[],
    taskIndex: number,
    status: CheckpointStatus,
  ): CheckpointSummary {
    const checkpoint: Omit<Checkpoint, "createdAt" | "updatedAt"> = {
      executionId,
      turnId,
      sessionId: context.sessionId,
      planId,
      taskIndex,
      completedTasks,
      lastValidCheckpointIndex: taskIndex,
      status,
    };

    const saved = options.checkpointRepository.upsert(checkpoint);
    const summary = options.checkpointRepository.toCheckpointSummaryFromCheckpoint(
      saved,
      taskIndex + 1,
    );

    emit(
      context,
      createCheckpointSavedEvent(executionId, turnId, context.sessionId, planId, taskIndex, status),
    );

    return summary;
  }

  async function executePlan(
    tasks: readonly PlannedTask[],
    context: AgentContext,
    turnId: string,
    planId: string,
  ): Promise<SequentialExecutionResult> {
    const executionId = generateExecutionId();
    const startTime = Date.now();

    emit(
      context,
      createSequentialExecutionStartedEvent(
        executionId,
        turnId,
        context.sessionId,
        planId,
        tasks.length,
        config.abortOnFailure,
      ),
    );

    const completedTasks: TaskExecutionResult[] = [];
    let failedTaskId: string | undefined;
    let aborted = false;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task) break;

      const depsSatisfied = task.blockedBy.every((depId) =>
        completedTasks.some((t) => t.taskId === depId && t.success),
      );

      if (!depsSatisfied) {
        const checkpointSummary = saveCheckpoint(
          context,
          executionId,
          turnId,
          planId,
          completedTasks,
          i - 1,
          "partial",
        );

        emit(
          context,
          createSequentialExecutionAbortedEvent(
            executionId,
            turnId,
            context.sessionId,
            planId,
            task.id,
            completedTasks.length,
            checkpointSummary,
          ),
        );

        aborted = true;
        break;
      }

      let taskResult: TaskExecutionResult;

      try {
        taskResult = await executeTask(task, i, context, turnId, planId, executionId);
      } catch (error) {
        taskResult = {
          taskId: task.id,
          success: false,
          output: "",
          toolCalls: 0,
          tokensUsed: 0,
          artifactsSummary: [],
          error: error instanceof Error ? error.message : String(error),
          stoppedReason: "failed",
        };
      }

      completedTasks.push(taskResult);

      const checkpointStatus: CheckpointStatus = taskResult.success ? "valid" : "invalid";
      saveCheckpoint(context, executionId, turnId, planId, completedTasks, i, checkpointStatus);

      if (!taskResult.success) {
        const checkpointSummary = saveCheckpoint(
          context,
          executionId,
          turnId,
          planId,
          completedTasks,
          i,
          "invalid",
        );

        emit(
          context,
          createTaskFailedEvent(
            executionId,
            turnId,
            context.sessionId,
            planId,
            i,
            task.id,
            taskResult.error ?? "Task failed",
            checkpointSummary,
          ),
        );

        if (config.abortOnFailure) {
          failedTaskId = task.id;
          aborted = true;

          emit(
            context,
            createSequentialExecutionAbortedEvent(
              executionId,
              turnId,
              context.sessionId,
              planId,
              task.id,
              completedTasks.length - 1,
              checkpointSummary,
            ),
          );

          break;
        }
      }
    }

    const finalCheckpoint = saveCheckpoint(
      context,
      executionId,
      turnId,
      planId,
      completedTasks,
      tasks.length - 1,
      aborted ? "partial" : "valid",
    );

    const durationMs = Date.now() - startTime;

    emit(
      context,
      createSequentialExecutionCompletedEvent(
        executionId,
        turnId,
        context.sessionId,
        planId,
        completedTasks.filter((t) => t.success).length,
        completedTasks.filter((t) => !t.success).length,
        aborted,
        durationMs,
        finalCheckpoint,
      ),
    );

    return {
      executionId,
      completedTasks,
      failedTaskId,
      aborted,
      finalCheckpoint,
    };
  }

  return { executePlan };
}
