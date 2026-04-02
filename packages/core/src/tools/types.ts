import type { ZodType, ZodTypeDef } from "zod";

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
}

export interface ToolContext {
  workspaceRoot: string;
  turnId?: string;
  sessionId?: string;
  executionId?: string;
  agentName?: string;
  emit: (event: string, payload: unknown) => void;
}

export interface ToolResult<T = unknown> {
  success: true;
  data: T;
}

export class ToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export interface Tool<TParams = unknown, TResult = unknown> {
  name: string;
  description: string;
  parameters: ZodType<TParams, ZodTypeDef, unknown>;
  annotations: ToolAnnotations;
  execute: (params: TParams, context: ToolContext) => Promise<ToolResult<TResult>>;
}

// ---------------------------------------------------------------------------
// Per-agent tool allowlist types (DC-CORE-013)
// ---------------------------------------------------------------------------

/**
 * Explicit tool access policy for an agent.
 * When defined, the agent may ONLY use the listed tools.
 * When undefined, the agent may use any tool passed to it.
 */
export interface ToolAccessPolicy {
  /**
   * Explicit allowlist of tool names this agent may execute.
   * If undefined, the agent has access to all tools passed in context.
   */
  readonly allowedTools?: readonly string[];
  /**
   * If true, tools not in allowedTools will be silently filtered from prompt.
   * If false (default), disallowed tool attempts will emit errors.
   */
  readonly silentFilter?: boolean;
}

/**
 * Error thrown when an agent attempts to execute a tool not in its allowlist.
 */
export class ToolAccessDeniedError extends ToolError {
  constructor(
    public readonly toolName: string,
    public readonly agentName: string,
    public readonly allowedTools: readonly string[],
  ) {
    super(
      "TOOL_ACCESS_DENIED",
      `Agent "${agentName}" attempted to execute tool "${toolName}" which is not in its allowlist. ` +
        `Allowed tools: ${allowedTools.join(", ") || "(none)"}`,
    );
    this.name = "ToolAccessDeniedError";
  }
}

/**
 * Filter a tool list by an allowlist policy.
 * Returns only the tools that are allowed.
 */
export function filterToolsByAllowlist(tools: readonly Tool[], policy: ToolAccessPolicy): Tool[] {
  if (policy.allowedTools === undefined) {
    return [...tools];
  }
  if (policy.allowedTools.length === 0) {
    return [];
  }
  const allowedSet = new Set(policy.allowedTools);
  return tools.filter((t) => allowedSet.has(t.name));
}

/**
 * Check if a specific tool is allowed by the policy.
 */
export function isToolAllowed(toolName: string, policy: ToolAccessPolicy): boolean {
  if (policy.allowedTools === undefined) {
    return true;
  }
  if (policy.allowedTools.length === 0) {
    return false;
  }
  return policy.allowedTools.includes(toolName);
}

/**
 * Creates a tool executor that enforces allowlist policy at runtime.
 * Emits 'tool.access_denied' event when a disallowed tool is attempted.
 */
export function createPolicyEnforcingTool(
  tool: Tool,
  policy: ToolAccessPolicy,
  agentName: string,
  emit: (event: string, payload: unknown) => void,
): Tool {
  if (isToolAllowed(tool.name, policy)) {
    return tool;
  }
  return {
    ...tool,
    execute: (_params, _context) => {
      emit("tool.access_denied", {
        toolName: tool.name,
        agentName,
        allowedTools: policy.allowedTools ?? [],
        timestamp: new Date().toISOString(),
      });
      return Promise.reject(
        new ToolAccessDeniedError(tool.name, agentName, policy.allowedTools ?? []),
      );
    },
  };
}

/**
 * Wraps a list of tools with allowlist enforcement based on agent policy.
 * Returns tools that enforce the allowlist at execution time.
 */
export function createPolicyEnforcingToolRegistry(
  tools: readonly Tool[],
  policy: ToolAccessPolicy,
  agentName: string,
  emit: (event: string, payload: unknown) => void,
): Tool[] {
  return tools.map((tool) => createPolicyEnforcingTool(tool, policy, agentName, emit));
}
