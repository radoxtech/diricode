import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { migration001 } from "../db/migrations/001_initial_schema.js";
import { migration005 } from "../db/migrations/005_sessions_and_messages.js";
import { migration006 } from "../db/migrations/006_fts5_search.js";
import { initSchemaVersions } from "../db/schema/version.js";
import { SearchRepository } from "../db/repositories/SearchRepository.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchemaVersions(db);
  migration001.up(db);
  migration005.up(db);
  migration006.up(db);
  return db;
}

describe("SearchRepository", () => {
  let db: Database.Database;
  let repo: SearchRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new SearchRepository(db);
  });

  function insertSession(id: string) {
    db.prepare("INSERT INTO sessions (id, status, metadata) VALUES (?, 'active', '{}')").run(id);
  }

  function insertMessage(id: string, sessionId: string, content: string, agentId?: string) {
    db.prepare(
      "INSERT INTO messages (id, session_id, role, content, tokens, cost, agent_id, timestamp) VALUES (?, ?, 'user', ?, 0, 0, ?, datetime('now'))",
    ).run(id, sessionId, content, agentId ?? null);
  }

  function insertObservation(content: string, sessionId?: string, agentId?: string, type?: string) {
    db.prepare(
      "INSERT INTO observations (type, content, session_id, agent_id, timestamp) VALUES (?, ?, ?, ?, datetime('now'))",
    ).run(type ?? "discovery", content, sessionId ?? null, agentId ?? null);
  }

  describe("search()", () => {
    it("returns empty for empty query", () => {
      const results = repo.search("");
      expect(results).toEqual([]);
    });

    it("returns empty for whitespace-only query", () => {
      const results = repo.search("   ");
      expect(results).toEqual([]);
    });

    it("finds matching messages", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "how to implement authentication in express");
      insertMessage("m2", "s1", "the database schema is ready");

      const results = repo.search("authentication");
      expect(results).toHaveLength(1);
      expect(results[0]?.source).toBe("message");
      expect(results[0]?.content).toContain("authentication");
      expect(results[0]?.excerpt).toBeDefined();
      expect(results[0]?.score).toBeDefined();
    });

    it("finds matching observations", () => {
      insertObservation("discovered a performance bottleneck in the query engine");

      const results = repo.search("performance bottleneck");
      expect(results).toHaveLength(1);
      expect(results[0]?.source).toBe("observation");
      expect(results[0]?.content).toContain("performance bottleneck");
    });

    it("returns results from both messages and observations", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "the refactoring improved error handling");
      insertObservation("file read error handling pattern discovered");

      const results = repo.search("error handling");
      expect(results.length).toBeGreaterThanOrEqual(2);

      const sources = results.map((r) => r.source);
      expect(sources).toContain("message");
      expect(sources).toContain("observation");
    });

    it("sorts results by BM25 score (ascending — lower is better match)", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "error handling middleware");
      insertMessage("m2", "s1", "comprehensive error handling guide with examples and patterns");

      const results = repo.search("error handling");
      expect(results.length).toBeGreaterThanOrEqual(1);

      const scores = results.map((r) => r.score);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
      }
    });

    it("respects limit filter", () => {
      insertSession("s1");
      for (let i = 0; i < 5; i++) {
        insertMessage(`m${String(i)}`, "s1", "searchable content about testing patterns");
      }

      const results = repo.search("testing patterns", { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("handles FTS5 special characters gracefully", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "normal content about typescript");

      expect(() => repo.search("test OR something")).not.toThrow();
    });
  });

  describe("search() with filters", () => {
    it("filters by sessionId", () => {
      insertSession("s1");
      insertSession("s2");
      insertMessage("m1", "s1", "unique keyword alpha in session one");
      insertMessage("m2", "s2", "unique keyword alpha in session two");
      insertObservation("unique keyword alpha in observation");

      const results = repo.search("unique keyword alpha", { sessionId: "s1" });
      expect(results).toHaveLength(1);
      expect(results[0]?.sessionId).toBe("s1");
    });

    it("filters by agentId", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "agent work on parser", "agent-A");
      insertMessage("m2", "s1", "agent work on parser", "agent-B");

      const results = repo.search("parser", { agentId: "agent-A" });
      expect(results).toHaveLength(1);
      expect(results[0]?.agentId).toBe("agent-A");
    });

    it("filters by observationType", () => {
      insertObservation("file read detected configuration issue", "s1", undefined, "file_read");
      insertObservation(
        "decision made about architecture refactoring",
        "s1",
        undefined,
        "decision",
      );

      const results = repo.search("configuration issue", { observationType: "file_read" });
      const obsResults = results.filter((r) => r.source === "observation");
      expect(obsResults).toHaveLength(1);
      expect(obsResults[0]?.observationType).toBe("file_read");
    });

    it("applies multiple filters together", () => {
      insertSession("s1");
      insertSession("s2");
      insertMessage("m1", "s1", "database optimization query", "agent-X");
      insertMessage("m2", "s2", "database optimization query", "agent-X");
      insertObservation("database optimization pattern found", "s1", "agent-X", "discovery");

      const results = repo.search("database optimization", {
        sessionId: "s1",
        agentId: "agent-X",
      });
      for (const r of results) {
        expect(r.sessionId).toBe("s1");
        expect(r.agentId).toBe("agent-X");
      }
    });
  });

  describe("search() incrementality", () => {
    it("indexes new messages inserted after migration", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "before search setup");

      const results = repo.search("before search");
      expect(results).toHaveLength(1);
      expect(results[0]?.source).toBe("message");
    });

    it("indexes new observations inserted after migration", () => {
      insertObservation("after migration observation");

      const results = repo.search("after migration");
      expect(results).toHaveLength(1);
      expect(results[0]?.source).toBe("observation");
    });

    it("updates FTS index when message content changes", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "original content about fishing");

      const before = repo.search("fishing");
      expect(before).toHaveLength(1);

      db.prepare("UPDATE messages SET content = ? WHERE id = ?").run(
        "updated content about hunting",
        "m1",
      );

      const afterFishing = repo.search("fishing");
      expect(afterFishing).toHaveLength(0);

      const afterHunting = repo.search("hunting");
      expect(afterHunting).toHaveLength(1);
    });

    it("removes from FTS index when message is deleted", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "deletable content about swimming");

      const before = repo.search("swimming");
      expect(before).toHaveLength(1);

      db.prepare("DELETE FROM messages WHERE id = ?").run("m1");

      const after = repo.search("swimming");
      expect(after).toHaveLength(0);
    });

    it("updates FTS index when observation content changes", () => {
      insertObservation("temporary observation about cooking");

      const before = repo.search("cooking");
      expect(before).toHaveLength(1);

      db.prepare("UPDATE observations SET content = ? WHERE id = ?").run(
        "permanent observation about baking",
        1,
      );

      const afterCooking = repo.search("cooking");
      expect(afterCooking).toHaveLength(0);

      const afterBaking = repo.search("baking");
      expect(afterBaking).toHaveLength(1);
    });
  });

  describe("search() excerpt generation", () => {
    it("returns excerpt with match context", () => {
      insertSession("s1");
      insertMessage(
        "m1",
        "s1",
        "the authentication system uses JWT tokens for secure access control in the application layer",
      );

      const results = repo.search("JWT tokens");
      expect(results).toHaveLength(1);
      expect(results[0]?.excerpt).toBeDefined();
      expect(results[0]?.excerpt.length).toBeGreaterThan(0);
      expect(results[0]?.excerpt.length).toBeLessThanOrEqual(results[0]?.content.length ?? 0);
    });
  });

  describe("search() with quoted phrases", () => {
    it("searches exact phrases with balanced quotes", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "the quick brown fox jumps over the lazy dog");

      const results = repo.search('"quick brown fox"');
      expect(results).toHaveLength(1);
    });

    it("handles unbalanced quotes by stripping them", () => {
      insertSession("s1");
      insertMessage("m1", "s1", "normal content about typescript patterns");

      expect(() => repo.search('"unbalanced quote')).not.toThrow();
    });
  });
});
