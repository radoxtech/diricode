import { password } from "@inquirer/prompts";
import { KeychainService } from "@diricode/dirirouter";
import {
  CopilotProvider,
  hasGithubAuth,
  validateGithubToken,
  initiateGithubDeviceFlow,
  pollGithubDeviceToken,
  GithubOAuthError,
  COPILOT_CLIENT_ID,
} from "@diricode/dirirouter";
import { hasKimiAuth, setKimiApiKeyInKeychain, validateKimiApiKey } from "@diricode/dirirouter";

export type AuthMethod = "oauth" | "api_key" | "none";

export interface LoginProvider {
  name: string;
  authMethod: AuthMethod;
  envVars: string[];
  isLoggedIn: () => boolean;
  login: () => Promise<void>;
  description: string;
}

async function loginCopilot(): Promise<void> {
  process.stdout.write(`\nStarting GitHub OAuth device flow...\n`);
  try {
    const codeResponse = await initiateGithubDeviceFlow(COPILOT_CLIENT_ID);
    process.stdout.write(
      `\n  1. Open: ${codeResponse.verification_uri}\n` +
        `  2. Enter: ${codeResponse.user_code}\n\n` +
        `Waiting for authorization...\n`,
    );
    const tokenResponse = await pollGithubDeviceToken(
      COPILOT_CLIENT_ID,
      codeResponse.device_code,
      codeResponse.interval,
    );

    await validateGithubToken(tokenResponse.access_token);

    const keychain = new KeychainService();
    keychain.set("diricode", "github-token", tokenResponse.access_token);

    const provider = new CopilotProvider(tokenResponse.access_token);
    const models = await provider.listModels();
    await provider.stop();
    if (models.length === 0) {
      throw new Error("Copilot API returned no models. Check your GitHub subscription.");
    }
    process.stdout.write(
      `\n✓ Logged in to GitHub Copilot | ${String(models.length)} models available\n`,
    );
  } catch (err) {
    if (err instanceof GithubOAuthError) {
      throw new Error(`OAuth failed: ${err.message}`, { cause: err });
    }
    throw err;
  }
}

async function loginKimi(): Promise<void> {
  const apiKey = await password({
    message: "Enter your Kimi API key:",
    mask: true,
  });

  if (!validateKimiApiKey(apiKey)) {
    throw new Error("Invalid Kimi API key format");
  }

  setKimiApiKeyInKeychain(apiKey);
  process.stdout.write(`\n✓ Kimi configured. API key saved to keychain.\n`);
}

export const LOGIN_PROVIDERS: LoginProvider[] = [
  {
    name: "copilot",
    authMethod: "oauth",
    envVars: ["GITHUB_TOKEN", "GH_TOKEN", "DC_GITHUB_TOKEN"],
    isLoggedIn: () => hasGithubAuth(),
    login: loginCopilot,
    description: "GitHub Copilot via OAuth",
  },
  {
    name: "kimi",
    authMethod: "api_key",
    envVars: ["DC_KIMI_API_KEY"],
    isLoggedIn: () => hasKimiAuth(),
    login: loginKimi,
    description: "Moonshot Kimi via API key",
  },
  {
    name: "gemini",
    authMethod: "api_key",
    envVars: ["GEMINI_API_KEY"],
    isLoggedIn: () => Boolean(process.env.GEMINI_API_KEY?.trim()),
    login: async () => {
      const _apiKey = await password({ message: "Enter your Gemini API key:", mask: true });
      process.stdout.write(`\nSet GEMINI_API_KEY environment variable to use Gemini.\n`);
      process.stdout.write(`Note: Gemini API key is stored in environment only.\n`);
    },
    description: "Google Gemini via API key",
  },
  {
    name: "zai",
    authMethod: "api_key",
    envVars: ["DC_ZAI_API_KEY"],
    isLoggedIn: () => Boolean(process.env.DC_ZAI_API_KEY?.trim()),
    login: async () => {
      const _apiKey = await password({ message: "Enter your Z.ai API key:", mask: true });
      process.stdout.write(`\nSet DC_ZAI_API_KEY environment variable to use Z.ai.\n`);
    },
    description: "Z.ai GLM via API key",
  },
  {
    name: "minimax",
    authMethod: "api_key",
    envVars: ["DC_MINIMAX_API_KEY"],
    isLoggedIn: () => Boolean(process.env.DC_MINIMAX_API_KEY?.trim()),
    login: async () => {
      const _apiKey = await password({ message: "Enter your MiniMax API key:", mask: true });
      process.stdout.write(`\nSet DC_MINIMAX_API_KEY environment variable to use MiniMax.\n`);
    },
    description: "MiniMax via API key",
  },
];

export function getLoginProvider(name: string): LoginProvider | undefined {
  return LOGIN_PROVIDERS.find((p) => p.name === name);
}
