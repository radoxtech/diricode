import { randomUUID } from "node:crypto";

import type { DatabaseInstance } from "./database.js";
import {
  type AnyEdgeType,
  type Edge,
  type EdgeKind,
  type EdgeType,
  type RelationStrength,
  EdgeSchema,
  EdgeTypeSchema,
  SoftRelationTypeSchema,
} from "../types/edge.js";
import type { Node } from "../types/node.js";

const DEPENDENCY_EDGE_TYPES: ReadonlySet<EdgeType> = new Set(["depends_on", "blocks", "precedes"]);

const MAX_BFS_DEPTH = 3;

export type CreateEdgeInput = {
  sourceId: string;
  targetId: string;
  type: AnyEdgeType;
  kind?: EdgeKind;
  strength?: RelationStrength;
  notes?: string;
};

export type EdgeFilters = {
  type?: AnyEdgeType;
  kind?: EdgeKind;
};

class EdgeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdgeValidationError";
  }
}

class CycleDetectedError extends Error {
  constructor(sourceId: string, targetId: string, type: string) {
    super(
      `Creating edge (${sourceId} → ${targetId}, type=${type}) would create a cycle among dependency edges`,
    );
    this.name = "CycleDetectedError";
  }
}

class DuplicateEdgeError extends Error {
  constructor(sourceId: string, targetId: string, type: string) {
    super(`Edge already exists: source=${sourceId}, target=${targetId}, type=${type}`);
    this.name = "DuplicateEdgeError";
  }
}

function mapRowToEdge(row: Record<string, unknown>): Edge {
  return EdgeSchema.parse({
    id: row.id as string,
    source_id: row.source_id as string,
    target_id: row.target_id as string,
    type: row.type as AnyEdgeType,
    kind: row.kind as EdgeKind,
    strength: (row.strength as RelationStrength) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    created_at: row.created_at as string,
  });
}

export class EdgeStorage {
  private readonly db: DatabaseInstance;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  createEdge(input: CreateEdgeInput): Edge {
    const kind = input.kind ?? "hard";

    this.validateEdgeType(kind, input.type);

    if (kind === "soft" && input.strength === undefined) {
      throw new EdgeValidationError("strength is required for soft edges");
    }

    this.validateNoDuplicate(input.sourceId, input.targetId, input.type);

    if (DEPENDENCY_EDGE_TYPES.has(input.type as EdgeType)) {
      this.validateNoCycle(input.sourceId, input.targetId, input.type as EdgeType);
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO edges (id, source_id, target_id, type, kind, strength, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.sourceId,
        input.targetId,
        input.type,
        kind,
        input.strength ?? null,
        input.notes ?? null,
        now,
      );

    return EdgeSchema.parse({
      id,
      source_id: input.sourceId,
      target_id: input.targetId,
      type: input.type,
      kind,
      strength: input.strength,
      notes: input.notes,
      created_at: now,
    });
  }

  deleteEdge(id: string): void {
    const changes = this.db.prepare("DELETE FROM edges WHERE id = ?").run(id);

    if (changes.changes === 0) {
      throw new EdgeValidationError(`Edge not found: ${id}`);
    }
  }

  deleteEdgeBetween(sourceId: string, targetId: string, type: AnyEdgeType): void {
    const changes = this.db
      .prepare("DELETE FROM edges WHERE source_id = ? AND target_id = ? AND type = ?")
      .run(sourceId, targetId, type);

    if (changes.changes === 0) {
      throw new EdgeValidationError(
        `Edge not found: source=${sourceId}, target=${targetId}, type=${type}`,
      );
    }
  }

  getEdgesFrom(nodeId: string, filters?: EdgeFilters): Edge[] {
    return this.queryEdges("SELECT * FROM edges WHERE source_id = ?", [nodeId], filters);
  }

  getEdgesTo(nodeId: string, filters?: EdgeFilters): Edge[] {
    return this.queryEdges("SELECT * FROM edges WHERE target_id = ?", [nodeId], filters);
  }

  getEdgesBetween(nodeId1: string, nodeId2: string): Edge[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM edges WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)",
      )
      .all(nodeId1, nodeId2, nodeId2, nodeId1) as Record<string, unknown>[];

