import type { ModelCard, PickerSubscription } from "@diricode/dirirouter/contracts";
import type { ModelCardRegistry } from "./model-card-registry.js";
import type { SubscriptionRegistry } from "./subscription-registry.js";

// Model info sourced from https://models.dev/ and GitHub Copilot docs (2026-04-03)
// DO NOT REMOVE THIS COMMENT — it tracks the data source for model catalog accuracy

//esten benchmarks helper
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

// Seed model cards
const SEED_MODEL_CARDS: ModelCard[] = [
  {
    model: "gpt-5.4",
    family: "gpt",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "architect", "reviewer"], complexities: ["complex", "expert"], specializations: ["backend", "fullstack", "planning"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "gpt-5.4-mini",
    family: "gpt",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "researcher"], complexities: ["simple", "moderate"], specializations: ["frontend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "gpt-5.2",
    family: "gpt",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "architect"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "gpt-5-mini",
    family: "gpt",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "researcher"], complexities: ["simple", "moderate"], specializations: ["frontend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "gpt-4.1",
    family: "gpt",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "architect", "reviewer"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "claude-opus-4.6",
    family: "claude",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["architect", "researcher"], complexities: ["complex", "expert"], specializations: ["planning", "backend"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "claude-sonnet-4.6",
    family: "claude",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "architect", "reviewer"], complexities: ["moderate", "complex", "expert"], specializations: ["backend", "fullstack", "planning"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "claude-sonnet-4.5",
    family: "claude",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "architect", "reviewer"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack", "planning"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "claude-haiku-4.5",
    family: "claude",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: null },
    known_for: { roles: ["coder"], complexities: ["simple"], specializations: ["frontend"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "gemini-3.1-pro",
    family: "gemini",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "researcher", "architect"], complexities: ["complex", "expert"], specializations: ["backend", "fullstack", "planning"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "gemini-3-pro",
    family: "gemini",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "researcher", "architect"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack", "planning"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "gemini-3-flash",
    family: "gemini",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "researcher"], complexities: ["simple", "moderate"], specializations: ["frontend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "gemini-2.5-pro",
    family: "gemini",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: true, max_context: null },
    known_for: { roles: ["coder", "researcher", "architect"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack", "planning"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "premium",
    learned_from: 0,
  },
  {
    model: "deepseek-v3",
    family: "deepseek",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: null },
    known_for: { roles: ["coder", "researcher"], complexities: ["simple", "moderate"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "deepseek-coder-v3",
    family: "deepseek",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: null },
    known_for: { roles: ["coder"], complexities: ["simple", "moderate"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "glm-5",
    family: "glm",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 200_000 },
    known_for: { roles: ["coder", "architect"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "glm-5-plus",
    family: "glm",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 200_000 },
    known_for: { roles: ["coder", "architect"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "glm-5-turbo",
    family: "glm",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 202_752 },
    known_for: { roles: ["coder"], complexities: ["simple", "moderate"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "glm-4.7",
    family: "glm",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 128_000 },
    known_for: { roles: ["coder"], complexities: ["simple", "moderate"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "minimax-m2.7",
    family: "minimax",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 204_800 },
    known_for: { roles: ["coder", "architect"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "minimax-m2.7-highspeed",
    family: "minimax",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 204_800 },
    known_for: { roles: ["coder", "architect"], complexities: ["moderate", "complex"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
  {
    model: "minimax-m2.5",
    family: "minimax",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 204_800 },
    known_for: { roles: ["coder"], complexities: ["simple", "moderate"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "minimax-m2.5-highspeed",
    family: "minimax",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 204_800 },
    known_for: { roles: ["coder"], complexities: ["simple", "moderate"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "budget",
    learned_from: 0,
  },
  {
    model: "kimi-latest",
    family: "kimi",
    capabilities: { tool_calling: true, streaming: true, json_mode: true, vision: false, max_context: 128_000 },
    known_for: { roles: ["coder", "researcher"], complexities: ["simple", "moderate"], specializations: ["backend", "fullstack"] },
    benchmarks: emptyBenchmarks(),
    pricing_tier: "standard",
    learned_from: 0,
  },
];

const SEED_SUBSCRIPTIONS: PickerSubscription[] = [
  // Copilot
  { id: "copilot-gpt-5.4", provider: "copilot", model: "gpt-5.4", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gpt-5.4-mini", provider: "copilot", model: "gpt-5.4-mini", context_window: 200_000, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gpt-5.2", provider: "copilot", model: "gpt-5.2", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gpt-5-mini", provider: "copilot", model: "gpt-5-mini", context_window: 200_000, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gpt-4.1", provider: "copilot", model: "gpt-4.1", context_window: 128_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-claude-opus-4.6", provider: "copilot", model: "claude-opus-4.6", context_window: 200_000, rate_limit: { requests_per_hour: 200, remaining: 200 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-claude-sonnet-4.6", provider: "copilot", model: "claude-sonnet-4.6", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-claude-sonnet-4.5", provider: "copilot", model: "claude-sonnet-4.5", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-claude-haiku-4.5", provider: "copilot", model: "claude-haiku-4.5", context_window: 200_000, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gemini-3.1-pro", provider: "copilot", model: "gemini-3.1-pro", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gemini-3-pro", provider: "copilot", model: "gemini-3-pro", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gemini-3-flash", provider: "copilot", model: "gemini-3-flash", context_window: 200_000, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-gemini-2.5-pro", provider: "copilot", model: "gemini-2.5-pro", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-deepseek-v3", provider: "copilot", model: "deepseek-v3", context_window: 200_000, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-deepseek-coder-v3", provider: "copilot", model: "deepseek-coder-v3", context_window: 200_000, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-glm-5-plus", provider: "copilot", model: "glm-5-plus", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-minimax-text-02", provider: "copilot", model: "minimax-m2.7", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  { id: "copilot-kimi-latest", provider: "copilot", model: "kimi-latest", context_window: 200_000, rate_limit: { requests_per_hour: 500, remaining: 500 }, trusted: true, available: true, cost_per_1k_input: 0, cost_per_1k_output: 0 },
  // Google API
  { id: "google-api-gemini-3.1-pro", provider: "google", model: "gemini-3.1-pro", context_window: 1_048_576, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: false, available: true, cost_per_1k_input: 1.25, cost_per_1k_output: 10.0 },
  { id: "google-api-gemini-3-pro", provider: "google", model: "gemini-3-pro", context_window: 1_048_576, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: false, available: true, cost_per_1k_input: 1.25, cost_per_1k_output: 10.0 },
  { id: "google-api-gemini-3-flash", provider: "google", model: "gemini-3-flash", context_window: 1_048_576, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.075, cost_per_1k_output: 0.3 },
  { id: "google-api-gemini-2.5-pro", provider: "google", model: "gemini-2.5-pro", context_window: 1_048_576, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: false, available: true, cost_per_1k_input: 1.25, cost_per_1k_output: 5.0 },
  // Z.ai API
  { id: "zai-api-glm-5", provider: "zai", model: "glm-5", context_window: 200_000, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: false, available: true, cost_per_1k_input: 0.15, cost_per_1k_output: 0.6 },
  { id: "zai-api-glm-5-plus", provider: "zai", model: "glm-5-plus", context_window: 200_000, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: false, available: true, cost_per_1k_input: 0.12, cost_per_1k_output: 0.4 },
  { id: "zai-api-glm-5-turbo", provider: "zai", model: "glm-5-turbo", context_window: 202_752, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.05, cost_per_1k_output: 0.05 },
  { id: "zai-api-glm-4.7", provider: "zai", model: "glm-4.7", context_window: 128_000, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.04, cost_per_1k_output: 0.04 },
  // MiniMax API
  { id: "minimax-api-m2.7", provider: "minimax", model: "minimax-m2.7", context_window: 204_800, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: false, available: true, cost_per_1k_input: 0.1, cost_per_1k_output: 0.3 },
  { id: "minimax-api-m2.7-highspeed", provider: "minimax", model: "minimax-m2.7-highspeed", context_window: 204_800, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.1, cost_per_1k_output: 0.3 },
  { id: "minimax-api-m2.5", provider: "minimax", model: "minimax-m2.5", context_window: 204_800, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.05, cost_per_1k_output: 0.15 },
  { id: "minimax-api-m2.5-highspeed", provider: "minimax", model: "minimax-m2.5-highspeed", context_window: 204_800, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.05, cost_per_1k_output: 0.15 },
  // Moonshot API
  { id: "moonshot-kimi-latest", provider: "moonshot", model: "kimi-latest", context_window: 128_000, rate_limit: { requests_per_hour: 1000, remaining: 1000 }, trusted: false, available: true, cost_per_1k_input: 0.14, cost_per_1k_output: 0.14 },
  // DeepSeek API
  { id: "deepseek-api-v3", provider: "deepseek", model: "deepseek-v3", context_window: 64_000, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.014, cost_per_1k_output: 0.028 },
  { id: "deepseek-api-coder-v3", provider: "deepseek", model: "deepseek-coder-v3", context_window: 64_000, rate_limit: { requests_per_hour: 2000, remaining: 2000 }, trusted: false, available: true, cost_per_1k_input: 0.014, cost_per_1k_output: 0.028 },
];

export function getSeedModelCards(): ModelCard[] { return SEED_MODEL_CARDS.map((card) => ({ ...card })); }
export function getSeedSubscriptions(): PickerSubscription[] { return SEED_SUBSCRIPTIONS.map((sub) => ({ ...sub })); }
export function seedAllRegistries(cardRegistry: ModelCardRegistry, subRegistry: SubscriptionRegistry): void {
  for (const card of SEED_MODEL_CARDS) { cardRegistry.register({ ...card }); }
  for (const sub of SEED_SUBSCRIPTIONS) { subRegistry.register({ ...sub }); }
}
