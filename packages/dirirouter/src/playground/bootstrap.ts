import { Registry } from "../registry.js";
import { SubscriptionRegistry } from "../llm-picker/subscription-registry.js";
import { CascadeModelResolver } from "../llm-picker/model-resolver.js";
import { DiriRouter } from "../diri-router.js";
import { GeminiProvider } from "../providers/gemini.js";
import { ZaiProvider } from "../providers/zai.js";
import { MinimaxProvider } from "../providers/minimax.js";
import { ProviderPriorities } from "../types.js";
import type { Provider } from "../types.js";
import { getGithubToken } from "../copilot/auth.js";
import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";
import { normalizeModelFamily } from "../families/normalization.js";

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
  readonly subscriptionRegistry: SubscriptionRegistry;
  readonly providerStatuses: readonly ProviderStatus[];
}

function registerProviderAvailabilities(provider: Provider, registry: SubscriptionRegistry): void {
  for (const availability of provider.getModelAvailability()) {
    const key = availability.id ?? availability.model_id;
    if (!registry.has(key)) {
      registry.register(availability);
    }
  }
}

export function buildCopilotAvailability(model: {
  id: string;
  capabilities?: unknown;
}): ProviderModelAvailability {
  const normalized = normalizeModelFamily(model.id);
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
    id: `copilot-${model.id}`,
    provider: "copilot",
    model_id: model.id,
    family: normalized.family,
    stability: normalized.stability,
    available: true,
    context_window: 200_000,
    supports_tool_calling: toolCalling,
    supports_vision: vision,
    supports_structured_output: true,
    supports_streaming: streaming,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    trusted: true,
  };
}

export async function bootstrapPlayground(): Promise<BootstrapResult> {
  const startTime = Date.now();
  const subscriptionRegistry = new SubscriptionRegistry();
  const registry = new Registry();

  const providerStatuses: ProviderStatus[] = [];
  const allAvailabilities: ProviderModelAvailability[] = [];

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  try {
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
    const provider = new GeminiProvider({ apiKey: geminiApiKey });
    registerProviderAvailabilities(provider, subscriptionRegistry);
    registry.register(provider, ProviderPriorities.GEMINI);
    const availabilities = provider.getModelAvailability();
    allAvailabilities.push(...availabilities);
    providerStatuses.push({
      name: "gemini",
      available: true,
      envVar: "GEMINI_API_KEY",
      modelCount: availabilities.length,
      modelNames: availabilities.map((a) => a.model_id),
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
    registerProviderAvailabilities(provider, subscriptionRegistry);
    registry.register(provider, ProviderPriorities.KIMI);
    const availabilities = provider.getModelAvailability();
    allAvailabilities.push(...availabilities);
    providerStatuses.push({
      name: "kimi",
      available: true,
      envVar: "DC_KIMI_API_KEY",
      modelCount: availabilities.length,
      modelNames: availabilities.map((a) => a.model_id),
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
    registerProviderAvailabilities(provider, subscriptionRegistry);
    registry.register(provider, ProviderPriorities.ZAI);
    const availabilities = provider.getModelAvailability();
    allAvailabilities.push(...availabilities);
    providerStatuses.push({
      name: "zai",
      available: true,
      envVar: "DC_ZAI_API_KEY",
      modelCount: availabilities.length,
      modelNames: availabilities.map((a) => a.model_id),
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
    registerProviderAvailabilities(provider, subscriptionRegistry);
    registry.register(provider, ProviderPriorities.MINIMAX);
    const availabilities = provider.getModelAvailability();
    allAvailabilities.push(...availabilities);
    providerStatuses.push({
      name: "minimax",
      available: true,
      envVar: "DC_MINIMAX_API_KEY",
      modelCount: availabilities.length,
      modelNames: availabilities.map((a) => a.model_id),
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

    if (copilotToken) {
      registry.register(provider, ProviderPriorities.COPILOT);

      const models = await provider.listModels();
      if (models.length > 0) {
        for (const model of models) {
          const availability = buildCopilotAvailability(model);
          const key = availability.id ?? availability.model_id;
          if (!subscriptionRegistry.has(key)) {
            subscriptionRegistry.register(availability);
          }
          allAvailabilities.push(availability);
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

  const resolver = new CascadeModelResolver(undefined, {
    providerAvailabilities: allAvailabilities,
  });

  const diriRouter = new DiriRouter({
    registry,
    cascadeResolver: resolver,
  });

  return {
    startTime,
    diriRouter,
    registry,
    subscriptionRegistry,
    providerStatuses,
  };
}
