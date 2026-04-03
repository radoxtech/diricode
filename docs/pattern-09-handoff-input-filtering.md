# Pattern 09 — Handoff Input Filtering

| Attribute   | Value                                      |
|-------------|--------------------------------------------|
| Pattern ID  | 09                                         |
| Status      | Implemented                                |
| Issue       | DC-CORE-016                                |
| Scope       | MVP-1                                      |
| Related     | ADR-002, ADR-020, Pattern 08              |

## Problem

Without explicit filtering, child agents inherit too much context from parents:
- Tool call history from unrelated tasks
- Stale or irrelevant workspace state
- Memory snapshots that don't apply to the child's task
- Conversation history that inflates token count without adding value

This makes delegation weaker and less predictable, especially for bounded-context agents.

## Solution

Filter and shape parent→child handoff inputs so child agents receive only the task-relevant context they need, not uncontrolled raw parent state.

## Implementation

### Context Filter Policy

Each agent primary domain has a default filter policy in `packages/core/src/agents/handoff-filter.ts`:

```typescript
export const DEFAULT_FILTER_POLICIES: Record<AgentDomain, ContextFilterPolicy> = {
  coding: {
    includeCategories: ["file-state", "artifacts", "constraints"],
    excludeCategories: ["memory-state", "conversation-history"],
    includeWorkspaceState: true,
    includeToolHistory: false,
  },
  planning: {
    includeCategories: ["decisions", "constraints", "conversation-history"],
    excludeCategories: ["tool-results", "file-state"],
    includeWorkspaceState: false,
    includeToolHistory: true,
  },
  review: {
    includeCategories: ["tool-results", "file-state", "decisions"],
    excludeCategories: ["memory-state"],
    includeWorkspaceState: true,
    includeToolHistory: true,
  },
  research: {
    includeCategories: ["tool-results", "conversation-history", "decisions", "artifacts"],
    excludeCategories: [],
    includeWorkspaceState: false,
    includeToolHistory: true,
  },
  utility: {
    includeCategories: ["constraints"],
    excludeCategories: ["tool-results", "file-state", "memory-state", "conversation-history", "decisions", "artifacts"],
    includeWorkspaceState: false,
    includeToolHistory: false,
  },
  devops: {
    includeCategories: ["tool-results", "file-state", "artifacts", "constraints"],
    excludeCategories: ["memory-state", "conversation-history"],
    includeWorkspaceState: true,
    includeToolHistory: true,
  },
};
```

### Filter Categories

Context is filtered by category:

- `tool-results` — Results from parent tool executions
- `file-state` — Current file contents or references
- `memory-state` — Memory snapshots from parent
- `conversation-history` — Past messages between user and agent
- `decisions` — Key decisions made by parent
- `artifacts` — Generated artifacts (patches, summaries, etc.)
- `constraints` — Task constraints and success criteria

### Handoff Metadata

Every handoff emits metadata about what was filtered:

```typescript
interface HandoffFilterMetadata {
  filteredCategories: readonly ContextCategory[];
  filteredCount: number;
  estimatedTokensSaved: number;
  timestamp: string;
}
```

This enables observability into what context each child received.

### Filtering Process

1. **Mode-based filtering** — Apply `ContextInheritanceRules.mode` (isolated/summary/full)
2. **Policy-based filtering** — Remove categories based on agent domain policy
3. **Emit metadata** — Record what was filtered for observability

```typescript
function filterContextForHandoff(
  parentContext: AgentContext,
  rules: ContextInheritanceRules,
  policy: ContextFilterPolicy,
  agentDomain: AgentDomain
): FilteredHandoffContext {
  // Apply mode filtering
  let context = applyModeFiltering(parentContext, rules);

  // Apply policy-based category filtering
  if (!policy.includeCategories.includes("tool-results")) {
    context = removeToolResults(context);
  }
  // ... additional filtering

  return { filteredContext: context, metadata };
}
```

## Observability Events

The following events are emitted during handoff filtering:

| Event | When |
|-------|------|
| `handoff.created` | Handoff envelope created |
| `handoff.filtered` | Context filtering applied |
| `handoff.sent` | Handoff delivered to child agent |

## Example

### Research Agent Handoff

```typescript
const policy = createFilterPolicyForDomain("research");

const result = filterContextForHandoff(
  parentContext,
  { mode: "summary", includeHistory: true },
  policy,
  "research"
);

// result.filteredContext includes:
// - conversation-history
// - decisions
// - artifacts
// But NOT:
// - file-state
// - memory-state
```

### Utility Agent Handoff

```typescript
const policy = createFilterPolicyForDomain("utility");

const result = filterContextForHandoff(
  parentContext,
  { mode: "isolated" },
  policy,
  "utility"
);

// result.filteredContext includes only:
// - constraints
// Minimal context for simple, bounded tasks
```

## Benefits

1. **Predictable delegation** — Each agent domain gets appropriate context
2. **Token efficiency** — Filtering reduces unnecessary context passing
3. **Security** — Stale or irrelevant context doesn't leak to child agents
4. **Observability** — Filter metadata enables debugging and auditing
5. **Bounded context** — Children receive only what they need

## Trade-offs

- **Complexity** — More moving parts in delegation
- **Potential over-filtering** — Might miss edge cases where context is needed
- **Configuration burden** — Each agent domain needs policy definition

## Testing

Tests verify:
- Research agents receive conversation history and decisions
- Utility agents receive minimal context
- Filtering metadata is accurate
- Mode-based filtering works correctly

## References

- ADR-002: Dispatcher-First Agent Architecture
- ADR-020: Sub-Agent Context Inheritance
- DC-CORE-016: Delegation handoff filtering and context boundaries
- `packages/core/src/agents/handoff-filter.ts`
