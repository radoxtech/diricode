## ADR-049 — LLM Picker

| Field       | Value                                                                                          |
|-------------|------------------------------------------------------------------------------------------------|
| Status      | Accepted                                                                                       |
| Date        | 2026-03-28                                                                                     |
| Scope       | MVP-2 (core engine + telemetry), v2 (feedback + ML classifiers + Elo integration)              |
| References  | ADR-004, ADR-005, ADR-006, ADR-025, ADR-042, ADR-044, ADR-046                                  |

### Context

DiriCode's model routing has progressed from simple fallback chains to multi-subscription management. However, as the system moves toward swarm coordination (ADR-046), several critical gaps have emerged:

1.  **No unified decision point.** Model selection is currently fragmented across static tier resolvers. There is no central engine to weigh quality, cost, and latency dynamically.
2.  **No decision explainability.** The system lacks a record of why a specific model was chosen over others, making it difficult to debug or optimize routing.
3.  **No policy system.** Different tasks (e.g., architectural planning vs. bulk refactoring) require different routing strategies that can't be easily toggled.
4.  **Inflexible classification.** Static rules can't accurately categorize the complexity of diverse coding tasks, leading to either over-provisioning (wasted cost) or under-provisioning (poor quality).

To address these, the **LLM Picker** provides a hybrid decision engine. It combines a high-performance **3-tier ML cascade** for task classification with a **weighted policy scoring** system for final model selection.

Industry references like RouteLLM (classifier-based), Martian (capability-matching), and LiteLLM (strategy-based) inform this design. DiriCode's Picker is a hybrid that integrates these approaches into a single, observable, local-first component.

### Decision

Introduce the **LLM Picker** as the central intelligence for model selection. It sits between the agent dispatcher and the SubscriptionRouter, acting as a "brain" that picks the right tool for the job.

#### 1. Picker as Decision Engine

The Picker is a pure decision engine. It selects models but does not execute LLM calls. The caller (e.g., a specialist agent) sends a request to the Picker, receives a recommendation, and then uses the SubscriptionRouter (ADR-042) to perform the actual network call.

#### 2. Hybrid Architecture: 3-Tier Cascade + Policy Scoring

The Picker uses a hierarchical cascade to classify tasks with increasing depth, short-circuiting as soon as high confidence is reached.

**The Cascade Flow:**

1.  **Tier 1: Heuristic Rules (<5ms)**
    *   Regex and rule-based engine for obvious cases.
    *   Rules are loaded from `.dc/llm-picker-rules.jsonc` and validated with Zod.
    *   If confidence ≥ threshold, it outputs the classification and skips remaining tiers.
2.  **Tier 2: BERT/MiniLM Classifier (<100ms)**
    *   Runs via **ONNX Runtime** (`onnxruntime-node`).
    *   Classifies task complexity (simple/moderate/complex/expert).
    *   If confidence ≥ 0.80, short-circuits.
3.  **Tier 3: TinyLLM (Qwen2.5-0.5B INT4) (<300ms)**
    *   Runs via **ONNX Runtime**.
    *   Produces structured JSON output for deep task analysis.
    *   Only invoked if Tier 1 and Tier 2 are ambiguous.

**Post-Classification Flow:**

*   **Task Classification**: Complexity is mapped to simple, moderate, complex, or expert.
*   **Policy Resolution**: Matches `task_type` and `agent_role` to the best policy.
*   **Weighted Scoring**: Calculates a score for each candidate based on quality, cost, latency, and capability.
*   **Ranked Candidates**: Returns the winner with a trace of the decision process.

#### 3. Integration of Model Dimensions

The Picker respects and utilizes dimensions defined in previous ADRs:

*   **Tiers (ADR-004)**: Maps legacy `AgentTier` to `tier:heavy`, `tier:medium`, `tier:low` tags.
*   **Families (ADR-005)**: Filters by `family:coding`, `family:reasoning`, or `family:creative`.
*   **Fallback Types (ADR-006)**: Includes `largeContext`, `largeOutput`, `error`, and `strong` candidates in the response.
*   **Tags (ADR-004)**: Uses the 7 core tags (orchestration, planning, coding, quality, research, creative, utility) for policy matching.
*   **Elo Scoring (ADR-044)**: Augments static quality scores using Bradley-Terry models (v2).

#### 4. Decision Request Contract

The orchestrator sends a structured request to the Picker.

```jsonc
{
  "request_id": "pick_a8f3c",
  "agent": { "id": "coder_1", "role": "coder" },
  "task": { "type": "refactor", "description": "Update imports" },
  "model_dimensions": {
    "tier": "medium",
    "family": "coding",
    "tags": ["coding", "quality"],
    "fallback_type": null // null, or "largeContext"/"error"/etc
  },
  "constraints": { "max_cost_usd": 0.05 }
}
```

