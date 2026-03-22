import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration002: Migration = {
  version: 2,
  description: "sessions and messages schema",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          TEXT PRIMARY KEY,
        status      TEXT NOT NULL DEFAULT 'created',
        metadata    TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS session_messages (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        role        TEXT NOT NULL,
        content     TEXT NOT NULL,
        metadata    TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON session_messages(session_id);
    `);
  },
};
