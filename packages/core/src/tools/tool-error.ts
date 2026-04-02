/**
 * Tool loop error classification and recovery policy for DiriCode.
 *
 * Classifies tool failures into four categories and determines the appropriate
 * recovery action, following the pattern established by ADR-025 for provider
 * errors but adapted for the tool execution layer.
 *
 * References:
 *  - Pattern 04 — Tool Loop Error Handling
 *  - ADR-025 — Native TS Router with Fallback Chain (provider error classif.)
 *  - ADR-033 — Interceptor/Wrapper Hook Split (WrapToolCall interface)
 *  - ADR-036 — Tool Retry with Exponential Backoff
 */

import type { ToolResult } from "./types.js";
import { ToolError } from "./types.js";

// ---------------------------------------------------------------------------
// Error Kind
// ---------------------------------------------------------------------------

/**
 * Four-class taxonomy for tool-loop failures.
 *
 * - `recoverable`       — Non-fatal; loop can continue without corrupting state.
 * - `retryable`         — Safe to retry with backoff; idempotent or transient.
 * - `blocking`          — Must stop downstream work; not recoverable.
 * - `user_decision_needed` — Requires explicit user input before proceeding.
 */
export type ToolErrorKind = "recoverable" | "retryable" | "blocking" | "user_decision_needed";

// ---------------------------------------------------------------------------
// Recovery Action
// ---------------------------------------------------------------------------

/**
 * Recovery action prescribed for each error kind.
 *
 * - `continue`  — Log and proceed; no state corruption risk.
 * - `retry`    — Retry with exponential backoff (up to max retries).
 * - `stop`     — Halt the tool loop immediately; do not retry.
 * - `escalate` — Surface to user; block until they respond.
 */
export type ToolRecoveryAction = "continue" | "retry" | "stop" | "escalate";

// ---------------------------------------------------------------------------
// Classification Result
// ---------------------------------------------------------------------------

/**
 * Full classification result for a tool error.
 */
export interface ToolErrorClassification {
  readonly kind: ToolErrorKind;
  readonly action: ToolRecoveryAction;
  readonly reason: string;
  readonly idempotent: boolean;
  readonly retried: boolean;
  readonly cause: Error;
}

// ---------------------------------------------------------------------------
// ToolLoopError — enriched error with classification
// ---------------------------------------------------------------------------

/**
 * Extended tool error that carries classification metadata.
 * Used to propagate classification context through the tool loop.
 */
export class ToolLoopError extends ToolError {
  constructor(
    code: string,
    message: string,
    public readonly classification: ToolErrorClassification,
  ) {
    super(code, message);
    this.name = "ToolLoopError";
  }
}

// ---------------------------------------------------------------------------
// Lifecycle Event Payloads
// ---------------------------------------------------------------------------

/**
 * Correlation identifiers carried by every tool lifecycle event.
 * All fields are optional to preserve backward compat, but callers should
 * populate as many as are available in their ToolContext.
 */
export interface ToolEventCorrelation {
  turnId?: string;
  sessionId?: string;
  executionId?: string;
  agentName?: string;
}

/** Payload emitted when a tool call starts. */
export interface ToolStartEvent extends ToolEventCorrelation {
  type: "tool.start";
  toolName: string;
  timestamp: number;
  params: unknown;
}

/** Payload emitted when a tool call completes successfully. */
export interface ToolEndEvent extends ToolEventCorrelation {
  type: "tool.end";
  toolName: string;
  timestamp: number;
  durationMs: number;
}

/**
 * Payload emitted for incremental progress during long-running tool execution.
 * Used by bash (stdout chunks), file-read (large files), etc.
 */
export interface ToolProgressEvent extends ToolEventCorrelation {
  type: "tool.progress";
  toolName: string;
  timestamp: number;
  /** Incremental output chunk (e.g. one stdout line or block). */
  chunk: string;
  /** Stream source: stdout or stderr. */
  stream: "stdout" | "stderr";
}

// ---------------------------------------------------------------------------
// Error Event Payloads
// ---------------------------------------------------------------------------

