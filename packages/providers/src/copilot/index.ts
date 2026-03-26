export { CopilotProvider, createCopilotProvider } from "./adapter.js";
export {
  DEFAULT_COPILOT_MODEL,
  GITHUB_MODELS,
  getGithubModelInfo,
  isKnownModel,
} from "./models.js";
export { getGithubToken, hasGithubAuth, getGithubTokenFromKeychain } from "./auth.js";
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
