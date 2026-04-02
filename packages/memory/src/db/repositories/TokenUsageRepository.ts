import type { Database } from "better-sqlite3";
import {
  type TokenUsage,
  type RecordTokenUsageInput,
  type SessionUsageSummary,
  type ModelUsageBreakdown,
  type AgentUsageSummary,
  RecordTokenUsageInputSchema,
  TokenUsageSchema,
  SessionUsageSummarySchema,
  ModelUsageBreakdownSchema,
  AgentUsageSummarySchema,
} from "../schemas/token-usage.js";

interface TokenUsageRow {
  id: string;
  session_id: string;
  turn_id: string | null;
  agent_id: string | null;
  model: string;
  provider: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  timestamp: string;
}

interface SummaryRow {
  session_id: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  record_count: number;
}

interface ModelBreakdownRow {
  model: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  record_count: number;
}

interface AgentSummaryRow {
  agent_id: string | null;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_usd: number;
  record_count: number;
}

function rowToTokenUsage(row: TokenUsageRow): TokenUsage {
  return {
    id: row.id,
    sessionId: row.session_id,
    turnId: row.turn_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    model: row.model,
    provider: row.provider ?? undefined,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
    timestamp: row.timestamp,
  };
}

function rowToSessionSummary(row: SummaryRow): SessionUsageSummary {
  return {
    sessionId: row.session_id,
    totalTokensIn: row.total_tokens_in,
    totalTokensOut: row.total_tokens_out,
    totalCostUsd: row.total_cost_usd,
    recordCount: row.record_count,
  };
}

function rowToModelBreakdown(row: ModelBreakdownRow): ModelUsageBreakdown {
  return {
    model: row.model,
    totalTokensIn: row.total_tokens_in,
    totalTokensOut: row.total_tokens_out,
    totalCostUsd: row.total_cost_usd,
    recordCount: row.record_count,
  };
}

function rowToAgentSummary(row: AgentSummaryRow): AgentUsageSummary {
  return {
    agentId: row.agent_id,
    totalTokensIn: row.total_tokens_in,
    totalTokensOut: row.total_tokens_out,
    totalCostUsd: row.total_cost_usd,
    recordCount: row.record_count,
  };
}

export class TokenUsageRepository {
  private readonly stmtInsert;
  private readonly stmtGetById;
  private readonly stmtGetBySession;
  private readonly stmtGetByTurn;
  private readonly stmtSessionTotals;
  private readonly stmtAgentTotals;
  private readonly stmtModelBreakdown;
  private readonly stmtByTimeRange;
  private readonly stmtBudgetCheck;

  constructor(private readonly db: Database) {
    this.stmtInsert = db.prepare(
      `INSERT INTO token_usage (id, session_id, turn_id, agent_id, model, provider, tokens_in, tokens_out, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    );

    this.stmtGetById = db.prepare("SELECT * FROM token_usage WHERE id = ?");

    this.stmtGetBySession = db.prepare(
      "SELECT * FROM token_usage WHERE session_id = ? ORDER BY timestamp ASC",
    );

    this.stmtGetByTurn = db.prepare(
      "SELECT * FROM token_usage WHERE turn_id = ? ORDER BY timestamp ASC",
    );

    this.stmtSessionTotals = db.prepare(
      `SELECT session_id,
              COALESCE(SUM(tokens_in), 0)  AS total_tokens_in,
              COALESCE(SUM(tokens_out), 0) AS total_tokens_out,
              COALESCE(SUM(cost_usd), 0)   AS total_cost_usd,
              COUNT(*)                    AS record_count
       FROM token_usage
       WHERE session_id = ?
       GROUP BY session_id`,
    );

    this.stmtAgentTotals = db.prepare(
      `SELECT agent_id,
              COALESCE(SUM(tokens_in), 0)  AS total_tokens_in,
              COALESCE(SUM(tokens_out), 0) AS total_tokens_out,
              COALESCE(SUM(cost_usd), 0)   AS total_cost_usd,
              COUNT(*)                    AS record_count
       FROM token_usage
       WHERE session_id = ? AND agent_id = ?
       GROUP BY agent_id`,
    );

    this.stmtModelBreakdown = db.prepare(
      `SELECT model,
              COALESCE(SUM(tokens_in), 0)  AS total_tokens_in,
              COALESCE(SUM(tokens_out), 0) AS total_tokens_out,
              COALESCE(SUM(cost_usd), 0)   AS total_cost_usd,
              COUNT(*)                    AS record_count
       FROM token_usage
       WHERE session_id = ?
       GROUP BY model
       ORDER BY total_cost_usd DESC`,
    );

    this.stmtByTimeRange = db.prepare(
      `SELECT * FROM token_usage
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`,
    );

    this.stmtBudgetCheck = db.prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total_cost_usd
       FROM token_usage
       WHERE session_id = ?`,
    );
  }

