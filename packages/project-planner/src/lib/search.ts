import type { Node, NodeStatus, NodeType } from "../types/node.js";
import type { DatabaseInstance } from "./database.js";

export interface SearchFilters {
  namespaceId?: string;
  types?: NodeType[];
  status?: NodeStatus[];
  limit?: number;
}

export interface SearchResult {
  node: Node;
  rank: number;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  suggestion?: string;
}

const MAX_RESULTS = 100;

const DEFAULT_RESULTS = 20;

/**
 * Search engine for full-text search across nodes using SQLite FTS5.
 *
 * Features:
 * - Full-text search across title, description, and labels
 * - Post-FTS filtering by namespace, type, and status
 * - Freshness boost based on recency of updates
 * - Graceful handling of empty queries and syntax errors
 */
export class SearchEngine {
  private readonly db: DatabaseInstance;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  /**
   * Search for nodes using FTS5 full-text search.
   *
   * @param query - The search query string (FTS5 MATCH syntax)
   * @param filters - Optional filters for namespace, type, status, and limit
   * @returns Search results with ranked nodes and snippets
   */
  search(query: string, filters: SearchFilters = {}): SearchResponse {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      return {
        results: [],
        total: 0,
        suggestion: "Enter search terms to find nodes by title, description, or labels.",
      };
    }

    try {
      return this.executeSearch(trimmedQuery, filters);
    } catch (error) {
      if (error instanceof Error && this.isFts5SyntaxError(error)) {
        return {
          results: [],
          total: 0,
          suggestion: `Invalid search syntax. Try using simpler terms or quotes for phrases.`,
        };
      }

      throw error;
    }
  }

  private executeSearch(query: string, filters: SearchFilters): SearchResponse {
    const limit = Math.min(filters.limit ?? DEFAULT_RESULTS, MAX_RESULTS);
    const ftsQuery = this.sanitizeFtsQuery(query);
    const rawResults = this.queryFts(ftsQuery, filters);

    const results: SearchResult[] = rawResults.map((row) => ({
      node: row.node,
      rank: row.rank * this.calculateFreshnessBoost(row.node.updated_at),
      snippet: this.generateSnippet(row.node, query),
    }));

    results.sort((a, b) => b.rank - a.rank);

    const limitedResults = results.slice(0, limit);

    return {
      results: limitedResults,
      total: results.length,
    };
  }

  private queryFts(ftsQuery: string, filters: SearchFilters): Array<{ node: Node; rank: number }> {
    const whereClauses: string[] = [];
    const params: (string | string[])[] = [ftsQuery];

    if (filters.namespaceId !== undefined) {
      whereClauses.push("n.namespace_id = ?");
      params.push(filters.namespaceId);
    }

    if (filters.types !== undefined && filters.types.length > 0) {
      whereClauses.push(`n.type IN (${filters.types.map(() => "?").join(", ")})`);
      params.push(...filters.types);
    }

    if (filters.status !== undefined && filters.status.length > 0) {
      whereClauses.push(`n.status IN (${filters.status.map(() => "?").join(", ")})`);
      params.push(...filters.status);
    }

    const whereSql = whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : "";

    const sql = `
      SELECT 
        n.*,
        bm25(nodes_fts, -1.0, 0.5, 0.5, 0.0) as fts_rank
      FROM nodes n
      JOIN nodes_fts ON n.rowid = nodes_fts.rowid
      WHERE nodes_fts MATCH ?
      ${whereSql}
      ORDER BY fts_rank ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      node: this.rowToNode(row),
      rank: Math.max(0.1, 10 - (row.fts_rank as number)),
    }));
  }

  private rowToNode(row: Record<string, unknown>): Node {
    const labels = typeof row.labels === "string" ? JSON.parse(row.labels) : row.labels;
    const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;

    return {
      id: row.id as string,
      namespace_id: row.namespace_id as string,
      type: row.type as Node["type"],
      title: row.title as string,
      description: row.description as string,
      status: row.status as NodeStatus,
      labels: Array.isArray(labels) ? labels : [],
      metadata: typeof metadata === "object" && metadata !== null ? metadata : {},
      parentId: row.parent_id as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    } as Node;
  }

  private sanitizeFtsQuery(query: string): string {
    const needsEscaping = /[\*\(\)\^"]/;

    if (needsEscaping.test(query)) {
      return `"${query.replace(/"/g, '""')}"`;
    }

    return query;
  }

  private isFts5SyntaxError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("fts5") &&
      (message.includes("syntax") || message.includes("malformed") || message.includes("parse"))
    );
  }

  private calculateFreshnessBoost(updatedAt: string): number {
    const updated = new Date(updatedAt).getTime();
    const now = Date.now();
    const ageMs = now - updated;

    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    if (ageMs < oneDay) {
      return 2.0;
    } else if (ageMs < oneWeek) {
      return 1.75;
    } else if (ageMs < oneMonth) {
      return 1.5;
    } else if (ageMs < 3 * oneMonth) {
      return 1.25;
    } else {
      return 1.0;
    }
  }

  private generateSnippet(node: Node, query: string): string {
    const searchTerms = query.toLowerCase().split(/\s+/);
    const maxSnippetLength = 150;

    if (node.description && node.description.length > 0) {
      const snippet = this.extractSnippet(node.description, searchTerms, maxSnippetLength);
      if (snippet) {
        return snippet;
      }
    }

    if (node.title) {
      return node.title.length > maxSnippetLength
        ? `${node.title.slice(0, maxSnippetLength)}...`
        : node.title;
    }

    if (node.labels.length > 0) {
      return `Labels: ${node.labels.join(", ")}`;
    }

    return "No preview available";
  }

  private extractSnippet(text: string, terms: string[], maxLength: number): string | null {
    const lowerText = text.toLowerCase();

    let bestPosition = -1;
    let matchedTerm = "";
    for (const term of terms) {
      const pos = lowerText.indexOf(term);
      if (pos !== -1 && (bestPosition === -1 || pos < bestPosition)) {
        bestPosition = pos;
        matchedTerm = term;
      }
    }

    if (bestPosition === -1) {
      return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    }

    const contextChars = Math.floor((maxLength - matchedTerm.length) / 2);
    const start = Math.max(0, bestPosition - contextChars);
    const end = Math.min(text.length, bestPosition + matchedTerm.length + contextChars);

    let snippet = text.slice(start, end);

    if (start > 0) {
      snippet = `...${snippet}`;
    }
    if (end < text.length) {
      snippet = `${snippet}...`;
    }

    return snippet;
  }
}
