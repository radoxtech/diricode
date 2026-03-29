import { z } from "zod";

// ---------------------------------------------------------------------------
// Model Dimensions — ADR-004/005/006
// ---------------------------------------------------------------------------

/**
 * Computational tier of a model.
 * @see ADR-004
 */
export const ModelTierSchema = z.enum(["heavy", "medium", "low"]);
export type ModelTier = z.infer<typeof ModelTierSchema>;

/**
 * Model family classification.
 * @see ADR-005
 */
export const ModelFamilySchema = z.enum(["coding", "reasoning", "creative"]);
export type ModelFamily = z.infer<typeof ModelFamilySchema>;

/**
 * Agent tags — exactly one tag per agent.
 * @see ADR-004
 */
export const ModelTagSchema = z.enum([
  "orchestration",
  "planning",
  "coding",
  "quality",
  "research",
  "creative",
  "utility",
]);
export type ModelTag = z.infer<typeof ModelTagSchema>;

/**
 * Fallback type describing why a fallback model is needed.
 * @see ADR-006
 */
export const FallbackTypeSchema = z.enum([
  "largeContext",
  "largeOutput",
  "error",
  "strong",
]);
export type FallbackType = z.infer<typeof FallbackTypeSchema>;

/**
 * Container for all model selection dimensions.
 */
export const ModelDimensionsSchema = z.object({
  tier: ModelTierSchema,
  family: ModelFamilySchema,
  /** ADR-004: exactly one tag per agent */
  tags: z.array(ModelTagSchema),
  /** null means no specific fallback need; otherwise the type of fallback required */
  fallbackType: FallbackTypeSchema.nullable(),
});
export type ModelDimensions = z.infer<typeof ModelDimensionsSchema>;

// ---------------------------------------------------------------------------
// Cascade Tier Types
// ---------------------------------------------------------------------------

/**
 * Classification cascade tier (1 = heuristic, 2 = BERT, 3 = TinyLLM).
 */
export const CascadeTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type CascadeTier = z.infer<typeof CascadeTierSchema>;

/**
 * Entry in the tier history of a classification trace.
 */
export const TierHistoryEntrySchema = z.object({
  tier: CascadeTierSchema,
  confidence: z.number().min(0).max(1),
  /** Whether this tier was reached in the cascade */
  reached: z.boolean(),
});
export type TierHistoryEntry = z.infer<typeof TierHistoryEntrySchema>;

/**
 * Full classification trace tracking tier transitions during a cascade run.
 */
export const ClassificationTraceSchema = z.object({
  tierUsed: CascadeTierSchema,
  confidence: z.number().min(0).max(1),
  classification: z.enum(["simple", "moderate", "complex", "expert"]),
  latencyMs: z.number().int().nonnegative(),
  tierHistory: z.array(TierHistoryEntrySchema),
});
export type ClassificationTrace = z.infer<typeof ClassificationTraceSchema>;

// ---------------------------------------------------------------------------
// Decision Request — ADR-049 contracts
// ---------------------------------------------------------------------------

/**
 * Minimal agent identity included in a decision request.
 */
export const AgentInfoSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
});
export type AgentInfo = z.infer<typeof AgentInfoSchema>;

/**
 * Task metadata included in a decision request.
 */
export const TaskInfoSchema = z.object({
  type: z.string().min(1),
  description: z.string().optional(),
});
export type TaskInfo = z.infer<typeof TaskInfoSchema>;

/**
 * Optional hard and soft constraints used to filter/rank candidates.
 */
export const DecisionConstraintsSchema = z.object({
  maxCostUsd: z.number().nonnegative().optional(),
  maxLatencyMs: z.number().int().nonnegative().optional(),
  minContextWindow: z.number().int().nonnegative().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  excludedProviders: z.array(z.string()).optional(),
  excludedModels: z.array(z.string()).optional(),
  preferredProviders: z.array(z.string()).optional(),
  preferredModels: z.array(z.string()).optional(),
});
export type DecisionConstraints = z.infer<typeof DecisionConstraintsSchema>;

