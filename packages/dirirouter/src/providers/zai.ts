/**
 * z.ai GLM Coding Plan provider implementation for @diricode/dirirouter.
 *
 * Implements Provider interface using Z.ai's GLM Coding Plan API via
 * OpenAI-compatible @ai-sdk/openai-compatible. Provides both streaming
 * and non-streaming generation.
 *
 * @example
 * ```typescript
 * const provider = new ZaiProvider(process.env.DC_ZAI_API_KEY!);
 * const response = await provider.generate({ prompt: "Hello!" });
 * ```
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { classifyError } from "../error-classifier.js";
import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";
import type { ProviderDiscoveryResult } from "../provider-discovery.js";
import type {
  GenerateOptions,
  ModelConfig,
  ModelDescriptor,
  ModelQuota,
  Provider,
  ProviderAdapter,
  StreamChunk,
} from "../types.js";

/**
 * Permanent fallback list — Z.ai is the golden source for model availability.
 * This list is ONLY used when the provider API is unreachable.
 * DO NOT edit this list manually; it is auto-generated from provider API responses.
 * To update: run `pnpm --filter @diricode/dirirouter playground` and capture live availability.
 */
const ZAI_FALLBACK_AVAILABILITIES: ProviderModelAvailability[] = [
  {
    provider: "zai",
    model_id: "glm-5",
    family: "glm-5",
    stability: "stable",
    available: true,
    context_window: 128_000,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "zai",
    model_id: "glm-5-plus",
    family: "glm-5-plus",
    stability: "stable",
    available: true,
    context_window: 128_000,
    supports_tool_calling: true,
    supports_vision: true,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "zai",
    model_id: "glm-5-turbo",
    family: "glm-5-turbo",
    stability: "stable",
    available: true,
    context_window: 128_000,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "zai",
    model_id: "glm-5-turbo-plus",
    family: "glm-5-turbo-plus",
    stability: "stable",
    available: true,
    context_window: 128_000,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
];

/** Default base URL for Z.ai GLM Coding Plan API */
const DEFAULT_ZAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4";

/**
 * Configuration options for ZaiProvider.
 */
export interface ZaiProviderConfig {
  /** Z.ai GLM Coding Plan API key (required) */
  apiKey: string;
  /** Override default base URL. Defaults to Z.ai coding endpoint */
  baseURL?: string;
}

/**
 * Z.ai GLM Coding Plan provider adapter implementing DiriCode Provider interface.
 *
 * Uses Z.ai's glm-5-turbo model by default for optimal balance of
 * speed and quality for coding tasks. Supports both streaming and
 * non-streaming generation via OpenAI-compatible API.
 *
 * @implements {Provider}
 */
export class ZaiProvider implements Provider {
  /** Provider name used for registry identification */
  readonly name = "zai";

  /**
   * Default model configuration.
   * Uses glm-5-turbo for optimal balance of speed and quality for coding tasks.
   */
  readonly defaultModel: ModelConfig = {
    modelId: "glm-5-turbo",
    temperature: 0.2,
    maxTokens: 4096,
  };

  /** OpenAI-compatible provider instance */
  #provider: ReturnType<typeof createOpenAICompatible>;

  /** Z.ai API key */
  #apiKey: string;

  /**
   * Creates a new ZaiProvider instance.
   *
   * Resolves API key from provided config/string, then falls back to
   * DC_ZAI_API_KEY environment variable.
   *
   * @param config - Configuration object or API key string
   * @throws {Error} If no API key can be resolved from config or environment
   *
   * @example
   * ```typescript
   * // With config object
   * const provider = new ZaiProvider({ apiKey: "your-api-key" });
   *
   * // With API key string
   * const provider = new ZaiProvider("your-api-key");
   *
   * // From environment variable
   * process.env.DC_ZAI_API_KEY = "your-api-key";
   * const provider = new ZaiProvider({ apiKey: process.env.DC_ZAI_API_KEY! });
   * ```
   */
  constructor(config: ZaiProviderConfig | string) {
    const rawApiKey = typeof config === "string" ? config : config.apiKey;
    const baseURL =
      typeof config === "string" ? DEFAULT_ZAI_BASE_URL : (config.baseURL ?? DEFAULT_ZAI_BASE_URL);

    const envApiKey = process.env.DC_ZAI_API_KEY ?? "";
    const resolvedApiKey = rawApiKey.trim() || envApiKey;

    if (!resolvedApiKey) {
      throw new Error(
        "ZaiProvider requires an API key. " +
          "Provide it via constructor or DC_ZAI_API_KEY environment variable.",
      );
    }

    this.#apiKey = resolvedApiKey;

    this.#provider = createOpenAICompatible({
      name: "zai",
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
    return ZAI_FALLBACK_AVAILABILITIES;
  }

  async discoverAvailability(): Promise<ProviderDiscoveryResult> {
    await Promise.resolve();
    const availabilities = this.getModelAvailability();
    return {
      provider: this,
      availabilities,
      status: {
        name: this.name,
        available: this.isAvailable(),
        envVar: "DC_ZAI_API_KEY",
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
        throw new Error("Z.ai API returned empty response");
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

// ---------------------------------------------------------------------------
// ProviderAdapter — LLM Picker static metadata
// ---------------------------------------------------------------------------

const ZAI_MODELS: ModelDescriptor[] = [
  {
    apiModel: "glm-5",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "glm-5-turbo",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-5.1",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 2,
  },
  {
    apiModel: "glm-5v-turbo",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: true,
    attachment: true,
    quotaMultiplier: 2,
  },
  {
    apiModel: "glm-4.7",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.7-flash",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.7-flashx",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.6",
    contextWindow: 200_000,
    maxOutput: 131_072,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.6v",
    contextWindow: 128_000,
    maxOutput: 32_768,
    canReason: true,
    toolCall: true,
    vision: true,
    attachment: true,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.5",
    contextWindow: 131_072,
    maxOutput: 98_304,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.5-flash",
    contextWindow: 131_072,
    maxOutput: 98_304,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.5-air",
    contextWindow: 131_072,
    maxOutput: 98_304,
    canReason: true,
    toolCall: true,
    vision: false,
    attachment: false,
    quotaMultiplier: 1,
  },
  {
    apiModel: "glm-4.5v",
    contextWindow: 64_000,
    maxOutput: 16_384,
    canReason: true,
    toolCall: true,
    vision: true,
    attachment: true,
    quotaMultiplier: 1,
  },
];

export class ZaiProviderAdapter implements ProviderAdapter {
  readonly providerId = "zai";

  listModels(): ModelDescriptor[] {
    return ZAI_MODELS;
  }

  getQuota(): ModelQuota[] | null {
    return null;
  }
}

/**
 * Factory function to create a ZaiProvider instance.
 *
 * @param config - Configuration object or API key string
 * @returns {Provider} A new ZaiProvider instance
 *
 * @example
 * ```typescript
 * const provider = createZaiProvider(process.env.DC_ZAI_API_KEY!);
 * ```
 */
export function createZaiProvider(config: ZaiProviderConfig | string): Provider {
  return new ZaiProvider(config);
}
