import type { Database } from "better-sqlite3";
import { calculateElo, DEFAULT_ELO } from "../elo.js";

interface ModelScoreRow {
  model_id: string;
  subscription_id: string;
  task_type: string;
  elo_rating: number;
  match_count: number;
}

export class ModelScoreRepository {
  constructor(private readonly db: Database) {}

  private getOrCreate(modelId: string, taskType: string): ModelScoreRow {
    if (!modelId || !taskType) {
      throw new Error("modelId and taskType must be non-empty strings");
    }

    const existing = this.db
      .prepare<[string, string, string], ModelScoreRow>(
        `SELECT model_id, subscription_id, task_type, elo_rating, match_count
           FROM model_scores
          WHERE model_id = ? AND subscription_id = ? AND task_type = ?`,
      )
      .get(modelId, "default", taskType);

    if (existing) return existing;

    this.db
      .prepare(
        `INSERT INTO model_scores (model_id, subscription_id, task_type, elo_rating, match_count)
         VALUES (?, ?, ?, ?, 0)`,
      )
      .run(modelId, "default", taskType, DEFAULT_ELO);

    return {
      model_id: modelId,
      subscription_id: "default",
      task_type: taskType,
      elo_rating: DEFAULT_ELO,
      match_count: 0,
    };
  }

  recordMatch(winnerId: string, loserId: string, taskType: string): void {
    if (!winnerId || !loserId || !taskType) {
      throw new Error("winnerId, loserId, and taskType must be non-empty strings");
    }
    if (winnerId === loserId) {
      throw new Error("winnerId and loserId must be different");
    }

    const update = this.db.prepare<[number, string, string, string]>(
      `UPDATE model_scores
          SET elo_rating = ?, match_count = match_count + 1, last_updated = CURRENT_TIMESTAMP
        WHERE model_id = ? AND subscription_id = ? AND task_type = ?`,
    );

    const tx = this.db.transaction(() => {
      const winner = this.getOrCreate(winnerId, taskType);
      const loser = this.getOrCreate(loserId, taskType);

      const { newWinnerRating, newLoserRating } = calculateElo(
        winner.elo_rating,
        loser.elo_rating,
        winner.match_count,
        loser.match_count,
      );

      update.run(newWinnerRating, winnerId, "default", taskType);
      update.run(newLoserRating, loserId, "default", taskType);
    });

    tx();
  }

  getScore(modelId: string, taskType: string): ModelScoreRow | undefined {
    return this.db
      .prepare<[string, string, string], ModelScoreRow>(
        `SELECT model_id, subscription_id, task_type, elo_rating, match_count
           FROM model_scores
          WHERE model_id = ? AND subscription_id = ? AND task_type = ?`,
      )
      .get(modelId, "default", taskType);
  }
}
