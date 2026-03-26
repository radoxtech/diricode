import {
  KeychainService,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
  KeychainUnavailableError,
} from "@diricode/providers";

export async function runLogout(): Promise<void> {
  const keychain = new KeychainService();
  let deleted: boolean;
  try {
    deleted = keychain.delete(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  } catch (err) {
    if (err instanceof KeychainUnavailableError) {
      process.stdout.write(`No keychain token found to remove.\n`);
      return;
    }
    throw err;
  }

  if (deleted) {
    process.stdout.write(`✓ Logged out successfully.\n`);
  } else {
    process.stdout.write(`No keychain token found to remove.\n`);
  }
}
