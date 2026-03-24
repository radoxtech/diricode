import { describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "../providers/gemini.js";

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(({ apiKey }: { apiKey: string }) => ({
      models: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
      },
      _apiKey: apiKey,
    })),
  };
});

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
    it("generates content with default model", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: "Generated response",
      });

      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: mockGenerateContent,
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      const result = await provider.generate({ prompt: "Hello" });

      expect(mockGenerateContent).toHaveBeenCalledWith({
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
      const { GoogleGenAI } = await import("@google/genai");
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: "Custom model response",
      });

      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: mockGenerateContent,
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      const result = await provider.generate({
        prompt: "Hello",
        model: {
          modelId: "gemini-2.5-pro",
          temperature: 0.5,
          maxTokens: 2048,
        },
      });

      expect(mockGenerateContent).toHaveBeenCalledWith({
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
      const { GoogleGenAI } = await import("@google/genai");
      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: vi.fn().mockResolvedValue({ text: null }),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow(
        "returned null or undefined response text",
      );
    });

    it("handles API errors with meaningful messages", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: vi.fn().mockRejectedValue(new Error("API key invalid")),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow(
        "Invalid or missing API key",
      );
    });

    it("handles rate limit errors", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: vi.fn().mockRejectedValue(new Error("rate limit exceeded")),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow("Rate limit exceeded");
    });
  });

  describe("stream", () => {
    it("streams content with default model", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { text: "Chunk 1" };
          yield { text: "Chunk 2" };
        },
      };

      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContentStream: vi.fn().mockResolvedValue(mockStream),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      const chunks: Array<{ delta: string; done: boolean }> = [];

      for await (const chunk of provider.stream({ prompt: "Hello" })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ delta: "Chunk 1", done: false });
      expect(chunks[1]).toEqual({ delta: "Chunk 2", done: false });
      expect(chunks[2]).toEqual({ delta: "", done: true });
    });

    it("handles empty chunks", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { text: null };
          yield { text: undefined };
          yield { text: "" };
        },
      };

      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContentStream: vi.fn().mockResolvedValue(mockStream),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      const chunks: Array<{ delta: string; done: boolean }> = [];

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
      const { GoogleGenAI } = await import("@google/genai");
      const mockGenerateContentStream = vi.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { text: "Response" };
        },
      });

      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContentStream: mockGenerateContentStream,
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);

      for await (const _ of provider.stream({
        prompt: "Hello",
        model: { modelId: "gemini-pro", temperature: 0.8, maxTokens: 1000 },
      })) {
      }

      expect(mockGenerateContentStream).toHaveBeenCalledWith({
        model: "gemini-pro",
        contents: "Hello",
        config: {
          temperature: 0.8,
          maxOutputTokens: 1000,
        },
      });
    });

    it("handles streaming errors", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContentStream: vi.fn().mockRejectedValue(new Error("Network error")),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      const generator = provider.stream({ prompt: "Hello" });

      await expect(generator[Symbol.asyncIterator]().next()).rejects.toThrow(
        "GeminiProvider stream failed",
      );
    });
  });

  describe("error handling", () => {
    it("handles model not found errors", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: vi
                .fn()
                .mockRejectedValue(new Error("model not found: invalid-model")),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow("Invalid model ID");
    });

    it("handles unknown errors", async () => {
      const { GoogleGenAI } = await import("@google/genai");
      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: vi.fn().mockRejectedValue("unknown error"),
            },
          }) as unknown as InstanceType<typeof GoogleGenAI>,
      );

      const provider = new GeminiProvider(mockApiKey);
      await expect(provider.generate({ prompt: "Hello" })).rejects.toThrow(
        "Unknown error occurred",
      );
    });
  });
});
