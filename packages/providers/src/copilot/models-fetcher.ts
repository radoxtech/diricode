import { GITHUB_MODELS, type GithubModelInfo } from "./models.js";

export interface FetchedModel {
  id: string;
  provider: string;
  modelId: string;
  supportsStreaming: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  models: FetchedModel[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function fromStaticModels(): FetchedModel[] {
  return Object.entries(GITHUB_MODELS).map(([id, info]: [string, GithubModelInfo]) => ({
    id,
    provider: info.provider,
    modelId: info.modelId,
    supportsStreaming: info.supportsStreaming,
  }));
}

interface ApiModelEntry {
  name?: string;
  id?: string;
  publisher?: string;
  summary?: string;
  [key: string]: unknown;
}

function parseApiResponse(data: unknown): FetchedModel[] {
  if (!Array.isArray(data)) return fromStaticModels();

  const results: FetchedModel[] = [];
  for (const item of data as ApiModelEntry[]) {
    const id = item["name"] ?? item["id"];
    if (typeof id !== "string" || !id) continue;

    const static_ = GITHUB_MODELS[id];
    results.push({
      id,
      provider:
        typeof item["publisher"] === "string"
          ? item["publisher"]
          : (static_?.provider ?? "unknown"),
      modelId: static_?.modelId ?? id,
      supportsStreaming: static_?.supportsStreaming ?? true,
    });
  }
  return results.length > 0 ? results : fromStaticModels();
}

export async function fetchAvailableModels(token: string): Promise<FetchedModel[]> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.models;
  }

  try {
    const response = await fetch("https://models.github.ai/catalog/models", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return fromStaticModels();
    }

    const data: unknown = await response.json();
    const models = parseApiResponse(data);

    cache = { models, fetchedAt: now };
    return models;
  } catch {
    return fromStaticModels();
  }
}

export function clearModelsCache(): void {
  cache = null;
}
