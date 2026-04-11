import { Registry } from "../registry.js";
import { ModelCardRegistry } from "../picker/model-card-registry.js";
import { SubscriptionRegistry } from "../picker/subscription-registry.js";
import { CascadeModelResolver } from "../llm-picker/model-resolver.js";
import { DiriRouter } from "../diri-router.js";
import { GeminiProvider } from "../providers/gemini.js";
import { ZaiProvider } from "../providers/zai.js";
import { MinimaxProvider } from "../providers/minimax.js";
import { ProviderPriorities } from "../types.js";
import type { Provider } from "../types.js";
import { getGithubToken } from "../copilot/auth.js";

export interface ProviderStatus {
  readonly name: string;
  readonly available: boolean;
  readonly error?: string;
  readonly envVar: string;
  readonly modelCount: number;
  readonly modelNames: readonly string[];
}

export interface BootstrapResult {
  readonly startTime: number;
  readonly diriRouter: DiriRouter;
  readonly registry: Registry;
  readonly modelCardRegistry: ModelCardRegistry;
  readonly subscriptionRegistry: SubscriptionRegistry;
  readonly providerStatuses: readonly ProviderStatus[];
}

function registerProviderCards(provider: Provider, mcr: ModelCardRegistry): void {
  for (const card of provider.getModelCards()) {
    if (!mcr.has(card.model)) {
      mcr.register(card);
    }
  }
}

export async function bootstrapPlayground(): Promise<BootstrapResult> {
  const startTime = Date.now();
  const modelCardRegistry = new ModelCardRegistry();
  const subscriptionRegistry = new SubscriptionRegistry(modelCardRegistry);
  const registry = new Registry();

  const resolver = new CascadeModelResolver(undefined, {
    modelCardRegistry,
    subscriptionRegistry,
  });
  const providerStatuses: ProviderStatus[] = [];

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  try {
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
    const provider = new GeminiProvider({ apiKey: geminiApiKey });
    registerProviderCards(provider, modelCardRegistry);
    registry.register(provider, ProviderPriorities.GEMINI);
    const cards = provider.getModelCards();
    providerStatuses.push({
      name: "gemini",
      available: true,
      envVar: "GEMINI_API_KEY",
      modelCount: cards.length,
      modelNames: cards.map((c) => c.model),
    });
  } catch (err) {
    providerStatuses.push({
      name: "gemini",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "GEMINI_API_KEY",
      modelCount: 0,
      modelNames: [],
    });
  }

  const kimiApiKey = process.env.DC_KIMI_API_KEY?.trim() ?? "";
  try {
    if (!kimiApiKey) throw new Error("DC_KIMI_API_KEY is not set");
    const { KimiProvider } = await import("../providers/kimi.js");
    const provider = new KimiProvider({ apiKey: kimiApiKey });
    registerProviderCards(provider, modelCardRegistry);
    registry.register(provider, ProviderPriorities.KIMI);
    const cards = provider.getModelCards();
    providerStatuses.push({
      name: "kimi",
      available: true,
      envVar: "DC_KIMI_API_KEY",
      modelCount: cards.length,
      modelNames: cards.map((c) => c.model),
    });
  } catch (err) {
    providerStatuses.push({
      name: "kimi",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "DC_KIMI_API_KEY",
      modelCount: 0,
      modelNames: [],
    });
  }

  const zaiApiKey = process.env.DC_ZAI_API_KEY?.trim() ?? "";
  try {
    if (!zaiApiKey) throw new Error("DC_ZAI_API_KEY is not set");
    const provider = new ZaiProvider({ apiKey: zaiApiKey });
    registerProviderCards(provider, modelCardRegistry);
    registry.register(provider, ProviderPriorities.ZAI);
    const cards = provider.getModelCards();
    providerStatuses.push({
      name: "zai",
      available: true,
      envVar: "DC_ZAI_API_KEY",
      modelCount: cards.length,
      modelNames: cards.map((c) => c.model),
    });
  } catch (err) {
    providerStatuses.push({
      name: "zai",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "DC_ZAI_API_KEY",
      modelCount: 0,
      modelNames: [],
    });
  }

  const minimaxApiKey = process.env.DC_MINIMAX_API_KEY?.trim() ?? "";
  try {
    if (!minimaxApiKey) throw new Error("DC_MINIMAX_API_KEY is not set");
    const provider = new MinimaxProvider({ apiKey: minimaxApiKey });
    registerProviderCards(provider, modelCardRegistry);
    registry.register(provider, ProviderPriorities.MINIMAX);
    const cards = provider.getModelCards();
    providerStatuses.push({
      name: "minimax",
      available: true,
      envVar: "DC_MINIMAX_API_KEY",
      modelCount: cards.length,
      modelNames: cards.map((c) => c.model),
    });
  } catch (err) {
    providerStatuses.push({
      name: "minimax",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "DC_MINIMAX_API_KEY",
      modelCount: 0,
      modelNames: [],
    });
  }

  const copilotToken = getGithubToken() ?? "";
  try {
    const { CopilotProvider } = await import("../copilot/adapter.js");
    const provider = new CopilotProvider(copilotToken);
    registerProviderCards(provider, modelCardRegistry);

    if (copilotToken) {
      registry.register(provider, ProviderPriorities.COPILOT);

      const models = await provider.listModels();
      if (models.length > 0) {
        for (const model of models) {
          if (!modelCardRegistry.has(model.id)) continue;
          subscriptionRegistry.register({
            id: `copilot-${model.id}`,
            provider: "copilot",
            model: model.id,
            context_window: 200_000,
            rate_limit: { requests_per_hour: 500, remaining: 500 },
            trusted: true,
            available: true,
            cost_per_1k_input: 0,
            cost_per_1k_output: 0,
          });
        }
        providerStatuses.push({
          name: "copilot",
          available: true,
          envVar: "GITHUB_TOKEN",
          modelCount: models.length,
          modelNames: models.map((m) => m.id),
        });
      } else {
        providerStatuses.push({
          name: "copilot",
          available: false,
          error: "API error. Check token or run 'diricode login copilot' to re-authenticate.",
          envVar: "GITHUB_TOKEN",
          modelCount: 0,
          modelNames: [],
        });
      }
      await provider.stop();
    } else {
      registry.register(provider, ProviderPriorities.COPILOT);
      providerStatuses.push({
        name: "copilot",
        available: false,
        error: "No token. Run 'diricode login copilot' to authenticate.",
        envVar: "GITHUB_TOKEN",
        modelCount: 0,
        modelNames: [],
      });
    }
  } catch (err) {
    providerStatuses.push({
      name: "copilot",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "GITHUB_TOKEN",
      modelCount: 0,
      modelNames: [],
    });
  }

  const diriRouter = new DiriRouter({
    registry,
    cascadeResolver: resolver,
  });

  return {
    startTime,
    diriRouter,
    registry,
    modelCardRegistry,
    subscriptionRegistry,
    providerStatuses,
  };
}
