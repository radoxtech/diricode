# Epic: Tools Runtime and Code Intelligence

> **Package**: @diricode/tools  
> **Iteration**: POC → MVP-2  
> **Issues**: DC-TOOL-001 — DC-TOOL-012  
> **Dependencies**: DC-SAFE-001..005, DC-SRV-001, DC-CORE-001

## Summary
This epic delivers the shared tool layer for agent execution, starting from minimal POC filesystem/shell primitives, then adding MVP-1 developer integrations (Git, LSP), and finally MVP-2 smart code tooling (tree-sitter, AST-grep rewrite, hashline, web fetch). All tools implement one contract (`name`, `description`, `parameters` schema, `execute`) and emit `tool.start`/`tool.end` events.

Primary source for scope and priorities: `analiza-narzedzi-ekosystem.md`. Tree-sitter/indexing constraints: `analiza-context-management.md`. Metis guidance is enforced: smart tools are MVP-2, not POC.

## Global Requirements
- Zod validation at tool boundary.
- Tool annotations are mandatory: `readOnlyHint`, `idempotentHint`, `destructiveHint` (where applicable).
- Safety wrappers (`DC-SAFE-*`) gate mutating/system-touching tools.
- Structured output and typed error model for every tool.

## Issues

### DC-TOOL-001: File read tool
**Iteration**: POC  
**Priority**: P0

**Description**:
Implement file read with optional line-range windowing (`offset`/`limit`) and stable line numbering. This is the baseline read primitive for planner/reviewer/verifier paths.

**Acceptance Criteria**:
- [ ] Common Tool interface + Zod params.
- [ ] Full-file and ranged reads.
- [ ] Line-numbered output.
- [ ] Emits `tool.start` and `tool.end`.
- [ ] `readOnlyHint: true`.
- [ ] Typed errors for not found/permission/invalid range.

**References**: `analiza-narzedzi-ekosystem.md`, `analiza-context-management.md`  
**Dependencies**: DC-CORE-001

---

### DC-TOOL-002: File write tool
**Iteration**: POC  
**Priority**: P0

**Description**:
Implement write/overwrite with optional parent directory creation. This is the core mutation primitive for code-writing flows.

**Acceptance Criteria**:
- [ ] Common Tool interface + Zod params.
- [ ] Optional create-parent-dirs behavior.
- [ ] Explicit overwrite semantics.
- [ ] Emits lifecycle events.
- [ ] Marked as mutating (`destructiveHint` or equivalent).
- [ ] Safety pre-check via DC-SAFE.

**References**: `spec-mvp-diricode.md`, `analiza-narzedzi-ekosystem.md`  
**Dependencies**: DC-SAFE-001, DC-CORE-001

---

### DC-TOOL-003: File edit tool (search/replace)
**Iteration**: POC  
**Priority**: P0

**Description**:
Implement in-file search/replace (OpenCode-like), with deterministic behavior on 0/multi matches and edit summary for traceability.

**Acceptance Criteria**:
- [ ] Literal search/replace (regex optional).
- [ ] Explicit handling for no match / many matches.
- [ ] Structured replacement summary.
- [ ] Emits lifecycle events.
- [ ] Safety wrapper integration.
- [ ] Mutating annotation present.

**References**: `plan-implementacji-diricode.md`, `analiza-context-management.md`  
**Dependencies**: DC-TOOL-002, DC-SAFE-001

---

### DC-TOOL-004: Bash execution tool
**Iteration**: POC  
**Priority**: P0

**Description**:
Implement shell command execution with timeout, working directory, and stdout/stderr capture. Must be filtered by DC-SAFE-001 policy (tree-sitter bash path per ADR-029).

**Acceptance Criteria**:
- [ ] Timeout + `workdir` support.
- [ ] Captures stdout/stderr/exit code.
- [ ] Blocks forbidden commands by safety policy.
- [ ] Emits lifecycle events with duration.
- [ ] Typed blocked-vs-runtime-failure errors.
- [ ] Sanitized telemetry payload.

**References**: ADR-029 in `spec-mvp-diricode.md`, `analiza-narzedzi-ekosystem.md`  
**Dependencies**: DC-SAFE-001, DC-CORE-001

---

### DC-TOOL-005: Glob/find tool
**Iteration**: POC  
**Priority**: P0

**Description**:
Implement file discovery by glob patterns with deterministic ordering and default excludes (`.git`, `node_modules`, build outputs).

**Acceptance Criteria**:
- [ ] Glob patterns + optional root path.
- [ ] Deterministic ordering.
- [ ] Default exclude profile.
- [ ] Emits lifecycle events.
- [ ] `readOnlyHint: true`, `idempotentHint: true`.
- [ ] Scales for medium repositories.

**References**: `analiza-context-management.md`, `spec-mvp-diricode.md`  
**Dependencies**: DC-CORE-001

---

### DC-TOOL-006: Grep/search tool
**Iteration**: POC  
**Priority**: P0

**Description**:
Implement literal/regex content search returning path, line number, and excerpt for fast context lookup.

**Acceptance Criteria**:
- [ ] Literal and regex modes.
- [ ] Result contains path + line + snippet.
- [ ] Scope restriction via paths/globs.
- [ ] Emits lifecycle events.
- [ ] `readOnlyHint: true`.
- [ ] Safe binary-file handling.

