import type {
  TurnStatus,
  TurnStartEvent,
  TurnEndEvent,
  TurnTimeoutEvent,
  TurnTelemetry,
  TurnEnvelopeData,
  TurnPartialResult,
} from "./turn-types.js";

export class TurnEnvelope {
  private readonly _turnId: string;
  private readonly _sessionId: string;
  private readonly _input: string;
  private readonly _timeoutMs: number;
  private _startedAt: number = 0;
  private _endedAt: number = 0;
  private _status: TurnStatus = "running";
  private _outputSummary: string = "";
  private _telemetry: TurnTelemetry = {
    totalTokens: 0,
    totalToolCalls: 0,
    totalCost: 0,
  };
  private _error: string | undefined;
  private _partialResults: TurnPartialResult[] = [];

  constructor(turnId: string, sessionId: string, input: string, timeoutMs: number) {
    this._turnId = turnId;
    this._sessionId = sessionId;
    this._input = input;
    this._timeoutMs = timeoutMs;
  }

  start(): TurnStartEvent {
    this._startedAt = Date.now();
    this._status = "running";
    return {
      type: "turn.start",
      turnId: this._turnId,
      timestamp: this._startedAt,
      sessionId: this._sessionId,
      inputPreview: this._input.slice(0, 200),
    };
  }

  end(status: TurnStatus, outputSummary: string, telemetry: TurnTelemetry): TurnEndEvent {
    this._endedAt = Date.now();
    this._status = status;
    this._outputSummary = outputSummary;
    this._telemetry = telemetry;
    return {
      type: "turn.end",
      turnId: this._turnId,
      timestamp: this._endedAt,
      sessionId: this._sessionId,
      status,
      durationMs: this._endedAt - this._startedAt,
      outputSummary,
      telemetry,
    };
  }

  timeout(): TurnTimeoutEvent {
    const now = Date.now();
    this._status = "timeout";
    return {
      type: "turn.timeout",
      turnId: this._turnId,
      timestamp: now,
      sessionId: this._sessionId,
      elapsedMs: now - this._startedAt,
    };
  }

  capturePartial(agentName: string, toolCalls: number, tokensUsed: number, output: string): void {
    this._partialResults.push({ agentName, toolCalls, tokensUsed, output });
  }

  getElapsedMs(): number {
    return Date.now() - this._startedAt;
  }

  toEnvelope(): TurnEnvelopeData {
    const endedAt = this._endedAt > 0 ? this._endedAt : Date.now();
    return {
      turnId: this._turnId,
      sessionId: this._sessionId,
      status: this._status,
      startedAt: this._startedAt,
      endedAt,
      durationMs: endedAt - this._startedAt,
      input: this._input,
      outputSummary: this._outputSummary,
      telemetry: this._telemetry,
      error: this._error,
      partialResults: this._partialResults.length > 0 ? [...this._partialResults] : undefined,
    };
  }

  get timeoutMs(): number {
    return this._timeoutMs;
  }
}
