import type {
  TurnStartEvent,
  TurnEndEvent,
  TurnTimeoutEvent,
  TurnStatus,
  TurnTelemetry,
} from "./turn-types.js";

export function createTurnStartEvent(
  turnId: string,
  sessionId: string,
  inputPreview: string,
): TurnStartEvent {
  return {
    type: "turn.start",
    turnId,
    timestamp: Date.now(),
    sessionId,
    inputPreview,
  };
}

export function createTurnEndEvent(
  turnId: string,
  sessionId: string,
  status: TurnStatus,
  durationMs: number,
  outputSummary: string,
  telemetry: TurnTelemetry,
): TurnEndEvent {
  return {
    type: "turn.end",
    turnId,
    timestamp: Date.now(),
    sessionId,
    status,
    durationMs,
    outputSummary,
    telemetry,
  };
}

export function createTurnTimeoutEvent(
  turnId: string,
  sessionId: string,
  elapsedMs: number,
): TurnTimeoutEvent {
  return {
    type: "turn.timeout",
    turnId,
    timestamp: Date.now(),
    sessionId,
    elapsedMs,
  };
}

export type { TurnStartEvent, TurnEndEvent, TurnTimeoutEvent };
