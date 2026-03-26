import { password, confirm, select } from "@inquirer/prompts";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  KeychainService,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
  validateGithubToken,
  InvalidTokenError,
  fetchAvailableModels,
} from "@diricode/providers";
import { getGlobalConfigDir } from "@diricode/core";

export interface LoginOptions {
  token?: string;
  model?: string;
}

async function promptForToken(): Promise<string> {
  const token = await password({
    message: "Paste your GitHub Personal Access Token:",
    validate(input: string) {
      if (!input || input.trim().length === 0) return "Token cannot be empty";
      return true;
    },
  });
  return token.trim();
}

function readGlobalConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) return {};
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function saveDefaultModel(modelId: string): void {
  const dir = getGlobalConfigDir();
  mkdirSync(dir, { recursive: true });

  const configPath = join(dir, "config.jsonc");
  const existing = readGlobalConfig(configPath);

  const providers = (existing.providers as Record<string, unknown> | undefined) ?? {};
  const copilot = (providers.copilot as Record<string, unknown> | undefined) ?? {};
  const updated = {
    ...existing,
    providers: {
      ...providers,
      copilot: {
        ...copilot,
        defaultModel: modelId,
      },
    },
  };

  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
}

export async function runLogin(options: LoginOptions = {}): Promise<void> {
  process.stdout.write("\nDiriCode — GitHub Login\n\n");

  const token = options.token ?? (await promptForToken());

  process.stdout.write("\nValidating token...\n");

  let userLogin = "";
  try {
    const user = await validateGithubToken(token);
    userLogin = user.login;
    process.stdout.write(
      `\nAuthenticated as: ${user.login}${user.name ? ` (${user.name})` : ""}\n`,
    );
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      process.stderr.write(`\nInvalid token: ${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(
      `\nWarning: Could not verify token — ${err instanceof Error ? err.message : String(err)}\n`,
    );

    const proceed = await confirm({ message: "Save token anyway?", default: false });
    if (!proceed) {
      process.stdout.write("Aborted.\n");
      process.exit(0);
    }
  }

  const svc = new KeychainService();
  try {
    svc.set(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, token);
    process.stdout.write("\nToken saved to system keychain.\n");
  } catch {
    process.stderr.write("\nFailed to save token to keychain. Check keychain permissions.\n");
    process.exit(1);
  }

  let chosenModel: string;
  if (options.model) {
    chosenModel = options.model;
  } else {
    process.stdout.write("\nFetching available models...\n");
    const models = await fetchAvailableModels(token);

    if (models.length === 0) {
      process.stdout.write("\nNo models available. Skipping default model selection.\n");
      return;
    }

    chosenModel = await select({
      message: "Select default model:",
      choices: models.map((m) => ({
        name: m.id,
        value: m.id,
        description: `${m.provider} · streaming: ${String(m.supportsStreaming)}`,
      })),
    });
  }

  saveDefaultModel(chosenModel);

  const who = userLogin ? ` as ${userLogin}` : "";
  process.stdout.write(`\nAll done! Logged in${who}. Default model: ${chosenModel}\n`);
}
