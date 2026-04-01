# Pattern 08 — Read-Only Dispatcher

| Attribute   | Value                                      |
|-------------|--------------------------------------------|
| Pattern ID  | 08                                         |
| Status      | Implemented                                |
| Issue       | DC-CORE-015                                |
| Scope       | MVP-1                                      |
| Related     | ADR-002, ADR-046                           |

## Problem

Without explicit enforcement, a dispatcher agent can gradually accumulate capabilities and become a "hidden general-purpose agent" that directly mutates files, executes commands, and makes domain decisions. This erodes the architectural boundary between orchestration and execution, making the system harder to reason about, test, and maintain.

## Solution

Enforce the dispatcher's **read-only** status at runtime through explicit contracts, tool policy restrictions, and clear boundary violation detection.

## Implementation

### Runtime Contract

The dispatcher's capabilities and prohibitions are codified in `packages/core/src/agents/dispatcher-contract.ts`:

```typescript
export const DISPATCHER_CONTRACT: DispatcherRuntimeContract = {
  capabilities: {
    classify_intent: true,      // Can classify user intent
    discover_agents: true,      // Can discover available agents
    delegate: true,             // Can delegate to specialists
    monitor_progress: true,     // Can monitor execution progress
    emit_event: true,           // Can emit observability events
    read_context: true,         // Can read context (files, state)
  },
  prohibitions: {
    mutate_files: true,         // Cannot write/edit/delete files
    execute_commands: true,     // Cannot execute shell commands
    call_external_apis: true,   // Cannot call external APIs
    execute_domain_logic: true, // Cannot execute domain-specific logic
    make_domain_decisions: true,// Cannot make domain-level decisions
  },
  allowedTools: [
    // Read-only operations only
    "list_agents",
    "search_agents", 
    "classify_intent",
    "emit_event",
    "read_file",
    "list_files",
    "search_files",
    "search_web",
  ],
};
```

### Boundary Enforcement

Tool access is enforced via `enforceDispatcherBoundary()` in `packages/core/src/agents/boundary-violation.ts`:

```typescript
export function enforceDispatcherBoundary(
  tools: readonly Tool[],
  emit: (event: string, payload: unknown) => void
): Tool[] {
  return tools.map((tool) => {
    if (isToolAllowed(tool.name, { allowedTools: DISPATCHER_CONTRACT.allowedTools })) {
      return tool; // Allow read-only tools
    }
    // Block prohibited tools with clear error
    return {
      ...tool,
      execute: async () => {
        const error = new BoundaryViolationError(
          "dispatcher.boundary.violation.tool_attempt",
          tool.name,
          `Dispatcher is prohibited from using mutating tool: ${tool.name}. Delegate to specialist agent instead.`
        );
        emit("dispatcher.boundary.violation.tool_attempt", error.toEvent("dispatcher"));
        throw error;
      },
    };
  });
}
```

### Violation Handling

When a boundary violation is attempted:

1. **Error thrown**: `BoundaryViolationError` with clear message
2. **Event emitted**: Structured violation event for observability
3. **Attribution preserved**: Full trace of who attempted what

```typescript
export class BoundaryViolationError extends AgentError {
  constructor(
    public readonly violationType: BoundaryViolationType,
    public readonly attemptedAction: string,
    message: string,
    public readonly severity: ViolationSeverity = "error",
  ) {
    super("BOUNDARY_VIOLATION", message);
  }
}
```

### Child-Agent Attribution

Every delegation records attribution in the delegation graph:

```typescript
interface ToolExecutionRecord {
  toolName: string;
  executionAgent: string;    // Who actually executed the tool
  delegatedFrom: string;     // Who delegated the work
  timestamp: string;
}
```

This prevents the dispatcher from claiming credit for work performed by specialists.

## Observability

The dispatcher emits structured events for monitoring:

| Event | Purpose |
|-------|---------|
| `dispatcher.boundary.checked` | Boundary verification performed |
| `dispatcher.boundary.violation.tool_attempt` | Prohibited tool access attempted |
| `dispatcher.intent.classified` | User intent classified |
| `dispatcher.agent.selected` | Specialist agent selected |
| `dispatcher.delegation.created` | Delegation envelope created |

## Example: Permitted vs Prohibited

### Permitted (Dispatcher can do)

```typescript
// Classify user intent
const intent = classifyIntent("Write a new function");
// → { category: "code", confidence: 0.95 }

// Discover available agents
const agents = await tools.list_agents();
// → [{ name: "code-writer", capabilities: [...] }, ...]

// Delegate to specialist
const result = await delegateTo("code-writer", task);
// → Delegation envelope created, child context prepared

// Emit observability events
emit("dispatcher.progress", { step: "routing", target: "code-writer" });
```

### Prohibited (Dispatcher cannot do)

```typescript
// Attempting to write files directly
await tools.file_write({ path: "src/index.ts", content: "..." });
// → BoundaryViolationError: Dispatcher is prohibited from using mutating tool: file_write

// Attempting to execute commands
await tools.bash({ command: "npm install" });
// → BoundaryViolationError: Dispatcher is prohibited from using mutating tool: bash

// Attempting external API calls
await tools.http_request({ url: "https://api.example.com" });
// → BoundaryViolationError: Tool not in dispatcher allowlist
```

## Benefits

1. **Clear separation**: Orchestration vs execution responsibilities are explicit
2. **Testable**: Dispatcher behavior is constrained and predictable
3. **Observable**: All routing/delegation actions emit events
4. **Maintainable**: Boundary violations fail fast with clear messages
5. **Secure**: Dispatcher cannot accidentally or maliciously mutate state

## Trade-offs

- **Overhead**: Runtime policy checks add small performance cost
- **Complexity**: Additional enforcement layer in the architecture
- **Rigidity**: Dispatcher cannot "just quickly" do something that requires mutation (must delegate)

## Testing

Tests in `packages/agents/src/__tests__/dispatcher-boundary.test.ts` verify:

- ✅ Dispatcher can classify intent and discover agents
- ✅ Dispatcher can delegate to specialists
- ✅ Dispatcher emits observability events
- ✅ Dispatcher attempting `file_write` throws `BoundaryViolationError`
- ✅ Dispatcher attempting `bash` throws `BoundaryViolationError`
- ✅ Violation events are emitted with structured data
- ✅ Error messages are clear and actionable

## References

- ADR-002: Dispatcher-First Agent Architecture
- DC-CORE-015: Read-only dispatcher boundary enforcement
- `packages/core/src/agents/dispatcher-contract.ts`
- `packages/core/src/agents/boundary-violation.ts`
- `packages/agents/src/__tests__/dispatcher-boundary.test.ts`
