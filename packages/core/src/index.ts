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

export { SkillDefinitionSchema } from "./skills/index.js";
export type { SkillDefinition, SkillManifest, SkillLoadResult } from "./skills/index.js";

export {
  SubscriptionSchema,
  SubscriptionLimitsSchema,
  SubscriptionHealthSchema,
  ModelScoreSchema,
  ABExperimentSchema,
  ComparisonSchema,
} from "./providers/index.js";
export type {
  Subscription,
  SubscriptionLimits,
  SubscriptionHealth,
  ModelScore,
  ABExperiment,
  Comparison,
} from "./providers/index.js";
