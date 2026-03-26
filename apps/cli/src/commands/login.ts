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
}

function saveDefaultModelToConfig(defaultModel: string): void {
  let configDir: string;
  try {
    configDir = getGlobalConfigDir();
  } catch {
    return;
  }

  const configPath = join(configDir, "config.jsonc");

  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  const providers =
    existing["providers"] != null &&
    typeof existing["providers"] === "object" &&
    !Array.isArray(existing["providers"])
      ? (existing["providers"] as Record<string, unknown>)
      : {};

  const copilot =
    providers["copilot"] != null &&
    typeof providers["copilot"] === "object" &&
    !Array.isArray(providers["copilot"])
      ? (providers["copilot"] as Record<string, unknown>)
      : {};

  const updated = {
    ...existing,
    providers: {
      ...providers,
      copilot: { ...copilot, defaultModel },
    },
  };

  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
}

export async function runLogin(options: LoginOptions = {}): Promise<void> {
  const existingToken = getGithubToken();
  if (existingToken && !options.token) {
    const source = getGithubTokenSource();
    const sourceLabel =
      source === "keychain" ? "OS Keychain" : source === "none" ? "unknown" : `${source} env var`;
    process.stdout.write(
      `Already authenticated. Token source: ${sourceLabel}\n` +
        `Run 'dc login --token <token>' to re-authenticate.\n`,
    );
    return;
  }

  let token = options.token;

  if (!token) {
    token = await password({ message: "Enter your GitHub Personal Access Token:" });
  }

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

  let defaultModel = options.model;
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
    `\n✓ Logged in as ${user.login}${user.name ? ` (${user.name})` : ""} | Default model: ${defaultModel}\n`,
  );
}