  record(input: RecordTokenUsageInput): TokenUsage {
    const parsed = RecordTokenUsageInputSchema.parse(input);
    const row = (this.stmtInsert as { get(...args: unknown[]): TokenUsageRow | undefined }).get(
      parsed.id,
      parsed.sessionId,
      parsed.turnId ?? null,
      parsed.agentId ?? null,
      parsed.model,
      parsed.provider ?? null,
      parsed.tokensIn,
      parsed.tokensOut,
      parsed.costUsd,
    );
    if (row === undefined) throw new Error(`TokenUsage ${parsed.id} not found after insert`);
    return TokenUsageSchema.parse(rowToTokenUsage(row));
  }

  getById(id: string): TokenUsage | undefined {
    const row = (this.stmtGetById as { get(id: string): TokenUsageRow | undefined }).get(id);
    if (!row) return undefined;
    return TokenUsageSchema.parse(rowToTokenUsage(row));
  }

  getBySessionId(sessionId: string): TokenUsage[] {
    return (this.stmtGetBySession as { all(sessionId: string): TokenUsageRow[] })
      .all(sessionId)
      .map((row) => TokenUsageSchema.parse(rowToTokenUsage(row)));
  }

  getByTurnId(turnId: string): TokenUsage[] {
    return (this.stmtGetByTurn as { all(turnId: string): TokenUsageRow[] })
      .all(turnId)
      .map((row) => TokenUsageSchema.parse(rowToTokenUsage(row)));
  }

  getSessionTotals(sessionId: string): SessionUsageSummary | undefined {
    const row = (this.stmtSessionTotals as { get(sessionId: string): SummaryRow | undefined }).get(
      sessionId,
    );
    if (!row) return undefined;
    return SessionUsageSummarySchema.parse(rowToSessionSummary(row));
  }

  getAgentTotals(sessionId: string, agentId: string): AgentUsageSummary | undefined {
    const row = (
      this.stmtAgentTotals as {
        get(sessionId: string, agentId: string): AgentSummaryRow | undefined;
      }
    ).get(sessionId, agentId);
    if (!row) return undefined;
    return AgentUsageSummarySchema.parse(rowToAgentSummary(row));
  }

  getModelBreakdown(sessionId: string): ModelUsageBreakdown[] {
    return (this.stmtModelBreakdown as { all(sessionId: string): ModelBreakdownRow[] })
      .all(sessionId)
      .map((row) => ModelUsageBreakdownSchema.parse(rowToModelBreakdown(row)));
  }

  getByTimeRange(from: string, to: string): TokenUsage[] {
    return (this.stmtByTimeRange as { all(from: string, to: string): TokenUsageRow[] })
      .all(from, to)
      .map((row) => TokenUsageSchema.parse(rowToTokenUsage(row)));
  }

  checkBudget(sessionId: string, threshold: number): boolean {
    const row = (
      this.stmtBudgetCheck as { get(sessionId: string): { total_cost_usd: number } }
    ).get(sessionId);
    return row.total_cost_usd >= threshold;
  }
}
