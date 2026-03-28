import { describe, expect, it, vi } from "vitest";
import {
  STREAM_INACTIVITY_TIMEOUT_MS,
  StreamManager,
  StreamTimeoutError,
  USAGE_CHUNK_TIMEOUT_MS,
} from "../stream-manager.js";
import type { StreamChunk } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TimerFn = () => void;

interface FakeTimers {
  readonly setTimeout: (fn: TimerFn, ms: number) => ReturnType<typeof globalThis.setTimeout>;
  readonly clearTimeout: (id: ReturnType<typeof globalThis.setTimeout>) => void;
  triggerAll(): void;
  triggerFirst(): void;
  pendingCount(): number;
}

function makeFakeTimers(): FakeTimers {
  const pending = new Map<number, { fn: TimerFn; ms: number }>();
  let nextId = 1;

  const fakeSetTimeout = (fn: TimerFn, ms: number): ReturnType<typeof globalThis.setTimeout> => {
    const id = nextId++ as unknown as ReturnType<typeof globalThis.setTimeout>;
    pending.set(id as unknown as number, { fn, ms });
    return id;
  };

  const fakeClearTimeout = (id: ReturnType<typeof globalThis.setTimeout>): void => {
    pending.delete(id as unknown as number);
  };

  return {
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    triggerAll() {
      const fns = [...pending.values()].map((e) => e.fn);
      pending.clear();
      for (const fn of fns) fn();
    },
    triggerFirst() {
      const [firstKey, first] = [...pending.entries()][0] ?? [];
      if (first === undefined || firstKey === undefined) return;
      pending.delete(firstKey);
      first.fn();
    },
    pendingCount() {
      return pending.size;
    },
  };
}

async function* makeChunks(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
}

function makeErrorStream(err: Error): AsyncIterable<StreamChunk> {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          await Promise.resolve();
          throw err;
        },
      };
    },
  };
}

async function* makeChunksThenError(chunks: StreamChunk[], err: Error): AsyncIterable<StreamChunk> {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
  throw err;
}

type ChunkWithUsage = StreamChunk & {
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
};

