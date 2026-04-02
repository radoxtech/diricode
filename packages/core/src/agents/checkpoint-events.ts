import type { CheckpointStatus, TaskExecutionResult, CheckpointSummary } from "./types.js";
import type { CorrelationContext } from "../observability/correlation.js";

export interface TaskCheckpointEvent {
  type: "task.checkpoint";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  taskIndex: number;
  taskId: string;
  result: TaskExecutionResult;
  checkpoint: CheckpointSummary;
  timestamp: number;
  correlation?: CorrelationContext;
}

export interface TaskStartedEvent {
  type: "task.started";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  taskIndex: number;
  taskId: string;
  taskDescription: string;
  timestamp: number;
  correlation?: CorrelationContext;
}

export interface TaskCompletedEvent {
  type: "task.completed";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  taskIndex: number;
  taskId: string;
  success: boolean;
  durationMs: number;
  timestamp: number;
  correlation?: CorrelationContext;
}

export interface TaskFailedEvent {
  type: "task.failed";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  taskIndex: number;
  taskId: string;
  error: string;
  checkpoint: CheckpointSummary;
  timestamp: number;
  correlation?: CorrelationContext;
}

export interface SequentialExecutionStartedEvent {
  type: "sequential.execution.started";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  totalTasks: number;
  abortOnFailure: boolean;
  timestamp: number;
  correlation?: CorrelationContext;
}

export interface SequentialExecutionCompletedEvent {
  type: "sequential.execution.completed";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  completedCount: number;
  failedCount: number;
  aborted: boolean;
  durationMs: number;
  finalCheckpoint: CheckpointSummary;
  timestamp: number;
  correlation?: CorrelationContext;
}

export interface SequentialExecutionAbortedEvent {
  type: "sequential.execution.aborted";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  failedTaskId: string;
  completedCount: number;
  lastValidCheckpoint: CheckpointSummary;
  timestamp: number;
  correlation?: CorrelationContext;
}

export interface CheckpointSavedEvent {
  type: "checkpoint.saved";
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  checkpointIndex: number;
  status: CheckpointStatus;
  timestamp: number;
  correlation?: CorrelationContext;
}

export function createTaskCheckpointEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  taskIndex: number,
  taskId: string,
  result: TaskExecutionResult,
  checkpoint: CheckpointSummary,
): TaskCheckpointEvent {
  return {
    type: "task.checkpoint",
    executionId,
    turnId,
    sessionId,
    planId,
    taskIndex,
    taskId,
    result,
    checkpoint,
    timestamp: Date.now(),
  };
}

export function createTaskStartedEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  taskIndex: number,
  taskId: string,
  taskDescription: string,
): TaskStartedEvent {
  return {
    type: "task.started",
    executionId,
    turnId,
    sessionId,
    planId,
    taskIndex,
    taskId,
    taskDescription,
    timestamp: Date.now(),
  };
}

export function createTaskCompletedEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  taskIndex: number,
  taskId: string,
  success: boolean,
  durationMs: number,
): TaskCompletedEvent {
  return {
    type: "task.completed",
    executionId,
    turnId,
    sessionId,
    planId,
    taskIndex,
    taskId,
    success,
    durationMs,
    timestamp: Date.now(),
  };
}

export function createTaskFailedEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  taskIndex: number,
  taskId: string,
  error: string,
  checkpoint: CheckpointSummary,
): TaskFailedEvent {
  return {
    type: "task.failed",
    executionId,
    turnId,
    sessionId,
    planId,
    taskIndex,
    taskId,
    error,
    checkpoint,
    timestamp: Date.now(),
  };
}

export function createSequentialExecutionStartedEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  totalTasks: number,
  abortOnFailure: boolean,
): SequentialExecutionStartedEvent {
  return {
    type: "sequential.execution.started",
    executionId,
    turnId,
    sessionId,
    planId,
    totalTasks,
    abortOnFailure,
    timestamp: Date.now(),
  };
}

export function createSequentialExecutionCompletedEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  completedCount: number,
  failedCount: number,
  aborted: boolean,
  durationMs: number,
  finalCheckpoint: CheckpointSummary,
): SequentialExecutionCompletedEvent {
  return {
    type: "sequential.execution.completed",
    executionId,
    turnId,
    sessionId,
    planId,
    completedCount,
    failedCount,
    aborted,
    durationMs,
    finalCheckpoint,
    timestamp: Date.now(),
  };
}

export function createSequentialExecutionAbortedEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  failedTaskId: string,
  completedCount: number,
  lastValidCheckpoint: CheckpointSummary,
): SequentialExecutionAbortedEvent {
  return {
    type: "sequential.execution.aborted",
    executionId,
    turnId,
    sessionId,
    planId,
    failedTaskId,
    completedCount,
    lastValidCheckpoint,
    timestamp: Date.now(),
  };
}

export function createCheckpointSavedEvent(
  executionId: string,
  turnId: string,
  sessionId: string,
  planId: string,
  checkpointIndex: number,
  status: CheckpointStatus,
): CheckpointSavedEvent {
  return {
    type: "checkpoint.saved",
    executionId,
    turnId,
    sessionId,
    planId,
    checkpointIndex,
    status,
    timestamp: Date.now(),
  };
}
