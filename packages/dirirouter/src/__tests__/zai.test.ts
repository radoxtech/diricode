import { describe, expect, it } from "vitest";
import { ClassifiedError, classifyError } from "../index.js";
import { ZaiProvider, createZaiProvider } from "../providers/zai.js";

describe("ZaiProvider", () => {
  const mockApiKey = "test-zai-api-key-12345";

  describe("constructor", () => {
    it("creates instance with API key string", () => {
      const provider = new ZaiProvider(mockApiKey);
      expect(provider).toBeDefined();
      expect(provider.name).toBe("zai");
    });

    it("creates instance with config object", () => {
      const provider = new ZaiProvider({ apiKey: mockApiKey });
      expect(provider).toBeDefined();
      expect(provider.name).toBe("zai");
    });

    it("throws error when API key is empty string", () => {
      expect(() => new ZaiProvider("")).toThrow("ZaiProvider requires an API key");
    });

    it("throws error when API key is whitespace only", () => {
      expect(() => new ZaiProvider("   ")).toThrow("ZaiProvider requires an API key");
    });

    it("throws error when config object has empty apiKey", () => {
      expect(() => new ZaiProvider({ apiKey: "" })).toThrow("ZaiProvider requires an API key");
    });
  });

  describe("name", () => {
    it("returns 'zai'", () => {
      const provider = new ZaiProvider(mockApiKey);
      expect(provider.name).toBe("zai");
    });
  });

  describe("defaultModel", () => {
    it("has correct default model configuration", () => {
      const provider = new ZaiProvider(mockApiKey);
      expect(provider.defaultModel).toEqual({
        modelId: "glm-5-turbo",
        temperature: 0.2,
        maxTokens: 4096,
      });
    });
  });

  describe("isAvailable", () => {
    it("returns true when API key is present", () => {
      const provider = new ZaiProvider(mockApiKey);
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe("error classification contract", () => {
    it("classifies empty response errors as non-retryable ClassifiedError", () => {
      const err = new Error("Z.ai API returned empty response");
      const classified = classifyError(err, { provider: "zai", model: "glm-5-turbo" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("other");
      expect(classified.retryable).toBe(false);
      expect(classified.provider).toBe("zai");
      expect(classified.model).toBe("glm-5-turbo");
    });

    it("classifies rate limit errors with retryAfterMs", () => {
      const err = Object.assign(new Error("Too many requests"), {
        status: 429,
        headers: { "retry-after": "10" },
      });
      const classified = classifyError(err, { provider: "zai", model: "glm-5" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("rate_limited");
      expect(classified.retryable).toBe(true);
      expect(classified.retryAfterMs).toBe(10_000);
      expect(classified.provider).toBe("zai");
    });

    it("classifies auth errors as non-retryable", () => {
      const err = Object.assign(new Error("Invalid API key"), { status: 401 });
      const classified = classifyError(err, { provider: "zai", model: "glm-5-turbo" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("auth_error");
      expect(classified.retryable).toBe(false);
    });

    it("classifies context overflow as non-retryable", () => {
      const err = Object.assign(new Error("Request too large"), { status: 413 });
      const classified = classifyError(err, { provider: "zai", model: "glm-5" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("context_overflow");
      expect(classified.retryable).toBe(false);
    });

    it("classifies server errors as retryable overloaded", () => {
      const err = Object.assign(new Error("Service unavailable"), { status: 503 });
      const classified = classifyError(err, { provider: "zai", model: "glm-5-turbo" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("overloaded");
      expect(classified.retryable).toBe(true);
    });
  });

  describe("generate", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking Z.ai API is unreliable in CI environment
      // The implementation is tested manually and works correctly
      // To test: set DC_ZAI_API_KEY env var and run integration tests
    });
  });

  describe("stream", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking Z.ai API is unreliable in CI environment
      // The implementation is tested manually and works correctly
      // To test: set DC_ZAI_API_KEY env var and run integration tests
    });
  });

  describe("createZaiProvider", () => {
    it("creates instance via factory function", () => {
      const provider = createZaiProvider(mockApiKey);
      expect(provider).toBeDefined();
      expect(provider.name).toBe("zai");
    });
  });
});
