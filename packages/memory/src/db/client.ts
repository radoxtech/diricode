import Database from "better-sqlite3";
import type { Database as BetterSQLite3Database } from "better-sqlite3";
import { getDbPath } from "./path.js";
import { initSchemaVersions } from "./schema/version.js";
import { runMigrations } from "./migrations/runner.js";
import { migrations } from "./migrations/registry.js";

let instance: BetterSQLite3Database | undefined;

export function getDatabase(): BetterSQLite3Database {
  if (instance !== undefined) {
    return instance;
  }

  const dbPath = getDbPath();
  instance = new Database(dbPath);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");

  initSchemaVersions(instance);
  runMigrations(instance, migrations);

  return instance;
}
