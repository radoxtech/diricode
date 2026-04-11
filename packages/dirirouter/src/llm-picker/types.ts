import { z } from "zod";

// ---------------------------------------------------------------------------
// Model Dimensions — ADR-004/005/006 (updated: unified AgentCapabilities)
// ---------------------------------------------------------------------------

/**
 * Computational tier of a model.
 * @see ADR-004
 */
export const ModelTierSchema = z.enum(["heavy", "medium", "low"]);
export type ModelTier = z.infer<typeof ModelTierSchema>;

/**
 * Model-level attribute tags used by the Picker to score candidates.
 * Replaces the old ModelFamily (llm-picker) and ModelTag with a single list.
 * @see ADR-005 (updated), agents/types.ts ModelAttribute
 */
export const ModelAttributeSchema = z.enum([
  "reasoning",
  "speed",
  "agentic",
  "creative",
  "ui-ux",
  "bulk",
  "quality",
]);
export type ModelAttribute = z.infer<typeof ModelAttributeSchema>;

/**
 * Fallback type describing why a fallback model is needed.
 * @see ADR-006
 */
export const FallbackTypeSchema = z.enum(["largeContext", "largeOutput", "error", "strong"]);
export type FallbackType = z.infer<typeof FallbackTypeSchema>;

/**
 * Context tier used to express context window requirements.
 *
 * - `standard`  — up to 200 000 tokens
 * - `extended`  — 200 000 – 800 000 tokens
 * - `massive`   — 800 000+ tokens
 *
 * Replaces the raw `minContextWindow` number in DecisionConstraints.
 */
export const ContextTierSchema = z.enum(["standard", "extended", "massive"]);
export type ContextTier = z.infer<typeof ContextTierSchema>;

/**
 * Maps a raw context window size (in tokens) to its {@link ContextTier}.
 */
export function contextWindowToTier(contextWindow: number): ContextTier {
  if (contextWindow >= 800_000) return "massive";
  if (contextWindow >= 200_000) return "extended";
  return "standard";
}

/**
 * Returns the minimum context window (in tokens) required by the given tier.
 */
export function contextTierMinTokens(tier: ContextTier): number {
  switch (tier) {
    case "massive":
      return 800_000;
    case "extended":
      return 200_000;
    case "standard":
      return 0;
  }
}

/**
 * Container for all model selection dimensions.
 * Updated: `family`+`tags` replaced by `modelAttributes`.
 */
export const ModelDimensionsSchema = z.object({
  tier: ModelTierSchema,
  /** Model-level attribute tags forwarded from AgentCapabilities.modelAttributes */
  modelAttributes: z.array(ModelAttributeSchema),
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
 * Expanded to handle seniority and specializations.
 */
export const AgentInfoSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  seniority: z.enum(["junior", "mid", "senior", "lead"]).default("mid"),
  specializations: z.array(z.string()).default([]),
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
  contextTier: ContextTierSchema.optional(),
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
  chatId: z.string().uuid(),
  requestId: z.string().uuid(),
  agent: AgentInfoSchema,
  task: TaskInfoSchema,
  /** Any issue tracking details should be passed generically or typed via external packages */
  issueContext: z.record(z.unknown()).optional(),
  modelDimensions: ModelDimensionsSchema,
  constraints: DecisionConstraintsSchema.optional(),
  /** Named policy override; null means use the default policy */
  policyOverride: z.string().nullable().optional(),
  /** explicitly tracked failed models during fallback */
  failedModels: z.array(z.string()).optional(),
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
// Feedback Collection — ADR-055 chatId correlation
// ---------------------------------------------------------------------------

/**
 * Outcome metrics for a single model decision.
 */
export const FeedbackOutcomeSchema = z.object({
  success: z.boolean(),
  tokenCount: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
  }),
  latencyMs: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type FeedbackOutcome = z.infer<typeof FeedbackOutcomeSchema>;

/**
 * Feedback submission linking outcome to original decision.
 * Used for reinforcement learning based on Model x Tier x TaskTag.
 */
export const FeedbackSubmissionSchema = z.object({
  chatId: z.string().uuid(),
  requestId: z.string().uuid(),
  model: z.string().min(1),
  modelTier: ModelTierSchema,
  taskTag: z.string().min(1),
  outcome: FeedbackOutcomeSchema,
});
export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;

/**
 * Interface for collecting feedback on model decisions.
 * POC: log-only. v2: Elo scoring integration.
 */
export interface FeedbackCollector {
  submit(feedback: FeedbackSubmission): Promise<void>;
}

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
