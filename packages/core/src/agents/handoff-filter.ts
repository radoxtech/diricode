import type { AgentContext, AgentDomain } from "./types.js";
import type { ToolAccessPolicy } from "../tools/types.js";
import type { ContextInheritanceRules, DelegationContext, ArtifactReference } from "./protocol.js";

/**
 * Policy for what context to include or exclude during handoff.
 * Enforces per-agent context boundaries per Pattern 09 — Handoff Input Filtering.
 */
export interface ContextFilterPolicy {
  /** Categories of context to include */
  readonly includeCategories: readonly ContextCategory[];
  /** Categories of context to explicitly exclude */
  readonly excludeCategories: readonly ContextCategory[];
  /** Maximum age (in ms) for tool results - older are excluded */
  readonly maxToolResultAgeMs?: number;
  /** Whether to include parent workspace state */
  readonly includeWorkspaceState: boolean;
  /** Whether to include parent tool usage history */
  readonly includeToolHistory: boolean;
  /** Maximum token budget for handoff context */
  readonly maxTokenBudget?: number;
}

/**
 * Categories of context that can be filtered during handoff.
 */
export type ContextCategory =
  | "tool-results"
  | "file-state"
  | "memory-state"
  | "conversation-history"
  | "decisions"
  | "artifacts"
  | "constraints";

/**
 * Metadata about what was filtered during handoff creation.
 * Includes observability data for debugging and audit per Pattern 09.
 */
export interface HandoffFilterMetadata {
  readonly filteredCategories: readonly ContextCategory[];
  readonly filteredCount: number;
  readonly estimatedTokensSaved: number;
  readonly timestamp: string;
  /** Tool scope boundaries enforced for this handoff */
  readonly toolScopeBoundaries: {
    readonly allowedTools: readonly string[];
    readonly deniedTools: readonly string[];
  };
  /** Inheritance mode used for this handoff */
  readonly inheritanceMode: string;
}

/**
 * Result of filtering context for handoff.
 */
export interface FilteredHandoffContext {
  readonly filteredContext: DelegationContext;
  readonly metadata: HandoffFilterMetadata;
}

/**
 * Default filter policies per agent domain.
 * Enforces bounded context inheritance per ADR-020.
 * Research agents get more context, utility agents get minimal context.
 */
export const DEFAULT_FILTER_POLICIES: Record<AgentDomain, ContextFilterPolicy> = {
  coding: {
    includeCategories: ["file-state", "artifacts", "constraints"],
    excludeCategories: ["memory-state", "conversation-history"],
    includeWorkspaceState: true,
    includeToolHistory: false,
    maxTokenBudget: 8000,
  },
  planning: {
    includeCategories: ["decisions", "constraints", "conversation-history"],
    excludeCategories: ["tool-results", "file-state"],
    includeWorkspaceState: false,
    includeToolHistory: true,
    maxTokenBudget: 6000,
  },
  review: {
    includeCategories: ["tool-results", "file-state", "decisions"],
    excludeCategories: ["memory-state"],
    includeWorkspaceState: true,
    includeToolHistory: true,
    maxTokenBudget: 6000,
  },
  research: {
    includeCategories: ["tool-results", "conversation-history", "decisions", "artifacts"],
    excludeCategories: [],
    includeWorkspaceState: false,
    includeToolHistory: true,
    maxTokenBudget: 10000,
  },
  utility: {
    includeCategories: ["constraints"],
    excludeCategories: [
      "tool-results",
      "file-state",
      "memory-state",
      "conversation-history",
      "decisions",
      "artifacts",
    ],
    includeWorkspaceState: false,
    includeToolHistory: false,
    maxTokenBudget: 2000,
  },
  devops: {
    includeCategories: ["tool-results", "file-state", "artifacts", "constraints"],
    excludeCategories: ["memory-state", "conversation-history"],
    includeWorkspaceState: true,
    includeToolHistory: true,
    maxTokenBudget: 7000,
  },
};

