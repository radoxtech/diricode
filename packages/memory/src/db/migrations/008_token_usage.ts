import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration008: Migration = {
  version: 8,
  description: "token usage tracking",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS token_usage (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        turn_id     TEXT,
        agent_id    TEXT,
        model       TEXT NOT NULL,
        provider    TEXT,
        tokens_in   INTEGER NOT NULL DEFAULT 0,
        tokens_out  INTEGER NOT NULL DEFAULT 0,
        cost_usd    REAL NOT NULL DEFAULT 0.0,
        timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_token_usage_session_time
        ON token_usage(session_id, timestamp);

      CREATE INDEX IF NOT EXISTS idx_token_usage_turn
        ON token_usage(turn_id);

      CREATE INDEX IF NOT EXISTS idx_token_usage_model
        ON token_usage(model);

      CREATE INDEX IF NOT EXISTS idx_token_usage_agent
        ON token_usage(agent_id);
    `);
  },
};
