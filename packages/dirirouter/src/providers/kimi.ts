import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import type { ModelCard } from "../contracts/model-card.js";

const EMPTY_BENCHMARKS: ModelCard["benchmarks"] = {
  quality: { by_complexity_role: {}, by_specialization: {} },
  speed: { tokens_per_second_avg: 0, feedback_count: 0 },
};

const KIMI_MODEL_CARDS: ModelCard[] = [
  {
    model: "kimi-k2.5",
    family: "kimi",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: 262_144,
    },
    reasoning_levels: ["low", "medium", "high"],
    known_for: {
      roles: ["coder", "researcher", "architect"],
      complexities: ["moderate", "complex", "expert"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "kimi-k2-0905-preview",
    family: "kimi",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 262_144,
    },
    reasoning_levels: [],
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["moderate", "complex"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "kimi-k2-thinking",
    family: "kimi-thinking",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 262_144,
    },
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    known_for: {
      roles: ["architect", "reviewer", "coder"],
      complexities: ["complex", "expert"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "kimi-k2-thinking-turbo",
    family: "kimi-thinking",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 262_144,
    },
    reasoning_levels: ["low", "medium", "high"],
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["moderate", "complex"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "kimi-k2-turbo-preview",
    family: "kimi",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 262_144,
    },
    reasoning_levels: [],
    known_for: {
      roles: ["coder"],
      complexities: ["simple", "moderate"],
      specializations: [],
    },
    benchmarks: EMPTY_BENCHMARKS,
    pricing_tier: "budget",
    learned_from: 0,
  },
];
import {
  getKimiApiKey,
  hasKimiAuth,
  setKimiApiKeyInKeychain,
  validateKimiApiKey,
} from "../kimi/auth.js";

const DEFAULT_KIMI_BASE_URL = "https://api.moonshot.ai/v1";

export interface KimiProviderConfig {
  apiKey?: string;
  baseURL?: string;
}

export class KimiProvider implements Provider {
  readonly name = "kimi";

  readonly defaultModel: ModelConfig = {
    modelId: "kimi-k2.5",
    temperature: 0.3,
    maxTokens: 4096,
  };

  #provider: ReturnType<typeof createOpenAICompatible> | null = null;
  #apiKey: string | null = null;
  #baseURL: string;

  constructor(config?: KimiProviderConfig) {
    this.#baseURL = config?.baseURL ?? DEFAULT_KIMI_BASE_URL;

    const configKey = config?.apiKey?.trim();
    if (configKey) {
      this.#apiKey = configKey;
    }
  }

  /**
   * Prompts for API key via interactive login and stores it in keychain.
   *
   * @param apiKey - The API key to store
   * @throws {KimiKeychainError} If the keychain is unavailable
   */
  static login(apiKey: string): void {
    if (!validateKimiApiKey(apiKey)) {
      throw new Error("Invalid Kimi API key format");
    }
    setKimiApiKeyInKeychain(apiKey);
  }

  /**
   * Checks if the provider is available and properly configured.
   *
   * @returns True if API key is available from keychain or environment
   */
  isAvailable(): boolean {
    return hasKimiAuth() || this.#apiKey !== null;
  }

  #ensureInitialized(): void {
    if (this.#provider !== null) return;

    const apiKey = this.#apiKey ?? getKimiApiKey();

    if (!apiKey) {
      throw new Error(
        "KimiProvider requires an API key. " +
          "Set DC_KIMI_API_KEY environment variable or use KimiProvider.login(apiKey).",
      );
    }

    this.#apiKey = apiKey;
    this.#provider = createOpenAICompatible({
      name: "kimi",
      baseURL: this.#baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  getModelCards(): ModelCard[] {
    return KIMI_MODEL_CARDS;
  }

  async generate(options: GenerateOptions): Promise<string> {
    this.#ensureInitialized();

    const modelId = options.model?.modelId ?? this.defaultModel.modelId;

    if (this.#provider === null) {
      throw new Error("KimiProvider not initialized");
    }

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
      throw this.#handleError(error, "generate");
    }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.#ensureInitialized();

    const modelId = options.model?.modelId ?? this.defaultModel.modelId;

    if (this.#provider === null) {
      throw new Error("KimiProvider not initialized");
    }

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
      throw this.#handleError(error, "stream");
    }
  }

  #handleError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      if (
        error.message.toLowerCase().includes("api key") ||
        error.message.toLowerCase().includes("unauthorized") ||
        error.message.toLowerCase().includes("401")
      ) {
        return new Error(
          "Invalid or missing Kimi API key. " +
            "Check your DC_KIMI_API_KEY environment variable or use KimiProvider.login(apiKey).",
        );
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

export function createKimiProvider(config?: KimiProviderConfig): Provider {
  return new KimiProvider(config);
}
