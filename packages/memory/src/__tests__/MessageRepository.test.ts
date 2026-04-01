import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { migration005 } from "../db/migrations/005_sessions_and_messages.js";
import { initSchemaVersions } from "../db/schema/version.js";
import { MessageRepository } from "../db/repositories/MessageRepository.js";
import { SessionRepository } from "../db/repositories/SessionRepository.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchemaVersions(db);
  migration005.up(db);
  return db;
}

describe("MessageRepository", () => {
  let db: Database.Database;
  let msgRepo: MessageRepository;
  let sessionRepo: SessionRepository;

  beforeEach(() => {
    db = createTestDb();
    msgRepo = new MessageRepository(db);
    sessionRepo = new SessionRepository(db);
    sessionRepo.create({ id: "sess-1" });
  });

  describe("append()", () => {
    it("appends a message to a session", () => {
      const msg = msgRepo.append({
        id: "msg-1",
        sessionId: "sess-1",
        role: "user",
        content: "Hello",
      });
      expect(msg.id).toBe("msg-1");
      expect(msg.sessionId).toBe("sess-1");
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello");
      expect(msg.tokens).toBe(0);
      expect(msg.cost).toBe(0);
      expect(msg.timestamp).toBeDefined();
    });

    it("appends a message with tokens, cost, and agentId", () => {
      const msg = msgRepo.append({
        id: "msg-2",
        sessionId: "sess-1",
        role: "assistant",
        content: "Hi there",
        tokens: 42,
        cost: 0.003,
        agentId: "planner",
      });
      expect(msg.tokens).toBe(42);
      expect(msg.cost).toBe(0.003);
      expect(msg.agentId).toBe("planner");
    });

    it("rejects invalid role", () => {
      expect(() =>
        msgRepo.append({
          id: "msg-bad",
          sessionId: "sess-1",
          role: "invalid" as "user",
          content: "test",
        }),
      ).toThrow();
    });

    it("rejects duplicate message id", () => {
      msgRepo.append({ id: "msg-dup", sessionId: "sess-1", role: "user", content: "a" });
      expect(() =>
        msgRepo.append({ id: "msg-dup", sessionId: "sess-1", role: "user", content: "b" }),
      ).toThrow();
    });

    it("enforces foreign key to sessions", () => {
      expect(() =>
        msgRepo.append({ id: "msg-fk", sessionId: "nonexistent", role: "user", content: "x" }),
      ).toThrow();
    });

    it("supports all valid roles", () => {
      for (const role of ["user", "assistant", "system", "tool"] as const) {
        const msg = msgRepo.append({
          id: `msg-role-${role}`,
          sessionId: "sess-1",
          role,
          content: `test ${role}`,
        });
        expect(msg.role).toBe(role);
      }
    });
  });

  describe("getById()", () => {
    it("returns the message when found", () => {
      msgRepo.append({ id: "msg-1", sessionId: "sess-1", role: "user", content: "hi" });
      const found = msgRepo.getById("msg-1");
      expect(found).toBeDefined();
      expect(found?.content).toBe("hi");
    });

    it("returns undefined when not found", () => {
      expect(msgRepo.getById("nonexistent")).toBeUndefined();
    });
  });

  describe("getBySessionId()", () => {
    it("returns messages in chronological order", () => {
      msgRepo.append({ id: "msg-1", sessionId: "sess-1", role: "system", content: "prompt" });
      msgRepo.append({ id: "msg-2", sessionId: "sess-1", role: "user", content: "hello" });
      msgRepo.append({ id: "msg-3", sessionId: "sess-1", role: "assistant", content: "hi" });

      const messages = msgRepo.getBySessionId("sess-1");
      expect(messages).toHaveLength(3);
      expect(messages.map((m) => m.id)).toEqual(["msg-1", "msg-2", "msg-3"]);
    });

    it("returns empty array for session with no messages", () => {
      expect(msgRepo.getBySessionId("sess-1")).toEqual([]);
    });
  });

  describe("getBySessionIdPaginated()", () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        msgRepo.append({
          id: `msg-${String(i)}`,
          sessionId: "sess-1",
          role: "user",
          content: `message ${String(i)}`,
        });
      }
    });

    it("returns first page with default page size", () => {
      const result = msgRepo.getBySessionIdPaginated("sess-1");
      expect(result.messages).toHaveLength(10);
      expect(result.hasMore).toBe(false);
    });

    it("returns paginated results with custom page size", () => {
      const result = msgRepo.getBySessionIdPaginated("sess-1", { pageSize: 4 });
      expect(result.messages).toHaveLength(4);
      expect(result.hasMore).toBe(true);
      expect(result.messages.map((m) => m.id)).toEqual(["msg-0", "msg-1", "msg-2", "msg-3"]);
    });

    it("returns next page using cursor", () => {
      const page1 = msgRepo.getBySessionIdPaginated("sess-1", { pageSize: 4 });
      const lastMsg = page1.messages[page1.messages.length - 1];
      if (!lastMsg) throw new Error("Expected messages");

      const page2 = msgRepo.getBySessionIdPaginated("sess-1", {
        cursor: { lastTimestamp: lastMsg.timestamp, lastId: lastMsg.id },
        pageSize: 4,
      });

      expect(page2.messages).toHaveLength(4);
      expect(page2.messages.map((m) => m.id)).toEqual(["msg-4", "msg-5", "msg-6", "msg-7"]);
      expect(page2.hasMore).toBe(true);
    });

    it("returns last page with hasMore=false", () => {
      const page1 = msgRepo.getBySessionIdPaginated("sess-1", { pageSize: 4 });
      const last1 = page1.messages[page1.messages.length - 1];
      if (!last1) throw new Error("Expected messages");

      const page2 = msgRepo.getBySessionIdPaginated("sess-1", {
        cursor: { lastTimestamp: last1.timestamp, lastId: last1.id },
        pageSize: 4,
      });
      const last2 = page2.messages[page2.messages.length - 1];
      if (!last2) throw new Error("Expected messages");

      const page3 = msgRepo.getBySessionIdPaginated("sess-1", {
        cursor: { lastTimestamp: last2.timestamp, lastId: last2.id },
        pageSize: 4,
      });
      expect(page3.messages).toHaveLength(2);
      expect(page3.hasMore).toBe(false);
      expect(page3.messages.map((m) => m.id)).toEqual(["msg-8", "msg-9"]);
    });

    it("returns empty for session with no messages", () => {
      sessionRepo.create({ id: "sess-empty" });
      const result = msgRepo.getBySessionIdPaginated("sess-empty");
      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("CASCADE delete", () => {
    it("deletes messages when session is deleted", () => {
      msgRepo.append({ id: "msg-1", sessionId: "sess-1", role: "user", content: "hi" });
      msgRepo.append({ id: "msg-2", sessionId: "sess-1", role: "assistant", content: "hello" });

      db.prepare("DELETE FROM sessions WHERE id = ?").run("sess-1");
      expect(msgRepo.getBySessionId("sess-1")).toEqual([]);
    });
  });
});
