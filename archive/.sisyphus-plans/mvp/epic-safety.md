# Epic: Safety Guardrails and Approval Controls (POC → MVP-1)

> Package: `@diricode/tools`  
> Iteration: **POC (basic) → MVP-1 (full)**  
> Issue IDs: **DC-SAFE-001..DC-SAFE-005**

## Summary

This epic defines non-negotiable safety controls for command execution, file writes, git operations, and budget governance, with progressive hardening from POC to MVP-1. It operationalizes ADR-027 (Git safety), ADR-028 (secret redaction), ADR-029 (tree-sitter bash safety), and ADR-014/015 (approval/tool metadata behavior).

Safety controls are default-on and fail-closed for high-risk actions. The system must preserve user agency and transparency per **UX-002**: orchestration cannot become over-aggressive or silently destructive; human decisions remain authoritative for risky operations.

## Issues

### DC-SAFE-001 — Bash command safety filter

**Goal**: Prevent catastrophic shell execution while retaining useful automation.

**Scope**
- Dangerous command blocklist (initial baseline):
  - destructive filesystem/system ops (e.g., recursive root deletion, format/mkfs, raw disk writes)
  - privilege escalation paths (`sudo` and equivalents)
- Path restriction model:
  - allow operations only within resolved project root
  - reject ambiguous or escaping paths (`..`, env/path tricks)
- Strictness levels (configurable policy):
  - permissive/dev (warn+block critical)
  - standard (block known dangerous classes)
  - strict (allowlist-oriented execution)
- Parse-first enforcement using tree-sitter bash approach from ADR-029.

**Acceptance criteria**
- Known dangerous patterns are blocked with clear reason codes.
- Commands targeting paths outside project root are rejected.
- `sudo` usage is blocked by default and logged.
- Strictness policy is configurable and test-covered.

**ADR references**
- ADR-029 tree-sitter bash parsing
- ADR-027 safety rails mindset
- ADR-009/011 configuration controls

---

### DC-SAFE-002 — File write guard

**Goal**: Guarantee that tool-driven writes cannot escape or damage protected areas.

**Scope**
- Enforce write boundary at project root.
- Protect sensitive/internal paths by default:
  - `.git/*`, `node_modules/*`, and other runtime-defined protected patterns
- Configurable allowlist/blocklist patterns:
  - project-level extensions while preserving hard safety floor
- Symlink traversal protection:
  - resolve real path before write
  - deny writes that traverse outside root via symlink indirection

**Acceptance criteria**
- Any attempted write outside root fails with deterministic error.
- Writes to protected paths are blocked unless explicitly policy-allowed where safe.
- Symlink bypass attempts are detected and blocked.
- Guard behavior is auditable (who/what/why blocked).

**ADR references**
- ADR-015 tool annotations and risk labeling
- ADR-027 safety rails principles
- ADR-010 project directory boundary

---

### DC-SAFE-003 — Git operation safety

**Goal**: Enforce git invariants that protect repository integrity and secrets.

**Scope**
- Block force push to protected branches (`main`, `master`) by default.
- Block hard reset without explicit confirmation flow/policy override.
- Secret prevention before commit:
  - detect likely secrets (`.env`, credentials, private keys, token-like patterns)
  - prevent commit when detection confidence crosses threshold
- Integrate with pre-commit hook path (MVP hook framework alignment).

**Acceptance criteria**
- Force push on protected branches is denied by default.
- Hard reset requires explicit user approval path.
- Secret-bearing files/content are blocked from commit with remediation guidance.
- Safety checks integrate with hook lifecycle without crashing pipeline.

**ADR references**
- ADR-027 git safety rails (absolute)
- ADR-028 secret redaction/sensitivity handling
- ADR-024 hook framework (silent fail semantics around hooks, not around safety decision)

---

### DC-SAFE-004 — Token/cost guardrails

**Goal**: Keep execution economically safe and predictable.

**Scope**
- Per-session token budget (configurable, sensible default from config).
- Per-turn token limit with hard-stop or degrade strategy.
- Cost estimation before expensive operations (provider/model-aware estimates).
- Auto-pause on budget threshold approach with user-visible state/event.

**Acceptance criteria**
- Session cannot exceed configured budget without explicit continuation policy.
- Per-turn hard limits are enforced with clear feedback.
- Expensive operation pre-check provides estimate and risk flag.
- Near-budget state triggers auto-pause and explicit resume path.

**POC vs MVP-1 split**
- POC: basic counters + hard limits + clear errors.
- MVP-1: richer estimation, threshold events, resumable pause workflow.

**ADR references**
- ADR-016 context/budget control foundation
- ADR-025 router metadata for cost tracking
- ADR-031 observability events for budget status

---

### DC-SAFE-005 — Approval system (MVP-1)

**Goal**: Add human-in-the-loop approval for risky operations while keeping safe flows fast.

**Scope**
- Pre-tool approval for destructive/high-risk operations.
- Auto-approve safe operations (read/search/non-destructive).
- Approval event integration via EventStream for UI/CLI.
- Timeout handling:
  - default auto-deny after 60s
  - explicit, logged decision state

**Acceptance criteria**
- Risky operations pause and await explicit approval decision.
- Safe operations proceed without friction.
- Approval requests/responses stream as typed events to clients.
- Timeout results in deterministic deny with user-visible reason.

**UX requirement**
- Must enforce **UX-002**: “orchestration not too aggressive — human decides.”
- Approval UX must be clear, interruptible, and never hidden behind implicit retries.

**ADR references**
- ADR-014 smart hybrid approval
- ADR-015 tool annotations
- ADR-031 EventStream for approval telemetry

## Must NOT

- Must NOT allow bypass of hard safety rails in default modes.
- Must NOT treat warnings as approvals for destructive actions.
- Must NOT trust path strings without canonical resolution (symlink/relative escape risk).
- Must NOT allow hidden escalation (`sudo`, privilege wrappers) through shell execution.
- Must NOT leak sensitive values in logs, errors, or approval payloads.
- Must NOT implement “full-auto destructive mode” in MVP; user approval remains mandatory for high-risk operations.

## Dependencies

### Upstream
- `epic-tools` execution primitives (bash/file/git tool interfaces).
- Shared config schema and hierarchy (`ADR-009`, `ADR-011`) for safety policy controls.
- Event contracts from `@diricode/core` for approval/budget events.

### Cross-epic
- `epic-server` SSE transport required for approval and budget event delivery.
- `epic-hooks` integration for pre-commit and future pre-tool/post-tool hooks.
- `epic-observability` for surfacing safety decisions and budget state.

### External/security inputs
- Secret pattern catalog (baseline + configurable custom detectors).
- Branch protection policy defaults (`main/master` baseline).

## Delivery slicing (recommended)

### POC (minimum viable safety floor)
- DC-SAFE-001 basic bash filter + path boundary + sudo block.
- DC-SAFE-002 root/protected-path write guard + symlink block.
- DC-SAFE-003 baseline git rails (force-push/hard-reset guards).
- DC-SAFE-004 hard token limits and session budget cap.

### MVP-1 (full safety behavior)
- Harden detections, policy configurability, richer telemetry.
- Full secret-prevent-commit integration.
- DC-SAFE-005 approval workflow with EventStream + timeout auto-deny.
- End-to-end UX refinement honoring UX-002 human decision authority.
