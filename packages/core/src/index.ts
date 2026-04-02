export {
  ToolError,
  ToolAccessDeniedError,
  filterToolsByAllowlist,
  isToolAllowed,
  createPolicyEnforcingTool,
  createPolicyEnforcingToolRegistry,
} from "./tools/types.js";
export type {
  Tool,
  ToolAnnotations,
  ToolContext,
  ToolResult,
  ToolAccessPolicy,
} from "./tools/types.js";

export {
  ToolLoopError,
  classifyToolError,
  deriveRecoveryAction,
  buildToolStartEvent,
  buildToolEndEvent,
  buildToolProgressEvent,
  buildToolErrorEvent,
  buildToolErrorRetryEvent,
  buildToolErrorRecoveredEvent,
  buildToolErrorEscalateEvent,
  buildToolErrorStopEvent,
  computeToolRetryDelay,
  DEFAULT_TOOL_RETRY_BASE_DELAY_MS,
  DEFAULT_TOOL_RETRY_MAX_DELAY_MS,
  DEFAULT_TOOL_RETRY_MAX_RETRIES,
} from "./tools/tool-error.js";
export type {
  ToolErrorKind,
  ToolRecoveryAction,
  ToolErrorClassification,
  ToolEventCorrelation,
  ToolStartEvent,
  ToolEndEvent,
  ToolProgressEvent,
  ToolErrorEvent,
  ToolErrorRetryEvent,
  ToolErrorRecoveredEvent,
  ToolErrorEscalateEvent,
  ToolErrorStopEvent,
} from "./tools/tool-error.js";

export { DiriCodeConfigSchema } from "./config/schema.js";
export type { DiriCodeConfig } from "./config/schema.js";
export { loadConfig } from "./config/loader.js";
export type { LoadConfigOptions, LoadConfigResult } from "./config/loader.js";
export { getGlobalConfigDir, getProjectConfigPath } from "./config/paths.js";

export {
  AgentError,
  serializeTask,
  deserializeTask,
  DEFAULT_SANDBOX_CONFIG,
  DEFAULT_TOOL_LOOP_POLICY,
  DEFAULT_SEQUENTIAL_EXECUTOR_CONFIG,
} from "./agents/types.js";
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
  SandboxConfig,
  SandboxStopReason,
  SandboxTokenBudget,
  SandboxTimeout,
  SandboxRetryPolicy,
  SandboxAttemptResult,
  SandboxExecutionResult,
  ToolLoopPolicy,
  Checkpoint,
  CheckpointStatus,
  CheckpointSummary,
  SerializedCheckpoint,
  TaskExecutionResult,
  PlannedTask,
  SequentialExecutorConfig,
  ResumeOptions,
  SequentialExecutionResult,
  CheckpointPersistence,
} from "./agents/types.js";
export { PromptBuilder, DEFAULT_BUDGET } from "./agents/prompt-builder.js";
export type { PromptBuilderConfig } from "./agents/prompt-builder.js";
export { PromptCache } from "./agents/prompt-cache.js";
export type { PromptCacheConfig, CachedEntry } from "./agents/prompt-cache.js";
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
  generateTurnId,
} from "./agents/protocol.js";

export { SkillDefinitionSchema } from "./skills/index.js";
export type { SkillDefinition, SkillManifest, SkillLoadResult } from "./skills/index.js";
export { SkillRegistry } from "./skills/index.js";
export { SkillRouter } from "./skills/index.js";
export type { SkillRouterProvider, SkillRouterOptions } from "./skills/index.js";

export { ModelTierResolver } from "./agents/model-tier-resolver.js";
export type {
  ModelTier,
  ModelClass,
  ResolutionReason,
  TierMappingConfig,
  TierResolution,
  AvailabilityChecker,
} from "./agents/model-tier-resolver.js";

export {
  DefaultModelTierResolver,
  DEFAULT_MODEL_CONFIG_RESOLVER,
} from "./agents/model-config-resolver.js";
export type { ModelConfig, ModelConfigResolver } from "./agents/model-config-resolver.js";

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

export {
  PricingTierSchema,
  TaskComplexitySchema,
  HardRuleSchema,
  HardRulesConfigSchema,
  DEFAULT_HARD_RULES_CONFIG,
  comparePricingTiers,
  isPricingTierAllowed,
  getPricingTierRejectionReason,
  resolveHardRuleRange,
  Tier1HeuristicRouter,
  Tier2BertRouter,
  Tier3TinyLLMRouter,
  CascadeModelResolver,
  resolverCandidateFromContracts,
} from "./llm-picker/index.js";

