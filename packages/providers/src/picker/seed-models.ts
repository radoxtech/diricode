import type { ModelCard } from "./model-card.js";
import type { PickerSubscription } from "./subscription.js";
import type { ModelCardRegistry } from "./model-card-registry.js";
import type { SubscriptionRegistry } from "./subscription-registry.js";

// ---------------------------------------------------------------------------
// Empty benchmarks helper
// ---------------------------------------------------------------------------

function emptyBenchmarks(): ModelCard["benchmarks"] {
  return {
    quality: {
      by_complexity_role: {},
      by_specialization: {},
    },
    speed: {
      tokens_per_second_avg: 0,
      feedback_count: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Seed model cards
// ---------------------------------------------------------------------------

const SEED_MODEL_CARDS: ModelCard[] = [
  {
    model: "gemini-2.5-flash",
    family: "gemini",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: null,
    },
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate"],
      specializations: ["frontend", "backend", "fullstack"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "gemini-2.5-pro",
    family: "gemini",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: null,
    },
    known_for: {
      roles: ["coder", "researcher", "architect"],
      complexities: ["moderate", "complex"],
      specializations: ["backend", "fullstack", "planning"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "gpt-4.1",
    family: "gpt",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: null,
    },
    known_for: {
      roles: ["coder", "architect", "reviewer"],
      complexities: ["moderate", "complex"],
      specializations: ["backend", "fullstack"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "gpt-4.1-mini",
    family: "gpt",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: null,
    },
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate"],
      specializations: ["frontend", "fullstack"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "gpt-4.1-nano",
    family: "gpt",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: null,
    },
    known_for: {
      roles: ["coder"],
      complexities: ["simple"],
      specializations: ["frontend"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "claude-sonnet-4",
    family: "claude",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: true,
      max_context: null,
    },
    known_for: {
      roles: ["coder", "architect", "reviewer"],
      complexities: ["moderate", "complex"],
      specializations: ["backend", "fullstack", "planning"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "o3",
    family: "o-series",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: null,
    },
    known_for: {
      roles: ["architect", "researcher"],
      complexities: ["complex"],
      specializations: ["planning", "backend"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "o4-mini",
    family: "o-series",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: null,
    },
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate"],
      specializations: ["backend", "fullstack"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "kimi-k2",
    family: "kimi",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 128000,
    },
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate"],
      specializations: ["backend", "fullstack"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "deepseek-v3",
    family: "deepseek",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 64000,
    },
    known_for: {
      roles: ["coder", "researcher"],
      complexities: ["simple", "moderate"],
      specializations: ["backend", "fullstack"],
    },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
];

// ---------------------------------------------------------------------------
// Seed subscriptions
// ---------------------------------------------------------------------------

const SEED_SUBSCRIPTIONS: PickerSubscription[] = [
  {
    id: "copilot-gemini-flash",
    provider: "copilot",
    model: "gemini-2.5-flash",
    context_window: 1_000_000,
    rate_limit: { requests_per_hour: 1000, remaining: 1000 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  },
  {
    id: "google-api-gemini-flash",
    provider: "google",
    model: "gemini-2.5-flash",
    context_window: 1_000_000,
    rate_limit: { requests_per_hour: 2000, remaining: 2000 },
    trusted: false,
    available: true,
    cost_per_1k_input: 0.075,
    cost_per_1k_output: 0.3,
  },
  {
    id: "google-api-gemini-pro",
    provider: "google",
    model: "gemini-2.5-pro",
    context_window: 1_000_000,
    rate_limit: { requests_per_hour: 1000, remaining: 1000 },
    trusted: false,
    available: true,
    cost_per_1k_input: 1.25,
    cost_per_1k_output: 5.0,
  },
  {
    id: "copilot-gpt-4.1",
    provider: "copilot",
    model: "gpt-4.1",
    context_window: 128000,
    rate_limit: { requests_per_hour: 500, remaining: 500 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  },
  {
    id: "copilot-gpt-4.1-mini",
    provider: "copilot",
    model: "gpt-4.1-mini",
    context_window: 128000,
    rate_limit: { requests_per_hour: 2000, remaining: 2000 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  },
  {
    id: "copilot-gpt-4.1-nano",
    provider: "copilot",
    model: "gpt-4.1-nano",
    context_window: 32000,
    rate_limit: { requests_per_hour: 5000, remaining: 5000 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  },
  {
    id: "copilot-claude-sonnet-4",
    provider: "copilot",
    model: "claude-sonnet-4",
    context_window: 200000,
    rate_limit: { requests_per_hour: 500, remaining: 500 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  },
  {
    id: "copilot-o3",
    provider: "copilot",
    model: "o3",
    context_window: 200000,
    rate_limit: { requests_per_hour: 200, remaining: 200 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  },
  {
    id: "copilot-o4-mini",
    provider: "copilot",
    model: "o4-mini",
    context_window: 200000,
    rate_limit: { requests_per_hour: 2000, remaining: 2000 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
  },
  {
    id: "moonshot-kimi-k2",
    provider: "moonshot",
    model: "kimi-k2",
    context_window: 128000,
    rate_limit: { requests_per_hour: 1000, remaining: 1000 },
    trusted: false,
    available: true,
    cost_per_1k_input: 0.14,
    cost_per_1k_output: 0.14,
  },
  {
    id: "deepseek-api-v3",
    provider: "deepseek",
    model: "deepseek-v3",
    context_window: 64000,
    rate_limit: { requests_per_hour: 2000, remaining: 2000 },
    trusted: false,
    available: true,
    cost_per_1k_input: 0.014,
    cost_per_1k_output: 0.028,
  },
];

// ---------------------------------------------------------------------------
// Public seed API
// ---------------------------------------------------------------------------

export function getSeedModelCards(): ModelCard[] {
  return SEED_MODEL_CARDS.map((card) => ({ ...card }));
}

export function getSeedSubscriptions(): PickerSubscription[] {
  return SEED_SUBSCRIPTIONS.map((sub) => ({ ...sub }));
}

export function seedAllRegistries(
  cardRegistry: ModelCardRegistry,
  subRegistry: SubscriptionRegistry,
): void {
  for (const card of SEED_MODEL_CARDS) {
    cardRegistry.register({ ...card });
  }
  for (const sub of SEED_SUBSCRIPTIONS) {
    subRegistry.register({ ...sub });
  }
}
