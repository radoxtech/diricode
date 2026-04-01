import type { Database } from "better-sqlite3";
import {
  type Message,
  type AppendMessageInput,
  AppendMessageInputSchema,
  MessageSchema,
} from "../schemas/session.js";

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tokens: number;
  cost: number;
  agent_id: string | null;
  timestamp: string;
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as Message["role"],
    content: row.content,
    tokens: row.tokens,
    cost: row.cost,
    agentId: row.agent_id ?? undefined,
    timestamp: row.timestamp,
  };
}

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
}

export class MessageRepository {
  private stmtInsert;
  private stmtGetById;
  private stmtGetBySession;
  private stmtGetBySessionAfterCursor;

  constructor(private readonly db: Database) {
    this.stmtInsert = db.prepare(
      `INSERT INTO messages (id, session_id, role, content, tokens, cost, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    );

    this.stmtGetById = db.prepare("SELECT * FROM messages WHERE id = ?");

    this.stmtGetBySession = db.prepare(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC, id ASC",
    );

    this.stmtGetBySessionAfterCursor = db.prepare(
      `SELECT * FROM messages
       WHERE session_id = ? AND ((timestamp > ?) OR (timestamp = ? AND id > ?))
       ORDER BY timestamp ASC, id ASC LIMIT ?`,
    );
  }

  append(input: AppendMessageInput): Message {
    const parsed = AppendMessageInputSchema.parse(input);
    const row = (this.stmtInsert as { get(...args: unknown[]): MessageRow | undefined }).get(
      parsed.id,
      parsed.sessionId,
      parsed.role,
      parsed.content,
      parsed.tokens ?? 0,
      parsed.cost ?? 0,
      parsed.agentId ?? null,
    );
    if (row === undefined) throw new Error(`Message ${parsed.id} not found after insert`);
    return MessageSchema.parse(rowToMessage(row));
  }

  getById(id: string): Message | undefined {
    const row = (this.stmtGetById as { get(id: string): MessageRow | undefined }).get(id);
    if (!row) return undefined;
    return MessageSchema.parse(rowToMessage(row));
  }

  getBySessionId(sessionId: string): Message[] {
    return (this.stmtGetBySession as { all(sessionId: string): MessageRow[] })
      .all(sessionId)
      .map(rowToMessage);
  }

  getBySessionIdPaginated(
    sessionId: string,
    options?: { cursor?: { lastTimestamp: string; lastId: string }; pageSize?: number },
  ): PaginatedMessages {
    const pageSize = options?.pageSize ?? 50;
    const cursor = options?.cursor;

    let rows: MessageRow[];

    if (cursor) {
      rows = (this.stmtGetBySessionAfterCursor as { all(...args: unknown[]): MessageRow[] }).all(
        sessionId,
        cursor.lastTimestamp,
        cursor.lastTimestamp,
        cursor.lastId,
        pageSize + 1,
      );
    } else {
      const stmt = this.db.prepare(
        "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC, id ASC LIMIT ?",
      );
      rows = (stmt as { all(sessionId: string, limit: number): MessageRow[] }).all(
        sessionId,
        pageSize + 1,
      );
    }

    const hasMore = rows.length > pageSize;
    const messages = rows.slice(0, pageSize).map(rowToMessage);

    return { messages, hasMore };
  }
}
