/**
 * ModelCard types and Zod schemas for the LLM Picker two-level architecture.
 *
 * A ModelCard is a provider-independent description of a model's capabilities,
 * classification data, and learned benchmarks. It is separate from a
 * PickerSubscription, which describes how to access that model through a
 * specific provider account or API plan.
 *
 * @see ADR-049 — LLM Picker decision architecture
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Pricing tier
// ---------------------------------------------------------------------------

/**
 * Cost classification for a model.
 * - budget: low-cost, suitable for high-volume or routine tasks
 * - standard: mid-range balance of capability and cost
 * - premium: highest capability, cost-justified for complex tasks
 */
export const PricingTierSchema = z.enum(["budget", "standard", "premium"]);
export type PricingTier = z.infer<typeof PricingTierSchema>;

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Provider-independent model capabilities.
 * `max_context` is null when the value should be deferred to the subscription.
 */
export const ModelCapabilitiesSchema = z.object({
  /** Whether the model supports tool/function calling. */
  tool_calling: z.boolean(),
  /** Whether the model supports streaming responses. */
  streaming: z.boolean(),
  /** Whether the model supports JSON mode output. */
  json_mode: z.boolean(),
  /** Whether the model supports image inputs (vision). */
  vision: z.boolean(),
  /**
   * Maximum context window in tokens.
   * null = defer to the subscription's context_window field.
   */
  max_context: z.number().int().nonnegative().nullable(),
});
export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>;

// ---------------------------------------------------------------------------
// KnownFor — seed classification data
// ---------------------------------------------------------------------------

/**
 * Human-curated classification tags used to seed the picker's initial
 * routing heuristics before enough feedback has accumulated.
 */
export const KnownForSchema = z.object({
  /** High-level roles this model excels at, e.g. ["coder", "researcher"]. */
  roles: z.array(z.string()),
  /** Task complexity levels this model handles well, e.g. ["simple", "moderate"]. */
  complexities: z.array(z.string()),
  /** Domain specializations, e.g. ["frontend", "backend"]. */
  specializations: z.array(z.string()),
});
export type KnownFor = z.infer<typeof KnownForSchema>;

// ---------------------------------------------------------------------------
// Benchmarks — learned from internal feedback
// ---------------------------------------------------------------------------

/**
 * A single benchmark observation bucket.
 * `feedback_count` starts at 0; a score of 0 with feedback_count 0
 * indicates no data yet.
 */
export const BenchmarkBucketSchema = z.object({
  score: z.number(),
  feedback_count: z.number().int().nonnegative(),
});
export type BenchmarkBucket = z.infer<typeof BenchmarkBucketSchema>;

/**
 * Quality benchmarks keyed by complexity+role or specialization.
 * Both records start empty ({}) until real feedback accumulates.
 */
export const QualityBenchmarkSchema = z.object({
  /**
   * Scores indexed by "<complexity>:<role>", e.g. "complex:coder".
   * Empty object until feedback accumulates.
   */
  by_complexity_role: z.record(BenchmarkBucketSchema),
  /**
   * Scores indexed by specialization, e.g. "frontend".
   * Empty object until feedback accumulates.
   */
  by_specialization: z.record(BenchmarkBucketSchema),
});
export type QualityBenchmark = z.infer<typeof QualityBenchmarkSchema>;

/**
 * Speed benchmarks derived from observed token throughput.
 * Starts with feedback_count = 0 (no data).
 */
export const SpeedBenchmarkSchema = z.object({
  /** Average tokens per second observed so far. */
  tokens_per_second_avg: z.number(),
  /** Number of observations that contributed to the average. */
  feedback_count: z.number().int().nonnegative(),
});
export type SpeedBenchmark = z.infer<typeof SpeedBenchmarkSchema>;

/**
 * Combined benchmark envelope.
 * Both sub-benchmarks start empty and grow as the system collects real
 * feedback — no fake data is seeded here.
 */
export const BenchmarksSchema = z.object({
  quality: QualityBenchmarkSchema,
  speed: SpeedBenchmarkSchema,
});
export type Benchmarks = z.infer<typeof BenchmarksSchema>;

// ---------------------------------------------------------------------------
// ModelCard — the main type
// ---------------------------------------------------------------------------

/**
 * Provider-independent descriptor for a single LLM.
 *
 * A ModelCard captures what a model *is* and what it's good at.
 * A PickerSubscription (separate type) captures *how* to access it
 * through a specific provider and plan.
 *
 * @see PickerSubscription
 * @see ADR-049
 */
export const ModelCardSchema = z.object({
  /**
   * Canonical model identifier.
   * Must be unique across all registered model cards.
   * Examples: "gemini-2.5-flash", "gpt-4.1", "claude-sonnet-4"
   */
  model: z.string().min(1),
  /**
   * Model family / product line.
   * Examples: "gemini", "gpt", "claude", "o-series", "kimi", "deepseek"
   */
  family: z.string().min(1),
  /** Provider-independent capability flags. */
  capabilities: ModelCapabilitiesSchema,
  /** Human-curated seed classification data. */
  known_for: KnownForSchema,
  /**
   * Learned performance benchmarks.
   * All buckets start empty (feedback_count = 0) at seed time.
   */
  benchmarks: BenchmarksSchema,
  /** Cost classification for routing and budget filtering. */
  pricing_tier: PricingTierSchema,
  /**
   * Total number of feedback events incorporated into this card.
   * Starts at 0.
   */
  learned_from: z.number().int().nonnegative(),
});
export type ModelCard = z.infer<typeof ModelCardSchema>;
