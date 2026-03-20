import { mkdirSync } from "node:fs";
import { join } from "node:path";

const DC_DIR = ".dc";
const DB_FILENAME = "memory.db";

export function getDbPath(): string {
  const dcDir = join(process.cwd(), DC_DIR);
  mkdirSync(dcDir, { recursive: true });
  return join(dcDir, DB_FILENAME);
}
