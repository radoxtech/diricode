/**
 * Kimi (Moonshot AI) provider implementation for @diricode/providers.
 *
 * Implements the Provider interface using Moonshot AI's OpenAI-compatible API
 * via the @ai-sdk/openai-compatible SDK. Provides both streaming and
 * non-streaming generation.
 *
 * @example
 * ```typescript
 * const provider = new KimiProvider(process.env.DC_KIMI_API_KEY!);
 * const response = await provider.generate({ prompt: "Hello!" });
 * ```
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";

/** Default base URL for Moonshot AI API */
const DEFAULT_KIMI_BASE_URL = "https://api.moonshot.cn/v1";

/**
 * Configuration options for the KimiProvider.
 */
export interface KimiProviderConfig {
  /** Moonshot AI API key (required) */
  apiKey: string;
  /** Override the default base URL. Defaults to "https://api.moonshot.cn/v1" */
  baseURL?: string;
}

/**
 * Kimi provider adapter implementing the DiriCode Provider interface.
 *
 * Uses Moonshot AI's moonshot-v1-8k model by default. Supports both
 * streaming and non-streaming generation via the OpenAI-compatible API.
 *
 * @implements {Provider}
 */
export class KimiProvider implements Provider {
  /** Provider name used for registry identification */
  readonly name = "kimi";

  /**
   * Default model configuration.
   * Uses moonshot-v1-8k for cost-effective, fast responses.
   */
  readonly defaultModel: ModelConfig = {
    modelId: "moonshot-v1-8k",
    temperature: 0.3,
    maxTokens: 4096,
  };

  /** OpenAI-compatible provider instance */
  #provider: ReturnType<typeof createOpenAICompatible>;

  /** Moonshot AI API key */
  #apiKey: string;

  /**
   * Creates a new KimiProvider instance.
   *
   * Resolves the API key from the provided config/string, then falls back to
   * the DC_KIMI_API_KEY and KIMI_API_KEY environment variables.
   *
   * @param config - Configuration object or API key string
   * @throws {Error} If no API key can be resolved from config or environment
   *
   * @example
   * ```typescript
   * // With config object
   * const provider = new KimiProvider({ apiKey: "your-api-key" });
   *
   * // With API key string
   * const provider = new KimiProvider("your-api-key");
   *
   * // From environment variable
   * process.env.DC_KIMI_API_KEY = "your-api-key";
   * const provider = new KimiProvider({ apiKey: process.env.DC_KIMI_API_KEY! });
   * ```
   */
  constructor(config: KimiProviderConfig | string) {
    const rawApiKey = typeof config === "string" ? config : config.apiKey;
    const baseURL =
      typeof config === "string"
        ? DEFAULT_KIMI_BASE_URL
        : (config.baseURL ?? DEFAULT_KIMI_BASE_URL);

    const resolvedApiKey =
      rawApiKey || process.env["DC_KIMI_API_KEY"] || process.env["KIMI_API_KEY"] || "";

    if (!resolvedApiKey || resolvedApiKey.trim() === "") {
      throw new Error(
        "KimiProvider requires an API key. " +
          "Provide it via constructor or DC_KIMI_API_KEY environment variable.",
      );
    }

    this.#apiKey = resolvedApiKey;

    this.#provider = createOpenAICompatible({
      name: "kimi",
      baseURL,
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
      },
    });
  }

  /**
   * Checks if the provider is available and properly configured.
   *
   * @returns {boolean} True if API key is present and non-empty
   */
  isAvailable(): boolean {
    return this.#apiKey.length > 0;
  }

  /**
   * Generates a non-streaming completion and returns the full text.
   *
   * @param options - Generation parameters including prompt and optional model overrides
   * @returns {Promise<string>} The generated text response
   * @throws {Error} If the API call fails or returns an empty response
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
        throw new Error("Kimi API returned empty response");
      }

      return text;
    } catch (error) {
      throw this.handleError(error, "generate");
    }
  }

  /**
   * Generates a streaming completion that yields chunks incrementally.
   *
   * @param options - Generation parameters including prompt and optional model overrides
   * @returns {AsyncIterable<StreamChunk>} Async iterator of text chunks
   * @yields {StreamChunk} Text chunks with delta updates
   * @throws {Error} If the streaming API call fails
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
      throw this.handleError(error, "stream");
    }
  }

  /**
   * Converts API errors to descriptive Error instances.
   *
   * @param error - The error from the Moonshot AI API or SDK
   * @param context - The operation context ("generate" or "stream")
   * @returns {Error} Standardized error with descriptive message
   * @private
   */
  private handleError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      if (
        error.message.toLowerCase().includes("api key") ||
        error.message.toLowerCase().includes("unauthorized") ||
        error.message.toLowerCase().includes("401")
      ) {
        return new Error("Invalid or missing API key. Check your DC_KIMI_API_KEY configuration.");
      }

      if (
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("429")
      ) {
        return new Error("Rate limit exceeded. Please wait before retrying.");
      }

      return new Error(`KimiProvider ${context} failed: ${error.message}`);
    }

    return new Error(`KimiProvider ${context} failed: Unknown error occurred`);
  }
}

/**
 * Factory function to create a KimiProvider instance.
 *
 * @param config - Configuration object or API key string
 * @returns {Provider} A new KimiProvider instance
 *
 * @example
 * ```typescript
 * const provider = createKimiProvider(process.env.DC_KIMI_API_KEY!);
 * ```
 */
export function createKimiProvider(config: KimiProviderConfig | string): Provider {
  return new KimiProvider(config);
}
