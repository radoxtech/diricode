## ADR-051 — Permission Context Engine: Phase 1 (Core)

| Field       | Value                                                                 |
|-------------|-----------------------------------------------------------------------|
| Status      | Accepted                                                              |
| Date        | 2026-03-31                                                            |
| Scope       | MVP-2                                                                 |
| References  | ADR-014 (Smart Hybrid Approval), ADR-015 (Tool Annotations), ADR-018 (SQLite), DC-SAFE-005 |

### Context

DiriCode runs in multiple execution contexts — interactive (user present), coordinator (orchestrating other agents), and swarm worker (background, speed-optimized). The current permission model in DC-SAFE-005 does not distinguish between these contexts: it applies the same approval logic regardless of whether a user is at the keyboard or an agent is running autonomously in the background.

Claude Code analysis (2026-03-31 pattern survey) revealed a richer permission model with context-specific handlers, granular permission levels, and structured audit logging. DiriCode needs equivalent or better capabilities for safe autonomous operation.

### Decision

**Introduce the Permission Context Engine (DC-SAFE-006) as an extension of the existing DC-SAFE system, delivered in two phases.**

**Phase 1 (this ADR, MVP-2)** delivers the core foundation:

**1. Multi-Context Permission Handlers**

Four context-specific handlers, each with a distinct approval strategy:

| Handler | Context | Strategy |
|---------|---------|----------|
| `CoordinatorHandler` | Orchestrating agents | Delegation-aware, trust hierarchy |
| `InteractiveHandler` | User at keyboard | Full UI approvals for all risky ops |
| `SwarmWorkerHandler` | Background agent | Speed-optimized, auto-approve safe ops |
| `DefaultHandler` | Fallback | Existing DC-SAFE-005 behavior |

**2. Granular Permission Levels**

Four levels replacing the binary allow/deny model:

```
"always-allow"  — never prompt, execute immediately
"auto-allow"    — prompt once per session, remember for duration
"ask"           — prompt every time
"never-allow"   — always block, no override
```

Default configuration per context:
```
coordinator: { destructive: "ask", risky: "auto-allow", safe: "always-allow" }
interactive:  { destructive: "ask", risky: "ask",        safe: "auto-allow"  }
swarm:        { destructive: "ask", risky: "auto-allow", safe: "always-allow" }
```

**3. Permission Audit Logging**

Every permission decision is logged to SQLite:
- Timestamp, context type, tool name, tool annotation risk level
- Decision (approved/denied/auto-approved)
- User response (if interactive)
- Session and agent identifiers

Queryable: "Show all denials this session", "Permission stats per tool", "Audit trail for compliance".

### Consequences

**Positive:**
- Swarm workers run efficiently without unnecessary prompts.
- Interactive users still get full control over risky operations.
- Coordinator agents can delegate with appropriate trust levels.
- Backwards compatible: DefaultHandler preserves existing behavior.
- Audit log provides observability and compliance trail.

**Negative:**
- Four handlers increase complexity vs current single path.
- Context detection must be reliable — wrong context = wrong permission policy.
- Async audit logging must not block execution on SQLite writes.

### Delivery

- **Scope**: MVP-2
- **Issues**: DC-SAFE-006a (Multi-Context Handlers), DC-SAFE-006b (Permission Audit Logging), DC-SAFE-006c (Granular Permission Levels)
- **Phase 2**: See ADR-052 for smart permission features (learning, UI, semantic analysis)
