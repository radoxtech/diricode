import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration008: Migration = {
  version: 8,
  description: "sequential task execution checkpoints",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        execution_id      TEXT NOT NULL,
        turn_id           TEXT NOT NULL,
        session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        plan_id           TEXT NOT NULL,
        task_index        INTEGER NOT NULL,
        completed_tasks   TEXT NOT NULL DEFAULT '[]',
        last_valid_checkpoint_index INTEGER NOT NULL DEFAULT -1,
        status            TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','invalid','partial')),
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (execution_id, task_index)
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoints_session
        ON checkpoints(session_id);

      CREATE INDEX IF NOT EXISTS idx_checkpoints_turn
        ON checkpoints(turn_id);

      CREATE INDEX IF NOT EXISTS idx_checkpoints_plan
        ON checkpoints(plan_id);

      CREATE INDEX IF NOT EXISTS idx_checkpoints_status
        ON checkpoints(status);
    `);
  },
};
