import type { DecisionRequest, DecisionResponse } from "@diricode/dirirouter";
import { CascadeModelResolver } from "@diricode/dirirouter";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "./types.js";
import { ProviderRouter } from "./router.js";
import type { Registry } from "./registry.js";
import type {
  ABExperimentManager,
  ABEvaluationResult,
  TaskDescriptor,
} from "./ab/ABExperimentManager.js";

export interface ExperimentLogger {
  log(chatId: string, result: ABEvaluationResult): void;
}

export interface ChatOptions {
  readonly prompt: string;
  readonly request?: DecisionRequest;
  readonly model?: ModelConfig;
  readonly selected?: SelectedModelInfo;
  readonly signal?: AbortSignal;
  readonly chatId?: string;
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
  readonly abExperimentManager?: ABExperimentManager;
  readonly experimentLogger?: ExperimentLogger;
}

export class DiriRouter {
  readonly #resolver: CascadeModelResolver;
  readonly #router: ProviderRouter;
  readonly #registry: Registry;
  readonly #defaultModel: ModelConfig;
  readonly #abExperimentManager?: ABExperimentManager;
  readonly #experimentLogger?: ExperimentLogger;

  constructor(options: DiriRouterOptions = {}) {
    this.#resolver = options.cascadeResolver ?? new CascadeModelResolver();
    this.#registry = options.registry ?? throwNoRegistry();
    this.#router = options.providerRouter ?? new ProviderRouter(this.#registry);
    this.#defaultModel = options.defaultModel ?? { modelId: "gpt-4o" };
    this.#abExperimentManager = options.abExperimentManager;
    this.#experimentLogger = options.experimentLogger;
  }

  async pick(request: DecisionRequest, chatId?: string): Promise<DecisionResponse> {
    const taskDescriptor: TaskDescriptor = {
      id: request.requestId,
      type: request.task.type,
    };

    let experimentResult: ABEvaluationResult | undefined;
    if (this.#abExperimentManager) {
      experimentResult = await this.#abExperimentManager.evaluate(taskDescriptor);
      if (this.#experimentLogger && chatId) {
        this.#experimentLogger.log(chatId, experimentResult);
      }
      if (experimentResult.kind === "branch") {
        const variant = this.selectVariant(experimentResult);
        const modifiedRequest = this.applyVariant(request, variant);
        return this.#resolver.resolve(modifiedRequest);
      }
    }
    return this.#resolver.resolve(request);
  }

  private selectVariant(_result: {
    kind: "branch";
    experimentId: string;
    variantA: { label: string; taskId: string };
    variantB: { label: string; taskId: string };
  }): "A" | "B" {
    return Math.random() < 0.5 ? "A" : "B";
  }

  private applyVariant(request: DecisionRequest, _variant: "A" | "B"): DecisionRequest {
    return request;
  }

  private async resolveSelectedModel(options: ChatOptions): Promise<SelectedModelInfo | undefined> {
    if (options.selected) {
      return options.selected;
    }

    if (!options.request) {
      return undefined;
    }

    const decision = await this.pick(options.request, options.chatId);
    if (decision.status !== "resolved" || !decision.selected) {
      return undefined;
    }

    return {
      provider: decision.selected.provider,
      model: decision.selected.model,
    };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const pickerSelected = await this.resolveSelectedModel(options);
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
    // In actual production implementation we would pass `failedModels` to #resolver.resolve
    // when requesting a new fallback candidate. For now DiriRouter uses ProviderRouter as a fallback.
    return {
      text: fallbackText,
      provider: this.#registry.getDefault().name,
      model: modelConfig.modelId,
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<StreamChunk> {
    const selected = await this.resolveSelectedModel(options);
    const provider = this.getProvider(selected);
    const modelConfig = options.model ?? this.getModelConfig(selected);

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
