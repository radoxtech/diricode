import type { StreamChunk } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STREAM_INACTIVITY_TIMEOUT_MS = 60_000;
export const USAGE_CHUNK_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// StreamUsage
// ---------------------------------------------------------------------------

export interface StreamUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly durationMs: number;
  readonly provider: string;
  readonly model: string;
}

// ---------------------------------------------------------------------------
// StreamTimeoutError
// ---------------------------------------------------------------------------

export class StreamTimeoutError extends Error {
  readonly kind = "stream_timeout" as const;
  readonly timeoutType: "inactivity" | "usage";
  readonly elapsedMs: number;

  constructor(timeoutType: "inactivity" | "usage", elapsedMs: number, message?: string) {
    const defaultMessage =
      timeoutType === "inactivity"
        ? `Stream inactivity timeout after ${String(elapsedMs)}ms`
        : `Usage data timeout after ${String(elapsedMs)}ms`;
    super(message ?? defaultMessage);
    this.name = "StreamTimeoutError";
    this.timeoutType = timeoutType;
    this.elapsedMs = elapsedMs;
  }
}

// ---------------------------------------------------------------------------
// StreamManagerOptions
// ---------------------------------------------------------------------------

export interface StreamManagerOptions {
  readonly inactivityTimeoutMs?: number;
  readonly usageTimeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly provider?: string;
  readonly model?: string;
  readonly timers?: {
    setTimeout: (fn: () => void, ms: number) => ReturnType<typeof globalThis.setTimeout>;
    clearTimeout: (id: ReturnType<typeof globalThis.setTimeout>) => void;
  };
}

// ---------------------------------------------------------------------------
// StreamManagerResult
// ---------------------------------------------------------------------------

