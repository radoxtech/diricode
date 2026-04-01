# Epic: LLM Picker (@diricode/providers)

## Summary

The LLM Picker is a **hybrid decision engine** combining a 3-tier ML cascade (Heuristic → BERT/ONNX → TinyLLM/ONNX) with policy-driven weighted scoring to select optimal LLM models for concurrent swarm agents. Sits between dispatcher/agent layer and SubscriptionRouter (ADR-042). Picker **never** makes LLM API calls.

The hybrid architecture:
```
Request → Tier 1 (Heuristic, <5ms) → Tier 2 (BERT/ONNX, <100ms) → Tier 3 (TinyLLM/ONNX, <300ms)
    → Task Classification → Policy Resolution → Weighted Scoring → Ranked Candidates
```

Scope: MVP-2 (Phases 1-5), v2 (Phase 6)
Primary reference: `docs/adr/adr-049-llm-picker.md`

---

## Phase 1 — Foundation (Sub-epic #390)

### Issue: DC-LLP-001 — ModelResolver interface + types

**GitHub**: #396 | **Sub-epic**: #390

#### Description
Define the core `ModelResolver` interface and the TypeScript types that govern the hybrid routing architecture. This foundation must support the 3-tier cascade and provide a unified contract for all routing components.

The interface must include:
- `resolve(request: DecisionRequest): Promise<DecisionResponse>`
- Support for `model_dimensions` (tier, family, tags, and fallback types mapping from ADR-004/005/006).
- A `classification_trace` to track how a decision moved through the cascade tiers.
- Hybrid architecture types for Heuristic, BERT, and TinyLLM routers.

#### Acceptance Criteria
- [ ] `ModelResolver` interface defined with Zod validation for requests and responses.
- [ ] `model_dimensions` field implemented in model metadata types.
- [ ] `classification_trace` accurately captures tier transitions (Tier 1 → Tier 2 → Tier 3).
- [ ] Exhaustive types for model families and fallback strategies.
- [ ] Comprehensive unit tests for type validation and interface compliance.

#### References
- `docs/adr/adr-049-llm-picker.md` (Section 2, 3: Contracts)
- `swarm-model-picker-plan.md` (lines 145-290: contracts)
- `docs/adr/adr-004`, `docs/adr/adr-005`, `docs/adr/adr-006` (Model dimensions)

#### Dependencies
- Depends on: none
- Required by: DC-LLP-003, DC-LLP-005, DC-LLP-007, DC-LLP-019

---

### Issue: DC-LLP-002 — Legacy ModelTierResolver adapter

**GitHub**: #397 | **Sub-epic**: #390

#### Description
Create an adapter for the existing `ModelTierResolver` to ensure backward compatibility during the transition to the new LLM Picker. This allows existing agents to continue functioning while the new engine is being integrated.

#### Acceptance Criteria
- [ ] Adapter implements `ModelResolver` interface.
- [ ] Correctly wraps existing `ModelTierResolver` logic.
- [ ] Minimal latency overhead (<2ms).
- [ ] Documented deprecation path for legacy calls.

#### References
- `packages/core/src/agents/model-tier-resolver.ts`
- `docs/adr/adr-049-llm-picker.md`

#### Dependencies
- Depends on: DC-LLP-001
- Required by: DC-LLP-031

---

### Issue: DC-LLP-003 — Feature flag and resolver factory

**GitHub**: #398 | **Sub-epic**: #390

#### Description
Implement a factory pattern to instantiate the appropriate resolver (Legacy vs. Hybrid) based on feature flags. This enables safe rollout and A/B testing of the new picker.

#### Acceptance Criteria
- [ ] `ResolverFactory` returns correct implementation based on `.dc/config.jsonc`.
- [ ] Feature flag `LLM_PICKER_ENABLED` toggles between legacy and cascade modes.
- [ ] Hot-reloading support for configuration changes without process restart.

#### References
- `docs/adr/adr-009-config-conventions.md`

#### Dependencies
- Depends on: DC-LLP-001, DC-LLP-002
- Required by: DC-LLP-031

---

### Issue: DC-LLP-004 — Routing rules schema and loader

