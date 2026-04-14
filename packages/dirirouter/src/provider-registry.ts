import type { Provider } from "./types.js";
import type { ProviderDiscoveryResult } from "./provider-discovery.js";
import { GeminiProvider } from "./providers/gemini.js";
import { ZaiProvider } from "./providers/zai.js";
import { MinimaxProvider } from "./providers/minimax.js";
import { KimiProvider } from "./providers/kimi.js";
import { CopilotProvider } from "./copilot/adapter.js";
import { getGithubToken } from "./copilot/auth.js";

export interface ProviderDefinition {
  readonly name: string;
  readonly envVar: string;
  readonly create: () => Provider | null;
  readonly priority: number;
}

const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    name: "gemini",
    envVar: "GEMINI_API_KEY",
    priority: 1,
    create: () => {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) return null;
      try {
        return new GeminiProvider(apiKey);
      } catch {
        return null;
      }
    },
  },
  {
    name: "kimi",
    envVar: "DC_KIMI_API_KEY",
    priority: 2,
    create: () => {
      const apiKey = process.env.DC_KIMI_API_KEY?.trim();
      if (!apiKey) return null;
      try {
        return new KimiProvider({ apiKey });
      } catch {
        return null;
      }
    },
  },
  {
    name: "zai",
    envVar: "DC_ZAI_API_KEY",
    priority: 1,
    create: () => {
      const apiKey = process.env.DC_ZAI_API_KEY?.trim();
      if (!apiKey) return null;
      try {
        return new ZaiProvider(apiKey);
      } catch {
        return null;
      }
    },
  },
  {
    name: "minimax",
    envVar: "DC_MINIMAX_API_KEY",
    priority: 3,
    create: () => {
      const apiKey = process.env.DC_MINIMAX_API_KEY?.trim();
      if (!apiKey) return null;
      try {
        return new MinimaxProvider(apiKey);
      } catch {
        return null;
      }
    },
  },
  {
    name: "copilot",
    envVar: "GITHUB_TOKEN",
    priority: 1,
    create: () => {
      const token = getGithubToken();
      if (!token) return null;
      try {
        return new CopilotProvider(token);
      } catch {
        return null;
      }
    },
  },
];

export function getProviderDefinitions(): readonly ProviderDefinition[] {
  return PROVIDER_DEFINITIONS;
}

export type ProviderDiscoveryEntry = ProviderDiscoveryResult & {
  readonly priority: number;
};

export async function discoverAllProviders(): Promise<ProviderDiscoveryEntry[]> {
  const results: ProviderDiscoveryEntry[] = [];

  for (const def of PROVIDER_DEFINITIONS) {
    const provider = def.create();

    if (!provider) {
      results.push({
        provider: { name: def.name } as Provider,
        availabilities: [],
        status: {
          name: def.name,
          available: false,
          error: `${def.envVar} is not set`,
          envVar: def.envVar,
          modelCount: 0,
          modelNames: [],
        },
        priority: def.priority,
      });
      continue;
    }

    const { isDiscoverableProvider } = await import("./provider-discovery.js");

    if (isDiscoverableProvider(provider)) {
      try {
        const result = await provider.discoverAvailability();
        results.push({ ...result, priority: def.priority });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          provider,
          availabilities: [],
          status: {
            name: def.name,
            available: false,
            error: message,
            envVar: def.envVar,
            modelCount: 0,
            modelNames: [],
          },
          priority: def.priority,
        });
      }
    } else {
      const availabilities = provider.getModelAvailability();
      results.push({
        provider,
        availabilities,
        status: {
          name: def.name,
          available: provider.isAvailable(),
          envVar: def.envVar,
          modelCount: availabilities.length,
          modelNames: availabilities.map((a) => a.model_id),
        },
        priority: def.priority,
      });
    }
  }

  return results;
}
