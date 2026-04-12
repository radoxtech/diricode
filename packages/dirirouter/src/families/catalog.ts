import type { ModelFamily, ModelStability } from "./types.js";
import { normalizeModelFamily } from "./normalization.js";

export interface FamilyMetadata {
  family: ModelFamily;
  stability: ModelStability;
  reasoning_levels: readonly ("low" | "medium" | "high" | "xhigh")[];
  default_attributes: readonly string[];
}

const FAMILY_METADATA: Record<ModelFamily, FamilyMetadata> = {
  "claude-opus": {
    family: "claude-opus",
    stability: "stable",
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    default_attributes: ["reasoning", "quality", "agentic"],
  },
  "claude-sonnet": {
    family: "claude-sonnet",
    stability: "stable",
    reasoning_levels: ["low", "medium", "high"],
    default_attributes: ["agentic", "quality", "ui-ux"],
  },
  "claude-haiku": {
    family: "claude-haiku",
    stability: "stable",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gemini-pro": {
    family: "gemini-pro",
    stability: "stable",
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    default_attributes: ["reasoning", "bulk", "quality"],
  },
  "gemini-flash": {
    family: "gemini-flash",
    stability: "stable",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gemini-flash-lite": {
    family: "gemini-flash-lite",
    stability: "stable",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gpt-reasoning": {
    family: "gpt-reasoning",
    stability: "stable",
    reasoning_levels: ["low", "medium", "high", "xhigh"],
    default_attributes: ["reasoning", "quality"],
  },
  "gpt-standard": {
    family: "gpt-standard",
    stability: "stable",
    reasoning_levels: ["low", "medium", "high"],
    default_attributes: ["quality", "agentic"],
  },
  "gpt-mini": {
    family: "gpt-mini",
    stability: "stable",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
  "gpt-nano": {
    family: "gpt-nano",
    stability: "stable",
    reasoning_levels: ["low", "medium"],
    default_attributes: ["speed", "bulk"],
  },
};

export function resolveFamilyMetadata(
  modelId: string,
  explicitFamily?: ModelFamily,
  explicitStability?: ModelStability,
): FamilyMetadata {
  const { family, stability } = normalizeModelFamily(modelId);
  const resolvedFamily = explicitFamily ?? family;
  const resolvedStability = explicitStability ?? stability;
  const base = FAMILY_METADATA[resolvedFamily];
  return {
    ...base,
    family: resolvedFamily,
    stability: resolvedStability,
  };
}

export function listCanonicalFamilies(): ModelFamily[] {
  return Object.keys(FAMILY_METADATA) as ModelFamily[];
}
