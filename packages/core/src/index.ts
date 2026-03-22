export { ToolError } from "./tools/types.js";
export type { Tool, ToolAnnotations, ToolContext, ToolResult } from "./tools/types.js";

export { DiriCodeConfigSchema } from "./config/schema.js";
export type { DiriCodeConfig } from "./config/schema.js";
export { loadConfig } from "./config/loader.js";
export type { LoadConfigOptions, LoadConfigResult } from "./config/loader.js";
export { getGlobalConfigDir, getProjectConfigPath } from "./config/paths.js";

export { AgentError } from "./agents/types.js";
export type {
  Agent,
  AgentCategory,
  AgentContext,
  AgentMetadata,
  AgentResult,
  AgentTier,
} from "./agents/types.js";
