export {
  ModelTierSchema,
  ModelAttributeSchema,
  FallbackTypeSchema,
  ContextTierSchema,
  contextWindowToTier,
  contextTierMinTokens,
  ModelDimensionsSchema,
  CascadeTierSchema,
  TierHistoryEntrySchema,
  ClassificationTraceSchema,
  AgentInfoSchema,
  TaskInfoSchema,
  DecisionConstraintsSchema,
  DecisionRequestSchema,
  ModelCandidateSchema,
  DecisionMetaSchema,
  SelectedModelSchema,
  DecisionResponseSchema,
  FeedbackOutcomeSchema,
  FeedbackSubmissionSchema,
  RouterClassificationSchema,
} from "./types.js";

export type {
  ModelTier,
  ModelAttribute,
  FallbackType,
  ContextTier,
  ModelDimensions,
  CascadeTier,
  TierHistoryEntry,
  ClassificationTrace,
  AgentInfo,
  TaskInfo,
  DecisionConstraints,
  DecisionRequest,
  ModelCandidate,
  DecisionMeta,
  SelectedModel,
  DecisionResponse,
  FeedbackOutcome,
  FeedbackSubmission,
  FeedbackCollector,
  RouterClassification,
  ModelRouter,
  ModelResolver,
} from "./types.js";

export {
  Tier1HeuristicRouter,
  Tier2EmbeddingsRouter,
  Tier3TinyLLMRouter,
  CascadeModelResolver,
} from "./model-resolver.js";

export type { CascadeModelResolverOptions, ResolverCandidate } from "./model-resolver.js";

export {
  CANONICAL_ROUTING_TAGS,
  ROUTING_TAG_DEFINITIONS,
  ROUTING_TAG_FOLDING,
  STACK_SIGNALS,
  PROBLEM_SIGNALS,
  AGENT_ARCHETYPE_SIGNALS,
  META_MODEL_SIGNALS,
} from "./routing-taxonomy.js";

export type { CanonicalRoutingTag } from "./routing-taxonomy.js";

export {
  ROUTING_CLASSIFIER_SYSTEM_PROMPT,
  buildRoutingClassifierUserPrompt,
  buildCompactRoutingClassifierPrompt,
} from "./classifier-prompts.js";

export type { ClassifierPromptInput } from "./classifier-prompts.js";

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
} from "./hard-rules.js";

export type {
  PricingTier,
  TaskComplexity,
  HardRule,
  HardRulesConfig,
  HardRuleEvaluationContext,
  HardRuleEvaluationResult,
} from "./hard-rules.js";

export {
  SubscriptionNotFoundError,
  SubscriptionAlreadyRegisteredError,
  SubscriptionRegistry,
} from "./subscription-registry.js";
