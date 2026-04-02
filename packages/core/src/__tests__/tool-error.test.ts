import { describe, expect, it } from "vitest";
import {
  classifyToolError,
  deriveRecoveryAction,
  buildToolErrorEvent,
  buildToolErrorRetryEvent,
  buildToolErrorRecoveredEvent,
  buildToolErrorEscalateEvent,
  buildToolErrorStopEvent,
  computeToolRetryDelay,
  ToolLoopError,
  DEFAULT_TOOL_RETRY_BASE_DELAY_MS,
  DEFAULT_TOOL_RETRY_MAX_DELAY_MS,
  DEFAULT_TOOL_RETRY_MAX_RETRIES,
} from "../index.js";
import { ToolError } from "../tools/types.js";

describe("classifyToolError", () => {
  describe("blocking errors", () => {
    it("classifies bash syntax error as blocking", () => {
      const err = new Error("bash: syntax error near unexpected token `fi'");
      const result = classifyToolError(err, "bash-exec");
      expect(result.kind).toBe("blocking");
      expect(result.action).toBe("stop");
      expect(result.idempotent).toBe(false);
    });

    it("classifies parse error as blocking", () => {
      const err = new Error("JSON parse error: Unexpected token");
      const result = classifyToolError(err, "file-read");
      expect(result.kind).toBe("blocking");
      expect(result.action).toBe("stop");
    });

    it("classifies INVALID_TOOL_ARGS as blocking", () => {
      const err = new ToolError("INVALID_TOOL_ARGS", "Invalid arguments for tool");
      const result = classifyToolError(err, "web-fetch");
      expect(result.kind).toBe("blocking");
      expect(result.action).toBe("stop");
    });

    it("classifies circular dependency as blocking", () => {
      const err = new Error("Circular dependency detected in task graph");
      const result = classifyToolError(err, "task-scheduler");
      expect(result.kind).toBe("blocking");
      expect(result.action).toBe("stop");
    });

    it("classifies sandbox escape attempt as blocking", () => {
      const err = new Error("Forbidden system call: attempted sandbox escape");
      const result = classifyToolError(err, "bash-exec");
      expect(result.kind).toBe("blocking");
      expect(result.action).toBe("stop");
    });
  });

  describe("user_decision_needed errors", () => {
    it("classifies quota exhausted as user_decision_needed", () => {
      const err = new Error("Monthly API quota exhausted");
      const result = classifyToolError(err, "web-search");
      expect(result.kind).toBe("user_decision_needed");
      expect(result.action).toBe("escalate");
    });

    it("classifies token budget exceeded as user_decision_needed", () => {
      const err = new ToolError("TOKEN_BUDGET_EXCEEDED", "Token budget exceeded for this turn");
      const result = classifyToolError(err, "code-writer");
      expect(result.kind).toBe("user_decision_needed");
      expect(result.action).toBe("escalate");
    });

    it("classifies user abort as user_decision_needed", () => {
      const err = new Error("User canceled the operation");
      const result = classifyToolError(err, "git-push");
      expect(result.kind).toBe("user_decision_needed");
      expect(result.action).toBe("escalate");
    });

    it("classifies NEEDS_CONFIRMATION as user_decision_needed", () => {
      const err = new ToolError("NEEDS_CONFIRMATION", "This operation requires user confirmation");
      const result = classifyToolError(err, "file-write");
      expect(result.kind).toBe("user_decision_needed");
      expect(result.action).toBe("escalate");
    });
  });

  describe("retryable errors", () => {
    it("classifies rate limited as retryable", () => {
      const err = new Error("Rate limit exceeded: 429 Too Many Requests");
      const result = classifyToolError(err, "web-search");
      expect(result.kind).toBe("retryable");
      expect(result.action).toBe("retry");
      expect(result.idempotent).toBe(true);
    });

    it("classifies timeout as retryable", () => {
      const err = new Error("Request timed out after 30000ms");
      const result = classifyToolError(err, "file-read");
      expect(result.kind).toBe("retryable");
      expect(result.action).toBe("retry");
      expect(result.idempotent).toBe(true);
    });

    it("classifies ENOTFOUND / connection refused as retryable", () => {
      const err = new Error("getaddrinfo ENOTFOUND api.example.com");
      const result = classifyToolError(err, "web-fetch");
      expect(result.kind).toBe("retryable");
      expect(result.action).toBe("retry");
      expect(result.idempotent).toBe(true);
    });

    it("classifies service unavailable as retryable", () => {
      const err = new Error("Service temporarily unavailable");
      const result = classifyToolError(err, "web-search");
      expect(result.kind).toBe("retryable");
      expect(result.action).toBe("retry");
    });

    it("classifies file-not-found as retryable (idempotent)", () => {
      const err = new Error("ENOENT: no such file or directory");
      const result = classifyToolError(err, "file-read");
      expect(result.kind).toBe("retryable");
      expect(result.action).toBe("retry");
      expect(result.idempotent).toBe(true);
    });

    it("marks retried=true when already retried", () => {
      const err = new Error("Rate limit exceeded");
      const result = classifyToolError(err, "web-search", true);
      expect(result.retried).toBe(true);
    });
  });

  describe("recoverable errors", () => {
    it("classifies unknown errors as recoverable", () => {
      const err = new Error("Something unexpected happened");
      const result = classifyToolError(err, "file-read");
      expect(result.kind).toBe("recoverable");
      expect(result.action).toBe("continue");
      expect(result.idempotent).toBe(false);
    });

    it("sets cause to the original error", () => {
      const originalErr = new Error("original error");
      const result = classifyToolError(originalErr, "tool");
      expect(result.cause).toBe(originalErr);
    });
  });
});

