import type { Database } from "better-sqlite3";
import {
  type Session,
  type SessionStatus,
  type CreateSessionInput,
  CreateSessionInputSchema,
  SessionSchema,
  isValidTransition,
  InvalidSessionTransition,
} from "../schemas/session.js";

interface SessionRow {
  id: string;
  status: SessionStatus;
  metadata: string;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    status: row.status,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListSessionsFilter {
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}

export class SessionRepository {
  private readonly stmtInsert;
  private readonly stmtGetById;
  private readonly stmtUpdateStatus;
  private readonly stmtUpdateMetadata;
  private readonly stmtListAll;
  private readonly stmtListByStatus;

  constructor(private readonly db: Database) {
    this.stmtInsert = db.prepare<[string, string], SessionRow>(
      `INSERT INTO sessions (id, status, metadata) VALUES (?, 'created', ?) RETURNING *`,
    );

    this.stmtGetById = db.prepare<[string], SessionRow>("SELECT * FROM sessions WHERE id = ?");

    this.stmtUpdateStatus = db.prepare<[string, string]>(
      "UPDATE sessions SET status = ?, updated_at = datetime('now') WHERE id = ?",
    );

    this.stmtUpdateMetadata = db.prepare<[string, string]>(
      "UPDATE sessions SET metadata = ?, updated_at = datetime('now') WHERE id = ?",
    );

    this.stmtListAll = db.prepare<[], SessionRow>("SELECT * FROM sessions ORDER BY created_at ASC");

    this.stmtListByStatus = db.prepare<[string], SessionRow>(
      "SELECT * FROM sessions WHERE status = ? ORDER BY created_at ASC",
    );
  }

  create(input: CreateSessionInput): Session {
    const parsed = CreateSessionInputSchema.parse(input);
    const row = this.stmtInsert.get(parsed.id, JSON.stringify(parsed.metadata ?? {}));
    if (!row) throw new Error(`Session ${parsed.id} not found after insert`);
    const session = rowToSession(row);
    return SessionSchema.parse(session);
  }

  getById(id: string): Session | undefined {
    const row = this.stmtGetById.get(id);
    if (!row) return undefined;
    return SessionSchema.parse(rowToSession(row));
  }

  updateStatus(id: string, newStatus: SessionStatus): void {
    const current = this.getById(id);
    if (!current) throw new Error(`Session ${id} not found`);
    if (!isValidTransition(current.status, newStatus)) {
      throw new InvalidSessionTransition(current.status, newStatus);
    }
    this.stmtUpdateStatus.run(newStatus, id);
  }

  updateMetadata(id: string, metadata: Record<string, unknown>): void {
    this.stmtUpdateMetadata.run(JSON.stringify(metadata), id);
  }

  list(filter?: ListSessionsFilter): Session[] {
    let rows: SessionRow[];

    if (filter?.status) {
      rows = this.stmtListByStatus.all(filter.status);
    } else {
      rows = this.stmtListAll.all();
    }

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? rows.length;
    return rows.slice(offset, offset + limit).map(rowToSession);
  }
}
