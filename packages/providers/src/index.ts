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

export type { ClassifiedError, ProviderErrorKind } from "./error-classifier.js";

export { classifyError, deriveRetryable, parseRetryAfter } from "./error-classifier.js";

export type {
  ProviderAttemptRecord,
  ProviderFallbackEvent,
  ProviderRouterOptions,
} from "./router.js";

export {
  MAX_RETRIES,
  MAX_RETRIES_AFTER_FALLBACK,
  MAX_RETRY_DELAY_MS,
  ProviderRouter,
  ProviderRouterError,
} from "./router.js";

export type { RetryConfig, RetryResult } from "./retry-engine.js";

export { computeDelay, withRetry } from "./retry-engine.js";

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
export {
  DEFAULT_COPILOT_MODEL,
  getGithubModelInfo,
  hasGithubAuth,
  getGithubToken,
  getGithubTokenFromKeychain,
  getGithubTokenSource,
  GITHUB_TOKEN_ENV_VARS,
  KeychainService,
  KeychainUnavailableError,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
  validateGithubToken,
  InvalidTokenError,
  fetchAvailableModels,
  clearModelsCache,
  initiateGithubDeviceFlow,
  pollGithubDeviceToken,
  exchangeGithubDeviceCode,
  GithubOAuthError,
} from "./copilot/index.js";
export type {
  GithubUser,
  CatalogModel,
  GithubTokenSource,
  GithubDeviceCodeResponse,
  GithubOAuthToken,
} from "./copilot/index.js";
