/**
 * Authentication handling for GitHub Models / Copilot provider.
 *
 * Auth is via GitHub token following the DC_* env convention.
 * The @github/models package defaults to GITHUB_TOKEN env var,
 * but we also support explicit DC_GITHUB_TOKEN for consistency
 * with the layered config system.
 */

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
 * Check if GitHub authentication is configured.
 *
 * @returns true if a token is available in the environment.
 */
export function hasGithubAuth(): boolean {
  return getGithubToken() !== undefined;
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