**GitHub**: #399 | **Sub-epic**: #390

#### Description
Define the JSON schema for static routing rules and implement the loader that populates the policy engine. These rules act as the initial configuration for the heuristic tier.

#### Acceptance Criteria
- [ ] JSON schema defined for routing rules (Zod-backed).
- [ ] Loader reads from `packages/providers/src/picker/rules.json`.
- [ ] Validation ensures no circular fallback references.

#### References
- `docs/adr/adr-049-llm-picker.md` (Section 4: Policy System)

#### Dependencies
- Depends on: DC-LLP-001
- Required by: DC-LLP-005

---

### Issue: DC-LLP-005 — Heuristic router (Tier 1)

**GitHub**: #400 | **Sub-epic**: #390

#### Description
Implement the Tier 1 Heuristic router. This router uses fast, rule-based logic to resolve simple requests in under 5ms. It serves as the entry point of the 3-tier cascade.

#### Acceptance Criteria
- [ ] Resolution latency < 5ms for standard hits.
- [ ] Supports exact tag matches and regex-based task classification.
- [ ] Correctly delegates to Tier 2 if no confident heuristic match is found.

#### References
- `docs/adr/adr-049-llm-picker.md` (Cascade Tier 1)

#### Dependencies
- Depends on: DC-LLP-001, DC-LLP-004
- Required by: DC-LLP-019

---

### Issue: DC-LLP-006 — Tag-based model classification

**GitHub**: #401 | **Sub-epic**: #390

#### Description
Implement the model classification system that maps models to specific dimensions (tier, family, tags). This includes adding model dimensions mapping (tier/family/tags/fallback types) as defined in early ADRs.

#### Acceptance Criteria
- [ ] `model_dimensions` mapping implemented for all registered models.
- [ ] Supports tag inheritance and hierarchical model families.
- [ ] Queryable interface to find models by dimension subsets.

#### References
- `docs/adr/adr-004`, `docs/adr/adr-005`, `docs/adr/adr-006`

#### Dependencies
- Depends on: DC-LLP-001
- Required by: DC-LLP-007

---

### Issue: DC-LLP-007 — Candidate scorer

**GitHub**: #402 | **Sub-epic**: #390

#### Description
Implement the candidate scoring engine that combines policy resolution with weighted scoring. This merges Version B's policy engine concepts into the candidate evaluation flow.

The scorer calculates a final score based on:
- `quality_score` (0-100)
- `cost_score` (relative to cheapest)
- `latency_score` (relative to fastest)
- `capability_score` (hard filter)

#### Acceptance Criteria
- [ ] Policy resolution follows priority order (Override > Specific > Role > Task > Default).
- [ ] Weighted scoring algorithm implemented with 0.01 tolerance for weight sums.
- [ ] Capability match acts as a hard exclusion filter.
- [ ] Unit tests for score normalization and weight application.

#### References
- `docs/adr/adr-049-llm-picker.md` (Section 5: Scoring)
- `swarm-model-picker-plan.md` (lines 126-140: scoring algorithm)

#### Dependencies
- Depends on: DC-LLP-001, DC-LLP-006
- Required by: DC-LLP-019

---

## Phase 2 — Providers (Sub-epic #391)

> **AI SDK Integration (ADR-054):** Phase 2 adapters are thin wrappers around Vercel AI SDK's `@ai-sdk/*` provider packages for transport. Each adapter's primary job is to supply **static Model Cards** (`ModelDescriptor[]`) — metadata AI SDK doesn't expose (context window, capabilities, pricing tier, tool-call support) — and wire health/rate-limit reporting into the Picker's scoring engine. The actual LLM transport (`generateText`, `streamText`) is handled by AI SDK.

### Issue: DC-LLP-008 — ProviderAdapter interface + GitHub adapter

**GitHub**: #403 | **Sub-epic**: #391

#### Description
Define the `ProviderAdapter` interface for external model providers and implement the GitHub Models adapter. Transport uses `@ai-sdk/github` (ADR-054); the adapter focuses on metadata and health reporting that AI SDK does not provide.

