# Epic: Memory and Project State Backbone (MVP-1)

> Package: `@diricode/memory`
> Iteration: **MVP-1**
> Issue IDs: **DC-MEM-001..DC-MEM-009**
> Sync adapters (GitHub, GitLab, Jira) are optional output targets planned for v2+ — not part of MVP.

## Summary

This epic delivers durable, queryable project memory for DiriCode MVP-1 using SQLite (project-local `.dc/memory.db`) with timeline-first storage, FTS5 search, token/cost telemetry, and multi-project isolation. It operationalizes ADR-048 (SQLite Issue System), ADR-018 (FTS/indexing), and cross-cutting boundaries: no direct DB access outside `@diricode/memory`, local-first issue management with optional sync adapters for external visibility.

Memory is the state spine for **checkpoint/resume**, observability, and issue-driven planning. MVP-1 prioritizes deterministic schema evolution (migrations), low-latency retrieval, and strict project separation, while explicitly tracking technical risk around Bun + SQLite FTS5 with a mandatory POC spike.

## Issue: DC-MEM-001 — SQLite database setup with migrations

### Goal

Establish a production-shaped SQLite foundation with safe schema evolution and concurrent read performance.

### Scope

- Select and implement SQLite driver strategy:
  - Primary candidate: `bun:sqlite`
  - Fallback candidate: `better-sqlite3` adapter if Bun limitations appear
- Database file path:
  - Project memory DB at `.dc/memory.db` (absolute project root resolved)
- Enable WAL mode:
  - `PRAGMA journal_mode=WAL`
  - apply additional pragmatic defaults (busy timeout, foreign keys on)
- Build migration system:
  - versioned migrations with **up/down**
  - migration registry table (`schema_migrations`)
  - deterministic startup bootstrap and idempotent re-run behavior
- Add startup health checks:
  - DB reachable
  - migration state consistent
  - schema version exposed to diagnostics

### Acceptance criteria

- [ ] Database initializes at `.dc/memory.db` on first run.
- [ ] WAL mode is enabled and verifiable at runtime.
- [ ] Migration engine supports apply, rollback, and current version introspection.
- [ ] Startup fails with typed error when migration state is invalid/corrupted.
- [ ] All SQL schema changes are migration-driven (no implicit runtime DDL).

### Technical risk and mitigation

- **Risk**: SQLite FTS5 behavior on Bun runtime may be incomplete or inconsistent.
- **Mitigation**: mandatory spike:
  1. create FTS5 virtual table,
  2. insert/query benchmark data,
  3. confirm tokenizer + ranking behavior,
  4. fallback plan to `better-sqlite3` adapter if required.

### References

- `overview.md` (FTS5 target and risk list)
- `analiza-context-management.md` (SQLite schema and indexing direction)
- `spec-mvp-diricode.md` (memory backend scope)
- `cross-cutting.md` (typed errors, package boundaries)

---

## Issue: DC-MEM-002 — Session storage

### Goal

Persist session and message history as first-class entities for replay, analysis, and pipeline continuity.

### Scope

- Create `sessions` table:
  - `id`, `created_at`, `updated_at`, `status`, `metadata`
- Create `messages` table:
  - `id`, `session_id`, `role`, `content`, `tokens`, `cost`, `agent_id`, `timestamp`
- Enforce relational integrity:
  - FK `messages.session_id -> sessions.id`
  - indexed lookups by session and time
- Implement repository/API methods:
  - session CRUD (create, read, update status/metadata, list)
  - message CRUD for append + retrieval
- Add pagination and ordering contracts:
  - chronological retrieval (ASC default for replay)
  - bounded page size for large sessions

### Acceptance criteria

- [ ] Sessions can be created, updated, listed, and fetched by ID.
- [ ] Messages can be appended and retrieved per session in deterministic order.
- [ ] Deleting/closing sessions respects data retention policy (soft-close in MVP preferred).
- [ ] Session/message queries are indexed and performant for typical MVP workloads.
- [ ] API returns typed, schema-validated entities.

### References

- `spec-mvp-diricode.md` (session lifecycle and memory ownership)
- `analiza-context-management.md` (timeline and context persistence patterns)

