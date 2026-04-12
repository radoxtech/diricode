import { initDatabase } from "./lib/database.js";
import type { DatabaseInstance } from "./lib/database.js";

export function createDiricontextServerDatabase(dbPath?: string): DatabaseInstance {
  return initDatabase(dbPath);
}
