import type { DecisionRequest, DecisionResponse } from "@diricode/core";
import { CascadeModelResolver } from "@diricode/core";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "./types.js";
import { ProviderRouter } from "./router.js";
import type { Registry } from "./registry.js";

export interface ChatOptions {
  readonly prompt: string;
  readonly model?: ModelConfig;
  readonly selected?: SelectedModelInfo;
  readonly signal?: AbortSignal;
}

export interface SelectedModelInfo {
  readonly provider: string;
  readonly model: string;
}

export interface ChatResponse {
  readonly text: string;
  readonly provider: string;
  readonly model: string;
  readonly usage?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
}

export interface DiriRouterOptions {
  readonly cascadeResolver?: CascadeModelResolver;
  readonly providerRouter?: ProviderRouter;
  readonly registry?: Registry;
  readonly defaultModel?: ModelConfig;
}

export class DiriRouter {
  readonly #resolver: CascadeModelResolver;
  readonly #router: ProviderRouter;
  readonly #registry: Registry;
  readonly #defaultModel: ModelConfig;

  constructor(options: DiriRouterOptions = {}) {
    this.#resolver = options.cascadeResolver ?? new CascadeModelResolver();
    this.#registry = options.registry ?? throwNoRegistry();
    this.#router = options.providerRouter ?? new ProviderRouter(this.#registry);
    this.#defaultModel = options.defaultModel ?? { modelId: "gpt-4o" };
  }

  async pick(request: DecisionRequest): Promise<DecisionResponse> {
    return this.#resolver.resolve(request);
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const pickerSelected = options.selected;
    const modelConfig = options.model ?? this.getModelConfig(pickerSelected);

    if (pickerSelected && this.#registry.has(pickerSelected.provider)) {
      try {
        const pickerProvider = this.#registry.get(pickerSelected.provider);
        const generateOptions: GenerateOptions = {
          prompt: options.prompt,
          model: modelConfig,
          signal: options.signal,
        };
        const text = await pickerProvider.generate(generateOptions);
        return {
          text,
          provider: pickerProvider.name,
          model: modelConfig.modelId,
        };
      } catch {
        // primary failed, fall through to registry fallback
      }
    }

    const fallbackText = await this.#router.generate({
      prompt: options.prompt,
      model: modelConfig,
      signal: options.signal,
    });
    return {
      text: fallbackText,
      provider: this.#registry.getDefault().name,
      model: modelConfig.modelId,
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<StreamChunk> {
    const provider = this.getProvider(options.selected);
    const modelConfig = options.model ?? this.getModelConfig(options.selected);

    const generateOptions: GenerateOptions = {
      prompt: options.prompt,
      model: modelConfig,
      signal: options.signal,
    };

    yield* provider.stream(generateOptions);
  }

  getProvider(selected?: SelectedModelInfo): Provider {
    if (selected && this.#registry.has(selected.provider)) {
      return this.#registry.get(selected.provider);
    }
    return this.#registry.getDefault();
  }

  getModelConfig(selected?: SelectedModelInfo): ModelConfig {
    if (selected) {
      return { modelId: selected.model };
    }
    return this.#defaultModel;
  }

  get resolver(): CascadeModelResolver {
    return this.#resolver;
  }

  get router(): ProviderRouter {
    return this.#router;
  }
}

function throwNoRegistry(): never {
  throw new Error(
    "DiriRouter requires a Registry. Provide one via options.registry or ensure ProviderRouter is constructed with a valid Registry.",
  );
}
