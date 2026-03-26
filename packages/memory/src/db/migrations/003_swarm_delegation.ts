import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration003: Migration = {
  version: 3,
  description: "swarm_delegation: tasks, task_dependencies, context_bus",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          TEXT PRIMARY KEY,
        session_id  TEXT,
        agent_name  TEXT,
        description TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'in-progress', 'completed', 'blocked', 'failed')),
        blocked_by  TEXT NOT NULL DEFAULT '[]',
        blocking    TEXT NOT NULL DEFAULT '[]',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

      CREATE TABLE IF NOT EXISTS task_dependencies (
        upstream_task_id   TEXT NOT NULL,
        downstream_task_id TEXT NOT NULL,
        session_id         TEXT,
        created_at         TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (upstream_task_id, downstream_task_id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_deps_upstream ON task_dependencies(upstream_task_id);
      CREATE INDEX IF NOT EXISTS idx_task_deps_downstream ON task_dependencies(downstream_task_id);

      CREATE TABLE IF NOT EXISTS context_bus (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        agent_id   TEXT NOT NULL,
        fact       TEXT NOT NULL,
        timestamp  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_context_bus_session ON context_bus(session_id);
      CREATE INDEX IF NOT EXISTS idx_context_bus_agent ON context_bus(agent_id);
    `);
  },
};
