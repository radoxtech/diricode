import type { DecisionRequest, DecisionResponse } from "@diricode/dirirouter";
import { CascadeModelResolver } from "@diricode/dirirouter";
import { classifyError } from "./error-classifier.js";
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
    const resolvedRequest = await this.resolveDecisionRequest(request, chatId);
    return this.#resolver.resolve(resolvedRequest);
  }

  private async resolveDecisionRequest(
    request: DecisionRequest,
    chatId?: string,
  ): Promise<DecisionRequest> {
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
        return this.applyVariant(request, this.selectVariant(experimentResult));
      }
    }

    return request;
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

  private async resolveSelectedModel(
    options: ChatOptions,
    failedModels: readonly string[] = [],
  ): Promise<SelectedModelInfo | undefined> {
    if (failedModels.length === 0 && options.selected) {
      return options.selected;
    }

    if (!options.request) {
      return undefined;
    }

    const decision = await this.pick(
      this.withFailedModels(options.request, failedModels),
      options.chatId,
    );
    if (decision.status !== "resolved" || !decision.selected) {
      return undefined;
    }

    return {
      provider: decision.selected.provider,
      model: decision.selected.model,
    };
  }

  private withFailedModels(
    request: DecisionRequest,
    failedModels: readonly string[],
  ): DecisionRequest {
    if (failedModels.length === 0) {
      return request;
    }

    return {
      ...request,
      failedModels: [...new Set([...(request.failedModels ?? []), ...failedModels])],
    };
  }

  private createGenerateOptions(options: ChatOptions, model: ModelConfig): GenerateOptions {
    return {
      prompt: options.prompt,
      model,
      signal: options.signal,
    };
  }

  private shouldRepickAfterError(
    error: unknown,
    provider: Provider,
    model: ModelConfig,
    options: ChatOptions,
  ): boolean {
    if (options.request === undefined || options.model !== undefined) {
      return false;
    }

    const explicitRetryable = getRetryableFlag(error);
    if (explicitRetryable !== undefined) {
      return explicitRetryable;
    }

    return classifyError(error, { provider: provider.name, model: model.modelId }).retryable;
  }

  private getSelectionKey(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const attemptedSelections = new Set<string>();
    const failedModels: string[] = [];
    let pickerSelected = await this.resolveSelectedModel(options);

    while (pickerSelected && this.#registry.has(pickerSelected.provider)) {
      const pickerProvider = this.#registry.get(pickerSelected.provider);
      const modelConfig = options.model ?? this.getModelConfig(pickerSelected);
      const selectionKey = this.getSelectionKey(pickerSelected.provider, modelConfig.modelId);

      if (attemptedSelections.has(selectionKey)) {
        break;
      }

      attemptedSelections.add(selectionKey);

      try {
        const generateOptions = this.createGenerateOptions(options, modelConfig);
        const text = await pickerProvider.generate(generateOptions);
        return {
          text,
          provider: pickerProvider.name,
          model: modelConfig.modelId,
        };
      } catch (error) {
        if (this.shouldRepickAfterError(error, pickerProvider, modelConfig, options)) {
          failedModels.push(modelConfig.modelId);
          const repicked = await this.resolveSelectedModel(options, failedModels);
          if (
            repicked &&
            !attemptedSelections.has(
              this.getSelectionKey(repicked.provider, options.model?.modelId ?? repicked.model),
            )
          ) {
            pickerSelected = repicked;
            continue;
          }
        }

        break;
      }
    }

    const modelConfig = options.model ?? this.getModelConfig(pickerSelected);

    const fallbackText = await this.#router.generate(
      this.createGenerateOptions(options, modelConfig),
    );
    // In actual production implementation we would pass `failedModels` to #resolver.resolve
    // when requesting a new fallback candidate. For now DiriRouter uses ProviderRouter as a fallback.
    return {
      text: fallbackText,
      provider: this.#registry.getDefault().name,
      model: modelConfig.modelId,
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<StreamChunk> {
    const attemptedSelections = new Set<string>();
    const failedModels: string[] = [];
    let selected = await this.resolveSelectedModel(options);

    while (selected && this.#registry.has(selected.provider)) {
      const provider = this.#registry.get(selected.provider);
      const modelConfig = options.model ?? this.getModelConfig(selected);
      const selectionKey = this.getSelectionKey(selected.provider, modelConfig.modelId);

      if (attemptedSelections.has(selectionKey)) {
        break;
      }

      attemptedSelections.add(selectionKey);

      let emittedChunk = false;

      try {
        for await (const chunk of provider.stream(
          this.createGenerateOptions(options, modelConfig),
        )) {
          emittedChunk = true;
          yield chunk;
        }
        return;
      } catch (error) {
        if (emittedChunk) {
          throw error;
        }

        if (this.shouldRepickAfterError(error, provider, modelConfig, options)) {
          failedModels.push(modelConfig.modelId);
          const repicked = await this.resolveSelectedModel(options, failedModels);
          if (
            repicked &&
            !attemptedSelections.has(
              this.getSelectionKey(repicked.provider, options.model?.modelId ?? repicked.model),
            )
          ) {
            selected = repicked;
            continue;
          }
        }

        break;
      }
    }

    const modelConfig = options.model ?? this.getModelConfig(selected);
    yield* this.#router.stream(this.createGenerateOptions(options, modelConfig));
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

function getRetryableFlag(error: unknown): boolean | undefined {
  if (error === null || error === undefined || typeof error !== "object") {
    return undefined;
  }

  const retryable = (error as { retryable?: unknown }).retryable;
  return typeof retryable === "boolean" ? retryable : undefined;
}
