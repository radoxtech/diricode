/**
 * PickerSubscription type and Zod schema for the LLM Picker two-level architecture.
 *
 * A PickerSubscription describes how a model is accessed through a specific
 * provider account or API plan — it links to a ModelCard and adds
 * provider-specific details: rate limits, cost, trust level, and availability.
 *
 * @see ModelCard — the provider-independent model descriptor
 * @see ADR-049 — LLM Picker decision architecture
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------

/**
 * Current rate-limit state for a subscription.
 * `remaining` is updated at runtime by the picker's rate-limit tracker.
 */
export const RateLimitSchema = z.object({
  /** Maximum requests allowed per rolling hour window. */
  requests_per_hour: z.number().int().positive(),
  /** Requests remaining in the current hour window. */
  remaining: z.number().int().nonnegative(),
});
export type RateLimit = z.infer<typeof RateLimitSchema>;

// ---------------------------------------------------------------------------
// PickerSubscription
// ---------------------------------------------------------------------------

/**
 * Provider-specific access descriptor for a single LLM.
 *
 * A subscription captures *how* a model is accessed: which provider,
 * which plan/tier, rate limits, cost, and whether the subscription is
 * trusted (i.e. safe for confidential code access).
 *
 * `model` links to `ModelCard.model` in the ModelCardRegistry.
 *
 * @see ModelCard
 */
export const PickerSubscriptionSchema = z.object({
  /**
   * Unique subscription identifier.
   * Examples: "copilot-enterprise", "google-api-flash", "moonshot-kimi"
   */
  id: z.string().min(1),
  /**
   * Provider that hosts this subscription.
   * Examples: "copilot", "google", "moonshot", "deepseek"
   */
  provider: z.string().min(1),
  /**
   * Links this subscription to a ModelCard by its `model` field.
   * The SubscriptionRegistry validates this reference on register.
   */
  model: z.string().min(1),
  /**
   * Effective context window in tokens for this subscription/plan.
   * May differ from ModelCard.capabilities.max_context when the plan
   * restricts or extends the base model limit.
   */
  context_window: z.number().int().positive(),
  /** Current rate-limit state for this subscription. */
  rate_limit: RateLimitSchema,
  /**
   * Whether this subscription may be used for confidential / proprietary code.
   * When false, the subscription is filtered out for confidential tasks.
   * Subscriptions backed by enterprise data-retention agreements should set
   * this to true.
   */
  trusted: z.boolean(),
  /**
   * Whether this subscription is currently active and can accept requests.
   * Set to false to soft-disable without removing from the registry.
   */
  available: z.boolean(),
  /** Cost per 1 000 input tokens in USD. 0 for free-tier plans. */
  cost_per_1k_input: z.number().nonnegative(),
  /** Cost per 1 000 output tokens in USD. 0 for free-tier plans. */
  cost_per_1k_output: z.number().nonnegative(),
});
export type PickerSubscription = z.infer<typeof PickerSubscriptionSchema>;
