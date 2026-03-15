# Epic: EventStream Observability Backbone and MVP UI Transparency

> **Packages**: `@diricode/core` + `@diricode/web`
> **Iteration**: MVP-2 (data collection) → MVP-3 (UI components)
> **Issue IDs**: DC-OBS-001 — DC-OBS-006
> **Dependencies**: DC-SRV SSE transport, DC-MEM SQLite persistence, DC-CORE agent lifecycle

## Summary
This epic delivers observability as a first-class system capability:
1) typed EventStream backbone and persistence,
2) consistent event emission from all core execution paths,
3) low-latency metrics aggregation,
4) real-time Web UI transparency components.

Primary references:
- `analiza-observability.md` (EventStream + 6 component model)
- `analiza-lean-mode.md` (Verbose mode integration)
- UX goals: **UX-001 (zero learning curve)** and **UX-003 (agent tree transparency)**.

---

## Issue: DC-OBS-001 — EventStream core implementation (MVP-2)

### Description
Implement typed EventStream event bus with subscribe/publish APIs and SQLite persistence.

Supported event types:
`turn.start/end`, `agent.start/end`, `llm.start/stream/end`, `tool.start/end`,
`delegate.start/end`, `approval.request/response`, `error`.

Canonical schema fields:
`id`, `parent_id`, `session_id`, `turn_id`, `agent_id`, `agent_tier`, `type`, `status`,
`start_time`, `end_time`, `model`, `tokens_in`, `tokens_out`, `cost`, `metadata`.

### Acceptance Criteria
- [ ] Zod schemas exist for all listed event types.
- [ ] Bus provides typed `publish` and filtered `subscribe`.
- [ ] All events persist to SQLite through memory package APIs.
- [ ] Event persistence is append-only and immutable.
- [ ] Replay API can rebuild a turn's event sequence from storage.

### References
- `analiza-observability.md` (primary schema/backbone)
- `.sisyphus/plans/cross-cutting.md` (event conventions)
- `spec-mvp-diricode.md` (ADR-031)

### Dependencies
- Depends on: DC-MEM persistence layer, DC-SRV transport
- Blocks: DC-OBS-002..006

---

## Issue: DC-OBS-002 — Event emission integration (MVP-2)

### Description
Integrate consistent event emission across core systems:
- agents runtime
- tool runtime
- pipeline orchestrator
- hooks runtime

Enforce hierarchy linking (`turn -> agent -> tool/delegate/llm`) via `parent_id`.

### Acceptance Criteria
- [ ] All agent lifecycles emit start/end and failure signals.
- [ ] All tool executions emit start/end with timing + status.
- [ ] Delegation emits start/end with parent-child linkage.
- [ ] Hook and pipeline events follow the same structured convention.
- [ ] Parent-child graphs can be reconstructed without gaps for normal flows.

### References
- `analiza-observability.md` (hierarchy model)
- `spec-mvp-diricode.md` (pipeline and nested delegation ADRs)

### Dependencies
- Depends on: DC-OBS-001, DC-CORE lifecycle and tool runtime
- Blocks: DC-OBS-003, DC-OBS-004, DC-OBS-006

---

## Issue: DC-OBS-003 — Metrics aggregation engine (MVP-2)

### Description
Implement real-time aggregation for session/turn KPIs:
- total input/output tokens
- total cost
- active agent count
- turn-level breakdown and running totals

Performance target: aggregation update <10ms per event.

### Acceptance Criteria
- [ ] Incremental aggregator updates state on each incoming event.
- [ ] Session totals and current-turn totals are both maintained.
- [ ] Active agent count reflects running spans accurately.
- [ ] Aggregation latency target (<10ms/event) is measured and reported.
- [ ] Aggregator output is consumable by SSE/UI layer without extra transforms.

### References
- `analiza-observability.md` (metrics bar data model)
- `overview.md` (performance mindset/targets)

### Dependencies
- Depends on: DC-OBS-001, DC-OBS-002
- Blocks: DC-OBS-005

---

## Issue: DC-OBS-004 — Agent Tree component (MVP-3, Web UI)

### Description
Build left-panel Agent Tree showing live hierarchy and statuses.
Must satisfy **UX-003 transparency** with minimal cognitive load.

Features:
- parent-child expansion/collapse
- live status icons (running/complete/error/pending)
- recursive nested structure from `parent_id`
- lightweight defaults for fast comprehension (UX-001)

### Acceptance Criteria
- [ ] Tree renders from SSE event stream in real time.
- [ ] Node status updates as events arrive.
- [ ] Expand/collapse state is stable during stream updates.
- [ ] Parent-child rendering handles nested delegation depth correctly.
- [ ] Empty/loading/error states are clear and non-technical.

### References
- `analiza-observability.md` (Agent Tree behavior)
- `spec-mvp-diricode.md` (UX-001, UX-003)

### Dependencies
- Depends on: DC-OBS-001, DC-OBS-002, DC-WEB-002
- Blocks: MVP-3 transparency acceptance

---

## Issue: DC-OBS-005 — Metrics Bar component (MVP-3, Web UI)

### Description
Build bottom metrics bar with live session telemetry:
- total tokens
- total cost
- session duration
- model usage
- cost split by agent tier (when available)

Data transport via SSE.

### Acceptance Criteria
- [ ] Bar updates in real time from aggregator state.
- [ ] Session duration timer remains consistent across reconnects.
- [ ] Model usage summary is visible without opening deep panels.
- [ ] Cost by tier is displayed (or gracefully hidden if unavailable).
- [ ] Presentation remains concise for UX-001 (no overload by default).

### References
- `analiza-observability.md` (Metrics Bar definition)
- `analiza-lean-mode.md` (Verbose level can reduce/expand detail)

### Dependencies
- Depends on: DC-OBS-003, DC-WEB-002

---

## Issue: DC-OBS-006 — Live Activity Indicator (MVP-3, Web UI)

### Description
Build top activity strip showing current work in progress:
- active agent name
- current operation
- elapsed duration
- LLM streaming indicator
- tool execution indicator

Priority is "what is happening now?" clarity.

### Acceptance Criteria
- [ ] Indicator selects current active operation deterministically.
- [ ] Streaming mode is visually distinct from tool execution mode.
- [ ] Approval wait states are represented when relevant.
- [ ] Turn completion and error terminal states are shown clearly.
- [ ] Works under parallel agent events with predictable prioritization.

### References
- `analiza-observability.md` (state machine examples)
- UX-001 principle (minimal cognitive load)

### Dependencies
- Depends on: DC-OBS-002, DC-WEB-002

---

## Must NOT
- Must NOT ship v2 observability panels (Detail Panel, Timeline) in MVP scope.
- Must NOT couple UI state to ad-hoc local logs; EventStream is the single source of truth.
- Must NOT emit untyped or schema-less events.
- Must NOT break agent tree transparency requirement (UX-003).

## Epic Dependencies
- **Blocked by**: event transport (SSE), persistence (SQLite), lifecycle instrumentation.
- **Blocks**: full MVP-3 web transparency demo and cost visibility.
