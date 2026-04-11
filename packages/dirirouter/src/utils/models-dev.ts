export interface ModelsDevCost {
  readonly input: number;
  readonly output: number;
  readonly cache_read?: number;
  readonly cache_write?: number;
  readonly input_audio?: number;
  readonly output_audio?: number;
  readonly context_over_200k?: {
    readonly input: number;
    readonly output: number;
    readonly cache_read?: number;
  };
}

export interface ModelsDevLimit {
  readonly context: number;
  readonly output: number;
}

export interface ModelsDevModalities {
  readonly input: readonly string[];
  readonly output: readonly string[];
}

export interface ModelsDevInterleaved {
  readonly field: string;
}

export interface ModelsDevModel {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly attachment: boolean;
  readonly reasoning: boolean;
  readonly tool_call: boolean;
  readonly structured_output?: boolean;
  readonly temperature: boolean;
  readonly knowledge?: string;
  readonly release_date?: string;
  readonly last_updated?: string;
  readonly modalities?: ModelsDevModalities;
  readonly open_weights: boolean;
  readonly cost?: ModelsDevCost;
  readonly limit: ModelsDevLimit;
  readonly interleaved?: ModelsDevInterleaved;
  readonly experimental?: boolean;
  readonly status?: string;
  readonly provider?: string;
}

export interface ModelsDevProvider {
  readonly id: string;
  readonly name: string;
  readonly env?: readonly string[];
  readonly npm?: string;
  readonly api?: string;
  readonly doc?: string;
  readonly models: Record<string, ModelsDevModel>;
}

export type ModelsDevApiResponse = Record<string, ModelsDevProvider>;

export interface ModelsDevQuery {
  reasoning?: boolean;
  toolCall?: boolean;
  vision?: boolean;
  structuredOutput?: boolean;
  minContext?: number;
  maxContext?: number;
  family?: string;
  providerId?: string;
  openWeights?: boolean;
}

export interface CatalogModel {
  readonly providerId: string;
  readonly providerName: string;
  readonly model: ModelsDevModel;
}

const API_URL = "https://models.dev/api.json";
const DEFAULT_TIMEOUT_MS = 15_000;

export class ModelsCatalog {
  readonly #data: ModelsDevApiResponse;
  readonly #providerIndex: ReadonlyMap<string, ModelsDevProvider>;
  readonly #familyIndex: ReadonlyMap<string, CatalogModel[]>;
  readonly #modelIndex: ReadonlyMap<string, CatalogModel[]>;

  private constructor(data: ModelsDevApiResponse) {
    this.#data = data;

    const providerMap = new Map<string, ModelsDevProvider>();
    const familyMap = new Map<string, CatalogModel[]>();
    const modelMap = new Map<string, CatalogModel[]>();

    for (const [providerId, provider] of Object.entries(data)) {
      if (!provider || typeof provider !== "object" || !provider.models) continue;

      providerMap.set(providerId, provider);

      for (const model of Object.values(provider.models)) {
        if (!model || typeof model !== "object" || !model.id) continue;

        const entry: CatalogModel = {
          providerId,
          providerName: provider.name ?? providerId,
          model,
        };

        const familyKey = model.family ?? model.id;
        const familyList = familyMap.get(familyKey);
        if (familyList) {
          familyList.push(entry);
        } else {
          familyMap.set(familyKey, [entry]);
        }

        const modelList = modelMap.get(model.id);
        if (modelList) {
          modelList.push(entry);
        } else {
          modelMap.set(model.id, [entry]);
        }
      }
    }

    this.#providerIndex = providerMap;
    this.#familyIndex = familyMap;
    this.#modelIndex = modelMap;
  }

  static async fetch(options?: {
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<ModelsCatalog> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const signals = [controller.signal];
    if (options?.signal) signals.push(options.signal);

    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(API_URL, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new ModelsDevFetchError(
          `models.dev returned HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const json = (await response.json()) as ModelsDevApiResponse;
      return new ModelsCatalog(json);
    } catch (error) {
      if (error instanceof ModelsDevFetchError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ModelsDevFetchError(`models.dev request timed out after ${timeoutMs}ms`);
      }
      throw new ModelsDevFetchError(
        `Failed to fetch models.dev: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  static fromJSON(data: ModelsDevApiResponse): ModelsCatalog {
    return new ModelsCatalog(data);
  }

  provider(id: string): ModelsDevProvider | undefined {
    return this.#providerIndex.get(id);
  }

  providerIds(): string[] {
    return [...this.#providerIndex.keys()];
  }

  providers(): ModelsDevProvider[] {
    return [...this.#providerIndex.values()];
  }

  model(providerId: string, modelId: string): CatalogModel | undefined {
    const entries = this.#modelIndex.get(modelId);
    return entries?.find((e) => e.providerId === providerId);
  }

  modelAcrossProviders(modelId: string): CatalogModel[] {
    return this.#modelIndex.get(modelId) ?? [];
  }

  byFamily(family: string): CatalogModel[] {
    return this.#familyIndex.get(family) ?? [];
  }

  families(): string[] {
    return [...this.#familyIndex.keys()];
  }

  modelsByProvider(providerId: string): CatalogModel[] {
    const provider = this.#providerIndex.get(providerId);
    if (!provider) return [];

    return Object.values(provider.models).map((m) => ({
      providerId,
      providerName: provider.name ?? providerId,
      model: m,
    }));
  }

  query(filter: ModelsDevQuery): CatalogModel[] {
    const results: CatalogModel[] = [];

    for (const [providerId, provider] of this.#providerIndex) {
      if (filter.providerId && providerId !== filter.providerId) continue;

      for (const model of Object.values(provider.models)) {
        if (!matchesFilter(model, filter)) continue;

        results.push({
          providerId,
          providerName: provider.name ?? providerId,
          model,
        });
      }
    }

    return results;
  }

  get raw(): ModelsDevApiResponse {
    return this.#data;
  }
}

export class ModelsDevFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelsDevFetchError";
  }
}

function matchesFilter(model: ModelsDevModel, filter: ModelsDevQuery): boolean {
  if (filter.reasoning !== undefined && model.reasoning !== filter.reasoning) return false;
  if (filter.toolCall !== undefined && model.tool_call !== filter.toolCall) return false;
  if (filter.vision !== undefined && model.attachment !== filter.vision) return false;
  if (filter.structuredOutput !== undefined && model.structured_output !== filter.structuredOutput)
    return false;
  if (filter.openWeights !== undefined && model.open_weights !== filter.openWeights) return false;
  if (filter.family !== undefined && model.family !== filter.family) return false;

  if (filter.minContext !== undefined && model.limit.context < filter.minContext) return false;
  if (filter.maxContext !== undefined && model.limit.context > filter.maxContext) return false;

  return true;
}