    return rows.map(mapRowToEdge);
  }

  getRelatedNodes(nodeId: string, depth: number = 1): Node[] {
    const effectiveDepth = Math.max(1, Math.min(depth, MAX_BFS_DEPTH));

    const visited = new Set<string>();
    visited.add(nodeId);

    let frontier = [nodeId];

    for (let level = 0; level < effectiveDepth; level += 1) {
      const nextFrontier: string[] = [];

      for (const currentId of frontier) {
        const rows = this.db
          .prepare("SELECT source_id, target_id FROM edges WHERE source_id = ? OR target_id = ?")
          .all(currentId, currentId) as Array<{
          source_id: string;
          target_id: string;
        }>;

        for (const row of rows) {
          const neighborId = row.source_id === currentId ? row.target_id : row.source_id;

          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            nextFrontier.push(neighborId);
          }
        }
      }

      frontier = nextFrontier;
    }

    visited.delete(nodeId);

    if (visited.size === 0) {
      return [];
    }

    const placeholders = Array.from(visited)
      .map(() => "?")
      .join(", ");
    const rows = this.db
      .prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`)
      .all(...Array.from(visited)) as Record<string, unknown>[];

    return rows.map((row) => {
      const labels = row.labels as string;

      return {
        id: row.id as string,
        namespace_id: row.namespace_id as string,
        type: row.type as string,
        title: row.title as string,
        description: (row.description as string) ?? "",
        status: row.status as string,
        labels: labels ? (JSON.parse(labels) as string[]) : [],
        metadata: JSON.parse((row.metadata as string) ?? "{}"),
        parentId: (row.parent_id as string) ?? undefined,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      };
    }) as Node[];
  }

  private validateEdgeType(kind: EdgeKind, type: AnyEdgeType): void {
    if (kind === "hard") {
      const result = EdgeTypeSchema.safeParse(type);

      if (!result.success) {
        throw new EdgeValidationError(
          `Hard edges must use EdgeType values: ${EdgeTypeSchema.options.join(", ")}. Got: ${type}`,
        );
      }
    } else {
      const result = SoftRelationTypeSchema.safeParse(type);

      if (!result.success) {
        throw new EdgeValidationError(
          `Soft edges must use SoftRelationType values: ${SoftRelationTypeSchema.options.join(", ")}. Got: ${type}`,
        );
      }
    }
  }

  private validateNoDuplicate(sourceId: string, targetId: string, type: AnyEdgeType): void {
    const row = this.db
      .prepare("SELECT 1 FROM edges WHERE source_id = ? AND target_id = ? AND type = ?")
      .get(sourceId, targetId, type);

    if (row !== undefined) {
      throw new DuplicateEdgeError(sourceId, targetId, type);
    }
  }

  private validateNoCycle(sourceId: string, targetId: string, type: EdgeType): void {
    const visited = new Set<string>();
    const stack = [targetId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;

      if (currentId === sourceId) {
        throw new CycleDetectedError(sourceId, targetId, type);
      }

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      const outgoing = this.db
        .prepare(
          `SELECT target_id FROM edges WHERE source_id = ? AND type IN ('depends_on', 'blocks', 'precedes')`,
        )
        .all(currentId) as Array<{ target_id: string }>;

      for (const edge of outgoing) {
        stack.push(edge.target_id);
      }
    }
  }

  private queryEdges(baseSql: string, params: unknown[], filters?: EdgeFilters): Edge[] {
    if (filters === undefined) {
      const rows = this.db.prepare(baseSql).all(...params) as Record<string, unknown>[];

      return rows.map(mapRowToEdge);
    }

    const conditions: string[] = [];
    const filterParams: unknown[] = [];

    if (filters.type !== undefined) {
      conditions.push("type = ?");
      filterParams.push(filters.type);
    }

    if (filters.kind !== undefined) {
      conditions.push("kind = ?");
      filterParams.push(filters.kind);
    }

    if (conditions.length === 0) {
      const rows = this.db.prepare(baseSql).all(...params) as Record<string, unknown>[];

      return rows.map(mapRowToEdge);
    }

    const sql = `${baseSql} AND ${conditions.join(" AND ")}`;
    const rows = this.db.prepare(sql).all(...params, ...filterParams) as Record<string, unknown>[];

    return rows.map(mapRowToEdge);
  }
}

export { EdgeValidationError, CycleDetectedError, DuplicateEdgeError };
