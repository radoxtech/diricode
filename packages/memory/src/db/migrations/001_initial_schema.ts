import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration001: Migration = {
  version: 1,
  description: "initial schema",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS observations (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        type       TEXT NOT NULL,
        content    TEXT NOT NULL,
        metadata   TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS timeline_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type  TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        payload     TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
};
