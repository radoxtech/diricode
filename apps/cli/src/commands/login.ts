import { select } from "@inquirer/prompts";
import { LOGIN_PROVIDERS, getLoginProvider } from "../providers/login-providers.js";

export interface LoginOptions {
  provider?: string;
}

export async function runLogin(options: LoginOptions = {}): Promise<void> {
  if (options.provider) {
    const provider = getLoginProvider(options.provider);
    if (!provider) {
      process.stderr.write(`Unknown provider: ${options.provider}\n`);
      process.stderr.write(
        `Available providers: ${LOGIN_PROVIDERS.map((p) => p.name).join(", ")}\n`,
      );
      process.exitCode = 1;
      return;
    }
    try {
      await provider.login();
    } catch (err) {
      process.stderr.write(`✗ Login failed: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
    return;
  }

  const choices = LOGIN_PROVIDERS.map((p) => ({
    name: `${p.name} ${p.isLoggedIn() ? "(logged in)" : "(not logged in)"}`,
    value: p.name,
    description: p.description,
  }));

  const answer = await select({
    message: "Which provider would you like to authenticate with?",
    choices,
  });

  const provider = getLoginProvider(answer);
  if (!provider) {
    process.stdout.write("Login cancelled.\n");
    return;
  }

  try {
    await provider.login();
  } catch (err) {
    process.stderr.write(`✗ Login failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}
