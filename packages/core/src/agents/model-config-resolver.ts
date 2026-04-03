import type { AgentDomain, AgentMetadata, AgentTier } from "./types.js";
import { DEFAULT_AGENT_MODEL_POLICY } from "./model-selection-policy.js";
import type { AgentModelConfig } from "./model-selection-policy.js";

export interface ModelConfig {
  readonly provider: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly temperature: number;
}

export interface ModelConfigResolver {
  resolve(agent: AgentMetadata, requestedTier?: AgentTier): ModelConfig;
}

type TierDomain = `${AgentTier}:${AgentDomain}`;

const TIER_PRIORITY: readonly AgentTier[] = ["light", "medium", "heavy"];

function resolveEffectiveTier(
  allowedTiers: readonly AgentTier[],
  requestedTier?: AgentTier,
): AgentTier {
  if (requestedTier !== undefined && allowedTiers.includes(requestedTier)) {
    return requestedTier;
  }

  const sortedAllowed = [...allowedTiers].sort(
    (left, right) => TIER_PRIORITY.indexOf(right) - TIER_PRIORITY.indexOf(left),
  );

  return sortedAllowed[0] ?? "medium";
}

function policyEntryToConfig(entry: AgentModelConfig): ModelConfig {
  return {
    provider: entry.provider,
    model: entry.model,
    maxTokens: entry.maxTokens,
    temperature: entry.temperature,
  };
}

export class DefaultModelTierResolver implements ModelConfigResolver {
  resolve(agent: AgentMetadata, requestedTier?: AgentTier): ModelConfig {
    const tier = resolveEffectiveTier(agent.allowedTiers, requestedTier);
    const key: TierDomain = `${tier}:${agent.capabilities.primary}`;

    return policyEntryToConfig(DEFAULT_AGENT_MODEL_POLICY[key]);
  }
}

export const DEFAULT_MODEL_CONFIG_RESOLVER: ModelConfigResolver = new DefaultModelTierResolver();