export type {
  PricingTier,
  TaskComplexity,
  HardRule,
  HardRulesConfig,
  HardRuleEvaluationContext,
  HardRuleEvaluationResult,
  CascadeModelResolverOptions,
  ResolverCandidate,
} from "./llm-picker/index.js";

export * from "./agents/dispatcher-contract.js";
export * from "./agents/boundary-violation.js";
export * from "./agents/handoff-filter.js";
export * from "./agents/handoff-validator.js";
export { enforceDispatcherBoundary } from "./agents/boundary-violation.js";

export type {
  TurnStatus,
  TurnStartEvent,
  TurnEndEvent,
  TurnTimeoutEvent,
  TurnTelemetry,
  TurnEnvelopeData,
  TurnPartialResult,
} from "./agents/turn-types.js";
export { TurnEnvelope } from "./agents/turn-envelope.js";
export {
  createTurnStartEvent,
  createTurnEndEvent,
  createTurnTimeoutEvent,
} from "./agents/turn-events.js";
export {
  createTaskCheckpointEvent,
  createTaskStartedEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createSequentialExecutionStartedEvent,
  createSequentialExecutionCompletedEvent,
  createSequentialExecutionAbortedEvent,
  createCheckpointSavedEvent,
} from "./agents/checkpoint-events.js";
export type {
  TaskCheckpointEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  SequentialExecutionStartedEvent,
  SequentialExecutionCompletedEvent,
  SequentialExecutionAbortedEvent,
  CheckpointSavedEvent,
} from "./agents/checkpoint-events.js";

export {
  createCorrelationContext,
  generateAgentSpanId,
  generateToolCallId,
  generatePlanId,
  generateEventId,
} from "./observability/correlation.js";
export type { CorrelationContext } from "./observability/correlation.js";

export { EventType, createCoordinatedEvent, baseEventSchema } from "./observability/event-types.js";
export type {
  BaseEvent,
  CoordinatedEvent,
  TurnStartEvent as CoordinatedTurnStartEvent,
  TurnEndEvent as CoordinatedTurnEndEvent,
  TurnTimeoutEvent as CoordinatedTurnTimeoutEvent,
  AgentStartedEvent,
  AgentCompletedEvent,
  AgentFailedEvent,
  ToolStartEvent as CoordinatedToolStartEvent,
  ToolEndEvent as CoordinatedToolEndEvent,
  ToolProgressEvent as CoordinatedToolProgressEvent,
  ToolErrorEvent as CoordinatedToolErrorEvent,
  ToolErrorRetryEvent as CoordinatedToolErrorRetryEvent,
  ToolErrorRecoveredEvent as CoordinatedToolErrorRecoveredEvent,
  ToolErrorEscalateEvent as CoordinatedToolErrorEscalateEvent,
  ToolErrorStopEvent as CoordinatedToolErrorStopEvent,
  ToolAccessDeniedEvent,
  DelegationHandoffCreatedEvent,
  DelegationChildStartedEvent,
  DelegationChildCompletedEvent,
  DelegationChildFailedEvent,
  DelegationResultReceivedEvent,
  SequentialExecutionStartedEvent as CoordinatedSequentialExecutionStartedEvent,
  SequentialExecutionCompletedEvent as CoordinatedSequentialExecutionCompletedEvent,
  SequentialExecutionAbortedEvent as CoordinatedSequentialExecutionAbortedEvent,
  TaskStartedEvent as CoordinatedTaskStartedEvent,
  TaskCompletedEvent as CoordinatedTaskCompletedEvent,
  TaskFailedEvent as CoordinatedTaskFailedEvent,
  TaskCheckpointEvent as CoordinatedTaskCheckpointEvent,
  CheckpointSavedEvent as CoordinatedCheckpointSavedEvent,
  SwarmStartedEvent,
  SwarmCompletedEvent,
  SwarmWaveStartEvent,
  SwarmWaveEndEvent,
  SwarmTaskStartEvent,
  SwarmTaskCompleteEvent,
  SwarmTaskFailedEvent,
  SwarmDeadlockEvent,
} from "./observability/event-types.js";

export { ExecutionGraphBuilder } from "./observability/execution-graph.js";
export type {
  ExecutionGraphNode,
  ExecutionGraph,
  ExecutionNodeKind,
  ExecutionNodeStatus,
} from "./observability/execution-graph.js";
