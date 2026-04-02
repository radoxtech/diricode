import type { Database } from "better-sqlite3";
import {
  type Issue,
  type CreateIssueInput,
  type UpdateIssueInput,
  type ListIssuesFilter,
  type ParsedListIssuesFilter,
  type IIssueClient,
  IssueStatusSchema,
  ListIssuesFilterSchema,
} from "../schemas/issue.js";

interface IssueRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  labels: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

function safeParseLabels(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return [];
  } catch {
    return [];
  }
}

function rowToRecord(row: IssueRow): Issue {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: IssueStatusSchema.parse(row.status),
    priority: row.priority as Issue["priority"],
    labels: safeParseLabels(row.labels),
    parentId: row.parent_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeFtsQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  const quoteCount = (trimmed.match(/"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    return trimmed.replace(/"/g, "");
  }
  return trimmed;
}

export class IssueRepository implements IIssueClient {
  constructor(private readonly db: Database) {}

  createIssue(input: CreateIssueInput): Issue {
    const now = new Date().toISOString();
    this.db
      .prepare<[string, string, string | null, string, string, string | null, string, string]>(
        `INSERT INTO issues (id, title, description, status, priority, labels, parent_id, created_at, updated_at)
         VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.title,
        input.description ?? null,
        input.priority,
        JSON.stringify(input.labels),
        input.parentId ?? null,
        now,
        now,
      );

    const issue = this.getIssue(input.id);
    if (!issue) throw new Error(`Issue not found after insert: ${input.id}`);
    return issue;
  }

  getIssue(id: string): Issue | undefined {
    const row = this.db.prepare<[string], IssueRow>("SELECT * FROM issues WHERE id = ?").get(id);
    return row ? rowToRecord(row) : undefined;
  }

  updateIssue(id: string, input: UpdateIssueInput): Issue | undefined {
    const existing = this.getIssue(id);
    if (!existing) return undefined;

    const setClauses: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (input.title !== undefined) {
      setClauses.push("title = ?");
      params.push(input.title);
    }
    if ("description" in input) {
      setClauses.push("description = ?");
      params.push(input.description ?? null);
    }
    if (input.status !== undefined) {
      setClauses.push("status = ?");
      params.push(input.status);
    }
    if (input.priority !== undefined) {
      setClauses.push("priority = ?");
      params.push(input.priority);
    }
    if (input.labels !== undefined) {
      setClauses.push("labels = ?");
      params.push(JSON.stringify(input.labels));
    }
    if ("parentId" in input) {
      setClauses.push("parent_id = ?");
      params.push(input.parentId ?? null);
    }

    params.push(id);

    this.db.prepare(`UPDATE issues SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);

    return this.getIssue(id);
  }

  closeIssue(id: string): Issue | undefined {
    const existing = this.getIssue(id);
    if (!existing) return undefined;

    this.db
      .prepare<
        [string]
      >("UPDATE issues SET status = 'closed', updated_at = datetime('now') WHERE id = ?")
      .run(id);

    return this.getIssue(id);
  }

  deleteIssue(id: string): boolean {
    const result = this.db.prepare<[string]>("DELETE FROM issues WHERE id = ?").run(id);
    return result.changes > 0;
  }

  listIssues(filter?: ListIssuesFilter): Issue[] {
    const f: ParsedListIssuesFilter = ListIssuesFilterSchema.parse(filter ?? {});

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (f.status !== undefined) {
      conditions.push("status = ?");
      params.push(f.status);
    }
    if (f.priority !== undefined) {
      conditions.push("priority = ?");
      params.push(f.priority);
    }
    if (f.parentId !== undefined) {
      conditions.push("parent_id = ?");
      params.push(f.parentId);
    }
    if (f.labels !== undefined && f.labels.length > 0) {
      const placeholders = f.labels.map(() => "?").join(", ");
      conditions.push(
        `(labels IS NOT NULL AND (SELECT COUNT(*) FROM json_each(labels) WHERE json_each.value IN (${placeholders})) = ?)`,
      );
      params.push(...f.labels, f.labels.length);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM issues ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(f.limit, f.offset);

    const rows = this.db.prepare(sql).all(...params) as IssueRow[];
    return rows.map(rowToRecord);
  }

  searchIssues(query: string, filter?: ListIssuesFilter): Issue[] {
    const f: ParsedListIssuesFilter = ListIssuesFilterSchema.parse(filter ?? {});
    const sanitizedQuery = sanitizeFtsQuery(query);
    if (!sanitizedQuery) return [];

    const conditions: string[] = ["issues_fts MATCH ?"];
    const params: unknown[] = [sanitizedQuery];

    if (f.status !== undefined) {
      conditions.push("i.status = ?");
      params.push(f.status);
    }
    if (f.priority !== undefined) {
      conditions.push("i.priority = ?");
      params.push(f.priority);
    }
    if (f.parentId !== undefined) {
      conditions.push("i.parent_id = ?");
      params.push(f.parentId);
    }
    if (f.labels !== undefined && f.labels.length > 0) {
      const placeholders = f.labels.map(() => "?").join(", ");
      conditions.push(
        `(i.labels IS NOT NULL AND (SELECT COUNT(*) FROM json_each(i.labels) WHERE json_each.value IN (${placeholders})) = ?)`,
      );
      params.push(...f.labels, f.labels.length);
    }

    const where = conditions.join(" AND ");
    const sql = `
      SELECT i.*
      FROM issues i
      JOIN issues_fts ON i.rowid = issues_fts.rowid
      WHERE ${where}
      ORDER BY bm25(issues_fts)
      LIMIT ? OFFSET ?
    `;
    params.push(f.limit, f.offset);

    try {
      const rows = this.db.prepare(sql).all(...params) as IssueRow[];
      return rows.map(rowToRecord);
    } catch {
      return [];
    }
  }

  getChildren(parentId: string): Issue[] {
    const rows = this.db
      .prepare<
        [string],
        IssueRow
      >("SELECT * FROM issues WHERE parent_id = ? ORDER BY created_at ASC")
      .all(parentId);
    return rows.map(rowToRecord);
  }

  getDescendants(rootId: string): Issue[] {
    const sql = `
      WITH RECURSIVE descendants AS (
        SELECT * FROM issues WHERE id = ?
        UNION ALL
        SELECT i.* FROM issues i JOIN descendants d ON i.parent_id = d.id
      )
      SELECT * FROM descendants WHERE id != ? ORDER BY created_at ASC
    `;
    const rows = this.db.prepare(sql).all(rootId, rootId) as IssueRow[];
    return rows.map(rowToRecord);
  }
}
