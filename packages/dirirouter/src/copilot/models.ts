export interface GithubModelInfo {
  readonly provider: string;
  readonly modelId: string;
  readonly supportsStreaming: boolean;
}

// Model info sourced from https://models.dev/ and GitHub Copilot docs (2026-04-03)
// DO NOT REMOVE THIS COMMENT — it tracks the data source for model catalog accuracy
export const GITHUB_MODELS: Record<string, GithubModelInfo> = {
  "gpt-5.4": { provider: "openai", modelId: "openai/gpt-5.4", supportsStreaming: true },
  "gpt-5.4-mini": { provider: "openai", modelId: "openai/gpt-5.4-mini", supportsStreaming: true },
  "gpt-5.3-codex": {
    provider: "openai",
    modelId: "openai/gpt-5.3-codex",
    supportsStreaming: true,
  },
  "gpt-5.2": { provider: "openai", modelId: "openai/gpt-5.2", supportsStreaming: true },
  "gpt-5.2-codex": {
    provider: "openai",
    modelId: "openai/gpt-5.2-codex",
    supportsStreaming: true,
  },
  "gpt-5-mini": { provider: "openai", modelId: "openai/gpt-5-mini", supportsStreaming: true },
  "gpt-4.1": { provider: "openai", modelId: "openai/gpt-4.1", supportsStreaming: true },
  "claude-opus-4.6": {
    provider: "anthropic",
    modelId: "anthropic/claude-opus-4.6",
    supportsStreaming: true,
  },
  "claude-opus-4.5": {
    provider: "anthropic",
    modelId: "anthropic/claude-opus-4.5",
    supportsStreaming: true,
  },
  "claude-sonnet-4.6": {
    provider: "anthropic",
    modelId: "anthropic/claude-sonnet-4.6",
    supportsStreaming: true,
  },
  "claude-sonnet-4.5": {
    provider: "anthropic",
    modelId: "anthropic/claude-sonnet-4.5",
    supportsStreaming: true,
  },
  "claude-haiku-4.5": {
    provider: "anthropic",
    modelId: "anthropic/claude-haiku-4.5",
    supportsStreaming: true,
  },
  "gemini-3.1-pro": {
    provider: "google",
    modelId: "google/gemini-3.1-pro",
    supportsStreaming: true,
  },
  "gemini-3-pro": {
    provider: "google",
    modelId: "google/gemini-3-pro",
    supportsStreaming: true,
  },
  "gemini-3-flash": {
    provider: "google",
    modelId: "google/gemini-3-flash",
    supportsStreaming: true,
  },
  "gemini-2.5-pro": {
    provider: "google",
    modelId: "google/gemini-2.5-pro",
    supportsStreaming: true,
  },
  "deepseek-coder-v3": {
    provider: "deepseek",
    modelId: "deepseek/deepseek-coder-v3",
    supportsStreaming: true,
  },
  "deepseek-v3": {
    provider: "deepseek",
    modelId: "deepseek/deepseek-v3",
    supportsStreaming: true,
  },
  "grok-code-1": { provider: "xai", modelId: "xai/grok-code-1", supportsStreaming: true },
  "grok-code-fast-1": {
    provider: "xai",
    modelId: "xai/grok-code-fast-1",
    supportsStreaming: true,
  },
  "llama-4.1-70b": {
    provider: "meta",
    modelId: "meta/llama-4.1-70b-instruct",
    supportsStreaming: true,
  },
  "llama-4.1-405b": {
    provider: "meta",
    modelId: "meta/llama-4.1-405b-instruct",
    supportsStreaming: true,
  },
  "mistral-large-3": {
    provider: "mistral-ai",
    modelId: "mistral-ai/mistral-large-3",
    supportsStreaming: true,
  },
  codestral: {
    provider: "mistral-ai",
    modelId: "mistral-ai/codestral-2501",
    supportsStreaming: true,
  },
  "phi-4": { provider: "microsoft", modelId: "microsoft/phi-4", supportsStreaming: true },
  "glm-5-plus": { provider: "zhipu", modelId: "zhipu/glm-5-plus", supportsStreaming: true },
  "minimax-text-02": {
    provider: "minimax",
    modelId: "minimax/minimax-text-02",
    supportsStreaming: true,
  },
  "qwen-2.5-coder-72b": {
    provider: "alibaba",
    modelId: "alibaba/qwen-2.5-coder-72b",
    supportsStreaming: true,
  },
  "kimi-latest": {
    provider: "moonshot",
    modelId: "moonshot/kimi-latest",
    supportsStreaming: true,
  },
};

export function getGithubModelInfo(modelId: string): GithubModelInfo | undefined {
  return GITHUB_MODELS[modelId];
}

export function isKnownModel(modelId: string): boolean {
  return modelId in GITHUB_MODELS;
}

export const DEFAULT_COPILOT_MODEL = "gpt-5-mini";
