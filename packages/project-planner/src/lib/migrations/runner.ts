import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { DatabaseInstance } from "../database.js";

const MIGRATION_FILE_PATTERN = /^(\d+)-(.+)\.sql$/;
const CURRENT_DIRECTORY = dirname(fileURLToPath(import.meta.url));

type MigrationFile = {
  version: number;
  name: string;
  fileName: string;
  filePath: string;
};

function ensureSchemaVersionTable(db: DatabaseInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function resolveMigrationsDirectory(): string {
  const candidateDirectories = [
    CURRENT_DIRECTORY,
    resolve(CURRENT_DIRECTORY, "../../../src/lib/migrations"),
  ];

  for (const candidateDirectory of candidateDirectories) {
    if (existsSync(candidateDirectory)) {
      return candidateDirectory;
    }
  }

  throw new Error("Unable to locate the Diricontext migrations directory.");
}

function listMigrationFiles(directoryPath: string): MigrationFile[] {
  return readdirSync(directoryPath)
    .map((fileName: string) => {
      const match = MIGRATION_FILE_PATTERN.exec(fileName);

      if (!match) {
        return null;
      }

      const [, versionText, name] = match;

      if (versionText === undefined || name === undefined) {
        return null;
      }

      return {
        version: Number.parseInt(versionText, 10),
        name,
        fileName,
        filePath: resolve(directoryPath, fileName),
      } satisfies MigrationFile;
    })
    .filter((migration): migration is MigrationFile => migration !== null)
    .sort((left: MigrationFile, right: MigrationFile) => left.version - right.version);
}

function getCurrentVersion(db: DatabaseInstance): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_version")
    .get() as { version: number } | undefined;

  return row?.version ?? 0;
}

export function runMigrations(db: DatabaseInstance): void {
  ensureSchemaVersionTable(db);

  const currentVersion = getCurrentVersion(db);
  const migrationsDirectory = resolveMigrationsDirectory();
  const pendingMigrations = listMigrationFiles(migrationsDirectory).filter(
    (migration) => migration.version > currentVersion,
  );

  for (const migration of pendingMigrations) {
    const sql = readFileSync(migration.filePath, "utf8");
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version, name) VALUES (?, ?)").run(
        migration.version,
        migration.fileName,
      );
    });

    applyMigration();
  }
}
