import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAvailableModels, clearModelsCache } from "../copilot/models-fetcher.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("fetchAvailableModels", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    clearModelsCache();
  });

  it("returns models from API on success", async () => {
    mockFetch.mockResolvedValue(
      makeResponse(200, [
        { name: "gpt-5-mini", publisher: "openai" },
        { name: "claude-3.5-sonnet", publisher: "anthropic" },
      ]),
    );

    const models = await fetchAvailableModels("ghp_token");
    expect(models.length).toBeGreaterThanOrEqual(2);
    const gpt = models.find((m) => m.id === "gpt-5-mini");
    expect(gpt).toBeDefined();
    expect(gpt?.provider).toBe("openai");
  });

  it("falls back to static models on API failure", async () => {
    mockFetch.mockResolvedValue(makeResponse(500, {}));

    const models = await fetchAvailableModels("ghp_token");
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.id === "gpt-5-mini")).toBe(true);
  });

  it("falls back to static models when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const models = await fetchAvailableModels("ghp_token");
    expect(models.length).toBeGreaterThan(0);
  });

  it("uses cached result on second call within TTL", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, [{ name: "gpt-5-mini", publisher: "openai" }]));

    await fetchAvailableModels("ghp_token");
    await fetchAvailableModels("ghp_token");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refetches after cache is cleared", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, [{ name: "gpt-5-mini", publisher: "openai" }]));

    await fetchAvailableModels("ghp_token");
    clearModelsCache();
    await fetchAvailableModels("ghp_token");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns static models when API returns empty array", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, []));

    const models = await fetchAvailableModels("ghp_token");
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.id === "gpt-5-mini")).toBe(true);
  });

  it("includes supportsStreaming from static model info", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, [{ name: "gpt-5-mini", publisher: "openai" }]));

    const models = await fetchAvailableModels("ghp_token");
    const gpt = models.find((m) => m.id === "gpt-5-mini");
    expect(gpt?.supportsStreaming).toBe(true);
  });
});
