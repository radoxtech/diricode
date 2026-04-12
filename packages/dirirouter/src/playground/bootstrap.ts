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
import type { ModelCard } from "../contracts/model-card.js";

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

function inferCopilotPricingTier(modelId: string): ModelCard["pricing_tier"] {
  const normalized = modelId.toLowerCase();

  if (
    normalized.includes("opus") ||
    normalized.includes("gpt-5") ||
    normalized === "o1" ||
    normalized.startsWith("o1-")
  ) {
    return "premium";
  }

  if (normalized.includes("mini") || normalized.includes("flash") || normalized.includes("haiku")) {
    return "budget";
  }

  return "standard";
}

function inferCopilotReasoningLevels(modelId: string): ModelCard["reasoning_levels"] {
  const normalized = modelId.toLowerCase();

  if (normalized.includes("gpt-5") || normalized === "o1" || normalized.startsWith("o1-")) {
    return ["low", "medium", "high", "xhigh"];
  }

  if (normalized.includes("mini") || normalized.includes("flash") || normalized.includes("haiku")) {
    return ["low", "medium"];
  }

  return ["low", "medium", "high"];
}

function inferCopilotFamily(modelId: string): string {
  const normalized = modelId.toLowerCase();

  if (normalized.includes("claude")) return "claude";
  if (normalized.includes("gemini")) return "gemini";
  if (normalized.startsWith("gpt") || normalized.startsWith("o1") || normalized.startsWith("o3")) {
    return "openai";
  }

  return normalized.split(/[-_]/)[0] || "copilot";
}

export function buildCopilotModelCard(
  model: { id: string; capabilities?: unknown },
  existingCards: readonly ModelCard[],
): ModelCard {
  const existingCard = existingCards.find((card) => card.model === model.id);
  if (existingCard) {
    return existingCard;
  }

  const capabilities =
    typeof model.capabilities === "object" && model.capabilities !== null
      ? (model.capabilities as Record<string, unknown>)
      : undefined;

  const toolCalling =
    typeof capabilities?.tool_calls === "boolean"
      ? capabilities.tool_calls
      : typeof capabilities?.tool_calling === "boolean"
        ? capabilities.tool_calling
        : true;

  const streaming = typeof capabilities?.streaming === "boolean" ? capabilities.streaming : true;
  const vision = typeof capabilities?.vision === "boolean" ? capabilities.vision : false;

  return {
    model: model.id,
    family: inferCopilotFamily(model.id),
    capabilities: {
      tool_calling: toolCalling,
      streaming,
      json_mode: true,
      vision,
      max_context: 200_000,
    },
    reasoning_levels: inferCopilotReasoningLevels(model.id),
    known_for: {
      roles: ["coder", "reviewer", "architect", "researcher", "orchestrator"],
      complexities: ["simple", "moderate", "complex"],
      specializations: [],
    },
    benchmarks: {
      quality: { by_complexity_role: {}, by_specialization: {} },
      speed: { tokens_per_second_avg: 0, feedback_count: 0 },
    },
    pricing_tier: inferCopilotPricingTier(model.id),
    learned_from: 0,
  };
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
    const copilotStaticCards = provider.getModelCards();

    if (copilotToken) {
      registry.register(provider, ProviderPriorities.COPILOT);

      const models = await provider.listModels();
      if (models.length > 0) {
        for (const model of models) {
          const card = buildCopilotModelCard(model, copilotStaticCards);
          if (!modelCardRegistry.has(card.model)) {
            modelCardRegistry.register(card);
          }
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
