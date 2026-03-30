import type { Agent, AgentContext, AgentResult } from "@diricode/core";
import { generateExecutionId, createPolicyEnforcingToolRegistry, AgentError } from "@diricode/core";
import type { AgentRegistry } from "./registry.js";
import { createHandoffEnvelope } from "./protocol.js";
import { executeInSandbox } from "./sandbox.js";
import type { SandboxContext } from "./sandbox.js";
import type {
  BackgroundTaskRepository,
  BackgroundTaskRecord,
  BackgroundTaskStatus,
  TaskPayload,
  ContextSnapshot,
  ResultPayload,
  ErrorDetails,
  TaskPriority,
} from "@diricode/memory";

export interface BackgroundTaskOptions {
  timeoutMs?: number;
  priority?: TaskPriority;
  worktreePrefix?: string;
}

export interface StartBackgroundTaskRequest {
  agentName: string;
  task: TaskPayload;
  context: ContextSnapshot;
  options?: BackgroundTaskOptions;
}

export interface StartBackgroundTaskResponse {
  jobId: string;
  status: BackgroundTaskStatus;
  worktreePath: string;
}

export interface CheckStatusResponse {
  jobId: string;
  status: BackgroundTaskStatus;
  progress: number;
  message?: string;
  startedAt?: string;
  estimatedCompletion?: string;
}

export interface GetResultResponse {
  jobId: string;
  status: Extract<BackgroundTaskStatus, "completed" | "failed">;
  result?: ResultPayload;
  error?: ErrorDetails;
  completedAt?: string;
  durationMs?: number;
}

export interface BackgroundTaskManagerConfig {
  registry: AgentRegistry;
  repository: BackgroundTaskRepository;
  maxConcurrentTasks?: number;
}

export interface BackgroundTask {
  record: BackgroundTaskRecord;
  promise: Promise<AgentResult>;
  abortController: AbortController;
}