#### 5. Decision Response Contract

The Picker returns the selection along with a classification trace for explainability.

```jsonc
{
  "status": "resolved",
  "selected": { "provider": "openai", "model": "gpt-4o-mini", "score": 95 },
  "decision_meta": {
    "policy_used": "balanced",
    "classification_trace": {
      "tier_used": 2,
      "confidence": 0.88,
      "classification": "moderate",
      "latency_ms": 85
    }
  }
}
```

#### 6. Policy System & Scoring Algorithm

Policies define how candidates are weighted. A standard scoring formula is used:
`score = (w_quality × quality) + (w_cost × cost) + (w_latency × latency) + (w_capability × capability)`

*   **quality**: Static rating + Elo (ADR-044).
*   **cost/latency**: Inverse relative to the cheapest/fastest candidate.
*   **capability**: Binary filter (100 or 0) for required features (e.g., tool calling).

#### 6b. Policy Resolution Order

Policy resolution follows a 5-step priority:
1. `policy_override` from request (if specified)
2. Policy matching both `agent_role` AND `task_type` (most specific wins)
3. Policy matching `agent_role` only
4. Policy matching `task_type` only
5. Default policy (`is_default = true`)

Example policies:

| Policy | Quality | Cost | Latency | Capability | Use Case |
|--------|---------|------|---------|------------|----------|
| `quality_first` | 0.5 | 0.1 | 0.2 | 0.2 | Architectural planning, complex reasoning |
| `cost_optimized` | 0.2 | 0.5 | 0.1 | 0.2 | Bulk refactoring, utility tasks |
| `speed_first` | 0.1 | 0.1 | 0.6 | 0.2 | Quick lookups, trivial tasks |
| `balanced` | 0.3 | 0.3 | 0.2 | 0.2 | Default for most agents |

#### 7. ProviderAdapter Interface

Adapters normalize different providers for the Picker:

```typescript
interface ProviderAdapter {
  readonly providerId: string;
  listModels(): Promise<ModelDescriptor[]>;
  getHealth(): Promise<ProviderHealth>;
  getRateLimitState(): Promise<RateLimitState>;
}
```
Initial implementations: GitHub Copilot, z.ai, MiniMax, Kimi.

#### 8. ONNX Runtime Setup

The ML cascade is powered by `onnxruntime-node`.
*   Models (BERT, Qwen2.5) are downloaded with hash verification to `.dc/picker-models/`.
*   If ONNX is unavailable, the Picker gracefully degrades to Tier 1 (heuristics) only.

#### 8b. Decision Logging and Telemetry

Every decision is persisted to SQLite with:
- Full request payload (agent, task, constraints)
- Full candidate ranking with scores and rejection reasons
- Selected model and policy used
- Selection latency and classification trace
- Fallback flag and reason

WebSocket events for dashboard:
- `picker.stats` (1/s) — aggregated metrics
- `picker.decision.live` (per-decision) — for request stream
- `picker.error` — for error log
- `picker.graph.edge` — for live routing map animation

#### 8c. Execution Feedback Loop (v2)

After execution, the orchestrator can send feedback:
- Actual token counts and cost
- Actual latency and TTFT
- Success/failure and finish reason
- Override tracking (was_overridden, override_model, override_reason)

Feeds into: model quality heuristics, ADR-044 Elo scoring, override pattern analysis.

#### 9. Dashboard UI

A unified dashboard with multiple tabs provides deep visibility:
1. **Live Routing Map** — animated React Flow graph showing decision paths.
2. **Request Stream** — virtualized scrolling table (`@tanstack/react-virtual`) for real-time monitoring.
3. **Decision Inspector** — click a row to see winner, runner-ups, rejection reasons, and replay the decision.
4. **Error Log** — separated view for Picker-internal errors and warnings.
5. **Subscription List** — health badges, rate limit bars, and cooldown countdowns.
6. **Model Catalog** — all available models, filterable by tags, pricing, and context window.
7. **Cost Dashboard** — spend per subscription/model with Recharts trend charts.
8. **Elo Rankings** — ranking table per task_type with Elo trend sparklines.
9. **Rules Editor** — UI to create, edit, and reorder Tier 1 rules with drag-and-drop and Zod validation.
10. **User Instructions** — editor for natural language routing preferences and the parsing pipeline.

#### 10. SQLite Schema

Persistent storage uses 6 tables: `models`, `policies`, `decisions`, `execution_feedback`, `picker_errors`, and `agents_registry`. The `models` table includes columns for `tier`, `family`, and `tags` to support advanced filtering.

