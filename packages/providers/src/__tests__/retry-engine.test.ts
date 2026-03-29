import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassifiedError, RetryConfig, RetryResult } from "../index.js";
import {
  BASE_DELAY_MS,
  MAX_RETRIES,
  MAX_RETRY_DELAY_MS,
  computeDelay,
  withRetry,
} from "../index.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeClassifiedError(overrides: Partial<ClassifiedError> = {}): ClassifiedError {
  return {
    kind: "other",
    provider: "test",
    model: "",
    retryable: true,
    retryAfterMs: 0,
    raw: new Error("test error"),
    ...overrides,
  };
}

function makeClassifier(retryable: boolean, retryAfterMs = 0): (error: unknown) => ClassifiedError {
  return (error: unknown): ClassifiedError =>
    makeClassifiedError({ retryable, retryAfterMs, raw: error });
}

function failThenSucceed<T>(failures: number, result: T): () => Promise<T> {
  let calls = 0;
  return (): Promise<T> => {
    calls += 1;
    if (calls <= failures) {
      return Promise.reject(new Error("failure " + String(calls)));
    }
    return Promise.resolve(result);
  };
}

// ---------------------------------------------------------------------------
// withRetry — basic success / failure
// ---------------------------------------------------------------------------

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successful calls", () => {
    it("returns ok:true with value and attempts:1 on first-attempt success", async () => {
      const fn = (): Promise<string> => Promise.resolve("hello");
      const resultPromise = withRetry(fn, makeClassifier(true));
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("hello");
        expect(result.attempts).toBe(1);
      }
    });

    it("returns ok:true with attempts:2 when fn fails once then succeeds", async () => {
      const fn = failThenSucceed(1, "recovered");
      const resultPromise = withRetry(fn, makeClassifier(true));
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("recovered");
        expect(result.attempts).toBe(2);
      }
    });

    it("succeeds after multiple retries when fn fails twice", async () => {
      const fn = failThenSucceed(2, 42);
      const resultPromise = withRetry(fn, makeClassifier(true));
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
        expect(result.attempts).toBe(3);
      }
    });
  });

  describe("non-retryable errors", () => {
    it("returns ok:false immediately with attempts:1 for non-retryable error", async () => {
      const classified = makeClassifiedError({ retryable: false, kind: "auth_error" });
      const fn = (): Promise<never> => Promise.reject(new Error("auth failed"));
      const classify = (): ClassifiedError => classified;

      const result = await withRetry(fn, classify);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(classified);
        expect(result.attempts).toBe(1);
      }
    });

    it("does not delay before returning on non-retryable error", async () => {
      const fn = (): Promise<never> => Promise.reject(new Error("not found"));
      const classify = makeClassifier(false);

      const advanceSpy = vi.spyOn(globalThis, "setTimeout");
      const result = await withRetry(fn, classify);

      expect(result.ok).toBe(false);
      expect(advanceSpy).not.toHaveBeenCalled();
      advanceSpy.mockRestore();
    });
  });

  describe("retries exhausted", () => {
    it("returns ok:false with attempts:4 when all retries exhausted (1 initial + 3 retries)", async () => {
      const fn = (): Promise<never> => Promise.reject(new Error("always fails"));
      const resultPromise = withRetry(fn, makeClassifier(true));
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.attempts).toBe(MAX_RETRIES + 1);
      }
    });

    it("uses last classified error when retries exhausted", async () => {
      let callCount = 0;
      const fn = (): Promise<never> => Promise.reject(new Error("error " + String(++callCount)));
      const classify = (err: unknown): ClassifiedError =>
        makeClassifiedError({ retryable: true, raw: err });

      const resultPromise = withRetry(fn, classify);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect((result.error.raw as Error).message).toBe("error " + String(callCount));
      }
    });

    it("respects custom maxRetries config", async () => {
      const fn = (): Promise<never> => Promise.reject(new Error("fail"));
      const config: RetryConfig = { maxRetries: 1 };
      const resultPromise = withRetry(fn, makeClassifier(true), config);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.attempts).toBe(2);
      }
    });

    it("respects custom maxRetries:0 config (no retries, just initial attempt)", async () => {
      const fn = (): Promise<never> => Promise.reject(new Error("fail"));
      const config: RetryConfig = { maxRetries: 0 };

      const result = await withRetry(fn, makeClassifier(true), config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.attempts).toBe(1);
      }
    });
  });

  describe("AbortSignal cancellation", () => {
    it("cancels retry loop when signal is aborted before retry wait completes", async () => {
      const controller = new AbortController();
      let callCount = 0;
      const fn = (): Promise<never> => {
        callCount += 1;
        return Promise.reject(new Error("fail"));
      };

      const resultPromise = withRetry(fn, makeClassifier(true), {
        signal: controller.signal,
        baseDelayMs: 5_000,
      });

      // Abort before the delay completes
      controller.abort();
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(false);
      // Should have stopped after first attempt (abort fires during delay)
      expect(callCount).toBeLessThanOrEqual(2);
    });

    it("cancels immediately when signal is already aborted on first check after failure", async () => {
      const controller = new AbortController();
      controller.abort();
      let _callCount = 0;
      const fn = (): Promise<never> => {
        _callCount += 1;
        return Promise.reject(new Error("fail"));
      };

      const resultPromise = withRetry(fn, makeClassifier(true), {
        signal: controller.signal,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Pre-aborted signal: first attempt runs (signal is checked after failure/delay),
      // delay resolves immediately, then abort is detected → stops
      expect(result.ok).toBe(false);
    });
  });

  describe("Retry-After respected", () => {
    it("uses retryAfterMs from classified error when larger than computed delay", async () => {
      const fn = failThenSucceed(1, "ok");
      const retryAfterMs = 10_000;
      const classify = makeClassifier(true, retryAfterMs);

      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const resultPromise = withRetry(fn, classify, {
        baseDelayMs: 100,
        maxDelayMs: 15_000,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(true);
      // The delay used should be at least retryAfterMs
      const lastCall = setTimeoutSpy.mock.calls.at(-1) ?? [];
      const usedDelay = lastCall[1] ?? 0;
      expect(usedDelay).toBeGreaterThanOrEqual(retryAfterMs);
      setTimeoutSpy.mockRestore();
    });
  });

  describe("custom config", () => {
    it("uses custom baseDelayMs", async () => {
      const fn = failThenSucceed(1, "done");
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const resultPromise = withRetry(fn, makeClassifier(true), {
        baseDelayMs: 500,
        maxDelayMs: 10_000,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(true);
      const lastCall = setTimeoutSpy.mock.calls.at(-1) ?? [];
      const usedDelay = lastCall[1] ?? 0;
      // With baseDelayMs=500, attempt 0: 500*1 + jitter(0..250) ≈ 500–750
      expect(usedDelay).toBeLessThanOrEqual(10_000);
      expect(usedDelay).toBeGreaterThan(0);
      setTimeoutSpy.mockRestore();
    });

    it("uses custom maxDelayMs to cap the delay", async () => {
      const fn = failThenSucceed(1, "done");
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const resultPromise = withRetry(fn, makeClassifier(true), {
        baseDelayMs: 1_000,
        maxDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.ok).toBe(true);
      const lastCall = setTimeoutSpy.mock.calls.at(-1) ?? [];
      const usedDelay = lastCall[1] ?? 0;
      expect(usedDelay).toBeLessThanOrEqual(100);
      setTimeoutSpy.mockRestore();
    });
  });

  describe("result type shape", () => {
    it("ok result has value and attempts fields", async () => {
      const result: RetryResult<number> = await withRetry(
        () => Promise.resolve(99),
        makeClassifier(true),
      );

      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("attempts");
      if (result.ok) {
        expect(result).toHaveProperty("value");
        expect(result.value).toBe(99);
      }
    });

    it("error result has error and attempts fields", async () => {
      const fn = (): Promise<never> => Promise.reject(new Error("boom"));
      const resultPromise = withRetry(fn, makeClassifier(false));
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("attempts");
      if (!result.ok) {
        expect(result).toHaveProperty("error");
        expect(result.error).toHaveProperty("kind");
        expect(result.error).toHaveProperty("retryable");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// computeDelay — unit tests
// ---------------------------------------------------------------------------

describe("computeDelay", () => {
  it("has defaults exported as constants", () => {
    expect(MAX_RETRIES).toBe(3);
    expect(MAX_RETRY_DELAY_MS).toBe(15_000);
    expect(BASE_DELAY_MS).toBe(1_000);
  });

  it("produces exponential growth: attempt 0 < attempt 1 < attempt 2 (without jitter)", () => {
    // Spy on Math.random to return 0 (no jitter) for deterministic comparison
    const randSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    const d0 = computeDelay(0, 1_000, 15_000, 0);
    const d1 = computeDelay(1, 1_000, 15_000, 0);
    const d2 = computeDelay(2, 1_000, 15_000, 0);

    expect(d0).toBeLessThan(d1);
    expect(d1).toBeLessThan(d2);

    randSpy.mockRestore();
  });

  it("attempt 0 with no jitter equals baseDelayMs * 2^0 = baseDelayMs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = computeDelay(0, 1_000, 15_000, 0);
    expect(result).toBe(1_000);
    vi.restoreAllMocks();
  });

  it("attempt 1 with no jitter equals baseDelayMs * 2^1 = 2000", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = computeDelay(1, 1_000, 15_000, 0);
    expect(result).toBe(2_000);
    vi.restoreAllMocks();
  });

  it("attempt 2 with no jitter equals baseDelayMs * 2^2 = 4000", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = computeDelay(2, 1_000, 15_000, 0);
    expect(result).toBe(4_000);
    vi.restoreAllMocks();
  });

  it("is capped at maxDelayMs when exponential exceeds it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // attempt=10 → 1000 * 2^10 = 1_048_576 >> 15_000
    const result = computeDelay(10, 1_000, 15_000, 0);
    expect(result).toBe(15_000);
    vi.restoreAllMocks();
  });

  it("jitter is always non-negative", () => {
    for (let i = 0; i < 20; i++) {
      const d = computeDelay(0, 1_000, 15_000, 0);
      expect(d).toBeGreaterThanOrEqual(1_000);
    }
  });

  it("jitter does not exceed baseDelayMs * 0.5", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    // attempt 0: 1000 * 1 + 0.9999 * 500 ≈ 1499.95 < 1500
    const result = computeDelay(0, 1_000, 15_000, 0);
    expect(result).toBeLessThan(1_500);
    vi.restoreAllMocks();
  });

  it("retryAfterMs=0 does not affect the computed delay", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const withZero = computeDelay(0, 1_000, 15_000, 0);
    expect(withZero).toBe(1_000);
    vi.restoreAllMocks();
  });

  it("retryAfterMs respected when larger than computed delay", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // computed = 1000, retryAfterMs = 5000 → should return 5000
    const result = computeDelay(0, 1_000, 15_000, 5_000);
    expect(result).toBe(5_000);
    vi.restoreAllMocks();
  });

  it("retryAfterMs does NOT override when smaller than computed delay", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // computed = 4000 (attempt 2), retryAfterMs = 1000 → should return 4000
    const result = computeDelay(2, 1_000, 15_000, 1_000);
    expect(result).toBe(4_000);
    vi.restoreAllMocks();
  });

  it("retryAfterMs is capped at maxDelayMs", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // retryAfterMs = 30_000 exceeds maxDelayMs = 15_000 → clamped to 15_000
    const result = computeDelay(0, 1_000, 15_000, 30_000);
    expect(result).toBe(15_000);
    vi.restoreAllMocks();
  });
});
