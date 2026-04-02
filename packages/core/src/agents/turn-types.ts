import type { CorrelationContext } from "../observability/correlation.js";

export type TurnStatus = "running" | "completed" | "failed" | "timeout";

export interface TurnStartEvent {
  type: "turn.start";
  turnId: string;
  timestamp: number;
  sessionId: string;
  inputPreview: string;
  correlation?: CorrelationContext;
}

export interface TurnEndEvent {
  type: "turn.end";
  turnId: string;
  timestamp: number;
  sessionId: string;
  status: TurnStatus;
  durationMs: number;
  outputSummary: string;
  telemetry: TurnTelemetry;
  correlation?: CorrelationContext;
}

export interface TurnTimeoutEvent {
  type: "turn.timeout";
  turnId: string;
  timestamp: number;
  sessionId: string;
  elapsedMs: number;
  correlation?: CorrelationContext;
}

export interface TurnTelemetry {
  totalTokens: number;
  totalToolCalls: number;
  totalCost: number;
  agentName?: string;
  modelUsed?: string;
  executionId?: string;
}

export interface TurnEnvelopeData {
  turnId: string;
  sessionId: string;
  status: TurnStatus;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  input: string;
  outputSummary: string;
  telemetry: TurnTelemetry;
  error?: string;
  partialResults?: TurnPartialResult[];
}

export interface TurnPartialResult {
  agentName: string;
  toolCalls: number;
  tokensUsed: number;
  output: string;
}
