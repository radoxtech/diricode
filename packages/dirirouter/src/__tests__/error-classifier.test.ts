import { describe, expect, it } from "vitest";
import { ClassifiedError, type ProviderErrorKind } from "../index.js";
import { classifyError, deriveRetryable, parseRetryAfter } from "../index.js";

describe("classifyError", () => {
  describe("status code mapping", () => {
    it("401 → auth_error", () => {
      const err = { statusCode: 401, message: "Unauthorized" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("auth_error");
    });

    it("403 with no special message → auth_error", () => {
      const err = { statusCode: 403, message: "Forbidden" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("auth_error");
    });

    it("403 with 'quota' message → auth_error", () => {
      const err = { statusCode: 403, message: "You have exceeded your quota" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("auth_error");
    });

    it("404 → not_found", () => {
      const err = { statusCode: 404, message: "Not Found" };
      expect(classifyError(err, { provider: "gemini" }).kind).toBe("not_found");
    });

    it("413 → context_overflow", () => {
      const err = { statusCode: 413, message: "Payload Too Large" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("context_overflow");
    });

    it("429 → rate_limited", () => {
      const err = { statusCode: 429, message: "Too Many Requests" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("rate_limited");
    });

    it("500 → overloaded", () => {
      const err = { statusCode: 500, message: "Internal Server Error" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("overloaded");
    });

    it("502 → overloaded", () => {
      const err = { statusCode: 502, message: "Bad Gateway" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("overloaded");
    });

    it("503 → overloaded", () => {
      const err = { statusCode: 503, message: "Service Unavailable" };
      expect(classifyError(err, { provider: "gemini" }).kind).toBe("overloaded");
    });

    it("529 → overloaded", () => {
      const err = { statusCode: 529, message: "Server Overloaded" };
      expect(classifyError(err, { provider: "copilot" }).kind).toBe("overloaded");
    });
  });

  describe("message pattern matching", () => {
    function errWithMsg(message: string): Error {
      return new Error(message);
    }

    it('"rate limit exceeded" → rate_limited', () => {
      expect(classifyError(errWithMsg("Rate limit exceeded"), { provider: "gemini" }).kind).toBe(
        "rate_limited",
      );
    });

    it('"too many requests" → rate_limited', () => {
      expect(classifyError(errWithMsg("Too many requests"), { provider: "copilot" }).kind).toBe(
        "rate_limited",
      );
    });

    it('"context length exceeded" → context_overflow', () => {
      expect(
        classifyError(errWithMsg("context length exceeded"), { provider: "copilot" }).kind,
      ).toBe("context_overflow");
    });

    it('"maximum context length" → context_overflow', () => {
      expect(
        classifyError(errWithMsg("maximum context length is 4096"), { provider: "copilot" }).kind,
      ).toBe("context_overflow");
    });

    it('"token limit exceeded" → context_overflow', () => {
      expect(classifyError(errWithMsg("token limit exceeded"), { provider: "gemini" }).kind).toBe(
        "context_overflow",
      );
    });

    it('"service unavailable" → overloaded', () => {
      expect(classifyError(errWithMsg("service unavailable"), { provider: "copilot" }).kind).toBe(
        "overloaded",
      );
    });

    it('"server is overloaded" → overloaded', () => {
      expect(
        classifyError(errWithMsg("The server is overloaded. Try again later."), {
          provider: "gemini",
        }).kind,
      ).toBe("overloaded");
    });

    it('"quota exceeded" → quota_exhausted', () => {
      expect(classifyError(errWithMsg("quota exceeded"), { provider: "gemini" }).kind).toBe(
        "quota_exhausted",
      );
    });

    it('"billing limit reached" → quota_exhausted', () => {
      expect(classifyError(errWithMsg("billing limit reached"), { provider: "copilot" }).kind).toBe(
        "quota_exhausted",
      );
    });

    it('"invalid api key" → auth_error', () => {
      expect(classifyError(errWithMsg("invalid api key"), { provider: "gemini" }).kind).toBe(
        "auth_error",
      );
    });

    it('"unauthorized access" → auth_error', () => {
      expect(classifyError(errWithMsg("unauthorized access"), { provider: "copilot" }).kind).toBe(
        "auth_error",
      );
    });

    it('"model not found" → not_found', () => {
      expect(classifyError(errWithMsg("model not found"), { provider: "copilot" }).kind).toBe(
        "not_found",
      );
    });

    it('"does not exist" → not_found', () => {
      expect(
        classifyError(errWithMsg("resource does not exist"), { provider: "gemini" }).kind,
      ).toBe("not_found");
    });

    it("random unknown message → other", () => {
      expect(
        classifyError(errWithMsg("something completely unexpected"), { provider: "copilot" }).kind,
      ).toBe("other");
    });
  });

  describe("context propagation", () => {
    it("provider name is preserved in output", () => {
      const result = classifyError(new Error("oops"), { provider: "gemini" });
      expect(result.provider).toBe("gemini");
    });

    it("model ID is preserved when provided", () => {
      const result = classifyError(new Error("oops"), { provider: "copilot", model: "gpt-4o" });
      expect(result.model).toBe("gpt-4o");
    });

    it("model defaults to empty string when not provided", () => {
      const result = classifyError(new Error("oops"), { provider: "copilot" });
      expect(result.model).toBe("");
    });

    it("raw error is retained as-is", () => {
      const rawErr = new Error("raw error message");
      const result = classifyError(rawErr, { provider: "copilot" });
      expect(result.raw).toBe(rawErr);
    });

    it("raw error is retained for plain object errors", () => {
      const rawObj = { statusCode: 429, message: "Too many requests" };
      const result = classifyError(rawObj, { provider: "gemini" });
      expect(result.raw).toBe(rawObj);
    });
  });

  describe("retryable field", () => {
    it("rate_limited is retryable", () => {
      const result = classifyError({ statusCode: 429 }, { provider: "copilot" });
      expect(result.retryable).toBe(true);
    });

    it("auth_error is not retryable", () => {
      const result = classifyError({ statusCode: 401 }, { provider: "copilot" });
      expect(result.retryable).toBe(false);
    });
  });
});

describe("parseRetryAfter", () => {
  describe("header variants", () => {
    it("Retry-After as number string '30' → 30000ms", () => {
      const err = { headers: { "Retry-After": "30" } };
      expect(parseRetryAfter(err)).toBe(30_000);
    });

    it("Retry-After with large value is clamped to 60000ms", () => {
      const err = { headers: { "Retry-After": "300" } };
      expect(parseRetryAfter(err)).toBe(60_000);
    });

    it("Retry-After as HTTP date → calculated ms (future date)", () => {
      const futureDate = new Date(Date.now() + 30_000);
      const err = { headers: { "Retry-After": futureDate.toUTCString() } };
      const result = parseRetryAfter(err);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(60_000);
    });

    it("Retry-After as HTTP date in the past → 0", () => {
      const pastDate = new Date(Date.now() - 10_000);
      const err = { headers: { "Retry-After": pastDate.toUTCString() } };
      expect(parseRetryAfter(err)).toBe(0);
    });

    it("X-RateLimit-Reset as Unix timestamp → calculated ms", () => {
      const resetAt = Math.floor(Date.now() / 1000) + 30;
      const err = { headers: { "X-RateLimit-Reset": String(resetAt) } };
      const result = parseRetryAfter(err);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(60_000);
    });

    it("no retry info → 0", () => {
      const err = new Error("Something went wrong");
      expect(parseRetryAfter(err)).toBe(0);
    });

    it("null → 0", () => {
      expect(parseRetryAfter(null)).toBe(0);
    });

    it("undefined → 0", () => {
      expect(parseRetryAfter(undefined)).toBe(0);
    });
  });

  describe("body field variants", () => {
    it("retry_after_ms on body → direct value in ms", () => {
      const err = { retry_after_ms: 5000 };
      expect(parseRetryAfter(err)).toBe(5000);
    });

    it("retry_after_ms clamped to 60000ms", () => {
      const err = { retry_after_ms: 120_000 };
      expect(parseRetryAfter(err)).toBe(60_000);
    });

    it("retryAfterMs on body → direct value in ms", () => {
      const err = { retryAfterMs: 10_000 };
      expect(parseRetryAfter(err)).toBe(10_000);
    });

    it("retry_after as number (seconds) → converted to ms", () => {
      const err = { retry_after: 10 };
      expect(parseRetryAfter(err)).toBe(10_000);
    });

    it("retry_after as string seconds → converted to ms", () => {
      const err = { retry_after: "15" };
      expect(parseRetryAfter(err)).toBe(15_000);
    });

    it("nested body.retry_after_ms → direct value", () => {
      const err = { body: { retry_after_ms: 8000 } };
      expect(parseRetryAfter(err)).toBe(8000);
    });

    it("nested body.retryAfterMs → direct value", () => {
      const err = { body: { retryAfterMs: 9000 } };
      expect(parseRetryAfter(err)).toBe(9000);
    });

    it("nested body.retry_after as seconds → converted to ms", () => {
      const err = { body: { retry_after: 20 } };
      expect(parseRetryAfter(err)).toBe(20_000);
    });
  });
});

describe("deriveRetryable", () => {
  const cases: [ProviderErrorKind, boolean][] = [
    ["rate_limited", true],
    ["overloaded", true],
    ["other", true],
    ["context_overflow", false],
    ["quota_exhausted", false],
    ["auth_error", false],
    ["not_found", false],
  ];

  for (const [kind, expected] of cases) {
    it(`${kind} → ${String(expected)}`, () => {
      expect(deriveRetryable(kind)).toBe(expected);
    });
  }
});

describe("edge cases", () => {
  it("null error → other, retryable true", () => {
    const result = classifyError(null, { provider: "copilot" });
    expect(result.kind).toBe("other");
    expect(result.retryable).toBe(true);
  });

  it("undefined error → other, retryable true", () => {
    const result = classifyError(undefined, { provider: "copilot" });
    expect(result.kind).toBe("other");
    expect(result.retryable).toBe(true);
  });

  it("Error with statusCode property → classified by status", () => {
    const err = Object.assign(new Error("rate limited"), { statusCode: 429 });
    const result = classifyError(err, { provider: "copilot" });
    expect(result.kind).toBe("rate_limited");
  });

  it("Error with nested response.status → classified by status", () => {
    const err = Object.assign(new Error("forbidden"), { response: { status: 401 } });
    const result = classifyError(err, { provider: "gemini" });
    expect(result.kind).toBe("auth_error");
  });

  it("preserves existing ClassifiedError instances", () => {
    const classified = new ClassifiedError({
      kind: "rate_limited",
      provider: "kimi",
      model: "kimi-k2.5",
      retryable: true,
      retryAfterMs: 12_000,
      raw: new Error("Too many requests"),
    });

    expect(classifyError(classified, { provider: "copilot", model: "gpt-4o" })).toBe(classified);
  });

  it("classifies empty response as non-retryable other", () => {
    const result = classifyError(new Error("Provider returned empty response"), {
      provider: "copilot",
    });

    expect(result.kind).toBe("other");
    expect(result.retryable).toBe(false);
  });

  it("parses retry-after from nested response headers", () => {
    const result = classifyError(
      {
        status: 429,
        message: "Too many requests",
        response: { headers: { "retry-after": "7" } },
      },
      { provider: "copilot" },
    );

    expect(result.retryAfterMs).toBe(7_000);
  });

  it("plain object with status property → classified by status", () => {
    const err = { status: 503, message: "" };
    const result = classifyError(err, { provider: "copilot" });
    expect(result.kind).toBe("overloaded");
  });

  it("non-Error object with message → classified by message", () => {
    const err = { message: "API key is invalid" };
    const result = classifyError(err, { provider: "gemini" });
    expect(result.kind).toBe("auth_error");
  });

  it("ClassifiedError shape has all required fields", () => {
    const result: ClassifiedError = classifyError(new Error("oops"), {
      provider: "copilot",
      model: "gpt-4o",
    });
    expect(result).toHaveProperty("kind");
    expect(result).toHaveProperty("provider");
    expect(result).toHaveProperty("model");
    expect(result).toHaveProperty("retryable");
    expect(result).toHaveProperty("retryAfterMs");
    expect(result).toHaveProperty("raw");
  });
});

describe("provider-specific empty response classification", () => {
  const providers = ["kimi", "gemini", "zai", "minimax", "copilot"] as const;

  for (const provider of providers) {
    it(`${provider}: empty response → kind "other", retryable false`, () => {
      const result = classifyError(new Error(`${provider} API returned empty response`), {
        provider,
        model: "test-model",
      });

      expect(result.kind).toBe("other");
      expect(result.retryable).toBe(false);
      expect(result.provider).toBe(provider);
      expect(result.raw).toBeInstanceOf(Error);
    });
  }
});

describe("provider-specific rate limit with retry-after extraction", () => {
  const providers = ["kimi", "gemini", "zai", "minimax", "copilot"] as const;

  for (const provider of providers) {
    it(`${provider}: 429 with Retry-After header extracts retryAfterMs`, () => {
      const err = {
        status: 429,
        message: "Rate limit exceeded",
        headers: { "retry-after": "12" },
      };
      const result = classifyError(err, { provider, model: "test-model" });

      expect(result.kind).toBe("rate_limited");
      expect(result.retryable).toBe(true);
      expect(result.retryAfterMs).toBe(12_000);
    });
  }
});

describe("provider-specific auth error classification", () => {
  const providers = ["kimi", "gemini", "zai", "minimax", "copilot"] as const;

  for (const provider of providers) {
    it(`${provider}: 401 → auth_error, non-retryable`, () => {
      const result = classifyError(
        { status: 401, message: "Invalid API key" },
        { provider, model: "test-model" },
      );

      expect(result.kind).toBe("auth_error");
      expect(result.retryable).toBe(false);
      expect(result.retryAfterMs).toBe(0);
    });
  }
});

describe("provider-specific model not-found classification", () => {
  const providers = ["kimi", "gemini", "zai", "minimax", "copilot"] as const;

  for (const provider of providers) {
    it(`${provider}: 404 → not_found, non-retryable`, () => {
      const result = classifyError(
        { status: 404, message: "Model not found" },
        { provider, model: "nonexistent-model" },
      );

      expect(result.kind).toBe("not_found");
      expect(result.retryable).toBe(false);
    });
  }
});
