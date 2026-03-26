import type { Database } from "better-sqlite3";

interface ContextBusRow {
  id: number;
  session_id: string;
  agent_id: string;
  fact: string;
  timestamp: string;
}

export interface ContextBusEntry {
  id: number;
  sessionId: string;
  agentId: string;
  fact: string;
  timestamp: string;
}

function rowToEntry(row: ContextBusRow): ContextBusEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    agentId: row.agent_id,
    fact: row.fact,
    timestamp: row.timestamp,
  };
}

export class ContextBusRepository {
  constructor(private readonly db: Database) {}

  broadcast(sessionId: string, agentId: string, fact: string): ContextBusEntry {
    const result = this.db
      .prepare<[string, string, string]>(
        `INSERT INTO context_bus (session_id, agent_id, fact)
         VALUES (?, ?, ?)
         RETURNING *`,
      )
      .get(sessionId, agentId, fact) as ContextBusRow;

    return rowToEntry(result);
  }

  getBySession(sessionId: string): ContextBusEntry[] {
    return this.db
      .prepare<
        [string],
        ContextBusRow
      >("SELECT * FROM context_bus WHERE session_id = ? ORDER BY id ASC")
      .all(sessionId)
      .map(rowToEntry);
  }

  getByAgent(sessionId: string, agentId: string): ContextBusEntry[] {
    return this.db
      .prepare<
        [string, string],
        ContextBusRow
      >("SELECT * FROM context_bus WHERE session_id = ? AND agent_id = ? ORDER BY id ASC")
      .all(sessionId, agentId)
      .map(rowToEntry);
  }

  getSince(sessionId: string, afterId: number): ContextBusEntry[] {
    return this.db
      .prepare<
        [string, number],
        ContextBusRow
      >("SELECT * FROM context_bus WHERE session_id = ? AND id > ? ORDER BY id ASC")
      .all(sessionId, afterId)
      .map(rowToEntry);
  }
}
