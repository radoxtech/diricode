import { describe, expect, it } from "vitest";
import { DiriRouter, ProviderPriorities, Registry } from "../index.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../index.js";
import type { DecisionRequest } from "@diricode/providers";

interface ProviderStub extends Provider {
  setNextResponse(response: string): void;
  setNextStreamChunks(chunks: StreamChunk[]): void;
  setNextError(error: Error): void;
  getCallHistory(): GenerateOptions[];
}

function createProviderStub(name: string): ProviderStub {
  let nextResponse: string | null = null;
  let nextStreamChunks: StreamChunk[] | null = null;
  let nextError: Error | null = null;
  const callHistory: GenerateOptions[] = [];

  const defaultModel: ModelConfig = {
    modelId: `${name}-model`,
    maxTokens: 1000,
    temperature: 0.2,
  };

  return {
    name,
    defaultModel,
    isAvailable: () => true,
    setNextResponse(response: string) {
      nextResponse = response;
      nextStreamChunks = null;
      nextError = null;
    },
    setNextStreamChunks(chunks: StreamChunk[]) {
      nextStreamChunks = chunks;
      nextResponse = null;
      nextError = null;
    },
    setNextError(error: Error) {
      nextError = error;
      nextResponse = null;
      nextStreamChunks = null;
    },
    getCallHistory() {
      return [...callHistory];
    },
    async generate(options: GenerateOptions): Promise<string> {
      await Promise.resolve();
      callHistory.push(options);
      if (nextError) {
        const error = nextError;
        nextError = null;
        throw error;
      }
      if (nextResponse !== null) {
        const response = nextResponse;
        nextResponse = null;
        return response;
      }
      return `${name}:response`;
    },
    async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      await Promise.resolve();
      callHistory.push(options);
      if (nextError) {
        const error = nextError;
        nextError = null;
        throw error;
      }
      if (nextStreamChunks !== null) {
        const chunks = nextStreamChunks;
        nextStreamChunks = null;
        for (const chunk of chunks) {
          yield chunk;
        }
        return;
      }
      if (nextResponse !== null) {
        const response = nextResponse;
        nextResponse = null;
        yield { delta: response, done: true };
        return;
      }
      yield { delta: `${name}:chunk`, done: true };
    },
  };
}

describe("DiriRouter", () => {
  describe("pick()", () => {
    it("returns DecisionResponse from cascade resolver", async () => {
      const registry = new Registry();
      const copilot = createProviderStub("copilot");
      registry.register(copilot, ProviderPriorities.COPILOT);

      const router = new DiriRouter({ registry });

      const request: DecisionRequest = {
        chatId: "test-chat-session",
        requestId: "test-request-id",
        agent: { id: "test-agent", role: "coder" },
        task: { type: "simple" },
        modelDimensions: {
          tier: "low" as const,
          modelAttributes: ["reasoning", "agentic"],
          fallbackType: null,
        },
      };

      const response = await router.pick(request);

      expect(response).toBeDefined();
      expect(response.requestId).toBe("test-request-id");
      expect(response.status).toMatch(/^(resolved|no_match)$/);
    });
  });

  describe("chat() with selected provider", () => {
    it("executes against picker-selected provider when provided", async () => {
      const copilot = createProviderStub("copilot");
      const kimi = createProviderStub("kimi");
      copilot.setNextResponse("copilot response");
      kimi.setNextResponse("kimi response");

      const registry = new Registry();
      registry.register(copilot, ProviderPriorities.COPILOT);
      registry.register(kimi, ProviderPriorities.KIMI);

      const router = new DiriRouter({ registry });

      const result = await router.chat({
        prompt: "hello",
        selected: { provider: "kimi", model: "kimi-model" },
      });

      expect(result.text).toBe("kimi response");
      expect(result.provider).toBe("kimi");
      expect(result.model).toBe("kimi-model");
      expect(copilot.getCallHistory()).toHaveLength(0);
      expect(kimi.getCallHistory()).toHaveLength(1);
    });

    it("falls back to registry when picker-selected provider is unavailable", async () => {
      const copilot = createProviderStub("copilot");
      const kimi = createProviderStub("kimi");
      copilot.setNextResponse("copilot response");
      kimi.setNextResponse("kimi response");

      const registry = new Registry();
      registry.register(copilot, ProviderPriorities.COPILOT);
      registry.register(kimi, ProviderPriorities.KIMI);

      const router = new DiriRouter({ registry });

      const result = await router.chat({
        prompt: "hello",
        selected: { provider: "unregistered", model: "unknown-model" },
      });

      expect(result.text).toBe("copilot response");
      expect(result.provider).toBe("copilot");
    });
  });

  describe("chat() without selected provider", () => {
    it("uses registry default when no selection provided", async () => {
      const copilot = createProviderStub("copilot");
      const kimi = createProviderStub("kimi");
      copilot.setNextResponse("copilot response");
      kimi.setNextResponse("kimi response");

      const registry = new Registry();
      registry.register(copilot, ProviderPriorities.COPILOT);
      registry.register(kimi, ProviderPriorities.KIMI);

      const router = new DiriRouter({ registry });

      const result = await router.chat({ prompt: "hello" });

      expect(result.text).toBe("copilot response");
      expect(result.provider).toBe("copilot");
    });
  });

  describe("stream()", () => {
    it("streams from selected provider", async () => {
      const copilot = createProviderStub("copilot");
      const kimi = createProviderStub("kimi");
      copilot.setNextStreamChunks([
        { delta: "co", done: false },
        { delta: "pilot", done: true },
      ]);
      kimi.setNextStreamChunks([
        { delta: "ki", done: false },
        { delta: "mi", done: true },
      ]);

      const registry = new Registry();
      registry.register(copilot, ProviderPriorities.COPILOT);
      registry.register(kimi, ProviderPriorities.KIMI);

      const router = new DiriRouter({ registry });
      const chunks: string[] = [];

      for await (const chunk of router.stream({
        prompt: "hello",
        selected: { provider: "kimi", model: "kimi-model" },
      })) {
        chunks.push(`${chunk.delta}:${String(chunk.done)}`);
      }

      expect(chunks).toEqual(["ki:false", "mi:true"]);
      expect(copilot.getCallHistory()).toHaveLength(0);
      expect(kimi.getCallHistory()).toHaveLength(1);
    });
  });
});
