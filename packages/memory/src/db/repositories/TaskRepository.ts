import type { Database } from "better-sqlite3";

export type TaskStatus = "pending" | "in-progress" | "completed" | "blocked" | "failed";

interface TaskRow {
  id: string;
  session_id: string | null;
  agent_name: string | null;
  description: string;
  status: TaskStatus;
  blocked_by: string;
  blocking: string;
  created_at: string;
  updated_at: string;
}

export interface TaskRecord {
  id: string;
  sessionId: string | null;
  agentName: string | null;
  description: string;
  status: TaskStatus;
  blockedBy: string[];
  blocking: string[];
  createdAt: string;
  updatedAt: string;
}

function rowToRecord(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    agentName: row.agent_name,
    description: row.description,
    status: row.status,
    blockedBy: safeParseJson(row.blocked_by),
    blocking: safeParseJson(row.blocking),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParseJson(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export class TaskRepository {
  constructor(private readonly db: Database) {}

  upsert(task: Omit<TaskRecord, "createdAt" | "updatedAt">): TaskRecord {
    this.db
      .prepare<[string, string | null, string | null, string, string, string, string]>(
        `INSERT INTO tasks (id, session_id, agent_name, description, status, blocked_by, blocking)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status      = excluded.status,
           blocked_by  = excluded.blocked_by,
           blocking    = excluded.blocking,
           agent_name  = excluded.agent_name,
           updated_at  = datetime('now')`,
      )
      .run(
        task.id,
        task.sessionId,
        task.agentName,
        task.description,
        task.status,
        JSON.stringify(task.blockedBy),
        JSON.stringify(task.blocking),
      );

    return this.getById(task.id) as TaskRecord;
  }

  getById(id: string): TaskRecord | undefined {
    const row = this.db.prepare<[string], TaskRow>("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ? rowToRecord(row) : undefined;
  }

  getBySession(sessionId: string): TaskRecord[] {
    return this.db
      .prepare<
        [string],
        TaskRow
      >("SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC")
      .all(sessionId)
      .map(rowToRecord);
  }

  updateStatus(id: string, status: TaskStatus): void {
    this.db
      .prepare<
        [string, string]
      >("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
  }

  getReadyTasks(sessionId: string): TaskRecord[] {
    const tasks = this.getBySession(sessionId);
    const completedIds = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));

    return tasks.filter(
      (t) => t.status === "pending" && t.blockedBy.every((depId) => completedIds.has(depId)),
    );
  }

  addDependency(upstreamId: string, downstreamId: string, sessionId?: string): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare<[string, string, string | null]>(
          `INSERT OR IGNORE INTO task_dependencies (upstream_task_id, downstream_task_id, session_id)
           VALUES (?, ?, ?)`,
        )
        .run(upstreamId, downstreamId, sessionId ?? null);

      const upstream = this.getById(upstreamId);
      if (upstream) {
        const blocking = [...new Set([...upstream.blocking, downstreamId])];
        this.db
          .prepare<
            [string, string]
          >("UPDATE tasks SET blocking = ?, updated_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify(blocking), upstreamId);
      }

      const downstream = this.getById(downstreamId);
      if (downstream) {
        const blockedBy = [...new Set([...downstream.blockedBy, upstreamId])];
        this.db
          .prepare<
            [string, string]
          >("UPDATE tasks SET blocked_by = ?, updated_at = datetime('now') WHERE id = ?")
          .run(JSON.stringify(blockedBy), downstreamId);
      }
    });

    tx();
  }
}
