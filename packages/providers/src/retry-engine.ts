/**
 * Retry engine for @diricode/providers.
 *
 * Provides exponential backoff retry logic with jitter, AbortSignal support,
 * and a discriminated-union result type so callers never need to catch.
 *
 * Retry strategy constants and rules defined in ADR-025.
 */

import type { ClassifiedError } from "./error-classifier.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default maximum number of retry attempts (excluding the initial call). */
export const MAX_RETRIES = 3;

/** Default maximum delay between retries in milliseconds. */
export const MAX_RETRY_DELAY_MS = 15_000;

/** Default base delay for exponential backoff in milliseconds. */
export const BASE_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for the retry engine.
 *
 * All fields are optional; defaults are defined by the ADR-025 constants.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts after the initial call. Default: 3. */
  readonly maxRetries?: number;
  /** Maximum delay between retries in milliseconds. Default: 15 000. */
  readonly maxDelayMs?: number;
  /** Base delay for exponential backoff in milliseconds. Default: 1 000. */
  readonly baseDelayMs?: number;
  /** AbortSignal to cancel the retry loop. */
  readonly signal?: AbortSignal;
}

/**
 * Discriminated union result returned by {@link withRetry}.
 *
 * Never throws — caller checks `ok` before using the value.
 */
export type RetryResult<T> =
  | { readonly ok: true; readonly value: T; readonly attempts: number }
  | { readonly ok: false; readonly error: ClassifiedError; readonly attempts: number };

// ---------------------------------------------------------------------------
// Backoff calculation
// ---------------------------------------------------------------------------

/**
 * Compute the delay in milliseconds for a given retry attempt.
 *
 * Formula: `min(baseDelayMs * 2^attempt + jitter, maxDelayMs)`
 * where jitter is a random value in `[0, baseDelayMs * 0.5)`.
 *
 * If `retryAfterMs > 0` the computed delay is raised to at least that value
 * (server-side Retry-After is respected), but still clamped to `maxDelayMs`.
 *
 * @param attempt - Zero-based attempt index (0 = first retry).
 * @param baseDelayMs - Base delay in milliseconds.
 * @param maxDelayMs - Upper bound on the returned delay.
 * @param retryAfterMs - Server-requested retry delay in milliseconds, or 0.
 * @returns Delay in milliseconds, clamped to `maxDelayMs`.
 */
export function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  retryAfterMs: number,
): number {
  const jitter = Math.random() * baseDelayMs * 0.5;
  const exponential = baseDelayMs * Math.pow(2, attempt) + jitter;
  const capped = Math.min(exponential, maxDelayMs);
  const withRetryAfter = retryAfterMs > 0 ? Math.max(retryAfterMs, capped) : capped;
  return Math.min(withRetryAfter, maxDelayMs);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return a promise that resolves after `ms` milliseconds.
 *
 * If `signal` is already aborted the promise resolves immediately.
 * If `signal` fires while waiting the promise resolves immediately (the caller
 * is responsible for checking signal state after awaiting).
 *
 * @param ms - Delay in milliseconds.
 * @param signal - Optional AbortSignal to cancel the wait early.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const id = setTimeout(resolve, ms);

    if (signal !== undefined) {
      const onAbort = (): void => {
        clearTimeout(id);
        resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

// ---------------------------------------------------------------------------
// Main retry function
// ---------------------------------------------------------------------------

/**
 * Execute `fn` with exponential-backoff retries.
 *
 * - On success, returns `{ ok: true, value, attempts }`.
 * - If the classified error is not retryable, returns `{ ok: false, error, attempts }` immediately.
 * - If all retries are exhausted, returns `{ ok: false, error: lastError, attempts }`.
 * - If `config.signal` is aborted before or during a wait, returns immediately
 *   with the last classified error.
 * - Never throws — all errors are returned as `RetryResult`.
 *
 * @param fn - Async function to execute (and potentially retry).
 * @param classify - Converts a raw thrown error into a {@link ClassifiedError}.
 * @param config - Optional retry configuration overriding ADR-025 defaults.
 * @returns A {@link RetryResult} discriminated union.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  classify: (error: unknown) => ClassifiedError,
  config?: RetryConfig,
): Promise<RetryResult<T>> {
  const maxRetries = config?.maxRetries ?? MAX_RETRIES;
  const maxDelayMs = config?.maxDelayMs ?? MAX_RETRY_DELAY_MS;
  const baseDelayMs = config?.baseDelayMs ?? BASE_DELAY_MS;
  const signal = config?.signal;

  let attempts = 0;
  let lastClassified: ClassifiedError | undefined;

  for (;;) {
    if (attempts > 0 && signal?.aborted) {
      // attempts > 0 means lastClassified was set in previous catch block
      return {
        ok: false,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        error: lastClassified!,
        attempts,
      };
    }

    attempts += 1;

    let value: T;
    try {
      value = await fn();
      return { ok: true, value, attempts };
    } catch (err) {
      const classified = classify(err);
      lastClassified = classified;

      // Non-retryable → fail immediately
      if (!classified.retryable) {
        return { ok: false, error: classified, attempts };
      }

      // All retries exhausted
      if (attempts > maxRetries) {
        return { ok: false, error: classified, attempts };
      }

      // Compute wait time and sleep (respecting abort signal)
      const waitMs = computeDelay(attempts - 1, baseDelayMs, maxDelayMs, classified.retryAfterMs);
      await delay(waitMs, signal);

      // After delay, check if aborted
      if (signal?.aborted) {
        return { ok: false, error: classified, attempts };
      }
    }
  }
}