/** Payload emitted when a tool call fails. */
export interface ToolErrorEvent {
  type: "tool.error";
  toolName: string;
  turnId?: string;
  timestamp: number;
  kind: ToolErrorKind;
  action: ToolRecoveryAction;
  reason: string;
  idempotent: boolean;
  retried: boolean;
  errorCode: string;
  errorMessage: string;
}

/** Payload emitted when a retry is attempted after a tool error. */
export interface ToolErrorRetryEvent {
  type: "tool.error.retry";
  toolName: string;
  turnId?: string;
  timestamp: number;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  reason: string;
}

/** Payload emitted when a tool error is recovered via `continue`. */
export interface ToolErrorRecoveredEvent {
  type: "tool.error.recovered";
  toolName: string;
  turnId?: string;
  timestamp: number;
  reason: string;
  /** The result returned to the loop after recovery. */
  recoveredResult: ToolResult;
}

/** Payload emitted when a tool error escalates to user decision. */
export interface ToolErrorEscalateEvent {
  type: "tool.error.escalate";
  toolName: string;
  turnId?: string;
  timestamp: number;
  reason: string;
  errorCode: string;
  errorMessage: string;
}

/** Payload emitted when a blocking error stops the loop. */
export interface ToolErrorStopEvent {
  type: "tool.error.stop";
  toolName: string;
  turnId?: string;
  timestamp: number;
  reason: string;
  errorCode: string;
  errorMessage: string;
}

// ---------------------------------------------------------------------------
// Classification Logic
// ---------------------------------------------------------------------------

/**
 * Derive the recovery action for a given error kind.
 */
export function deriveRecoveryAction(kind: ToolErrorKind): ToolRecoveryAction {
  switch (kind) {
    case "recoverable":
      return "continue";
    case "retryable":
      return "retry";
    case "blocking":
      return "stop";
    case "user_decision_needed":
      return "escalate";
  }
}

/**
 * Check whether an error message or code indicates an idempotent tool failure.
 * Idempotent errors are safe to retry without side effects.
 */
function isIdempotent(err: Error, code: string, msgLower: string): boolean {
  return (
    // File not found — re-check is idempotent
    code === "FILE_NOT_FOUND" ||
    code === "TOOL_ACCESS_DENIED" ||
    msgLower.includes("no such file") ||
    msgLower.includes("not found") ||
    msgLower.includes("enoent") ||
    msgLower.includes("enotfound") ||
    // Read-only violations — safe to skip and continue
    msgLower.includes("read-only") ||
    // Rate limited external services — safe to retry
    msgLower.includes("rate limit") ||
    msgLower.includes("too many requests") ||
    // Network timeouts — transient
    msgLower.includes("timeout") ||
    msgLower.includes("timed out") ||
    // Temporary unavailability
    msgLower.includes("unavailable") ||
    msgLower.includes("connection refused")
  );
}

/**
 * Classify a tool error into a {@link ToolErrorClassification}.
 *
 * Classification rules:
 * - `blocking`        → syntax errors, invalid operations, recursion
 * - `user_decision_needed` → quota violations, permission boundary crossings
 * - `retryable`       → idempotent errors (not found, timeouts, rate limits)
 * - `recoverable`     → everything else (warnings, non-fatal issues)
 *
 * @param error  - The error thrown by the tool.
 * @param toolName - Name of the tool that threw the error.
 * @param retried - Whether this error has already been retried.
 */
export function classifyToolError(
  error: Error,
  toolName: string,
  retried = false,
): ToolErrorClassification {
  const code = error instanceof ToolError ? error.code : "TOOL_ERROR";
  const msgLower = error.message.toLowerCase();

  const idempotent = isIdempotent(error, code, msgLower);

  const kind = classifyKind(code, msgLower, idempotent);
  const action = deriveRecoveryAction(kind);
  const reason = buildReason(code, msgLower, kind, idempotent);

  return {
    kind,
    action,
    reason,
    idempotent,
    retried,
    cause: error,
  };
}

