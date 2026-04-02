import type { Database } from "better-sqlite3";
import { type TurnEnvelopeData, TurnEnvelopeDataSchema, type TurnEvent } from "../schemas/turn.js";

interface TurnRow {
  id: string;
  session_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number;
  input: string;
  output_summary: string;
  telemetry: string;
  error: string | null;
  partial_results: string;
}

function rowToTurnEnvelope(row: TurnRow): TurnEnvelopeData {
  return TurnEnvelopeDataSchema.parse({
    turnId: row.id,
    sessionId: row.session_id,
    status: row.status,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
    durationMs: row.duration_ms,
    input: row.input,
    outputSummary: row.output_summary,
    telemetry: TurnEnvelopeDataSchema.shape.telemetry.parse(JSON.parse(row.telemetry)),
    error: row.error ?? undefined,
    partialResults: TurnEnvelopeDataSchema.shape.partialResults.parse(
      JSON.parse(row.partial_results),
    ),
  });
}

export class TurnRepository {
  private readonly stmtInsert;
  private readonly stmtGetById;
  private readonly stmtUpdate;
  private readonly stmtListBySession;

  constructor(private readonly db: Database) {
    this.stmtInsert = db.prepare<[string, string, number, string], TurnRow>(
      `INSERT INTO turns (id, session_id, status, duration_ms, input)
       VALUES (?, ?, 'running', ?, ?) RETURNING *`,
    );
    this.stmtGetById = db.prepare<[string], TurnRow>("SELECT * FROM turns WHERE id = ?");
    this.stmtUpdate = db.prepare<
      [string, number, string, string, string | null, string, string],
      TurnRow
    >(
      `UPDATE turns SET
         status = ?, ended_at = datetime('now'), duration_ms = ?,
         output_summary = ?, telemetry = ?, error = ?, partial_results = ?
       WHERE id = ?
       RETURNING *`,
    );
    this.stmtListBySession = db.prepare<[string], TurnRow>(
      "SELECT * FROM turns WHERE session_id = ? ORDER BY started_at ASC",
    );
  }

  create(turn: TurnEnvelopeData): TurnEnvelopeData {
    const row = this.stmtInsert.get(turn.turnId, turn.sessionId, turn.durationMs, turn.input);
    if (!row) throw new Error(`Turn ${turn.turnId} not found after insert`);
    return rowToTurnEnvelope(row);
  }

  getById(turnId: string): TurnEnvelopeData | undefined {
    const row = this.stmtGetById.get(turnId);
    if (!row) return undefined;
    return rowToTurnEnvelope(row);
  }

  complete(
    turnId: string,
    status: string,
    outputSummary: string,
    telemetry: Record<string, unknown>,
    error?: string,
    partialResults?: Record<string, unknown>[],
  ): TurnEnvelopeData | undefined {
    const row = this.stmtUpdate.get(
      status,
      0,
      outputSummary,
      JSON.stringify(telemetry),
      error ?? null,
      JSON.stringify(partialResults ?? []),
      turnId,
    );
    if (!row) return undefined;
    return rowToTurnEnvelope(row);
  }

  listBySession(sessionId: string): TurnEnvelopeData[] {
    return this.stmtListBySession.all(sessionId).map(rowToTurnEnvelope);
  }
}

export type { TurnEvent };