---

## Issue: DC-MEM-003 — Observation/timeline storage

### Goal

Implement timeline-based memory for agent/tool actions and decision traceability.

### Scope

- Create `observations` table:
  - `id`, `session_id`, `agent_id`, `task_id`, `type`, `content`, `timestamp`, `metadata`
- Enforce observation type taxonomy (MVP):
  - `file_read`, `file_write`, `command_run`, `decision`, `discovery`, `error`
- Provide append/query API:
  - append observation event
  - fetch timeline by session/task/agent/time-range
- Preserve rich metadata:
  - tool name, file paths, command summaries, checkpoint IDs, guardrail signals
- Align with observability/event contracts:
  - events can be persisted and reconstructed in order

### Acceptance criteria

- [ ] Observations are stored chronologically with stable timestamps.
- [ ] All six MVP observation types are validated and queryable.
- [ ] Timeline queries support session-scoped and filtered retrieval.
- [ ] Metadata supports future context condenser and replay use-cases.
- [ ] Invalid type/payload combinations fail with typed validation errors.

### References

- `analiza-context-management.md` (timeline-first memory recommendation)
- `ankieta-features-ekosystem.md` (timeline memory decision)
- `overview.md` (observability + memory linkage)

---

## Issue: DC-MEM-004 — FTS5 full-text search

### Goal

Provide low-latency semantic keyword retrieval over messages and observations.

### Scope

- Create FTS5 virtual table(s) over:
  - message content
  - observation content
- Maintain sync strategy:
  - triggers or explicit write-through updates
  - consistent delete/update propagation
- Implement search API:
  - `search(query, filters) -> ranked results`
- Supported filters:
  - by `session_id`
  - by `agent_id`
  - by time range
  - by observation `type`
- Ranking and snippets:
  - return rank score and content excerpts for UI/CLI display
- Benchmark harness for target verification

### Acceptance criteria

- [ ] Search returns ranked results across both messages and observations.
- [ ] Filters (session, agent, time, type) are all supported.
- [ ] Query latency meets target: **<100ms** for representative MVP dataset.
- [ ] FTS index remains consistent with base tables after insert/update/delete.
- [ ] Fallback behavior is defined if FTS5 unsupported in selected runtime.

### Performance target

- From roadmap: **FTS5 query <100ms** (MVP target).

### Technical risk

- Bun runtime + FTS5 capability must be validated in POC spike before locking implementation path.

### References

- `overview.md` (performance target + risk)
- `analiza-context-management.md` (SQLite index architecture)
- `spec-mvp-diricode.md` (FTS5 in MVP memory scope)

---

## Issue: DC-MEM-005 — Token usage tracking

### Goal

Track per-turn and aggregated token/cost usage for guardrails and observability.

### Scope

- Create `token_usage` table:
  - `session_id`, `turn_id`, `agent_id`, `model`, `tokens_in`, `tokens_out`, `cost`, `timestamp`
- Implement write path:
  - one record per model invocation/turn boundary (as defined by pipeline integration)
- Implement aggregation queries:
  - per-session totals
  - per-agent totals
  - per-model breakdown
  - optional time-window summaries
- Provide API contracts for:
  - cost guardrails (DC-SAFE-004 dependency)
  - observability metrics (DC-OBS-* dependency)

### Acceptance criteria

- [ ] Token usage records are persisted with turn/session/agent linkage.
- [ ] Aggregations are available for session, agent, and model dimensions.
- [ ] Cost values are stored consistently with provider telemetry precision.
- [ ] Data is queryable in near-real-time for live budget checks.
- [ ] Metrics API contracts are stable for observability integration.

### References

- `spec-mvp-diricode.md` (cost metadata and guardrail context)
- `overview.md` (cost targets and observability linkage)

---

## Issue: DC-MEM-006 — Local Issue System Client

### Goal

Deliver a local-first issue management interface backed by SQLite for managing tasks, epics, and their relationships.

### Package boundary

- Implement in **`@diricode/memory`**.
- Expose abstraction consumed by core and pipeline through interface contracts.

### Scope

