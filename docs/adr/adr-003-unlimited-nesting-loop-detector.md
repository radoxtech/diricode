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

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**ToolCallLimit Refinement** (ADR-035)
The existing "hard iteration limit: 50" has been refined into two distinct limits:
- `thread_limit`: 50 — session-wide total (maps to existing limit)
- `run_limit`: per-agent budget (20 LIGHT, 50 MEDIUM, 100 HEAVY)

This provides granular control while maintaining the session-wide safety net. Both limits are implemented as `wrap_tool_call` wrappers.

**Structured Retry** (ADR-036)
The loop detector catches infinite loops (repeated errors), while the new `ToolRetry` middleware handles transient failures (rate limits, timeouts) using exponential backoff with jitter:
```
delay = min(initial * factor^attempt, max_delay) ± jitter
```

These are complementary systems: loop detector for patterns, retry for transient failures.

**`jump_to` for Early Exit**
The hook framework now supports `jump_to("end")`, `jump_to("tools")`, and `jump_to("model")` for controlled early termination, providing a cleaner alternative to the hard stop mechanism.