describe("deriveRecoveryAction", () => {
  it("maps recoverable to continue", () => {
    expect(deriveRecoveryAction("recoverable")).toBe("continue");
  });

  it("maps retryable to retry", () => {
    expect(deriveRecoveryAction("retryable")).toBe("retry");
  });

  it("maps blocking to stop", () => {
    expect(deriveRecoveryAction("blocking")).toBe("stop");
  });

  it("maps user_decision_needed to escalate", () => {
    expect(deriveRecoveryAction("user_decision_needed")).toBe("escalate");
  });
});

describe("buildToolErrorEvent", () => {
  it("returns event with correct type", () => {
    const err = new Error("timeout");
    const classification = classifyToolError(err, "file-read");
    const event = buildToolErrorEvent("file-read", "turn-1", classification);
    expect(event.type).toBe("tool.error");
    expect(event.toolName).toBe("file-read");
    expect(event.turnId).toBe("turn-1");
    expect(event.kind).toBe("retryable");
    expect(event.action).toBe("retry");
    expect(event.idempotent).toBe(true);
  });

  it("returns event without turnId when undefined", () => {
    const err = new Error("error");
    const classification = classifyToolError(err, "bash");
    const event = buildToolErrorEvent("bash", undefined, classification);
    expect(event.turnId).toBeUndefined();
  });
});

describe("buildToolErrorRetryEvent", () => {
  it("returns retry event with attempt and delay", () => {
    const event = buildToolErrorRetryEvent("web-search", "turn-1", 2, 3, 2000, "Rate limited");
    expect(event.type).toBe("tool.error.retry");
    expect(event.toolName).toBe("web-search");
    expect(event.turnId).toBe("turn-1");
    expect(event.attempt).toBe(2);
    expect(event.maxRetries).toBe(3);
    expect(event.delayMs).toBe(2000);
    expect(event.reason).toBe("Rate limited");
  });
});

describe("buildToolErrorRecoveredEvent", () => {
  it("returns recovered event", () => {
    const event = buildToolErrorRecoveredEvent("file-read", "turn-1", "Non-fatal warning", {
      success: true,
      data: {},
    });
    expect(event.type).toBe("tool.error.recovered");
    expect(event.toolName).toBe("file-read");
    expect(event.reason).toBe("Non-fatal warning");
    expect(event.recoveredResult.success).toBe(true);
  });
});

describe("buildToolErrorEscalateEvent", () => {
  it("returns escalate event with error details", () => {
    const err = new Error("Quota exhausted");
    const classification = classifyToolError(err, "web-search");
    const event = buildToolErrorEscalateEvent("web-search", "turn-1", classification);
    expect(event.type).toBe("tool.error.escalate");
    expect(event.toolName).toBe("web-search");
    expect(event.reason).toContain("Quota");
  });
});

describe("buildToolErrorStopEvent", () => {
  it("returns stop event with error details", () => {
    const err = new Error("Bash syntax error");
    const classification = classifyToolError(err, "bash-exec");
    const event = buildToolErrorStopEvent("bash-exec", "turn-1", classification);
    expect(event.type).toBe("tool.error.stop");
    expect(event.toolName).toBe("bash-exec");
    expect(event.errorMessage).toBe("Bash syntax error");
  });
});

describe("computeToolRetryDelay", () => {
  it("returns DEFAULT_TOOL_RETRY_BASE_DELAY_MS for attempt 0", () => {
    const delay = computeToolRetryDelay(0);
    const expected = DEFAULT_TOOL_RETRY_BASE_DELAY_MS;
    expect(delay).toBeGreaterThanOrEqual(expected * 0.75);
    expect(delay).toBeLessThanOrEqual(expected * 1.25);
  });

  it("increases delay with attempt", () => {
    const delay0 = computeToolRetryDelay(0);
    const delay1 = computeToolRetryDelay(1);
    const delay2 = computeToolRetryDelay(2);
    expect(delay1).toBeGreaterThan(delay0);
    expect(delay2).toBeGreaterThan(delay1);
  });

  it("caps delay at maxDelayMs", () => {
    const delay = computeToolRetryDelay(10, 1_000, 30_000);
    expect(delay).toBeLessThanOrEqual(30_000);
  });

  it("respects custom baseDelayMs", () => {
    const delay = computeToolRetryDelay(1, 2_000, 60_000);
    expect(delay).toBeGreaterThan(2_000);
  });
});

describe("ToolLoopError", () => {
  it("extends ToolError and carries classification", () => {
    const err = new ToolError("TEST_ERROR", "test message");
    const classification = classifyToolError(err, "tool");
    const loopErr = new ToolLoopError("TEST_ERROR", "test message", classification);
    expect(loopErr).toBeInstanceOf(ToolError);
    expect(loopErr).toBeInstanceOf(Error);
    expect(loopErr.name).toBe("ToolLoopError");
    expect(loopErr.classification.kind).toBe("recoverable");
    expect(loopErr.classification.action).toBe("continue");
  });
});

describe("constants", () => {
  it("DEFAULT_TOOL_RETRY_BASE_DELAY_MS is 1000", () => {
    expect(DEFAULT_TOOL_RETRY_BASE_DELAY_MS).toBe(1_000);
  });

  it("DEFAULT_TOOL_RETRY_MAX_DELAY_MS is 30000", () => {
    expect(DEFAULT_TOOL_RETRY_MAX_DELAY_MS).toBe(30_000);
  });

  it("DEFAULT_TOOL_RETRY_MAX_RETRIES is 3", () => {
    expect(DEFAULT_TOOL_RETRY_MAX_RETRIES).toBe(3);
  });
});
