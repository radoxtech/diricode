import { describe, expect, it, vi } from "vitest";
import {
  MAX_RETRIES,
  MAX_RETRIES_AFTER_FALLBACK,
  ProviderPriorities,
  ProviderRouter,
  ProviderRouterError,
  Registry,
} from "../index.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../index.js";

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
    getModelAvailability: () => [],
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

describe("ProviderRouter", () => {
  it("selects copilot first when the primary provider succeeds", async () => {
    const copilot = createProviderStub("copilot");
    const kimi = createProviderStub("kimi");
    copilot.setNextResponse("copilot response");

    const registry = new Registry();
    registry.register(copilot, ProviderPriorities.COPILOT);
    registry.register(kimi, ProviderPriorities.KIMI);

    const router = new ProviderRouter(registry, { sleep: (_ms) => Promise.resolve() });
    const result = await router.generate({ prompt: "hello" });

    expect(result).toBe("copilot response");
    expect(copilot.getCallHistory()).toHaveLength(1);
    expect(kimi.getCallHistory()).toHaveLength(0);
  });

  it("falls back immediately on quota_exhausted", async () => {
    const copilot = createProviderStub("copilot");
    const kimi = createProviderStub("kimi");
    const fallbackEvents: string[] = [];

    copilot.setNextError(Object.assign(new Error("quota exceeded"), { statusCode: 402 }));
    kimi.setNextResponse("kimi response");

    const registry = new Registry();
    registry.register(copilot, ProviderPriorities.COPILOT);
    registry.register(kimi, ProviderPriorities.KIMI);

    const router = new ProviderRouter(registry, {
      sleep: (_ms) => Promise.resolve(),
      onFallback: (event) =>
        fallbackEvents.push(`${event.fromProvider}->${event.toProvider}:${event.reason}`),
    });

    const result = await router.generate({ prompt: "hello" });

    expect(result).toBe("kimi response");
    expect(copilot.getCallHistory()).toHaveLength(1);
    expect(kimi.getCallHistory()).toHaveLength(1);
    expect(fallbackEvents).toEqual(["copilot->kimi:quota_exhausted"]);
  });

  it("falls back immediately on auth_error", async () => {
    const copilot = createProviderStub("copilot");
    const kimi = createProviderStub("kimi");

    copilot.setNextError(Object.assign(new Error("unauthorized"), { statusCode: 401 }));
    kimi.setNextResponse("kimi response");

    const registry = new Registry();
    registry.register(copilot, ProviderPriorities.COPILOT);
    registry.register(kimi, ProviderPriorities.KIMI);

    const router = new ProviderRouter(registry, { sleep: (_ms) => Promise.resolve() });
    const result = await router.generate({ prompt: "hello" });

    expect(result).toBe("kimi response");
    expect(copilot.getCallHistory()).toHaveLength(1);
    expect(kimi.getCallHistory()).toHaveLength(1);
  });

  it("retries rate_limited errors before falling back", async () => {
    const copilot = createProviderStub("copilot");
    const kimi = createProviderStub("kimi");
    const sleep = vi.fn((_ms: number) => Promise.resolve());

    const rateLimitedError = Object.assign(new Error("Too many requests"), { statusCode: 429 });
    const copilotGenerate = vi.fn(() => Promise.reject(rateLimitedError));
    copilot.generate = copilotGenerate;
    kimi.setNextResponse("kimi response");

    const registry = new Registry();
    registry.register(copilot, ProviderPriorities.COPILOT);
    registry.register(kimi, ProviderPriorities.KIMI);

    const router = new ProviderRouter(registry, { sleep });
    const result = await router.generate({ prompt: "hello" });

    expect(result).toBe("kimi response");
    expect(copilotGenerate).toHaveBeenCalledTimes(MAX_RETRIES + 1);
    expect(kimi.getCallHistory()).toHaveLength(1);
    expect(sleep).toHaveBeenCalledTimes(MAX_RETRIES);
  });

  it("returns a terminal error with attempt history when fallback is exhausted", async () => {
    const copilot = createProviderStub("copilot");
    const kimi = createProviderStub("kimi");

    copilot.generate = vi.fn(() =>
      Promise.reject(Object.assign(new Error("Too many requests"), { statusCode: 429 })),
    );
    kimi.generate = vi.fn(() =>
      Promise.reject(Object.assign(new Error("still rate limited"), { statusCode: 429 })),
    );

    const registry = new Registry();
    registry.register(copilot, ProviderPriorities.COPILOT);
    registry.register(kimi, ProviderPriorities.KIMI);

    const router = new ProviderRouter(registry, { sleep: (_ms) => Promise.resolve() });

    await expect(router.generate({ prompt: "hello" })).rejects.toMatchObject({
      name: "ProviderRouterError",
    });

    await router.generate({ prompt: "hello" }).catch((error: unknown) => {
      expect(error).toBeInstanceOf(ProviderRouterError);
      const routerError = error as ProviderRouterError;
      expect(routerError.attempts).toHaveLength(MAX_RETRIES + MAX_RETRIES_AFTER_FALLBACK + 2);
      expect(routerError.attempts.at(0)?.provider).toBe("copilot");
      expect(routerError.attempts.at(-1)?.provider).toBe("kimi");
      expect(routerError.lastError?.kind).toBe("rate_limited");
    });
  });

  it("falls back for stream requests before any chunk is emitted", async () => {
    const copilot = createProviderStub("copilot");
    const kimi = createProviderStub("kimi");

    copilot.setNextError(Object.assign(new Error("quota exceeded"), { statusCode: 402 }));
    kimi.setNextStreamChunks([
      { delta: "ki", done: false },
      { delta: "mi", done: false },
      { delta: "", done: true },
    ]);

    const registry = new Registry();
    registry.register(copilot, ProviderPriorities.COPILOT);
    registry.register(kimi, ProviderPriorities.KIMI);

    const router = new ProviderRouter(registry, { sleep: (_ms) => Promise.resolve() });
    const chunks: string[] = [];

    for await (const chunk of router.stream({ prompt: "hello" })) {
      chunks.push(`${chunk.delta}:${String(chunk.done)}`);
    }

    expect(chunks).toEqual(["ki:false", "mi:false", ":true"]);
  });
});
