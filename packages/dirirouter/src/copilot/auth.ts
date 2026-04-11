import { KeychainService, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT } from "./keychain.js";

export const GITHUB_TOKEN_ENV_VARS = ["DC_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"] as const;

export type GithubTokenSource = (typeof GITHUB_TOKEN_ENV_VARS)[number] | "keychain" | "none";

let keychainService: KeychainService | undefined;

function getKeychainService(): KeychainService {
  keychainService ??= new KeychainService();

  return keychainService;
}

export function getGithubTokenFromKeychain(): string | undefined {
  const token = getKeychainService().get(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  return token ?? undefined;
}

export function storeGithubToken(token: string): void {
  getKeychainService().set(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, token);
}

export function clearGithubToken(): void {
  getKeychainService().delete(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
}

export function getGithubToken(): string | undefined {
  for (const envVar of GITHUB_TOKEN_ENV_VARS) {
    const value = process.env[envVar];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return getGithubTokenFromKeychain();
}

export function getGithubTokenSource(): GithubTokenSource {
  for (const envVar of GITHUB_TOKEN_ENV_VARS) {
    const value = process.env[envVar];
    if (value && value.trim().length > 0) {
      return envVar;
    }
  }
  if (getGithubTokenFromKeychain() !== undefined) {
    return "keychain";
  }
  return "none";
}

export function hasGithubAuth(): boolean {
  return getGithubToken() !== undefined;
}

export interface GithubAuthConfig {
  apiKey?: string;
  org?: string;
}
