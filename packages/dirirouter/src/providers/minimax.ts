/**
 * MiniMax AI provider implementation for @diricode/dirirouter.
 *
 * Implements the Provider interface using MiniMax's OpenAI-compatible API
 * via @ai-sdk/openai-compatible. Provides both streaming and non-streaming
 * generation.
 *
 * Also exports the MinimaxProviderAdapter for LLM Picker integration
 * (static model metadata).
 *
 * @example
 * ```typescript
 * const provider = new MinimaxProvider(process.env.DC_MINIMAX_API_KEY!);
 * const response = await provider.generate({ prompt: "Hello!" });
 * ```
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { classifyError } from "../error-classifier.js";
import type {
  GenerateOptions,
  ModelConfig,
  ModelDescriptor,
  ModelQuota,
  Provider,
  ProviderAdapter,
  StreamChunk,
} from "../types.js";
import type { ProviderDiscoveryResult } from "../provider-discovery.js";
import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Permanent fallback list — MiniMax is the golden source for model availability.
 * This list is ONLY used when the provider API is unreachable.
 * DO NOT edit this list manually; it is auto-generated from provider API responses.
 * To update: run `pnpm --filter @diricode/dirirouter playground` and capture live availability.
 */
const MINIMAX_FALLBACK_AVAILABILITIES: ProviderModelAvailability[] = [
  {
    provider: "minimax",
    model_id: "MiniMax-M2.7",
    family: "minimax-m2",
    stability: "stable",
    available: true,
    context_window: 204_800,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "minimax",
    model_id: "MiniMax-M2.7-highspeed",
    family: "minimax-m2",
    stability: "stable",
    available: true,
    context_window: 204_800,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "minimax",
    model_id: "MiniMax-M2.5",
    family: "minimax-m2",
    stability: "stable",
    available: true,
    context_window: 204_800,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "minimax",
    model_id: "MiniMax-M2.5-highspeed",
    family: "minimax-m2",
    stability: "stable",
    available: true,
    context_window: 204_800,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "minimax",
    model_id: "MiniMax-M2.1",
    family: "minimax-m2",
    stability: "stable",
    available: true,
    context_window: 204_800,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "minimax",
    model_id: "MiniMax-M2",
    family: "minimax-m2",
    stability: "stable",
    available: true,
    context_window: 196_608,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
];

/** Default base URL for MiniMax OpenAI-compatible API (global endpoint) */
const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1";

// ---------------------------------------------------------------------------
// Provider — runtime generation interface
// ---------------------------------------------------------------------------

/**
 * Configuration options for MinimaxProvider.
 */
export interface MinimaxProviderConfig {
  /** MiniMax API key (required) */
  apiKey: string;
  /** Override default base URL. Defaults to MiniMax global endpoint */
  baseURL?: string;
}

/**
 * MiniMax provider adapter implementing the DiriCode Provider interface.
 *
 * Uses MiniMax-M2.7 model by default — the latest model with reasoning
 * capabilities, 204K context window. Supports both streaming and
 * non-streaming generation via OpenAI-compatible API.
 *
 * @implements {Provider}
 */
export class MinimaxProvider implements Provider {
  /** Provider name used for registry identification */
  readonly name = "minimax";

  /**
   * Default model configuration.
   * Uses MiniMax-M2.7 for best balance of quality and capability.
   */
  readonly defaultModel: ModelConfig = {
    modelId: "MiniMax-M2.7",
    temperature: 0.2,
    maxTokens: 4096,
  };

  /** OpenAI-compatible provider instance */
  #provider: ReturnType<typeof createOpenAICompatible>;

  /** MiniMax API key */
  #apiKey: string;

  /**
   * Creates a new MinimaxProvider instance.
   *
   * Resolves API key from provided config/string, then falls back to
   * DC_MINIMAX_API_KEY environment variable.
   *
   * @param config - Configuration object or API key string
   * @throws {Error} If no API key can be resolved from config or environment
   *
   * @example
   * ```typescript
   * // With config object
   * const provider = new MinimaxProvider({ apiKey: "your-api-key" });
   *
   * // With API key string
   * const provider = new MinimaxProvider("your-api-key");
   *
   * // From environment variable
   * process.env.DC_MINIMAX_API_KEY = "your-api-key";
   * const provider = new MinimaxProvider({ apiKey: process.env.DC_MINIMAX_API_KEY! });
   * ```
   */
  constructor(config: MinimaxProviderConfig | string) {
    const rawApiKey = typeof config === "string" ? config : config.apiKey;
    const baseURL =
      typeof config === "string"
        ? DEFAULT_MINIMAX_BASE_URL
        : (config.baseURL ?? DEFAULT_MINIMAX_BASE_URL);

    const envApiKey = process.env.DC_MINIMAX_API_KEY ?? "";
    const resolvedApiKey = rawApiKey.trim() || envApiKey;

    if (!resolvedApiKey) {
      throw new Error(
        "MinimaxProvider requires an API key. " +
          "Provide it via constructor or DC_MINIMAX_API_KEY environment variable.",
      );
    }

    this.#apiKey = resolvedApiKey;

    this.#provider = createOpenAICompatible({
      name: "minimax",
      baseURL,
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
      },
    });
  }

  /**
   * Checks if provider is available and properly configured.
   *
   * @returns {boolean} True if API key is present and non-empty
   */
  isAvailable(): boolean {
    return this.#apiKey.length > 0;
  }

  getModelAvailability(): ProviderModelAvailability[] {
    return MINIMAX_FALLBACK_AVAILABILITIES;
  }

  async discoverAvailability(): Promise<ProviderDiscoveryResult> {
    const availabilities = this.getModelAvailability();
    return {
      provider: this,
      availabilities,
      status: {
        name: this.name,
        available: this.isAvailable(),
        envVar: "DC_MINIMAX_API_KEY",
        modelCount: availabilities.length,
        modelNames: availabilities.map((a) => a.model_id),
      },
    };
  }

  /**
   * Generates a non-streaming completion and returns full text.
   *
   * @param options - Generation parameters including prompt and optional model overrides
   * @returns {Promise<string>} The generated text response
   * @throws {Error} If API call fails or returns an empty response
   *
   * @example
   * ```typescript
   * const response = await provider.generate({
   *   prompt: "Explain TypeScript generics"
   * });
   * console.log(response); // "TypeScript generics are..."
   * ```
   */
  async generate(options: GenerateOptions): Promise<string> {
    const modelId = options.model?.modelId ?? this.defaultModel.modelId;

    try {
      const { generateText } = await import("ai");
      const { text } = await generateText({
        model: this.#provider.chatModel(modelId),
        prompt: options.prompt,
        maxOutputTokens: options.model?.maxTokens ?? this.defaultModel.maxTokens,
        temperature: options.model?.temperature ?? this.defaultModel.temperature,
        abortSignal: options.signal,
      });

      if (!text) {
        throw new Error("MiniMax API returned empty response");
      }

      return text;
    } catch (error) {
      throw classifyError(error, {
        provider: this.name,
        model: modelId,
      });
    }
  }

  /**
   * Generates a streaming completion that yields chunks incrementally.
   *
   * @param options - Generation parameters including prompt and optional model overrides
   * @returns {AsyncIterable<StreamChunk>} Async iterator of text chunks
   * @yields {StreamChunk} Text chunks with delta updates
   * @throws {Error} If streaming API call fails
   *
   * @example
   * ```typescript
   * for await (const chunk of provider.stream({ prompt: "Hello" })) {
   *   process.stdout.write(chunk.delta);
   *   if (chunk.done) break;
   * }
   * ```
   */
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const modelId = options.model?.modelId ?? this.defaultModel.modelId;

    try {
      const { streamText } = await import("ai");
      const result = streamText({
        model: this.#provider.chatModel(modelId),
        prompt: options.prompt,
        maxOutputTokens: options.model?.maxTokens ?? this.defaultModel.maxTokens,
        temperature: options.model?.temperature ?? this.defaultModel.temperature,
        abortSignal: options.signal,
      });

      for await (const delta of result.fullStream) {
        if (delta.type === "text-delta") {
          yield { delta: delta.text, done: false };
        }
      }

      yield { delta: "", done: true };
    } catch (error) {
      throw classifyError(error, {
        provider: this.name,
        model: modelId,
      });
    }
  }
}

