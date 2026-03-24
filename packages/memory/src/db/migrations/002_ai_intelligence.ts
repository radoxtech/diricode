import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration002: Migration & { down: (db: Database) => void } = {
  version: 2,
  description: "ai_intelligence",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_scores (
        model_id        TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        task_type       TEXT NOT NULL,
        elo_rating      REAL DEFAULT 1000.0,
        match_count     INTEGER DEFAULT 0,
        avg_latency_ms  REAL,
        avg_cost_usd    REAL,
        success_rate    REAL,
        last_updated    DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (model_id, subscription_id, task_type)
      );

      CREATE TABLE IF NOT EXISTS ab_experiments (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        status            TEXT CHECK(status IN ('active', 'paused', 'completed')),
        task_filter_json  TEXT,
        min_matches       INTEGER DEFAULT 50,
        cost_cap_usd      REAL,
        current_spend_usd REAL DEFAULT 0,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at      DATETIME
      );

      CREATE TABLE IF NOT EXISTS comparisons (
        id              TEXT PRIMARY KEY,
        experiment_id   TEXT,
        task_id         TEXT NOT NULL,
        task_type       TEXT NOT NULL,
        winner_model_id TEXT,
        winner_sub_id   TEXT,
        loser_model_id  TEXT,
        loser_sub_id    TEXT,
        is_draw         BOOLEAN DEFAULT 0,
        signal_source   TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id)
      );
    `);
  },
  down(db: Database): void {
    db.exec(`
      DROP TABLE IF EXISTS comparisons;
      DROP TABLE IF EXISTS ab_experiments;
      DROP TABLE IF EXISTS model_scores;
    `);
  },
};
