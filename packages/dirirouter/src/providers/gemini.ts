/**
 * Google Gemini provider implementation for @diricode/dirirouter.
 *
 * Implements the Provider interface using Google's Gemini API via the
 * @google/genai SDK. Provides both streaming and non-streaming generation.
 *
 * @example
 * ```typescript
 * const provider = new GeminiProvider(process.env.GEMINI_API_KEY!);
 * const response = await provider.generate({ prompt: "Hello!" });
 * ```
 */

import { GoogleGenAI } from "@google/genai";
import { classifyError } from "../error-classifier.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import type { ModelCard } from "../contracts/model-card.js";

const EMPTY_BENCHMARKS: ModelCard["benchmarks"] = {
  quality: { by_complexity_role: {}, by_specialization: {} },
  speed: { tokens_per_second_avg: 0, feedback_count: 0 },
};

const GEMINI_MODEL_CARDS: ModelCard[] = [
  {
    model: "gemini-2.5-flash",
    family: "gemini-flash",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 1_048_576,
    },
    reasoning_levels: ["low", "medium", "high"],
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "gemini-2.5-flash-lite",
    family: "gemini-flash-lite",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 1_048_576,
    },
    reasoning_levels: ["low", "medium"],
    known_for: {
      roles: ["coder"],
      complexities: ["simple"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "gemini-2.5-pro",
    family: "gemini-pro",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 1_048_576,
    },
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    known_for: {
      roles: ["architect", "reviewer", "orchestrator", "coder"],
      complexities: ["moderate", "complex", "expert"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "gemini-3-flash-preview",
    family: "gemini-flash",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 1_048_576,
    },
    reasoning_levels: ["low", "medium", "high"],
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate", "complex"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "gemini-3.1-flash-lite-preview",
    family: "gemini-flash-lite",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 1_048_576,
    },
    reasoning_levels: ["low", "medium"],
    known_for: {
      roles: ["coder"],
      complexities: ["simple"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "gemini-3.1-pro-preview",
    family: "gemini-pro",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 1_048_576,
    },
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    known_for: {
      roles: ["architect", "reviewer", "orchestrator", "coder"],
      complexities: ["moderate", "complex", "expert"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
];

/**
 * Configuration options for the GeminiProvider.
 */
export interface GeminiProviderConfig {
  /** Google AI API key (required) */
  apiKey: string;
}

/**
 * Gemini provider adapter implementing the DiriCode Provider interface.
 *
 * Uses Google's Gemini 2.5 Flash model by default for optimal balance of
 * speed and quality. Supports both streaming and non-streaming generation.
 *
 * @implements {Provider}
 */
export class GeminiProvider implements Provider {
  /** Provider name used for registry identification */
  readonly name = "gemini";

  /**
   * Default model configuration.
   * Uses gemini-2.5-flash for cost-effective, fast responses.
   */
  readonly defaultModel: ModelConfig = {
    modelId: "gemini-2.5-flash",
    temperature: 0.2,
    maxTokens: 4096,
  };

  /** Google GenAI client instance */
  private client: GoogleGenAI;

  /**
   * Creates a new GeminiProvider instance.
   *
   * @param config - Configuration object or API key string
   * @throws {Error} If API key is not provided
   *
   * @example
   * ```typescript
   * // With config object
   * const provider = new GeminiProvider({ apiKey: "your-api-key" });
   *
   * // With API key string
   * const provider = new GeminiProvider("your-api-key");
   * ```
   */
  constructor(config: GeminiProviderConfig | string) {
    const apiKey = typeof config === "string" ? config : config.apiKey;

    if (!apiKey || apiKey.trim() === "") {
      throw new Error(
        "GeminiProvider requires an API key. " +
          "Provide it via constructor or GEMINI_API_KEY environment variable.",
      );
    }

    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Checks if the provider is available and properly configured.
   *
   * @returns {boolean} True if client is initialized
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Generates a non-streaming completion and returns the full text.
   *
   * @param options - Generation parameters including prompt and optional model overrides
   * @returns {Promise<string>} The generated text response
   * @throws {Error} If the API call fails or returns invalid response
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
    const temperature = options.model?.temperature ?? this.defaultModel.temperature;
    const maxTokens = options.model?.maxTokens ?? this.defaultModel.maxTokens;

    try {
      const response = await this.client.models.generateContent({
        model: modelId,
        contents: options.prompt,
        config: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini API returned empty response");
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
    const temperature = options.model?.temperature ?? this.defaultModel.temperature;
    const maxTokens = options.model?.maxTokens ?? this.defaultModel.maxTokens;

    try {
      const response = await this.client.models.generateContentStream({
        model: modelId,
        contents: options.prompt,
        config: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      for await (const chunk of response) {
        const text = chunk.text ?? "";
        yield { delta: text, done: false };
      }

      // Signal completion
      yield { delta: "", done: true };
    } catch (error) {
      throw classifyError(error, {
        provider: this.name,
        model: modelId,
      });
    }
  }

  getModelCards(): ModelCard[] {
    return GEMINI_MODEL_CARDS;
  }
}
