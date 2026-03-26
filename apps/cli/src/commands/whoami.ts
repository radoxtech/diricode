import {
  getGithubToken,
  getGithubTokenSource,
  validateGithubToken,
  InvalidTokenError,
} from "@diricode/providers";

export async function runWhoami(): Promise<void> {
  const token = getGithubToken();
  const source = getGithubTokenSource();

  if (!token || source === "none") {
    process.stdout.write(`Not logged in. Run 'dc login' to authenticate.\n`);
    return;
  }

  const sourceLabel = source === "keychain" ? "OS Keychain" : `${source} env var`;

  let login = "(unknown)";
  try {
    const user = await validateGithubToken(token);
    login = user.name ? `${user.login} (${user.name})` : user.login;
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      process.stdout.write(
        `Token found (source: ${sourceLabel}) but it appears invalid: ${err.message}\n` +
          `Run 'dc login' to re-authenticate.\n`,
      );
      return;
    }
    throw err;
  }

  process.stdout.write(`Logged in as ${login} | Token source: ${sourceLabel}\n`);
}
