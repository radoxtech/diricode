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
  Tier2BertRouter,
  Tier3TinyLLMRouter,
  CascadeModelResolver,
} from "./model-resolver.js";

export type { CascadeModelResolverOptions, ResolverCandidate } from "./model-resolver.js";

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
