import type { AgentCategory, AgentMetadata, AgentTier } from "./types.js";

export interface ModelConfig {
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
}

export interface ModelConfigResolver {
  resolve(agent: AgentMetadata): ModelConfig;
}

type TierCategory = `${AgentTier}:${AgentCategory}`;

const TIER_CATEGORY_MAP: ReadonlyMap<TierCategory, ModelConfig> = new Map([
  ["heavy:code", { model: "opus-4", maxTokens: 8192, temperature: 0.2 }],
  ["heavy:strategy", { model: "opus-4", maxTokens: 8192, temperature: 0.3 }],
  ["medium:research", { model: "sonnet-4", maxTokens: 4096, temperature: 0.4 }],
  ["medium:code", { model: "sonnet-4", maxTokens: 4096, temperature: 0.2 }],
  ["light:utility", { model: "haiku-4", maxTokens: 2048, temperature: 0.3 }],
]);

const TIER_DEFAULT_MAP: ReadonlyMap<AgentTier, ModelConfig> = new Map([
  ["heavy", { model: "opus-4", maxTokens: 8192, temperature: 0.3 }],
  ["medium", { model: "sonnet-4", maxTokens: 4096, temperature: 0.3 }],
  ["light", { model: "haiku-4", maxTokens: 2048, temperature: 0.3 }],
]);

const GLOBAL_FALLBACK: ModelConfig = {
  model: "sonnet-4",
  maxTokens: 4096,
  temperature: 0.3,
};

export class DefaultModelTierResolver implements ModelConfigResolver {
  resolve(agent: AgentMetadata): ModelConfig {
    const key: TierCategory = `${agent.tier}:${agent.category}`;

    const exact = TIER_CATEGORY_MAP.get(key);
    if (exact !== undefined) {
      return exact;
    }

    return TIER_DEFAULT_MAP.get(agent.tier) ?? GLOBAL_FALLBACK;
  }
}

export const DEFAULT_MODEL_CONFIG_RESOLVER: ModelConfigResolver = new DefaultModelTierResolver();