#### Acceptance Criteria
- [ ] Unified `ProviderAdapter` interface for model discovery and capability reporting.
- [ ] GitHub adapter uses `@ai-sdk/github` for transport; supplies static `ModelDescriptor[]` for Copilot-accessible models.
- [ ] Health/rate-limit state extracted from AI SDK response headers (`usage`, `response.headers`).
- [ ] Error handling for provider-specific rate limits.

#### References
- `docs/adr/adr-054-ai-sdk-transport-layer.md` (AI SDK adoption, two-registry architecture)

#### Dependencies
- Depends on: DC-LLP-001

---

### Issue: DC-LLP-009 — z.ai provider adapter

**GitHub**: #404 | **Sub-epic**: #391

#### Description
Implement the adapter for the z.ai model provider. Transport via community AI SDK provider package; adapter supplies static `ModelDescriptor[]` and maps z.ai capabilities to DiriCode tags.

#### Acceptance Criteria
- [ ] Integration with z.ai via AI SDK-compatible provider package for transport.
- [ ] Static `ModelDescriptor[]` bundled for z.ai models (context window, capabilities, pricing).
- [ ] Correct mapping of z.ai capabilities to internal DiriCode tags.

#### References
- `docs/adr/adr-054-ai-sdk-transport-layer.md`

---

### Issue: DC-LLP-010 — MiniMax AI provider adapter

**GitHub**: #405 | **Sub-epic**: #391

#### Description
Implement the adapter for the MiniMax AI provider. Transport via `vercel-minimax-ai-provider` (community, MiniMax-maintained); adapter supplies static `ModelDescriptor[]`.

#### Acceptance Criteria
- [ ] Transport via `vercel-minimax-ai-provider` AI SDK package.
- [ ] Static `ModelDescriptor[]` bundled for MiniMax models.
- [ ] Latency tracking for MiniMax endpoints via AI SDK response metadata.

#### References
- `docs/adr/adr-054-ai-sdk-transport-layer.md`

---

### Issue: DC-LLP-011 — Kimi provider adapter enhancement

**GitHub**: #406 | **Sub-epic**: #391

#### Description
Enhance the existing Kimi provider adapter to support the new `ProviderAdapter` interface and reporting requirements. Transport via `@ai-sdk/moonshotai` (official AI SDK package); adapter supplies static `ModelDescriptor[]`.

#### Acceptance Criteria
- [ ] Kimi transport via `@ai-sdk/moonshotai` (thin OpenAI-compatible wrapper).
- [ ] Static `ModelDescriptor[]` bundled for Kimi models with capabilities and pricing.
- [ ] Kimi models correctly reported to the Picker registry.
- [ ] Support for Kimi-specific tool-calling flags.

#### References
- `docs/adr/adr-054-ai-sdk-transport-layer.md`

---

## Phase 3 — Persistence & Feedback (Sub-epic #392)

### Issue: DC-LLP-012 — SQLite migration: routing_decisions

**GitHub**: #407 | **Sub-epic**: #392

#### Description
Define and execute the SQLite migration for the `routing_decisions` table. This table stores every decision made by the Picker for audit and replay.

#### Acceptance Criteria
- [ ] Table schema supports JSON snapshots for requests and candidates.
- [ ] Indexes on `agent_role`, `model`, and `requested_at`.
- [ ] Migration script follows DiriCode SQLite conventions.

#### References
- `swarm-model-picker-plan.md` (lines 528-577: decisions table DDL)

#### Dependencies
- Depends on: DC-LLP-001

---

### Issue: DC-LLP-013 — SQLite migration: extend model_scores

**GitHub**: #408 | **Sub-epic**: #392

#### Description
Extend the `model_scores` table to support multi-dimensional metrics (quality, cost, speed, reasoning) and versioned quality heuristics.

#### Acceptance Criteria
- [ ] Schema updated to include `reasoning_score` and `speed_score`.
- [ ] Default values set to 50 for all heuristic dimensions.
- [ ] Support for tracking score evolution over time.

---

### Issue: DC-LLP-014 — Feedback ingestion and Elo update

**GitHub**: #409 | **Sub-epic**: #392

