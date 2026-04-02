import type { Tool, ToolAccessPolicy } from "../tools/types.js";
import type { PromptBuilder } from "./prompt-builder.js";

export type AgentTier = "heavy" | "medium" | "light";

export type AgentCategory = "command" | "strategy" | "code" | "quality" | "research" | "utility";

// ---------------------------------------------------------------------------
// Agent prompt builder types
// ---------------------------------------------------------------------------

/**
 * Model family hint for the model selection handoff.
 * @see ADR-005 model family classification
 */
export type ModelFamily =
  | "reasoning"
  | "creative"
  | "ui-ux"
  | "speed"
  | "web-research"
  | "bulk"
  | "agentic";

/**
 * Context size class required by the task.
 * @see ADR-042 context size dimension
 */
export type ContextSize = "standard" | "extended" | "massive";

/**
 * Model selection hints for routing a prompt to the right model.
 */
export interface ModelHints {
  readonly tier?: AgentTier;
  readonly families?: readonly ModelFamily[];
  readonly contextSize?: ContextSize;
}

/**
 * Structured representation of the repository file tree.
 * Produced by the architect/code-explorer agents and consumed by the prompt builder.
 */
export interface RepoMap {
  readonly rootPath: string;
  readonly files: readonly FileNode[];
}

export interface FileNode {
  readonly path: string;
  readonly type: "file" | "directory";
  readonly children?: readonly FileNode[];
}

/**
 * A file snapshot included in the prompt context.
 */
export interface FileContext {
  readonly path: string;
  readonly content: string;
  readonly relevanceScore?: number;
}

/**
 * A single message in the conversation history.
 */
export interface HistoryMessage {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly timestamp: number;
}

/**
 * The current execution plan / task breakdown.
 */
export interface PlanContext {
  readonly tasks: readonly TaskSummary[];
  readonly currentTaskId?: string;
}

export interface TaskSummary {
  readonly id: string;
  readonly description: string;
  readonly status: "pending" | "in-progress" | "completed" | "blocked";
}

export interface Task {
  readonly id: string;
  readonly description: string;
  readonly status: "pending" | "in-progress" | "completed" | "blocked" | "failed";
  readonly blocked_by: readonly string[];
  readonly blocking: readonly string[];
  readonly sessionId?: string;
  readonly agentName?: string;
  readonly createdAt?: number;
  readonly updatedAt?: number;
}

