export type {
  GenerateOptions,
  ModelConfig,
  ModelDescriptor,
  ModelQuota,
  Provider,
  ProviderAdapter,
  ProviderEntry,
  ProviderPriority,
  StreamChunk,
} from "./types.js";

export { ProviderPriorities } from "./types.js";

export { ProviderAlreadyRegisteredError, ProviderNotFoundError, Registry } from "./registry.js";

export { ClassifiedError } from "./error-classifier.js";
export type { ProviderErrorKind } from "./error-classifier.js";

export { DiriRouter } from "./diri-router.js";
export type {
  ChatOptions,
  ChatResponse,
  DiriRouterOptions,
  SelectedModelInfo,
  ExperimentLogger,
} from "./diri-router.js";

export { LogFeedbackCollector } from "./feedback.js";

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

export { BASE_DELAY_MS, computeDelay, withRetry } from "./retry-engine.js";

export { GeminiProvider } from "./providers/gemini.js";
export type { GeminiProviderConfig } from "./providers/gemini.js";

export { KimiProvider, createKimiProvider } from "./providers/kimi.js";
export type { KimiProviderConfig } from "./providers/kimi.js";

export {
  deleteKimiApiKeyFromKeychain,
  getKimiApiKey,
  getKimiApiKeyFromEnv,
  getKimiApiKeyFromKeychain,
  getKimiApiKeySource,
  hasKimiAuth,
  KIMI_API_KEY_ENV_VAR,
  KIMI_KEYCHAIN_ACCOUNT,
  KIMI_KEYCHAIN_SERVICE,
  KimiKeychainError,
  setKimiApiKeyInKeychain,
  validateKimiApiKey,
} from "./kimi/index.js";

export type { KimiApiKeySource, KimiAuthConfig } from "./kimi/index.js";

export { ZaiProvider, createZaiProvider } from "./providers/zai.js";
export type { ZaiProviderConfig } from "./providers/zai.js";

export {
  MinimaxProvider,
  createMinimaxProvider,
  MinimaxProviderAdapter,
} from "./providers/minimax.js";
export type { MinimaxProviderConfig } from "./providers/minimax.js";

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

export type { StreamManagerOptions, StreamManagerResult, StreamUsage } from "./stream-manager.js";

export {
  STREAM_INACTIVITY_TIMEOUT_MS,
  StreamManager,
  StreamTimeoutError,
  USAGE_CHUNK_TIMEOUT_MS,
} from "./stream-manager.js";

export { CopilotProvider, createCopilotProvider } from "./copilot/index.js";
export {
  COPILOT_CLIENT_ID,
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
  initiateGithubDeviceFlow,
  pollGithubDeviceToken,
  exchangeGithubDeviceCode,
  GithubOAuthError,
} from "./copilot/index.js";
export type {
  GithubUser,
  CopilotModelInfo,
  CopilotLoginResult,
  GithubTokenSource,
  GithubDeviceCodeResponse,
  GithubOAuthToken,
} from "./copilot/index.js";

export type {
  ModelCapabilities,
  ModelCard,
  KnownFor,
  BenchmarkBucket,
  QualityBenchmark,
  SpeedBenchmark,
  Benchmarks,
  PricingTier,
} from "./contracts/model-card.js";

export type {
  RateLimit,
  ProviderModelAvailability,
  ProviderModelAvailability as PickerSubscription,
} from "./contracts/provider-model-availability.js";

export {
  ModelCapabilitiesSchema,
  ModelCardSchema,
  KnownForSchema,
  BenchmarkBucketSchema,
  QualityBenchmarkSchema,
  SpeedBenchmarkSchema,
  BenchmarksSchema,
  PricingTierSchema,
  RateLimitSchema,
  ProviderModelAvailabilitySchema,
  ProviderModelAvailabilitySchema as PickerSubscriptionSchema,
  ModelStabilitySchema,
  ModelCardNotFoundError,
  ModelCardAlreadyRegisteredError,
  ModelCardRegistry,
  SubscriptionNotFoundError,
  SubscriptionAlreadyRegisteredError,
  SubscriptionRegistry,
} from "./picker/index.js";

// Families — provider-agnostic normalization and family metadata
export {
  normalizeModelFamily,
  resolveFamilyMetadata,
  listCanonicalFamilies,
} from "./families/index.js";
export type {
  ModelFamily,
  ModelStability as Stability,
  FamilyMetadata,
  NormalizationResult,
} from "./families/index.js";

// Utils — models.dev catalog client
export type {
  ModelsDevCost,
  ModelsDevLimit,
  ModelsDevModalities,
  ModelsDevInterleaved,
  ModelsDevModel,
  ModelsDevProvider,
  ModelsDevApiResponse,
  ModelsDevQuery,
  CatalogModel,
} from "./utils/index.js";

export { ModelsCatalog, ModelsDevFetchError } from "./utils/index.js";

// LLM Picker — moved from @diricode/core/llm-picker
export {
  TaskComplexitySchema,
  HardRuleSchema,
  HardRulesConfigSchema,
  DEFAULT_HARD_RULES_CONFIG,
  comparePricingTiers,
  isPricingTierAllowed,
  getPricingTierRejectionReason,
  resolveHardRuleRange,
  Tier1HeuristicRouter,
  Tier2BertRouter,
  Tier3TinyLLMRouter,
  CascadeModelResolver,
  ContextTierSchema,
  contextWindowToTier,
  contextTierMinTokens,
} from "./llm-picker/index.js";

export type {
  TaskComplexity,
  HardRule,
  HardRulesConfig,
  HardRuleEvaluationContext,
  HardRuleEvaluationResult,
  CascadeModelResolverOptions,
  ResolverCandidate,
  ModelTier,
  ModelAttribute,
  FallbackType,
  ContextTier,
  ModelDimensions,
  CascadeTier,
  TierHistoryEntry,
  ClassificationTrace,
  AgentInfo,
  TaskInfo,
  DecisionConstraints,
  DecisionRequest,
  ModelCandidate,
  DecisionMeta,
  SelectedModel,
  DecisionResponse,
  FeedbackOutcome,
  FeedbackSubmission,
  FeedbackCollector,
  RouterClassification,
  ModelRouter,
  ModelResolver,
} from "./llm-picker/index.js";
