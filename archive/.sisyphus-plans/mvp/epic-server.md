# Epic: Server API Foundation (POC)

> Package: `@diricode/server`  
> Iteration: **POC**  
> Issue IDs: **DC-SRV-001..DC-SRV-004**

## Summary

This epic establishes the HTTP contract for DiriCode MVP by implementing a Hono-based server with SSE streaming, session APIs, and stable API versioning conventions. It is the transport and orchestration boundary between CLI/Web clients and the core runtime, aligned with ADR-001 (HTTP+SSE), ADR-031 (EventStream observability), and ADR-022 (session/memory integration boundaries).

The server must prioritize reliability, typed payload contracts, and predictable behavior under reconnects and failures. It must stay minimal in POC, but with forward-compatible structure for MVP-1/MVP-2 expansions.

## Issues

### DC-SRV-001 — Hono HTTP server skeleton

**Goal**: Stand up a production-shaped Hono server skeleton for local-first development.

**Scope**
- Initialize Hono app with:
  - `GET /health`
  - route group under `/api/v1/*`
- Add CORS for local development:
  - allow Web UI origin on separate port
  - allow credentials only if needed by chosen session strategy
- Add centralized error middleware:
  - normalize errors into typed response envelope
  - include traceId/correlation metadata (from cross-cutting logging rules)
- Integrate Bun serve bootstrap:
  - explicit host/port config path
  - graceful startup and shutdown hooks for local dev ergonomics

**Acceptance criteria**
- Server boots via Bun and responds on `/health` with structured JSON.
- All API endpoints live under `/api/v1` namespace.
- CORS preflight succeeds for local Web UI origin.
- Unhandled exceptions map to stable error JSON shape (no raw stack by default).

**ADR/Spec references**
- ADR-001 HTTP REST + SSE communication
- ADR-009/011 config loading and env layering
- ADR-031 EventStream as observability backbone

---

### DC-SRV-002 — SSE (Server-Sent Events) transport

**Goal**: Provide robust one-way event streaming from runtime to clients.

**Scope**
- Implement `GET /api/v1/events` as EventStream endpoint.
- Connection lifecycle management:
  - connect registry
  - disconnect cleanup
  - reconnect semantics using last-event-id strategy (if available)
- Typed event serialization:
  - JSON payload envelope
  - event names follow `domain.action`
  - payloads aligned to EventStream schemas from overview/cross-cutting docs
- Heartbeat mechanism:
  - periodic heartbeat event to detect stale clients/proxies
  - stale connection cleanup policy

**Acceptance criteria**
- Multiple clients can subscribe concurrently and receive events.
- Disconnect removes client from registry (no leaked listeners).
- Heartbeat events are emitted on schedule and visible to subscribers.
- Event payloads validate against shared schema contracts before emission.

**Implementation notes (POC)**
- Keep replay/history minimal in POC (live stream first).
- Prepare interface seam for future timeline replay via `@diricode/memory` (MVP-1).

**ADR/Spec references**
- ADR-001 HTTP + SSE
- ADR-031 observability EventStream + agent tree
- ADR-016 context-budget aware transport design (avoid noisy unbounded streams)

---

### DC-SRV-003 — Session management API

**Goal**: Expose minimal session lifecycle APIs for orchestrated task execution.

**Scope**
- `POST /api/v1/sessions` — create session
- `GET /api/v1/sessions/:id` — retrieve session state snapshot
- `POST /api/v1/sessions/:id/messages` — submit user message into session pipeline
- Session lifecycle model:
  - `created` → `active` → `completed | error`
- Basic validation and idempotency guards:
  - reject malformed IDs/payloads
  - deterministic error codes for unknown/closed sessions

**Acceptance criteria**
- Session create returns unique session ID and initial state.
- Message post transitions `created` session into `active`.
- Completed/error sessions are queryable with terminal state.
- API rejects invalid transitions (e.g., posting to nonexistent session).

**Data/ownership boundaries**
- `@diricode/server` owns API contract and transport state.
- Durable timeline/state persistence is delegated to `@diricode/memory` APIs as they arrive (MVP-1).

**ADR/Spec references**
- ADR-013 project pipeline (Interview→Plan→Execute→Verify)
- ADR-022 project memory + timeline responsibilities
- ADR-002 dispatcher-first orchestration boundary

---

### DC-SRV-004 — API versioning and documentation

**Goal**: Make API evolution explicit and client-safe from day one.

**Scope**
- Enforce `/api/v1/` prefix for all functional routes.
- Add explicit API version response header for all API responses.
- Provide OpenAPI schema:
  - generated from route schemas if feasible, otherwise manually maintained source
  - include session and SSE endpoints with examples
- Document error envelope and event envelope shape.

**Acceptance criteria**
- No non-versioned API route exists outside health/meta endpoints.
- Responses include version header consistently.
- OpenAPI artifact exists and is consumable by Web/CLI clients.
- Contract docs cover session endpoints, SSE stream, and error formats.

**ADR/Spec references**
- ADR-001 transport contract clarity
- ADR-009 schema/config discipline
- ADR-031 observability event contract expectations

## Must NOT (POC guardrails)

- Must NOT implement Web UI concerns in server package beyond CORS and API contracts.
- Must NOT couple server routes directly to provider-specific logic (`@diricode/providers` internals).
- Must NOT bypass typed schema validation for external request/event payloads.
- Must NOT expose stack traces/secrets in error responses (align ADR-028 redaction principles).
- Must NOT add v2+ features in this epic:
  - no pre-tool approval orchestration (belongs to safety/hooks roadmap)
  - no annotation approval UI logic
  - no advanced timeline replay/filters beyond minimal SSE transport

## Dependencies

### Upstream
- `DC-SETUP-*` monorepo/package scaffolding in place.
- Shared type/schema primitives from `@diricode/core` (event + error contracts).
- Config loading baseline (`ADR-009`, `ADR-011`) available for host/port/origin.

### Cross-epic
- Depends on `epic-agents-core` for event producers and session orchestration integration points.
- Integrates with `epic-observability` data model (event names/payload shape).
- Aligns with `epic-memory` for persistence seam (MVP-1 onward).

### Downstream consumers
- `apps/cli` depends on session/message endpoints and SSE stream.
- `@diricode/web` depends on SSE + versioned session APIs.

## Notes on UX-002 alignment

Following iron guideline **UX-002** (“orchestration not too aggressive — human decides”), server APIs should preserve explicit control points:
- user-initiated session/message actions are explicit API calls,
- transport streams report state but do not auto-trigger destructive actions,
- future approval events can be layered onto EventStream without changing ownership boundaries established in POC.
