import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration006: Migration = {
  version: 6,
  description: "FTS5 full-text search over messages and observations",
  up(db: Database): void {
    // --- Part 1: Enhance observations table with DC-MEM-003 columns ---
    // These columns are required for FTS filtering by session/agent/task.
    // ALTER TABLE ADD COLUMN is idempotent-safe when wrapped carefully,
    // but SQLite will throw if the column already exists — we use a
    // pragma check approach to be safe.
    const obsCols = (db.pragma("table_info(observations)") as { name: string }[]).map(
      (c) => c.name,
    );
    if (!obsCols.includes("session_id")) {
      db.exec("ALTER TABLE observations ADD COLUMN session_id TEXT");
    }
    if (!obsCols.includes("agent_id")) {
      db.exec("ALTER TABLE observations ADD COLUMN agent_id TEXT");
    }
    if (!obsCols.includes("task_id")) {
      db.exec("ALTER TABLE observations ADD COLUMN task_id TEXT");
    }
    if (!obsCols.includes("timestamp")) {
      db.exec(
        "ALTER TABLE observations ADD COLUMN timestamp TEXT NOT NULL DEFAULT (datetime('now'))",
      );
    }

    // Index for session-scoped observation lookups
    db.exec("CREATE INDEX IF NOT EXISTS idx_observations_session_id ON observations(session_id)");

    // --- Part 2: FTS5 virtual tables (external content) ---

    // observations_fts — indexes observations.content via rowid (= id, INTEGER PK)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
        content,
        content=observations,
        content_rowid=id,
        tokenize='unicode61'
      );
    `);

    // messages_fts — indexes messages.content via implicit rowid
    // (messages uses TEXT PK, so rowid is auto-assigned, not the text id)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content,
        content=messages,
        content_rowid=rowid,
        tokenize='unicode61'
      );
    `);

    // --- Part 3: Sync triggers for observations ---
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS observations_fts_insert AFTER INSERT ON observations BEGIN
        INSERT INTO observations_fts(rowid, content)
        VALUES (new.id, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS observations_fts_delete AFTER DELETE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, content)
        VALUES ('delete', old.id, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS observations_fts_update AFTER UPDATE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, content)
        VALUES ('delete', old.id, old.content);
        INSERT INTO observations_fts(rowid, content)
        VALUES (new.id, new.content);
      END;
    `);

    // --- Part 4: Sync triggers for messages ---
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, content)
        VALUES (new.rowid, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content)
        VALUES ('delete', old.rowid, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content)
        VALUES ('delete', old.rowid, old.content);
        INSERT INTO messages_fts(rowid, content)
        VALUES (new.rowid, new.content);
      END;
    `);

    // --- Part 5: Backfill existing data into FTS indexes ---
    db.exec(`
      INSERT INTO observations_fts(rowid, content)
        SELECT id, content FROM observations WHERE content IS NOT NULL;

      INSERT INTO messages_fts(rowid, content)
        SELECT rowid, content FROM messages WHERE content IS NOT NULL;
    `);
  },
};
