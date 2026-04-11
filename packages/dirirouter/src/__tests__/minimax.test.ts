import { describe, expect, it } from "vitest";
import { ClassifiedError, classifyError } from "../index.js";
import {
  MinimaxProvider,
  createMinimaxProvider,
  MinimaxProviderAdapter,
} from "../providers/minimax.js";

describe("MinimaxProvider", () => {
  const mockApiKey = "test-minimax-api-key-12345";

  describe("constructor", () => {
    it("creates instance with API key string", () => {
      const provider = new MinimaxProvider(mockApiKey);
      expect(provider).toBeDefined();
      expect(provider.name).toBe("minimax");
    });

    it("creates instance with config object", () => {
      const provider = new MinimaxProvider({ apiKey: mockApiKey });
      expect(provider).toBeDefined();
      expect(provider.name).toBe("minimax");
    });

    it("throws error when API key is empty string", () => {
      expect(() => new MinimaxProvider("")).toThrow("MinimaxProvider requires an API key");
    });

    it("throws error when API key is whitespace only", () => {
      expect(() => new MinimaxProvider("   ")).toThrow("MinimaxProvider requires an API key");
    });

    it("throws error when config object has empty apiKey", () => {
      expect(() => new MinimaxProvider({ apiKey: "" })).toThrow(
        "MinimaxProvider requires an API key",
      );
    });
  });

  describe("name", () => {
    it("returns 'minimax'", () => {
      const provider = new MinimaxProvider(mockApiKey);
      expect(provider.name).toBe("minimax");
    });
  });

  describe("defaultModel", () => {
    it("has correct default model configuration", () => {
      const provider = new MinimaxProvider(mockApiKey);
      expect(provider.defaultModel).toEqual({
        modelId: "MiniMax-M2.7",
        temperature: 0.2,
        maxTokens: 4096,
      });
    });
  });

  describe("isAvailable", () => {
    it("returns true when API key is present", () => {
      const provider = new MinimaxProvider(mockApiKey);
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe("error classification contract", () => {
    it("classifies empty response errors as non-retryable ClassifiedError", () => {
      const err = new Error("MiniMax API returned empty response");
      const classified = classifyError(err, { provider: "minimax", model: "MiniMax-M2.7" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("other");
      expect(classified.retryable).toBe(false);
      expect(classified.provider).toBe("minimax");
      expect(classified.model).toBe("MiniMax-M2.7");
    });

    it("classifies rate limit errors with retryAfterMs", () => {
      const err = Object.assign(new Error("Too many requests"), {
        status: 429,
        headers: { "retry-after": "8" },
      });
      const classified = classifyError(err, { provider: "minimax", model: "MiniMax-M2.5" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("rate_limited");
      expect(classified.retryable).toBe(true);
      expect(classified.retryAfterMs).toBe(8_000);
      expect(classified.provider).toBe("minimax");
    });

    it("classifies auth errors as non-retryable", () => {
      const err = Object.assign(new Error("Unauthorized"), { status: 401 });
      const classified = classifyError(err, { provider: "minimax", model: "MiniMax-M2.7" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("auth_error");
      expect(classified.retryable).toBe(false);
    });

    it("classifies quota exceeded errors as non-retryable", () => {
      const err = new Error("Your quota has been exceeded for this month");
      const classified = classifyError(err, { provider: "minimax", model: "MiniMax-M2.7" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("quota_exhausted");
      expect(classified.retryable).toBe(false);
    });

    it("classifies server errors as retryable overloaded", () => {
      const err = Object.assign(new Error("Bad Gateway"), { status: 502 });
      const classified = classifyError(err, { provider: "minimax", model: "MiniMax-M2.7" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("overloaded");
      expect(classified.retryable).toBe(true);
    });
  });

  describe("generate", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking MiniMax API is unreliable in CI environment
      // To test: set DC_MINIMAX_API_KEY env var and run integration tests
    });
  });

  describe("stream", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking MiniMax API is unreliable in CI environment
      // To test: set DC_MINIMAX_API_KEY env var and run integration tests
    });
  });

  describe("createMinimaxProvider", () => {
    it("creates instance via factory function", () => {
      const provider = createMinimaxProvider(mockApiKey);
      expect(provider).toBeDefined();
      expect(provider.name).toBe("minimax");
    });
  });
});

describe("MinimaxProviderAdapter", () => {
  describe("providerId", () => {
    it("returns 'minimax'", () => {
      const adapter = new MinimaxProviderAdapter();
      expect(adapter.providerId).toBe("minimax");
    });
  });

  describe("listModels", () => {
    it("returns array of MiniMax model descriptors", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it("each model has required fields", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      for (const model of models) {
        expect(model).toHaveProperty("apiModel");
        expect(model).toHaveProperty("contextWindow");
        expect(model).toHaveProperty("maxOutput");
        expect(model).toHaveProperty("canReason");
        expect(model).toHaveProperty("toolCall");
        expect(model).toHaveProperty("vision");
        expect(model).toHaveProperty("attachment");
        expect(model).toHaveProperty("quotaMultiplier");
      }
    });

    it("includes MiniMax-M2.7 model", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      const m27 = models.find((m) => m.apiModel === "MiniMax-M2.7");
      expect(m27).toBeDefined();
      expect(m27?.contextWindow).toBe(204_800);
      expect(m27?.maxOutput).toBe(131_072);
      expect(m27?.canReason).toBe(true);
    });

    it("includes highspeed variants with quotaMultiplier 2", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      const highspeed = models.filter((m) => m.apiModel.includes("highspeed"));
      expect(highspeed.length).toBeGreaterThan(0);
      for (const model of highspeed) {
        expect(model.quotaMultiplier).toBe(2);
      }
    });
  });

  describe("getQuota", () => {
    it("returns null", () => {
      const adapter = new MinimaxProviderAdapter();
      expect(adapter.getQuota()).toBeNull();
    });
  });
});
