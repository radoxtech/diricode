export interface GithubModelInfo {
  readonly provider: string;
  readonly modelId: string;
  readonly supportsStreaming: boolean;
}

const GITHUB_MODELS: Record<string, GithubModelInfo> = {
  "gpt-5": { provider: "openai", modelId: "openai/gpt-5", supportsStreaming: true },
  "gpt-5-mini": { provider: "openai", modelId: "openai/gpt-5-mini", supportsStreaming: true },
  "gpt-5-nano": { provider: "openai", modelId: "openai/gpt-5-nano", supportsStreaming: true },
  "gpt-4.5-preview": {
    provider: "openai",
    modelId: "openai/gpt-4.5-preview",
    supportsStreaming: true,
  },
  "gpt-4.1": { provider: "openai", modelId: "openai/gpt-4.1", supportsStreaming: true },
  "gpt-4.1-mini": { provider: "openai", modelId: "openai/gpt-4.1-mini", supportsStreaming: true },
  "gpt-4.1-nano": { provider: "openai", modelId: "openai/gpt-4.1-nano", supportsStreaming: true },
  "gpt-4o": { provider: "openai", modelId: "openai/gpt-4o", supportsStreaming: true },
  "gpt-4o-mini": { provider: "openai", modelId: "openai/gpt-4o-mini", supportsStreaming: true },
  "gpt-4o-pro": { provider: "openai", modelId: "openai/gpt-4o-pro", supportsStreaming: true },
  o1: { provider: "openai", modelId: "openai/o1", supportsStreaming: false },
  o3: { provider: "openai", modelId: "openai/o3", supportsStreaming: false },
  "o3-mini": { provider: "openai", modelId: "openai/o3-mini", supportsStreaming: false },
  "o4-mini": { provider: "openai", modelId: "openai/o4-mini", supportsStreaming: true },
  "claude-sonnet-4": {
    provider: "anthropic",
    modelId: "anthropic/claude-sonnet-4-20250514",
    supportsStreaming: true,
  },
  "claude-3.5-sonnet": {
    provider: "anthropic",
    modelId: "anthropic/claude-3.5-sonnet-20241022",
    supportsStreaming: true,
  },
  "claude-3-opus": {
    provider: "anthropic",
    modelId: "anthropic/claude-3-opus-20240229",
    supportsStreaming: true,
  },
  "claude-3-haiku": {
    provider: "anthropic",
    modelId: "anthropic/claude-3-haiku-20240307",
    supportsStreaming: true,
  },
  "gemini-2.0-flash": {
    provider: "google",
    modelId: "google/gemini-2.0-flash",
    supportsStreaming: true,
  },
  "gemini-2.0-flash-lite": {
    provider: "google",
    modelId: "google/gemini-2.0-flash-lite",
    supportsStreaming: true,
  },
  "gemini-1.5-flash": {
    provider: "google",
    modelId: "google/gemini-1.5-flash",
    supportsStreaming: true,
  },
  "gemini-1.5-pro": {
    provider: "google",
    modelId: "google/gemini-1.5-pro",
    supportsStreaming: true,
  },
  "deepseek-r1": { provider: "deepseek", modelId: "deepseek/deepseek-r1", supportsStreaming: true },
  "deepseek-v3": {
    provider: "deepseek",
    modelId: "deepseek/deepseek-v3-0324",
    supportsStreaming: true,
  },
  "llama-3.3-70b": {
    provider: "meta",
    modelId: "meta/llama-3.3-70b-instruct",
    supportsStreaming: true,
  },
  "llama-3.1-405b": {
    provider: "meta",
    modelId: "meta/meta-llama-3.1-405b-instruct",
    supportsStreaming: true,
  },
  "llama-3.1-70b": {
    provider: "meta",
    modelId: "meta/meta-llama-3.1-70b-instruct",
    supportsStreaming: true,
  },
  "llama-3.1-8b": {
    provider: "meta",
    modelId: "meta/meta-llama-3.1-8b-instruct",
    supportsStreaming: true,
  },
  codestral: {
    provider: "mistral-ai",
    modelId: "mistral-ai/codestral-2501",
    supportsStreaming: true,
  },
  "mistral-large": {
    provider: "mistral-ai",
    modelId: "mistral-ai/mistral-large-2411",
    supportsStreaming: true,
  },
  "mistral-small": {
    provider: "mistral-ai",
    modelId: "mistral-ai/mistral-small-2503",
    supportsStreaming: true,
  },
  "grok-3": { provider: "xai", modelId: "xai/grok-3", supportsStreaming: true },
  "grok-3-mini": { provider: "xai", modelId: "xai/grok-3-mini", supportsStreaming: true },
  "phi-4": { provider: "microsoft", modelId: "microsoft/phi-4", supportsStreaming: true },
  "phi-4-mini": {
    provider: "microsoft",
    modelId: "microsoft/phi-4-mini-instruct",
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
