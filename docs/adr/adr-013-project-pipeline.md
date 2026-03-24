# ADR-013 — Project Pipeline: Interview → Plan → Execute → Verify

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-plandex-roles.md, ADR-048                |

### Context

A structured pipeline ensures consistent task execution quality and enables checkpointing for recovery after failures.

### Decision

Standard **4-phase pipeline** for non-trivial tasks:

```
Interview → Plan → Execute → Verify
```

Each phase uses different agents. Dispatcher decides when to invoke the full pipeline vs. quick single-agent execution.

**Pipeline rules (MVP):**
- **Gray area auto-detection:** System flags areas requiring user decision.
- **Wave-based parallel execution:** Independent subtasks run in parallel.
- **Deviation rules (4):**
  1. Auto-fix bugs encountered during execution.
  2. Auto-add missing imports/dependencies.
  3. Auto-fix blocking errors.
  4. **ASK** for any architectural changes.
- **Analysis paralysis guard:** 5+ reads without a write → STOP and escalate.
- **Context budget:** Max 50% of context window for active work.
- **Checkpoint protocols:** Save progress for resume after crash.
- **Atomic commits:** One commit per completed task.

### Consequences

- **Positive:** Predictable execution flow. Checkpoints enable recovery. Deviation rules balance autonomy with safety.
- **Negative:** Pipeline overhead for trivial tasks. Mitigated by dispatcher's ability to skip pipeline for simple requests.

### Addendum — Pipeline State Backend Update (2026-03-23)

Pipeline state (plans, tasks, checkpoints) is stored in the DiriCode Issue System — a local SQLite database (ADR-048), not GitHub Issues. GitHub Projects remains an optional sync target for team visibility but is not required for pipeline operation.

This change enables fully offline pipeline execution with no network dependency for any state operation.
