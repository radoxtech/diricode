import type { Migration } from "./runner.js";
import { migration001 } from "./001_initial_schema.js";
import { migration002 } from "./002_ai_intelligence.js";
import { migration003 } from "./003_swarm_delegation.js";

export const migrations: Migration[] = [migration001, migration002, migration003];
