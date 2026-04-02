import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentTier,
  SandboxAttemptResult,
  SandboxConfig,
  SandboxExecutionResult,
  SandboxStopReason,
} from "@diricode/core";
import {
  AgentError,
  DEFAULT_SANDBOX_CONFIG,
  DEFAULT_TOOL_LOOP_POLICY,
  classifyToolError,
  buildToolErrorEvent,
  buildToolErrorRetryEvent,
  buildToolErrorStopEvent,
  buildToolErrorEscalateEvent,
  computeToolRetryDelay,
  type ToolLoopPolicy,
} from "@diricode/core";

export interface SandboxContext extends AgentContext {
  readonly sandboxConfig: SandboxConfig;
}

function getTimeoutMs(tier: AgentTier, config: SandboxConfig): number {
  return config.timeout[tier];
}

function getMaxRetries(tier: AgentTier, config: SandboxConfig): number {
  return config.retryPolicy[tier];
}

function getMaxTokens(tier: AgentTier, config: SandboxConfig): number {
  return config.tokenBudget[tier];
}

function determineStopReason(
  error: unknown,
  tokenBudgetExceeded: boolean,
  timeout: boolean,
  retriesExhausted: boolean,
  toolLoopError = false,
): SandboxStopReason {
  if (tokenBudgetExceeded) return "budget_exceeded";
  if (timeout) return "timeout";
  if (retriesExhausted) return "retry_exhausted";
  if (toolLoopError) return "tool_loop_error";
  if (error instanceof AgentError) {
    if (error.code === "UPSTREAM_ERROR" || error.code === "DELEGATION_FAILED") {
      return "upstream_error";
    }
  }
  return "error";
}

async function executeWithTimeout(
  agent: Agent,
  input: string,
  context: SandboxContext,
  timeoutMs: number,
): Promise<AgentResult> {
  return new Promise((resolve, reject) => {
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      reject(new AgentError("TIMEOUT", `Agent execution timed out after ${String(timeoutMs)}ms`));
    }, timeoutMs);

    agent.execute(input, context).then(
      (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(String(error)));
        }
      },
    );
  });
}

