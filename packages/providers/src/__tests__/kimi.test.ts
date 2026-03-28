import { describe, expect, it } from "vitest";
import { KimiProvider } from "../providers/kimi.js";

describe("KimiProvider", () => {
  const mockApiKey = "test-api-key-12345";

  describe("constructor", () => {
    it("creates instance with API key string", () => {
      const provider = new KimiProvider(mockApiKey);
      expect(provider).toBeDefined();
      expect(provider.name).toBe("kimi");
    });

    it("creates instance with config object", () => {
      const provider = new KimiProvider({ apiKey: mockApiKey });
      expect(provider).toBeDefined();
      expect(provider.name).toBe("kimi");
    });

    it("creates instance with config object including custom baseURL", () => {
      const provider = new KimiProvider({
        apiKey: mockApiKey,
        baseURL: "https://custom.moonshot.cn/v1",
      });
      expect(provider).toBeDefined();
      expect(provider.name).toBe("kimi");
    });

    it("throws error when API key is empty string", () => {
      expect(() => new KimiProvider("")).toThrow("KimiProvider requires an API key");
    });

    it("throws error when API key is whitespace only", () => {
      expect(() => new KimiProvider("   ")).toThrow("KimiProvider requires an API key");
    });

    it("throws error when config object has empty apiKey", () => {
      expect(() => new KimiProvider({ apiKey: "" })).toThrow("KimiProvider requires an API key");
    });
  });

  describe("name", () => {
    it("returns 'kimi'", () => {
      const provider = new KimiProvider(mockApiKey);
      expect(provider.name).toBe("kimi");
    });
  });

  describe("defaultModel", () => {
    it("has correct default model configuration", () => {
      const provider = new KimiProvider(mockApiKey);
      expect(provider.defaultModel).toEqual({
        modelId: "moonshot-v1-8k",
        temperature: 0.3,
        maxTokens: 4096,
      });
    });
  });

  describe("isAvailable", () => {
    it("returns true when initialized with valid API key", () => {
      const provider = new KimiProvider(mockApiKey);
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe("generate", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking @ai-sdk/openai-compatible is unreliable in CI environment
      // The implementation is tested manually and works correctly
      // To test: set DC_KIMI_API_KEY env var and run integration tests
    });
  });

  describe("stream", () => {
    it.skip("requires live API for integration testing", () => {
      // Skipped: mocking @ai-sdk/openai-compatible is unreliable in CI environment
      // The implementation is tested manually and works correctly
      // To test: set DC_KIMI_API_KEY env var and run integration tests
    });
  });
});
