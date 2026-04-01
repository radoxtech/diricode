import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { migration005 } from "../db/migrations/005_sessions_and_messages.js";
import { initSchemaVersions } from "../db/schema/version.js";
import { SessionRepository } from "../db/repositories/SessionRepository.js";
import { InvalidSessionTransition } from "../db/schemas/session.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchemaVersions(db);
  migration005.up(db);
  return db;
}

describe("SessionRepository", () => {
  let db: Database.Database;
  let repo: SessionRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new SessionRepository(db);
  });

  describe("create()", () => {
    it("creates a session with status 'created' and default metadata", () => {
      const session = repo.create({ id: "sess-1" });
      expect(session.id).toBe("sess-1");
      expect(session.status).toBe("created");
      expect(session.metadata).toEqual({});
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it("creates a session with custom metadata", () => {
      const session = repo.create({
        id: "sess-2",
        metadata: { agent: "planner", priority: 1 },
      });
      expect(session.metadata).toEqual({ agent: "planner", priority: 1 });
    });

    it("rejects duplicate session id", () => {
      repo.create({ id: "sess-dup" });
      expect(() => repo.create({ id: "sess-dup" })).toThrow();
    });
  });

  describe("getById()", () => {
    it("returns the session when found", () => {
      repo.create({ id: "sess-1" });
      const found = repo.getById("sess-1");
      expect(found).toBeDefined();
      expect(found?.id).toBe("sess-1");
    });

    it("returns undefined when not found", () => {
      expect(repo.getById("nonexistent")).toBeUndefined();
    });
  });

  describe("updateStatus()", () => {
    it("transitions created → active", () => {
      repo.create({ id: "sess-1" });
      repo.updateStatus("sess-1", "active");
      expect(repo.getById("sess-1")?.status).toBe("active");
    });

    it("transitions created → active → completed", () => {
      repo.create({ id: "sess-1" });
      repo.updateStatus("sess-1", "active");
      repo.updateStatus("sess-1", "completed");
      expect(repo.getById("sess-1")?.status).toBe("completed");
    });

    it("transitions completed → archived", () => {
      repo.create({ id: "sess-1" });
      repo.updateStatus("sess-1", "active");
      repo.updateStatus("sess-1", "completed");
      repo.updateStatus("sess-1", "archived");
      expect(repo.getById("sess-1")?.status).toBe("archived");
    });

    it("rejects invalid transition created → completed", () => {
      repo.create({ id: "sess-1" });
      expect(() => {
        repo.updateStatus("sess-1", "completed");
      }).toThrow(InvalidSessionTransition);
    });

    it("rejects invalid transition active → archived", () => {
      repo.create({ id: "sess-1" });
      repo.updateStatus("sess-1", "active");
      expect(() => {
        repo.updateStatus("sess-1", "archived");
      }).toThrow(InvalidSessionTransition);
    });

    it("rejects transition from archived (terminal state)", () => {
      repo.create({ id: "sess-1" });
      repo.updateStatus("sess-1", "active");
      repo.updateStatus("sess-1", "completed");
      repo.updateStatus("sess-1", "archived");
      expect(() => {
        repo.updateStatus("sess-1", "active");
      }).toThrow(InvalidSessionTransition);
    });

    it("throws for nonexistent session", () => {
      expect(() => {
        repo.updateStatus("nonexistent", "active");
      }).toThrow("not found");
    });

    it("updates the updatedAt timestamp", async () => {
      repo.create({ id: "sess-1" });
      const sessionBefore = repo.getById("sess-1");
      expect(sessionBefore).toBeDefined();
      const before = sessionBefore?.updatedAt;
      await new Promise((r) => setTimeout(r, 1100));
      repo.updateStatus("sess-1", "active");
      const sessionAfter = repo.getById("sess-1");
      expect(sessionAfter).toBeDefined();
      const after = sessionAfter?.updatedAt;
      expect(after).not.toBe(before);
    });
  });

  describe("updateMetadata()", () => {
    it("updates session metadata", () => {
      repo.create({ id: "sess-1", metadata: { key: "old" } });
      repo.updateMetadata("sess-1", { key: "new", extra: true });
      const session = repo.getById("sess-1");
      expect(session).toBeDefined();
      expect(session?.metadata).toEqual({ key: "new", extra: true });
    });
  });

  describe("list()", () => {
    it("returns all sessions ordered by createdAt", () => {
      repo.create({ id: "sess-1" });
      repo.create({ id: "sess-2" });
      repo.create({ id: "sess-3" });
      const sessions = repo.list();
      expect(sessions).toHaveLength(3);
      expect(sessions.map((s) => s.id)).toEqual(["sess-1", "sess-2", "sess-3"]);
    });

    it("filters by status", () => {
      repo.create({ id: "sess-1" });
      repo.create({ id: "sess-2" });
      repo.updateStatus("sess-1", "active");
      const active = repo.list({ status: "active" });
      expect(active).toHaveLength(1);
      const first = active[0];
      expect(first?.id).toBe("sess-1");
    });

    it("supports pagination with limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        repo.create({ id: `sess-${String(i)}` });
      }
      const page1 = repo.list({ limit: 2, offset: 0 });
      const page2 = repo.list({ limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1.map((s) => s.id)).toEqual(["sess-0", "sess-1"]);
      expect(page2.map((s) => s.id)).toEqual(["sess-2", "sess-3"]);
    });

    it("returns empty array when no sessions match filter", () => {
      repo.create({ id: "sess-1" });
      const archived = repo.list({ status: "archived" });
      expect(archived).toHaveLength(0);
    });
  });
});
