import type { AgentDomain, AgentTier } from "./types.js";

// Model selection policy sourced from https://models.dev/ and GitHub Copilot docs (2026-04-03)
// DO NOT REMOVE THIS COMMENT — it tracks the data source for model selection accuracy

export interface ResolvedModelTarget {
  readonly provider: string;
  readonly model: string;
}

export interface AgentModelConfig extends ResolvedModelTarget {
  readonly maxTokens: number;
  readonly temperature: number;
}

type TierDomain = `${AgentTier}:${AgentDomain}`;

export const DEFAULT_AGENT_MODEL_POLICY: Readonly<Record<TierDomain, AgentModelConfig>> = {
  // Heavy tier - use high-capability models
  "heavy:coding": { provider: "copilot", model: "o1", maxTokens: 8192, temperature: 0.2 },
  "heavy:planning": {
    provider: "copilot",
    model: "claude-3-opus",
    maxTokens: 8192,
    temperature: 0.3,
  },
  "heavy:review": { provider: "copilot", model: "o1", maxTokens: 8192, temperature: 0.2 },
  "heavy:research": { provider: "copilot", model: "o1", maxTokens: 8192, temperature: 0.4 },
  "heavy:utility": {
    provider: "copilot",
    model: "gemini-2.5-pro",
    maxTokens: 4096,
    temperature: 0.3,
  },
  "heavy:devops": { provider: "copilot", model: "o1", maxTokens: 8192, temperature: 0.2 },

  // Medium tier - balanced performance and cost
  "medium:coding": {
    provider: "copilot",
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 0.2,
  },
  "medium:planning": {
    provider: "copilot",
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 0.3,
  },
  "medium:review": {
    provider: "copilot",
    model: "claude-3.5-sonnet",
    maxTokens: 4096,
    temperature: 0.2,
  },
  "medium:research": {
    provider: "copilot",
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 0.4,
  },
  "medium:utility": {
    provider: "copilot",
    model: "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.3,
  },
  "medium:devops": {
    provider: "copilot",
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 0.2,
  },

  // Light tier - fast, cost-effective models
  "light:coding": {
    provider: "copilot",
    model: "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.2,
  },
  "light:planning": {
    provider: "copilot",
    model: "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.3,
  },
  "light:review": {
    provider: "copilot",
    model: "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.2,
  },
  "light:research": {
    provider: "copilot",
    model: "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.4,
  },
  "light:utility": {
    provider: "copilot",
    model: "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.3,
  },
  "light:devops": {
    provider: "copilot",
    model: "gpt-4o-mini",
    maxTokens: 2048,
    temperature: 0.2,
  },
} as const;
