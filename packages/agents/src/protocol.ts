import type {
  Agent,
  AgentContext,
  AgentResult,
  ContextHandoffEnvelope,
  ContextInheritanceRules,
  DelegationRequest,
  ResultPropagationContract,
  AgentDelegationResult,
  ParentChildGraphNode,
  DelegationContext,
  GoalDefinition,
  ArtifactReference,
} from "@diricode/core";
import {
  AgentProtocolError,
  DEFAULT_INHERITANCE_RULES,
  MAX_DELEGATION_DEPTH,
  wouldCreateCycle,
  generateExecutionId,
  generateHandoffId,
} from "@diricode/core";

/**
 * Tracks the parent-child relationship graph for all agent executions.
 */
export interface ToolExecutionRecord {
  toolName: string;
  executionAgent: string;
  delegatedFrom: string | null;
  timestamp: Date;
}

export class DelegationGraph {
  readonly #toolCalls = new Map<string, ToolExecutionRecord[]>();

  recordToolCall(executionId: string, toolName: string): void {
    const node = this.#nodes.get(executionId);
    if (!node) return;
    const parentNode = node.parentExecutionId ? this.#nodes.get(node.parentExecutionId) : null;
    const record: ToolExecutionRecord = {
      toolName,
      executionAgent: node.agentName,
      delegatedFrom: parentNode ? parentNode.agentName : null,
      timestamp: new Date(),
    };
    const calls = this.#toolCalls.get(executionId) ?? [];
    calls.push(record);
    this.#toolCalls.set(executionId, calls);
  }

