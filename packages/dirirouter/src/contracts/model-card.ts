import { z } from "zod";

export const PricingTierSchema = z.enum(["budget", "standard", "premium"]);
export type PricingTier = z.infer<typeof PricingTierSchema>;

export const ReasoningLevelSchema = z.enum(["low", "medium", "high", "xhigh"]);
export type ReasoningLevel = z.infer<typeof ReasoningLevelSchema>;

export const ModelCapabilitiesSchema = z.object({
  tool_calling: z.boolean(),
  streaming: z.boolean(),
  json_mode: z.boolean(),
  vision: z.boolean(),
  max_context: z.number().int().nonnegative().nullable(),
});
export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>;

export const KnownForSchema = z.object({
  roles: z.array(z.string()),
  complexities: z.array(z.string()),
  specializations: z.array(z.string()),
});
export type KnownFor = z.infer<typeof KnownForSchema>;

export const BenchmarkBucketSchema = z.object({
  score: z.number(),
  feedback_count: z.number().int().nonnegative(),
});
export type BenchmarkBucket = z.infer<typeof BenchmarkBucketSchema>;

export const QualityBenchmarkSchema = z.object({
  by_complexity_role: z.record(z.string(), BenchmarkBucketSchema),
  by_specialization: z.record(z.string(), BenchmarkBucketSchema),
});
export type QualityBenchmark = z.infer<typeof QualityBenchmarkSchema>;

export const SpeedBenchmarkSchema = z.object({
  tokens_per_second_avg: z.number(),
  feedback_count: z.number().int().nonnegative(),
});
export type SpeedBenchmark = z.infer<typeof SpeedBenchmarkSchema>;

export const BenchmarksSchema = z.object({
  quality: QualityBenchmarkSchema,
  speed: SpeedBenchmarkSchema,
});
export type Benchmarks = z.infer<typeof BenchmarksSchema>;

export const ModelCardSchema = z.object({
  model: z.string().min(1),
  family: z.string().min(1),
  capabilities: ModelCapabilitiesSchema,
  reasoning_levels: z.array(ReasoningLevelSchema).default([]),
  known_for: KnownForSchema,
  benchmarks: BenchmarksSchema,
  pricing_tier: PricingTierSchema,
  learned_from: z.number().int().nonnegative(),
});
export type ModelCard = z.infer<typeof ModelCardSchema>;
