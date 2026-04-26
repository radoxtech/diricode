import { describe, expect, test, vi } from "vitest";
import { bootstrapPlayground } from "../playground/bootstrap.js";
import * as providerRegistry from "../provider-registry.js";
import type { ProviderDiscoveryEntry } from "../provider-registry.js";

vi.mock("../llm-picker/classifier-engine.js", () => ({
  classifyRoutingTags: vi.fn().mockResolvedValue({
    inputText: "",
    deberta: {
      modelId: "mock-deberta",
      modelName: "Mock DeBERTa",
      tagScores: [],
      primaryTags: [],
      isTrueZeroShot: true,
    },
    modernBert: {
      modelId: "mock-modernbert",
      modelName: "Mock ModernBERT",
      tagScores: [],
      primaryTags: [],
      isTrueZeroShot: true,
    },
    agreementTags: [],
    disagreementTags: [],
  }),
}));

describe("bootstrapPlayground", () => {
  test("returns expected result shape", async () => {
    const result = await bootstrapPlayground();
    expect(result.startTime).toBeGreaterThan(0);
    expect(result.diriRouter).toBeDefined();
    expect(result.registry).toBeDefined();
    expect(result.subscriptionRegistry).toBeDefined();
    expect(Array.isArray(result.providerStatuses)).toBe(true);
  });

  test("aggregates provider discovery results without vendor-specific branching", async () => {
    const mockDiscoveries: ProviderDiscoveryEntry[] = [
      {
        provider: { name: "mock-live" } as never,
        availabilities: [
          {
            provider: "mock-live",
            model_id: "live-model",
            family: "mock-family",
            stability: "stable",
            available: true,
            context_window: 128_000,
            supports_tool_calling: true,
            supports_vision: false,
            supports_structured_output: true,
            supports_streaming: true,
            input_cost_per_1k: 0,
            output_cost_per_1k: 0,
            trusted: true,
          },
        ],
        status: {
          name: "mock-live",
          available: true,
          envVar: "MOCK_LIVE_KEY",
          modelCount: 1,
          modelNames: ["live-model"],
        },
        priority: 1,
      },
      {
        provider: { name: "mock-static" } as never,
        availabilities: [
          {
            provider: "mock-static",
            model_id: "static-model",
            family: "mock-family",
            stability: "stable",
            available: true,
            context_window: 64_000,
            supports_tool_calling: true,
            supports_vision: true,
            supports_structured_output: true,
            supports_streaming: true,
            input_cost_per_1k: 0,
            output_cost_per_1k: 0,
            trusted: true,
          },
        ],
        status: {
          name: "mock-static",
          available: true,
          envVar: "MOCK_STATIC_KEY",
          modelCount: 1,
          modelNames: ["static-model"],
        },
        priority: 2,
      },
    ];

    const spy = vi
      .spyOn(providerRegistry, "discoverAllProviders")
      .mockResolvedValue(mockDiscoveries);

    const result = await bootstrapPlayground();

    expect(result.providerStatuses).toHaveLength(2);
    expect(result.providerStatuses.map((s) => s.name)).toEqual(["mock-live", "mock-static"]);
    expect(result.subscriptionRegistry.list()).toHaveLength(2);
    expect(result.subscriptionRegistry.has("mock-live-live-model")).toBe(true);
    expect(result.subscriptionRegistry.has("mock-static-static-model")).toBe(true);

    spy.mockRestore();
  });

  test("resolver candidate pool contains only provider-produced availabilities", async () => {
    const mockDiscoveries: ProviderDiscoveryEntry[] = [
      {
        provider: { name: "mock" } as never,
        availabilities: [
          {
            provider: "mock",
            model_id: "m1",
            family: "f1",
            stability: "stable",
            available: true,
            context_window: 100_000,
            supports_tool_calling: true,
            supports_vision: false,
            supports_structured_output: true,
            supports_streaming: true,
            input_cost_per_1k: 0,
            output_cost_per_1k: 0,
            trusted: true,
          },
        ],
        status: {
          name: "mock",
          available: true,
          envVar: "MOCK_KEY",
          modelCount: 1,
          modelNames: ["m1"],
        },
        priority: 1,
      },
    ];

    const spy = vi
      .spyOn(providerRegistry, "discoverAllProviders")
      .mockResolvedValue(mockDiscoveries);

    const result = await bootstrapPlayground();
    const pool = result.diriRouter.resolver.getCandidatePool();

    expect(pool.length).toBeGreaterThanOrEqual(1);
    expect(pool.some((c) => c.provider === "mock" && c.model === "m1")).toBe(true);
    expect(pool.some((c) => c.provider === "anthropic")).toBe(false);

    spy.mockRestore();
  });

  test("empty provider availability results in no_match from picker", async () => {
    const mockDiscoveries: ProviderDiscoveryEntry[] = [
      {
        provider: { name: "mock", isAvailable: () => true } as never,
        availabilities: [],
        status: {
          name: "mock",
          available: true,
          envVar: "MOCK_KEY",
          modelCount: 0,
          modelNames: [],
        },
        priority: 1,
      },
    ];

    const spy = vi
      .spyOn(providerRegistry, "discoverAllProviders")
      .mockResolvedValue(mockDiscoveries);

    const result = await bootstrapPlayground();
    const response = await result.diriRouter.pick(
      {
        chatId: "test-chat",
        requestId: "test-req",
        agent: { id: "a1", role: "coder", seniority: "senior", specializations: [] },
        task: { type: "coding", description: "test" },
        modelDimensions: { tier: "medium", modelAttributes: [], fallbackType: null },
      },
      "test-chat",
    );

    expect(response.status).toBe("no_match");
    expect(response.selected).toBeUndefined();
    expect(response.candidates).toEqual([]);

    spy.mockRestore();
  });
});
