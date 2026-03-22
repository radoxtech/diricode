import type { Migration } from "./runner.js";
import { migration001 } from "./001_initial_schema.js";
import { migration002 } from "./002_sessions_schema.js";

export const migrations: Migration[] = [migration001, migration002];
