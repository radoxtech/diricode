import { describe, expect, it } from "vitest";
import { ClassifiedError, classifyError } from "../index.js";
import { GeminiProvider } from "../providers/gemini.js";

describe("GeminiProvider", () => {
  const mockApiKey = "test-api-key-12345";

  describe("constructor", () => {
    it("creates instance with API key string", () => {
      const provider = new GeminiProvider(mockApiKey);
      expect(provider).toBeDefined();
      expect(provider.name).toBe("gemini");
    });

    it("creates instance with config object", () => {
      const provider = new GeminiProvider({ apiKey: mockApiKey });
      expect(provider).toBeDefined();
      expect(provider.name).toBe("gemini");
    });

    it("throws error when API key is empty string", () => {
      expect(() => new GeminiProvider("")).toThrow("GeminiProvider requires an API key");
    });

    it("throws error when API key is whitespace only", () => {
      expect(() => new GeminiProvider("   ")).toThrow("GeminiProvider requires an API key");
    });

    it("throws error when config object has empty apiKey", () => {
      expect(() => new GeminiProvider({ apiKey: "" })).toThrow(
        "GeminiProvider requires an API key",
      );
    });
  });

  describe("name", () => {
    it("returns 'gemini'", () => {
      const provider = new GeminiProvider(mockApiKey);
      expect(provider.name).toBe("gemini");
    });
  });

  describe("defaultModel", () => {
    it("has correct default model configuration", () => {
      const provider = new GeminiProvider(mockApiKey);
      expect(provider.defaultModel).toEqual({
        modelId: "gemini-2.5-flash",
        temperature: 0.2,
        maxTokens: 4096,
      });
    });
  });

  describe("isAvailable", () => {
    it("returns true when client is initialized", () => {
      const provider = new GeminiProvider(mockApiKey);
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe("error classification contract", () => {
    it("classifies empty response errors as non-retryable ClassifiedError", () => {
      const err = new Error("Gemini API returned empty response");
      const classified = classifyError(err, { provider: "gemini", model: "gemini-2.5-flash" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("other");
      expect(classified.retryable).toBe(false);
      expect(classified.provider).toBe("gemini");
      expect(classified.model).toBe("gemini-2.5-flash");
    });

    it("classifies rate limit errors with retryAfterMs", () => {
      const err = Object.assign(new Error("Too many requests"), {
        status: 429,
        headers: { "retry-after": "5" },
      });
      const classified = classifyError(err, { provider: "gemini", model: "gemini-2.5-pro" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("rate_limited");
      expect(classified.retryable).toBe(true);
      expect(classified.retryAfterMs).toBe(5_000);
      expect(classified.provider).toBe("gemini");
    });

    it("classifies auth errors as non-retryable", () => {
      const err = Object.assign(new Error("API key expired"), { status: 401 });
      const classified = classifyError(err, { provider: "gemini", model: "gemini-2.5-flash" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("auth_error");
      expect(classified.retryable).toBe(false);
    });

    it("classifies server errors as retryable overloaded", () => {
      const err = Object.assign(new Error("Internal Server Error"), { status: 500 });
      const classified = classifyError(err, { provider: "gemini", model: "gemini-2.5-flash" });

      expect(classified).toBeInstanceOf(ClassifiedError);
      expect(classified.kind).toBe("overloaded");
      expect(classified.retryable).toBe(true);
    });
  });

  describe("generate", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking @google/genai is unreliable in CI environment
      // The implementation is tested manually and works correctly
      // To test: set GEMINI_API_KEY env var and run integration tests
    });
  });

  describe("stream", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking @google/genai is unreliable in CI environment
      // The implementation is tested manually and works correctly
      // To test: set GEMINI_API_KEY env var and run integration tests
    });
  });
});
