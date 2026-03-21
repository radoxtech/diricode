import type { Tool } from "../tools/types.js";

export type AgentTier = "heavy" | "medium" | "light";

export type AgentCategory = "command" | "strategy" | "code" | "quality" | "research" | "utility";

export interface AgentMetadata {
  readonly name: string;
  readonly description: string;
  readonly tier: AgentTier;
  readonly category: AgentCategory;
  readonly capabilities: readonly string[];
  readonly tags: readonly string[];
}

export interface AgentContext {
  readonly workspaceRoot: string;
  readonly sessionId: string;
  readonly parentAgentId?: string;
  readonly tools: readonly Tool[];
  emit: (event: string, payload: unknown) => void;
}

export interface AgentResult {
  readonly success: boolean;
  readonly output: string;
  readonly toolCalls: number;
  readonly tokensUsed: number;
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
