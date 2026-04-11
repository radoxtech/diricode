export { CopilotProvider, createCopilotProvider } from "./adapter.js";
export { COPILOT_CLIENT_ID } from "./adapter.js";
export type { CopilotLoginResult, CopilotModelInfo } from "./adapter.js";
export {
  getGithubToken,
  storeGithubToken,
  clearGithubToken,
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
export {
  initiateGithubDeviceFlow,
  pollGithubDeviceToken,
  exchangeGithubDeviceCode,
  GithubOAuthError,
} from "./github-oauth.js";
export type { GithubDeviceCodeResponse, GithubOAuthToken } from "./github-oauth.js";
