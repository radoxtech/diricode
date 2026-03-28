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

**Prototype-first sequencing (clarification, 2026-03-28):**

- MVP-1 is **sequential-first** by default. The first delivery goal is a believable end-to-end runtime path, not maximum parallel throughput.
- The first working path is: **Prompt → Dispatcher → Specialist → Tool execution → Response**.
- The full Interview → Plan → Execute → Verify pipeline remains the architectural target for non-trivial work, but early MVP implementation may expose planning/review stages progressively as the runtime path becomes stable.
- Wave-based parallel execution remains part of the architecture, but it is treated as a **later extension on top of a stable sequential baseline**, not as the defining MVP-1 execution mode.

**Pipeline rules (MVP):**
- **Gray area auto-detection:** System flags areas requiring user decision.
- **Sequential-first execution:** MVP-1 executes one task chain at a time unless a later, explicitly enabled wave-based mode is active.
- **Wave compatibility:** Planning and execution contracts must remain compatible with later wave-based parallel execution for clearly independent subtasks.
- **Deviation rules (4):**
  1. Auto-fix bugs encountered during execution.
  2. Auto-add missing imports/dependencies.
  3. Auto-fix blocking errors.
  4. **ASK** for any architectural changes.
- **Analysis paralysis guard:** 5+ reads without a write → STOP and escalate.
- **Context budget:** Max 50% of context window for active work.
- **Checkpoint protocols:** Save progress for resume after crash. This is an explicit MVP-1 requirement, not an optional hardening step.
- **Atomic commits:** One commit per completed task.

### Consequences

- **Positive:** Predictable execution flow. Checkpoints enable recovery. Sequential-first delivery reduces debugging complexity and makes early observability easier to trust. Deviation rules balance autonomy with safety.
- **Negative:** Pipeline overhead for trivial tasks. Parallel throughput is intentionally delayed for the first milestone. Mitigated by dispatcher's ability to skip pipeline for simple requests and by preserving forward compatibility for later wave execution.

### Addendum — Pipeline State Backend Update (2026-03-23)

Pipeline state (plans, tasks, checkpoints) is stored in the DiriCode Issue System — a local SQLite database (ADR-048), not GitHub Issues. GitHub Projects remains an optional sync target for team visibility but is not required for pipeline operation.

This change enables fully offline pipeline execution with no network dependency for any state operation.

### Addendum — Prototype-First Delivery Clarification (2026-03-28)

This ADR is retained as the long-term shape of non-trivial task execution, but current delivery sequencing is clarified:

- **What ships first:** a stable, observable, checkpointable sequential execution path.
- **What is explicitly later:** richer wave-based parallel execution, more advanced LLM-backed intent analysis, and broader autonomy patterns that depend on the sequential path being trustworthy first.
- **What must be visible from the start:** evented progress, failure states, and recovery checkpoints sufficient to resume work after interruption.
