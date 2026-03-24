import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { calculateElo, expectedScore, getKFactor, DEFAULT_ELO } from "../db/elo.js";
import { ModelScoreRepository } from "../db/repositories/ModelScoreRepository.js";
import { migration002 } from "../db/migrations/002_ai_intelligence.js";
import { initSchemaVersions } from "../db/schema/version.js";

function createInMemoryDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchemaVersions(db);
  migration002.up(db);
  return db;
}

describe("getKFactor", () => {
  it("returns 32 for 0 matches", () => {
    expect(getKFactor(0)).toBe(32);
  });

  it("returns 32 for 29 matches", () => {
    expect(getKFactor(29)).toBe(32);
  });

  it("returns 16 for exactly 30 matches", () => {
    expect(getKFactor(30)).toBe(16);
  });

  it("returns 16 for 100 matches", () => {
    expect(getKFactor(100)).toBe(16);
  });
});

describe("expectedScore", () => {
  it("returns 0.5 when both ratings are equal", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
  });

  it("higher-rated player has expected score > 0.5", () => {
    expect(expectedScore(1200, 800)).toBeGreaterThan(0.5);
  });

  it("lower-rated player has expected score < 0.5", () => {
    expect(expectedScore(800, 1200)).toBeLessThan(0.5);
  });

  it("expected scores of a pair sum to 1.0", () => {
    const e1 = expectedScore(1200, 800);
    const e2 = expectedScore(800, 1200);
    expect(e1 + e2).toBeCloseTo(1.0, 10);
  });

  it("400-point gap yields approx 0.9091 for higher-rated", () => {
    expect(expectedScore(1200, 800)).toBeCloseTo(0.9091, 4);
  });
});

describe("calculateElo — equal ratings", () => {
  it("winner gains 16 points and loser loses 16 points at 1000 vs 1000 (K=32)", () => {
    const { newWinnerRating, newLoserRating } = calculateElo(1000, 1000, 0, 0);
    expect(newWinnerRating).toBeCloseTo(1016, 5);
    expect(newLoserRating).toBeCloseTo(984, 5);
  });

  it("total rating is conserved", () => {
    const { newWinnerRating, newLoserRating } = calculateElo(1000, 1000, 0, 0);
    expect(newWinnerRating + newLoserRating).toBeCloseTo(2000, 5);
  });
});

describe("calculateElo — K-factor scaling", () => {
  it("uses K=32 when both players have < 30 matches", () => {
    const { newWinnerRating } = calculateElo(1000, 1000, 0, 0);
    expect(newWinnerRating).toBeCloseTo(1016, 5);
  });

  it("uses K=16 when winner has >= 30 matches", () => {
    const { newWinnerRating } = calculateElo(1000, 1000, 30, 0);
    expect(newWinnerRating).toBeCloseTo(1008, 5);
  });

  it("uses K=16 when loser has >= 30 matches", () => {
    const { newLoserRating } = calculateElo(1000, 1000, 0, 30);
    expect(newLoserRating).toBeCloseTo(992, 5);
  });
});

describe("calculateElo — higher vs lower rated", () => {
  it("strong upset (800 beats 1200) gives large gain for winner", () => {
    const { newWinnerRating } = calculateElo(800, 1200, 0, 0);
    expect(newWinnerRating).toBeGreaterThan(800 + 28);
  });

  it("expected win (1200 beats 800) gives small gain for winner", () => {
    const { newWinnerRating } = calculateElo(1200, 800, 0, 0);
    expect(newWinnerRating).toBeGreaterThan(1200);
    expect(newWinnerRating).toBeLessThan(1200 + 5);
  });

  it("upset result: winner at 800 beats 1200 — exact values K=32", () => {
    const e = expectedScore(800, 1200);
    const { newWinnerRating, newLoserRating } = calculateElo(800, 1200, 0, 0);
    expect(newWinnerRating).toBeCloseTo(800 + 32 * (1 - e), 5);
    expect(newLoserRating).toBeCloseTo(1200 + 32 * (0 - (1 - e)), 5);
  });
});

describe("ModelScoreRepository", () => {
  let db: ReturnType<typeof createInMemoryDb>;
  let repo: ModelScoreRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    repo = new ModelScoreRepository(db);
  });

  describe("recordMatch — first match auto-creates rows", () => {
    it("creates entries for both models when they do not exist", () => {
      repo.recordMatch("gpt-4o", "claude-3", "code-write");
      const winner = repo.getScore("gpt-4o", "code-write");
      const loser = repo.getScore("claude-3", "code-write");
      expect(winner).toBeDefined();
      expect(loser).toBeDefined();
    });

    it("winner Elo increases from default", () => {
      repo.recordMatch("gpt-4o", "claude-3", "code-write");
      const winner = repo.getScore("gpt-4o", "code-write");
      expect(winner!.elo_rating).toBeGreaterThan(DEFAULT_ELO);
    });

    it("loser Elo decreases from default", () => {
      repo.recordMatch("gpt-4o", "claude-3", "code-write");
      const loser = repo.getScore("claude-3", "code-write");
      expect(loser!.elo_rating).toBeLessThan(DEFAULT_ELO);
    });

    it("match_count is incremented to 1 for both after first match", () => {
      repo.recordMatch("gpt-4o", "claude-3", "code-write");
      expect(repo.getScore("gpt-4o", "code-write")!.match_count).toBe(1);
      expect(repo.getScore("claude-3", "code-write")!.match_count).toBe(1);
    });
  });

  describe("recordMatch — K-factor transitions across matches", () => {
    it("match_count grows correctly after multiple matches", () => {
      for (let i = 0; i < 5; i++) {
        repo.recordMatch("model-a", "model-b", "code-write");
      }
      expect(repo.getScore("model-a", "code-write")!.match_count).toBe(5);
      expect(repo.getScore("model-b", "code-write")!.match_count).toBe(5);
    });

    it("uses K=16 for winner with >= 30 prior matches", () => {
      for (let i = 0; i < 30; i++) {
        repo.recordMatch("model-a", `model-x${i}`, "code-write");
      }
      const scoreBefore = repo.getScore("model-a", "code-write")!.elo_rating;
      repo.recordMatch("model-a", "model-b", "code-write");
      const scoreAfter = repo.getScore("model-a", "code-write")!.elo_rating;
      const delta = scoreAfter - scoreBefore;
      expect(delta).toBeLessThan(16);
    });
  });

  describe("recordMatch — task_type isolation", () => {
    it("matches in different task_types do not affect each other", () => {
      repo.recordMatch("gpt-4o", "claude-3", "code-write");
      const scoreReview = repo.getScore("gpt-4o", "review");
      expect(scoreReview).toBeUndefined();
    });
  });

  describe("recordMatch — input validation", () => {
    it("throws when winnerId is empty", () => {
      expect(() => repo.recordMatch("", "claude-3", "code-write")).toThrow();
    });

    it("throws when loserId is empty", () => {
      expect(() => repo.recordMatch("gpt-4o", "", "code-write")).toThrow();
    });

    it("throws when taskType is empty", () => {
      expect(() => repo.recordMatch("gpt-4o", "claude-3", "")).toThrow();
    });

    it("throws when winnerId === loserId", () => {
      expect(() => repo.recordMatch("gpt-4o", "gpt-4o", "code-write")).toThrow();
    });
  });

  describe("getScore — returns undefined for unknown model", () => {
    it("returns undefined for non-existent model", () => {
      expect(repo.getScore("unknown-model", "code-write")).toBeUndefined();
    });
  });
});
