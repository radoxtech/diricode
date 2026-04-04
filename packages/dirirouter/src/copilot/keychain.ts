import { Entry, findCredentials, type Credential } from "@napi-rs/keyring";

export const KEYCHAIN_SERVICE = "diricode";
export const KEYCHAIN_ACCOUNT = "github-token";

export class KeychainUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Keychain unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "KeychainUnavailableError";
  }
}

export class KeychainService {
  get(service: string, account: string): string | null {
    try {
      const entry = new Entry(service, account);
      return entry.getPassword();
    } catch {
      return null;
    }
  }

  set(service: string, account: string, value: string): void {
    try {
      const entry = new Entry(service, account);
      entry.setPassword(value);
    } catch (err) {
      throw new KeychainUnavailableError(err);
    }
  }

  delete(service: string, account: string): boolean {
    try {
      const entry = new Entry(service, account);
      return entry.deletePassword();
    } catch {
      return false;
    }
  }

  getAll(service: string): Credential[] {
    try {
      return findCredentials(service);
    } catch {
      return [];
    }
  }
}