#### 11. REST + WebSocket API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/decisions` | Synchronous decision request |
| GET | `/api/v1/decisions` | List decisions (paginated, filterable) |
| GET | `/api/v1/decisions/:id` | Single decision details |
| POST | `/api/v1/decisions/:id/replay` | Replay decision with current state |
| POST | `/api/v1/decisions/:id/feedback` | Submit execution feedback |
| GET | `/api/v1/models` | Model registry |
| GET/PUT | `/api/v1/policies` / `/:id` | Policy CRUD |
| GET | `/api/v1/agents/:id/stats` | Agent decision statistics |
| GET | `/api/v1/stats` | Aggregated metrics |
| WS | `/ws` | Live telemetry events |

#### 12. Integration Points

| Existing Component | Integration |
|-------------------|-------------|
| ModelTierResolver (packages/core) | Picker replaces static tier resolution. TierResolver becomes fallback when Picker unavailable. |
| SubscriptionRouter (ADR-042) | Picker outputs { provider, model } for subscription selection. |
| ABExperimentManager (ADR-044) | Picker checks A/B experiment filters and adjusts candidate weights. |
| ModelScoreRepository (packages/memory) | Picker reads Elo scores to augment quality ratings (v2). |
| EventStream (ADR-031) | Picker emits typed events for dashboard. |
| Swarm Coordinator (ADR-046) | Each swarm member's request goes through Picker independently. |

### Consequences

**Positive:**
*   **Unified Decision Point**: Replaces fragmented logic with a central, policy-driven engine.
*   **Explainability**: Every routing choice is logged with a trace and reasoning.
*   **Intelligent Classification**: ML cascade ensures tasks get the right model tier without manual tuning.
*   **Observable**: Real-time dashboard for cost, performance, and routing health.

**Negative:**
*   **Dependency**: Requires ONNX binaries (`onnxruntime-node`).
*   **Latency**: Adds 5ms to 300ms overhead depending on the cascade depth reached.
*   **Complexity**: Increases the configuration surface area.
*   **Registry staleness**: Model pricing changes. Initially static config, later provider API auto-detection.
*   **Feedback dependency**: Quality heuristics degrade without reliable orchestrator feedback.
*   **Dashboard as additional surface**: Integrated as tabs within the main Web UI panel.

### Delivery Sequencing

| Phase | Scope | Deliverables |
|-------|-------|-------------|
| Phase 1 | Foundation | ModelResolver, Tier 1 Heuristics, Tag classification, Scorer |
| Phase 2 | Providers | ProviderAdapter interface + GitHub/z.ai/MiniMax/Kimi adapters |
| Phase 3 | Persistence | SQLite migrations, feedback ingestion, Elo integration |
| Phase 4 | ML Cascade | ONNX setup, Tier 2 (BERT), Tier 3 (TinyLLM), Orchestrator |
| Phase 5 | Dashboard | All UI tabs (Map, Logs, Rules, Analytics) |
| Phase 6 | Optimization | Auto-training pipeline, historical analytics |

### Addendum — Vercel AI SDK as Transport Layer (2026-04-01)

ADR-054 establishes Vercel AI SDK (`@ai-sdk/*`) as the LLM transport layer for DiriCode. This has specific implications for the Picker's provider interface:

**What changes:**
- The `ProviderAdapter` interface (Section 7) no longer needs to handle raw HTTP transport to LLM APIs. All `generateText()` / `streamText()` calls go through AI SDK provider packages (`@ai-sdk/github`, `@ai-sdk/moonshotai`, `@ai-sdk/google`, etc.).
- Provider adapters become **metadata + health reporters** rather than transport wrappers. Their primary job is to supply static **Model Cards** (`ModelDescriptor[]`) — metadata AI SDK does not expose (context window, max output, capabilities, pricing tier, tool-call support).
- Post-call data from AI SDK (`usage.inputTokens`, `usage.outputTokens.reasoning`, `response.headers` for rate-limit extraction) feeds into the Picker's feedback loop and subscription health tracking.

**What does NOT change:**
- The Picker remains a pure **decision engine** — it never makes LLM API calls.
- The 3-tier ML cascade, policy scoring, candidate ranking, and explainability trace are unaffected.
- The `ModelResolver` interface, `DecisionRequest`/`DecisionResponse` contracts, and SQLite persistence are unaffected.
- All 6 delivery phases remain valid.

**Two-registry architecture:**
```
Model Card Registry (ours)     →  "should I pick this model?" (Picker decision)
AI SDK Provider Registry       →  "can I call this model?" (transport execution)
```

See `docs/adr/adr-054-ai-sdk-transport-layer.md` for the full AI SDK adoption decision.
