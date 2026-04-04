/**
 * Provider interface and related types for @diricode/dirirouter.
 *
 * Providers wrap AI model APIs (Copilot, Kimi, etc.) and expose a
 * uniform streaming/generation interface to the rest of DiriCode.
 */

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

/**
 * Lower number = higher priority.
 * Copilot = 1, Kimi = 2 (per spec §5 MVP Providers).
 */
export type ProviderPriority = number;

/** Well-known priority constants for MVP providers. */
export const ProviderPriorities = {
  GEMINI: 1,
  COPILOT: 1,
  ZAI: 1,
  KIMI: 2,
  MINIMAX: 3,
} as const satisfies Record<string, ProviderPriority>;

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------

/** Identifies a specific model and its generation parameters. */
export interface ModelConfig {
  /** Model identifier as understood by the provider (e.g. "gpt-4o", "moonshot-v1-8k"). */
  readonly modelId: string;
  /** Maximum tokens to generate. Provider default used when omitted. */
  readonly maxTokens?: number;
  /** Sampling temperature in [0, 2]. Provider default used when omitted. */
  readonly temperature?: number;
}

// ---------------------------------------------------------------------------
// Stream chunk
// ---------------------------------------------------------------------------

/** A single chunk emitted during a streaming completion. */
export interface StreamChunk {
  /** Incremental text delta for this chunk. */
  readonly delta: string;
  /** Whether this is the final chunk in the stream. */
  readonly done: boolean;
}

// ---------------------------------------------------------------------------
// Generation options
// ---------------------------------------------------------------------------

/** Options passed to {@link Provider.generate} and {@link Provider.stream}. */
export interface GenerateOptions {
  /** Prompt / user message content. */
  readonly prompt: string;
  /** Override the provider's default model config for this request. */
  readonly model?: ModelConfig;
  /** Abort signal to cancel the request. */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * Abstract interface every AI provider adapter must implement.
 *
 * Implementations are NOT required here — this is the contract only.
 * Actual adapters (CopilotProvider, KimiProvider) live in separate modules.
 */
export interface Provider {
  /** Unique name used as the registry key (e.g. "copilot", "kimi"). */
  readonly name: string;

  /**
   * The default model configuration for this provider.
   * Individual calls may override via `GenerateOptions.model`.
   */
  readonly defaultModel: ModelConfig;

  /**
   * Returns true when the provider is ready to accept requests.
   * Implementations should check API key presence / reachability here.
   */
  isAvailable(): boolean;

  /**
   * Generate a non-streaming completion and return the full text.
   *
   * @param options - Generation parameters.
   * @returns Resolved text output.
   */
  generate(options: GenerateOptions): Promise<string>;

  /**
   * Generate a streaming completion.
   *
   * @param options - Generation parameters.
   * @returns An async iterable of {@link StreamChunk} values.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

// ---------------------------------------------------------------------------
// Registry entry (internal)
// ---------------------------------------------------------------------------

/** Internal record stored in the {@link Registry} map. */
export interface ProviderEntry {
  readonly provider: Provider;
  readonly priority: ProviderPriority;
}

// ---------------------------------------------------------------------------
// ProviderAdapter — LLM Picker interface
// ---------------------------------------------------------------------------

/**
 * Describes a single model available from a provider.
 *
 * Each quality variant is a separate entry (per Decision #12).
 * Used by the LLM Picker to match tasks to suitable models.
 */
export interface ModelDescriptor {
  /** API model identifier (e.g. "gpt-4o", "moonshot-v1-8k"). */
  readonly apiModel: string;

  /** Context window size in tokens. */
  readonly contextWindow: number;

  /** Maximum output tokens the model can generate. */
  readonly maxOutput: number;

  /** Whether the model supports reasoning capabilities. */
  readonly canReason: boolean;

  /** Whether the model supports tool/function calling. */
  readonly toolCall: boolean;

  /** Whether the model supports vision/image inputs. */
  readonly vision: boolean;

  /** Whether the model supports file attachments. */
  readonly attachment: boolean;

  /**
   * Budget pacing multiplier. Reasoning models may cost 2x.
   * Defaults to 1 when not specified.
   */
  readonly quotaMultiplier: number;
}

/**
 * Per-model quota information.
 *
 * Tracks remaining quota and reset time for rate-limited providers.
 */
export interface ModelQuota {
  /** API model identifier. */
  readonly apiModel: string;

  /** Remaining quota for this model. */
  readonly remaining: number;

  /** UTC ISO 8601 timestamp when quota resets. */
  readonly resetAt: string;
}

/**
 * Adapter interface that all provider packages must implement for LLM Picker integration.
 *
 * This replaces the old Provider/SubscriptionProvider pattern and provides
 * a standardized way for the picker to discover available models and their quotas.
 *
 * Design decisions:
 * - No lifecycle methods (init/refresh/cleanup) — provider just works (Decision #31)
 * - No temperature field — provider hardcodes where required (Decision #15)
 * - Static listModels() returns all models including quality variants (Decision #12)
 */
export interface ProviderAdapter {
  /**
   * Unique provider identifier.
   *
   * Must match the provider name: "copilot", "kimi", "zai", "minimax" (Decision #30).
   */
  readonly providerId: string;

  /**
   * Returns a static list of all models this provider supports.
   *
   * Each quality variant should be a separate entry. The picker uses this
   * to build its candidate model list.
   *
   * @returns Array of model descriptors.
   */
  listModels(): ModelDescriptor[];

  /**
   * Returns per-model quota data.
   *
   * For providers with quota APIs, returns remaining calls and reset time
   * per model. Returns null if the provider has no quota API (Decisions #28, #29, #32).
   *
   * @returns Array of model quotas, or null if quota unavailable.
   */
  getQuota(): ModelQuota[] | null;
}
