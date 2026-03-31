export {
  ModelTierSchema,
  ModelFamilySchema,
  ModelTagSchema,
  FallbackTypeSchema,
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
  RouterClassificationSchema,
} from "./types.js";

export type {
  ModelTier,
  ModelFamily,
  ModelTag,
  FallbackType,
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

export { resolverCandidateFromContracts } from "./model-resolver.js";

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