/**
 * Default filter policy when no specific policy matches.
 */
export const DEFAULT_FILTER_POLICY: ContextFilterPolicy = {
  includeCategories: ["constraints", "artifacts"],
  excludeCategories: ["tool-results", "memory-state", "conversation-history"],
  includeWorkspaceState: true,
  includeToolHistory: false,
  maxTokenBudget: 4000,
};

/**
 * Creates a filter policy for a specific agent domain.
 */
export function createFilterPolicyForDomain(
  domain: AgentDomain,
  overrides?: Partial<ContextFilterPolicy>,
): ContextFilterPolicy {
  const base = DEFAULT_FILTER_POLICIES[domain];
  return {
    ...base,
    ...overrides,
  };
}

/**
 * Filter context based on inheritance rules and filter policy.
 * Returns filtered context along with metadata about what was filtered.
 * Implements deterministic context shaping per Pattern 09.
 */
export function filterContextForHandoff(
  parentContext: AgentContext,
  rules: ContextInheritanceRules,
  policy: ContextFilterPolicy,
  _agentDomain: AgentDomain,
  toolPolicy?: ToolAccessPolicy,
): FilteredHandoffContext {
  const filteredCategories: ContextCategory[] = [];
  let filteredCount = 0;
  let estimatedTokensSaved = 0;

  // Apply mode-based filtering first
  let context = applyModeFiltering(parentContext, rules);

  // Then apply policy-based filtering
  if (!policy.includeCategories.includes("tool-results")) {
    context = removeToolResults(context);
    filteredCategories.push("tool-results");
    filteredCount++;
    estimatedTokensSaved += context.tokenCount * 0.1;
  }

  if (!policy.includeCategories.includes("file-state")) {
    context = removeFileState(context);
    filteredCategories.push("file-state");
    filteredCount++;
    estimatedTokensSaved += context.tokenCount * 0.2;
  }

  if (!policy.includeCategories.includes("memory-state")) {
    context = removeMemoryState(context);
    filteredCategories.push("memory-state");
    filteredCount++;
    estimatedTokensSaved += context.tokenCount * 0.15;
  }

  if (!policy.includeCategories.includes("conversation-history")) {
    context = removeConversationHistory(context);
    filteredCategories.push("conversation-history");
    filteredCount++;
    estimatedTokensSaved += context.tokenCount * 0.3;
  }

  if (!policy.includeCategories.includes("decisions")) {
    context = removeDecisions(context);
    filteredCategories.push("decisions");
    filteredCount++;
    estimatedTokensSaved += context.tokenCount * 0.05;
  }

  if (!policy.includeCategories.includes("artifacts")) {
    context = removeArtifacts(context);
    filteredCategories.push("artifacts");
    filteredCount++;
    estimatedTokensSaved += context.tokenCount * 0.15;
  }

  if (!policy.includeCategories.includes("constraints")) {
    // Constraints are important - don't actually remove them
    // filteredCategories.push("constraints");
  }

  // Enforce token budget if specified
  if (policy.maxTokenBudget && context.tokenCount > policy.maxTokenBudget) {
    context = enforceTokenBudget(context, policy.maxTokenBudget);
    filteredCount++;
  }

  const allTools = parentContext.tools.map((t) => t.name);
  const allowedTools = toolPolicy?.allowedTools ?? allTools;
  const deniedTools = allTools.filter((t) => !allowedTools.includes(t));

  const metadata: HandoffFilterMetadata = {
    filteredCategories,
    filteredCount,
    estimatedTokensSaved: Math.round(estimatedTokensSaved),
    timestamp: new Date().toISOString(),
    toolScopeBoundaries: {
      allowedTools,
      deniedTools,
    },
    inheritanceMode: rules.mode,
  };

  return {
    filteredContext: context,
    metadata,
  };
}

