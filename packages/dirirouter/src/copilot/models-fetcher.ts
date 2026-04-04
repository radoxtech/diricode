import { GITHUB_MODELS } from "./models.js";

export interface CatalogModel {
  id: string;
  name: string;
  registry: string;
  publisher: string;
  capabilities: string[];
  rate_limit_tier: string;
}

interface ApiModelEntry {
  name?: string;
  display_name?: string;
  registry?: string;
  publisher?: string;
  model_capabilities?: string[];
  supported_generation_types?: string[];
  rate_limit_tier?: string;
  task?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache: { models: CatalogModel[]; expiresAt: number } | null = null;

function staticFallback(): CatalogModel[] {
  return Object.entries(GITHUB_MODELS).map(([id, info]) => ({
    id,
    name: id,
    registry: info.modelId.split("/")[0] ?? "",
    publisher: info.provider,
    capabilities: info.supportsStreaming ? ["streaming"] : [],
    rate_limit_tier: "standard",
  }));
}

export async function fetchAvailableModels(token: string): Promise<CatalogModel[]> {
  const now = Date.now();
  if (_cache && now < _cache.expiresAt) {
    return _cache.models;
  }

  try {
    const response = await fetch("https://models.github.ai/catalog/models", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      return staticFallback();
    }

    const data = (await response.json()) as ApiModelEntry[];
    const models: CatalogModel[] = data.map((entry) => ({
      id: entry.name ?? "",
      name: entry.display_name ?? entry.name ?? "",
      registry: entry.registry ?? "",
      publisher: entry.publisher ?? "",
      capabilities: entry.model_capabilities ?? entry.supported_generation_types ?? [],
      rate_limit_tier: entry.rate_limit_tier ?? "standard",
    }));

    _cache = { models, expiresAt: now + CACHE_TTL_MS };
    return models;
  } catch {
    return staticFallback();
  }
}

export function clearModelsCache(): void {
  _cache = null;
}
