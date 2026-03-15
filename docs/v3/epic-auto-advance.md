# Epic: Auto-Advance / Full-Auto Mode (v3.0)

> Package: `@diricode/core`
> Iteration: **v3.0**
> Issue IDs: **DC-ADV-001..DC-ADV-005**

## Summary

Implements true autonomous operation where DiriCode can execute entire plans without human intervention — with configurable guardrails, circuit breakers, and audit logging. This extends the Autonomy dimension's "Full Auto" level from simple per-action auto-approval to end-to-end autonomous plan execution.

Survey reference: 11.5 (auto-advance full auto)
Source: `analiza-lean-mode.md` Section 3 (Autonomy level 5: Full Auto), wishlist 3.1 (approval workflow — "auto-approve as opt-in, not default")

## Architectural Baseline

- MVP: Autonomy dimension with 5 levels (Ask Everything → Full Auto)
- v2: Annotation-driven approval, pre-tool-use hook, sandbox optional
- v3: Sandbox execution (DC-SAND-001..006) for containment
- Full Auto permission matrix (from lean mode analysis): all operations auto-approved except destructive git ops
- Wishlist: "Tryb 'auto-approve' dostępny jako opt-in, nie domyślny. Każda destrukcyjna operacja wymaga dodatkowego potwierdzenia nawet w trybie auto-approve"

## Issues

### DC-ADV-001 — Auto-advance execution engine

**Goal**: Build an execution engine that can process an entire plan (multiple tasks, waves) without human prompts between steps.

**Scope**
- Auto-advance loop: after task N completes → automatically start task N+1 (or next wave)
- No user prompt between tasks — dispatcher autonomously advances through plan
- Progress reporting: real-time updates via EventStream (not blocking for user input)
- Plan must be approved before auto-advance starts (approval is for the PLAN, not individual actions)
- Resume: if auto-advance is paused/interrupted → resume from last completed task
- Session persistence: auto-advance state survives process restart

**Acceptance criteria**
- [ ] Auto-advance processes entire plan without human prompts
- [ ] Progress updates emitted via EventStream
- [ ] Plan approval required before auto-advance starts
- [ ] Resume from last completed task after interruption
- [ ] Session persistence across process restarts

**References**
- Survey 11.5 (auto-advance full auto)
- MVP `epic-pipeline.md` DC-PIPE-001..005 (plan execution engine)
- Wishlist 9.2 (parallel execution waves, dependency tracking)

---

### DC-ADV-002 — Circuit breakers and guardrails

**Goal**: Implement safety mechanisms that pause or stop auto-advance when dangerous conditions are detected.

**Scope**
- Circuit breakers:
  - **Cost limit**: stop if accumulated cost exceeds threshold (configurable, e.g., $5)
  - **Error rate**: stop if >3 consecutive task failures
  - **Token budget**: stop if session token budget exhausted
  - **Time limit**: stop if auto-advance runs longer than threshold (e.g., 2 hours)
  - **Loop detection**: stop if loop-detection hook fires (v2 hook)
- Guardrails:
  - Destructive git operations (force push, rebase) ALWAYS pause for human approval even in Full Auto
  - File deletions outside workspace ALWAYS pause
  - Network requests to non-allowlisted domains ALWAYS pause (if sandbox)
- Configurable thresholds in config:
  ```jsonc
  "autoAdvance": {
    "costLimit": 5.00,
    "maxConsecutiveFailures": 3,
    "timeLimit": "2h",
    "alwaysAskFor": ["git-force-push", "git-rebase", "file-delete-outside-workspace"]
  }
  ```
- When paused: user notified, can resume or cancel

**Acceptance criteria**
- [ ] Cost limit pauses auto-advance with notification
- [ ] 3 consecutive failures trigger stop
- [ ] Token budget exhaustion triggers stop
- [ ] Time limit triggers pause
- [ ] Destructive git ops always pause regardless of Full Auto
- [ ] Config thresholds respected
- [ ] User can resume or cancel after pause

**References**
- Wishlist 3.1: "Każda destrukcyjna operacja wymaga dodatkowego potwierdzenia nawet w trybie auto-approve"
- Wishlist 6.2: "Continuation loop ma hard limit — max N iteracji"
- v2 `epic-hooks-v2.md` DC-HOOK-013 (loop-detection)
- `analiza-lean-mode.md` Section 3 (Full Auto permission matrix)

---

### DC-ADV-003 — Auto-advance with sandbox enforcement

**Goal**: When auto-advance is active, require sandbox execution for potentially destructive operations.

**Scope**
- Policy: auto-advance mode REQUIRES sandbox for:
  - All shell command execution
  - File operations outside tracked project files
  - Network access
- Integration with DC-SAND-005 (sandbox × Autonomy dimension)
- Fallback: if Docker unavailable → pause auto-advance and notify user
- Container reuse: auto-advance reuses sandbox container across tasks (faster)
- Resource monitoring: surface sandbox metrics during auto-advance in Metrics Bar

**Acceptance criteria**
- [ ] Auto-advance requires sandbox for shell commands
- [ ] Missing Docker pauses auto-advance with notification
- [ ] Container reused across tasks for performance
- [ ] Sandbox metrics visible in Metrics Bar during auto-advance

**References**
- `epic-sandbox.md` DC-SAND-005 (sandbox × Autonomy integration)
- Wishlist 3.2 (sandboxing)

---

### DC-ADV-004 — Auto-advance audit trail

**Goal**: Log every action taken during auto-advance for post-execution review and accountability.

**Scope**
- Audit log: every auto-approved action recorded with timestamp, agent, action, result
- Stored in SQLite (new table `audit_log`)
- Fields: session_id, turn_id, task_id, agent_id, action_type, action_detail, result, timestamp, cost
- Reviewable: Web UI `/audit` page shows chronological action log
- Exportable: CLI `diricode audit export <session-id>` → JSONL
- Diff summary: at end of auto-advance, show aggregate diff of all changes (files created/modified/deleted)
- Git log: all commits made during auto-advance tagged with `[auto]` prefix

**Acceptance criteria**
- [ ] Every auto-approved action logged to audit_log table
- [ ] Web UI audit page shows chronological log
- [ ] CLI export works
- [ ] End-of-run diff summary displayed
- [ ] Git commits tagged with `[auto]` prefix

**References**
- `analiza-lean-mode.md` Section 3: "Full Auto — Audit log + revert available"
- v2 `epic-observability-v2.md` DC-OBS-011 (JSONL export)

---

### DC-ADV-005 — Auto-advance undo/rollback

**Goal**: Provide one-command rollback of all changes made during an auto-advance session.

**Scope**
- Before auto-advance starts: create git checkpoint (stash or branch)
- After auto-advance completes: user can review changes and accept or rollback
- Rollback: `diricode rollback <session-id>` → revert all changes to pre-auto-advance state
- Partial rollback: `diricode rollback <session-id> --task <task-id>` → revert specific task
- Web UI: "Rollback" button on auto-advance session page
- Git safety: rollback creates revert commits (not force push)

**Acceptance criteria**
- [ ] Git checkpoint created before auto-advance starts
- [ ] Full rollback reverts all changes
- [ ] Partial rollback reverts specific task
- [ ] Rollback creates revert commits (not force push)
- [ ] Web UI rollback button works
- [ ] Rollback possible even after process restart (checkpoint persisted)

**References**
- Wishlist 8.3 (undo/rollback workflow integrated)
- Wishlist 3.3 (git safety — "destructive git operacje wymagają jawnego potwierdzenia")
