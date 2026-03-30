import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration004: Migration = {
  version: 4,
  description: "background_tasks: async subagent execution with parent/child tracking",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS background_tasks (
        job_id              TEXT PRIMARY KEY,
        parent_execution_id TEXT NOT NULL,
        parent_agent_name   TEXT NOT NULL,
        child_agent_name    TEXT NOT NULL,
        agent_tier          TEXT NOT NULL
                            CHECK(agent_tier IN ('heavy', 'medium', 'light')),
        status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        task_payload        TEXT NOT NULL,
        context_snapshot    TEXT NOT NULL,
        result_payload      TEXT,
        error_details       TEXT,
        tool_allowlist      TEXT,
        worktree_path       TEXT,
        session_id          TEXT NOT NULL,
        workspace_root      TEXT NOT NULL,
        priority            TEXT NOT NULL DEFAULT 'normal'
                            CHECK(priority IN ('low', 'normal', 'high')),
        progress            INTEGER DEFAULT 0
                            CHECK(progress >= 0 AND progress <= 100),
        status_message      TEXT,
        estimated_completion TEXT,
        started_at          TEXT,
        completed_at        TEXT,
        created_at          TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_bg_tasks_parent_exec ON background_tasks(parent_execution_id);
      CREATE INDEX IF NOT EXISTS idx_bg_tasks_session ON background_tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_bg_tasks_status ON background_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_bg_tasks_agent ON background_tasks(child_agent_name);
      CREATE INDEX IF NOT EXISTS idx_bg_tasks_created ON background_tasks(created_at);

      -- View for active background tasks (pending or running)
      CREATE VIEW IF NOT EXISTS active_background_tasks AS
        SELECT * FROM background_tasks
        WHERE status IN ('pending', 'running')
        ORDER BY 
          CASE priority
            WHEN 'high' THEN 1
            WHEN 'normal' THEN 2
            WHEN 'low' THEN 3
          END,
          created_at ASC;

      -- View for completed background tasks
      CREATE VIEW IF NOT EXISTS completed_background_tasks AS
        SELECT * FROM background_tasks
        WHERE status IN ('completed', 'failed', 'cancelled')
        ORDER BY completed_at DESC;
    `);
  },
};
