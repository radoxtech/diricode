import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  getGithubToken,
  getGithubTokenSource,
  validateGithubToken,
  InvalidTokenError,
} from "@diricode/dirirouter";
import { getGlobalConfigDir } from "@diricode/core";

function getGoogleAuthStatus(): { configured: boolean; source: string } {
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    return { configured: true, source: "GEMINI_API_KEY env var" };
  }

  try {
    const configDir = getGlobalConfigDir();
    const configPath = join(configDir, "config.jsonc");
    if (!existsSync(configPath)) {
      return { configured: false, source: "" };
    }
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw) as { providers?: { google?: { apiKey?: string } } };
    const providers = config.providers;
    if (providers?.google?.apiKey) {
      return { configured: true, source: "config.jsonc (global config)" };
    }
  } catch {
    return { configured: false, source: "" };
  }

  return { configured: false, source: "" };
}

export async function runWhoami(): Promise<void> {
  const token = getGithubToken();
  const source = getGithubTokenSource();

  if (!token || source === "none") {
    process.stdout.write(`Not logged in to GitHub. Run 'dc login' to authenticate.\n`);
  } else {
    const sourceLabel = source === "keychain" ? "OS Keychain" : `${source} env var`;

    let login: string;
    try {
      const user = await validateGithubToken(token);
      login = user.name ? `${user.login} (${user.name})` : user.login;
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        process.stdout.write(
          `GitHub token found (source: ${sourceLabel}) but it appears invalid: ${err.message}\n` +
            `Run 'dc login' to re-authenticate.\n`,
        );
        return;
      }
      throw err;
    }

    process.stdout.write(`GitHub: ${login} | Token source: ${sourceLabel}\n`);
  }

  const google = getGoogleAuthStatus();
  if (google.configured) {
    process.stdout.write(`Google: configured | Source: ${google.source}\n`);
  } else {
    process.stdout.write(`Google: not configured | Run 'dc login' to add a Gemini API key.\n`);
  }
}
