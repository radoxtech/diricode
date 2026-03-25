export type {
  GenerateOptions,
  ModelConfig,
  Provider,
  ProviderEntry,
  ProviderPriority,
  StreamChunk,
} from "./types.js";

export { ProviderPriorities } from "./types.js";

export { ProviderAlreadyRegisteredError, ProviderNotFoundError, Registry } from "./registry.js";

export { GeminiProvider } from "./providers/gemini.js";
export type { GeminiProviderConfig } from "./providers/gemini.js";

export { ABExperimentManager } from "./ab/ABExperimentManager.js";

export type {
  ABExperiment,
  ABExperimentRepository,
  ABExperimentStatus,
  ABEvaluationResult,
  ABBranchResult,
  ABSkipResult,
  TaskDescriptor,
} from "./ab/ABExperimentManager.js";

export { CopilotProvider, createCopilotProvider } from "./copilot/index.js";
export { DEFAULT_COPILOT_MODEL, getGithubModelInfo, hasGithubAuth } from "./copilot/index.js";
