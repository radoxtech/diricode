import { z } from "zod";
import type { CorrelationContext } from "./correlation.js";
import { generateEventId } from "./correlation.js";

export enum EventType {
  TURN_START = "turn.start",
  TURN_END = "turn.end",
  TURN_TIMEOUT = "turn.timeout",

  AGENT_STARTED = "agent.started",
  AGENT_COMPLETED = "agent.completed",
  AGENT_FAILED = "agent.failed",

  TOOL_START = "tool.start",
  TOOL_END = "tool.end",
  TOOL_PROGRESS = "tool.progress",
  TOOL_ERROR = "tool.error",
  TOOL_ERROR_RETRY = "tool.error.retry",
  TOOL_ERROR_RECOVERED = "tool.error.recovered",
  TOOL_ERROR_ESCALATE = "tool.error.escalate",
  TOOL_ERROR_STOP = "tool.error.stop",
  TOOL_ACCESS_DENIED = "tool.access_denied",

  DELEGATION_HANDOFF_CREATED = "delegation.handoff-created",
  DELEGATION_CHILD_STARTED = "delegation.child.started",
  DELEGATION_CHILD_COMPLETED = "delegation.child.completed",
  DELEGATION_CHILD_FAILED = "delegation.child.failed",
  DELEGATION_RESULT_RECEIVED = "delegation.result.received",

  SEQUENTIAL_EXECUTION_STARTED = "sequential.execution.started",
  SEQUENTIAL_EXECUTION_COMPLETED = "sequential.execution.completed",
  SEQUENTIAL_EXECUTION_ABORTED = "sequential.execution.aborted",

  TASK_STARTED = "task.started",
  TASK_COMPLETED = "task.completed",
  TASK_FAILED = "task.failed",
  TASK_CHECKPOINT = "task.checkpoint",

  CHECKPOINT_SAVED = "checkpoint.saved",

  SWARM_STARTED = "swarm.started",
  SWARM_COMPLETED = "swarm.completed",
  SWARM_WAVE_START = "swarm.wave.start",
  SWARM_WAVE_END = "swarm.wave.end",
  SWARM_TASK_START = "swarm.task.start",
  SWARM_TASK_COMPLETE = "swarm.task.complete",
  SWARM_TASK_FAILED = "swarm.task.failed",
  SWARM_DEADLOCK = "swarm.deadlock",
}

export interface BaseEvent {
  readonly id: string;
  readonly type: EventType;
  readonly timestamp: number;
  readonly correlation: CorrelationContext;
}

export const baseEventSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(EventType),
  timestamp: z.number(),
  correlation: z
    .object({
      sessionId: z.string(),
      turnId: z.string().optional(),
      executionId: z.string().optional(),
      agentSpanId: z.string().optional(),
      parentSpanId: z.string().optional(),
      toolCallId: z.string().optional(),
      planId: z.string().optional(),
      taskId: z.string().optional(),
    })
    .readonly(),
});

export interface TurnStartEvent extends BaseEvent {
  readonly type: EventType.TURN_START;
  readonly inputPreview: string;
}

export interface TurnEndEvent extends BaseEvent {
  readonly type: EventType.TURN_END;
  readonly status: "running" | "completed" | "failed" | "timeout";
  readonly durationMs: number;
  readonly outputSummary: string;
  readonly telemetry: {
    totalTokens: number;
    totalToolCalls: number;
    totalCost: number;
    agentName?: string;
    modelUsed?: string;
    executionId?: string;
  };
}

export interface TurnTimeoutEvent extends BaseEvent {
  readonly type: EventType.TURN_TIMEOUT;
  readonly elapsedMs: number;
}

export interface AgentStartedEvent extends BaseEvent {
  readonly type: EventType.AGENT_STARTED;
  readonly agentName: string;
  readonly agentTier?: "heavy" | "medium" | "light";
  readonly inputPreview: string;
}

export interface AgentCompletedEvent extends BaseEvent {
  readonly type: EventType.AGENT_COMPLETED;
  readonly agentName: string;
  readonly success: boolean;
  readonly toolCalls: number;
  readonly tokensUsed: number;
}

