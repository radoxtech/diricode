import type { AgentDomain, AgentTier } from "./types.js";

/**
 * Context inheritance modes for parent-to-child agent handoff.
 *
 * Per ADR-020: Three modes balance token cost vs context richness.
 *
 * @see ADR-020 Sub-Agent Context Inheritance
 */
export type ContextInheritanceMode = "isolated" | "summary" | "full";

/**
 * Configuration for context inheritance between parent and child agents.
 */
export interface ContextInheritanceRules {
  /** Inheritance mode - defaults to 'summary' per ADR-020 */
  readonly mode: ContextInheritanceMode;
  /** Maximum tokens to pass to child (applies to summary mode) */
  readonly maxTokens?: number;
  /** Specific files/paths to include regardless of mode */
  readonly includeFiles?: readonly string[];
  /** Files/paths to exclude from inherited context */
  readonly excludeFiles?: readonly string[];
  /** Whether to include conversation history (summary/full modes) */
  readonly includeHistory?: boolean;
  /** Whether to include tool call results from parent */
  readonly includeToolResults?: boolean;
}

/**
 * Metadata about a node in the parent-child agent graph.
 * Tracks delegation relationships and execution state.
 */
export interface ParentChildGraphNode {
  /** Unique identifier for this agent execution */
  readonly executionId: string;
  /** Agent name/type */
  readonly agentName: string;
  /** Parent execution ID (null for root agents) */
  readonly parentExecutionId: string | null;
  /** Child execution IDs */
  readonly childExecutionIds: readonly string[];
  /** Allowed execution tiers declared by the agent */
  readonly allowedTiers: readonly AgentTier[];
  /** Primary functional domain of the agent */
  readonly primary: AgentDomain;
  /** Depth in delegation tree (0 = root) */
  readonly depth: number;
  /** Timestamp when execution started */
  readonly startedAt: Date;
  /** Timestamp when execution completed (null if still running) */
  readonly completedAt: Date | null;
  /** Execution status */
  readonly status: "running" | "completed" | "failed" | "cancelled";
}

/**
 * Serialized conversation context for handoff to child agents.
 * Based on Vercel AI SDK's toModelOutput pattern.
 */
export interface SerializedContext {
  /** Conversation messages (for summary/full modes) */
  readonly messages?: readonly unknown[];
  /** Condensed summary of parent work (for summary mode) */
  readonly summary?: string;
  /** Relevant files extracted from parent context */
  readonly relevantFiles?: readonly string[];
  /** Key decisions made by parent */
  readonly keyDecisions?: readonly string[];
  /** Token count of serialized context */
  readonly tokenCount: number;
}

/**
 * Envelope containing all context passed from parent to child agent.
 * This is the core of the delegation protocol.
 */
export interface ContextHandoffEnvelope {
  /** Unique identifier for this handoff */
  readonly handoffId: string;
  /** Parent execution metadata */
  readonly parent: {
    readonly executionId: string;
    readonly agentName: string;
    readonly sessionId: string;
  };
  /** Child execution identifier (assigned by dispatcher) */
  readonly childExecutionId: string;
  /** Goal definition with success criteria and constraints */
  readonly goal: GoalDefinition;
  /** Inheritance configuration used for this handoff */
  readonly inheritanceRules: ContextInheritanceRules;
  /** Delegation context with inline data and/or artifact references */
  readonly context: DelegationContext;
  /** Workspace root path */
  readonly workspaceRoot: string;
  /** Timestamp of handoff */
  readonly timestamp: Date;
}

/**
 * Integration depth when merging child results back to parent.
 */
export type ResultIntegrationMode = "full" | "summary" | "structured";

/**
 * Contract defining how child agent results propagate back to parent.
 */
export interface ResultPropagationContract {
  /** Integration mode for this result */
  readonly integrationMode: ResultIntegrationMode;
  /** Whether to include full conversation history */
  readonly includeFullHistory: boolean;
  /** Whether to apply condenser pipeline (ADR-017) to result */
  readonly applyCondenser: boolean;
  /** Custom fields to extract for structured mode */
  readonly structuredFields?: readonly string[];
  /** Maximum tokens for result summary */
  readonly maxResultTokens?: number;
}

/**
 * Standardized result returned from child to parent agent.
 */
export interface AgentDelegationResult {
  /** Child execution metadata */
  readonly executionId: string;
  readonly agentName: string;
  readonly parentExecutionId: string;
  /** Execution outcome */
  readonly success: boolean;
  /** Primary output/answer */
  readonly output: string;
  /** Full conversation history (if requested) */
  readonly conversationHistory?: unknown[];
  /** Condensed summary of work done */
  readonly summary?: string;
  /** Structured data (if contract specified fields) */
  readonly structuredData?: Record<string, unknown>;
  /** Metrics */
  readonly toolCalls: number;
  readonly tokensUsed: number;
  /** Timing */
  readonly startedAt: Date;
  readonly completedAt: Date;
  /** Token count of this result */
  readonly tokenCount: number;
}

/**
 * Complete delegation request combining envelope and contract.
 */
export interface DelegationRequest {
  /** Context handoff envelope */
  readonly envelope: ContextHandoffEnvelope;
  /** Result propagation contract */
  readonly resultContract: ResultPropagationContract;
  /** Maximum execution time in milliseconds */
  readonly timeoutMs?: number;
  /** Retry configuration */
  readonly retries?: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
  };
}

