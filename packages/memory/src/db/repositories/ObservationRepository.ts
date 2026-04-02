import type { Database } from "better-sqlite3";
import {
  type Observation,
  type ObservationType,
  ObservationSchema,
  CreateObservationInputSchema,
  type CreateObservationInput,
} from "../schemas/search.js";

interface ObservationRow {
  id: number;
  type: ObservationType;
  content: string;
  metadata: string;
  created_at: string;
  session_id: string | null;
  agent_id: string | null;
  task_id: string | null;
  timestamp: string | null;
}

function rowToObservation(row: ObservationRow): Observation {
  return ObservationSchema.parse({
    id: row.id,
    type: row.type,
    content: row.content,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    sessionId: row.session_id,
    agentId: row.agent_id,
    taskId: row.task_id,
    timestamp: row.timestamp,
  });
}

export interface TimelineFilter {
  sessionId?: string;
  agentId?: string;
  taskId?: string;
  type?: ObservationType;
  fromTimestamp?: string;
  toTimestamp?: string;
}

export class ObservationRepository {
  private readonly stmtInsert;

  constructor(private readonly db: Database) {
    this.stmtInsert = db.prepare<
      [string, string, string, string | null, string | null, string | null, string | null],
      ObservationRow
    >(
      `INSERT INTO observations (type, content, metadata, session_id, agent_id, task_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
       RETURNING *`,
    );
  }

  appendObservation(input: CreateObservationInput): Observation {
    const parsed = CreateObservationInputSchema.parse(input);
    const row = this.stmtInsert.get(
      parsed.type,
      parsed.content,
      JSON.stringify(parsed.metadata ?? {}),
      parsed.sessionId ?? null,
      parsed.agentId ?? null,
      parsed.taskId ?? null,
      parsed.timestamp ?? null,
    );
    if (!row) throw new Error("Observation not found after insert");
    return rowToObservation(row);
  }

  getTimeline(filter: TimelineFilter = {}): Observation[] {
    const conditions: string[] = [];
    const params: (string | null)[] = [];

    if (filter.sessionId !== undefined) {
      conditions.push("session_id = ?");
      params.push(filter.sessionId);
    }
    if (filter.agentId !== undefined) {
      conditions.push("agent_id = ?");
      params.push(filter.agentId);
    }
    if (filter.taskId !== undefined) {
      conditions.push("task_id = ?");
      params.push(filter.taskId);
    }
    if (filter.type !== undefined) {
      conditions.push("type = ?");
      params.push(filter.type);
    }
    if (filter.fromTimestamp !== undefined) {
      conditions.push("timestamp >= ?");
      params.push(filter.fromTimestamp);
    }
    if (filter.toTimestamp !== undefined) {
      conditions.push("timestamp <= ?");
      params.push(filter.toTimestamp);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM observations ${where} ORDER BY created_at ASC`;
    const stmt = this.db.prepare<(string | null)[], ObservationRow>(sql);
    const rows = stmt.all(...params);
    return rows.map(rowToObservation);
  }
}
