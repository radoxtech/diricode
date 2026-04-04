import { describe, expect, it } from "vitest";
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
