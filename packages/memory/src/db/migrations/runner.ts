import type { Database } from "better-sqlite3";
import { getCurrentVersion } from "../schema/version.js";

export interface Migration {
  version: number;
  description: string;
  up: (db: Database) => void;
}

export function runMigrations(db: Database, migrations: Migration[]): void {
  const currentVersion = getCurrentVersion(db);
  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    const tx = db.transaction(() => {
      migration.up(db);
      db.prepare(
        "INSERT INTO schema_versions (version, description) VALUES (?, ?)"
      ).run(migration.version, migration.description);
    });
    tx();
  }
}
