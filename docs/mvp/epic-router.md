# Epic: Provider Router (@diricode/providers)

## Summary

Provider Router is the highest-priority implementation epic in MVP bootstrap ("router first").
It delivers a native TypeScript routing layer over Vercel AI SDK for provider selection, structured error classification, retry/backoff, provider-level fallback, and resilient streaming.

Scope spans **POC → MVP-1**:
- **POC**: provider abstraction, registry, Copilot adapter, baseline routing path
- **MVP-1**: full error classifier, retry engine, fallback chain, stream manager, Kimi adapter

MVP provider priority order:
1. **Copilot** (priority 1, default)
2. **Kimi** (priority 2, fallback)

Primary reference: `analiza-router.md` (architecture, constants, retry/fallback/stream patterns).
Architecture target: **Provider Registry + Error Classifier + Retry Engine + Stream Manager**, wrapping `@ai-sdk/*`.

---

## Issue: DC-PROV-001 — Provider interface and registry

### Description
Define core provider abstraction and registry in `@diricode/providers`:
- Abstract Provider interface wrapping Vercel AI SDK model access + streaming entrypoint
- Provider metadata model: `name`, `models`, `capabilities`, `priority`, `rateLimits`
- Registry API:
  - `register(provider)`
  - `get(name)`
  - `list()`
  - `getDefault()` (priority-based or explicit default)
- Registry validation:
  - no duplicate provider names
  - no invalid priority values
  - deterministic ordering by priority asc
- Initial support for exactly two MVP providers: Copilot (1), Kimi (2)

### Acceptance Criteria
- Provider interface is package-public and used by adapters
- Registry supports register/get/list/getDefault with typed errors
- Default provider resolution returns Copilot when both configured
- Metadata includes capabilities needed by router decisions (streaming, tool-use support, max context hints if available)
- Unit tests cover:
  - successful registration
  - duplicate provider registration failure
  - missing provider fetch failure
  - default resolution behavior

### References
- `analiza-router.md` (section 4.2/4.3 architecture and public interface)
- `spec-mvp-diricode.md` (router first, Copilot/Kimi MVP priority)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `docs/adr/adr-005-families-model-agent-skill-grouping.md`
- `docs/adr/adr-006-agent-config-4-fallback-types.md`

### Dependencies
- Depends on: none
- Required by: DC-PROV-002, DC-PROV-003, DC-PROV-005, DC-PROV-007

---

## Issue: DC-PROV-002 — Copilot provider adapter

### Description
Implement GitHub Models/Copilot adapter (priority 1) as Provider interface implementation:
- Integrate via `@ai-sdk/github` when viable; fallback to custom adapter if required by API shape
- Auth via GitHub token (`DC_*` env convention per config standards)
- Model mapping table for MVP-required models (e.g. `gpt-5.4`, `claude-sonnet` variants exposed through GitHub Models)
- Streaming support normalized to router stream contract
- Adapter-level error payload preservation for classifier (`raw` error propagation)

### Acceptance Criteria
- Copilot adapter registers successfully in Provider Registry with priority 1
- Missing/invalid auth is surfaced as structured provider error input (not swallowed)
- Model mapping is deterministic and test-covered
- Streaming emits chunks compatible with Stream Manager expectations
- Integration tests with mocked AI SDK confirm:
  - successful non-stream request
  - successful stream request
  - auth failure path
  - unmapped model failure path

### References
- `analiza-router.md` (OpenCode + Vercel AI SDK patterns; Copilot priority)
- `spec-mvp-diricode.md` (MVP providers)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `docs/adr/adr-011-4-layer-config-hierarchy.md` (env/config layering)

### Dependencies
- Depends on: DC-PROV-001
- Required by: DC-PROV-005, DC-PROV-006

---

## Issue: DC-PROV-003 — Error classifier

### Description
Implement central error normalization layer converting raw provider/API/stream errors to unified RouterError:
- Error kinds (exact MVP set):
  - `rate_limited`
  - `context_overflow`
  - `overloaded`
  - `quota_exhausted`
  - `auth_error`
  - `not_found`
  - `other`
- Structured error shape:
  - `{ kind, provider, model, retryable, retryAfterMs, raw }`
- Per-provider mapping rules (Copilot/Kimi formats differ)
- Heuristic + status-based detection (patterns from primary analysis)
- Retry-After extraction from:
  - `Retry-After` (seconds/date)
  - `X-RateLimit-Reset`
  - known body patterns (`retry_after_ms`, textual retry hints)

### Acceptance Criteria
- Classifier returns one of 7 allowed kinds for all known inputs
- `retryable` derived consistently by kind + policy (with provider exceptions where needed)
- Retry-After parser returns ms value or 0 if absent/unparseable
- Raw error payload is retained for observability/debugging
- Unit tests cover:
  - status-code mapping (401/403/404/413/429/5xx)
  - context overflow regex patterns
  - retry-after parsing variants
  - unknown errors → `other`

