export { CopilotProvider, createCopilotProvider } from "./adapter.js";
export {
  DEFAULT_COPILOT_MODEL,
  GITHUB_MODELS,
  getGithubModelInfo,
  isKnownModel,
} from "./models.js";
export {
  getGithubToken,
  hasGithubAuth,
  getGithubTokenFromKeychain,
  getGithubTokenSource,
  GITHUB_TOKEN_ENV_VARS,
} from "./auth.js";
export type { GithubTokenSource } from "./auth.js";
export {
  KeychainService,
  KeychainUnavailableError,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
} from "./keychain.js";
export { validateGithubToken, InvalidTokenError } from "./validator.js";
export type { GithubUser } from "./validator.js";
export { fetchAvailableModels, clearModelsCache } from "./models-fetcher.js";
export type { CatalogModel } from "./models-fetcher.js";
export {
  initiateGithubDeviceFlow,
  pollGithubDeviceToken,
  exchangeGithubDeviceCode,
  GithubOAuthError,
} from "./github-oauth.js";
export type { GithubDeviceCodeResponse, GithubOAuthToken } from "./github-oauth.js";
