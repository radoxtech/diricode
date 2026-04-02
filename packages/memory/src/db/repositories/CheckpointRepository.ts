import type { Database } from "better-sqlite3";
import type {
  Checkpoint,
  CheckpointStatus,
  CheckpointSummary,
  TaskExecutionResult,
} from "@diricode/core";

interface CheckpointRow {
  execution_id: string;
  turn_id: string;
  session_id: string;
  plan_id: string;
  task_index: number;
  completed_tasks: string;
  last_valid_checkpoint_index: number;
  status: CheckpointStatus;
  created_at: string;
  updated_at: string;
}

export interface CheckpointRecord {
  executionId: string;
  turnId: string;
  sessionId: string;
  planId: string;
  taskIndex: number;
  completedTasks: readonly TaskExecutionResult[];
  lastValidCheckpointIndex: number;
  status: CheckpointStatus;
  createdAt: string;
  updatedAt: string;
}

function rowToRecord(row: CheckpointRow): CheckpointRecord {
  return {
    executionId: row.execution_id,
    turnId: row.turn_id,
    sessionId: row.session_id,
    planId: row.plan_id,
    taskIndex: row.task_index,
    completedTasks: safeParseJson(row.completed_tasks),
    lastValidCheckpointIndex: row.last_valid_checkpoint_index,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParseJson(raw: string): readonly TaskExecutionResult[] {
  try {
    return JSON.parse(raw) as readonly TaskExecutionResult[];
  } catch {
    return [] as const;
  }
}

function recordToCheckpoint(record: CheckpointRecord): Checkpoint {
  return {
    executionId: record.executionId,
    turnId: record.turnId,
    sessionId: record.sessionId,
    planId: record.planId,
    taskIndex: record.taskIndex,
    completedTasks: record.completedTasks,
    lastValidCheckpointIndex: record.lastValidCheckpointIndex,
    status: record.status,
    createdAt: new Date(record.createdAt).getTime(),
    updatedAt: new Date(record.updatedAt).getTime(),
  };
}

export class CheckpointRepository {
  constructor(private readonly db: Database) {}

  upsert(checkpoint: Omit<Checkpoint, "createdAt" | "updatedAt">): Checkpoint {
    this.db
      .prepare<[string, string, string, string, number, string, number, string]>(
        `INSERT INTO checkpoints (
          execution_id, turn_id, session_id, plan_id,
          task_index, completed_tasks, last_valid_checkpoint_index, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(execution_id, task_index) DO UPDATE SET
          completed_tasks = excluded.completed_tasks,
          last_valid_checkpoint_index = excluded.last_valid_checkpoint_index,
          status = excluded.status,
          updated_at = datetime('now')`,
      )
      .run(
        checkpoint.executionId,
        checkpoint.turnId,
        checkpoint.sessionId,
        checkpoint.planId,
        checkpoint.taskIndex,
        JSON.stringify(checkpoint.completedTasks),
        checkpoint.lastValidCheckpointIndex,
        checkpoint.status,
      );

    const record = this.getByExecutionAndIndex(checkpoint.executionId, checkpoint.taskIndex);
    if (!record) throw new Error(`Checkpoint not found after upsert`);
    return recordToCheckpoint(record);
  }

  getByExecutionAndIndex(executionId: string, taskIndex: number): CheckpointRecord | undefined {
    const row = this.db
      .prepare<
        [string, number],
        CheckpointRow
      >("SELECT * FROM checkpoints WHERE execution_id = ? AND task_index = ?")
      .get(executionId, taskIndex);
    return row ? rowToRecord(row) : undefined;
  }

  getLatestByExecution(executionId: string): CheckpointRecord | undefined {
    const row = this.db
      .prepare<
        [string],
        CheckpointRow
      >("SELECT * FROM checkpoints WHERE execution_id = ? ORDER BY task_index DESC LIMIT 1")
      .get(executionId);
    return row ? rowToRecord(row) : undefined;
  }

  getByTurn(turnId: string): CheckpointRecord[] {
    return this.db
      .prepare<
        [string],
        CheckpointRow
      >("SELECT * FROM checkpoints WHERE turn_id = ? ORDER BY task_index ASC")
      .all(turnId)
      .map(rowToRecord);
  }

  getBySession(sessionId: string): CheckpointRecord[] {
    return this.db
      .prepare<
        [string],
        CheckpointRow
      >("SELECT * FROM checkpoints WHERE session_id = ? ORDER BY created_at DESC")
      .all(sessionId)
      .map(rowToRecord);
  }

  getByPlan(planId: string): CheckpointRecord[] {
    return this.db
      .prepare<
        [string],
        CheckpointRow
      >("SELECT * FROM checkpoints WHERE plan_id = ? ORDER BY task_index ASC")
      .all(planId)
      .map(rowToRecord);
  }

  getLatestValidByExecution(executionId: string): CheckpointRecord | undefined {
    const row = this.db
      .prepare<
        [string, string],
        CheckpointRow
      >("SELECT * FROM checkpoints WHERE execution_id = ? AND status = 'valid' ORDER BY task_index DESC LIMIT 1")
      .get(executionId, "valid");
    return row ? rowToRecord(row) : undefined;
  }

  toCheckpointSummary(record: CheckpointRecord, totalTasks: number): CheckpointSummary {
    const completedCount = record.completedTasks.filter((t) => t.success).length;
    const failedCount = record.completedTasks.filter((t) => !t.success).length;
    return {
      executionId: record.executionId,
      turnId: record.turnId,
      sessionId: record.sessionId,
      planId: record.planId,
      lastValidTaskIndex: record.lastValidCheckpointIndex,
      totalTasks,
      completedCount,
      failedCount,
      status: record.status,
      createdAt: new Date(record.createdAt).getTime(),
    };
  }

  toCheckpointSummaryFromCheckpoint(checkpoint: Checkpoint, totalTasks: number): CheckpointSummary {
    const completedCount = checkpoint.completedTasks.filter((t) => t.success).length;
    const failedCount = checkpoint.completedTasks.filter((t) => !t.success).length;
    return {
      executionId: checkpoint.executionId,
      turnId: checkpoint.turnId,
      sessionId: checkpoint.sessionId,
      planId: checkpoint.planId,
      lastValidTaskIndex: checkpoint.lastValidCheckpointIndex,
      totalTasks,
      completedCount,
      failedCount,
      status: checkpoint.status,
      createdAt: checkpoint.createdAt,
    };
  }

  getCheckpointSummary(executionId: string, totalTasks: number): CheckpointSummary | undefined {
    const latest = this.getLatestByExecution(executionId);
    if (!latest) return undefined;
    return this.toCheckpointSummary(latest, totalTasks);
  }
}
