import { describe, expect, it } from "vitest";
import {
  ModelsCatalog,
  ModelsDevFetchError,
  type ModelsDevApiResponse,
} from "../utils/models-dev.js";

const FIXTURE: ModelsDevApiResponse = {
  "test-provider": {
    id: "test-provider",
    name: "Test Provider",
    env: ["TEST_API_KEY"],
    api: "https://api.test.dev/v1",
    models: {
      "model-a": {
        id: "model-a",
        name: "Model A",
        family: "alpha",
        attachment: false,
        reasoning: true,
        tool_call: true,
        structured_output: true,
        temperature: true,
        open_weights: false,
        limit: { context: 128_000, output: 8_192 },
      },
      "model-b": {
        id: "model-b",
        name: "Model B",
        family: "alpha",
        attachment: true,
        reasoning: false,
        tool_call: true,
        temperature: true,
        open_weights: false,
        limit: { context: 32_000, output: 4_096 },
        modalities: { input: ["text", "image"], output: ["text"] },
      },
      "model-c": {
        id: "model-c",
        name: "Model C",
        family: "beta",
        attachment: false,
        reasoning: true,
        tool_call: false,
        temperature: false,
        open_weights: true,
        limit: { context: 262_144, output: 16_384 },
        cost: { input: 1.0, output: 3.0 },
      },
    },
  },
  "other-provider": {
    id: "other-provider",
    name: "Other Provider",
    models: {
      "model-a": {
        id: "model-a",
        name: "Model A (Other)",
        family: "alpha",
        attachment: false,
        reasoning: true,
        tool_call: true,
        temperature: true,
        open_weights: false,
        limit: { context: 200_000, output: 8_192 },
      },
    },
  },
};

