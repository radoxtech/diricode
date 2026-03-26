import { KeychainService, KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT } from "@diricode/providers";

export async function runLogout(): Promise<void> {
  const svc = new KeychainService();
  const deleted = svc.delete(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);

  if (deleted) {
    process.stdout.write("\nToken removed from system keychain. You are now logged out.\n");
  } else {
    process.stdout.write("\nNo token found in keychain — already logged out.\n");
  }
}
