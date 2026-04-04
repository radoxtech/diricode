import { Registry } from "../registry.js";
import { ModelCardRegistry } from "../picker/model-card-registry.js";
import { SubscriptionRegistry } from "../picker/subscription-registry.js";
import { seedAllRegistries } from "../picker/seed-models.js";
import { CascadeModelResolver } from "../picker/llm-picker/model-resolver.js";
import { DiriRouter } from "../diri-router.js";
import { GeminiProvider } from "../providers/gemini.js";
import { ZaiProvider } from "../providers/zai.js";
import { MinimaxProvider } from "../providers/minimax.js";
import { ProviderPriorities } from "../types.js";

export interface ProviderStatus {
  readonly name: string;
  readonly available: boolean;
  readonly error?: string;
  readonly envVar: string;
}

export interface BootstrapResult {
  readonly diriRouter: DiriRouter;
  readonly registry: Registry;
  readonly modelCardRegistry: ModelCardRegistry;
  readonly subscriptionRegistry: SubscriptionRegistry;
  readonly providerStatuses: readonly ProviderStatus[];
}

export async function bootstrapPlayground(): Promise<BootstrapResult> {
  const modelCardRegistry = new ModelCardRegistry();
  const subscriptionRegistry = new SubscriptionRegistry(modelCardRegistry);
  const registry = new Registry();

  seedAllRegistries(modelCardRegistry, subscriptionRegistry);

  const resolver = new CascadeModelResolver();
  const providerStatuses: ProviderStatus[] = [];

  const geminiApiKey = process.env["GEMINI_API_KEY"]?.trim() ?? "";
  try {
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
    const provider = new GeminiProvider({ apiKey: geminiApiKey });
    registry.register(provider, ProviderPriorities.GEMINI);
    providerStatuses.push({ name: "gemini", available: true, envVar: "GEMINI_API_KEY" });
  } catch (err) {
    providerStatuses.push({
      name: "gemini",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "GEMINI_API_KEY",
    });
  }

  // Dynamic import required: KimiProvider → kimi/auth.ts has top-level
  // `import { Entry } from "@napi-rs/keyring"` which must not load at startup.
  const kimiApiKey = process.env["DC_KIMI_API_KEY"]?.trim() ?? "";
  try {
    if (!kimiApiKey) throw new Error("DC_KIMI_API_KEY is not set");
    const { KimiProvider } = await import("../providers/kimi.js");
    const provider = new KimiProvider({ apiKey: kimiApiKey });
    registry.register(provider, ProviderPriorities.KIMI);
    providerStatuses.push({ name: "kimi", available: true, envVar: "DC_KIMI_API_KEY" });
  } catch (err) {
    providerStatuses.push({
      name: "kimi",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "DC_KIMI_API_KEY",
    });
  }

  const zaiApiKey = process.env["DC_ZAI_API_KEY"]?.trim() ?? "";
  try {
    if (!zaiApiKey) throw new Error("DC_ZAI_API_KEY is not set");
    const provider = new ZaiProvider({ apiKey: zaiApiKey });
    registry.register(provider, ProviderPriorities.ZAI);
    providerStatuses.push({ name: "zai", available: true, envVar: "DC_ZAI_API_KEY" });
  } catch (err) {
    providerStatuses.push({
      name: "zai",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "DC_ZAI_API_KEY",
    });
  }

  const minimaxApiKey = process.env["DC_MINIMAX_API_KEY"]?.trim() ?? "";
  try {
    if (!minimaxApiKey) throw new Error("DC_MINIMAX_API_KEY is not set");
    const provider = new MinimaxProvider({ apiKey: minimaxApiKey });
    registry.register(provider, ProviderPriorities.MINIMAX);
    providerStatuses.push({ name: "minimax", available: true, envVar: "DC_MINIMAX_API_KEY" });
  } catch (err) {
    providerStatuses.push({
      name: "minimax",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "DC_MINIMAX_API_KEY",
    });
  }

  // Dynamic import required: CopilotProvider → copilot/keychain.ts has top-level
  // `import { Entry, findCredentials } from "@napi-rs/keyring"` which must not load at startup.
  // Env var only — no keychain lookup, no OAuth device flow.
  const copilotToken =
    (
      process.env["GITHUB_TOKEN"] ??
      process.env["GH_TOKEN"] ??
      process.env["DC_GITHUB_TOKEN"]
    )?.trim() ?? "";
  try {
    if (!copilotToken) {
      throw new Error("No GitHub token found. Set GITHUB_TOKEN, GH_TOKEN, or DC_GITHUB_TOKEN");
    }
    const { CopilotProvider } = await import("../copilot/adapter.js");
    const provider = new CopilotProvider(copilotToken);
    registry.register(provider, ProviderPriorities.COPILOT);
    providerStatuses.push({ name: "copilot", available: true, envVar: "GITHUB_TOKEN" });
  } catch (err) {
    providerStatuses.push({
      name: "copilot",
      available: false,
      error: err instanceof Error ? err.message : String(err),
      envVar: "GITHUB_TOKEN",
    });
  }

  const diriRouter = new DiriRouter({
    registry,
    cascadeResolver: resolver,
  });

  return {
    diriRouter,
    registry,
    modelCardRegistry,
    subscriptionRegistry,
    providerStatuses,
  };
}