- Define interface: `IIssueClient` (backend-agnostic)
- Implement SQLite-native adapter with methods:
  - create issue (INSERT into local SQLite)
  - update issue (UPDATE local SQLite row)
  - close issue (UPDATE status in local SQLite)
  - list issues (SELECT from local SQLite with filters)
  - search issues (FTS5 full-text search over issue titles and descriptions)
- Epic support:
  - parent issue + child issue relationships via foreign keys
  - parent-child traceability via `parent_id` column (not checklist text)
- Offline-first guarantees:
  - all operations write and read only from local SQLite
  - no network connection is required or checked for any state operation
- Sync adapter note:
  - Sync adapters (GitHub, GitLab, Jira) are output targets — they receive state changes from the local issue system. Adapters are planned for v2+ (see ADR-048).

### Acceptance criteria

- [ ] `IIssueClient` abstraction is backend-agnostic and testable via mocks.
- [ ] SQLite adapter supports full CRUD/list/search coverage.
- [ ] Epic parent-child relationships are supported via foreign keys.
- [ ] All operations are local-only (no network dependency).
- [ ] No non-abstract direct SQL calls leak into other packages.

### References

- `ADR-048` (SQLite Issue System)
- `plan-implementacji-diricode.md` (legacy MEM-05/06 lineage)
- `cross-cutting.md` (package boundary rules)

---

## Issue: DC-MEM-007 — Multi-project support

### Goal

Ensure strict per-project memory isolation with optional global cross-project memory.

### Scope

- Project-scoped DB:
  - each project uses its own `.dc/memory.db`
- Global DB:
  - `~/.config/dc/memory.db` for cross-project observations/telemetry
- Project identity:
  - canonical project key by absolute normalized path
- Isolation rules:
  - project APIs default to project DB only
  - cross-project reads require explicit opt-in context
- Define data routing strategy:
  - what writes go to project DB vs global DB
  - conflict/duplication policy

### Acceptance criteria

- [ ] Opening two projects yields isolated memory stores by default.
- [ ] Global DB path and initialization are deterministic on supported OSes.
- [ ] Project identification uses canonical absolute paths.
- [ ] Cross-project queries require explicit API usage (no accidental bleed-through).
- [ ] Worktree/multi-project workflows behave consistently with state isolation guarantees.

### References

- `ankieta-features-ekosystem.md` (multi-project/worktree decision)
- `spec-mvp-diricode.md` (multi-project memory setting)
- `overview.md` (memory and package architecture)

---

## Must NOT (MVP guardrails)

- Must NOT expose raw SQLite access outside `@diricode/memory`.
- Must NOT couple memory schema to UI rendering concerns.
- Must NOT implement embeddings/vector DB in MVP (deferred to v2).
- Must NOT skip migration versioning or use ad-hoc schema mutation.
- Must NOT break project isolation by default (cross-project is opt-in only).
- Must NOT hardwire sync adapter logic inside memory repositories; use abstraction boundary.

## Dependencies

### Upstream

- Monorepo/package scaffolding and shared core error/logging contracts.
- Config system for path resolution and backend settings (`.dc/`, global config roots).

### Cross-epic

- `epic-pipeline` (checkpoints, turn IDs, phase events persisted as timeline/memory records)
- `epic-safety` (token/cost guardrails consume usage aggregates)
- `epic-observability` (timeline/search/token APIs power metrics and event drill-down)
- `epic-server` (memory endpoints and SSE-integrated read paths)

### Delivery sequence (recommended)

1. DC-MEM-001 (foundation)
2. DC-MEM-002 + DC-MEM-003 (core entities)
3. DC-MEM-004 (search)
4. DC-MEM-005 (usage telemetry)
5. DC-MEM-007 (isolation/global routing)
6. DC-MEM-006 (Local issue system client)

---

## v2 follow-up tasks already anchored from the pattern review

### DC-MEM-008 — ReasoningBank retrieval and write path

Add the first delivery task for ReasoningBank as a runtime capability with storage/retrieval boundaries, without requiring full live prompt injection yet.

### DC-MEM-009 — Cross-session memory querying

Enable querying prior session/task memory across sessions within the same project without flooding current active context.
