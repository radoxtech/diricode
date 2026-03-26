import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAvailableModels, clearModelsCache } from "../copilot/models-fetcher.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const MOCK_API_RESPONSE = [
  {
    name: "openai/gpt-4o",
    display_name: "GPT-4o",
    registry: "openai",
    publisher: "openai",
    model_capabilities: ["streaming"],
    rate_limit_tier: "high",
  },
  {
    name: "anthropic/claude-3.5-sonnet",
    display_name: "Claude 3.5 Sonnet",
    registry: "anthropic",
    publisher: "anthropic",
    model_capabilities: ["streaming"],
    rate_limit_tier: "standard",
  },
];

describe("fetchAvailableModels()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearModelsCache();
  });

  it("returns models from GitHub API on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_API_RESPONSE),
    });

    const models = await fetchAvailableModels("ghp_token");
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ id: "openai/gpt-4o", name: "GPT-4o" });
    expect(models[1]).toMatchObject({ id: "anthropic/claude-3.5-sonnet" });
  });

  it("calls models API with Bearer token", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_API_RESPONSE),
    });

    await fetchAvailableModels("ghp_mytoken");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://models.github.ai/catalog/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ghp_mytoken",
        }) as Record<string, string>,
      }),
    );
  });

  it("falls back to static list when API returns non-ok status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const models = await fetchAvailableModels("bad-token");
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty("id");
    expect(models[0]).toHaveProperty("publisher");
  });

  it("falls back to static list on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    const models = await fetchAvailableModels("any-token");
    expect(models.length).toBeGreaterThan(0);
  });

  it("returns cached result within TTL (no second fetch)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_API_RESPONSE),
    });

    await fetchAvailableModels("ghp_token");
    await fetchAvailableModels("ghp_token");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refetches after cache is cleared", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(MOCK_API_RESPONSE),
    });

    await fetchAvailableModels("ghp_token");
    clearModelsCache();
    await fetchAvailableModels("ghp_token");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
