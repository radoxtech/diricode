import type { Database } from "better-sqlite3";
import type { Migration } from "./runner.js";

export const migration010: Migration = {
  version: 10,
  description: "local issue system with FTS5 search",
  up(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','done','closed')),
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical','high','medium','low')),
        labels TEXT DEFAULT '[]',
        parent_id TEXT REFERENCES issues(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
      CREATE INDEX IF NOT EXISTS idx_issues_parent_id ON issues(parent_id);
      CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
      CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
    `);

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS issues_fts USING fts5(
        title, description,
        content=issues,
        content_rowid=rowid,
        tokenize='unicode61'
      );
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS issues_fts_insert AFTER INSERT ON issues BEGIN
        INSERT INTO issues_fts(rowid, title, description)
        VALUES (new.rowid, new.title, COALESCE(new.description, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS issues_fts_delete AFTER DELETE ON issues BEGIN
        INSERT INTO issues_fts(issues_fts, rowid, title, description)
        VALUES ('delete', old.rowid, old.title, COALESCE(old.description, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS issues_fts_update AFTER UPDATE ON issues BEGIN
        INSERT INTO issues_fts(issues_fts, rowid, title, description)
        VALUES ('delete', old.rowid, old.title, COALESCE(old.description, ''));
        INSERT INTO issues_fts(rowid, title, description)
        VALUES (new.rowid, new.title, COALESCE(new.description, ''));
      END;
    `);
  },
};