#### Description
Implement the execution feedback loop. This component receives metrics from the orchestrator after an LLM call completes and updates model scores accordingly. This merges Version B's execution feedback (DC-PICK-009) and adds REST/WS contracts for feedback ingestion.

#### Acceptance Criteria
- [ ] `POST /api/v1/decisions/:id/feedback` endpoint implemented.
- [ ] WebSocket feedback event handler active.
- [ ] Correlation between feedback and original decisions verified.
- [ ] Incremental Elo score updates based on success/failure and overrides.

#### References
- `swarm-model-picker-plan.md` (lines 294-327: feedback contract)

#### Dependencies
- Depends on: DC-LLP-012, DC-LLP-013

---

### Issue: DC-LLP-015 — Failure handling and fallback chain

**GitHub**: #410 | **Sub-epic**: #392

#### Description
Implement the robust failure handling logic and model fallback chains. If the preferred model selection fails, the Picker must provide a valid fallback based on policy constraints.

#### Acceptance Criteria
- [ ] `is_fallback` flag correctly set in response when primary choice is unavailable.
- [ ] Fallback chain resolution avoids infinite loops.
- [ ] Latency overhead for fallback resolution < 10ms.

---

## Phase 4 — ML Cascade (Sub-epic #393)

### Issue: DC-LLP-016 — ONNX Runtime setup + model download

**GitHub**: #411 | **Sub-epic**: #393

#### Description
Configure the ONNX Runtime for local ML execution and implement the automated model downloader for Tier 2 (BERT) and Tier 3 (TinyLLM) routers.

#### Acceptance Criteria
- [ ] ONNX Runtime initialized in the `@diricode/providers` package.
- [ ] Automated download and checksum verification for model files.
- [ ] Models loaded into memory efficiently with proper cleanup.

#### References
- `docs/adr/adr-049-llm-picker.md` (ML Cascade architecture)

---

### Issue: DC-LLP-017 — BERT/MiniLM classifier (Tier 2)

**GitHub**: #412 | **Sub-epic**: #393

#### Description
Implement the Tier 2 router using a BERT or MiniLM model. This tier performs semantic task classification to narrow down candidate models in under 100ms.

#### Acceptance Criteria
- [ ] Classification latency < 100ms.
- [ ] High accuracy on standard DiriCode task types (coding, research, planning).
- [ ] Graceful fallback to Heuristic tier on model failure.

---

### Issue: DC-LLP-018 — Tiny LLM router (Tier 3)

**GitHub**: #413 | **Sub-epic**: #393

#### Description
Implement the Tier 3 router using a TinyLLM (e.g., Qwen-0.5B or Phi-2) running via ONNX. This tier handles complex, multi-constraint reasoning in under 300ms.

#### Acceptance Criteria
- [ ] reasoning latency < 300ms.
- [ ] Supports complex constraint evaluation (cost vs. quality trade-offs).
- [ ] Deterministic output for identical inputs.

---

### Issue: DC-LLP-019 — Cascade orchestrator

**GitHub**: #414 | **Sub-epic**: #393

#### Description
Implement the core `LlmPicker` class that orchestrates the entire 3-tier cascade. This class wires Tier 1, Tier 2, and Tier 3 routers into a unified resolution flow.

#### Acceptance Criteria
- [ ] Implements the `ModelResolver` interface.
- [ ] Orchestrates fallbacks between tiers based on confidence scores.
- [ ] Aggregates `classification_trace` from all active tiers.
- [ ] End-to-end latency benchmarks meet performance targets.

#### Dependencies
- Depends on: DC-LLP-005, DC-LLP-017, DC-LLP-018

---

## Phase 5 — Dashboard UI (Sub-epic #394)

### Issue: DC-LLP-020 — Admin: SubscriptionList

**GitHub**: #415 | **Sub-epic**: #394

#### Description
Implement the Subscription List tab in the Admin panel. Displays active LLM provider subscriptions and their usage status.

#### Acceptance Criteria
- [ ] Displays provider name, plan type, and token limits.
- [ ] Real-time usage indicators.

---

### Issue: DC-LLP-021 — Admin: ModelCatalog

