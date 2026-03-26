import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { password, select } from "@inquirer/prompts";
import {
  KeychainService,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
  validateGithubToken,
  fetchAvailableModels,
  getGithubToken,
  getGithubTokenSource,
  InvalidTokenError,
} from "@diricode/providers";
import { getGlobalConfigDir } from "@diricode/core";

export interface LoginOptions {
  token?: string;
  model?: string;
  provider?: "github" | "google";
}

interface NestedConfig {
  providers?: {
    copilot?: {
      defaultModel?: string;
    };
    google?: {
      apiKey?: string;
    };
  };
}

function saveDefaultModelToConfig(defaultModel: string): void {
  let configDir: string;
  try {
    configDir = getGlobalConfigDir();
  } catch {
    return;
  }

  const configPath = join(configDir, "config.jsonc");

  let existing: NestedConfig = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8")) as NestedConfig;
    } catch {
      existing = {};
    }
  }

  const providers = existing.providers ?? {};
  const copilot = providers.copilot ?? {};

  const updated: NestedConfig = {
    ...existing,
    providers: {
      ...providers,
      copilot: { ...copilot, defaultModel },
    },
  };

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
}

function saveGoogleApiKeyToConfig(apiKey: string): void {
  let configDir: string;
  try {
    configDir = getGlobalConfigDir();
  } catch {
    return;
  }

  const configPath = join(configDir, "config.jsonc");

  let existing: NestedConfig = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8")) as NestedConfig;
    } catch {
      existing = {};
    }
  }

  const providers = existing.providers ?? {};

  const updated: NestedConfig = {
    ...existing,
    providers: {
      ...providers,
      google: { ...providers.google, apiKey },
    },
  };

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
}

function isValidGoogleApiKeyFormat(key: string): boolean {
  // Google API keys are typically 39+ characters
  // Classic format: starts with "AIza", 39 chars total
  // New format: varies, but generally 40+ chars
  return key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);
}

async function loginGithub(
  interactive: boolean,
  forcedToken?: string,
  forcedModel?: string,
): Promise<void> {
  const existingToken = forcedToken ?? getGithubToken();
  if (!existingToken) {
    if (!interactive) {
      process.stderr.write(`No GitHub token provided. Run 'dc login' to authenticate.\n`);
      process.exitCode = 1;
      return;
    }
    const token = await password({
      message: "Enter your GitHub Personal Access Token:",
      mask: true,
    });
    await doGithubLogin(token, forcedModel);
    return;
  }

  const source = forcedToken ? "(provided via --token)" : getGithubTokenSource();
  const sourceLabel =
    source === "keychain" ? "OS Keychain" : source === "none" ? "unknown" : `${source} env var`;

  if (existingToken && !forcedToken) {
    if (interactive) {
      process.stdout.write(
        `Already logged in with GitHub. Token source: ${sourceLabel}\n` +
          `Run 'dc logout' first to sign out, or run 'dc login --token <token>' to replace.\n`,
      );
    } else {
      process.stdout.write(
        `Already authenticated with GitHub. Token source: ${sourceLabel}\n` +
          `Run 'dc login --token <token>' to re-authenticate.\n`,
      );
    }
    return;
  }

  await doGithubLogin(existingToken, forcedModel);
}

async function doGithubLogin(token: string, model?: string): Promise<void> {
  let user: Awaited<ReturnType<typeof validateGithubToken>>;
  try {
    user = await validateGithubToken(token);
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      process.stderr.write(`✗ Invalid token: ${err.message}\n`);
      process.stderr.write(`Run 'dc login' again to try a different token.\n`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const keychain = new KeychainService();
  keychain.set(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, token);

  let defaultModel = model;
  if (!defaultModel) {
    const models = await fetchAvailableModels(token);
    const choices = models.map((m) => ({ name: m.name || m.id, value: m.id }));
    defaultModel = await select({
      message: "Select your default model:",
      choices,
    });
  }

  saveDefaultModelToConfig(defaultModel);

  process.stdout.write(
    `\n✓ Logged in to GitHub as ${user.login}${user.name ? ` (${user.name})` : ""} | Default model: ${defaultModel}\n`,
  );
}

async function loginGoogle(): Promise<void> {
  const apiKey = await password({
    message: "Enter your Google Gemini API key:",
    mask: true,
  });

  if (!isValidGoogleApiKeyFormat(apiKey)) {
    process.stderr.write(
      `✗ That doesn't look like a valid Google API key.\n` +
        `API keys are typically 20+ characters containing letters, numbers, underscores and dashes.\n`,
    );
    process.exitCode = 1;
    return;
  }

  saveGoogleApiKeyToConfig(apiKey);
  process.stdout.write(`\n✓ Google Gemini configured. API key saved to config.\n`);
}

async function selectProvider(): Promise<"github" | "google" | null> {
  const answer = await select({
    message: "Which provider would you like to authenticate with?",
    choices: [
      {
        name: "GitHub (Personal Access Token) — for GitHub Models",
        value: "github",
        description: "Store a GitHub PAT in your OS keychain for GitHub Models access",
      },
      {
        name: "Google (Gemini API Key) — for Gemini AI",
        value: "google",
        description: "Save your Google Gemini API key to config for Gemini access",
      },
      {
        name: "Cancel",
        value: null,
      },
    ],
  });
  return answer as "github" | "google" | null;
}

export async function runLogin(options: LoginOptions = {}): Promise<void> {
  if (options.token || options.model) {
    await loginGithub(false, options.token, options.model);
    return;
  }

  const existingToken = getGithubToken();
  if (existingToken) {
    await loginGithub(true);
    return;
  }

  const provider = await selectProvider();
  if (!provider) {
    process.stdout.write("Login cancelled.\n");
    return;
  }

  if (provider === "github") {
    await loginGithub(true);
  } else {
    await loginGoogle();
  }
}
