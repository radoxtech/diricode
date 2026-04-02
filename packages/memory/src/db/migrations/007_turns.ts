import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration007: Migration = {
  version: 7,
  description: "turn lifecycle storage",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS turns (
        id              TEXT PRIMARY KEY,
        session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        status          TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed','timeout')),
        started_at      TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at        TEXT,
        duration_ms     INTEGER NOT NULL DEFAULT 0,
        input           TEXT NOT NULL,
        output_summary  TEXT NOT NULL DEFAULT '',
        telemetry       TEXT NOT NULL DEFAULT '{}',
        error           TEXT,
        partial_results TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_turns_session_time
        ON turns(session_id, started_at);

      CREATE INDEX IF NOT EXISTS idx_turns_status
        ON turns(status);
    `);
  },
};
