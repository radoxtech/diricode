import { KeychainService, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT } from "./keychain.js";

export const GITHUB_TOKEN_ENV_VARS = ["DC_GITHUB_TOKEN", "GITHUB_TOKEN", "GH_TOKEN"] as const;

const _keychainService = new KeychainService();

export function getGithubTokenFromKeychain(): string | undefined {
  const token = _keychainService.get(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  return token ?? undefined;
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

export function hasGithubAuth(): boolean {
  return getGithubToken() !== undefined;
}

export interface GithubAuthConfig {
  apiKey?: string;
  org?: string;
}
