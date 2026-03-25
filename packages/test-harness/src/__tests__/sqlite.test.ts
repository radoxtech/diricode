import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createInMemoryDatabase,
  createFileDatabase,
  TestDatabaseManager,
  type TestDatabase,
} from "../sqlite.js";
import { stat } from "node:fs/promises";

describe("createInMemoryDatabase", () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db.cleanup();
  });

  it("should create an in-memory database", () => {
    db = createInMemoryDatabase();
    expect(db.db).toBeDefined();
    expect(db.path).toBe(":memory:");
  });

  it("should allow SQL queries", () => {
    db = createInMemoryDatabase();
    const result = db.db.prepare("SELECT 1 as num").get() as { num: number };
    expect(result.num).toBe(1);
  });

  it("should enable foreign keys", () => {
    db = createInMemoryDatabase();
    const rows = db.db.pragma("foreign_keys") as Record<string, number>[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("foreign_keys", 1);
  });
});

describe("createFileDatabase", () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db.cleanup();
  });

  it("should create a file-based database", async () => {
    db = await createFileDatabase();
    expect(db.db).toBeDefined();
    expect(db.path).not.toBe(":memory:");
    const stats = await stat(db.path);
    expect(stats.isFile()).toBe(true);
  });

  it("should persist data across connections", async () => {
    db = await createFileDatabase();
    db.db.prepare("CREATE TABLE test (id INTEGER)").run();
    db.db.prepare("INSERT INTO test VALUES (1)").run();

    const result = db.db.prepare("SELECT * FROM test").all() as { id: number }[];
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });

  it("should clean up temp directory on cleanup", async () => {
    db = await createFileDatabase();
    const dbPath = db.path;
    await db.cleanup();
    await expect(stat(dbPath)).rejects.toThrow();
  });
});

describe("TestDatabaseManager", () => {
  let manager: TestDatabaseManager;

  beforeEach(() => {
    manager = new TestDatabaseManager();
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  it("should create in-memory database by default", async () => {
    await manager.setup();
    expect(manager.db).toBeDefined();
  });

  it("should run migrations when provided", async () => {
    await manager.setup({
      migrations: [{ version: 1, sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)" }],
    });

    manager.run("INSERT INTO users (id) VALUES (1)");
    const result = manager.get("SELECT * FROM users WHERE id = 1") as { id: number } | undefined;
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
  });

  it("should run migrations in order", async () => {
    await manager.setup({
      migrations: [
        { version: 1, sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)" },
        { version: 2, sql: "ALTER TABLE users ADD COLUMN name TEXT" },
      ],
    });

    manager.run("INSERT INTO users (id, name) VALUES (1, 'John')");
    const result = manager.get("SELECT * FROM users WHERE id = 1") as
      | { id: number; name: string }
      | undefined;
    expect(result).toBeDefined();
    expect(result?.name).toBe("John");
  });

  it("should skip already applied migrations", async () => {
    await manager.setup({
      migrations: [{ version: 1, sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)" }],
    });

    await manager.setup({
      migrations: [
        { version: 1, sql: "CREATE TABLE users (id INTEGER PRIMARY KEY)" },
        { version: 2, sql: "CREATE TABLE posts (id INTEGER PRIMARY KEY)" },
      ],
    });

    manager.run("INSERT INTO posts (id) VALUES (1)");
    const result = manager.get("SELECT * FROM posts WHERE id = 1") as { id: number } | undefined;
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
  });

  it("should support all() query method", async () => {
    await manager.setup();
    manager.exec("CREATE TABLE test (id INTEGER)");
    manager.run("INSERT INTO test VALUES (1)");
    manager.run("INSERT INTO test VALUES (2)");

    const results = manager.all("SELECT * FROM test") as { id: number }[];
    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe(1);
    expect(results[1]?.id).toBe(2);
  });

  it("should support get() query method", async () => {
    await manager.setup();
    manager.exec("CREATE TABLE test (id INTEGER)");
    manager.run("INSERT INTO test VALUES (1)");

    const result = manager.get("SELECT * FROM test WHERE id = 1") as { id: number } | undefined;
    expect(result).toBeDefined();
    expect(result?.id).toBe(1);
  });

  it("should return undefined for get() when no match", async () => {
    await manager.setup();
    manager.exec("CREATE TABLE test (id INTEGER)");

    const result = manager.get("SELECT * FROM test WHERE id = 999");
    expect(result).toBeUndefined();
  });

  it("should support run() for inserts/updates", async () => {
    await manager.setup();
    manager.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");

    const result = manager.run("INSERT INTO test VALUES (NULL)");
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeDefined();
  });

  it("should support exec() for multiple statements", async () => {
    await manager.setup();
    manager.exec(`
      CREATE TABLE test (id INTEGER PRIMARY KEY);
      INSERT INTO test VALUES (1);
      INSERT INTO test VALUES (2);
    `);

    const results = manager.all("SELECT * FROM test");
    expect(results).toHaveLength(2);
  });

  it("should throw when accessing db before setup", () => {
    expect(() => manager.all("SELECT 1")).toThrow("not initialized");
  });
});
