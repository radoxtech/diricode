import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  hasGithubAuth,
  getGithubTokenSource,
  getGithubTokenWithFallback,
  validateGithubToken,
} from "@diricode/providers";
import { getGlobalConfigDir } from "@diricode/core";

function readDefaultModel(): string | null {
  let dir: string;
  try {
    dir = getGlobalConfigDir();
  } catch {
    return null;
  }

  const configPath = join(dir, "config.jsonc");
  if (!existsSync(configPath)) return null;

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const config = parsed as Record<string, unknown>;
      const providers = config.providers as Record<string, unknown> | undefined;
      const copilot = providers?.copilot as Record<string, unknown> | undefined;
      const model = copilot?.defaultModel;
      return typeof model === "string" ? model : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function runWhoami(): Promise<void> {
  if (!hasGithubAuth()) {
    process.stdout.write("\nNot logged in. Run 'dc login' to authenticate.\n");
    return;
  }

  const source = getGithubTokenSource();
  const token = getGithubTokenWithFallback();
  let login = "(unknown)";

  if (token) {
    try {
      const user = await validateGithubToken(token);
      login = user.login + (user.name ? ` (${user.name})` : "");
    } catch {
      login = "(could not verify)";
    }
  }

  const defaultModel = readDefaultModel() ?? "(not set — run 'dc login' to choose)";

  process.stdout.write(`\nLogged in as: ${login}\n`);
  process.stdout.write(`Token source: ${source}\n`);
  process.stdout.write(`Default model: ${defaultModel}\n`);
}
