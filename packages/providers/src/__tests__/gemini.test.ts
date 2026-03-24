import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  generateContentStream: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mocks.generateContent,
      generateContentStream: mocks.generateContentStream,
    },
  })),
}));

const { GeminiProvider } = await import("../providers/gemini.js");

describe("GeminiProvider", () => {
  const mockApiKey = "test-api-key-12345";

  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    it("generates content with default model", async () => {
      mocks.generateContent.mockResolvedValue({ text: "Generated response" });

      const provider = new GeminiProvider(mockApiKey);
      const result = await provider.generate({ prompt: "Hello" });

      expect(mocks.generateContent).toHaveBeenCalledWith({
        model: "gemini-2.5-flash",
        contents: "Hello",
        config: {
          temperature: 0.2,
          maxOutputTokens: 4096,
        },
      });
      expect(result).toBe("Generated response");
    });

    it("uses custom model when provided", async () => {
      mocks.generateContent.mockResolvedValue({ text: "Custom model response" });

      const provider = new GeminiProvider(mockApiKey);
      const result = await provider.generate({
        prompt: "Hello",
        model: {
          modelId: "gemini-2.5-pro",
          temperature: 0.5,
          maxTokens: 2048,
        },
      });

      expect(mocks.generateContent).toHaveBeenCalledWith({
        model: "gemini-2.5-pro",
        contents: "Hello",
        config: {
          temperature: 0.5,
          maxOutputTokens: 2048,
        },
      });
      expect(result).toBe("Custom model response");
    });

    it("handles null response text", async () => {
      mocks.generateContent.mockResolvedValue({ text: null });

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow(
        "returned empty response",
      );
    });

    it("handles API errors with meaningful messages", async () => {
      mocks.generateContent.mockRejectedValue(new Error("API key invalid"));

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow(
        "Invalid or missing API key",
      );
    });

    it("handles rate limit errors", async () => {
      mocks.generateContent.mockRejectedValue(new Error("rate limit exceeded"));

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow("Rate limit exceeded");
    });
  });

  describe("stream", () => {
    it("streams content with default model", async () => {
      const mockStream = {
        // eslint-disable-next-line @typescript-eslint/require-await
        async *[Symbol.asyncIterator]() {
          yield { text: "Chunk 1" };
          yield { text: "Chunk 2" };
        },
      };
      mocks.generateContentStream.mockResolvedValue(mockStream);

      const provider = new GeminiProvider(mockApiKey);
      const chunks: { delta: string; done: boolean }[] = [];

      for await (const chunk of provider.stream({ prompt: "Hello" })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ delta: "Chunk 1", done: false });
      expect(chunks[1]).toEqual({ delta: "Chunk 2", done: false });
      expect(chunks[2]).toEqual({ delta: "", done: true });
    });

    it("handles empty chunks", async () => {
      const mockStream = {
        // eslint-disable-next-line @typescript-eslint/require-await
        async *[Symbol.asyncIterator]() {
          yield { text: null };
          yield { text: undefined };
          yield { text: "" };
        },
      };
      mocks.generateContentStream.mockResolvedValue(mockStream);

      const provider = new GeminiProvider(mockApiKey);
      const chunks: { delta: string; done: boolean }[] = [];

      for await (const chunk of provider.stream({ prompt: "Hello" })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual({ delta: "", done: false });
      expect(chunks[1]).toEqual({ delta: "", done: false });
      expect(chunks[2]).toEqual({ delta: "", done: false });
      expect(chunks[3]).toEqual({ delta: "", done: true });
    });

    it("uses custom model config when provided", async () => {
      const mockStream = {
        // eslint-disable-next-line @typescript-eslint/require-await
        async *[Symbol.asyncIterator]() {
          yield { text: "Response" };
        },
      };
      mocks.generateContentStream.mockResolvedValue(mockStream);

      const provider = new GeminiProvider(mockApiKey);

      for await (const _ of provider.stream({
        prompt: "Hello",
        model: { modelId: "gemini-pro", temperature: 0.8, maxTokens: 1000 },
        // eslint-disable-next-line no-empty
      })) {
      }

      expect(mocks.generateContentStream).toHaveBeenCalledWith({
        model: "gemini-pro",
        contents: "Hello",
        config: {
          temperature: 0.8,
          maxOutputTokens: 1000,
        },
      });
    });

    it("handles streaming errors", async () => {
      mocks.generateContentStream.mockRejectedValue(new Error("Network error"));

      const provider = new GeminiProvider(mockApiKey);
      const generator = provider.stream({ prompt: "Hello" });

      await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(
        "GeminiProvider stream failed",
      );
    });
  });

  describe("error handling", () => {
    it("handles model not found errors", async () => {
      mocks.generateContent.mockRejectedValue(new Error("model not found: invalid-model"));

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow("Invalid model ID");
    });

    it("handles unknown errors", async () => {
      mocks.generateContent.mockRejectedValue("unknown error");

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow(
        "Unknown error occurred",
      );
    });
  });
});
