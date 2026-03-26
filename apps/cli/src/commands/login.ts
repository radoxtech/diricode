import { password, select } from "@inquirer/prompts";
import {
  KeychainService,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
  validateGithubToken,
  fetchAvailableModels,
} from "@diricode/providers";

export interface LoginOptions {
  token?: string;
  model?: string;
}

export async function runLogin(options: LoginOptions = {}): Promise<void> {
  let token = options.token;

  if (!token) {
    token = await password({ message: "Enter your GitHub Personal Access Token:" });
  }

  const user = await validateGithubToken(token);

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

  process.stdout.write(`\nLogged in as ${user.login}. Default model: ${defaultModel}\n`);
}
