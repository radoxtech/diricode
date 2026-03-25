/**
 * DiriCode Integration Test Harness
 *
 * Provides utilities for testing DiriCode components:
 * - TempDir: Temporary directory management with auto-cleanup
 * - EnvIsolation: Environment variable isolation for tests
 * - TestDatabase: In-memory and file-based SQLite databases for testing
 * - TestClient: Hono HTTP client wrapper for API testing
 *
 * @module @diricode/test-harness
 */

export { TempDir } from "./temp-dir.js";
export { EnvIsolation } from "./env-isolation.js";
export {
  type TestDatabase,
  createInMemoryDatabase,
  createFileDatabase,
  TestDatabaseManager,
} from "./sqlite.js";
export {
  type TestResponse,
  type TestClient,
  type TestServerOptions,
  createHonoTestClient,
  createTestServer,
} from "./hono.js";