/**
 * Factory function to create a MinimaxProvider instance.
 *
 * @param config - Configuration object or API key string
 * @returns {Provider} A new MinimaxProvider instance
 *
 * @example
 * ```typescript
 * const provider = createMinimaxProvider(process.env.DC_MINIMAX_API_KEY!);
 * ```
 */
export function createMinimaxProvider(config: MinimaxProviderConfig | string): Provider {
  return new MinimaxProvider(config);
}

// ---------------------------------------------------------------------------
// ProviderAdapter — LLM Picker static metadata
// ---------------------------------------------------------------------------

const MINIMAX_MODELS: ModelDescriptor[] = [
  {
    apiModel: "MiniMax-M2.7",
    contextWindow: 204_800,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "MiniMax-M2.7-highspeed",
    contextWindow: 204_800,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "MiniMax-M2.5",
    contextWindow: 204_800,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "MiniMax-M2.5-highspeed",
    contextWindow: 204_800,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "MiniMax-M2.1",
    contextWindow: 204_800,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "MiniMax-M2.1-highspeed",
    contextWindow: 204_800,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "MiniMax-M2",
    contextWindow: 196_608,
    maxOutput: 128_000,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
];

export class MinimaxProviderAdapter implements ProviderAdapter {
  readonly providerId = "minimax";

  listModels(): ModelDescriptor[] {
    return MINIMAX_MODELS;
  }

  getQuota(): ModelQuota[] | null {
    return null;
  }
}
