## ADR-048 — SQLite Issue System

| Field       | Value                                                                   |
|-------------|-------------------------------------------------------------------------|
| Status      | Accepted                                                                |
| Date        | 2026-03-23                                                              |
| Scope       | MVP                                                                     |
| References  | ADR-022 (superseded), ADR-018, ADR-021 (partially superseded), docs/mvp/epic-memory.md |

### Context

ADR-022 established GitHub Issues as the source of truth for DiriCode's runtime state — plans, epics, tasks — with SQLite serving only as a local cache. The design was explicitly: "SQLite is CACHE — GitHub is source of truth. SQLite loss → rebuild from GitHub."

That design has a structural problem: DiriCode's core runtime operation depends on a third-party API that is rate-limited, requires a network connection, and cannot be used offline. When agents are executing work in a tight loop — reading tasks, updating state, marking completion — they hammer the GitHub API. At any non-trivial task volume, rate limits become a real constraint rather than an edge case.

More fundamentally, the premise is wrong. DiriCode is an autonomous runtime. Its task state is operational data, not project metadata. Storing operational data in a remote service introduces latency and availability coupling that undermines the design goals of the entire system.

The specific problems with the ADR-022 approach:

- **API rate limits.** GitHub's REST API has hourly request limits per token. Dense agent activity during sprint execution hits these limits. The workaround (SQLite caching) partially addresses reads but not writes — every state transition still requires an API call.
- **Network dependency.** No network, no state. Agents cannot read their task queue, cannot update status, cannot check blocking conditions. The "simple local backend (v3/v4)" placeholder in ADR-022 acknowledges this gap but defers it indefinitely.
- **External control over core data.** GitHub can rate limit, change their API, have an outage, or require authentication changes. DiriCode's task state should not have this exposure.
- **No semantic search over issues.** Keyword and label search is what GitHub Issues offers. Finding related tasks by semantic similarity — "what tasks are conceptually similar to this one?" — requires embedding support that GitHub Issues cannot provide.
- **Survey confirmation.** A post-ADR-022 survey of approaches used by tools like Linear, Plane, and Jira confirms the direction: all serious offline-capable issue trackers store their primary state locally and treat remote sync as a write-out, not a read-in.

Linear's architecture is instructive here. Linear maintains a local in-memory object graph (persisted to IndexedDB) as the primary state store. The server receives transactions, not queries. The result is sub-millisecond UI interactions and full offline capability — not because Linear solved a hard technical problem, but because they got the directionality right: local first, remote second.

The user's decision is explicit: DiriCode runtime will have its own system for managing issues, tasks, and epics. GitHub Projects remains the right tool for tracking DiriCode's own development, but it is not the right backend for DiriCode's runtime state.

### Decision

**SQLite is the source of truth for all DiriCode runtime state — issues, tasks, epics, and their relationships.**

This reverses ADR-022's directionality. GitHub is no longer the source of truth. SQLite is no longer a cache. Network connectivity is no longer required for any state operation.

**SQLite with FTS5 as the primary state backend.** All issues, epics, tasks, comments, labels, and relationships are stored in a local SQLite database. FTS5 provides full-text search across issue titles, descriptions, and comments — the same capability that ADR-018 uses for the codebase index. The `@diricode/memory` package already owns this SQLite instance; the issue system extends its responsibility rather than adding a new dependency.

**sqlite-vec for semantic similarity.** ADR-021 deferred embeddings to v2 because the only use case considered was code search. Issue management creates a more compelling MVP use case: finding duplicate issues, surfacing related tasks when planning, and answering "what have we done before that resembles this?" These queries are natural in a sprint planning context. sqlite-vec (the `asg017/sqlite-vec` extension, Mozilla Builders project) runs anywhere SQLite runs — no external server, no additional process, no deployment complexity. It stores and queries `float32`, `int8`, and binary vectors via KNN SQL queries. This replaces ADR-021's "deferred to v2" stance for the issue management domain specifically; code search embeddings remain deferred.

**Offline-first: no network required for state operations.** Creating an issue, updating task status, assigning work, adding comments — all of these write only to SQLite. Network availability is not checked, not required, and not assumed. This is the defining constraint of the new design.

**Sync adapters are output targets, not input sources.** The abstract backend interface from ADR-022 (GitHub → GitLab → Jira) is retained but inverted. These backends receive state changes from SQLite; they do not supply state to SQLite. A sync adapter watches SQLite write events and pushes them to the configured remote. On first connect, a sync adapter can optionally import existing issues from the remote into SQLite, but this is a one-time migration, not ongoing synchronization from remote to local.

- MVP: No sync adapters. Pure local.
- v2: GitHub sync adapter — push DiriCode runtime state to a GitHub Project for external visibility (phone review, stakeholder access).
- v3/v4: GitLab and Jira adapters.

**GitHub Projects #4 continues to track DiriCode's own development.** The distinction is clear: GitHub Projects is for the *development* of DiriCode (roadmap, epics, contributor workflow). SQLite is for DiriCode *runtime* (the issue and task state that running agents read and write during project execution). These are different systems for different audiences.

**Agent access is unchanged.** Agents continue to read and write state through the memory API service — they never touch SQLite directly. The API surface is the same; only the backend changes.

### Consequences

- **Positive:**
  - No rate limits. Dense agent activity during sprint execution no longer creates API pressure.
  - No network dependency for state operations. Agents work offline without degradation.
  - Sub-millisecond state access. SQLite reads are local I/O; GitHub API calls have hundreds of milliseconds of round-trip latency.
  - Full control over the data model. Issue fields, relationships, and metadata are defined by DiriCode's needs, not by GitHub's schema.
  - Semantic search over issues in MVP. sqlite-vec enables duplicate detection and related-task surfacing without an external vector service.
  - Consistent SQLite strategy. ADR-018 already uses SQLite for the codebase index. The issue system extends the same database and the same operational model.

- **Negative:**
  - DiriCode must build its own issue management UI. There is no GitHub mobile app for runtime state. Users cannot browse DiriCode's task state from their phone without the Web UI (ADR-032) being implemented.
  - The v2 GitHub sync adapter must be written and maintained. This is not free — it requires mapping DiriCode's issue model to GitHub's and handling conflict resolution when both sides have changes.
  - No multi-device access until sync adapters exist. The SQLite database is local to the machine running DiriCode. A second machine running a different DiriCode session against the same project cannot see the first machine's state until sync is implemented.
  - sqlite-vec is pre-v1. The `asg017/sqlite-vec` extension ships warnings about breaking changes. This is acceptable in MVP given the limited blast radius (issue embeddings only), but requires version pinning and migration attention.

- **Migration:**
  - ADR-022 is superseded by this decision. The directionality reversal is total — there is no hybrid interpretation.
  - `docs/mvp/epic-memory.md` must be updated to reflect the new interface. Any assumptions about GitHub Issues as the underlying backend need to be removed.
  - ADR-021 is partially superseded for the issue management domain. Code search embeddings remain deferred. Issue embeddings are adopted in MVP.
  - The README currently describes "GitHub Projects as the Backend" and states "SQLite as cache." These statements require correction.
  - Existing `@diricode/memory` implementation (SQLite + FTS5 persistence layer) is the foundation. The migration is additive — the issue system extends what already exists rather than replacing it.