/**
 * Full request sent to the ModelResolver to obtain a model decision.
 * @see ADR-049
 */
export const DecisionRequestSchema = z.object({
  requestId: z.string().uuid(),
  agent: AgentInfoSchema,
  task: TaskInfoSchema,
  modelDimensions: ModelDimensionsSchema,
  constraints: DecisionConstraintsSchema.optional(),
  /** Named policy override; null means use the default policy */
  policyOverride: z.string().nullable().optional(),
});
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

// ---------------------------------------------------------------------------
// Decision Response
// ---------------------------------------------------------------------------

/**
 * A single candidate model that was evaluated.
 */
export const ModelCandidateSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  score: z.number().min(0).max(100),
  status: z.enum(["selected", "runner_up", "excluded"]),
  scoresBreakdown: z
    .object({
      quality: z.number().min(0).max(100),
      cost: z.number().min(0).max(100),
      latency: z.number().min(0).max(100),
      capabilityMatch: z.number().min(0).max(100),
    })
    .optional(),
  rejectionReason: z.string().optional(),
});
export type ModelCandidate = z.infer<typeof ModelCandidateSchema>;

/**
 * Metadata about how the decision was made.
 */
export const DecisionMetaSchema = z.object({
  policyUsed: z.string(),
  selectionLatencyMs: z.number().int().nonnegative(),
  isFallback: z.boolean(),
  fallbackReason: z.string().nullable().optional(),
});
export type DecisionMeta = z.infer<typeof DecisionMetaSchema>;

/**
 * The selected model information included in a successful response.
 */
export const SelectedModelSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  modelVersion: z.string().optional(),
  score: z.number().min(0).max(100),
  estimatedCostUsd: z.number().nonnegative().optional(),
  estimatedLatencyMs: z.number().int().nonnegative().optional(),
  contextWindow: z.number().int().nonnegative().optional(),
  capabilities: z.array(z.string()).optional(),
});
export type SelectedModel = z.infer<typeof SelectedModelSchema>;

/**
 * Full response returned by the ModelResolver for a decision request.
 * @see ADR-049
 */
export const DecisionResponseSchema = z.object({
  requestId: z.string().uuid(),
  decisionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  status: z.enum(["resolved", "no_match", "error"]),
  selected: SelectedModelSchema.optional(),
  candidates: z.array(ModelCandidateSchema).optional(),
  decisionMeta: DecisionMetaSchema.optional(),
  classificationTrace: ClassificationTraceSchema.optional(),
});
export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;

// ---------------------------------------------------------------------------
// Router Types
// ---------------------------------------------------------------------------

/**
 * Result of a single router's classification attempt.
 */
export const RouterClassificationSchema = z.object({
  tier: CascadeTierSchema,
  confidence: z.number().min(0).max(1),
  classification: z.enum(["simple", "moderate", "complex", "expert"]),
  reasoning: z.string().optional(),
});
export type RouterClassification = z.infer<typeof RouterClassificationSchema>;

/**
 * A single router in the cascade pipeline.
 *
 * Routers are tried in ascending tier order; the first router whose confidence
 * meets or exceeds its threshold short-circuits the cascade.
 */
export interface ModelRouter {
  readonly name: string;
  classify(request: DecisionRequest): Promise<RouterClassification>;
  readonly maxLatencyMs: number;
}

// ---------------------------------------------------------------------------
// ModelResolver interface
// ---------------------------------------------------------------------------

/**
 * Core LLM Picker interface.
 *
 * Accepts a {@link DecisionRequest} and returns a {@link DecisionResponse}
 * that includes the selected model and optional metadata.
 *
 * @see ADR-049
 */
export interface ModelResolver {
  resolve(request: DecisionRequest): Promise<DecisionResponse>;
  readonly routers: readonly ModelRouter[];
}