**References**: `analiza-context-management.md`, `spec-mvp-diricode.md`  
**Dependencies**: DC-TOOL-005

---

### DC-TOOL-007: Git tools (status/diff/add/commit/log/blame)
**Iteration**: MVP-1  
**Priority**: P0

**Description**:
Provide constrained git CLI wrappers for core workflows, inheriting ADR-027 safety rails.

**Acceptance Criteria**:
- [ ] Supports status/diff/add/commit/log/blame.
- [ ] Safety checks block disallowed destructive patterns.
- [ ] Structured outputs for agents.
- [ ] Emits lifecycle events.
- [ ] Commit path integrates message validation hooks.
- [ ] Handles repo/detached-head errors cleanly.

**References**: ADR-027 (`spec-mvp-diricode.md`), `plan-implementacji-diricode.md`  
**Dependencies**: DC-TOOL-004, DC-SAFE-003

---

### DC-TOOL-008: LSP client tools
**Iteration**: MVP-1  
**Priority**: P1

**Description**:
Implement goto-definition, find-references, and rename-symbol tools with capability checks and clear fallback diagnostics.

**Acceptance Criteria**:
- [ ] Goto definition.
- [ ] Find references.
- [ ] Rename symbol + precheck path.
- [ ] Unsupported-language/server diagnostics.
- [ ] Emits lifecycle events.
- [ ] Safety guard for broad rename operations.

**References**: `spec-mvp-diricode.md`, `analiza-context-management.md`  
**Dependencies**: DC-TOOL-001, DC-TOOL-003

---

### DC-TOOL-009: Tree-sitter parser integration
**Iteration**: MVP-2  
**Priority**: P0

**Description**:
Add tree-sitter AST parsing and symbol extraction APIs with Bun-compatibility risk spike before full rollout.

**Acceptance Criteria**:
- [ ] Bun-compatible integration for MVP target languages.
- [ ] AST parse + symbol extract APIs.
- [ ] Typed symbol model (name/kind/location).
- [ ] Fallback/failure behavior documented.
- [ ] Emits lifecycle events.
- [ ] Spike output captured as go/no-go.

**References**: `analiza-context-management.md`, `overview.md` risk table  
**Dependencies**: DC-TOOL-008

---

### DC-TOOL-010: AST-grep search/replace
**Iteration**: MVP-2  
**Priority**: P1

**Description**:
Deliver structural code search and rewrite using AST patterns; dry-run first, explicit apply mode.

**Acceptance Criteria**:
- [ ] Structural search by pattern.
- [ ] Structural rewrite with dry-run/apply.
- [ ] Reports affected files/locations.
- [ ] Language support and failure handling.
- [ ] Emits lifecycle events.
- [ ] Safety gate required before apply.

**References**: `spec-mvp-diricode.md`, `plan-implementacji-diricode.md`  
**Dependencies**: DC-TOOL-009

---

### DC-TOOL-011: Hashline stable references
**Iteration**: MVP-2  
**Priority**: P1

**Description**:
Implement stable line anchors resilient to edits, with re-resolution and conflict reporting when anchors drift.

**Acceptance Criteria**:
- [ ] Stable anchor format documented.
- [ ] Re-resolve anchors after edits.
- [ ] Conflict detection for invalid anchors.
- [ ] Integration with read/edit flows.
- [ ] Emits anchor-resolution telemetry.
- [ ] Tests for concurrent/multi-step edits.

**References**: `analiza-narzedzi-ekosystem.md` (primary), `plan-implementacji-diricode.md`  
**Dependencies**: DC-TOOL-001, DC-TOOL-003

---

### DC-TOOL-012: Web fetch tool
**Iteration**: MVP-2  
**Priority**: P1

**Description**:
Implement URL fetch with timeout and markdown conversion for external context ingestion, including protocol/domain safety constraints.

**Acceptance Criteria**:
- [ ] URL fetch with timeout.
- [ ] Output conversion to markdown (optional text/html modes).
- [ ] Protocol/domain safety checks.
- [ ] Emits lifecycle events.
- [ ] `readOnlyHint: true`.
- [ ] Large-response truncation metadata.

**References**: `spec-mvp-diricode.md`, `analiza-narzedzi-ekosystem.md`  
**Dependencies**: DC-SAFE-004, DC-CORE-001

## Must NOT
- Do **not** move smart code tooling into POC; keep it in MVP-2.
- Do **not** bypass DC-SAFE wrappers on mutating/system tools.
- Do **not** include v2 scope (annotation approval UI, embeddings, advanced context hooks).
- Do **not** leak secrets in tool payloads/logs.

## Dependencies
- **Blocked by**: `epic-safety.md`, `epic-agents-core.md`, `epic-server.md`.
- **Blocks**: `epic-pipeline.md`, `epic-context.md`, `epic-agents-roster.md`.

---

## New Tasks (Post-ADR Review)

- [ ] Implement ToolCallLimit middleware: thread_limit (session-wide budget) + run_limit (per-invocation budget) (ADR-035)
- [ ] Implement ToolRetry middleware: exponential backoff + jitter, configurable retry_on filter, max_retries=3 (ADR-036)
- [ ] Implement LLMToolEmulator wrapper: replaces tool execution with LLM-simulated responses for dev/test/CI mode (ADR-037, v2 scope)
- [ ] Implement LLMToolSelector wrapper: cheap model pre-filters tool list before main model call to reduce token usage (ADR-038, v2 scope)
