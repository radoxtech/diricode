/**
 * Authentication handling for GitHub Models / Copilot provider.
 *
 * Auth is via GitHub token following the DC_* env convention.
 * The @github/models package defaults to GITHUB_TOKEN env var,
 * but we also support explicit DC_GITHUB_TOKEN for consistency
 * with the layered config system.
 *
 * Token resolution order:
 *   1. DC_GITHUB_TOKEN env var
 *   2. GITHUB_TOKEN env var
 *   3. GH_TOKEN env var
 *   4. OS keychain (via @napi-rs/keyring)
 */

import { KeychainService, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT } from "./keychain.js";

/**
 * Well-known environment variable names for GitHub authentication.
 * Ordered by precedence (first found wins).
 */
export const GITHUB_TOKEN_ENV_VARS = [
  "DC_GITHUB_TOKEN", // Explicit DiriCode convention
  "GITHUB_TOKEN", // GitHub CLI / Actions standard
  "GH_TOKEN", // GitHub CLI alternative
] as const;

/**
 * Get the GitHub token from environment variables.
 *
 * @returns The GitHub token or undefined if not found.
 */
export function getGithubToken(): string | undefined {
  for (const envVar of GITHUB_TOKEN_ENV_VARS) {
    const value = process.env[envVar];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Get the GitHub token from the OS keychain (synchronous).
 *
 * @returns The stored token or undefined if not present / keychain unavailable.
 */
export function getGithubTokenFromKeychain(): string | undefined {
  const svc = new KeychainService();
  const value = svc.get(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * Get the GitHub token, checking env vars first then falling back to the keychain.
 *
 * @returns The first available token or undefined if none found.
 */
export function getGithubTokenWithFallback(): string | undefined {
  return getGithubToken() ?? getGithubTokenFromKeychain();
}

/**
 * Determine where the GitHub token originates from.
 *
 * @returns "env" if found in environment variables, "keychain" if found in the OS
 *          keychain, or "none" if no token is available.
 */
export function getGithubTokenSource(): "env" | "keychain" | "none" {
  if (getGithubToken() !== undefined) return "env";
  if (getGithubTokenFromKeychain() !== undefined) return "keychain";
  return "none";
}

/**
 * Check if GitHub authentication is configured.
 *
 * Checks env vars first, then falls back to the OS keychain.
 *
 * @returns true if a token is available.
 */
export function hasGithubAuth(): boolean {
  return getGithubTokenWithFallback() !== undefined;
}

/**
 * Authentication configuration for createGithubModels.
 */
export interface GithubAuthConfig {
  /**
   * GitHub Personal Access Token or Fine-Grained Token.
   * If omitted, defaults to GITHUB_TOKEN env var.
   */
  apiKey?: string;
  /**
   * Organization to attribute API usage to (optional).
   */
  org?: string;
}
