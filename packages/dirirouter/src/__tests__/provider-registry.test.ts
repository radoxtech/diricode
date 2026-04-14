import { describe, expect, test } from "vitest";
import { getProviderDefinitions, discoverAllProviders } from "../provider-registry.js";

describe("getProviderDefinitions", () => {
  test("returns all configured provider definitions", () => {
    const definitions = getProviderDefinitions();
    const names = definitions.map((d) => d.name);
    expect(names).toContain("gemini");
    expect(names).toContain("kimi");
    expect(names).toContain("zai");
    expect(names).toContain("minimax");
    expect(names).toContain("copilot");
  });

  test("each definition has required fields", () => {
    for (const def of getProviderDefinitions()) {
      expect(def.name).toBeTruthy();
      expect(def.envVar).toBeTruthy();
      expect(typeof def.priority).toBe("number");
      expect(typeof def.create).toBe("function");
    }
  });
});

describe("discoverAllProviders", () => {
  test("returns status for all providers without crashing", async () => {
    const results = await discoverAllProviders();
    expect(results.length).toBeGreaterThanOrEqual(5);
    for (const result of results) {
      expect(result.provider).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.status.name).toBeTruthy();
      expect(typeof result.status.available).toBe("boolean");
      expect(Array.isArray(result.availabilities)).toBe(true);
      expect(typeof result.priority).toBe("number");
    }
  });

  test("aggregates provider results generically without branching", async () => {
    const results = await discoverAllProviders();
    const statuses = results.map((r) => r.status);
    const names = new Set(statuses.map((s) => s.name));
    expect(names.size).toBe(statuses.length);
  });
});