**GitHub**: #416 | **Sub-epic**: #394

#### Description
Implement the Model Catalog tab. Provides a searchable list of all registered models and their capabilities.

#### Acceptance Criteria
- [ ] Filter by provider, tier, and capability.
- [ ] View model pricing and heuristic scores.

---

### Issue: DC-LLP-022 — Admin: DecisionLog

**GitHub**: #417 | **Sub-epic**: #394

#### Description
Implement the Decision Log tab. This component merges Version B's decision replay feature (DC-PICK-004).

#### Acceptance Criteria
- [ ] Virtualized table of historical decisions.
- [ ] Inspection view showing full candidate scores and rejection reasons.
- [ ] "Replay Decision" action to re-run historical requests against current state.

#### References
- `swarm-model-picker-plan.md` (Epic 3, Epic 4)

---

### Issue: DC-LLP-023 — Admin: LineageGraph

**GitHub**: #418 | **Sub-epic**: #394

#### Description
Implement the Lineage Graph tab. This is the "Live Routing Map" from Version B, visualizing real-time flow from agents to models.

#### Acceptance Criteria
- [ ] Animated graph (React Flow) showing Agent → Policy → Model paths.
- [ ] Particle animations for live decisions.
- [ ] Color-coded edges for standard vs. fallback routes.

#### References
- `swarm-model-picker-plan.md` (Epic 2)

---

### Issue: DC-LLP-024 — Admin: CostDashboard

**GitHub**: #419 | **Sub-epic**: #394

#### Description
Implement the Cost Dashboard tab showing token usage and spend by agent and model.

#### Acceptance Criteria
- [ ] Time-series charts for spend.
- [ ] Breakdown by agent role and model family.

---

### Issue: DC-LLP-025 — Admin: EloRankings

**GitHub**: #420 | **Sub-epic**: #394

#### Description
Implement the Elo Rankings tab, displaying the relative performance quality of models based on execution feedback.

#### Acceptance Criteria
- [ ] Leaderboard of models by Elo score.
- [ ] Delta indicators showing recent ranking changes.

---

### Issue: DC-LLP-026 — Admin: RulesEditor

**GitHub**: #421 | **Sub-epic**: #394

#### Description
Implement the Rules Editor tab for managing heuristic routing rules and policies.

#### Acceptance Criteria
- [ ] Form for editing policy weights and hard filters.
- [ ] Preview mode showing how changes affect recent decisions.

---

### Issue: DC-LLP-028 — Admin: UserInstructionsEditor

**GitHub**: #423 | **Sub-epic**: #394

#### Description
Implement the User Instructions Editor for fine-tuning how specific agent roles should prioritize models.

#### Acceptance Criteria
- [ ] Text area for agent-specific routing hints.
- [ ] Persistence to the `policies` table metadata.

---

### Issue: DC-LLP-029 — WebSocket telemetry and live events

**Sub-epic**: #394 (New)