export interface AgentFailedEvent extends BaseEvent {
  readonly type: EventType.AGENT_FAILED;
  readonly agentName: string;
  readonly error: string;
  readonly toolCalls: number;
  readonly tokensUsed: number;
}

export interface ToolStartEvent extends BaseEvent {
  readonly type: EventType.TOOL_START;
  readonly toolName: string;
  readonly params: unknown;
}

export interface ToolEndEvent extends BaseEvent {
  readonly type: EventType.TOOL_END;
  readonly toolName: string;
  readonly durationMs: number;
}

export interface ToolProgressEvent extends BaseEvent {
  readonly type: EventType.TOOL_PROGRESS;
  readonly toolName: string;
  readonly chunk: string;
  readonly stream: "stdout" | "stderr";
}

export interface ToolErrorEvent extends BaseEvent {
  readonly type: EventType.TOOL_ERROR;
  readonly toolName: string;
  readonly kind: "recoverable" | "retryable" | "blocking" | "user_decision_needed";
  readonly action: "continue" | "retry" | "stop" | "escalate";
  readonly reason: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface ToolErrorRetryEvent extends BaseEvent {
  readonly type: EventType.TOOL_ERROR_RETRY;
  readonly toolName: string;
  readonly attempt: number;
  readonly maxRetries: number;
  readonly delayMs: number;
  readonly reason: string;
}

export interface ToolErrorRecoveredEvent extends BaseEvent {
  readonly type: EventType.TOOL_ERROR_RECOVERED;
  readonly toolName: string;
  readonly reason: string;
}

export interface ToolErrorEscalateEvent extends BaseEvent {
  readonly type: EventType.TOOL_ERROR_ESCALATE;
  readonly toolName: string;
  readonly reason: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface ToolErrorStopEvent extends BaseEvent {
  readonly type: EventType.TOOL_ERROR_STOP;
  readonly toolName: string;
  readonly reason: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

export interface ToolAccessDeniedEvent extends BaseEvent {
  readonly type: EventType.TOOL_ACCESS_DENIED;
  readonly toolName: string;
  readonly reason: string;
}

export interface DelegationHandoffCreatedEvent extends BaseEvent {
  readonly type: EventType.DELEGATION_HANDOFF_CREATED;
  readonly handoffId: string;
  readonly childExecutionId: string;
  readonly childAgentName: string;
}

export interface DelegationChildStartedEvent extends BaseEvent {
  readonly type: EventType.DELEGATION_CHILD_STARTED;
  readonly handoffId: string;
  readonly childExecutionId: string;
  readonly childAgentName: string;
}

export interface DelegationChildCompletedEvent extends BaseEvent {
  readonly type: EventType.DELEGATION_CHILD_COMPLETED;
  readonly handoffId: string;
  readonly childExecutionId: string;
  readonly childAgentName: string;
  readonly success: boolean;
  readonly durationMs: number;
}

export interface DelegationChildFailedEvent extends BaseEvent {
  readonly type: EventType.DELEGATION_CHILD_FAILED;
  readonly handoffId: string;
  readonly childExecutionId: string;
  readonly childAgentName: string;
  readonly error: string;
}

export interface DelegationResultReceivedEvent extends BaseEvent {
  readonly type: EventType.DELEGATION_RESULT_RECEIVED;
  readonly handoffId: string;
  readonly childExecutionId: string;
  readonly success: boolean;
}

export interface SequentialExecutionStartedEvent extends BaseEvent {
  readonly type: EventType.SEQUENTIAL_EXECUTION_STARTED;
  readonly totalTasks: number;
  readonly abortOnFailure: boolean;
}

export interface SequentialExecutionCompletedEvent extends BaseEvent {
  readonly type: EventType.SEQUENTIAL_EXECUTION_COMPLETED;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly aborted: boolean;
  readonly durationMs: number;
}

export interface SequentialExecutionAbortedEvent extends BaseEvent {
  readonly type: EventType.SEQUENTIAL_EXECUTION_ABORTED;
  readonly failedTaskId: string;
  readonly completedCount: number;
}

export interface TaskStartedEvent extends BaseEvent {
  readonly type: EventType.TASK_STARTED;
  readonly taskDescription: string;
}

export interface TaskCompletedEvent extends BaseEvent {
  readonly type: EventType.TASK_COMPLETED;
  readonly success: boolean;
  readonly durationMs: number;
}

export interface TaskFailedEvent extends BaseEvent {
  readonly type: EventType.TASK_FAILED;
  readonly error: string;
}

export interface TaskCheckpointEvent extends BaseEvent {
  readonly type: EventType.TASK_CHECKPOINT;
  readonly taskIndex: number;
  readonly checkpointIndex: number;
}

export interface CheckpointSavedEvent extends BaseEvent {
  readonly type: EventType.CHECKPOINT_SAVED;
  readonly checkpointIndex: number;
  readonly status: "valid" | "invalid" | "partial";
}

export interface SwarmStartedEvent extends BaseEvent {
  readonly type: EventType.SWARM_STARTED;
  readonly agentName: string;
  readonly taskCount: number;
  readonly sequential: boolean;
}

export interface SwarmCompletedEvent extends BaseEvent {
  readonly type: EventType.SWARM_COMPLETED;
  readonly agentName: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
}

export interface SwarmWaveStartEvent extends BaseEvent {
  readonly type: EventType.SWARM_WAVE_START;
  readonly waveIndex: number;
  readonly taskCount: number;
}

export interface SwarmWaveEndEvent extends BaseEvent {
  readonly type: EventType.SWARM_WAVE_END;
  readonly waveIndex: number;
  readonly completedCount: number;
  readonly failedCount: number;
  readonly durationMs: number;
}

export interface SwarmTaskStartEvent extends BaseEvent {
  readonly type: EventType.SWARM_TASK_START;
  readonly taskId: string;
  readonly agentName: string;
  readonly waveIndex: number;
}

export interface SwarmTaskCompleteEvent extends BaseEvent {
  readonly type: EventType.SWARM_TASK_COMPLETE;
  readonly taskId: string;
  readonly agentName: string;
  readonly durationMs: number;
}

export interface SwarmTaskFailedEvent extends BaseEvent {
  readonly type: EventType.SWARM_TASK_FAILED;
  readonly taskId: string;
  readonly agentName: string;
  readonly error: string;
}

export interface SwarmDeadlockEvent extends BaseEvent {
  readonly type: EventType.SWARM_DEADLOCK;
  readonly blockedTaskIds: readonly string[];
  readonly reason: string;
}

export type CoordinatedEvent =
  | TurnStartEvent
  | TurnEndEvent
  | TurnTimeoutEvent
  | AgentStartedEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | ToolStartEvent
  | ToolEndEvent
  | ToolProgressEvent
  | ToolErrorEvent
  | ToolErrorRetryEvent
  | ToolErrorRecoveredEvent
  | ToolErrorEscalateEvent
  | ToolErrorStopEvent
  | ToolAccessDeniedEvent
  | DelegationHandoffCreatedEvent
  | DelegationChildStartedEvent
  | DelegationChildCompletedEvent
  | DelegationChildFailedEvent
  | DelegationResultReceivedEvent
  | SequentialExecutionStartedEvent
  | SequentialExecutionCompletedEvent
  | SequentialExecutionAbortedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskCheckpointEvent
  | CheckpointSavedEvent
  | SwarmStartedEvent
  | SwarmCompletedEvent
  | SwarmWaveStartEvent
  | SwarmWaveEndEvent
  | SwarmTaskStartEvent
  | SwarmTaskCompleteEvent
  | SwarmTaskFailedEvent
  | SwarmDeadlockEvent;

export function createCoordinatedEvent<T extends BaseEvent>(
  type: EventType,
  correlation: CorrelationContext,
  extra: Omit<T, "id" | "type" | "timestamp" | "correlation">,
): T {
  return {
    id: generateEventId(),
    type,
    timestamp: Date.now(),
    correlation,
    ...extra,
  } as T;
}