export async function executeInSandbox(
  agent: Agent,
  input: string,
  context: SandboxContext,
  config: SandboxConfig = DEFAULT_SANDBOX_CONFIG,
): Promise<SandboxExecutionResult> {
  const tier = agent.metadata.tier;
  const maxRetries = getMaxRetries(tier, config);
  const maxTokens = getMaxTokens(tier, config);
  const timeoutMs = getTimeoutMs(tier, config);

  const attempts: SandboxAttemptResult[] = [];
  let retries = 0;
  let tokenBudgetExceeded = false;
  let timeout = false;
  let finalStopReason: SandboxStopReason = "error";

  while (retries <= maxRetries) {
    const attemptContext: SandboxContext = {
      ...context,
      sandboxConfig: config,
    };

    let attemptResult: AgentResult;
    let stopReason: SandboxStopReason = "success";

    try {
      attemptResult = await executeWithTimeout(agent, input, attemptContext, timeoutMs);

      if (attemptResult.tokensUsed > maxTokens) {
        tokenBudgetExceeded = true;
        stopReason = "budget_exceeded";
        finalStopReason = stopReason;
        attempts.push({
          success: false,
          output: attemptResult.output,
          tokensUsed: attemptResult.tokensUsed,
          toolCalls: attemptResult.toolCalls,
          stopReason,
          retryCount: retries,
          error: `Token budget exceeded: ${String(attemptResult.tokensUsed)} > ${String(maxTokens)}`,
        });
        break;
      }

      attempts.push({
        success: attemptResult.success,
        output: attemptResult.output,
        tokensUsed: attemptResult.tokensUsed,
        toolCalls: attemptResult.toolCalls,
        stopReason,
        retryCount: retries,
      });

      if (attemptResult.success) {
        finalStopReason = "success";
        return {
          success: true,
          output: attemptResult.output,
          totalTokens: attemptResult.tokensUsed,
          totalToolCalls: attemptResult.toolCalls,
          stopReason: "success",
          attempts,
          retries,
        };
      }

      if (retries < maxRetries) {
        retries++;
        continue;
      }

      stopReason = "retry_exhausted";
      finalStopReason = stopReason;
      attempts.push({
        success: false,
        output: attemptResult.output,
        tokensUsed: attemptResult.tokensUsed,
        toolCalls: attemptResult.toolCalls,
        stopReason,
        retryCount: retries,
      });
      break;
    } catch (error) {
      const toolPolicy: ToolLoopPolicy = config.toolLoopPolicy ?? DEFAULT_TOOL_LOOP_POLICY;
      const toolLoopError =
        error instanceof Error && (error.name === "ToolLoopError" || error.name === "ToolError");

      if (toolLoopError && toolPolicy.emitEvents) {
        const err = error as Error & {
          classification?: ReturnType<typeof classifyToolError>;
          toolName?: string;
        };
        const tName: string = err.toolName ?? "unknown";
        const classification = err.classification ?? classifyToolError(error, tName, retries > 0);

        context.emit("tool.error", buildToolErrorEvent(tName, context.turnId, classification));

        if (classification.action === "retry") {
          const delayMs = computeToolRetryDelay(
            retries,
            toolPolicy.baseDelayMs,
            toolPolicy.maxDelayMs,
          );
          context.emit(
            "tool.error.retry",
            buildToolErrorRetryEvent(
              tName,
              context.turnId,
              retries + 1,
              toolPolicy.maxToolRetries,
              delayMs,
              classification.reason,
            ),
          );
          if (retries < maxRetries && retries < toolPolicy.maxToolRetries) {
            retries++;
            continue;
          }
          context.emit(
            "tool.error.stop",
            buildToolErrorStopEvent(tName, context.turnId, classification),
          );
          finalStopReason = "tool_loop_error";
          attempts.push({
            success: false,
            output: "",
            tokensUsed: 0,
            toolCalls: 0,
            stopReason: finalStopReason,
            retryCount: retries,
            error: error instanceof Error ? error.message : String(error),
          });
          break;
        }

        if (classification.action === "escalate") {
          context.emit(
            "tool.error.escalate",
            buildToolErrorEscalateEvent(tName, context.turnId, classification),
          );
        }

        if (classification.action === "stop" || classification.action === "escalate") {
          finalStopReason = "tool_loop_error";
          attempts.push({
            success: false,
            output: "",
            tokensUsed: 0,
            toolCalls: 0,
            stopReason: finalStopReason,
            retryCount: retries,
            error: error instanceof Error ? error.message : String(error),
          });
          break;
        }

        context.emit("tool.error.recovered", {
          toolName: tName,
          turnId: context.turnId,
          timestamp: Date.now(),
          reason: classification.reason,
        });
      }

      if (error instanceof AgentError && error.code === "TIMEOUT") {
        timeout = true;
        stopReason = "timeout";
        finalStopReason = stopReason;
      } else {
        finalStopReason = determineStopReason(
          error,
          tokenBudgetExceeded,
          timeout,
          retries >= maxRetries,
          toolLoopError,
        );
        stopReason = finalStopReason;
      }

      attempts.push({
        success: false,
        output: "",
        tokensUsed: 0,
        toolCalls: 0,
        stopReason,
        retryCount: retries,
        error: error instanceof Error ? error.message : String(error),
      });

      const shouldRetry =
        retries < maxRetries &&
        stopReason !== "upstream_error" &&
        stopReason !== "timeout" &&
        stopReason !== "budget_exceeded" &&
        stopReason !== "tool_loop_error";
      if (shouldRetry) {
        retries++;
        continue;
      }
      break;
    }
  }

  const lastAttempt = attempts[attempts.length - 1];
  return {
    success: false,
    output: lastAttempt?.output ?? "",
    totalTokens: attempts.reduce((sum, a) => sum + a.tokensUsed, 0),
    totalToolCalls: attempts.reduce((sum, a) => sum + a.toolCalls, 0),
    stopReason: finalStopReason,
    attempts,
    retries,
  };
}
