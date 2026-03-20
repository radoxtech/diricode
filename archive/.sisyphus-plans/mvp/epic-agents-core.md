# Epic: Agents Core Execution Framework (POC → MVP-1)

> **Package**: `@diricode/core`  
> **Iteration**: POC → MVP-1  
> **Issue IDs**: DC-CORE-005 — DC-CORE-012  
> **Dependencies**: DC-CORE-001..004 (config), DC-SRV-001..004 (EventStream transport), DC-PROV-001..007 (model routing)

## Summary
This epic defines the runtime substrate for all agents: lifecycle, registry, dispatcher, delegation protocol, sandboxing, prompt assembly, and tier→model mapping.

Scope is **framework-level only** (how agents run), not individual agent personas/prompts (covered in `epic-agents-roster.md`).

Key constraints baked into this epic:
- **ARCH-004**: Plandex roles map to first-class DiriCode agents (agentized responsibilities, no hidden role-switch magic).
- **POC constraint**: no skills system dependency in routing/execution; agents are hardcoded in TypeScript first.
- Tier controls cost/quality policy from day 1 (HEAVY/MEDIUM/LOW).

---

## Issue: DC-CORE-005 — Agent interface and lifecycle

### Description
Define canonical agent runtime contracts:
- `AgentDefinition`: `name`, `tier`, `tags/capabilities`, `modelRequirements`, `systemPromptTemplate`, `toolAccess`, `maxTokens`.
- `AgentExecutionContext`: task input, conversation/context slices, trace IDs, parent/child metadata.
- Lifecycle state machine: `initialize -> execute -> complete | error` with typed transitions.
- `AgentResult`: `{ success, output, tokensUsed, cost, errors }` (+ optional metadata like duration/model).

Unify all downstream execution around this interface (dispatcher, verifier, observability, retry/sandbox).

### Acceptance Criteria
- [ ] Shared TS types for definition/context/result are exported from `@diricode/core`.
- [ ] Lifecycle transitions are explicit and validated (no silent invalid states).
- [ ] Result object always contains `success`, `output`, `tokensUsed`, `cost`, `errors`.
- [ ] Errors are typed and include `code/message/context` (cross-cutting convention).
- [ ] Lifecycle hooks emit typed events usable by EventStream.

### References
- `analiza-agent-roster.md` (tier + role taxonomy)
- `analiza-plandex-roles.md` (role separation and runtime contracts)
- `.sisyphus/plans/cross-cutting.md` (typed errors/events)

### Dependencies
- Depends on: DC-CORE-001..004
- Blocks: DC-CORE-006..011

---

## Issue: DC-CORE-006 — Agent registry

### Description
Implement a registry for runtime agent discovery and policy enforcement:
- Register/unregister/resolve agents by unique name.
- Query by tags/capabilities (e.g., `planning`, `review`, `regular-coding`).
- Apply tier constraints at selection time (HEAVY prefers strongest models; LOW prefers cheapest).
- Validate duplicate names and invalid tier/model configs early.

Registry is the single source of truth used by dispatcher and delegation engine.

### Acceptance Criteria
- [ ] Registry supports `getByName`, `listByTag`, `listByTier`.
- [ ] Duplicate registration is rejected with typed error.
- [ ] Tier policy checks run on registration and dispatch.
- [ ] Registry emits `agent.registered` / `agent.rejected` events.
- [ ] Read path is deterministic and test-covered.

### References
- `analiza-agent-roster.md` (tags, tiers)
- `spec-mvp-diricode.md` (tiered agent system)

### Dependencies
- Depends on: DC-CORE-005, DC-CORE-012
- Blocks: DC-CORE-007, DC-CORE-011

---

## Issue: DC-CORE-007 — Dispatcher agent runtime (POC)

### Description
Build central coordinator runtime behavior:
- Receives user request and picks target agent(s).
- POC routing is intentionally hardcoded (example baseline: code task -> `code-writer`, question/summarize -> `summarizer`).
- Emits delegation and completion events to EventStream.
- Keeps architecture open for MVP-1 LLM-based router without breaking interfaces.

POC must not depend on skills loading; static TS mappings only.

### Acceptance Criteria
- [ ] Dispatcher consumes registry and execution sandbox APIs.
- [ ] Hardcoded routing table exists and is testable.
- [ ] Delegation events include parent/child IDs and timestamps.
- [ ] Unknown task category falls back to safe default path (planner/explorer).
- [ ] Extension point for MVP-1 intelligent routing is defined behind interface.

### References
- `analiza-agent-roster.md` (dispatcher role)
- `analiza-plandex-roles.md` (orchestration flow)
- `spec-mvp-diricode.md` (dispatcher-first pillar)

### Dependencies
- Depends on: DC-CORE-005, DC-CORE-006, DC-CORE-009, DC-CORE-011
- Blocks: MVP POC end-to-end agent demo

---

## Issue: DC-CORE-008 — Agent communication protocol

### Description
Define parent-child delegation protocol:
- Context handoff envelope (task intent, constraints, selected files, prior outputs).
- Parent-child graph metadata (depth, lineage path, trace/span IDs).
- Configurable context inheritance rules (full, filtered, summary-only, none).
- Result propagation contract (child result normalized and returned to parent for aggregation/decision).

This protocol is transport-agnostic and works for sequential and parallel delegation.

