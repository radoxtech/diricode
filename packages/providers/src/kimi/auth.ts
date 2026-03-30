import { Entry } from "@napi-rs/keyring";

export const KIMI_KEYCHAIN_SERVICE = "diricode";
export const KIMI_KEYCHAIN_ACCOUNT = "kimi-api-key";

export const KIMI_API_KEY_ENV_VAR = "KIMI_API_KEY";

export type KimiApiKeySource = "env" | "keychain" | "none";

export class KimiKeychainError extends Error {
  constructor(cause: unknown) {
    super(`Kimi keychain unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "KimiKeychainError";
  }
}

/**
 * Gets the Kimi API key from the system keychain.
 *
 * @returns The API key if found, null otherwise
 */
export function getKimiApiKeyFromKeychain(): string | null {
  try {
    const entry = new Entry(KIMI_KEYCHAIN_SERVICE, KIMI_KEYCHAIN_ACCOUNT);
    return entry.getPassword();
  } catch {
    return null;
  }
}

/**
 * Sets the Kimi API key in the system keychain.
 *
 * @param apiKey - The API key to store
 * @throws {KimiKeychainError} If the keychain is unavailable
 */
export function setKimiApiKeyInKeychain(apiKey: string): void {
  try {
    const entry = new Entry(KIMI_KEYCHAIN_SERVICE, KIMI_KEYCHAIN_ACCOUNT);
    entry.setPassword(apiKey);
  } catch (err) {
    throw new KimiKeychainError(err);
  }
}

/**
 * Deletes the Kimi API key from the system keychain.
 *
 * @returns True if the key was deleted, false if it didn't exist
 */
export function deleteKimiApiKeyFromKeychain(): boolean {
  try {
    const entry = new Entry(KIMI_KEYCHAIN_SERVICE, KIMI_KEYCHAIN_ACCOUNT);
    return entry.deletePassword();
  } catch {
    return false;
  }
}

/**
 * Gets the Kimi API key from environment variable.
 *
 * @returns The API key if found in env var, undefined otherwise
 */
export function getKimiApiKeyFromEnv(): string | undefined {
  const value = process.env[KIMI_API_KEY_ENV_VAR];
  if (value && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

/**
 * Gets the Kimi API key from the best available source.
 * Two options: env var OR keychain (interactive login)
 *
 * @returns The API key if available, undefined otherwise
 */
export function getKimiApiKey(): string | undefined {
  // Option 1: Environment variable
  const envKey = getKimiApiKeyFromEnv();
  if (envKey) {
    return envKey;
  }

  // Option 2: Keychain (interactive login)
  const keychainKey = getKimiApiKeyFromKeychain();
  if (keychainKey) {
    return keychainKey;
  }

  return undefined;
}

/**
 * Determines the source of the Kimi API key.
 *
 * @returns The source of the API key
 */
export function getKimiApiKeySource(): KimiApiKeySource {
  if (getKimiApiKeyFromEnv()) {
    return "env";
  }

  if (getKimiApiKeyFromKeychain()) {
    return "keychain";
  }

  return "none";
}

/**
 * Checks if Kimi authentication is available.
 *
 * @returns True if an API key is available from any source
 */
export function hasKimiAuth(): boolean {
  return getKimiApiKey() !== undefined;
}

/**
 * Validates a Kimi API key format.
 * Kimi API keys are typically long alphanumeric strings.
 *
 * @param apiKey - The API key to validate
 * @returns True if the key format appears valid
 */
export function validateKimiApiKey(apiKey: string): boolean {
  // Kimi API keys are typically 30+ characters with alphanumeric and special chars
  return apiKey.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
}

export interface KimiAuthConfig {
  /** API key (optional - will use keychain or env if not provided) */
  apiKey?: string;
  /** Base URL override (optional) */
  baseURL?: string;
}