#### Description
Implement the WebSocket event bus for real-time Picker telemetry. This powers the live animations in the dashboard (from Version B's DC-PICK-005).

Events:
- `picker.stats`: Global metrics (D/s, latency, fallbacks).
- `picker.decision.live`: Summary of each decision for the stream.
- `picker.error`: Internal error alerts.
- `picker.graph.edge`: Path data for the lineage graph.

#### Acceptance Criteria
- [ ] WebSocket server emits `picker.*` events.
- [ ] In-memory ring buffer for 300s of history for stats computation.
- [ ] Event payloads validated with Zod.

#### References
- `swarm-model-picker-plan.md` (Section 4: Internal Events)

---

### Issue: DC-LLP-030 — Mock data engine for development

**Sub-epic**: #394 (New)

#### Description
Build a mock data generator to simulate a live swarm, enabling dashboard development without a running agent system (from Version B's DC-PICK-008).

#### Acceptance Criteria
- [ ] Generator produces realistic `picker.*` events.
- [ ] Supports disturbance modes (fallback spikes, outages).
- [ ] Configurable event frequency.

#### References
- `swarm-model-picker-plan.md` (Epic 5)

---

### Issue: DC-LLP-031 — Integration with existing routing stack

**Sub-epic**: #394 (New)

#### Description
Wire the LLM Picker into the DiriCode routing stack (from Version B's DC-PICK-007).

Integration points:
- `ModelTierResolver`: Replaces static resolution.
- `SubscriptionRouter`: Consumes Picker output to select best subscription.
- `ABExperimentManager`: Adjusts weights for active experiments.

#### Acceptance Criteria
- [ ] Agent requests route through Picker with <50ms overhead.
- [ ] Graceful degradation to legacy resolver on failure.
- [ ] Integration tests for full agent-to-provider path.

---

## Phase 6 — Optimization (Sub-epic #395)

### Issue: DC-LLP-027 — Auto re-training pipeline

**GitHub**: #422 | **Sub-epic**: #395

#### Description
Implement the automated pipeline for re-training Tier 2 and Tier 3 models based on collected decision and feedback data.

#### Acceptance Criteria
- [ ] Automated extraction of training pairs from SQLite.
- [ ] Pipeline produces updated ONNX model files.

---

### Issue: DC-LLP-032 — Auto-policy tuning from feedback data

**Sub-epic**: #395 (New)

#### Description
Implement statistical analysis of feedback data to automatically suggest or apply policy weight adjustments (from Version B's DC-PICK-010).

#### Acceptance Criteria
- [ ] Analytical engine identifies sub-optimal weight configurations.
- [ ] Suggests improvements in the Rules Editor UI.

---

### Issue: DC-LLP-033 — Historical analytics dashboard

**Sub-epic**: #395 (New)

#### Description
Add time-series visualizations for long-term trends in model efficiency, cost, and quality (from Version B's DC-PICK-011).

#### Acceptance Criteria
- [ ] Multi-day trend charts for cost efficiency.
- [ ] Policy effectiveness comparison views.

---

## Must NOT

- Must NOT skip ONNX/ML tiers — they are non-negotiable for the cascade.
- Must NOT separate dashboard into multiple panels — must be one panel with tabs.
- Must NOT make LLM API calls from the Picker — it is a decision engine only.
- Must NOT handle streaming, retries, or provider failures — those remain with the AI SDK transport layer (ADR-025/ADR-054) and SubscriptionRouter (ADR-042).
- Must NOT store conversation content or agent outputs — only decision metadata and metrics.

---

## Dependencies

### Upstream / External
- Vercel AI SDK provider packages (`@ai-sdk/*`) for LLM transport (ADR-054); Phase 2 adapters wrap these.
- Static Model Cards (`ModelDescriptor[]`) bundled per provider for metadata AI SDK doesn't expose.
- Existing model registry data (provider capabilities, pricing) for seed data.
- WebSocket infrastructure coexisting with SSE (ADR-001).
- React Flow library for LineageGraph visualization.
- `@tanstack/react-virtual` for virtualized request stream.
- ONNX Runtime for Tier 2/3 classification.

### Cross-epic
- **epic-router**: Picker feeds recommendations into the AI SDK transport + retry/fallback pipeline (ADR-054, ADR-025).
- **epic-memory**: Picker uses SQLite repositories for persistence.
- **epic-observability**: Picker emits events through the EventStream.
- **epic-agents-core**: Agent requests flow through the Picker resolver.

---

## Delivery sequencing

1. **Phase 1: Foundation** (DC-LLP-001 to 007) — Schema, types, and Heuristic router.
2. **Phase 2: Providers** (DC-LLP-008 to 011) — Connect external model data.
3. **Phase 3: Persistence** (DC-LLP-012 to 015) — Logging and feedback loop.
4. **Phase 4: ML Cascade** (DC-LLP-016 to 019) — ONNX integration and Tier 2/3 routers.
5. **Phase 5: Dashboard** (DC-LLP-020 to 026, 028 to 031) — Unified admin UI and system integration.
6. **Phase 6: Optimization** (DC-LLP-027, 032, 033) — Auto-tuning and historical analytics.

MVP-2 exit requires: Phases 1 through 5 operational with 3-tier cascade and dashboard.
v2 exit requires: Phase 6 active with auto-tuning and deep analytics.