  getAttributionTrace(executionId: string): ToolExecutionRecord[] {
    const trace: ToolExecutionRecord[] = [];
    const calls = this.#toolCalls.get(executionId);
    if (calls) trace.push(...calls);
    const node = this.#nodes.get(executionId);
    if (node) {
      for (const childId of node.childExecutionIds) {
        trace.push(...this.getAttributionTrace(childId));
      }
    }
    return trace.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  readonly #nodes = new Map<string, ParentChildGraphNode>();

  /**
   * Register a new execution node in the graph.
   */
  registerNode(params: {
    executionId: string;
    agentName: string;
    parentExecutionId: string | null;
    tier: ParentChildGraphNode["tier"];
    category: ParentChildGraphNode["category"];
  }): ParentChildGraphNode {
    const parentNode = params.parentExecutionId ? this.#nodes.get(params.parentExecutionId) : null;

    const depth = parentNode ? parentNode.depth + 1 : 0;

    const node: ParentChildGraphNode = {
      executionId: params.executionId,
      agentName: params.agentName,
      parentExecutionId: params.parentExecutionId,
      childExecutionIds: [],
      tier: params.tier,
      category: params.category,
      depth,
      startedAt: new Date(),
      completedAt: null,
      status: "running",
    };

    this.#nodes.set(params.executionId, node);

    // Link to parent
    if (params.parentExecutionId && parentNode) {
      const updatedParent: ParentChildGraphNode = {
        ...parentNode,
        childExecutionIds: [...parentNode.childExecutionIds, params.executionId],
      };
      this.#nodes.set(params.parentExecutionId, updatedParent);
    }

    return node;
  }

  /**
   * Mark an execution as completed.
   */
  completeNode(executionId: string, success: boolean): ParentChildGraphNode | null {
    const node = this.#nodes.get(executionId);
    if (!node) return null;

    const updated: ParentChildGraphNode = {
      ...node,
      completedAt: new Date(),
      status: success ? "completed" : "failed",
    };
    this.#nodes.set(executionId, updated);
    return updated;
  }

  /**
   * Get a node by execution ID.
   */
  getNode(executionId: string): ParentChildGraphNode | null {
    return this.#nodes.get(executionId) ?? null;
  }

  /**
   * Get all children of a node.
   */
  getChildren(parentExecutionId: string): ParentChildGraphNode[] {
    const parent = this.#nodes.get(parentExecutionId);
    if (!parent) return [];

    return parent.childExecutionIds
      .map((id) => this.#nodes.get(id))
      .filter((n): n is ParentChildGraphNode => n !== undefined);
  }

  /**
   * Check if delegation would create a cycle.
   */
  wouldCreateCycle(parentExecutionId: string, childExecutionId: string): boolean {
    return wouldCreateCycle(parentExecutionId, childExecutionId, this.#nodes);
  }

  /**
   * Get current depth of an execution.
   */
  getDepth(executionId: string): number {
    return this.#nodes.get(executionId)?.depth ?? 0;
  }

  /**
   * Check if execution exceeds max delegation depth.
   */
  exceedsMaxDepth(executionId: string): boolean {
    const depth = this.getDepth(executionId);
    return depth >= MAX_DELEGATION_DEPTH;
  }

  /**
   * Get the full graph for debugging/observability.
   */
  getGraph(): Map<string, ParentChildGraphNode> {
    return new Map(this.#nodes);
  }

  /**
   * Get root executions (those with no parent).
   */
  getRoots(): ParentChildGraphNode[] {
    return Array.from(this.#nodes.values()).filter((n) => n.parentExecutionId === null);
  }
}

/**
 * Serializes context based on inheritance rules.
 * Returns DelegationContext with inline data and/or artifact references.
 * Implements the context handoff logic from ADR-020.
 */
export function serializeContext(
  parentContext: AgentContext,
  rules: ContextInheritanceRules,
  parentConversation?: unknown[],
): DelegationContext {
  const base: DelegationContext = {
    tokenCount: 0,
  };

  switch (rules.mode) {
    case "isolated":
      return {
        ...base,
        summary: `Session ${parentContext.sessionId}: Working in ${parentContext.workspaceRoot}`,
        inlineArtifacts: rules.includeFiles ? [] : undefined,
        artifactReferences: rules.includeFiles
          ? rules.includeFiles.map((path) => createArtifactReference(path, "file"))
          : undefined,
        tokenCount: estimateTokens(rules.includeFiles?.join(" ") ?? ""),
      };

    case "summary": {
      const summary = generateSummary(parentContext, parentConversation);
      const relevantFiles = extractRelevantFiles(parentContext, rules);
      return {
        ...base,
        summary,
        keyDecisions: extractKeyDecisions(parentConversation),
        artifactReferences: relevantFiles.map((path) => createArtifactReference(path, "file")),
        tokenCount: estimateTokens(summary + relevantFiles.join("")),
      };
    }

    case "full":
      return {
        ...base,
        summary: generateSummary(parentContext, parentConversation),
        keyDecisions: extractKeyDecisions(parentConversation),
        messages: rules.includeHistory ? parentConversation : [],
        artifactReferences: extractRelevantFiles(parentContext, rules).map((path) =>
          createArtifactReference(path, "file"),
        ),
        tokenCount: estimateTokens(JSON.stringify(parentConversation)),
      };

    default:
      throw new Error(`Invalid inheritance mode: ${String(rules.mode)}`);
  }
}

function generateSummary(context: AgentContext, _conversation?: unknown[]): string {
  return `Session ${context.sessionId}: Working in ${context.workspaceRoot}`;
}

function extractRelevantFiles(context: AgentContext, rules: ContextInheritanceRules): string[] {
  const files: string[] = [];

  if (rules.includeFiles) {
    files.push(...rules.includeFiles);
  }

  return [...new Set(files)];
}

function extractKeyDecisions(conversation?: unknown[]): string[] {
  if (!conversation) return [];
  return [];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Creates an artifact reference from a path or URI.
 */
export function createArtifactReference(
  uri: string,
  type: ArtifactReference["type"],
  description?: string,
): ArtifactReference {
  const artifactId = `art_${String(Date.now())}_${Math.random().toString(36).substring(2, 11)}`;

  return {
    artifactId,
    type,
    uri,
    checksum: undefined,
    sizeBytes: estimateArtifactSize(uri),
    mimeType: inferMimeType(uri),
    description,
  };
}

function estimateArtifactSize(uri: string): number {
  if (uri.startsWith("memory://") || uri.startsWith("session://")) {
    return 512;
  }
  return 1024;
}

function inferMimeType(uri: string): string | undefined {
  const ext = uri.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    ts: "application/typescript",
    tsx: "application/typescript",
    js: "application/javascript",
    jsx: "application/javascript",
    json: "application/json",
    md: "text/markdown",
    txt: "text/plain",
    sql: "application/sql",
  };
  return ext ? mimeTypes[ext] : undefined;
}

/**
 * Resolves an artifact reference to actual content.
 * In a full implementation, this would fetch from SQLite or file system.
 */
export function resolveArtifactReference(ref: ArtifactReference, _context: AgentContext): unknown {
  if (ref.uri.startsWith("memory://")) {
    return null;
  }
  if (ref.uri.startsWith("session://")) {
    return null;
  }
  if (ref.type === "file") {
    return null;
  }
  return null;
}

/**
 * Creates a context handoff envelope for parent-to-child delegation.
 */
export function createHandoffEnvelope(params: {
  parentExecutionId: string;
  parentAgentName: string;
  sessionId: string;
  workspaceRoot: string;
  taskInput: string;
  successCriteria?: readonly string[];
  constraints?: GoalDefinition["constraints"];
  inheritanceRules?: ContextInheritanceRules;
  parentContext: AgentContext;
  parentConversation?: unknown[];
  filteredContext?: DelegationContext;
}): ContextHandoffEnvelope {
  const rules = params.inheritanceRules ?? DEFAULT_INHERITANCE_RULES;
  const handoffId = generateHandoffId();
  const childExecutionId = generateExecutionId();

  const goal: GoalDefinition = {
    taskDescription: params.taskInput,
    successCriteria: params.successCriteria ?? [],
    constraints: params.constraints,
  };

  // Use pre-filtered context if provided, otherwise serialize from parent context
  const delegationContext =
    params.filteredContext ??
    serializeContext(params.parentContext, rules, params.parentConversation);

  return {
    handoffId,
    parent: {
      executionId: params.parentExecutionId,
      agentName: params.parentAgentName,
      sessionId: params.sessionId,
    },
    childExecutionId,
    goal,
    inheritanceRules: rules,
    context: delegationContext,
    workspaceRoot: params.workspaceRoot,
    timestamp: new Date(),
  };
}

/**
 * Converts standard AgentResult to AgentDelegationResult with protocol metadata.
 */
export function createDelegationResult(
  baseResult: AgentResult,
  envelope: ContextHandoffEnvelope,
  contract: ResultPropagationContract,
): AgentDelegationResult {
  return {
    executionId: envelope.childExecutionId,
    agentName: envelope.parent.agentName,
    parentExecutionId: envelope.parent.executionId,
    success: baseResult.success,
    output: baseResult.output,
    conversationHistory: contract.includeFullHistory ? [] : undefined,
    summary: contract.applyCondenser ? baseResult.output.substring(0, 500) : undefined,
    toolCalls: baseResult.toolCalls,
    tokensUsed: baseResult.tokensUsed,
    startedAt: envelope.timestamp,
    completedAt: new Date(),
    tokenCount: estimateTokens(baseResult.output),
  };
}

/**
 * Main protocol engine that manages delegation lifecycle.
 */
export class ProtocolEngine {
  readonly #graph = new DelegationGraph();

  get graph(): DelegationGraph {
    return this.#graph;
  }

  /**
   * Validates a delegation request before execution.
   */
  validateDelegation(
    request: DelegationRequest,
    parentExecutionId: string,
  ): { valid: true } | { valid: false; error: AgentProtocolError } {
    // Check for cycles
    if (this.#graph.wouldCreateCycle(parentExecutionId, request.envelope.childExecutionId)) {
      return {
        valid: false,
        error: new AgentProtocolError(
          "CYCLE_DETECTED",
          `Delegation would create a cycle from ${parentExecutionId} to ${request.envelope.childExecutionId}`,
        ),
      };
    }

    // Check max depth
    if (this.#graph.exceedsMaxDepth(parentExecutionId)) {
      return {
        valid: false,
        error: new AgentProtocolError(
          "HANDOFF_FAILED",
          `Maximum delegation depth (${String(MAX_DELEGATION_DEPTH)}) exceeded`,
        ),
      };
    }

    return { valid: true };
  }

  /**
   * Execute a delegation request.
   */
  async executeDelegation(
    request: DelegationRequest,
    childAgent: Agent,
    parentContext: AgentContext,
    emit: (event: string, payload: unknown) => void,
  ): Promise<AgentDelegationResult> {
    const { envelope, resultContract } = request;

    // Register child in graph
    const childNode = this.#graph.registerNode({
      executionId: envelope.childExecutionId,
      agentName: childAgent.metadata.name,
      parentExecutionId: envelope.parent.executionId,
      tier: childAgent.metadata.tier,
      category: childAgent.metadata.category,
    });

    emit("delegation.child.started", {
      handoffId: envelope.handoffId,
      childExecutionId: envelope.childExecutionId,
      childAgent: childAgent.metadata.name,
      depth: childNode.depth,
    });

    try {
      // Create child context with inherited values
      const childContext: AgentContext = {
        ...parentContext,
        parentAgentId: envelope.parent.agentName,
        sessionId: envelope.parent.sessionId,
      };

      // Execute child agent with goal task description
      const result = await childAgent.execute(envelope.goal.taskDescription, childContext);

      // Mark complete in graph
      this.#graph.completeNode(envelope.childExecutionId, result.success);

      emit("delegation.child.completed", {
        handoffId: envelope.handoffId,
        childExecutionId: envelope.childExecutionId,
        success: result.success,
        toolCalls: result.toolCalls,
        tokensUsed: result.tokensUsed,
      });

      // Return formatted result
      return createDelegationResult(result, envelope, resultContract);
    } catch (error) {
      // Mark failed in graph
      this.#graph.completeNode(envelope.childExecutionId, false);

      emit("delegation.child.failed", {
        handoffId: envelope.handoffId,
        childExecutionId: envelope.childExecutionId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}

export {
  DEFAULT_INHERITANCE_RULES,
  DEFAULT_RESULT_CONTRACT,
  MAX_DELEGATION_DEPTH,
  INLINE_ARTIFACT_THRESHOLD_BYTES,
} from "@diricode/core";
