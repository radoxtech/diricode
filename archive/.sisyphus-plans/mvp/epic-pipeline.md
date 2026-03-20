# Epic: Pipeline Orchestrator and Execution Control (MVP-1 → MVP-2)

> Package: `@diricode/core`
> Iteration: **MVP-1 (basic) → MVP-2 (full)**
> Issue IDs: **DC-PIPE-001..DC-PIPE-008**

## Summary

This epic implements DiriCode's execution pipeline from basic turn orchestration (MVP-1) to the complete 4-phase workflow with guardrails (MVP-2). It formalizes how user intent becomes executable tasks, how results are checkpointed into memory, and how the system enforces anti-drift and context safety constraints.

The pipeline must preserve dispatcher-first architecture, explicit phase transitions, and user authority for high-risk deviations. It aligns with ADR-013 (Interview→Plan→Execute→Verify), ADR-003 (delegation/loop safety), and cross-cutting requirements for typed events, deterministic state transitions, and observability integration.

---

## MVP-1 Issues (basic pipeline)

## Issue: DC-PIPE-001 — Turn lifecycle

### Goal

Create a robust turn execution lifecycle with traceable IDs, timeout safety, and result consolidation.

### Scope

- Lifecycle flow:
  1. user message received
  2. `turn.start` event emitted
  3. dispatch to execution path
  4. agent execution + tool actions
  5. `turn.end` emitted with result summary
- Turn identity:
  - unique `turn_id`
  - propagate across dispatcher/agents/tools/memory writes
- Timeout policy:
  - configurable turn timeout
  - default **5 minutes**
  - timeout state transition + typed error result
- Result aggregation:
  - collect outputs, status, cost/tokens, key observations
  - produce deterministic turn result envelope

### Acceptance criteria

- [ ] Every user message creates exactly one turn with unique ID.
- [ ] `turn.start` and `turn.end` events are always emitted (including failure paths).
- [ ] Timeout is enforced with default 5-minute cap and config override.
- [ ] Turn result includes aggregated status, outputs, and telemetry references.
- [ ] Turn ID is available in memory timeline and observability events.

### References

- `spec-mvp-diricode.md` (pipeline + telemetry expectations)
- `.sisyphus/plans/cross-cutting.md` (event naming, correlation IDs)

---

## Issue: DC-PIPE-002 — Basic Interview→Execute flow

### Goal

Implement initial routing logic between simple direct execution and planned execution.

### Scope

- Step 1: dispatcher analyzes user request complexity
- Step 2: if simple → route directly to code-writer path
- Step 3: if complex → delegate to planner, then execute produced plan
- Configurable complexity threshold:
  - heuristics and/or scoring rules
  - override via config for tuning
- Ensure deterministic route decision logged in turn metadata

### Acceptance criteria

- [ ] Dispatcher performs complexity classification for each turn.
- [ ] Simple requests bypass planner and execute directly.
- [ ] Complex requests go through planner before execution.
- [ ] Decision boundary is configurable and test-covered.
- [ ] Decision reason is observable in turn timeline metadata.

### References

- `spec-mvp-diricode.md` (dispatcher-first + planning model)
- `ankieta-features-ekosystem.md` (dual planner and complexity-driven flow)

---

## Issue: DC-PIPE-003 — Sequential task execution

### Goal

Provide reliable MVP-1 task runner with one-task-at-a-time semantics and checkpoints.

### Scope

- Sequential executor:
  - execute planned tasks strictly one at a time
  - for each task: invoke agent → collect result → validate success → continue/abort
- Failure behavior:
  - abort-on-failure default
  - explicit failure reason and last successful checkpoint
- Checkpointing:
  - after each task, persist execution state in memory
  - include task status, changed artifacts summary, telemetry linkage

### Acceptance criteria

- [ ] Planned tasks execute strictly sequentially in MVP-1.
- [ ] Task failure stops downstream execution by default.
- [ ] Checkpoint is saved after each task completion/failure.
- [ ] Resume metadata is sufficient for restart from last valid checkpoint.
- [ ] Sequential flow integrates with turn result aggregation.

### References

- `spec-mvp-diricode.md` (checkpoint protocols, atomic execution mindset)
- `analiza-context-management.md` (timeline/checkpoint persistence rationale)

---

## MVP-2 Issues (full pipeline with guardrails)

## Issue: DC-PIPE-004 — Interview→Plan→Execute→Verify pipeline

### Goal

Implement full 4-phase pipeline with explicit phase state machine and phase-specific controls.

### Scope

- Full phases:
  - `interview`
  - `plan`
  - `execute`
  - `verify`
- Explicit transition events:
  - `pipeline.phase-changed` with from/to, reason, turn/task context
- Phase guards:
  - validate prerequisites before entering next phase
  - enforce fail-fast on invalid transitions
- Verify phase integration:
  - verifier gate against requirements/success criteria
  - produces pass/fail and gap findings

### Acceptance criteria

- [ ] All four phases are represented in a typed state machine.
- [ ] Transitions are explicit, validated, and evented.
- [ ] Verify phase runs as independent gate before final success.
- [ ] Invalid phase transitions are rejected with typed errors.
- [ ] Full phase trace is reconstructable from timeline/events.

### References

- `spec-mvp-diricode.md` (ADR-013 canonical flow)
- `.sisyphus/plans/mvp/index.md` (MVP-2 exit criteria)

