import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { classifyError } from "../error-classifier.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";

/**
 * Permanent fallback list — Kimi is the golden source for model availability.
 * This list is ONLY used when the provider API is unreachable.
 * DO NOT edit this list manually; it is auto-generated from provider API responses.
 * To update: run `pnpm --filter @diricode/dirirouter playground` and capture live availability.
 */
const KIMI_FALLBACK_AVAILABILITIES: ProviderModelAvailability[] = [
  {
    provider: "kimi",
    model_id: "kimi-k2.5",
    family: "kimi-k2",
    stability: "stable",
    available: true,
    context_window: 262_144,
    supports_tool_calling: true,
    supports_vision: true,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "kimi",
    model_id: "kimi-k2-0905-preview",
    family: "kimi-k2",
    stability: "preview",
    available: true,
    context_window: 262_144,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "kimi",
    model_id: "kimi-k2-thinking",
    family: "kimi-k2-thinking",
    stability: "stable",
    available: true,
    context_window: 262_144,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "kimi",
    model_id: "kimi-k2-thinking-turbo",
    family: "kimi-k2-thinking",
    stability: "stable",
    available: true,
    context_window: 262_144,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  },
  {
    provider: "kimi",
    model_id: "kimi-k2-turbo-preview",
    family: "kimi-k2",
    stability: "preview",
    available: true,
    context_window: 262_144,
    supports_tool_calling: true,
    supports_vision: false,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
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

  getModelAvailability(): ProviderModelAvailability[] {
    return KIMI_FALLBACK_AVAILABILITIES;
  }

  async generate(options: GenerateOptions): Promise<string> {
    const modelId = options.model?.modelId ?? this.defaultModel.modelId;

    try {
      this.#ensureInitialized();

      if (this.#provider === null) {
        throw new Error("KimiProvider not initialized");
      }

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
      throw classifyError(error, {
        provider: this.name,
        model: modelId,
      });
    }
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const modelId = options.model?.modelId ?? this.defaultModel.modelId;

    try {
      this.#ensureInitialized();

      if (this.#provider === null) {
        throw new Error("KimiProvider not initialized");
      }

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

export function createKimiProvider(config?: KimiProviderConfig): Provider {
  return new KimiProvider(config);
}