function classifyKind(code: string, msgLower: string, idempotent: boolean): ToolErrorKind {
  // 1. Blocking — cannot continue; would corrupt state or violate invariants
  if (
    // Bash syntax / parsing errors
    code === "BASH_SYNTAX_ERROR" ||
    msgLower.includes("syntax error") ||
    msgLower.includes("parse error") ||
    // Invalid tool arguments
    code === "INVALID_TOOL_ARGS" ||
    code === "TOOL_VALIDATION_ERROR" ||
    // Circular dependency detected
    msgLower.includes("circular") ||
    msgLower.includes("cyclic dependency") ||
    // Sandbox boundary violations that are not recoverable
    msgLower.includes("sandbox escape") ||
    msgLower.includes("forbidden system call")
  ) {
    return "blocking";
  }

  // 2. User decision needed — quota/budget exhaustion, permission boundary crossings
  if (
    // Quota or budget exhausted
    code === "QUOTA_EXHAUSTED" ||
    code === "TOKEN_BUDGET_EXCEEDED" ||
    msgLower.includes("quota") ||
    msgLower.includes("budget exceeded") ||
    // User-canceled or explicit abort
    code === "USER_ABORT" ||
    code === "USER_CANCEL" ||
    msgLower.includes("user canceled") ||
    // Confirmation required
    code === "NEEDS_CONFIRMATION" ||
    msgLower.includes("requires confirmation") ||
    msgLower.includes("awaiting approval")
  ) {
    return "user_decision_needed";
  }

  // 3. Retryable — safe to retry (idempotent or transient)
  if (
    idempotent ||
    code === "RATE_LIMITED" ||
    code === "NETWORK_TIMEOUT" ||
    code === "CONNECTION_ERROR" ||
    msgLower.includes("rate limit") ||
    msgLower.includes("timeout") ||
    msgLower.includes("etimedout") ||
    msgLower.includes("econnrefused") ||
    msgLower.includes("temporarily unavailable") ||
    msgLower.includes("service unavailable")
  ) {
    return "retryable";
  }

  // 4. Recoverable — non-fatal, does not corrupt state
  return "recoverable";
}

function buildReason(
  code: string,
  msgLower: string,
  kind: ToolErrorKind,
  idempotent: boolean,
): string {
  switch (kind) {
    case "blocking":
      if (msgLower.includes("syntax error") || code === "BASH_SYNTAX_ERROR") {
        return "Bash syntax or parse error — blocking execution";
      }
      if (code === "INVALID_TOOL_ARGS" || code === "TOOL_VALIDATION_ERROR") {
        return "Invalid tool arguments — cannot proceed";
      }
      if (msgLower.includes("circular") || msgLower.includes("cyclic")) {
        return "Circular dependency detected — blocking to prevent infinite loop";
      }
      return `Blocking error (code=${code})`;

    case "user_decision_needed":
      if (
        msgLower.includes("quota") ||
        code === "QUOTA_EXHAUSTED" ||
        code === "TOKEN_BUDGET_EXCEEDED"
      ) {
        return "Quota or budget exhausted — requires user decision";
      }
      if (code === "USER_ABORT" || code === "USER_CANCEL") {
        return "User canceled operation — awaiting decision";
      }
      return `Requires user decision (code=${code})`;

    case "retryable":
      if (idempotent) {
        return `Idempotent error — safe to retry (code=${code})`;
      }
      return `Transient error — retry warranted (code=${code})`;

    case "recoverable":
      return `Non-fatal tool error — continuing loop (code=${code})`;
  }
}

// ---------------------------------------------------------------------------
// Event Emitters
// ---------------------------------------------------------------------------

/**
 * Build a {@link ToolErrorEvent} from classification data.
 */
export function buildToolErrorEvent(
  toolName: string,
  turnId: string | undefined,
  classification: ToolErrorClassification,
): ToolErrorEvent {
  return {
    type: "tool.error",
    toolName,
    turnId,
    timestamp: Date.now(),
    kind: classification.kind,
    action: classification.action,
    reason: classification.reason,
    idempotent: classification.idempotent,
    retried: classification.retried,
    errorCode: classification.cause instanceof ToolError ? classification.cause.code : "TOOL_ERROR",
    errorMessage: classification.cause.message,
  };
}

/**
 * Build a {@link ToolErrorRetryEvent}.
 */
