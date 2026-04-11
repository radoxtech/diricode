import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initDatabase } from "./database.js";
import { SearchEngine } from "./search.js";
import type { Node, NodeStatus, NodeType } from "../types/node.js";

describe("SearchEngine", () => {
  let dbPath: string;
  let cleanup: () => void;

  beforeEach(() => {
    const tempDir = join(tmpdir(), `diricontext-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    dbPath = join(tempDir, "test.db");
    cleanup = () => {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    };
  });

  afterEach(() => {
    cleanup();
  });

  function createTestNode(
    db: ReturnType<typeof initDatabase>,
    overrides: Partial<Node> = {},
  ): Node {
    const node: Node = {
      id: crypto.randomUUID(),
      namespace_id: overrides.namespace_id ?? "docs",
      type: (overrides.type ?? "document") as NodeType,
      title: overrides.title ?? "Test Node",
      description: overrides.description ?? "",
      status: (overrides.status ?? "BACKLOG") as NodeStatus,
      labels: overrides.labels ?? [],
      metadata: overrides.metadata ?? {},
      parentId: overrides.parentId,
      created_at: overrides.created_at ?? new Date().toISOString(),
      updated_at: overrides.updated_at ?? new Date().toISOString(),
    };

    const stmt = db.prepare(`
      INSERT INTO nodes (id, namespace_id, type, title, description, status, labels, metadata, parent_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      node.id,
      node.namespace_id,
      node.type,
      node.title,
      node.description,
      node.status,
      JSON.stringify(node.labels),
      JSON.stringify(node.metadata),
      node.parentId ?? null,
      node.created_at,
      node.updated_at,
    );

    return node;
  }

  describe("basic search", () => {
    it("should find nodes by title", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, { title: "Authentication System" });
      createTestNode(db, { title: "User Profile" });

      const result = engine.search("authentication");

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.title).toBe("Authentication System");
      expect(result.total).toBe(1);
    });

    it("should find nodes by description", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, {
        title: "Feature X",
        description: "Implements OAuth2 authentication flow",
      });

      const result = engine.search("oauth2");

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.title).toBe("Feature X");
    });

    it("should find nodes by labels", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, {
        title: "Bug Fix",
        labels: ["bug", "critical", "backend"],
      });

      const result = engine.search("critical");

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.title).toBe("Bug Fix");
    });

    it("should return multiple matching results", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, { title: "API Documentation" });
      createTestNode(db, { title: "API Design Guide" });
      createTestNode(db, { title: "User Manual" });

      const result = engine.search("api");

      expect(result.results).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe("empty search handling", () => {
    it("should return empty results with suggestion for empty query", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, { title: "Some Node" });

      const result = engine.search("");

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.suggestion).toContain("Enter search terms");
    });

    it("should return empty results with suggestion for whitespace-only query", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      const result = engine.search("   ");

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.suggestion).toBeDefined();
    });
  });

  describe("filtering", () => {
    it("should filter by namespace", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, {
        namespace_id: "docs",
        title: "Documentation Page",
      });
      createTestNode(db, {
        namespace_id: "plan",
        title: "Planning Item",
      });

      const result = engine.search("page", { namespaceId: "docs" });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.namespace_id).toBe("docs");
    });

    it("should filter by type", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, {
        type: "feature",
        title: "New Feature",
      });
      createTestNode(db, {
        type: "task",
        title: "Subtask",
      });

      const result = engine.search("feature", { types: ["feature"] });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.type).toBe("feature");
    });

    it("should filter by status", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, {
        title: "In Progress Work",
        status: "IN_PROGRESS",
      });
      createTestNode(db, {
        title: "Backlog Item",
        status: "BACKLOG",
      });

      const result = engine.search("work", { status: ["IN_PROGRESS"] });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.status).toBe("IN_PROGRESS");
    });

    it("should apply limit", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      for (let i = 0; i < 10; i++) {
        createTestNode(db, { title: `Item ${i}` });
      }

      const result = engine.search("item", { limit: 5 });

      expect(result.results).toHaveLength(5);
      expect(result.total).toBe(10);
    });

    it("should enforce max limit of 100", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      for (let i = 0; i < 150; i++) {
        createTestNode(db, { title: `Item ${i}` });
      }

      const result = engine.search("item", { limit: 200 });

      expect(result.results.length).toBeLessThanOrEqual(100);
    });
  });

  describe("FTS5 trigger sync", () => {
    it("should reflect inserted nodes in search", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, { title: "Newly Created Node" });

      const result = engine.search("newly");

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.title).toBe("Newly Created Node");
    });

    it("should reflect updated nodes in search", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      const node = createTestNode(db, { title: "Original Title" });

      const updateStmt = db.prepare(`
        UPDATE nodes SET title = ?, updated_at = ? WHERE id = ?
      `);
      updateStmt.run("Updated Title", new Date().toISOString(), node.id);

      const result = engine.search("updated");

      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.node.title).toBe("Updated Title");

      const oldResult = engine.search("original");
      expect(oldResult.results).toHaveLength(0);
    });

    it("should reflect deleted nodes in search", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      const node = createTestNode(db, { title: "To Be Deleted" });

      expect(engine.search("deleted").results).toHaveLength(1);

      const deleteStmt = db.prepare("DELETE FROM nodes WHERE id = ?");
      deleteStmt.run(node.id);

      const result = engine.search("deleted");
      expect(result.results).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle invalid FTS5 syntax gracefully", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, { title: "Test Node" });

      const result = engine.search("NOT");

      expect(result.results).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it("should handle queries with quotes", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, { title: 'Node with "quotes"' });

      const result = engine.search('"quotes"');

      expect(result.results).toBeDefined();
    });
  });

  describe("ranking and snippets", () => {
    it("should return results with rank", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, { title: "Important Feature" });

      const result = engine.search("feature");

      expect(result.results[0]!.rank).toBeGreaterThan(0);
    });

    it("should return snippets", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      createTestNode(db, {
        title: "Feature X",
        description: "This is a detailed description of the feature",
      });

      const result = engine.search("feature");

      expect(result.results[0]!.snippet).toBeDefined();
      expect(result.results[0]!.snippet.length).toBeGreaterThan(0);
    });

    it("should apply freshness boost to recent updates", () => {
      const db = initDatabase(dbPath);
      const engine = new SearchEngine(db);

      const now = new Date().toISOString();
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

      createTestNode(db, {
        title: "Recent Node",
        updated_at: now,
      });
      createTestNode(db, {
        title: "Old Node",
        updated_at: oldDate,
      });

      const result = engine.search("node");

      expect(result.results).toHaveLength(2);
      expect(result.results[0]!.rank).toBeGreaterThanOrEqual(result.results[1]!.rank);
    });
  });
});
