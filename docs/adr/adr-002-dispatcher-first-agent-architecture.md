# ADR-002 — Dispatcher-First Agent Architecture

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-agent-roster.md, analiza-plandex-roles.md |

### Context

DiriCode needs a multi-agent orchestration model. The dispatcher pattern (thin orchestrator that delegates to specialized agents) was chosen over monolithic agent or flat peer-to-peer models for better cost control and separation of concerns.

### Decision

**Dispatcher-first architecture** with specialized agents organized by primary domain and capability metadata.

Core principles:
- Dispatcher is the orchestrating agent with minimal own context — it routes, delegates, and monitors.
- Dispatcher is **read-only** — it cannot directly mutate files, execute commands, or call external APIs (enforced at runtime, see DC-CORE-015).
- Sub-agents return **essential data only** (not full conversation history).
- Agent names are **descriptive only** (no mythological names — explicit project decision).
- Core agents are **hardcoded in TypeScript** (stable execution policies).
- Custom agents are defined as **SKILL.md** files (agentskills.io format).

The full agent roster (40 agents across 6 categories) is defined in ADR-004.

### Runtime Boundary Enforcement (DC-CORE-015)

The dispatcher's read-only status is enforced at runtime through:

**1. Tool Access Policy**
- Dispatcher is restricted to read-only tools: `list_agents`, `search_agents`, `classify_intent`, `read_file`, `list_files`, `search_files`, `search_web`, `emit_event`
- Mutating tools (`file_write`, `file_edit`, `bash`) are explicitly blocked
- Enforcement via `enforceDispatcherBoundary()` wrapper in `packages/core/src/agents/boundary-violation.ts`

**2. Runtime Contract**
```typescript
// packages/core/src/agents/dispatcher-contract.ts
export const DISPATCHER_CONTRACT: DispatcherRuntimeContract = {
  capabilities: {
    classify_intent: true,
    discover_agents: true,
    delegate: true,
    monitor_progress: true,
    emit_event: true,
    read_context: true,
  },
  prohibitions: {
    mutate_files: true,
    execute_commands: true,
    call_external_apis: true,
    execute_domain_logic: true,
    make_domain_decisions: true,
  },
  allowedTools: [...], // 9 read-only tools
};
```

**3. Boundary Violation Handling**
- Attempts to use prohibited tools throw `BoundaryViolationError`
- Structured events emitted: `dispatcher.boundary.violation.tool_attempt`
- Clear error messages indicate what was attempted and what should be done instead (delegate to specialist)

**4. Child-Agent Attribution**
- Delegation graph tracks execution attribution
- Every tool call records: `executionAgent` (who performed it) and `delegatedFrom` (who delegated it)
- Prevents "dispatcher claims credit for specialist's work"

### Consequences

- **Positive:** Clear separation of concerns. Each agent has a focused prompt and model assignment. Cost-effective (cheap agents for cheap tasks). Dispatcher cannot accidentally mutate state.
- **Negative:** Requires careful context passing between agents. Dispatcher quality is critical — bad routing = bad results.

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**Async Subagent Execution** (ADR-039)
The dispatcher now supports asynchronous execution for HEAVY tier agents via the 3-tool pattern: `start_job` → `check_status` → `get_result`. This allows the dispatcher to start long-running tasks, perform other work, and collect results later. LIGHT and MEDIUM tier agents remain synchronous.

**Tool-Based Agent Discovery** (ADR-040)
Instead of maintaining all 40+ agent descriptions in the system prompt, the dispatcher now uses `list_agents()` and `search_agents()` tools to discover available agents dynamically. This reduces token usage and allows the dispatcher to find the most relevant agents for each task.

**Supervisor Pattern Mapping**
DiriCode's dispatcher aligns with LangChain's "supervisor" concept: the dispatcher is the supervisor that routes tasks, and sub-agents are the workers that execute them. This terminology is for conceptual alignment only — DiriCode implements this pattern natively without LangChain dependencies.

### Addendum — Runtime Boundary Enforcement (2026-04-01)

**Implementation**: DC-CORE-015 enforces the dispatcher's read-only boundary at runtime:
- `packages/core/src/agents/dispatcher-contract.ts` — Runtime contract definitions
- `packages/core/src/agents/boundary-violation.ts` — Boundary violation errors and enforcement
- `packages/agents/src/__tests__/dispatcher-boundary.test.ts` — Tests for permitted/prohibited behaviors

**Observability Events**:
- `dispatcher.boundary.checked` — Emitted when boundary is verified
- `dispatcher.boundary.violation.tool_attempt` — Emitted on violation attempts
- `dispatcher.intent.classified`, `dispatcher.agent.selected`, `dispatcher.delegation.created` — Routing/delegation tracking
