/**
 * Error classifier for the DiriCode provider router.
 *
 * Converts raw provider/API/stream errors into a unified {@link ClassifiedError}
 * shape consumed by the retry engine and fallback chain.
 *
 * Classification rules and retry policies defined in ADR-025.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The 7 normalized error kinds per ADR-025. */
export type ProviderErrorKind =
  | "rate_limited"
  | "context_overflow"
  | "overloaded"
  | "quota_exhausted"
  | "auth_error"
  | "not_found"
  | "other";

/** Structured error output from the classifier. */
export class ClassifiedError extends Error {
  /** One of the 7 normalized error kinds. */
  readonly kind: ProviderErrorKind;
  /** Provider name (e.g. "copilot", "gemini"). */
  readonly provider: string;
  /** Model ID if available. */
  readonly model: string;
  /** Whether the error is retryable per ADR-025 policy. */
  readonly retryable: boolean;
  /** Parsed retry-after delay in milliseconds, or 0 if absent. */
  readonly retryAfterMs: number;
  /** Original raw error for observability/debugging. */
  readonly raw: unknown;

  constructor(params: {
    kind: ProviderErrorKind;
    provider: string;
    model: string;
    retryable: boolean;
    retryAfterMs: number;
    raw: unknown;
  }) {
    super(extractErrorMessage(params.raw));
    this.name = "ClassifiedError";
    this.kind = params.kind;
    this.provider = params.provider;
    this.model = params.model;
    this.retryable = params.retryable;
    this.retryAfterMs = params.retryAfterMs;
    this.raw = params.raw;
  }
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

/**
 * Classify a raw provider error into a normalized {@link ClassifiedError}.
 *
 * Checks are applied in priority order — first match wins.
 * Supports Vercel AI SDK errors, Google Gemini SDK errors, and generic
 * HTTP/fetch errors.
 *
 * @param error - The raw error value (any shape).
 * @param context - Provider and optional model context for the request.
 * @returns A normalized {@link ClassifiedError} with retry policy applied.
 */
export function classifyError(
  error: unknown,
  context: { provider: string; model?: string },
): ClassifiedError {
  if (isClassifiedError(error)) {
    return error;
  }

  if (isClassifiedErrorLike(error)) {
    return new ClassifiedError({
      kind: error.kind,
      provider: error.provider,
      model: error.model,
      retryable: error.retryable,
      retryAfterMs: error.retryAfterMs,
      raw: error.raw,
    });
  }

  const status = extractStatusCode(error);
  const msgLower = getErrorMessageLower(error);

  const kind = classifyKind(status, msgLower);

  return new ClassifiedError({
    kind,
    provider: context.provider,
    model: context.model ?? "",
    retryable: deriveRetryable(kind, error),
    retryAfterMs: parseRetryAfter(error),
    raw: error,
  });
}

// ---------------------------------------------------------------------------
// Retry-after parser
// ---------------------------------------------------------------------------

/** Maximum allowed retry-after delay in milliseconds (1 minute). */
const MAX_RETRY_AFTER_MS = 60_000;

/**
 * Extract retry delay in milliseconds from an error.
 *
 * Checks in order:
 * 1. `Retry-After` header (seconds number or HTTP-date string)
 * 2. `X-RateLimit-Reset` header (Unix timestamp in seconds)
 * 3. Error body fields: `retry_after_ms`, `retry_after`, `retryAfterMs`
 *
 * @param error - The raw error to inspect.
 * @returns Delay in milliseconds, clamped to 60 000 ms; 0 if not found.
 */
export function parseRetryAfter(error: unknown): number {
  if (error === null || error === undefined) {
    return 0;
  }

  // 1. Check headers object (standard Response / Vercel AI SDK shapes)
  const headers = extractHeaders(error);
  if (headers !== undefined) {
    const retryAfter = getHeader(headers, "retry-after");
    if (retryAfter !== undefined) {
      const parsed = parseRetryAfterHeaderValue(retryAfter);
      if (parsed > 0) {
        return Math.min(parsed, MAX_RETRY_AFTER_MS);
      }
    }

    const rateLimitReset = getHeader(headers, "x-ratelimit-reset");
    if (rateLimitReset !== undefined) {
      const resetUnix = Number(rateLimitReset);
      if (!Number.isNaN(resetUnix) && resetUnix > 0) {
        const nowSec = Date.now() / 1000;
        const delayMs = Math.round((resetUnix - nowSec) * 1000);
        if (delayMs > 0) {
          return Math.min(delayMs, MAX_RETRY_AFTER_MS);
        }
      }
    }
  }

  // 2. Check error body / direct fields
  const obj = error as Record<string, unknown>;

  if (typeof obj.retry_after_ms === "number" && obj.retry_after_ms > 0) {
    return Math.min(obj.retry_after_ms, MAX_RETRY_AFTER_MS);
  }

  if (typeof obj.retryAfterMs === "number" && obj.retryAfterMs > 0) {
    return Math.min(obj.retryAfterMs, MAX_RETRY_AFTER_MS);
  }

  if (typeof obj.retry_after === "number" && obj.retry_after > 0) {
    return Math.min(obj.retry_after * 1000, MAX_RETRY_AFTER_MS);
  }

  if (typeof obj.retry_after === "string") {
    const parsed = parseRetryAfterHeaderValue(obj.retry_after);
    if (parsed > 0) {
      return Math.min(parsed, MAX_RETRY_AFTER_MS);
    }
  }

  // 3. Check nested body object
  if (typeof obj.body === "object" && obj.body !== null) {
    const body = obj.body as Record<string, unknown>;

    if (typeof body.retry_after_ms === "number" && body.retry_after_ms > 0) {
      return Math.min(body.retry_after_ms, MAX_RETRY_AFTER_MS);
    }
    if (typeof body.retryAfterMs === "number" && body.retryAfterMs > 0) {
      return Math.min(body.retryAfterMs, MAX_RETRY_AFTER_MS);
    }
    if (typeof body.retry_after === "number" && body.retry_after > 0) {
      return Math.min(body.retry_after * 1000, MAX_RETRY_AFTER_MS);
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Retryable deriver
// ---------------------------------------------------------------------------

/**
 * Derive whether an error kind is retryable per ADR-025 policy.
 *
 * - `rate_limited` → true (retry with backoff)
 * - `overloaded`   → true (retry with backoff)
 * - `other`        → true (retry once, then fail — count managed by retry engine)
 * - `context_overflow` → false (needs fallback to larger-context model)
 * - `quota_exhausted`  → false (needs fallback to different provider)
 * - `auth_error`       → false (fail immediately)
 * - `not_found`        → false (fail immediately)
 *
 * @param kind - The normalized error kind.
 * @returns `true` if the request may be retried.
 */
export function deriveRetryable(kind: ProviderErrorKind, error?: unknown): boolean {
  if (kind === "other" && isEmptyResponseError(error)) {
    return false;
  }

  switch (kind) {
    case "rate_limited":
    case "overloaded":
    case "other":
      return true;
    case "context_overflow":
    case "quota_exhausted":
    case "auth_error":
    case "not_found":
      return false;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Classify to a {@link ProviderErrorKind} from status code and lowercased message.
 * Priority order matches ADR-025 classification rules.
 */
function classifyKind(status: number | undefined, msgLower: string): ProviderErrorKind {
  // 1. rate_limited — HTTP 429, or rate-limit message patterns
  if (
    status === 429 ||
    msgLower.includes("rate limit") ||
    msgLower.includes("rate_limit") ||
    msgLower.includes("too many requests")
  ) {
    return "rate_limited";
  }

  // 2. context_overflow — HTTP 413, or context/token patterns
  if (
    status === 413 ||
    msgLower.includes("context") ||
    /token.*(limit|exceed|overflow|length)/.test(msgLower) ||
    /maximum.*context/.test(msgLower) ||
    /too.*large/.test(msgLower) ||
    /exceeds.*token/.test(msgLower) ||
    msgLower.includes("context_length_exceeded") ||
    /max.*token/.test(msgLower)
  ) {
    return "context_overflow";
  }

  // 3. overloaded — HTTP 5xx/529, or overload/capacity message patterns
  if (
    status === 529 ||
    (status !== undefined && status >= 500 && status < 600) ||
    msgLower.includes("overloaded") ||
    msgLower.includes("service unavailable") ||
    msgLower.includes("capacity")
  ) {
    return "overloaded";
  }

  // 4/5. 403 is treated as auth failure for provider routing.
  if (status === 403) {
    return "auth_error";
  }

  // 4. quota_exhausted — HTTP 402, or quota/billing message patterns
  if (status === 402 || isQuotaMessage(msgLower)) {
    return "quota_exhausted";
  }

  // 5. auth_error — HTTP 401, or auth message patterns
  if (status === 401 || isAuthMessage(msgLower)) {
    return "auth_error";
  }

  // 6. not_found — HTTP 404, or not-found message patterns
  if (
    status === 404 ||
    /model.*not.*found/.test(msgLower) ||
    msgLower.includes("does not exist") ||
    /not.*available/.test(msgLower)
  ) {
    return "not_found";
  }

  // 7. other — fallback
  return "other";
}

/** Returns true when a lowercased message matches quota/billing patterns. */
function isQuotaMessage(msgLower: string): boolean {
  return (
    msgLower.includes("quota") ||
    msgLower.includes("billing") ||
    /limit.*reached/.test(msgLower) ||
    /exceeded.*quota/.test(msgLower) ||
    /monthly.*limit/.test(msgLower) ||
    msgLower.includes("spending")
  );
}

/** Returns true when a lowercased message matches auth patterns. */
function isAuthMessage(msgLower: string): boolean {
  return (
    msgLower.includes("api key") ||
    msgLower.includes("github token") ||
    msgLower.includes("no token available") ||
    msgLower.includes("unauthorized") ||
    msgLower.includes("forbidden") ||
    msgLower.includes("authentication") ||
    /invalid.*key/.test(msgLower) ||
    /access.*denied/.test(msgLower)
  );
}

function isEmptyResponseError(error: unknown): boolean {
  return getErrorMessageLower(error).includes("empty response");
}

function isClassifiedError(error: unknown): error is ClassifiedError {
  return error instanceof ClassifiedError;
}

function isClassifiedErrorLike(error: unknown): error is {
  kind: ProviderErrorKind;
  provider: string;
  model: string;
  retryable: boolean;
  retryAfterMs: number;
  raw: unknown;
} {
  if (error === null || error === undefined || typeof error !== "object") {
    return false;
  }

  const obj = error as Record<string, unknown>;
  return (
    typeof obj.kind === "string" &&
    typeof obj.provider === "string" &&
    typeof obj.model === "string" &&
    typeof obj.retryable === "boolean" &&
    typeof obj.retryAfterMs === "number" &&
    "raw" in obj
  );
}

/**
 * Extract HTTP status code from an error.
 *
 * Tries: `error.status`, `error.statusCode`, `error.response?.status`,
 * `error.status_code`.
 */
function extractStatusCode(error: unknown): number | undefined {
  if (error === null || error === undefined || typeof error !== "object") {
    return undefined;
  }
  const obj = error as Record<string, unknown>;

  const direct =
    typeof obj.status === "number"
      ? obj.status
      : typeof obj.statusCode === "number"
        ? obj.statusCode
        : typeof obj.status_code === "number"
          ? obj.status_code
          : undefined;

  if (direct !== undefined) {
    return direct;
  }

  // Nested: error.response?.status
  if (typeof obj.response === "object" && obj.response !== null) {
    const response = obj.response as Record<string, unknown>;
    if (typeof response.status === "number") {
      return response.status;
    }
  }

  return undefined;
}

/**
 * Extract a human-readable error message from any value.
 *
 * Tries `error.message` first (for Error instances), falls back to `String(error)`.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    error !== null &&
    error !== undefined &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return (error as Record<string, unknown>).message as string;
  }
  return String(error);
}

/**
 * Return the lowercased error message for pattern matching.
 */
function getErrorMessageLower(error: unknown): string {
  return extractErrorMessage(error).toLowerCase();
}

/**
 * Extract a headers map from an error object.
 *
 * Supports objects with a `headers` property (Record or Headers-like).
 */
function extractHeaders(error: unknown): Record<string, string> | Headers | undefined {
  if (error === null || error === undefined || typeof error !== "object") {
    return undefined;
  }
  const obj = error as Record<string, unknown>;
  const h = obj.headers;
  if (h !== undefined && h !== null && typeof h === "object") {
    return h as Record<string, string> | Headers;
  }

  if (typeof obj.response === "object" && obj.response !== null) {
    const response = obj.response as Record<string, unknown>;
    const responseHeaders = response.headers;
    if (
      responseHeaders !== undefined &&
      responseHeaders !== null &&
      typeof responseHeaders === "object"
    ) {
      return responseHeaders as Record<string, string> | Headers;
    }
  }

  return undefined;
}

/**
 * Get a header value (case-insensitive) from a headers object.
 * Supports both plain record objects and `Headers` instances.
 */
function getHeader(headers: Record<string, string> | Headers, name: string): string | undefined {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  const plain = headers as Record<string, string>;
  // Case-insensitive search
  const lower = name.toLowerCase();
  for (const key of Object.keys(plain)) {
    if (key.toLowerCase() === lower) {
      return plain[key];
    }
  }
  return undefined;
}

/**
 * Parse a Retry-After header value into milliseconds.
 *
 * Handles:
 * - Plain integer strings ("30" → 30 000 ms)
 * - HTTP-date strings ("Wed, 21 Oct 2025 07:28:00 GMT" → future delta)
 */
function parseRetryAfterHeaderValue(value: string): number {
  const trimmed = value.trim();

  // Try integer seconds first
  const seconds = Number(trimmed);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  // Try HTTP-date
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }

  return 0;
}
