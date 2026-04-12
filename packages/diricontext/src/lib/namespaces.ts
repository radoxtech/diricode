import type { DatabaseInstance } from "./database.js";
import { NamespaceSchema, getNamespaceId } from "../types/namespace.js";
import type { Namespace } from "../types/namespace.js";
import type { NamespaceType } from "../types/node.js";

type NamespaceRow = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  created_at: string;
};

function toIsoDateTime(value: string): string {
  const parsedDate = new Date(value.includes("T") ? value : `${value}Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }

  return parsedDate.toISOString();
}

function parseNamespaceRow(row: NamespaceRow): Namespace {
  return NamespaceSchema.parse({
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description ?? undefined,
    created_at: toIsoDateTime(row.created_at),
  });
}

export class NamespaceStorage {
  private readonly createNamespaceStatement;

  private readonly deleteNamespaceStatement;

  private readonly getNamespaceStatement;

  private readonly listNamespacesStatement;

  constructor(private readonly db: DatabaseInstance) {
    this.createNamespaceStatement = this.db.prepare(
      "INSERT OR IGNORE INTO namespaces (id, type, name, description) VALUES (?, ?, ?, ?)",
    );
    this.deleteNamespaceStatement = this.db.prepare("DELETE FROM namespaces WHERE id = ?");
    this.getNamespaceStatement = this.db.prepare(
      "SELECT id, type, name, description, created_at FROM namespaces WHERE id = ?",
    );
    this.listNamespacesStatement = this.db.prepare(
      "SELECT id, type, name, description, created_at FROM namespaces ORDER BY id",
    );
  }

  createNamespace(input: { type: NamespaceType; name: string; description?: string }): Namespace {
    const id = getNamespaceId(input.type, input.name);

    this.createNamespaceStatement.run(id, input.type, input.name, input.description ?? null);

    const namespace = this.getNamespace(id);

    if (!namespace) {
      throw new Error(`Failed to create namespace: ${id}`);
    }

    return namespace;
  }

  getNamespace(id: string): Namespace | null {
    const row = this.getNamespaceStatement.get(id) as NamespaceRow | undefined;

    return row ? parseNamespaceRow(row) : null;
  }

  listNamespaces(): Namespace[] {
    const rows = this.listNamespacesStatement.all() as NamespaceRow[];

    return rows.map((row) => parseNamespaceRow(row));
  }

  deleteNamespace(id: string): void {
    const deleteResult = this.deleteNamespaceStatement.run(id);

    if (deleteResult.changes === 0) {
      throw new Error(`Namespace not found: ${id}`);
    }
  }
}
