/**
 * Provider interface and related types for @diricode/providers.
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
  COPILOT: 1,
  KIMI: 2,
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