function makeArtifactRef(uri: string, type: ArtifactReference["type"]): ArtifactReference {
  return {
    artifactId: `art_${String(Date.now())}_${Math.random().toString(36).substring(2, 11)}`,
    type,
    uri,
    sizeBytes: 1024,
  };
}

function applyModeFiltering(
  parentContext: AgentContext,
  rules: ContextInheritanceRules,
): DelegationContext {
  switch (rules.mode) {
    case "isolated":
      return {
        summary: `Session ${parentContext.sessionId}: Working in ${parentContext.workspaceRoot}`,
        tokenCount: estimateTokens(parentContext.workspaceRoot),
      };

    case "summary":
      return {
        summary: `Session ${parentContext.sessionId}: ${parentContext.workspaceRoot}`,
        keyDecisions: rules.includeHistory ? [] : undefined,
        artifactReferences: rules.includeFiles?.map((path) => makeArtifactRef(path, "file")),
        tokenCount: estimateTokens(
          `${parentContext.sessionId} ${parentContext.workspaceRoot} ${rules.includeFiles?.join(" ") ?? ""}`,
        ),
      };

    case "full":
      return {
        summary: `Session ${parentContext.sessionId}: ${parentContext.workspaceRoot}`,
        keyDecisions: rules.includeHistory ? [] : undefined,
        messages: rules.includeHistory ? [] : undefined,
        artifactReferences: rules.includeFiles?.map((path) => makeArtifactRef(path, "file")),
        tokenCount: estimateTokens(
          JSON.stringify({
            sessionId: parentContext.sessionId,
            workspace: parentContext.workspaceRoot,
            files: rules.includeFiles,
          }),
        ),
      };

    default:
      return { tokenCount: 0 };
  }
}

function removeToolResults(context: DelegationContext): DelegationContext {
  return {
    ...context,
    inlineArtifacts: undefined,
  };
}

function removeFileState(context: DelegationContext): DelegationContext {
  return {
    ...context,
    artifactReferences: context.artifactReferences?.filter((ref) => ref.type !== "file"),
  };
}

function removeMemoryState(context: DelegationContext): DelegationContext {
  return {
    ...context,
    artifactReferences: context.artifactReferences?.filter((ref) => ref.type !== "memory"),
  };
}

function removeConversationHistory(context: DelegationContext): DelegationContext {
  return {
    ...context,
    messages: undefined,
  };
}

function removeDecisions(context: DelegationContext): DelegationContext {
  return {
    ...context,
    keyDecisions: undefined,
  };
}

function removeArtifacts(context: DelegationContext): DelegationContext {
  return {
    ...context,
    inlineArtifacts: undefined,
    artifactReferences: context.artifactReferences?.filter((ref) => ref.type !== "tool-result"),
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function enforceTokenBudget(context: DelegationContext, maxBudget: number): DelegationContext {
  let adjusted = { ...context };

  if (adjusted.messages && adjusted.tokenCount > maxBudget) {
    const keptMessages = adjusted.messages.slice(-5);
    adjusted = {
      ...adjusted,
      messages: keptMessages,
      tokenCount: estimateTokens(JSON.stringify(keptMessages)),
    };
  }

  if (adjusted.inlineArtifacts && adjusted.tokenCount > maxBudget) {
    adjusted = {
      ...adjusted,
      inlineArtifacts: [],
      tokenCount: adjusted.tokenCount - 500,
    };
  }

  if (adjusted.artifactReferences && adjusted.tokenCount > maxBudget) {
    adjusted = {
      ...adjusted,
      artifactReferences: adjusted.artifactReferences.slice(0, 10),
      tokenCount: Math.min(adjusted.tokenCount, maxBudget),
    };
  }

  return adjusted;
}

export function mergeFilterPolicies(
  base: ContextFilterPolicy,
  override: Partial<ContextFilterPolicy>,
): ContextFilterPolicy {
  return {
    ...base,
    ...override,
    includeCategories: override.includeCategories ?? base.includeCategories,
    excludeCategories: override.excludeCategories ?? base.excludeCategories,
  };
}