function makeChunkWithUsage(
  delta: string,
  done: boolean,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
): ChunkWithUsage {
  return { delta, done, usage };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StreamManager", () => {
  describe("normal stream completion with usage", () => {
    it("aggregates usage from a usage chunk after done=true", async () => {
      const source = makeChunks([
        { delta: "Hello", done: false },
        { delta: " world", done: false },
        { delta: "", done: true },
        makeChunkWithUsage("", true, { inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
      ]);

      const manager = new StreamManager(source, {
        provider: "test-provider",
        model: "test-model",
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const result = await manager.run();

      expect(result.timedOut).toBe(false);
      expect(result.timeoutType).toBeUndefined();
      expect(result.chunks).toHaveLength(4);
      expect(result.usage).toMatchObject({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        provider: "test-provider",
        model: "test-model",
      });
      expect(result.usage?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("passes all content chunks through stream()", async () => {
      const source = makeChunks([
        { delta: "chunk1", done: false },
        { delta: "chunk2", done: false },
        { delta: "", done: true },
      ]);

      const manager = new StreamManager(source, {
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of manager.stream()) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toMatchObject({ delta: "chunk1", done: false });
      expect(chunks[1]).toMatchObject({ delta: "chunk2", done: false });
      expect(chunks[2]).toMatchObject({ delta: "", done: true });
    });
  });

  describe("normal stream completion without usage (timeout)", () => {
    it("returns no usage when stream ends without a usage chunk", async () => {
      const source = makeChunks([
        { delta: "Hello", done: false },
        { delta: "", done: true },
      ]);

      const manager = new StreamManager(source, {
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const result = await manager.run();

      expect(result.timedOut).toBe(false);
      expect(result.usage).toBeUndefined();
      expect(result.chunks).toHaveLength(2);
    });

    it("continues without hanging when usage timer fires", async () => {
      const timers = makeFakeTimers();

      let usagePhaseReached = false;
      let releaseUsageWait!: () => void;

      const slowUsageChunk: AsyncIterable<StreamChunk> = {
        [Symbol.asyncIterator]() {
          let phase = 0;
          return {
            async next() {
              if (phase === 0) {
                phase = 1;
                return { value: { delta: "hi", done: false }, done: false };
              }
              if (phase === 1) {
                phase = 2;
                return { value: { delta: "", done: true }, done: false };
              }
              usagePhaseReached = true;
              await new Promise<void>((r) => {
                releaseUsageWait = r;
              });
              return { value: undefined as unknown as StreamChunk, done: true };
            },
            return: () =>
              Promise.resolve({ value: undefined as unknown as StreamChunk, done: true }),
          };
        },
      };

      const manager = new StreamManager(slowUsageChunk, { timers });
      const runPromise = manager.run();

      // Poll until the source signals it is inside the usage-wait phase.
      // This is more reliable than counting microtask ticks.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      for (let i = 0; i < 50 && !usagePhaseReached; i++) {
        await Promise.resolve();
      }

      // Fire only the usage timer (inactivity was cleared on entering usage phase).
      timers.triggerAll();
      // Release the blocked source so the iterator can be garbage-collected.
      releaseUsageWait();

      const result = await runPromise;

      expect(result.timedOut).toBe(false);
      expect(result.usage).toBeUndefined();
      expect(result.chunks.some((c) => c.done)).toBe(true);
    });
  });

  describe("inactivity timeout", () => {
    it("throws StreamTimeoutError after inactivity timer fires with no chunks", async () => {
      const timers = makeFakeTimers();
      let resolveBlock!: () => void;

      const blockedSource: AsyncIterable<StreamChunk> = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              await new Promise<void>((r) => {
                resolveBlock = r;
              });
              return { value: { delta: "late", done: true }, done: false };
            },
            return: () =>
              Promise.resolve({ value: undefined as unknown as StreamChunk, done: true }),
          };
        },
      };

      const manager = new StreamManager(blockedSource, { timers });
      const runPromise = manager.run();

      // Give the iterator a tick to start
      await Promise.resolve();

      // Trigger inactivity timeout
      timers.triggerAll();
      // Release the blocked source so cleanup can complete
      resolveBlock();

      const result = await runPromise;

      expect(result.timedOut).toBe(true);
      expect(result.timeoutType).toBe("inactivity");
    });

    it("surface chunks collected before inactivity fires", async () => {
      const timers = makeFakeTimers();

      const partialSource: AsyncIterable<StreamChunk> = {
        [Symbol.asyncIterator]() {
          let phase = 0;
          let releaseBlock!: () => void;
          return {
            async next() {
              if (phase === 0) {
                phase = 1;
                return { value: { delta: "partial", done: false }, done: false };
              }
              // Block indefinitely
              await new Promise<void>((r) => {
                releaseBlock = r;
              });
              releaseBlock();
              return { value: undefined as unknown as StreamChunk, done: true };
            },
            return: () =>
              Promise.resolve({ value: undefined as unknown as StreamChunk, done: true }),
          };
        },
      };

      const manager = new StreamManager(partialSource, { timers });
      const runPromise = manager.run();

      // Let the first chunk be yielded
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Fire inactivity timeout
      timers.triggerAll();

      const result = await runPromise;

      expect(result.timedOut).toBe(true);
      expect(result.timeoutType).toBe("inactivity");
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
      expect(result.chunks[0]).toMatchObject({ delta: "partial" });
    });

    it("resets inactivity timer on each non-empty delta chunk", async () => {
      const timers = makeFakeTimers();

      const source = makeChunks([
        { delta: "a", done: false },
        { delta: "b", done: false },
        { delta: "c", done: false },
        { delta: "", done: true },
      ]);

      const manager = new StreamManager(source, {
        timers,
        usageTimeoutMs: 1,
      });

      const result = await manager.run();

      expect(result.timedOut).toBe(false);
      expect(result.chunks).toHaveLength(4);
    });
  });

  describe("usage timeout after done=true", () => {
    it("returns timedOut=false and no usage when usage wait window expires", async () => {
      const timers = makeFakeTimers();
      let usagePhaseReached = false;
      let releaseUsage!: () => void;

      const sourceWithSlowUsage: AsyncIterable<StreamChunk> = {
        [Symbol.asyncIterator]() {
          let phase = 0;
          return {
            async next() {
              if (phase === 0) {
                phase = 1;
                return { value: { delta: "text", done: false }, done: false };
              }
              if (phase === 1) {
                phase = 2;
                return { value: { delta: "", done: true }, done: false };
              }
              usagePhaseReached = true;
              await new Promise<void>((r) => {
                releaseUsage = r;
              });
              return {
                value: makeChunkWithUsage("", true, {
                  inputTokens: 5,
                  outputTokens: 5,
                  totalTokens: 10,
                }),
                done: false,
              };
            },
            return: () =>
              Promise.resolve({ value: undefined as unknown as StreamChunk, done: true }),
          };
        },
      };

      const manager = new StreamManager(sourceWithSlowUsage, { timers });
      const runPromise = manager.run();

      // Poll until the source confirms it is inside the usage-wait phase.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      for (let i = 0; i < 50 && !usagePhaseReached; i++) {
        await Promise.resolve();
      }

      // At this point only the usage timer is pending (inactivity was cleared).
      timers.triggerAll();
      // Release the blocked source so cleanup can complete.
      releaseUsage();

      const result = await runPromise;

      expect(result.timedOut).toBe(false);
      expect(result.usage).toBeUndefined();
      expect(result.chunks.some((c) => c.done && c.delta === "")).toBe(true);
    });
  });

  describe("provider error during stream", () => {
    it("propagates provider errors that are not timeout errors", async () => {
      const providerError = new Error("Provider exploded");
      const source = makeErrorStream(providerError);

      const manager = new StreamManager(source, {
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      await expect(manager.run()).rejects.toThrow("Provider exploded");
    });

    it("propagates error thrown mid-stream after partial chunks", async () => {
      const partialChunks: StreamChunk[] = [
        { delta: "partial ", done: false },
        { delta: "output", done: false },
      ];
      const midStreamError = new Error("Network dropped");
      const source = makeChunksThenError(partialChunks, midStreamError);

      const manager = new StreamManager(source, {
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      await expect(manager.run()).rejects.toThrow("Network dropped");
    });
  });

  describe("AbortSignal cancellation", () => {
    it("stops consuming chunks when signal is aborted before stream starts", async () => {
      const controller = new AbortController();
      controller.abort();

      const source = makeChunks([
        { delta: "should not yield", done: false },
        { delta: "", done: true },
      ]);

      const manager = new StreamManager(source, {
        signal: controller.signal,
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const result = await manager.run();

      expect(result.timedOut).toBe(false);
      expect(result.chunks).toHaveLength(0);
    });

    it("stops mid-stream when signal is aborted", async () => {
      const controller = new AbortController();

      let resolveNext!: () => void;

      const abortingSource: AsyncIterable<StreamChunk> = {
        [Symbol.asyncIterator]() {
          let phase = 0;
          return {
            async next() {
              if (phase === 0) {
                phase = 1;
                return { value: { delta: "chunk1", done: false }, done: false };
              }
              if (phase === 1) {
                phase = 2;
                controller.abort();
                await new Promise<void>((r) => {
                  resolveNext = r;
                });
                resolveNext();
                return { value: { delta: "chunk2", done: false }, done: false };
              }
              return { value: undefined as unknown as StreamChunk, done: true };
            },
            return: () =>
              Promise.resolve({ value: undefined as unknown as StreamChunk, done: true }),
          };
        },
      };

      const manager = new StreamManager(abortingSource, {
        signal: controller.signal,
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const result = await manager.run();

      expect(result.timedOut).toBe(false);
    });
  });

  describe("partial data on cancellation", () => {
    it("returns chunks collected before cancellation", async () => {
      const controller = new AbortController();

      const partialSource: AsyncIterable<StreamChunk> = {
        [Symbol.asyncIterator]() {
          let phase = 0;
          return {
            next() {
              if (phase === 0) {
                phase = 1;
                return Promise.resolve({
                  value: { delta: "partial data", done: false },
                  done: false,
                });
              }
              controller.abort();
              return Promise.resolve({ value: undefined as unknown as StreamChunk, done: true });
            },
            return: () =>
              Promise.resolve({ value: undefined as unknown as StreamChunk, done: true }),
          };
        },
      };

      const manager = new StreamManager(partialSource, {
        signal: controller.signal,
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const result = await manager.run();

      expect(result.timedOut).toBe(false);
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
      expect(result.chunks[0]).toMatchObject({ delta: "partial data" });
    });
  });

  describe("StreamTimeoutError", () => {
    it("has correct kind, timeoutType, and elapsedMs fields", () => {
      const err = new StreamTimeoutError("inactivity", 5000);
      expect(err.kind).toBe("stream_timeout");
      expect(err.timeoutType).toBe("inactivity");
      expect(err.elapsedMs).toBe(5000);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("StreamTimeoutError");
    });

    it("uses default message when no custom message provided", () => {
      const inactivityErr = new StreamTimeoutError("inactivity", 60000);
      expect(inactivityErr.message).toContain("60000ms");

      const usageErr = new StreamTimeoutError("usage", 10000);
      expect(usageErr.message).toContain("10000ms");
    });

    it("uses custom message when provided", () => {
      const err = new StreamTimeoutError("inactivity", 1000, "custom message");
      expect(err.message).toBe("custom message");
    });
  });

  describe("constants", () => {
    it("exports expected default timeout values", () => {
      expect(STREAM_INACTIVITY_TIMEOUT_MS).toBe(60_000);
      expect(USAGE_CHUNK_TIMEOUT_MS).toBe(10_000);
    });
  });

  describe("stream() method", () => {
    it("yields chunks from the source", async () => {
      const source = makeChunks([
        { delta: "a", done: false },
        { delta: "b", done: true },
      ]);

      const manager = new StreamManager(source, {
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const yielded: StreamChunk[] = [];
      for await (const chunk of manager.stream()) {
        yielded.push(chunk);
      }

      expect(yielded).toHaveLength(2);
      expect(yielded[0]?.delta).toBe("a");
      expect(yielded[1]?.delta).toBe("b");
    });

    it("handles source that ends without done=true chunk gracefully", async () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      async function* noFinalChunk(): AsyncGenerator<StreamChunk> {
        yield { delta: "partial", done: false };
        // Intentionally no final done=true chunk
      }

      const manager = new StreamManager(noFinalChunk(), {
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const result = await manager.run();

      expect(result.timedOut).toBe(false);
      expect(result.chunks).toHaveLength(1);
    });
  });

  describe("run() with inactivity timeout sets timedOut", () => {
    it("returns partial chunks and timedOut=true on inactivity timeout", async () => {
      const timers = makeFakeTimers();

      const source: AsyncIterable<StreamChunk> = {
        [Symbol.asyncIterator]() {
          let phase = 0;
          return {
            async next() {
              if (phase === 0) {
                phase = 1;
                return { value: { delta: "pre-timeout", done: false }, done: false };
              }
              await new Promise<void>(() => {
                // Intentional infinite wait for timeout testing
              });
              return { value: undefined as unknown as StreamChunk, done: true };
            },
            return: () =>
              Promise.resolve({ value: undefined as unknown as StreamChunk, done: true }),
          };
        },
      };

      const manager = new StreamManager(source, { timers });
      const runPromise = manager.run();

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      timers.triggerAll();

      const result = await runPromise;

      expect(result.timedOut).toBe(true);
      expect(result.timeoutType).toBe("inactivity");
      expect(result.chunks.some((c) => c.delta === "pre-timeout")).toBe(true);
    });
  });

  describe("usage surfaced from inline chunk metadata", () => {
    it("picks up usage from a chunk that has usage embedded and done=true", async () => {
      const source = makeChunks([
        { delta: "text", done: false },
        makeChunkWithUsage("", true, { inputTokens: 3, outputTokens: 7, totalTokens: 10 }),
      ]);

      const manager = new StreamManager(source, {
        provider: "p",
        model: "m",
        inactivityTimeoutMs: 5_000,
        usageTimeoutMs: 5_000,
      });

      const result = await manager.run();

      expect(result.usage).toMatchObject({
        inputTokens: 3,
        outputTokens: 7,
        totalTokens: 10,
        provider: "p",
        model: "m",
      });
    });
  });

  describe("vi.fn mock integration", () => {
    it("tracks timer calls via vi.fn spies", async () => {
      const mockSetTimeout = vi.fn(
        (fn: TimerFn, _ms: number): ReturnType<typeof globalThis.setTimeout> => {
          fn();
          return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
        },
      );
      const mockClearTimeout = vi.fn((_id: ReturnType<typeof globalThis.setTimeout>): void => {
        // noop - mock implementation
      });

      const source = makeChunks([{ delta: "x", done: true }]);

      const manager = new StreamManager(source, {
        timers: { setTimeout: mockSetTimeout, clearTimeout: mockClearTimeout },
        usageTimeoutMs: 1,
      });

      await manager.run();

      expect(mockSetTimeout).toHaveBeenCalled();
    });
  });
});
