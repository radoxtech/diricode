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
  // Heavy tier
  "heavy:coding": { provider: "copilot", model: "gpt-5.4", maxTokens: 8192, temperature: 0.2 },
  "heavy:planning": {
    provider: "copilot",
    model: "claude-opus-4.6",
    maxTokens: 8192,
    temperature: 0.3,
  },
  "heavy:review": { provider: "copilot", model: "gpt-5.4", maxTokens: 8192, temperature: 0.2 },
  "heavy:research": { provider: "copilot", model: "gpt-5.4", maxTokens: 8192, temperature: 0.4 },
  "heavy:utility": {
    provider: "copilot",
    model: "gemini-3.1-pro",
    maxTokens: 4096,
    temperature: 0.3,
  },
  "heavy:devops": { provider: "copilot", model: "gpt-5.4", maxTokens: 8192, temperature: 0.2 },

  // Medium tier
  "medium:coding": {
    provider: "copilot",
    model: "gpt-5.4-mini",
    maxTokens: 4096,
    temperature: 0.2,
  },
  "medium:planning": {
    provider: "copilot",
    model: "gpt-5.4-mini",
    maxTokens: 4096,
    temperature: 0.3,
  },
  "medium:review": {
    provider: "copilot",
    model: "claude-sonnet-4.6",
    maxTokens: 4096,
    temperature: 0.2,
  },
  "medium:research": {
    provider: "copilot",
    model: "gpt-5.4-mini",
    maxTokens: 4096,
    temperature: 0.4,
  },
  "medium:utility": {
    provider: "copilot",
    model: "claude-haiku-4.5",
    maxTokens: 2048,
    temperature: 0.3,
  },
  "medium:devops": {
    provider: "copilot",
    model: "gpt-5.4-mini",
    maxTokens: 4096,
    temperature: 0.2,
  },

  // Light tier
  "light:coding": {
    provider: "copilot",
    model: "claude-haiku-4.5",
    maxTokens: 2048,
    temperature: 0.2,
  },
  "light:planning": {
    provider: "copilot",
    model: "claude-haiku-4.5",
    maxTokens: 2048,
    temperature: 0.3,
  },
  "light:review": {
    provider: "copilot",
    model: "claude-haiku-4.5",
    maxTokens: 2048,
    temperature: 0.2,
  },
  "light:research": {
    provider: "copilot",
    model: "claude-haiku-4.5",
    maxTokens: 2048,
    temperature: 0.4,
  },
  "light:utility": {
    provider: "copilot",
    model: "claude-haiku-4.5",
    maxTokens: 2048,
    temperature: 0.3,
  },
  "light:devops": {
    provider: "copilot",
    model: "claude-haiku-4.5",
    maxTokens: 2048,
    temperature: 0.2,
  },
} as const;
