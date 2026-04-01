import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration005: Migration = {
  version: 5,
  description: "sessions and messages",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          TEXT PRIMARY KEY,
        status      TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created','active','completed','archived')),
        metadata    TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
        content     TEXT NOT NULL,
        tokens      INTEGER NOT NULL DEFAULT 0,
        cost        REAL NOT NULL DEFAULT 0.0,
        agent_id    TEXT,
        timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_time
        ON messages(session_id, timestamp);

      CREATE INDEX IF NOT EXISTS idx_sessions_status
        ON sessions(status);
    `);
  },
};
