# Epic: Hook Framework and MVP Hook Set (MVP-2)

> Package: `@diricode/core`  
> Iteration: **MVP-2**  
> Issue IDs: **DC-HOOK-001..DC-HOOK-005**

## Summary

This epic delivers DiriCode’s hook foundation using the hybrid architecture from `analiza-hookow.md` and ADR-024: **in-process TypeScript hooks for core low-latency paths** plus **external process hooks for extensibility/community integration**. The design must remain resilient: hook failures are isolated through silent-fail policy and must never crash primary orchestration.

MVP scope includes the engine, two executors, six required hook implementations, and config-level controls. This establishes the first 6 hooks out of the 20-type roadmap (ARCH-003), with expansion path to v2/v3 hooks already aligned.

## Architectural baseline (from primary analysis)

- Hybrid execution model:
  - **In-process hooks**: target overhead <3ms, timeout 3s
  - **External hooks**: process isolation, timeout 10s
- `HookDefinition` fields required:
  - `name`, `type`, `trigger`, `category`, `dependsOn`, `timeout`, `silentFail`, `leanModeAction`, `dispatcherRelevant`
- Ordering model:
  - DAG-based dependency ordering using `dependsOn`
- Reliability contract:
  - silent fail = log + continue (never crash pipeline)
- MVP hook set (6):
  - `session-start`, `pre-commit`, `post-commit`, `error-retry`, `plan-created`, `plan-validated`

## Issues

### DC-HOOK-001 — Hook engine and lifecycle

**Goal**: Build central hook engine and execution lifecycle contracts.

**Scope**
- Define `HookDefinition` interface with all required fields from analysis
- Implement hook registry APIs:
  - `register()`
  - `unregister()`
  - `listByTrigger()`
- Implement trigger API:
  - `trigger(triggerName, context) -> results[]`
- Resolve execution order via DAG topological sort on `dependsOn`
- Enforce silent-fail behavior by default for hooks
- Capture metrics (latency, result status, timeout/failure reason)

**Performance target**
- In-process scheduling overhead per hook dispatch: **<3ms** (excluding hook body)

**Acceptance criteria**
- [ ] Hook definitions validate required metadata fields.
- [ ] Trigger execution respects dependency order.
- [ ] Hook failures/timeouts are captured and logged without pipeline crash.
- [ ] Results array includes per-hook outcome and diagnostics.
- [ ] Registry supports deterministic listing and deduped registration.

**References**
- `analiza-hookow.md` (hybrid + DAG + silent-fail)
- ADR-024
- ARCH-003 (15–20 hook types roadmap)

---

### DC-HOOK-002 — In-process hook executor

**Goal**: Provide low-latency executor for core TypeScript hooks.

**Scope**
- Load in-process TS hooks at startup/bootstrap
- Execute hooks synchronously inside orchestration pipeline
- Enforce **3s timeout** per hook
- Inject runtime context object:
  - session
  - config
  - eventStream
  - execution metadata
- Emit hook execution events for observability

**Acceptance criteria**
- [ ] Core hooks load successfully at startup with validation.
- [ ] Timeout enforced at 3s with deterministic failure result.
- [ ] Context injection is typed and available in each hook.
- [ ] Executor overhead stays within low-latency target envelope.
- [ ] Failures follow silent-fail policy and do not interrupt parent operation.

**References**
- `analiza-hookow.md` (in-process model)
- ADR-024

---

### DC-HOOK-003 — External hook executor (community hooks)

**Goal**: Support isolated external hooks without risking runtime stability.

**Scope**
- Spawn external hooks via `child_process`
- Enforce **10s timeout** per external hook
- I/O contract:
  - stdin: JSON context
  - stdout: JSON result
- Parse/validate external output and normalize to hook result schema
- Handle crash/timeout/invalid-JSON as non-fatal hook failures

