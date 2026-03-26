import { describe, expect, it, vi } from "vitest";
import { AgentError, DEFAULT_SANDBOX_CONFIG } from "@diricode/core";
import type { Agent, AgentContext, AgentResult, SandboxConfig } from "@diricode/core";
import { executeInSandbox, SandboxContext } from "../sandbox.js";

type MockFn = ReturnType<typeof vi.fn>;

function makeAgent(overrides?: Partial<Agent>): Agent {
  return {
    metadata: {
      name: "test-agent",
      description: "test agent",
      tier: "medium",
      category: "code",
      capabilities: ["test"],
      tags: [],
    },
    execute: vi.fn<[string, AgentContext], Promise<AgentResult>>(),
    ...overrides,
  };
}

function makeSandboxContext(overrides?: Partial<SandboxContext>): SandboxContext {
  const emit = vi.fn();
  return {
    workspaceRoot: "/workspace",
    sessionId: "session-123",
    tools: [],
    emit,
    sandboxConfig: DEFAULT_SANDBOX_CONFIG,
    ...overrides,
  };
}

describe("executeInSandbox", () => {
  describe("successful execution", () => {
    it("returns successful result when agent succeeds", async () => {
      const agent = makeAgent({
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "done",
          toolCalls: 2,
          tokensUsed: 100,
        }),
      });
      const context = makeSandboxContext();

      const result = await executeInSandbox(agent, "test input", context);

      expect(result.success).toBe(true);
      expect(result.output).toBe("done");
      expect(result.totalTokens).toBe(100);
      expect(result.totalToolCalls).toBe(2);
      expect(result.stopReason).toBe("success");
      expect(result.retries).toBe(0);
      expect(result.attempts).toHaveLength(1);
    });

    it("uses tier-aware timeout from config", async () => {
      const config: SandboxConfig = {
        tokenBudget: { heavy: 80000, medium: 40000, light: 10000 },
        timeout: { heavy: 300000, medium: 5000, light: 30000 },
        retryPolicy: { heavy: 3, medium: 1, light: 0 },
      };
      const agent = makeAgent({
        metadata: { ...makeAgent().metadata, tier: "medium" },
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "done",
          toolCalls: 0,
          tokensUsed: 50,
        }),
      });
      const context = makeSandboxContext({ sandboxConfig: config });

      await executeInSandbox(agent, "test", context);

      expect(agent.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("timeout handling", () => {
    it("stops with timeout reason when agent exceeds timeout", async () => {
      const agent = makeAgent({
        execute: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(
                () => resolve({ success: true, output: "slow", toolCalls: 0, tokensUsed: 100 }),
                100,
              );
            }),
        ),
      });
      const config: SandboxConfig = {
        tokenBudget: { heavy: 80000, medium: 40000, light: 10000 },
        timeout: { heavy: 300000, medium: 10, light: 30000 },
        retryPolicy: { heavy: 3, medium: 1, light: 0 },
      };
      const context = makeSandboxContext({ sandboxConfig: config });

      const result = await executeInSandbox(agent, "test", context);

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe("timeout");
      expect(result.attempts[0]?.stopReason).toBe("timeout");
    });
  });

  describe("retry policy", () => {
    it("retries failed execution according to tier policy", async () => {
      const executeMock = vi
        .fn()
        .mockResolvedValueOnce({ success: false, output: "fail1", toolCalls: 1, tokensUsed: 50 })
        .mockResolvedValueOnce({ success: true, output: "success", toolCalls: 2, tokensUsed: 100 });
      const agent = makeAgent({ execute: executeMock });
      const config: SandboxConfig = {
        tokenBudget: { heavy: 80000, medium: 40000, light: 10000 },
        timeout: { heavy: 300000, medium: 120000, light: 30000 },
        retryPolicy: { heavy: 3, medium: 2, light: 1 },
      };
      const context = makeSandboxContext({ sandboxConfig: config });

      const result = await executeInSandbox(agent, "test", context);

      expect(result.success).toBe(true);
      expect(result.retries).toBe(1);
      expect(executeMock).toHaveBeenCalledTimes(2);
    });

    it("stops with retry_exhausted when retries are depleted", async () => {
      const executeMock = vi
        .fn()
        .mockResolvedValue({ success: false, output: "always fail", toolCalls: 0, tokensUsed: 10 });
      const agent = makeAgent({ execute: executeMock });
      const config: SandboxConfig = {
        tokenBudget: { heavy: 80000, medium: 40000, light: 10000 },
        timeout: { heavy: 300000, medium: 120000, light: 30000 },
        retryPolicy: { heavy: 3, medium: 1, light: 0 },
      };
      const context = makeSandboxContext({ sandboxConfig: config });

      const result = await executeInSandbox(agent, "test", context);

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe("retry_exhausted");
      expect(executeMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("token budget", () => {
    it("detects budget_exceeded when tokens exceed tier limit", async () => {
      const agent = makeAgent({
        execute: vi.fn().mockResolvedValue({
          success: true,
          output: "big output",
          toolCalls: 0,
          tokensUsed: 50000,
        }),
      });
      const config: SandboxConfig = {
        tokenBudget: { heavy: 80000, medium: 40000, light: 10000 },
        timeout: { heavy: 300000, medium: 120000, light: 30000 },
        retryPolicy: { heavy: 3, medium: 2, light: 1 },
      };
      const context = makeSandboxContext({ sandboxConfig: config });

      const result = await executeInSandbox(agent, "test", context);

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe("budget_exceeded");
      expect(result.attempts[0]?.stopReason).toBe("budget_exceeded");
    });
  });

  describe("error isolation", () => {
    it("catches and reports errors without crashing", async () => {
      const agent = makeAgent({
        execute: vi.fn().mockRejectedValue(new Error("internal error")),
      });
      const context = makeSandboxContext();

      const result = await executeInSandbox(agent, "test", context);

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe("error");
      expect(result.attempts[0]?.error).toBe("internal error");
    });

    it("handles AgentError with upstream codes correctly", async () => {
      const agent = makeAgent({
        execute: vi.fn().mockRejectedValue(new AgentError("UPSTREAM_ERROR", "upstream failed")),
      });
      const config: SandboxConfig = {
        tokenBudget: { heavy: 80000, medium: 40000, light: 10000 },
        timeout: { heavy: 300000, medium: 120000, light: 30000 },
        retryPolicy: { heavy: 3, medium: 2, light: 1 },
      };
      const context = makeSandboxContext({ sandboxConfig: config });

      const result = await executeInSandbox(agent, "test", context);

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe("upstream_error");
      expect(result.attempts[0]?.error).toContain("upstream failed");
    });
  });

  describe("heavy tier", () => {
    it("allows more retries for heavy tier agents", async () => {
      const executeMock = vi
        .fn()
        .mockResolvedValueOnce({ success: false, output: "fail1", toolCalls: 1, tokensUsed: 50 })
        .mockResolvedValueOnce({ success: false, output: "fail2", toolCalls: 1, tokensUsed: 50 })
        .mockResolvedValueOnce({ success: true, output: "success", toolCalls: 2, tokensUsed: 100 });
      const agent = makeAgent({
        metadata: { ...makeAgent().metadata, tier: "heavy" },
        execute: executeMock,
      });
      const config: SandboxConfig = {
        tokenBudget: { heavy: 80000, medium: 40000, light: 10000 },
        timeout: { heavy: 300000, medium: 120000, light: 30000 },
        retryPolicy: { heavy: 3, medium: 2, light: 1 },
      };
      const context = makeSandboxContext({ sandboxConfig: config });

      const result = await executeInSandbox(agent, "test", context);

      expect(result.success).toBe(true);
      expect(result.retries).toBe(2);
      expect(executeMock).toHaveBeenCalledTimes(3);
    });
  });
});
