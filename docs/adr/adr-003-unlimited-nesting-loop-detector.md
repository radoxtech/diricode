# ADR-003 — Unlimited Nesting with Loop Detector

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

Agents may need to delegate to sub-agents recursively (e.g., planner → code-writer → debugger → code-writer). A fixed depth limit is too restrictive, but unbounded recursion risks runaway costs.

### Decision

**Unlimited nesting depth** with hard guardrails:

| Guardrail | Default | Configurable |
|-----------|---------|--------------|
| Hard iteration limit | 50 | Yes |
| Token budget per task | Model-dependent | Yes |
| Loop detector | Repeated error N times → stop + report | Yes (N threshold) |
| Timeout per execution | Configurable | Yes |
| Sub-dispatcher on separate git worktree | Supported | Yes |

### Consequences

- **Positive:** No artificial depth limits. Complex multi-step tasks can complete naturally.
- **Negative:** Requires robust loop detection and budget enforcement. Without guardrails, costs could explode.
