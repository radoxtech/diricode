import type { Provider, GenerateOptions, ModelConfig, StreamChunk } from "@diricode/dirirouter";

export interface ProviderStub extends Provider {
  reset(): void;
  setAvailable(available: boolean): void;
  setNextResponse(response: string): void;
  setNextStreamChunks(chunks: StreamChunk[]): void;
  setNextError(error: Error): void;
  getCallHistory(): GenerateOptions[];
}

export interface ProviderStubOptions {
  name?: string;
  defaultModel?: ModelConfig;
  available?: boolean;
}

export function createProviderStub(options: ProviderStubOptions = {}): ProviderStub {
  let available = options.available ?? true;
  let nextResponse: string | null = null;
  let nextStreamChunks: StreamChunk[] | null = null;
  let nextError: Error | null = null;
  const callHistory: GenerateOptions[] = [];

  const defaultModel: ModelConfig = options.defaultModel ?? {
    modelId: "stub-model",
    maxTokens: 1000,
    temperature: 0.7,
  };

  return {
    name: options.name ?? "stub-provider",
    defaultModel,
    isAvailable() {
      return available;
    },
    getModelAvailability() {
      return [];
    },
    setAvailable(value: boolean) {
      available = value;
    },
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
    reset() {
      available = true;
      nextResponse = null;
      nextStreamChunks = null;
      nextError = null;
      callHistory.length = 0;
    },
    getCallHistory() {
      return [...callHistory];
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async generate(opts: GenerateOptions): Promise<string> {
      callHistory.push(opts);
      if (nextError) {
        const err = nextError;
        nextError = null;
        throw err;
      }
      if (nextResponse !== null) {
        const resp = nextResponse;
        nextResponse = null;
        return resp;
      }
      return "stub response";
    },
    async *stream(opts: GenerateOptions): AsyncIterable<StreamChunk> {
      await Promise.resolve();
      callHistory.push(opts);
      if (nextError) {
        const err = nextError;
        nextError = null;
        throw err;
      }
      if (nextStreamChunks !== null) {
        for (const chunk of nextStreamChunks) {
          yield chunk;
        }
        nextStreamChunks = null;
        return;
      }
      if (nextResponse !== null) {
        const resp = nextResponse;
        nextResponse = null;
        yield { delta: resp, done: true };
        return;
      }
      yield { delta: "stub chunk", done: true };
    },
  };
}
