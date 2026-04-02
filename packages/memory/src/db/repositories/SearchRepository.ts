import type { Database } from "better-sqlite3";
import {
  type SearchResult,
  type SearchFilter,
  type ParsedSearchFilter,
  SearchFilterSchema,
  SearchResultSchema,
  ObservationTypeSchema,
} from "../schemas/search.js";

interface MessageSearchRow {
  id: string;
  session_id: string | null;
  agent_id: string | null;
  content: string;
  excerpt: string;
  score: number;
  timestamp: string | null;
}

interface ObservationSearchRow {
  id: number;
  session_id: string | null;
  agent_id: string | null;
  content: string;
  excerpt: string;
  score: number;
  type: string | null;
  timestamp: string | null;
}

function messageRowToResult(row: MessageSearchRow): SearchResult {
  return SearchResultSchema.parse({
    source: "message",
    id: row.id,
    sessionId: row.session_id,
    agentId: row.agent_id,
    content: row.content,
    excerpt: row.excerpt,
    score: row.score,
    timestamp: row.timestamp,
  });
}

function observationRowToResult(row: ObservationSearchRow): SearchResult {
  const parsed = ObservationTypeSchema.safeParse(row.type);
  return SearchResultSchema.parse({
    source: "observation",
    id: row.id,
    sessionId: row.session_id,
    agentId: row.agent_id,
    content: row.content,
    excerpt: row.excerpt,
    score: row.score,
    timestamp: row.timestamp,
    observationType: parsed.success ? parsed.data : null,
  });
}

export class SearchRepository {
  constructor(private readonly db: Database) {}

  search(query: string, filter?: SearchFilter): SearchResult[] {
    const f = SearchFilterSchema.parse(filter ?? {});
    const limit = f.limit;

    const sanitizedQuery = sanitizeFtsQuery(query);
    if (!sanitizedQuery) return [];

    const results: SearchResult[] = [];

    try {
      const messageResults = this.searchMessages(sanitizedQuery, f, limit);
      results.push(...messageResults);
    } catch {
      // FTS5 syntax errors on message table — skip silently
    }

    try {
      const observationResults = this.searchObservations(sanitizedQuery, f, limit);
      results.push(...observationResults);
    } catch {
      // FTS5 syntax errors on observation table — skip silently
    }

    results.sort((a, b) => a.score - b.score);

    return results.slice(0, limit);
  }

  searchMessages(query: string, filter: ParsedSearchFilter, limit: number): SearchResult[] {
    const conditions: string[] = ["messages_fts MATCH ?"];
    const params: unknown[] = [query];

    if (filter.sessionId) {
      conditions.push("m.session_id = ?");
      params.push(filter.sessionId);
    }
    if (filter.agentId) {
      conditions.push("m.agent_id = ?");
      params.push(filter.agentId);
    }
    if (filter.fromTimestamp) {
      conditions.push("m.timestamp >= ?");
      params.push(filter.fromTimestamp);
    }
    if (filter.toTimestamp) {
      conditions.push("m.timestamp <= ?");
      params.push(filter.toTimestamp);
    }

    const where = conditions.join(" AND ");
    const sql = `
      SELECT
        m.id,
        m.session_id,
        m.agent_id,
        m.content,
        snippet(messages_fts, 0, '', '', '...', 32) AS excerpt,
        bm25(messages_fts) AS score,
        m.timestamp
      FROM messages m
      JOIN messages_fts f ON m.rowid = f.rowid
      WHERE ${where}
      ORDER BY bm25(messages_fts)
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...params, limit) as MessageSearchRow[];
    return rows.map(messageRowToResult);
  }

  searchObservations(query: string, filter: ParsedSearchFilter, limit: number): SearchResult[] {
    const conditions: string[] = ["observations_fts MATCH ?"];
    const params: unknown[] = [query];

    if (filter.sessionId) {
      conditions.push("o.session_id = ?");
      params.push(filter.sessionId);
    }
    if (filter.agentId) {
      conditions.push("o.agent_id = ?");
      params.push(filter.agentId);
    }
    if (filter.observationType) {
      conditions.push("o.type = ?");
      params.push(filter.observationType);
    }
    if (filter.fromTimestamp) {
      conditions.push("o.timestamp >= ?");
      params.push(filter.fromTimestamp);
    }
    if (filter.toTimestamp) {
      conditions.push("o.timestamp <= ?");
      params.push(filter.toTimestamp);
    }

    const where = conditions.join(" AND ");
    const sql = `
      SELECT
        o.id,
        o.session_id,
        o.agent_id,
        o.content,
        snippet(observations_fts, 0, '', '', '...', 32) AS excerpt,
        bm25(observations_fts) AS score,
        o.type,
        o.timestamp
      FROM observations o
      JOIN observations_fts f ON o.id = f.rowid
      WHERE ${where}
      ORDER BY bm25(observations_fts)
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...params, limit) as ObservationSearchRow[];
    return rows.map(observationRowToResult);
  }
}

function sanitizeFtsQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";

  // Strip unbalanced quotes — FTS5 requires balanced quotes
  const quoteCount = (trimmed.match(/"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    return trimmed.replace(/"/g, "");
  }

  return trimmed;
}
