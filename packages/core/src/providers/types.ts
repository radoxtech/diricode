import { z } from "zod";

/**
 * Subscription represents a single LLM provider account/API key that can provide models.
 * Multiple subscriptions can be active simultaneously for multi-provider rotation.
 *
 * References: ADR-042 (multi-subscription management)
 */

export const SubscriptionLimitsSchema = z.object({
  rpm: z.number().int().positive().optional().describe("Requests per minute"),
  tpm: z.number().int().positive().optional().describe("Tokens per minute"),
  dailyTokens: z.number().int().positive().optional().describe("Daily token budget"),
  monthlyBudgetUsd: z.number().positive().optional().describe("Monthly spending cap in USD"),
  resetSchedule: z
    .enum(["rolling", "daily-utc", "daily-local", "monthly"])
    .describe("When limits reset"),
});

export type SubscriptionLimits = z.infer<typeof SubscriptionLimitsSchema>;

export const SubscriptionSchema = z.object({
  id: z.string().describe("Unique subscription ID (e.g., 'anthropic-personal', 'azure-work')"),
  provider: z
    .enum(["anthropic", "openai", "azure", "google", "moonshot", "deepseek", "local"])
    .describe("LLM provider identifier"),
  priority: z
    .number()
    .int()
    .min(1)
    .describe("Routing priority: lower = preferred (like LiteLLM order)"),
  enabled: z.boolean().default(true).describe("Can be toggled without removing config"),
  tags: z
    .array(z.string())
    .default([])
    .describe("Tags for filtering (e.g., 'work', 'free-tier', 'bulk-only')"),
  limits: SubscriptionLimitsSchema.describe("Rate limits, quotas, and budget constraints"),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

/**
 * SubscriptionHealth tracks real-time state of a subscription.
 * Updated after every API call by parsing provider response headers.
 *
 * References: ADR-042 (subscription router + health tracking)
 */

export const SubscriptionHealthSchema = z.object({
  subscriptionId: z.string().describe("Reference to Subscription.id"),
  status: z
    .enum(["healthy", "degraded", "cooldown", "exhausted"])
    .describe("Current health status"),
  rateLimits: z.object({
    rpmUsed: z.number().int().min(0).describe("Requests used in current period"),
    rpmLimit: z.number().int().positive().describe("RPM limit"),
    rpmReset: z.string().datetime().describe("ISO 8601 timestamp when RPM resets"),
    tpmUsed: z.number().int().min(0).describe("Tokens used in current period"),
    tpmLimit: z.number().int().positive().describe("TPM limit"),
    tpmReset: z.string().datetime().describe("ISO 8601 timestamp when TPM resets"),
  }),
  quota: z.object({
    used: z.number().min(0).max(1).describe("Quota used as ratio (0.0 to 1.0)"),
    remaining: z.number().min(0).describe("Tokens remaining"),
    resetAt: z.string().datetime().describe("ISO 8601 timestamp when quota resets"),
  }),
  cooldown: z.object({
    until: z
      .string()
      .datetime()
      .nullable()
      .describe("Cooldown expiry timestamp; null if not in cooldown"),
    consecutiveFailures: z.number().int().min(0).describe("Count of consecutive API failures"),
  }),
  costs: z.object({
    sessionSpend: z.number().min(0).describe("USD spent this session"),
    dailySpend: z.number().min(0).describe("USD spent today"),
    monthlySpend: z.number().min(0).describe("USD spent this billing period"),
  }),
  latency: z.object({
    p50: z.number().positive().describe("Median latency in milliseconds"),
    p95: z.number().positive().describe("95th percentile latency in milliseconds"),
    lastMeasured: z.string().datetime().describe("ISO 8601 timestamp of last measurement"),
  }),
});

export type SubscriptionHealth = z.infer<typeof SubscriptionHealthSchema>;

/**
 * ModelScore represents Elo-style quality rating for a (model, subscription, task_type) tuple.
 * Used for data-driven model selection across multiple subscriptions.
 *
 * References: ADR-044 (Elo scoring and A/B testing)
 */

export const ModelScoreSchema = z.object({
  modelId: z.string().describe("Model identifier (e.g., 'claude-opus-4.6', 'gpt-5.4')"),
  subscriptionId: z.string().describe("Reference to Subscription.id"),
  taskType: z
    .string()
    .describe(
      "Task category for which this score applies (e.g., 'code-write', 'review', 'planning')",
    ),
  eloRating: z
    .number()
    .min(0)
    .default(1000.0)
    .describe("Bradley-Terry Elo rating (starts at 1000)"),
  matchCount: z.number().int().min(0).default(0).describe("Number of matched comparisons"),
  avgLatencyMs: z.number().positive().optional().describe("Average API latency in milliseconds"),
  avgCostUsd: z.number().min(0).optional().describe("Average cost per call in USD"),
  successRate: z.number().min(0).max(1).optional().describe("Success rate (0.0 to 1.0)"),
  lastUpdated: z.string().datetime().describe("ISO 8601 timestamp of last Elo update"),
});

export type ModelScore = z.infer<typeof ModelScoreSchema>;

/**
 * ABExperiment defines a structured A/B test comparing models on equivalent tasks.
 * Part of the quality scoring system that feeds into adaptive model routing.
 *
 * References: ADR-044 (Elo scoring and A/B testing)
 */

export const ABExperimentSchema = z.object({
  id: z.string().describe("Unique experiment ID (UUID format recommended)"),
  name: z.string().describe("Human-readable experiment name"),
  status: z.enum(["active", "paused", "completed"]).describe("Current experiment status"),
  taskFilter: z
    .record(z.unknown())
    .optional()
    .describe("JSON query to filter tasks (e.g., tier, family, tags)"),
  minMatches: z
    .number()
    .int()
    .positive()
    .default(50)
    .describe("Minimum pairwise comparisons before declaring winner"),
  costCapUsd: z.number().positive().optional().describe("Maximum budget for this experiment"),
  currentSpendUsd: z.number().min(0).default(0).describe("Amount spent so far"),
  createdAt: z.string().datetime().describe("ISO 8601 timestamp of experiment creation"),
  completedAt: z
    .string()
    .datetime()
    .optional()
    .describe("ISO 8601 timestamp of experiment completion"),
});

export type ABExperiment = z.infer<typeof ABExperimentSchema>;

/**
 * Comparison represents a single pairwise outcome used to compute Elo ratings.
 * Collected from automated signals (tests), agentic evaluation (reviewer-agent),
 * or human feedback (thumbs up/down).
 */

export const ComparisonSchema = z.object({
  id: z.string().describe("Unique comparison record ID"),
  experimentId: z.string().optional().describe("Optional link to ABExperiment.id"),
  taskId: z.string().describe("Task or issue that generated this comparison"),
  taskType: z.string().describe("Task category (e.g., 'code-write', 'review')"),
  winnerModelId: z.string().describe("Model ID of winner"),
  winnerSubId: z.string().describe("Subscription ID of winner"),
  loserModelId: z.string().describe("Model ID of loser"),
  loserSubId: z.string().describe("Subscription ID of loser"),
  isDraw: z.boolean().default(false).describe("True if both models performed equally"),
  signalSource: z
    .enum(["automated-test", "human-feedback", "reviewer-agent"])
    .describe("How the winner was determined"),
  createdAt: z.string().datetime().describe("ISO 8601 timestamp of comparison"),
});

export type Comparison = z.infer<typeof ComparisonSchema>;
