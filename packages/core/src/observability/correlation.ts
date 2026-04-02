import { randomUUID } from "crypto";

/**
 * Universal correlation context carried by every event in the system.
 * Provides the identifiers needed to reconstruct the full execution graph.
 *
 * ID hierarchy (outer → inner):
 *   sessionId → turnId → executionId → agentExecutionId → toolCallId
 *
 * Cross-cutting identifiers:
 *   parentSpanId — links parent/child for tree reconstruction
 *   planId, taskId — for sequential execution within a plan
 */
export interface CorrelationContext {
  /** Session scope — one conversation or project session */
  readonly sessionId: string;
  /** Turn scope — one user input → result cycle */
  readonly turnId?: string;
  /** Execution scope — one agent invocation (matches protocol.ts executionId) */
  readonly executionId?: string;
  /** Agent execution span — unique per agent.run() call. Distinct from executionId
   *  because an executionId can spawn multiple agent spans (subagents). */
  readonly agentSpanId?: string;
  /** Parent span for tree reconstruction (OpenTelemetry-style parent_id) */
  readonly parentSpanId?: string;
  /** Tool call scope — unique per individual tool invocation */
  readonly toolCallId?: string;
  /** Plan scope — for sequential/multi-task execution */
  readonly planId?: string;
  /** Task scope — individual task within a plan */
  readonly taskId?: string;
}

/**
 * Generate a unique agent span ID.
 * Each agent.run() call gets its own span, distinct from executionId.
 */
export function generateAgentSpanId(): string {
  return `span_${randomUUID()}`;
}

/**
 * Generate a unique tool call ID.
 * Each individual tool invocation gets its own ID.
 */
export function generateToolCallId(): string {
  return `toolcall_${randomUUID()}`;
}

/**
 * Generate a unique plan ID.
 * Each sequential/multi-task execution plan gets its own ID.
 */
export function generatePlanId(): string {
  return `plan_${randomUUID()}`;
}

/**
 * Generate a unique event ID.
 * Each emitted event gets a unique deduplication/ordering ID.
 */
export function generateEventId(): string {
  return `evt_${randomUUID()}`;
}

/**
 * Create a CorrelationContext from a base object.
 * The sessionId is required; all other fields are optional.
 */
export function createCorrelationContext(
  base: Partial<CorrelationContext> & { sessionId: string },
): CorrelationContext {
  return { ...base };
}