---

## Issue: DC-PIPE-005 — Wave-based parallel execution

### Goal

Upgrade executor from sequential to dependency-aware wave scheduling.

### Scope

- Build task dependency graph from plan
- Partition tasks into waves of independent work
- Execute model:
  - run all tasks in a wave concurrently
  - wait for full wave completion
  - then advance to next wave
- Failure policy:
  - if task fails, block dependent tasks in future waves
  - surface partial completion and remediation path

### Acceptance criteria

- [ ] Independent tasks are grouped into deterministic waves.
- [ ] Tasks inside a wave execute concurrently; waves remain ordered.
- [ ] Dependency violations are prevented by scheduler.
- [ ] Wave boundaries produce checkpoints and summary events.
- [ ] Failure in wave correctly blocks dependents and reports impact.

### References

- `ankieta-features-ekosystem.md` (wave-based execution decision)
- `spec-mvp-diricode.md` (pipeline evolution to full orchestration)

---

## Issue: DC-PIPE-006 — Analysis paralysis guard

### Goal

Prevent endless analysis loops without implementation progress.

### Scope

- Detection rule (default):
  - **5+ consecutive file reads with no write**
- Action on trigger:
  - pause progression
  - prompt user: "continue analyzing or start implementing?"
- Configurability:
  - threshold override
  - scope by turn/task/agent
- Emit guardrail events for observability and auditing

### Acceptance criteria

- [ ] Consecutive-read detector tracks read/write action sequence.
- [ ] Trigger fires at default threshold (5 reads) unless overridden.
- [ ] Pipeline pauses and requests explicit user decision on trigger.
- [ ] Guardrail event includes triggering context and counters.
- [ ] Resume path honors user choice deterministically.

### References

- `spec-mvp-diricode.md` (key execution rule: 5 reads guard)
- `ankieta-features-ekosystem.md` (analysis paralysis decision)

---

## Issue: DC-PIPE-007 — Context budget enforcement

### Goal

Enforce context-window safety limits across agents within each turn.

### Scope

- Budget rule:
  - max **50%** of model context window per single operation
- Track usage:
  - per agent per turn
  - input context composition telemetry
- Mitigation behavior:
  - pre-flight estimate before model call
  - automatic trimming/condensing when approaching/exceeding limit
- Integrate with context subsystem:
  - DC-CTX-* interfaces for condenser/selection strategies

### Acceptance criteria

- [ ] Pre-flight context budget check runs before each model invocation.
- [ ] Any operation above 50% threshold is trimmed or blocked by policy.
- [ ] Usage is tracked per agent per turn and persisted for diagnostics.
- [ ] Budget enforcement integrates with context composer/condensers.
- [ ] Violations are visible in pipeline and observability events.

### References

- `spec-mvp-diricode.md` (50% context rule)
- `analiza-context-management.md` (adaptive budgeting and condenser pipeline)

---

## Issue: DC-PIPE-008 — Deviation rules

### Goal

Detect and control execution drift from approved plan using explicit rule set.

### Scope

Implement and enforce the 4 deviation rules (from ecosystem/spec decisions):

1. Auto-fix direct bugs encountered during task execution when fix is local and low-risk.
2. Auto-add clearly missing, required implementation details needed to complete accepted task scope.
3. Auto-fix blocking issues that prevent progress, when fix does not alter approved architecture.
4. **ASK user** before architectural changes or major scope shifts.

Additional integration:
- plan-vs-execution drift detector (task intent vs performed actions)
- response policy: warn, auto-correct, or escalate to user
- atomic commits per task coordination with git tooling/safety rails

### Acceptance criteria

- [ ] All four deviation rules are encoded as explicit policy logic.
- [ ] Architectural-change detection always routes to user confirmation.
- [ ] Drift detector flags out-of-plan actions with actionable classification.
- [ ] Pipeline response (warn/correct/escalate) is deterministic and evented.
- [ ] Per-task atomic commit handoff is preserved for compliant executions.

### References

- `ankieta-features-ekosystem.md` (deviation rules accepted for MVP)
- `spec-mvp-diricode.md` (rule #4 explicitly called out; architecture changes require ASK)
- `.sisyphus/plans/mvp/index.md` (execution and safety expectations)

---

## Must NOT (pipeline guardrails)

- Must NOT skip explicit phase transitions/events in MVP-2.
- Must NOT execute dependent tasks in parallel.
- Must NOT bypass analysis-paralysis or context-budget guards.
- Must NOT auto-apply architectural deviations without user approval.
- Must NOT couple pipeline engine directly to provider-specific internals.
- Must NOT violate atomic-per-task execution semantics when commit integration is enabled.

## Dependencies

### Upstream

- Agent core/dispatcher infrastructure
- Config system (thresholds, timeouts, policies)
- Event schema contracts and logging primitives

### Cross-epic

- `epic-memory` for turn/task checkpoints and telemetry persistence
- `epic-context` for context trimming/compaction strategies
- `epic-safety` for budget and git safety integration
- `epic-hooks` for phase and execution lifecycle hooks
- `epic-observability` for event stream and UI metrics

### Recommended delivery order

- MVP-1: DC-PIPE-001 → 002 → 003
- MVP-2: DC-PIPE-004 → 006 → 007 → 005 → 008
