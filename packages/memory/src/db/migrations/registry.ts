import type { Migration } from "./runner.js";
import { migration001 } from "./001_initial_schema.js";
import { migration002 } from "./002_ai_intelligence.js";
import { migration003 } from "./003_swarm_delegation.js";
import { migration004 } from "./004_background_tasks.js";
import { migration005 } from "./005_sessions_and_messages.js";
import { migration006 } from "./006_fts5_search.js";
import { migration007 } from "./007_turns.js";
import { migration008 } from "./008_token_usage.js";
import { migration009 } from "./009_checkpoints.js";

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
];