### Acceptance Criteria
- [ ] Delegation payload schema is versioned and validated.
- [ ] Parent-child relation is reconstructible for full agent tree.
- [ ] Inheritance modes are configurable per delegation edge.
- [ ] Child failures are returned as typed result, not thrown across boundary.
- [ ] Protocol schema is reused by EventStream payloads.

### References
- `analiza-plandex-roles.md` (flow + context handoff)
- `spec-mvp-diricode.md` (nested delegation + context architecture)

### Dependencies
- Depends on: DC-CORE-005
- Blocks: DC-CORE-011, observability tree views

---

## Issue: DC-CORE-009 — Agent execution sandbox

### Description
Implement per-invocation safety and isolation:
- Token budget from `tier x task complexity` policy.
- Per-agent timeout controls.
- Error isolation boundary (one agent failure cannot crash whole pipeline).
- Tier-aware retry policy (e.g., HEAVY lower retry count but stronger fallback; LOW cheap retries).

Sandbox must produce deterministic stop reasons (`budget_exceeded`, `timeout`, `retry_exhausted`, `upstream_error`).

### Acceptance Criteria
- [ ] Budget calculator is deterministic and configurable.
- [ ] Timeout is enforced for every invocation.
- [ ] Failure in one child delegation is isolated and reported upward.
- [ ] Retry policy is tier-aware and logged.
- [ ] Sandbox emits metrics: duration, retries, tokens, stop reason.

### References
- `spec-mvp-diricode.md` (guardrails, cost control)
- `overview.md` (performance targets)

### Dependencies
- Depends on: DC-CORE-005, DC-CORE-012
- Blocks: DC-CORE-007, DC-CORE-011

---

## Issue: DC-CORE-010 — Agent prompt builder

### Description
Create reusable prompt assembly module:
- System prompt templating + interpolation variables.
- Context injection (repo map, active files, conversation history, plan snippets).
- Tool binding per agent (`toolAccess` -> runtime tool set).
- Model selection handoff based on tier + availability (delegates final choice to router policy).

Prompt builder must produce inspectable artifacts for debugging/observability.

### Acceptance Criteria
- [ ] Prompt template API supports deterministic interpolation.
- [ ] Context sections are composable and order-controlled.
- [ ] Tool binding enforces allowlist per agent.
- [ ] Prompt build result includes metadata (sections, token estimate, chosen model candidate).
- [ ] Fails safely when mandatory context sections are missing.

### References
- `analiza-plandex-roles.md` (prompt-per-role pattern)
- `spec-mvp-diricode.md` (context layers + model routing)

### Dependencies
- Depends on: DC-CORE-005, DC-CORE-012
- Blocks: DC-CORE-007, roster agent implementation quality

---

## Issue: DC-CORE-011 — Delegation system (POC → MVP-1)

### Description
Build delegation runtime over protocol/sandbox:
- Dispatcher delegates to specialist agents.
- Enforce delegation depth limit to prevent infinite chains.
- Support parallel delegation where tasks are independent.
- Emit complete delegation telemetry to EventStream.

POC: deterministic delegation graph from hardcoded dispatcher logic.  
MVP-1: same APIs power LLM-assisted routing without redesign.

### Acceptance Criteria
- [ ] Delegation depth guard is enforced and configurable.
- [ ] Parallel child execution supported with join/aggregation semantics.
- [ ] Parent receives normalized child results in stable order.
- [ ] Delegation events cover start/success/failure/cancel.
- [ ] System continues when one branch fails (unless policy says fail-fast).

### References
- `overview.md` (agent tree + observability)
- `spec-mvp-diricode.md` (nested delegation + loop safety)

### Dependencies
- Depends on: DC-CORE-007, DC-CORE-008, DC-CORE-009
- Blocks: MVP-1 multi-agent execution scenarios

---

## Issue: DC-CORE-012 — Agent-tier model mapping

### Description
Implement configurable tier→model resolution in `config.jsonc`:
- HEAVY -> strongest available model class.
- MEDIUM -> balanced quality/cost class.
- LOW -> fastest/cheapest class.
- Provider/model fallback chain if preferred model unavailable.

This mapping is policy, not hardcoded constants, and must integrate with router failover.

### Acceptance Criteria
- [ ] Tier mapping is configurable in project/global config.
- [ ] Resolver supports preferred + ordered fallback list.
- [ ] Unavailable model/provider triggers next-best fallback automatically.
- [ ] Resolver returns typed reason metadata (preferred, fallback, degraded).
- [ ] Mapping is consumed by registry/dispatcher/prompt-builder consistently.

### References
- `spec-mvp-diricode.md` (provider routing + config)
- `analiza-plandex-roles.md` (role config + fallback patterns)

### Dependencies
- Depends on: DC-CORE-001..004
- Blocks: DC-CORE-006, DC-CORE-009, DC-CORE-010

---

## Must NOT
- Must NOT implement individual agent personas/prompts here (belongs to roster epic).
- Must NOT depend on skills system in POC routing/execution (hardcoded TS first).
- Must NOT let child failures crash the entire runtime by default.
- Must NOT bypass tier policies when selecting models/tools.
- Must NOT create hidden role switching outside explicit agent registry entries.

## Dependencies (Epic-level)
- Upstream: config, providers router, server event transport.
- Downstream: `epic-agents-roster.md`, pipeline, observability, web agent-tree UI.

## Issue Graph
- DC-CORE-005 -> {006,008,009,010}
- DC-CORE-012 -> {006,009,010}
- {006,009,010} -> 007
- {008,009,007} -> 011
