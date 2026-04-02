import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { migration001 } from "../db/migrations/001_initial_schema.js";
import { migration005 } from "../db/migrations/005_sessions_and_messages.js";
import { migration006 } from "../db/migrations/006_fts5_search.js";
import { initSchemaVersions } from "../db/schema/version.js";
import { ObservationRepository } from "../db/repositories/ObservationRepository.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchemaVersions(db);
  migration001.up(db);
  migration005.up(db);
  migration006.up(db);
  return db;
}

describe("ObservationRepository", () => {
  let db: Database.Database;
  let repo: ObservationRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new ObservationRepository(db);
  });

  describe("appendObservation()", () => {
    it("inserts an observation and returns it with an assigned id", () => {
      const obs = repo.appendObservation({
        type: "file_read",
        content: "Read file src/index.ts",
      });
      expect(obs.id).toBeTypeOf("number");
      expect(obs.id).toBeGreaterThan(0);
      expect(obs.type).toBe("file_read");
      expect(obs.content).toBe("Read file src/index.ts");
      expect(obs.metadata).toEqual({});
      expect(obs.createdAt).toBeDefined();
    });

    it("stores optional fields when provided", () => {
      const obs = repo.appendObservation({
        type: "decision",
        content: "Chose to refactor module X",
        sessionId: "sess-1",
        agentId: "agent-1",
        taskId: "task-1",
        metadata: { confidence: 0.9 },
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(obs.sessionId).toBe("sess-1");
      expect(obs.agentId).toBe("agent-1");
      expect(obs.taskId).toBe("task-1");
      expect(obs.metadata).toEqual({ confidence: 0.9 });
      expect(obs.timestamp).toBe("2026-01-01T00:00:00.000Z");
    });

    it("assigns auto-incrementing integer ids", () => {
      const obs1 = repo.appendObservation({ type: "discovery", content: "Found pattern A" });
      const obs2 = repo.appendObservation({ type: "discovery", content: "Found pattern B" });
      expect(obs2.id).toBeGreaterThan(obs1.id);
    });

    it("rejects invalid observation type", () => {
      expect(() =>
        repo.appendObservation({
          type: "invalid_type" as "file_read",
          content: "some content",
        }),
      ).toThrow();
    });

    it("rejects empty content", () => {
      expect(() =>
        repo.appendObservation({
          type: "error",
          content: "",
        }),
      ).toThrow();
    });
  });

  describe("getTimeline()", () => {
    beforeEach(() => {
      repo.appendObservation({
        type: "file_read",
        content: "Read A",
        sessionId: "sess-1",
        agentId: "agent-1",
        taskId: "task-1",
        timestamp: "2026-01-01T00:01:00.000Z",
      });
      repo.appendObservation({
        type: "file_write",
        content: "Write B",
        sessionId: "sess-1",
        agentId: "agent-2",
        taskId: "task-1",
        timestamp: "2026-01-01T00:02:00.000Z",
      });
      repo.appendObservation({
        type: "command_run",
        content: "Run C",
        sessionId: "sess-2",
        agentId: "agent-1",
        taskId: "task-2",
        timestamp: "2026-01-01T00:03:00.000Z",
      });
    });

    it("returns all observations when no filter is provided", () => {
      const timeline = repo.getTimeline();
      expect(timeline).toHaveLength(3);
    });

    it("filters by sessionId", () => {
      const timeline = repo.getTimeline({ sessionId: "sess-1" });
      expect(timeline).toHaveLength(2);
      for (const obs of timeline) {
        expect(obs.sessionId).toBe("sess-1");
      }
    });

    it("filters by agentId", () => {
      const timeline = repo.getTimeline({ agentId: "agent-1" });
      expect(timeline).toHaveLength(2);
      for (const obs of timeline) {
        expect(obs.agentId).toBe("agent-1");
      }
    });

    it("filters by taskId", () => {
      const timeline = repo.getTimeline({ taskId: "task-2" });
      expect(timeline).toHaveLength(1);
      expect(timeline[0]?.taskId).toBe("task-2");
    });

    it("filters by type", () => {
      const timeline = repo.getTimeline({ type: "file_write" });
      expect(timeline).toHaveLength(1);
      expect(timeline[0]?.type).toBe("file_write");
    });

    it("filters by fromTimestamp (inclusive)", () => {
      const timeline = repo.getTimeline({ fromTimestamp: "2026-01-01T00:02:00.000Z" });
      expect(timeline).toHaveLength(2);
    });

    it("filters by toTimestamp (inclusive)", () => {
      const timeline = repo.getTimeline({ toTimestamp: "2026-01-01T00:02:00.000Z" });
      expect(timeline).toHaveLength(2);
    });

    it("AND-composes multiple filters", () => {
      const timeline = repo.getTimeline({
        sessionId: "sess-1",
        type: "file_write",
      });
      expect(timeline).toHaveLength(1);
      expect(timeline[0]?.content).toBe("Write B");
    });

    it("returns empty array when no observations match", () => {
      const timeline = repo.getTimeline({ sessionId: "nonexistent-session" });
      expect(timeline).toHaveLength(0);
    });

    it("returns results ordered by created_at ascending", () => {
      const timeline = repo.getTimeline();
      const contents = timeline.map((o) => o.content);
      expect(contents).toEqual(["Read A", "Write B", "Run C"]);
    });
  });
});
