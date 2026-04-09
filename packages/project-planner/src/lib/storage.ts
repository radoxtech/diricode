import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { DatabaseInstance } from "./database.js";
import { NamespaceTypeSchema } from "../types/node.js";
import { BaseNodeSchema, NodeSchemaMap, NodeStatusSchema, NodeTypeSchema } from "../types/node.js";
import type { BaseNode, Node, NodeStatus, NodeType } from "../types/node.js";

const VALID_NODE_TYPE_MAP: Record<string, Set<string>> = {
  docs: new Set(["document", "feature", "component"]),
  plan: new Set(["feature", "component", "task", "epic", "phase", "sprint", "milestone"]),
  reference: new Set(["reference_project", "reference_feature"]),
};

const LabelsSchema = z.array(z.string());
const MetadataSchema = z.record(z.string(), z.unknown());

type NodeRow = {
  id: string;
  namespace_id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  labels: string | null;
  metadata: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

type NamespaceLookupRow = {
  id: string;
  type: string;
};

export type CreateNodeInput = {
  namespace_id: BaseNode["namespace_id"];
  type: BaseNode["type"];
  title: BaseNode["title"];
  description?: BaseNode["description"];
  status?: BaseNode["status"];
  labels?: BaseNode["labels"];
  metadata?: BaseNode["metadata"];
  parentId?: BaseNode["parentId"];
};

export type UpdateNodeInput = Pick<
  BaseNode,
  "title" | "description" | "status" | "labels" | "metadata"
> & {
  parentId?: BaseNode["parentId"] | null;
};

export type NodeFilters = {
  namespaceId?: string;
  type?: NodeType;
  status?: NodeStatus;
  parentId?: string | null;
};

function toIsoDateTime(value: string): string {
  const parsedDate = new Date(value.includes("T") ? value : `${value}Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }

  return parsedDate.toISOString();
}

function parseJsonString<T>(value: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (value === null) {
    return fallback;
  }

  const parsedValue: unknown = JSON.parse(value);
  return schema.parse(parsedValue);
}

function parseNodeRow(row: Record<string, unknown>): Node {
  const nodeType = NodeTypeSchema.parse(row.type);

  const parsedNode = {
    id: BaseNodeSchema.shape.id.parse(row.id),
    namespace_id: BaseNodeSchema.shape.namespace_id.parse(row.namespace_id),
    type: nodeType,
    title: BaseNodeSchema.shape.title.parse(row.title),
    description: BaseNodeSchema.shape.description.parse(row.description ?? ""),
    status: NodeStatusSchema.parse(row.status),
    labels: parseJsonString(typeof row.labels === "string" ? row.labels : null, LabelsSchema, []),
    metadata: parseJsonString(
      typeof row.metadata === "string" ? row.metadata : null,
      MetadataSchema,
      {},
    ),
    parentId:
      row.parent_id === null || row.parent_id === undefined
        ? undefined
        : BaseNodeSchema.shape.parentId.unwrap().parse(row.parent_id),
    created_at: toIsoDateTime(
      BaseNodeSchema.shape.created_at.parse(toIsoDateTime(String(row.created_at))),
    ),
    updated_at: toIsoDateTime(
      BaseNodeSchema.shape.updated_at.parse(toIsoDateTime(String(row.updated_at))),
    ),
  } satisfies Node;

  return NodeSchemaMap[nodeType].parse(parsedNode);
}

export class NodeStorage {
  private readonly createNodeStatement;

  private readonly deleteNodeStatement;

  private readonly getNodeStatement;

  private readonly getNodesByIdsPrefix =
    "SELECT id, namespace_id, type, title, description, status, labels, metadata, parent_id, created_at, updated_at FROM nodes WHERE id IN ";

  private readonly listNodesBaseQuery =
    "SELECT id, namespace_id, type, title, description, status, labels, metadata, parent_id, created_at, updated_at FROM nodes";

  private readonly namespaceLookupStatement;

  constructor(private readonly db: DatabaseInstance) {
    this.createNodeStatement = this.db.prepare(
      `INSERT INTO nodes (
        id,
        namespace_id,
        type,
        title,
        description,
        status,
        labels,
        metadata,
        parent_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.deleteNodeStatement = this.db.prepare("DELETE FROM nodes WHERE id = ?");
    this.getNodeStatement = this.db.prepare(
      "SELECT id, namespace_id, type, title, description, status, labels, metadata, parent_id, created_at, updated_at FROM nodes WHERE id = ?",
    );
    this.namespaceLookupStatement = this.db.prepare("SELECT id, type FROM namespaces WHERE id = ?");
  }

  createNode(input: CreateNodeInput): Node {
    const namespace = this.namespaceLookupStatement.get(input.namespace_id) as
      | NamespaceLookupRow
      | undefined;

    if (!namespace) {
      throw new Error(`Namespace not found: ${input.namespace_id}`);
    }

    const namespaceType = NamespaceTypeSchema.parse(namespace.type);
    const validNodeTypes = VALID_NODE_TYPE_MAP[namespaceType];

    if (!validNodeTypes?.has(input.type)) {
      throw new Error(`Invalid node type '${input.type}' for namespace type '${namespaceType}'`);
    }

    const timestamp = new Date().toISOString();
    const id = randomUUID();

    this.createNodeStatement.run(
      id,
      input.namespace_id,
      input.type,
      input.title,
      input.description ?? "",
      input.status ?? "BACKLOG",
      JSON.stringify(input.labels ?? []),
      JSON.stringify(input.metadata ?? {}),
      input.parentId ?? null,
      timestamp,
      timestamp,
    );

    const node = this.getNode(id);

    if (!node) {
      throw new Error(`Failed to create node: ${id}`);
    }

    return node;
  }

  getNode(id: string): Node | null {
    const row = this.getNodeStatement.get(id) as NodeRow | undefined;

    return row ? parseNodeRow(row as unknown as Record<string, unknown>) : null;
  }

  updateNode(id: string, updates: Partial<UpdateNodeInput>): Node {
    const existingNode = this.getNode(id);

    if (!existingNode) {
      throw new Error(`Node not found: ${id}`);
    }

    const assignments: string[] = [];
    const parameters: unknown[] = [];

    if (updates.title !== undefined) {
      assignments.push("title = ?");
      parameters.push(updates.title);
    }

    if (updates.description !== undefined) {
      assignments.push("description = ?");
      parameters.push(updates.description);
    }

    if (updates.status !== undefined) {
      assignments.push("status = ?");
      parameters.push(updates.status);
    }

    if (updates.labels !== undefined) {
      assignments.push("labels = ?");
      parameters.push(JSON.stringify(updates.labels));
    }

    if (updates.metadata !== undefined) {
      assignments.push("metadata = ?");
      parameters.push(JSON.stringify(updates.metadata));
    }

    if (Object.prototype.hasOwnProperty.call(updates, "parentId")) {
      assignments.push("parent_id = ?");
      parameters.push(updates.parentId ?? null);
    }

    assignments.push("updated_at = ?");
    parameters.push(new Date().toISOString(), id);

    this.db.prepare(`UPDATE nodes SET ${assignments.join(", ")} WHERE id = ?`).run(...parameters);

    const updatedNode = this.getNode(id);

    if (!updatedNode) {
      throw new Error(`Node not found after update: ${id}`);
    }

    return updatedNode;
  }

  deleteNode(id: string): void {
    const deleteResult = this.deleteNodeStatement.run(id);

    if (deleteResult.changes === 0) {
      throw new Error(`Node not found: ${id}`);
    }
  }

  listNodes(filters?: NodeFilters): Node[] {
    const clauses: string[] = [];
    const parameters: unknown[] = [];

    if (filters?.namespaceId !== undefined) {
      clauses.push("namespace_id = ?");
      parameters.push(filters.namespaceId);
    }

    if (filters?.type !== undefined) {
      clauses.push("type = ?");
      parameters.push(filters.type);
    }

    if (filters?.status !== undefined) {
      clauses.push("status = ?");
      parameters.push(filters.status);
    }

    if (filters && Object.prototype.hasOwnProperty.call(filters, "parentId")) {
      if (filters.parentId === null) {
        clauses.push("parent_id IS NULL");
      } else if (filters.parentId !== undefined) {
        clauses.push("parent_id = ?");
        parameters.push(filters.parentId);
      }
    }

    const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`${this.listNodesBaseQuery}${whereClause}`)
      .all(...parameters) as NodeRow[];

    return rows.map((row) => parseNodeRow(row as unknown as Record<string, unknown>));
  }

  getNodesByIds(ids: string[]): Node[] {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`${this.getNodesByIdsPrefix}(${placeholders})`)
      .all(...ids) as NodeRow[];
    const nodesById = new Map(
      rows.map((row) => {
        const node = parseNodeRow(row as unknown as Record<string, unknown>);
        return [node.id, node] as const;
      }),
    );

    return ids.flatMap((nodeId) => {
      const node = nodesById.get(nodeId);
      return node ? [node] : [];
    });
  }
}
