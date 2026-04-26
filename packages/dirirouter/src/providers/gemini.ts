import { GoogleGenAI } from "@google/genai";
import { classifyError } from "../error-classifier.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../types.js";
import type { ProviderDiscoveryResult } from "../provider-discovery.js";
import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";

const GEMINI_FALLBACK_AVAILABILITIES: ProviderModelAvailability[] = [
  {
    provider: "gemini",
    model_id: "gemini-2.5-flash",
    family: "gemini-flash",
    stability: "stable",
    available: true,
    context_window: 1_048_576,
    supports_tool_calling: true,
    supports_vision: true,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    pricing_tier: "budget",
    trusted: true,
  },
  {
    provider: "gemini",
    model_id: "gemini-2.5-flash-lite",
    family: "gemini-flash-lite",
    stability: "stable",
    available: true,
    context_window: 1_048_576,
    supports_tool_calling: true,
    supports_vision: true,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    pricing_tier: "budget",
    trusted: true,
  },
  {
    provider: "gemini",
    model_id: "gemini-2.5-pro",
    family: "gemini-pro",
    stability: "stable",
    available: true,
    context_window: 1_048_576,
    supports_tool_calling: true,
    supports_vision: true,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    pricing_tier: "standard",
    trusted: true,
  },
];

export interface GeminiProviderConfig {
  apiKey: string;
}

export class GeminiProvider implements Provider {
  readonly name = "gemini";

  readonly defaultModel: ModelConfig = {
    modelId: "gemini-2.5-flash",
    temperature: 0.2,
    maxTokens: 4096,
  };

  private client: GoogleGenAI;

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

  isAvailable(): boolean {
    return !!this.client;
  }

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

      yield { delta: "", done: true };
    } catch (error) {
      throw classifyError(error, {
        provider: this.name,
        model: modelId,
      });
    }
  }

  getModelAvailability(): ProviderModelAvailability[] {
    return GEMINI_FALLBACK_AVAILABILITIES;
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
        envVar: "GEMINI_API_KEY",
        modelCount: availabilities.length,
        modelNames: availabilities.map((a) => a.model_id),
      },
    };
  }
}