export interface SerializedTask {
  readonly id: string;
  readonly description: string;
  readonly status: Task["status"];
  readonly blocked_by: string;
  readonly blocking: string;
  readonly session_id?: string;
  readonly agent_name?: string;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export function serializeTask(task: Task): SerializedTask {
  return {
    id: task.id,
    description: task.description,
    status: task.status,
    blocked_by: JSON.stringify(task.blocked_by),
    blocking: JSON.stringify(task.blocking),
    session_id: task.sessionId,
    agent_name: task.agentName,
    created_at: task.createdAt ? new Date(task.createdAt).toISOString() : undefined,
    updated_at: task.updatedAt ? new Date(task.updatedAt).toISOString() : undefined,
  };
}

export function deserializeTask(row: SerializedTask): Task {
  let blockedBy: string[];
  let blocking: string[];

  try {
    blockedBy = JSON.parse(row.blocked_by) as string[];
  } catch {
    blockedBy = [];
  }

  try {
    blocking = JSON.parse(row.blocking) as string[];
  } catch {
    blocking = [];
  }

  return {
    id: row.id,
    description: row.description,
    status: row.status,
    blocked_by: blockedBy,
    blocking,
    sessionId: row.session_id,
    agentName: row.agent_name,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
  };
}
/**
 * Token budget allocation for a prompt component.
 * @see ADR-016 Context Composer token budgets
 */
export interface TokenBudget {
  readonly maxTokens: number;
  readonly reserved?: number;
}

/**
 * Context injection configuration — what to inject and at what priority.
 */
export interface ContextInjection {
  readonly type: "repo-map" | "files" | "history" | "plan" | "custom";
  readonly priority: number; // lower = higher priority (injected first)
  readonly maxTokens?: number;
  readonly enabled: boolean;
}

/**
 * Variables substituted into system prompt templates.
 */
export interface TemplateVars {
  readonly agentName: string;
  readonly agentDescription: string;
  readonly agentCapabilities: readonly string[];
  readonly workspaceRoot: string;
  readonly sessionId: string;
  readonly parentAgentId?: string;
  readonly tools: readonly string[];
  readonly availableFiles?: readonly string[];
  readonly modelHints?: ModelHints;
  readonly custom?: Readonly<Record<string, string>>;
}

/**
 * Token budget allocation per context category.
 * @see ADR-016 §Context Composer
 */
export interface PromptBudget {
  readonly system: TokenBudget;
  readonly tools: TokenBudget;
  readonly repoMap: TokenBudget;
  readonly files: TokenBudget;
  readonly history: TokenBudget;
  readonly plan: TokenBudget;
  readonly userInput: TokenBudget;
}

/**
 * Built prompt ready for delivery to a provider.
 */
export interface BuiltPrompt {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly toolsSection?: string;
  readonly tokenBudget: PromptBudget;
  readonly modelHints: ModelHints;
  readonly tokenEstimate: number;
}

// ---------------------------------------------------------------------------
// Existing agent types
// ---------------------------------------------------------------------------

export interface AgentMetadata {
  readonly name: string;
  readonly description: string;
  readonly tier: AgentTier;
  readonly category: AgentCategory;
  readonly capabilities: readonly string[];
  readonly tags: readonly string[];
  /**
   * Explicit tool access policy for this agent.
   * When defined, the agent may ONLY use the listed tools.
   * This enforces tool filtering at both prompt-build and runtime layers.
   */
  readonly toolPolicy?: ToolAccessPolicy;
}

export interface AgentContext {
  readonly workspaceRoot: string;
  readonly sessionId: string;
  readonly turnId?: string;
  readonly parentAgentId?: string;
  readonly tools: readonly Tool[];
  readonly promptBuilder?: PromptBuilder;
  readonly contextInjections?: readonly ContextInjection[];
  emit: (event: string, payload: unknown) => void;
}

export interface AgentResult {
  readonly success: boolean;
  readonly output: string;
  readonly toolCalls: number;
  readonly tokensUsed: number;
  /**
   * Optional agent-specific structured output.
   * Callers (dispatcher, UI) can inspect findings without parsing freeform text.
   */
  readonly findings?: unknown;
}

export class AgentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export interface Agent {
  readonly metadata: AgentMetadata;
  execute(input: string, context: AgentContext): Promise<AgentResult>;
}

// ---------------------------------------------------------------------------
// Sandbox execution types
// ---------------------------------------------------------------------------

/**
 * Stop reasons for sandboxed agent execution.
 */
export type SandboxStopReason =
  | "budget_exceeded"
  | "timeout"
  | "retry_exhausted"
  | "upstream_error"
  | "success"
  | "error"
  | "tool_loop_error";

/**
 * Tier-aware token budget configuration.
 * Maps agent tier to max tokens per invocation.
 */
export interface SandboxTokenBudget {
  readonly heavy: number;
  readonly medium: number;
  readonly light: number;
}

/**
 * Tier-aware timeout configuration in milliseconds.
 */
export interface SandboxTimeout {
  readonly heavy: number;
  readonly medium: number;
  readonly light: number;
}

/**
 * Tier-aware retry policy configuration.
 */
export interface SandboxRetryPolicy {
  readonly heavy: number;
  readonly medium: number;
  readonly light: number;
}

/**
 * Complete sandbox configuration for agent execution.
 */
export interface SandboxConfig {
  readonly tokenBudget: SandboxTokenBudget;
  readonly timeout: SandboxTimeout;
  readonly retryPolicy: SandboxRetryPolicy;
  readonly toolLoopPolicy?: ToolLoopPolicy;
}

/**
 * Tool loop policy configuration for per-tool-call retry behavior (DC-PIPE-009).
 */
export interface ToolLoopPolicy {
  readonly maxToolRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly emitEvents: boolean;
}

/**
 * Default tool loop policy per ADR-036 defaults.
 */
export const DEFAULT_TOOL_LOOP_POLICY: ToolLoopPolicy = {
  maxToolRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  emitEvents: true,
};
export interface SandboxAttemptResult {
  readonly success: boolean;
  readonly output: string;
  readonly tokensUsed: number;
  readonly toolCalls: number;
  readonly stopReason: SandboxStopReason;
  readonly retryCount: number;
  readonly error?: string;
}

/**
 * Aggregated result of sandboxed execution with all attempts.
 */
export interface SandboxExecutionResult {
  readonly success: boolean;
  readonly output: string;
  readonly totalTokens: number;
  readonly totalToolCalls: number;
  readonly stopReason: SandboxStopReason;
  readonly attempts: readonly SandboxAttemptResult[];
  readonly retries: number;
}

/**
 * Default sandbox configuration optimized for POC.
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  tokenBudget: {
    heavy: 80000,
    medium: 40000,
    light: 10000,
  },
  timeout: {
    heavy: 300000,
    medium: 120000,
    light: 30000,
  },
  retryPolicy: {
    heavy: 3,
    medium: 2,
    light: 1,
  },
  toolLoopPolicy: DEFAULT_TOOL_LOOP_POLICY,
};