### References
- `analiza-router.md` (sections 2.1.2, 2.1.3, 3.1, 3.2)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `docs/adr/adr-031-observability-eventstream-agent-tree.md` (error visibility implications)

### Dependencies
- Depends on: DC-PROV-001
- Required by: DC-PROV-004, DC-PROV-005, DC-PROV-006

---

## Issue: DC-PROV-004 — Retry engine with exponential backoff

### Description
Implement retry orchestration wrapper for provider calls and streams:
- Constants:
  - `MAX_RETRIES = 3`
  - `MAX_RETRY_DELAY_MS = 15000`
- Exponential backoff + jitter
- Retry only when `error.retryable === true`
- Respect parsed Retry-After when present, clamped to max retry delay policy
- Preserve attempt metadata for logs/events

### Acceptance Criteria
- Retry engine retries max 3 attempts on retryable errors
- Delay strategy:
  - uses Retry-After if provided and policy-allowed
  - else exponential+jitter
  - never exceeds `MAX_RETRY_DELAY_MS`
- Non-retryable errors fail fast
- Attempt count and delay are observable via structured telemetry/log output
- Unit tests verify:
  - retry count boundaries
  - jittered delay range validity
  - retry-after precedence
  - fail-fast behavior

### References
- `analiza-router.md` (sections 2.1.4, 3.3; constants table)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `cross-cutting.md` (typed errors, structured logging)

### Dependencies
- Depends on: DC-PROV-003
- Required by: DC-PROV-005, DC-PROV-006

---

## Issue: DC-PROV-005 — Provider fallback chain

### Description
Implement provider-level fallback orchestration for MVP routing:
- Priority order: **Copilot → Kimi**
- Fallback triggers:
  - `quota_exhausted`
  - `auth_error`
  - repeated `rate_limited` (after retry budget exhausted)
- Fallback granularity: provider-level only (not model-level in MVP)
- Routing remains family/config-aware but uses provider priority chain
- Emit fallback event/context for observability

### Acceptance Criteria
- Router selects Copilot first by default
- On configured trigger conditions, router switches to Kimi automatically
- Fallback occurs only after retry engine policy where applicable
- If both providers fail, router returns terminal structured error containing attempt history
- Unit/integration tests cover:
  - happy-path Copilot success (no fallback)
  - rate-limit retries then fallback
  - quota/auth immediate fallback
  - fallback exhaustion

### References
- `analiza-router.md` (sections 3.3, 3.5, 4.4 flow)
- `spec-mvp-diricode.md` (provider priority and failover-first mode)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `docs/adr/adr-005-families-model-agent-skill-grouping.md`

### Dependencies
- Depends on: DC-PROV-002, DC-PROV-004, DC-PROV-007
- Required by: router MVP-1 exit behavior

---

## Issue: DC-PROV-006 — Stream manager

### Description
Implement stream lifecycle manager for resilient streaming behavior:
- Constants:
  - `STREAM_INACTIVITY_TIMEOUT_MS = 60000`
  - `USAGE_CHUNK_TIMEOUT_MS = 10000`
- Detect and abort stalled streams on inactivity
- Wait bounded time for usage chunk after stream completion
- Graceful teardown on error/cancel
- Token/usage aggregation from stream chunks

### Acceptance Criteria
- Inactivity timer resets on every content chunk
- Stream is terminated with classified timeout error when inactive > 60s
- Usage wait phase times out after 10s without hanging request lifecycle
- Partial stream data handling is deterministic on cancellation/error
- Usage/token metadata is surfaced to caller/telemetry
- Tests cover:
  - normal stream completion with usage
  - no-chunk inactivity timeout
  - missing usage timeout
  - provider error during stream teardown

### References
- `analiza-router.md` (sections 2.1.6, 3.4; constants)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `docs/adr/adr-031-observability-eventstream-agent-tree.md`

### Dependencies
- Depends on: DC-PROV-003, DC-PROV-004
- Required by: production-grade streaming in MVP-1

---

## Issue: DC-PROV-007 — Kimi provider adapter

### Description
Implement Kimi adapter (priority 2) as fallback-capable Provider:
- Kimi API integration (likely OpenAI-compatible path, per analysis recommendation)
- Auth wiring via `DC_*` env/config conventions
- Model mapping for MVP family assignments
- Streaming support compatible with Stream Manager
- Error payload compatibility for classifier

### Acceptance Criteria
- Kimi adapter registers with priority 2 in Provider Registry
- Authentication and model mapping are test-covered
- Streaming works through common router stream pipeline
- Error responses from Kimi are classifiable into 7 error kinds
- Integration tests with mocked API/SDK cover:
  - success path
  - auth failure
  - rate-limit failure
  - context-overflow failure

