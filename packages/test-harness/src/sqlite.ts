import Database from "better-sqlite3";
import type { Database as BetterSQLite3Database } from "better-sqlite3";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

export interface TestDatabase {
  db: BetterSQLite3Database;
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates an in-memory SQLite database for testing.
 * The database is automatically cleaned up after use.
 *
 * @example
 * ```ts
 * describe("database tests", () => {
 *   let testDb: TestDatabase;
 *
 *   beforeEach(async () => {
 *     testDb = await createInMemoryDatabase();
 *   });
 *
 *   afterEach(async () => {
 *     await testDb.cleanup();
 *   });
 *
 *   it("queries data", () => {
 *     const result = testDb.db.prepare("SELECT 1 as num").get();
 *     expect(result).toEqual({ num: 1 });
 *   });
 * });
 * ```
 */
export function createInMemoryDatabase(): TestDatabase {
  const db = new Database(":memory:");

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return {
    db,
    path: ":memory:",
    cleanup: () => {
      db.close();
      return Promise.resolve();
    },
  };
}

/**
 * Creates a file-based SQLite database in a temporary directory for testing.
 * The database file and temp directory are automatically cleaned up after use.
 *
 * @example
 * ```ts
 * describe("database tests", () => {
 *   let testDb: TestDatabase;
 *
 *   beforeEach(async () => {
 *     testDb = await createFileDatabase();
 *   });
 *
 *   afterEach(async () => {
 *     await testDb.cleanup();
 *   });
 *
 *   it("persists data", () => {
 *     testDb.db.prepare("CREATE TABLE test (id INTEGER)").run();
 *     testDb.db.prepare("INSERT INTO test VALUES (1)").run();
 *     const result = testDb.db.prepare("SELECT * FROM test").all();
 *     expect(result).toHaveLength(1);
 *   });
 * });
 * ```
 */
export async function createFileDatabase(): Promise<TestDatabase> {
  const tempDir = await mkdtemp(join(tmpdir(), "diricode-db-test-"));
  const dbPath = join(tempDir, "test.db");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return {
    db,
    path: dbPath,
    cleanup: async () => {
      db.close();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

/**
 * Manages a test database lifecycle with migration support.
 *
 * @example
 * ```ts
 * describe("migrated database tests", () => {
 *   const dbManager = new TestDatabaseManager();
 *
 *   beforeEach(async () => {
 *     await dbManager.setup({
 *       migrations: [
 *         { version: 1, sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)" }
 *       ]
 *     });
 *   });
 *
 *   afterEach(async () => {
 *     await dbManager.cleanup();
 *   });
 *
 *   it("uses migrated schema", () => {
 *     dbManager.db.prepare("INSERT INTO users (id) VALUES (1)").run();
 *   });
 * });
 * ```
 */
export class TestDatabaseManager {
  db: BetterSQLite3Database | null = null;
  private tempDir: string | null = null;

  /**
   * Sets up a test database with optional migrations.
   *
   * @param options - Configuration options
   * @param options.inMemory - Use :memory: database (default: true)
   * @param options.migrations - Array of migrations to run
   */
  async setup(
    options: {
      inMemory?: boolean;
      migrations?: { version: number; sql: string }[];
    } = {},
  ): Promise<void> {
    const inMemory = options.inMemory ?? true;

    if (inMemory) {
      this.db = new Database(":memory:");
    } else {
      this.tempDir = await mkdtemp(join(tmpdir(), "diricode-db-test-"));
      const dbPath = join(this.tempDir, "test.db");
      this.db = new Database(dbPath);
    }

    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    if (options.migrations && options.migrations.length > 0) {
      this.db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)");

      for (const migration of options.migrations) {
        const currentVersion = this.db
          .prepare("SELECT COALESCE(MAX(version), 0) as version FROM schema_version")
          .get() as { version: number };

        if (migration.version > currentVersion.version) {
          this.db.exec(migration.sql);
          this.db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(migration.version);
        }
      }
    }
  }

  /**
   * Cleans up the test database and any temporary files.
   */
  async cleanup(): Promise<void> {
    if (this.db !== null) {
      this.db.close();
      this.db = null;
    }

    if (this.tempDir !== null) {
      await rm(this.tempDir, { recursive: true, force: true });
      this.tempDir = null;
    }
  }

  /**
   * Runs a SQL query and returns all results.
   */
  all(sql: string, ...params: unknown[]): unknown[] {
    if (this.db === null) {
      throw new Error("Database not initialized. Call setup() first.");
    }
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Runs a SQL query and returns the first result.
   */
  get(sql: string, ...params: unknown[]): unknown {
    if (this.db === null) {
      throw new Error("Database not initialized. Call setup() first.");
    }
    return this.db.prepare(sql).get(...params);
  }

  /**
   * Executes a SQL statement (INSERT, UPDATE, DELETE, etc.).
   */
  run(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
    if (this.db === null) {
      throw new Error("Database not initialized. Call setup() first.");
    }
    const result = this.db.prepare(sql).run(...params);
    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  /**
   * Executes multiple SQL statements.
   */
  exec(sql: string): void {
    if (this.db === null) {
      throw new Error("Database not initialized. Call setup() first.");
    }
    this.db.exec(sql);
  }
}
