import type { Database } from "better-sqlite3";

export type BackgroundTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type AgentTier = "heavy" | "medium" | "light";
export type TaskPriority = "low" | "normal" | "high";

export interface TaskPayload {
  description: string;
  files?: string[];
  [key: string]: unknown;
}

export interface ContextSnapshot {
  mode: "isolated" | "summary" | "full";
  includeFiles?: string[];
  requirements?: string[];
  [key: string]: unknown;
}

export interface ResultPayload {
  output: string;
  toolCalls: number;
  tokensUsed: number;
  findings?: unknown;
}

export interface ErrorDetails {
  code: string;
  message: string;
  stack?: string;
}

export interface BackgroundTaskRecord {
  jobId: string;
  parentExecutionId: string;
  parentAgentName: string;
  childAgentName: string;
  agentTier: AgentTier;
  status: BackgroundTaskStatus;
  taskPayload: TaskPayload;
  contextSnapshot: ContextSnapshot;
  resultPayload?: ResultPayload;
  errorDetails?: ErrorDetails;
  toolAllowlist: string[];
  worktreePath?: string;
  sessionId: string;
  workspaceRoot: string;
  priority: TaskPriority;
  progress: number;
  statusMessage?: string;
  estimatedCompletion?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface BackgroundTaskRow {
  job_id: string;
  parent_execution_id: string;
  parent_agent_name: string;
  child_agent_name: string;
  agent_tier: AgentTier;
  status: BackgroundTaskStatus;
  task_payload: string;
  context_snapshot: string;
  result_payload: string | null;
  error_details: string | null;
  tool_allowlist: string;
  worktree_path: string | null;
  session_id: string;
  workspace_root: string;
  priority: TaskPriority;
  progress: number;
  status_message: string | null;
  estimated_completion: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function rowToRecord(row: BackgroundTaskRow): BackgroundTaskRecord {
  return {
    jobId: row.job_id,
    parentExecutionId: row.parent_execution_id,
    parentAgentName: row.parent_agent_name,
    childAgentName: row.child_agent_name,
    agentTier: row.agent_tier,
    status: row.status,
    taskPayload: JSON.parse(row.task_payload) as TaskPayload,
    contextSnapshot: JSON.parse(row.context_snapshot) as ContextSnapshot,
    resultPayload: safeParseJson(row.result_payload) as ResultPayload | undefined,
    errorDetails: safeParseJson(row.error_details) as ErrorDetails | undefined,
    toolAllowlist: (safeParseJson(row.tool_allowlist) as string[] | undefined) ?? [],
    worktreePath: row.worktree_path ?? undefined,
    sessionId: row.session_id,
    workspaceRoot: row.workspace_root,
    priority: row.priority,
    progress: row.progress,
    statusMessage: row.status_message ?? undefined,
    estimatedCompletion: row.estimated_completion ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
  };
}

export class BackgroundTaskRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new background task record.
   */
  create(record: Omit<BackgroundTaskRecord, "createdAt" | "progress">): BackgroundTaskRecord {
    this.db
      .prepare(
        `INSERT INTO background_tasks (
          job_id, parent_execution_id, parent_agent_name, child_agent_name,
          agent_tier, status, task_payload, context_snapshot, tool_allowlist,
          worktree_path, session_id, workspace_root, priority, progress
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.jobId,
        record.parentExecutionId,
        record.parentAgentName,
        record.childAgentName,
        record.agentTier,
        record.status,
        JSON.stringify(record.taskPayload),
        JSON.stringify(record.contextSnapshot),
        JSON.stringify(record.toolAllowlist),
        record.worktreePath ?? null,
        record.sessionId,
        record.workspaceRoot,
        record.priority,
        0,
      );

    const result = this.getById(record.jobId);
    if (!result) throw new Error(`Background task ${record.jobId} not found after insert`);
    return result;
  }

  /**
   * Get a background task by ID.
   */
  getById(jobId: string): BackgroundTaskRecord | undefined {
    const row = this.db
      .prepare<[string], BackgroundTaskRow>("SELECT * FROM background_tasks WHERE job_id = ?")
      .get(jobId);
    return row ? rowToRecord(row) : undefined;
  }

  /**
   * Get all background tasks for a parent execution.
   */
  getByParentExecutionId(parentExecutionId: string): BackgroundTaskRecord[] {
    return this.db
      .prepare<
        [string],
        BackgroundTaskRow
      >("SELECT * FROM background_tasks WHERE parent_execution_id = ? ORDER BY created_at ASC")
      .all(parentExecutionId)
      .map(rowToRecord);
  }

  /**
   * Get all background tasks for a session.
   */
  getBySessionId(sessionId: string): BackgroundTaskRecord[] {
    return this.db
      .prepare<
        [string],
        BackgroundTaskRow
      >("SELECT * FROM background_tasks WHERE session_id = ? ORDER BY created_at ASC")
      .all(sessionId)
      .map(rowToRecord);
  }

  /**
   * Get all active (pending or running) background tasks.
   */
  getActive(): BackgroundTaskRecord[] {
    return this.db
      .prepare<[], BackgroundTaskRow>(
        `SELECT * FROM background_tasks 
         WHERE status IN ('pending', 'running')
         ORDER BY 
           CASE priority
             WHEN 'high' THEN 1
             WHEN 'normal' THEN 2
             WHEN 'low' THEN 3
           END,
           created_at ASC`,
      )
      .all()
      .map(rowToRecord);
  }

  /**
   * Update task status.
   */
  updateStatus(jobId: string, status: BackgroundTaskStatus): void {
    this.db
      .prepare<
        [string, string]
      >("UPDATE background_tasks SET status = ?, updated_at = datetime('now') WHERE job_id = ?")
      .run(status, jobId);
  }

  /**
   * Mark task as running with started timestamp.
   */
  markRunning(jobId: string): void {
    this.db
      .prepare<[string, string]>(
        `UPDATE background_tasks 
         SET status = ?, started_at = datetime('now'), updated_at = datetime('now') 
         WHERE job_id = ?`,
      )
      .run("running", jobId);
  }

  /**
   * Mark task as completed with result.
   */
  markCompleted(jobId: string, result: ResultPayload): void {
    this.db
      .prepare<[string, string, string]>(
        `UPDATE background_tasks 
         SET status = ?, result_payload = ?, completed_at = datetime('now'), updated_at = datetime('now') 
         WHERE job_id = ?`,
      )
      .run("completed", JSON.stringify(result), jobId);
  }

  /**
   * Mark task as failed with error details.
   */
  markFailed(jobId: string, error: ErrorDetails): void {
    this.db
      .prepare<[string, string, string]>(
        `UPDATE background_tasks 
         SET status = ?, error_details = ?, completed_at = datetime('now'), updated_at = datetime('now') 
         WHERE job_id = ?`,
      )
      .run("failed", JSON.stringify(error), jobId);
  }

  /**
   * Mark task as cancelled.
   */
  markCancelled(jobId: string): void {
    this.db
      .prepare<[string]>(
        `UPDATE background_tasks 
         SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now') 
         WHERE job_id = ?`,
      )
      .run(jobId);
  }

  /**
   * Update task progress and optional status message.
   */
  updateProgress(jobId: string, progress: number, statusMessage?: string): void {
    if (statusMessage) {
      this.db
        .prepare<[number, string, string]>(
          `UPDATE background_tasks 
           SET progress = ?, status_message = ?, updated_at = datetime('now') 
           WHERE job_id = ?`,
        )
        .run(progress, statusMessage, jobId);
    } else {
      this.db
        .prepare<[number, string]>(
          `UPDATE background_tasks 
           SET progress = ?, updated_at = datetime('now') 
           WHERE job_id = ?`,
        )
        .run(progress, jobId);
    }
  }

  /**
   * Set estimated completion time.
   */
  setEstimatedCompletion(jobId: string, estimatedCompletion: string): void {
    this.db
      .prepare<[string, string]>(
        `UPDATE background_tasks 
         SET estimated_completion = ?, updated_at = datetime('now') 
         WHERE job_id = ?`,
      )
      .run(estimatedCompletion, jobId);
  }

  /**
   * Get count of tasks by status for a parent execution.
   */
  getStatusCounts(parentExecutionId: string): Record<BackgroundTaskStatus, number> {
    const rows = this.db
      .prepare<[string], { status: BackgroundTaskStatus; count: number }>(
        `SELECT status, COUNT(*) as count 
         FROM background_tasks 
         WHERE parent_execution_id = ? 
         GROUP BY status`,
      )
      .all(parentExecutionId);

    const counts: Record<BackgroundTaskStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const row of rows) {
      counts[row.status] = row.count;
    }

    return counts;
  }
}
