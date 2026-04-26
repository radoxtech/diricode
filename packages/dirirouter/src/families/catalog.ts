import type { ModelFamily, ModelStability } from "./types.js";
import type { PricingTier } from "../contracts/model-card.js";
import { normalizeModelFamily } from "./normalization.js";

export interface FamilyMetadata {
  family: ModelFamily;
  stability: ModelStability;
  pricing_tier: PricingTier;
  reasoning_levels: readonly ("low" | "medium" | "high" | "xhigh")[];
  default_attributes: readonly string[];
}

const FAMILY_METADATA: Record<ModelFamily, FamilyMetadata> = {
  "claude-opus": {
    family: "claude-opus",
    stability: "stable",
    pricing_tier: "premium",
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    default_attributes: ["reasoning", "quality", "agentic"],
  },
  "claude-sonnet": {
    family: "claude-sonnet",
    stability: "stable",
    pricing_tier: "standard",
    reasoning_levels: ["low", "medium", "high"],
    default_attributes: ["agentic", "quality", "ui-ux"],
  },
  "claude-haiku": {
    family: "claude-haiku",
    stability: "stable",
    pricing_tier: "budget",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gemini-pro": {
    family: "gemini-pro",
    stability: "stable",
    pricing_tier: "standard",
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    default_attributes: ["reasoning", "bulk", "quality"],
  },
  "gemini-flash": {
    family: "gemini-flash",
    stability: "stable",
    pricing_tier: "budget",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gemini-flash-lite": {
    family: "gemini-flash-lite",
    stability: "stable",
    pricing_tier: "budget",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gpt-reasoning": {
    family: "gpt-reasoning",
    stability: "stable",
    pricing_tier: "premium",
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    default_attributes: ["reasoning", "quality"],
  },
  "gpt-standard": {
    family: "gpt-standard",
    stability: "stable",
    pricing_tier: "standard",
    reasoning_levels: ["low", "medium", "high"],
    default_attributes: ["quality", "agentic"],
  },
  "gpt-mini": {
    family: "gpt-mini",
    stability: "stable",
    pricing_tier: "budget",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gpt-nano": {
    family: "gpt-nano",
    stability: "stable",
    pricing_tier: "budget",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
};

export function resolveFamilyMetadata(
  modelId: string,
  explicitFamily?: ModelFamily,
  explicitStability?: ModelStability,
): FamilyMetadata | undefined {
  const { canonicalFamily, stability } = normalizeModelFamily(modelId);
  const resolvedFamily = explicitFamily ?? canonicalFamily;
  if (resolvedFamily === undefined) {
    return undefined;
  }
  const resolvedStability = explicitStability ?? stability;
  const base = (FAMILY_METADATA as Record<string, FamilyMetadata>)[resolvedFamily];
  if (base === undefined) {
    return undefined;
  }
  return {
    ...base,
    family: resolvedFamily,
    stability: resolvedStability,
  };
}

export function listCanonicalFamilies(): ModelFamily[] {
  return Object.keys(FAMILY_METADATA) as ModelFamily[];
}
