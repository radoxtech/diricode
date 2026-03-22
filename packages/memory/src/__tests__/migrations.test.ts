import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { migration002 } from "../db/migrations/002_ai_intelligence.js";
import { initSchemaVersions } from "../db/schema/version.js";

function createInMemoryDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchemaVersions(db);
  return db;
}

describe("migration002 (ai_intelligence)", () => {
  let db: ReturnType<typeof createInMemoryDb>;

  beforeEach(() => {
    db = createInMemoryDb();
  });

  it("has version 2 and description 'ai_intelligence'", () => {
    expect(migration002.version).toBe(2);
    expect(migration002.description).toBe("ai_intelligence");
  });

  describe("up()", () => {
    it("creates the model_scores table", () => {
      migration002.up(db);
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_scores'")
        .get();
      expect(row).toBeDefined();
    });

    it("creates the ab_experiments table", () => {
      migration002.up(db);
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ab_experiments'")
        .get();
      expect(row).toBeDefined();
    });

    it("creates the comparisons table", () => {
      migration002.up(db);
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comparisons'")
        .get();
      expect(row).toBeDefined();
    });

    it("model_scores accepts a row with all columns", () => {
      migration002.up(db);
      expect(() => {
        db.prepare(
          `INSERT INTO model_scores
            (model_id, subscription_id, task_type, elo_rating, match_count, avg_latency_ms, avg_cost_usd, success_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run("gpt-4o", "sub-1", "code-write", 1050.5, 10, 320.1, 0.002, 0.95);
      }).not.toThrow();
    });

    it("ab_experiments enforces status CHECK constraint", () => {
      migration002.up(db);
      expect(() => {
        db.prepare(`INSERT INTO ab_experiments (id, name, status) VALUES (?, ?, ?)`).run(
          "exp-1",
          "test-exp",
          "invalid_status",
        );
      }).toThrow();
    });

    it("ab_experiments accepts valid status values", () => {
      migration002.up(db);
      for (const status of ["active", "paused", "completed"]) {
        expect(() => {
          db.prepare(`INSERT INTO ab_experiments (id, name, status) VALUES (?, ?, ?)`).run(
            `exp-${status}`,
            `exp-${status}`,
            status,
          );
        }).not.toThrow();
      }
    });

    it("comparisons enforces foreign key to ab_experiments", () => {
      migration002.up(db);
      expect(() => {
        db.prepare(
          `INSERT INTO comparisons
            (id, experiment_id, task_id, task_type)
           VALUES (?, ?, ?, ?)`,
        ).run("cmp-1", "nonexistent-exp", "task-1", "code-write");
      }).toThrow();
    });

    it("comparisons allows null experiment_id (standalone comparison)", () => {
      migration002.up(db);
      expect(() => {
        db.prepare(
          `INSERT INTO comparisons
            (id, experiment_id, task_id, task_type, winner_model_id, winner_sub_id, loser_model_id, loser_sub_id, signal_source)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          "cmp-1",
          "task-1",
          "code-write",
          "gpt-4o",
          "sub-1",
          "claude-3",
          "sub-2",
          "automated-test",
        );
      }).not.toThrow();
    });

    it("is idempotent — running up() twice does not throw (IF NOT EXISTS)", () => {
      migration002.up(db);
      expect(() => migration002.up(db)).not.toThrow();
    });
  });

  describe("down()", () => {
    it("drops comparisons, ab_experiments, and model_scores tables", () => {
      migration002.up(db);
      migration002.down(db);

      for (const table of ["comparisons", "ab_experiments", "model_scores"]) {
        const row = db
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
          .get(table);
        expect(row).toBeUndefined();
      }
    });

    it("down() is idempotent — running twice does not throw (IF EXISTS)", () => {
      migration002.up(db);
      migration002.down(db);
      expect(() => migration002.down(db)).not.toThrow();
    });
  });
});