### References
- `analiza-router.md` (sections 3.1, 3.6, 6)
- `spec-mvp-diricode.md` (MVP providers and order)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `docs/adr/adr-011-4-layer-config-hierarchy.md`

### Dependencies
- Depends on: DC-PROV-001
- Required by: DC-PROV-005

---

---

## MVP-2: Cost Tracking Extension

> **Note**: These issues extend the router for cost tracking and provider type awareness. Not part of the initial MVP-1 router epic but planned for MVP-2.

### Issue: DC-ROUTER-020 — Provider Type Registry

#### Description
Extend the existing Provider Registry (DC-PROV-001) to support typed providers:
- `type: "api" | "subscription" | "hybrid"`
- `ApiProvider`: per-token pricing configuration
- `SubscriptionProvider`: monthly price + quota limits
- `HybridProvider`: subscription base + overage pricing

#### Acceptance Criteria
- Provider registry supports all three types with type-safe interfaces
- Existing provider adapters (Copilot, Kimi) are classified and migrated
- Type information is available to routing decisions

#### References
- ADR-053 Router Cost Tracking
- ADR-042 Multi-Subscription Management

---

### Issue: DC-ROUTER-021 — Cost Tracking Engine

#### Description
Centralized cost tracking module in the router:
- `calculateCallCost(provider, usage)` — type-aware calculation per call
- `getSessionCost(sessionId)` — session aggregation
- `getProviderStats(providerId)` — per-provider efficiency statistics
- Real-time cost for API providers; deferred/estimated for subscriptions

#### Acceptance Criteria
- Real-time cost calculation for API providers
- Deferred/estimated cost for subscription providers with clear "estimated" flag
- Hybrid calculation for Azure-style providers
- Statistics queryable per-provider, per-model, per-session

#### References
- ADR-053 Router Cost Tracking
- DC-SAFE-004 (Token Guardrails)

---

### Issue: DC-ROUTER-022 — Cost Optimization Routing Strategy

#### Description
Router strategy that prefers subscription providers (within quota) over pay-per-token:
- "Cheapest first" strategy: exhaust subscription quota before using API providers
- Automatic fallback when subscription quota exhausted
- Track cost savings from optimization
- User preference setting: `speed` vs `cost`

#### Acceptance Criteria
- `cost-optimized` strategy implemented in router
- Automatic subscription → API fallback when quota reached
- Savings tracked and surfaced via stats
- User preference configurable

#### References
- ADR-053 Router Cost Tracking
- DC-PROV-005 Provider Fallback Chain

---

## Must NOT (Epic-specific)

- Must NOT introduce LiteLLM (or any Python sidecar/proxy) in MVP
- Must NOT implement non-MVP routing strategies (race/consensus/load-balancing) in this epic
- Must NOT add model-level fallback policy (provider-level fallback only for MVP)
- Must NOT bypass structured error classification (no raw pass-through as primary contract)
- Must NOT rely on untyped/unvalidated provider responses
- Must NOT violate package boundaries (router logic stays in `@diricode/providers`)
- Must NOT weaken safety/observability conventions (structured logs, traceability)

---

## Dependencies

### Upstream / External
- Vercel AI SDK provider packages (`@ai-sdk/*`) availability for Copilot/Kimi integration paths
- Config system conventions (`DC_*`, layered config) from core/config epics
- Testing infrastructure (Vitest + provider mocks)

### Cross-epic
- **epic-config**: provider credentials and routing defaults schema
- **epic-observability**: fallback/retry/stream event consumption
- **epic-agents-core** and **epic-pipeline**: router call sites and propagation of structured router errors
- **epic-safety**: secret redaction before outbound provider calls

### Delivery sequencing (router first)
1. DC-PROV-001
2. DC-PROV-002 + DC-PROV-007 (adapters)
3. DC-PROV-003
4. DC-PROV-004
5. DC-PROV-005
6. DC-PROV-006

POC exit requires baseline Copilot path operational with registry abstraction.
MVP-1 exit requires full retry/fallback/error/stream behavior with Copilot→Kimi failover.

---

## v2 follow-up routing task

### DC-ROUT-001 — Load-aware model routing and cooldown policy

After the baseline router is stable, add health-aware routing inputs such as recent failures, cooldown windows, and basic load-aware selection without jumping straight to full adaptive orchestration.

---

## Cross-References (Post-ADR Review)

- **DC-SAFE-004** (Token/Cost Guardrails): Session budget enforcement lives in safety layer; DC-ROUTER-021 extends this with type-aware cost calculation. Safety guardrails remain upstream gatekeepers; router provides detailed tracking.
- **DC-SAFE-006** (Permission Context Engine): Outbound provider calls from the router are subject to permission context rules (e.g., coordinator vs. interactive contexts may have different provider usage policies). DC-ROUTER-020 provider type metadata informs permission-level decisions.