export function buildToolErrorRetryEvent(
  toolName: string,
  turnId: string | undefined,
  attempt: number,
  maxRetries: number,
  delayMs: number,
  reason: string,
): ToolErrorRetryEvent {
  return {
    type: "tool.error.retry",
    toolName,
    turnId,
    timestamp: Date.now(),
    attempt,
    maxRetries,
    delayMs,
    reason,
  };
}

/**
 * Build a {@link ToolErrorRecoveredEvent}.
 */
export function buildToolErrorRecoveredEvent(
  toolName: string,
  turnId: string | undefined,
  reason: string,
  recoveredResult: ToolResult,
): ToolErrorRecoveredEvent {
  return {
    type: "tool.error.recovered",
    toolName,
    turnId,
    timestamp: Date.now(),
    reason,
    recoveredResult,
  };
}

/**
 * Build a {@link ToolErrorEscalateEvent}.
 */
export function buildToolErrorEscalateEvent(
  toolName: string,
  turnId: string | undefined,
  classification: ToolErrorClassification,
): ToolErrorEscalateEvent {
  return {
    type: "tool.error.escalate",
    toolName,
    turnId,
    timestamp: Date.now(),
    reason: classification.reason,
    errorCode: classification.cause instanceof ToolError ? classification.cause.code : "TOOL_ERROR",
    errorMessage: classification.cause.message,
  };
}

/**
 * Build a {@link ToolErrorStopEvent}.
 */
export function buildToolErrorStopEvent(
  toolName: string,
  turnId: string | undefined,
  classification: ToolErrorClassification,
): ToolErrorStopEvent {
  return {
    type: "tool.error.stop",
    toolName,
    turnId,
    timestamp: Date.now(),
    reason: classification.reason,
    errorCode: classification.cause instanceof ToolError ? classification.cause.code : "TOOL_ERROR",
    errorMessage: classification.cause.message,
  };
}

export function buildToolStartEvent(
  toolName: string,
  correlation: ToolEventCorrelation,
  params: unknown,
): ToolStartEvent {
  return {
    type: "tool.start",
    toolName,
    timestamp: Date.now(),
    params,
    ...correlation,
  };
}

export function buildToolEndEvent(
  toolName: string,
  correlation: ToolEventCorrelation,
  durationMs: number,
): ToolEndEvent {
  return {
    type: "tool.end",
    toolName,
    timestamp: Date.now(),
    durationMs,
    ...correlation,
  };
}

export function buildToolProgressEvent(
  toolName: string,
  correlation: ToolEventCorrelation,
  chunk: string,
  stream: "stdout" | "stderr",
): ToolProgressEvent {
  return {
    type: "tool.progress",
    toolName,
    timestamp: Date.now(),
    chunk,
    stream,
    ...correlation,
  };
}

// ---------------------------------------------------------------------------
// Backoff Calculation (mirrors ADR-036)
// ---------------------------------------------------------------------------

/** Default base delay for exponential backoff in milliseconds. */
export const DEFAULT_TOOL_RETRY_BASE_DELAY_MS = 1_000;

/** Default maximum delay between retries in milliseconds. */
export const DEFAULT_TOOL_RETRY_MAX_DELAY_MS = 30_000;

/** Default maximum retry attempts per tool call. */
export const DEFAULT_TOOL_RETRY_MAX_RETRIES = 3;

/**
 * Compute retry delay in milliseconds for a given attempt.
 *
 * Formula: `min(baseDelayMs * 2^attempt + jitter, maxDelayMs)`
 * Jitter is ±25% of the calculated delay.
 *
 * @param attempt      - Zero-based attempt index.
 * @param baseDelayMs  - Base delay in ms (default: 1 000).
 * @param maxDelayMs   - Upper bound (default: 30 000).
 */
export function computeToolRetryDelay(
  attempt: number,
  baseDelayMs = DEFAULT_TOOL_RETRY_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_TOOL_RETRY_MAX_DELAY_MS,
): number {
  const jitter = (Math.random() - 0.5) * 2 * 0.25 * baseDelayMs * Math.pow(2, attempt);
  const exponential = baseDelayMs * Math.pow(2, attempt);
  return Math.min(Math.max(0, exponential + jitter), maxDelayMs);
}