export class BackgroundTaskManager {
  readonly #registry: AgentRegistry;
  readonly #repository: BackgroundTaskRepository;
  readonly #activeTasks = new Map<string, BackgroundTask>();
  readonly #sandboxConfig = {
    tokenBudget: {
      heavy: 80000,
      medium: 40000,
      light: 10000,
    },
    timeout: {
      heavy: 300000,
      medium: 120000,
      light: 30000,
    },
    retryPolicy: {
      heavy: 3,
      medium: 2,
      light: 1,
    },
  };

  constructor(config: BackgroundTaskManagerConfig) {
    this.#registry = config.registry;
    this.#repository = config.repository;
  }

  /**
   * Start a background task for async subagent execution.
   * Only HEAVY tier agents can run in background mode.
   */
  startJob(
    request: StartBackgroundTaskRequest,
    parentContext: AgentContext,
    parentExecutionId: string,
    parentAgentName: string,
  ): StartBackgroundTaskResponse {
    const agent = this.#registry.get(request.agentName);

    if (agent.metadata.tier !== "heavy") {
      throw new AgentError(
        "INVALID_TIER",
        `Background tasks only supported for HEAVY tier agents. ${request.agentName} is ${agent.metadata.tier}`,
      );
    }

    const jobId = generateExecutionId();
    const worktreePath = this.#generateWorktreePath(
      request.options?.worktreePrefix ?? "bg-task",
      jobId,
    );

    const toolAllowlist = [...(agent.metadata.toolPolicy?.allowedTools ?? [])];

    const record = this.#repository.create({
      jobId,
      parentExecutionId,
      parentAgentName,
      childAgentName: request.agentName,
      agentTier: agent.metadata.tier,
      status: "pending",
      taskPayload: request.task,
      contextSnapshot: request.context,
      toolAllowlist,
      worktreePath,
      sessionId: parentContext.sessionId,
      workspaceRoot: parentContext.workspaceRoot,
      priority: request.options?.priority ?? "normal",
    });

    parentContext.emit("background_task.created", {
      jobId,
      parentExecutionId,
      childAgentName: request.agentName,
      status: "pending",
      priority: record.priority,
    });

    const abortController = new AbortController();

    const promise = this.#executeBackgroundTask(
      jobId,
      agent,
      request.task,
      parentContext,
      abortController,
    );

    this.#activeTasks.set(jobId, {
      record,
      promise,
      abortController,
    });

    promise
      .then((result) => {
        this.#handleTaskCompletion(jobId, result, parentContext);
      })
      .catch((error: unknown) => {
        this.#handleTaskFailure(jobId, error, parentContext);
      })
      .finally(() => {
        this.#activeTasks.delete(jobId);
      });

    return {
      jobId,
      status: "pending",
      worktreePath,
    };
  }

  /**
   * Check the status of a background task.
   */
  checkStatus(jobId: string): CheckStatusResponse {
    const record = this.#repository.getById(jobId);

    if (!record) {
      throw new AgentError("TASK_NOT_FOUND", `Background task not found: ${jobId}`);
    }

    return {
      jobId: record.jobId,
      status: record.status,
      progress: record.progress,
      message: record.statusMessage,
      startedAt: record.startedAt,
      estimatedCompletion: record.estimatedCompletion,
    };
  }

  /**
   * Get the result of a completed background task.
   */
  getResult(jobId: string): GetResultResponse {
    const record = this.#repository.getById(jobId);

    if (!record) {
      throw new AgentError("TASK_NOT_FOUND", `Background task not found: ${jobId}`);
    }

    if (record.status !== "completed" && record.status !== "failed") {
      throw new AgentError(
        "TASK_NOT_COMPLETE",
        `Task ${jobId} is not complete. Current status: ${record.status}`,
      );
    }

    const durationMs =
      record.startedAt && record.completedAt
        ? new Date(record.completedAt).getTime() - new Date(record.startedAt).getTime()
        : undefined;

    return {
      jobId: record.jobId,
      status: record.status,
      result: record.resultPayload,
      error: record.errorDetails,
      completedAt: record.completedAt,
      durationMs,
    };
  }

  /**
   * Cancel a running or pending background task.
   */
  cancelJob(jobId: string, context: AgentContext): void {
    const task = this.#activeTasks.get(jobId);

    if (task) {
      task.abortController.abort("Task cancelled by parent");
    }

    this.#repository.markCancelled(jobId);

    context.emit("background_task.cancelled", {
      jobId,
      cancelledAt: new Date().toISOString(),
    });
  }

  /**
   * Get all background tasks for a parent execution.
   */
  getTasksByParent(parentExecutionId: string): BackgroundTaskRecord[] {
    return this.#repository.getByParentExecutionId(parentExecutionId);
  }

  /**
   * Get status counts for a parent execution.
   */
  getStatusCounts(parentExecutionId: string): Record<BackgroundTaskStatus, number> {
    return this.#repository.getStatusCounts(parentExecutionId);
  }

  /**
   * Wait for a specific background task to complete.
   */
  async waitForCompletion(jobId: string): Promise<AgentResult> {
    const task = this.#activeTasks.get(jobId);

    if (!task) {
      const record = this.#repository.getById(jobId);
      if (!record) {
        throw new AgentError("TASK_NOT_FOUND", `Background task not found: ${jobId}`);
      }
      if (record.status === "completed" && record.resultPayload) {
        return {
          success: true,
          output: record.resultPayload.output,
          toolCalls: record.resultPayload.toolCalls,
          tokensUsed: record.resultPayload.tokensUsed,
        };
      }
      if (record.status === "failed") {
        throw new AgentError(
          "TASK_FAILED",
          record.errorDetails?.message ?? "Task failed without error details",
        );
      }
      throw new AgentError("TASK_NOT_COMPLETE", `Task ${jobId} is not complete`);
    }

    return task.promise;
  }

  async #executeBackgroundTask(
    jobId: string,
    agent: Agent,
    task: TaskPayload,
    parentContext: AgentContext,
    abortController: AbortController,
  ): Promise<AgentResult> {
    this.#repository.markRunning(jobId);

    parentContext.emit("background_task.started", {
      jobId,
      childAgentName: agent.metadata.name,
      startedAt: new Date().toISOString(),
    });

    const envelope = createHandoffEnvelope({
      parentExecutionId: jobId,
      parentAgentName: "background-task-manager",
      sessionId: parentContext.sessionId,
      workspaceRoot: parentContext.workspaceRoot,
      taskInput: task.description,
      inheritanceRules: {
        mode: "isolated",
        includeFiles: task.files,
      },
      parentContext,
    });

    const childContext: AgentContext = {
      ...parentContext,
      parentAgentId: "background-task-manager",
      sessionId: envelope.parent.sessionId,
      tools: createPolicyEnforcingToolRegistry(
        parentContext.tools,
        agent.metadata.toolPolicy ?? {},
        agent.metadata.name,
        parentContext.emit,
      ),
    };

    const sandboxContext: SandboxContext = {
      ...childContext,
      sandboxConfig: this.#sandboxConfig,
    };

    try {
      const sandboxResult = await executeInSandbox(
        agent,
        task.description,
        sandboxContext,
        this.#sandboxConfig,
      );

      if (abortController.signal.aborted) {
        throw new Error("Task was cancelled");
      }

      const result: AgentResult = {
        success: sandboxResult.success,
        output: sandboxResult.output,
        toolCalls: sandboxResult.totalToolCalls,
        tokensUsed: sandboxResult.totalTokens,
      };

      this.#repository.updateProgress(jobId, 100, "Task completed successfully");

      return result;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("Task was cancelled", { cause: error });
      }
      throw error;
    }
  }

  #handleTaskCompletion(jobId: string, result: AgentResult, context: AgentContext): void {
    const resultPayload: ResultPayload = {
      output: result.output,
      toolCalls: result.toolCalls,
      tokensUsed: result.tokensUsed,
      findings: result.findings,
    };

    this.#repository.markCompleted(jobId, resultPayload);

    context.emit("background_task.completed", {
      jobId,
      success: true,
      toolCalls: result.toolCalls,
      tokensUsed: result.tokensUsed,
      completedAt: new Date().toISOString(),
    });
  }

  #handleTaskFailure(jobId: string, error: unknown, context: AgentContext): void {
    const errorDetails: ErrorDetails = {
      code: error instanceof AgentError ? error.code : "UNKNOWN_ERROR",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };

    this.#repository.markFailed(jobId, errorDetails);

    context.emit("background_task.failed", {
      jobId,
      error: errorDetails.message,
      failedAt: new Date().toISOString(),
    });
  }

  #generateWorktreePath(prefix: string, jobId: string): string {
    return `.dc/worktrees/${prefix}-${jobId.substring(0, 8)}`;
  }
}
