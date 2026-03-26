export { ToolError } from "./tools/types.js";
export type { Tool, ToolAnnotations, ToolContext, ToolResult } from "./tools/types.js";

export { DiriCodeConfigSchema } from "./config/schema.js";
export type { DiriCodeConfig } from "./config/schema.js";
export { loadConfig } from "./config/loader.js";
export type { LoadConfigOptions, LoadConfigResult } from "./config/loader.js";
export { getGlobalConfigDir, getProjectConfigPath } from "./config/paths.js";

export { AgentError, serializeTask, deserializeTask } from "./agents/types.js";
export type {
  Agent,
  AgentCategory,
  AgentContext,
  AgentMetadata,
  AgentResult,
  AgentTier,
  ModelFamily,
  ContextSize,
  ModelHints,
  RepoMap,
  FileNode,
  FileContext,
  HistoryMessage,
  PlanContext,
  TaskSummary,
  Task,
  SerializedTask,
  TokenBudget,
  ContextInjection,
  TemplateVars,
  PromptBudget,
  BuiltPrompt,
} from "./agents/types.js";
export { PromptBuilder, DEFAULT_BUDGET } from "./agents/prompt-builder.js";
export type { PromptBuilderConfig } from "./agents/prompt-builder.js";
export { AgentProtocolError } from "./agents/protocol.js";
export type {
  ContextHandoffEnvelope,
  ContextInheritanceMode,
  ContextInheritanceRules,
  ParentChildGraphNode,
  SerializedContext,
  DelegationContext,
  GoalDefinition,
  ArtifactReference,
  ResultPropagationContract,
  ResultIntegrationMode,
  AgentDelegationResult,
  DelegationRequest,
  DelegationEvent,
  ProtocolErrorCode,
} from "./agents/protocol.js";
export {
  DEFAULT_INHERITANCE_RULES,
  DEFAULT_RESULT_CONTRACT,
  MAX_DELEGATION_DEPTH,
  INLINE_ARTIFACT_THRESHOLD_BYTES,
  wouldCreateCycle,
  generateExecutionId,
  generateHandoffId,
} from "./agents/protocol.js";

export { SkillDefinitionSchema } from "./skills/index.js";
export type { SkillDefinition, SkillManifest, SkillLoadResult } from "./skills/index.js";
export { SkillRegistry } from "./skills/index.js";
export { SkillRouter } from "./skills/index.js";
export type { SkillRouterProvider, SkillRouterOptions } from "./skills/index.js";

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
