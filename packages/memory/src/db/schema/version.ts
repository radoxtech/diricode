import type { Database } from "better-sqlite3";

export function initSchemaVersions(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT
    )
  `);
}

export function getCurrentVersion(db: Database): number {
  const row = db
    .prepare<[], { version: number | null }>(
      "SELECT MAX(version) AS version FROM schema_versions"
    )
    .get();
  return row?.version ?? 0;
}

export function getAllVersions(db: Database): number[] {
  return db
    .prepare<[], { version: number }>("SELECT version FROM schema_versions ORDER BY version ASC")
    .all()
    .map((r) => r.version);
}