describe("ModelsCatalog", () => {
  describe("fromJSON", () => {
    it("builds a catalog from raw data", () => {
      const catalog = ModelsCatalog.fromJSON(FIXTURE);
      expect(catalog.providerIds()).toEqual(["test-provider", "other-provider"]);
    });

    it("handles empty response", () => {
      const catalog = ModelsCatalog.fromJSON({});
      expect(catalog.providerIds()).toEqual([]);
      expect(catalog.families()).toEqual([]);
    });

    it("skips malformed provider entries", () => {
      if (!FIXTURE["test-provider"]) throw new Error("Expected FIXTURE test-provider to exist");
      const data = {
        good: FIXTURE["test-provider"],
        bad: null as unknown as (typeof FIXTURE)[string],
      };
      const catalog = ModelsCatalog.fromJSON(data as Record<string, (typeof FIXTURE)[string]>);
      expect(catalog.providerIds()).toEqual(["good"]);
    });
  });

  describe("provider queries", () => {
    const catalog = ModelsCatalog.fromJSON(FIXTURE);

    it("returns a provider by ID", () => {
      const p = catalog.provider("test-provider");
      expect(p).toBeDefined();
      if (!p) throw new Error("Expected provider to be defined");
      expect(p.name).toBe("Test Provider");
    });

    it("returns undefined for unknown provider", () => {
      expect(catalog.provider("nonexistent")).toBeUndefined();
    });

    it("lists all providers", () => {
      const providers = catalog.providers();
      expect(providers).toHaveLength(2);
      expect(providers.map((p) => p.id)).toEqual(["test-provider", "other-provider"]);
    });
  });

  describe("model queries", () => {
    const catalog = ModelsCatalog.fromJSON(FIXTURE);

    it("looks up a specific model in a specific provider", () => {
      const entry = catalog.model("test-provider", "model-a");
      expect(entry).toBeDefined();
      if (!entry) throw new Error("Expected entry to be defined");
      expect(entry.model.name).toBe("Model A");
      expect(entry.providerId).toBe("test-provider");
    });

    it("returns undefined for wrong provider/model combo", () => {
      expect(catalog.model("other-provider", "model-b")).toBeUndefined();
    });

    it("finds a model across all providers", () => {
      const entries = catalog.modelAcrossProviders("model-a");
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.providerId)).toEqual(["test-provider", "other-provider"]);
    });

    it("returns empty array for unknown model", () => {
      expect(catalog.modelAcrossProviders("model-z")).toEqual([]);
    });

    it("lists models by provider", () => {
      const entries = catalog.modelsByProvider("test-provider");
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.model.id)).toEqual(["model-a", "model-b", "model-c"]);
    });

    it("returns empty for unknown provider", () => {
      expect(catalog.modelsByProvider("nope")).toEqual([]);
    });
  });

  describe("family queries", () => {
    const catalog = ModelsCatalog.fromJSON(FIXTURE);

    it("lists all families", () => {
      const fams = catalog.families();
      expect(fams).toContain("alpha");
      expect(fams).toContain("beta");
    });

    it("returns models by family", () => {
      const alphas = catalog.byFamily("alpha");
      expect(alphas).toHaveLength(3);

      const betas = catalog.byFamily("beta");
      expect(betas).toHaveLength(1);
      if (!betas[0]) throw new Error("Expected betas[0] to exist");
      expect(betas[0].model.id).toBe("model-c");
    });

    it("returns empty for unknown family", () => {
      expect(catalog.byFamily("gamma")).toEqual([]);
    });
  });

  describe("query (filtered)", () => {
    const catalog = ModelsCatalog.fromJSON(FIXTURE);

    it("filters by reasoning", () => {
      const result = catalog.query({ reasoning: true });
      expect(result.every((r) => r.model.reasoning)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it("filters by toolCall", () => {
      const result = catalog.query({ toolCall: false });
      expect(result).toHaveLength(1);
      if (!result[0]) throw new Error("Expected result[0] to exist");
      expect(result[0].model.id).toBe("model-c");
    });

    it("filters by vision (attachment)", () => {
      const result = catalog.query({ vision: true });
      expect(result).toHaveLength(1);
      if (!result[0]) throw new Error("Expected result[0] to exist");
      expect(result[0].model.id).toBe("model-b");
    });

    it("filters by minContext", () => {
      const result = catalog.query({ minContext: 200_000 });
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.model.id).sort()).toEqual(["model-a", "model-c"]);
    });

    it("filters by maxContext", () => {
      const result = catalog.query({ maxContext: 50_000 });
      expect(result).toHaveLength(1);
      if (!result[0]) throw new Error("Expected result[0] to exist");
      expect(result[0].model.id).toBe("model-b");
    });

    it("filters by family", () => {
      const result = catalog.query({ family: "beta" });
      expect(result).toHaveLength(1);
    });

    it("filters by providerId", () => {
      const result = catalog.query({ providerId: "other-provider" });
      expect(result).toHaveLength(1);
      if (!result[0]) throw new Error("Expected result[0] to exist");
      expect(result[0].providerId).toBe("other-provider");
    });

    it("filters by openWeights", () => {
      const result = catalog.query({ openWeights: true });
      expect(result).toHaveLength(1);
      if (!result[0]) throw new Error("Expected result[0] to exist");
      expect(result[0].model.id).toBe("model-c");
    });

    it("combines multiple filters", () => {
      const result = catalog.query({ reasoning: true, minContext: 200_000 });
      expect(result).toHaveLength(2);
    });

    it("returns empty when no matches", () => {
      const result = catalog.query({ reasoning: true, vision: true });
      expect(result).toEqual([]);
    });
  });

  describe("raw access", () => {
    it("returns the original data", () => {
      const catalog = ModelsCatalog.fromJSON(FIXTURE);
      expect(catalog.raw).toBe(FIXTURE);
    });
  });
});

describe("ModelsDevFetchError", () => {
  it("has correct name and message", () => {
    const err = new ModelsDevFetchError("test message");
    expect(err.name).toBe("ModelsDevFetchError");
    expect(err.message).toBe("test message");
    expect(err).toBeInstanceOf(Error);
  });
});