export interface StreamManagerResult {
  readonly usage?: StreamUsage;
  readonly chunks: StreamChunk[];
  readonly timedOut: boolean;
  readonly timeoutType?: "inactivity" | "usage";
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface ChunkUsageData {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

// ---------------------------------------------------------------------------
// StreamManager
// ---------------------------------------------------------------------------

export class StreamManager {
  readonly #source: AsyncIterable<StreamChunk>;
  readonly #inactivityTimeoutMs: number;
  readonly #usageTimeoutMs: number;
  readonly #signal: AbortSignal | undefined;
  readonly #provider: string;
  readonly #model: string;
  readonly #timerSet: (fn: () => void, ms: number) => TimerHandle;
  readonly #timerClear: (id: TimerHandle) => void;

  constructor(source: AsyncIterable<StreamChunk>, options: StreamManagerOptions = {}) {
    this.#source = source;
    this.#inactivityTimeoutMs = options.inactivityTimeoutMs ?? STREAM_INACTIVITY_TIMEOUT_MS;
    this.#usageTimeoutMs = options.usageTimeoutMs ?? USAGE_CHUNK_TIMEOUT_MS;
    this.#signal = options.signal;
    this.#provider = options.provider ?? "";
    this.#model = options.model ?? "";
    this.#timerSet = options.timers?.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
    this.#timerClear =
      options.timers?.clearTimeout ??
      ((id) => {
        globalThis.clearTimeout(id);
      });
  }

  async *stream(): AsyncIterable<StreamChunk> {
    const startMs = Date.now();

    // Each pull from the source is raced against this interrupt channel.
    // Both the inactivity timer and the abort signal resolve it.
    let resolveInterrupt!: (value: "inactivity_timeout" | "abort") => void;
    const interruptPromise = new Promise<"inactivity_timeout" | "abort">((r) => {
      resolveInterrupt = r;
    });

    let inactivityTimerId: TimerHandle | undefined;

    const resetInactivityTimer = (): void => {
      if (inactivityTimerId !== undefined) {
        this.#timerClear(inactivityTimerId);
      }
      inactivityTimerId = this.#timerSet(() => {
        resolveInterrupt("inactivity_timeout");
      }, this.#inactivityTimeoutMs);
    };

    const onAbort = (): void => {
      resolveInterrupt("abort");
    };

    if (this.#signal?.aborted) {
      return;
    }

    this.#signal?.addEventListener("abort", onAbort);
    resetInactivityTimer();

    try {
      let seenDone = false;
      const iter = this.#source[Symbol.asyncIterator]();

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const isAborted = this.#signal && this.#signal.aborted;
        if (isAborted) {
          return;
        }

        const raceResult = await Promise.race([
          iter.next().then((r) => ({ tag: "chunk" as const, result: r })),
          interruptPromise.then((reason) => ({ tag: "interrupt" as const, reason })),
        ]);

        if (raceResult.tag === "interrupt") {
          await iter.return?.();
          if (raceResult.reason === "inactivity_timeout") {
            throw new StreamTimeoutError("inactivity", Date.now() - startMs);
          }
          return;
        }

        const [chunk, iterDone] = getChunkResult(raceResult);

        if (iterDone) {
          break;
        }

        if (chunk.delta !== "") {
          resetInactivityTimer();
        }

        yield chunk;

        if (chunk.done) {
          seenDone = true;
          break;
        }
      }

      if (seenDone) {
        if (inactivityTimerId !== undefined) {
          this.#timerClear(inactivityTimerId);
          inactivityTimerId = undefined;
        }

        let resolveUsageInterrupt!: (v: "usage_timeout" | "abort") => void;
        const usageInterruptPromise = new Promise<"usage_timeout" | "abort">((r) => {
          resolveUsageInterrupt = r;
        });

        const usageTimerId = this.#timerSet(() => {
          resolveUsageInterrupt("usage_timeout");
        }, this.#usageTimeoutMs);

        const onAbortUsage = (): void => {
          resolveUsageInterrupt("abort");
        };
        this.#signal?.addEventListener("abort", onAbortUsage);

        try {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          while (true) {
            const isAborted = this.#signal && this.#signal.aborted;
            if (isAborted) {
              break;
            }

            const raceResult = await Promise.race([
              iter.next().then((r) => ({ tag: "chunk" as const, result: r })),
              usageInterruptPromise.then((reason) => ({ tag: "interrupt" as const, reason })),
            ]);

            if (raceResult.tag === "interrupt") {
              break;
            }

            const [chunk, iterDone] = getChunkResult(raceResult);

            if (iterDone) {
              break;
            }

            yield chunk;

            if (hasUsageData(chunk) || chunk.done) {
              break;
            }
          }
        } finally {
          this.#timerClear(usageTimerId);
          this.#signal?.removeEventListener("abort", onAbortUsage);
        }
      }
    } finally {
      if (inactivityTimerId !== undefined) {
        this.#timerClear(inactivityTimerId);
      }
      this.#signal?.removeEventListener("abort", onAbort);
    }
  }

  async run(): Promise<StreamManagerResult> {
    const startMs = Date.now();
    const chunks: StreamChunk[] = [];
    let usage: StreamUsage | undefined;
    let timedOut = false;
    let timeoutType: "inactivity" | "usage" | undefined;

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;

    try {
      for await (const chunk of this.stream()) {
        chunks.push(chunk);

        const cu = extractChunkUsage(chunk);
        if (cu !== undefined) {
          if (cu.inputTokens !== undefined) inputTokens = cu.inputTokens;
          if (cu.outputTokens !== undefined) outputTokens = cu.outputTokens;
          if (cu.totalTokens !== undefined) totalTokens = cu.totalTokens;
        }
      }
    } catch (err) {
      if (err instanceof StreamTimeoutError && err.timeoutType === "inactivity") {
        timedOut = true;
        timeoutType = "inactivity";
      } else {
        throw err;
      }
    }

    const durationMs = Date.now() - startMs;

    if (inputTokens > 0 || outputTokens > 0 || totalTokens > 0) {
      usage = {
        inputTokens,
        outputTokens,
        totalTokens: totalTokens > 0 ? totalTokens : inputTokens + outputTokens,
        durationMs,
        provider: this.#provider,
        model: this.#model,
      };
    }

    return { usage, chunks, timedOut, timeoutType };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getChunkResult(raceResult: unknown): [chunk: StreamChunk, done: boolean] {
  const typed = raceResult as { tag: "chunk"; result: IteratorResult<StreamChunk> };
  return [typed.result.value, typed.result.done ?? false];
}

function hasUsageData(chunk: StreamChunk): boolean {
  const c = chunk as unknown as Record<string, unknown>;
  return typeof c.usage === "object" && c.usage !== null;
}

function extractChunkUsage(chunk: StreamChunk): ChunkUsageData | undefined {
  const c = chunk as unknown as Record<string, unknown>;
  const usage = c.usage;
  if (typeof usage !== "object" || usage === null) {
    return undefined;
  }
  const u = usage as Record<string, unknown>;
  return {
    inputTokens: typeof u.inputTokens === "number" ? u.inputTokens : undefined,
    outputTokens: typeof u.outputTokens === "number" ? u.outputTokens : undefined,
    totalTokens: typeof u.totalTokens === "number" ? u.totalTokens : undefined,
  };
}
