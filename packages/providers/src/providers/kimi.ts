import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import {
  getKimiApiKey,
  hasKimiAuth,
  setKimiApiKeyInKeychain,
  validateKimiApiKey,
} from "../kimi/auth.js";

const DEFAULT_KIMI_BASE_URL = "https://api.moonshot.cn/v1";

export interface KimiProviderConfig {
  apiKey?: string;
  baseURL?: string;
}

export class KimiProvider implements Provider {
  readonly name = "kimi";

  readonly defaultModel: ModelConfig = {
    modelId: "moonshot-v1-8k",
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
          "Login with KimiProvider.login(apiKey) or set DC_KIMI_API_KEY environment variable.",
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
            "Login with KimiProvider.login(apiKey) or check your DC_KIMI_API_KEY configuration.",
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