**Acceptance criteria**
- [ ] External hook receives context through stdin JSON.
- [ ] Valid stdout JSON is mapped to normalized result structure.
- [ ] Timeout and process crash are isolated and reported without pipeline crash.
- [ ] Executor supports configured hook path resolution.
- [ ] Logs/events include external process exit diagnostics.

**References**
- `analiza-hookow.md` (external executor model)
- ADR-024

---

### DC-HOOK-004 — MVP hook implementations (6 hooks)

**Goal**: Implement required MVP lifecycle/safety/quality hooks.

**Scope**
- `session-start`
  - initialize session context
  - load project config snapshot
- `pre-commit`
  - validate staged change shape
  - detect obvious secret risks before commit
- `post-commit`
  - update memory/timeline with commit metadata
- `error-retry`
  - classify error category
  - return retry strategy decision (retry/skip/escalate)
- `plan-created`
  - validate plan structure completeness
  - detect common defects early
- `plan-validated`
  - emit `plan.validated` event
  - unlock transition to execution phase

**Acceptance criteria**
- [ ] All six hooks are registered and triggerable at correct lifecycle points.
- [ ] Hook outputs are deterministic and typed.
- [ ] Pre/post commit hooks integrate safely with git safety workflow.
- [ ] Plan hooks gate execution transitions correctly.
- [ ] Error-retry produces actionable retry policy decisions.

**References**
- `analiza-hookow.md` (MVP hook set)
- ADR-024
- ADR-013 pipeline phases
- ADR-027/028 safety boundaries

---

### DC-HOOK-005 — Hook configuration (`config.jsonc`)

**Goal**: Expose operational control over hook behavior via configuration.

**Scope**
- Extend config schema with `hooks` section
- Allow per-hook enable/disable toggles
- Support custom hook paths for community/external hooks
- Support timeout and policy overrides within safe bounds
- Implement lean mode behavior via `leanModeAction`:
  - `skip`
  - `simplify`
  - `keep`

**Acceptance criteria**
- [ ] Config schema supports hook definitions and overrides.
- [ ] Individual hooks can be toggled without restart where supported.
- [ ] Custom external hook paths resolve predictably.
- [ ] Lean mode actions are enforced at runtime.
- [ ] Invalid hook config fails validation clearly without silent misconfiguration.

**References**
- `analiza-hookow.md` (lean mode + definition fields)
- ADR-009/011 config model
- ADR-012 work/lean behavior
- ADR-024 hook framework

## Must NOT (scope guardrails)

- Must NOT allow hook exceptions to crash pipeline execution.
- Must NOT run unbounded external hooks (timeouts mandatory).
- Must NOT introduce v2/v3 hook types as MVP requirements in this epic.
- Must NOT bypass dispatcher read-only constraints through hook side effects.
- Must NOT make hook ordering non-deterministic when dependencies are defined.

## Dependencies

### Upstream
- Config system baseline (`DC-CORE-*`) for hook schema and runtime loading
- Event stream primitives for hook telemetry
- Pipeline lifecycle integration points

### Cross-epic
- `epic-pipeline` (trigger points across interview/plan/execute/verify)
- `epic-safety` (pre-commit and secret-related checks)
- `epic-memory` (post-commit timeline updates)
- `epic-observability` (hook lifecycle metrics/events)

### ADR/analysis anchors
- `analiza-hookow.md` (primary)
- ADR-024 (20 hook types roadmap, 6 in MVP)
- ARCH-003 (more hook coverage than Claude Code over roadmap)

## Delivery sequencing (MVP-2)

1. **DC-HOOK-001** engine + registry + DAG ordering
2. **DC-HOOK-002** in-process executor (3s timeout)
3. **DC-HOOK-003** external executor (10s timeout)
4. **DC-HOOK-004** six MVP hook implementations
5. **DC-HOOK-005** config wiring + lean mode interaction

This order minimizes risk: stable core first, then execution backends, then functional hooks, then operator controls.
