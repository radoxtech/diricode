# Epic: Provider Router (@diricode/providers)

## Summary

Provider Router is the highest-priority implementation epic in MVP bootstrap ("router first").
It delivers a native TypeScript routing layer using **Vercel AI SDK** (`@ai-sdk/*`) as the transport layer for LLM communication, with structured error classification, retry/backoff, provider-level fallback, and resilient streaming on top.

**Architecture (ADR-054):** AI SDK handles all LLM transport (`generateText`, `streamText`, `createProviderRegistry`). DiriCode adds error classification, retry engine, fallback chain, stream lifecycle management, and static **Model Cards** (`ModelDescriptor`) for metadata that AI SDK does not expose (context window, capabilities, pricing tier).

Scope spans **POC → MVP-1**:
- **POC**: AI SDK provider registry, Copilot adapter via `@ai-sdk/github`, baseline routing path
- **MVP-1**: full error classifier, retry engine, fallback chain, stream manager, Kimi adapter via `@ai-sdk/moonshotai`

MVP provider priority order:
1. **Copilot** (priority 1, default) — via `@ai-sdk/github`
2. **Kimi** (priority 2, fallback) — via `@ai-sdk/moonshotai`

Primary reference: `analiza-router.md` (architecture, constants, retry/fallback/stream patterns).
Architecture target: **AI SDK Provider Registry + Error Classifier + Retry Engine + Stream Manager**, using `@ai-sdk/*` provider packages.
Transport decision: `docs/adr/adr-054-ai-sdk-transport-layer.md`

---

## Issue: DC-PROV-001 — Provider registry (AI SDK)

### Description
Configure the AI SDK provider registry using `createProviderRegistry()` from the `ai` package:
- Register all MVP providers via their official `@ai-sdk/*` packages
- Provider metadata model for DiriCode-specific concerns: `name`, `priority`, `rateLimits`
- Registry API wrapping AI SDK:
  - `registry.languageModel("provider:model")` for model lookup
  - `list()` for enumerating available providers
  - `getDefault()` (priority-based or explicit default)
- Static **Model Cards** (`ModelDescriptor[]`) bundled per provider for metadata AI SDK doesn't expose (context window, max output, capabilities, pricing tier)
- Initial support for exactly two MVP providers: Copilot (1), Kimi (2)

### Acceptance Criteria
- AI SDK `createProviderRegistry()` configured with `@ai-sdk/github` and `@ai-sdk/moonshotai`
- Static `ModelDescriptor[]` bundled for each provider's models (JSON or TypeScript constants)
- Default provider resolution returns Copilot when both configured
- Model Cards include capabilities needed by router decisions (context window, tool-use support, vision, reasoning)
- Unit tests cover:
  - successful model lookup via `registry.languageModel()`
  - missing provider/model fetch failure
  - default resolution behavior
  - Model Card data validation

### References
- `docs/adr/adr-054-ai-sdk-transport-layer.md` (AI SDK adoption, two-registry architecture)
- `analiza-router.md` (section 4.2/4.3 architecture and public interface)
- `spec-mvp-diricode.md` (router first, Copilot/Kimi MVP priority)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`
- `docs/adr/adr-005-families-model-agent-skill-grouping.md`
- `docs/adr/adr-006-agent-config-4-fallback-types.md`

### Dependencies
- Depends on: none
- Required by: DC-PROV-002, DC-PROV-003, DC-PROV-005, DC-PROV-007

---

## Issue: DC-PROV-002 — Copilot provider adapter (via `@ai-sdk/github`)

### Description
Configure the GitHub Models/Copilot adapter (priority 1) using the official `@ai-sdk/github` package:
- Auth via GitHub token (`DC_*` env convention per config standards)
- Model mapping table for MVP-required models (e.g. `gpt-5.4`, `claude-sonnet` variants exposed through GitHub Models)
- Streaming via AI SDK's `streamText()` — normalized to router stream contract
- Error payload preservation for classifier (`raw` error propagation)
- Static `ModelDescriptor[]` for all Copilot-accessible models (bundled, not fetched at runtime)

### Acceptance Criteria
- Copilot adapter configured in AI SDK provider registry with priority 1 via `@ai-sdk/github`
- Missing/invalid auth is surfaced as structured provider error input (not swallowed)
- Model mapping is deterministic and test-covered
- Streaming via `streamText()` emits chunks compatible with Stream Manager expectations
- Static `ModelDescriptor[]` bundled for Copilot models (context window, capabilities)
- Integration tests with mocked AI SDK confirm:
  - successful non-stream request via `generateText()`
  - successful stream request via `streamText()`
  - auth failure path
  - unmapped model failure path

### References
- `docs/adr/adr-054-ai-sdk-transport-layer.md` (AI SDK adoption)
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

## Issue: DC-PROV-007 — Kimi provider adapter (via `@ai-sdk/moonshotai`)

### Description
Configure the Kimi adapter (priority 2) as fallback-capable provider using the official `@ai-sdk/moonshotai` package:
- `@ai-sdk/moonshotai` is a thin wrapper over OpenAI-compatible API — minimal configuration needed
- Auth wiring via `DC_*` env/config conventions
- Model mapping for MVP family assignments
- Streaming via AI SDK's `streamText()` — compatible with Stream Manager
- Error payload compatibility for classifier
- Static `ModelDescriptor[]` for Kimi models (bundled)

### Acceptance Criteria
- Kimi adapter configured in AI SDK provider registry with priority 2 via `@ai-sdk/moonshotai`
- Authentication and model mapping are test-covered
- Streaming works through common AI SDK `streamText()` pipeline
- Error responses from Kimi are classifiable into 7 error kinds
- Static `ModelDescriptor[]` bundled for Kimi models
- Integration tests with mocked API/SDK cover:
  - success path
  - auth failure
  - rate-limit failure
  - context-overflow failure

### References
- `docs/adr/adr-054-ai-sdk-transport-layer.md` (AI SDK adoption)
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
