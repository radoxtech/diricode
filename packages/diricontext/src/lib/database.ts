import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";

import { runMigrations } from "./migrations/runner.js";

const DEFAULT_DATABASE_DIRECTORY = ".diricontext";
const DEFAULT_DATABASE_FILENAME = "db.sqlite";

export type DatabaseInstance = InstanceType<typeof Database>;

function getCliDatabasePath(argv: readonly string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === undefined) {
      continue;
    }

    if (argument === "--db-path") {
      const candidatePath = argv[index + 1];

      if (candidatePath && !candidatePath.startsWith("--")) {
        return candidatePath;
      }
    }

    if (argument.startsWith("--db-path=")) {
      const [, candidatePath] = argument.split("=", 2);

      if (candidatePath) {
        return candidatePath;
      }
    }
  }

  return undefined;
}

function resolveDatabasePath(explicitPath?: string): string {
  const configuredPath =
    explicitPath ??
    getCliDatabasePath(process.argv.slice(2)) ??
    process.env.DIRICONTEXT_DB ??
    resolve(process.cwd(), DEFAULT_DATABASE_DIRECTORY, DEFAULT_DATABASE_FILENAME);

  return resolve(configuredPath);
}

export function initDatabase(path?: string): DatabaseInstance {
  const databasePath = resolveDatabasePath(path);

  mkdirSync(dirname(databasePath), { recursive: true });

  const db = new Database(databasePath);

  try {
    db.pragma("journal_mode = WAL");
    runMigrations(db);

    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