/**
 * Event emitted during delegation lifecycle.
 */
export interface DelegationEvent {
  readonly type:
    | "handoff.created"
    | "handoff.sent"
    | "child.started"
    | "child.progress"
    | "child.completed"
    | "child.failed"
    | "result.received"
    | "result.integrated";
  readonly handoffId: string;
  readonly timestamp: Date;
  readonly payload: unknown;
}

/**
 * Protocol error types for delegation failures.
 */
export type ProtocolErrorCode =
  | "HANDOFF_FAILED"
  | "INVALID_INHERITANCE_MODE"
  | "CONTEXT_TOO_LARGE"
  | "TIMEOUT"
  | "CANCELLED"
  | "RESULT_PROPAGATION_FAILED"
  | "CYCLE_DETECTED";

export class AgentProtocolError extends Error {
  readonly code: ProtocolErrorCode;
  readonly errorCause?: unknown;

  constructor(code: ProtocolErrorCode, message: string, errorCause?: unknown) {
    super(message);
    this.name = "AgentProtocolError";
    this.code = code;
    this.errorCause = errorCause;
  }
}

/**
 * Default inheritance rules per ADR-020.
 * Summary mode is the recommended default for best balance.
 */
export const DEFAULT_INHERITANCE_RULES: ContextInheritanceRules = {
  mode: "summary",
  maxTokens: 2000,
  includeHistory: true,
  includeToolResults: false,
};

/**
 * Default result propagation contract.
 */
export const DEFAULT_RESULT_CONTRACT: ResultPropagationContract = {
  integrationMode: "summary",
  includeFullHistory: false,
  applyCondenser: true,
  maxResultTokens: 1500,
};

/**
 * Validation: maximum delegation depth to prevent infinite loops.
 * Per ADR-003 Unlimited Nesting with Loop Detector.
 */
export const MAX_DELEGATION_DEPTH = 10;

/**
 * Size threshold for artifact inlining vs referencing.
 * Artifacts smaller than this (in bytes) are inlined directly.
 * Larger artifacts are passed by reference.
 */
export const INLINE_ARTIFACT_THRESHOLD_BYTES = 1024;

/**
 * Goal definition for delegation.
 * Formalizes "Definition of Done" for agent tasks.
 * Inspired by A2A Goal-Oriented Delegation pattern.
 */
export interface GoalDefinition {
  /** Human-readable task description */
  readonly taskDescription: string;
  /** Explicit criteria that must be satisfied for task completion */
  readonly successCriteria: readonly string[];
  /** Operational constraints for the agent */
  readonly constraints?: {
    /** Maximum tokens the agent may use */
    readonly maxTokens?: number;
    /** Maximum execution time in milliseconds */
    readonly timeoutMs?: number;
    /** Maximum tool calls allowed */
    readonly maxToolCalls?: number;
    /** Budget constraint (e.g., "max $0.10") */
    readonly budgetConstraint?: string;
  };
}

/**
 * Reference to an artifact (file, memory location, tool result).
 * Used for efficient context passing without copying large data.
 * Inspired by A2A Reference-Based Exchange pattern.
 */
export interface ArtifactReference {
  /** Unique identifier for this artifact */
  readonly artifactId: string;
  /** Type of artifact */
  readonly type: "file" | "memory" | "tool-result" | "session-state";
  /** URI reference to the artifact location */
  readonly uri: string;
  /** Optional checksum for integrity verification */
  readonly checksum?: string;
  /** Size in bytes (for capacity planning) */
  readonly sizeBytes: number;
  /** MIME type hint for the artifact content */
  readonly mimeType?: string;
  /** Optional description of what this artifact contains */
  readonly description?: string;
}

/**
 * Context with both inline data and artifact references.
 * Supersedes plain SerializedContext for efficient large-context handling.
 */
export interface DelegationContext {
  /** Inline text content (summaries, decisions) */
  readonly summary?: string;
  /** Key decisions made during parent execution */
  readonly keyDecisions?: readonly string[];
  /** Inline small artifacts (inlined when < INLINE_ARTIFACT_THRESHOLD_BYTES) */
  readonly inlineArtifacts?: readonly unknown[];
  /** References to large artifacts (avoid copying) */
  readonly artifactReferences?: readonly ArtifactReference[];
  /** Conversation messages if requested */
  readonly messages?: readonly unknown[];
  /** Token estimate for this context */
  readonly tokenCount: number;
}

/**
 * Check if a proposed delegation would create a cycle.
 */
export function wouldCreateCycle(
  parentExecutionId: string,
  proposedChildId: string,
  graph: Map<string, ParentChildGraphNode>,
): boolean {
  let currentId: string | null = parentExecutionId;
  const visited = new Set<string>();

  while (currentId !== null) {
    if (visited.has(currentId)) {
      return true; // Cycle detected in existing graph
    }
    if (currentId === proposedChildId) {
      return true; // Would create cycle
    }
    visited.add(currentId);

    const node = graph.get(currentId);
    currentId = node?.parentExecutionId ?? null;
  }

  return false;
}

/**
 * Generate unique execution ID.
 */
export function generateExecutionId(): string {
  return `exec_${String(Date.now())}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate unique handoff ID.
 */
export function generateHandoffId(): string {
  return `handoff_${String(Date.now())}_${Math.random().toString(36).substring(2, 11)}`;
}

export { generateTurnId } from "./turn-id.js";
