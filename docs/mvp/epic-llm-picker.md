# Epic: LLM Picker (@diricode/core + @diricode/providers + @diricode/web)

## Summary

LLM Picker is the advanced routing engine for DiriCode, transitioning from static model tiering to dynamic, context-aware model selection. It implements a multi-tier routing cascade (Heuristic → BERT → Tiny LLM) with Elo-based candidate scoring, provider health integration, and a feedback-driven optimization loop.

Scope spans **Phase 1 to Phase 6**:
- **Foundation**: Core interfaces, legacy adapter, and heuristic-based Tier 1 router.
- **Provider Adapters**: Extending existing and adding new providers (z.ai, MiniMax, Kimi).
- **Feedback Loop**: SQLite-backed decision logging, Elo updates, and cooldown management.
- **ML Tiers**: Local ONNX-based classification (BERT) and tiny LLM routing (Qwen).
- **Admin & UI**: Comprehensive web visibility into subscriptions, models, and routing lineage.
- **Auto-Retraining**: Automated pipeline for keeping local models sharp based on user feedback.

Primary reference: `docs/adr/adr-049-llm-picker.md`.

---

## Issue: DC-LLP-001 — ModelResolver interface + types

### Description
Define the core architectural contract for model resolution in `@diricode/core`. This interface will be shared by both the legacy tier-based router and the new LLM Picker engine.
- Create `packages/core/src/llm-picker/types.ts` containing:
  - `ModelResolver`: The primary execution interface.
  - `ModelRequest`: Input containing agent metadata, task description, and context hints.
  - `ModelResolution`: The selection result including the chosen model and confidence.
  - `DecisionTrace`: Detailed lineage of how a decision was reached.
  - `ModelDescriptor`, `RoutingRule`, `FallbackCandidate`: Supporting types for the registry and rule engine.
- Create `packages/core/src/llm-picker/index.ts` for barrel exports.

### Acceptance Criteria
- All interfaces from ADR-049 section 1 are present and correctly typed.
- Types are exported via the package entry point.
- Zero external dependencies in the types file (pure structural definitions).

### References
- `docs/adr/adr-049-llm-picker.md` (Section 1)

### Dependencies
- Depends on: none
- Required by: DC-LLP-002, DC-LLP-003, DC-LLP-005, DC-LLP-019

---

## Issue: DC-LLP-002 — Legacy ModelTierResolver adapter

### Description
Ensure backward compatibility by wrapping the existing `ModelTierResolver` to implement the new `ModelResolver` interface.
- Create `packages/core/src/agents/model-resolver-adapter.ts`.
- Implementation:
  - Receives `ModelRequest`.
  - Maps request to existing tier logic.
  - Returns `ModelResolution` with `reason: "legacy"`, `confidence: 1.0`.
  - Populates a minimal `DecisionTrace` to satisfy the interface.
- **Must NOT** modify the original `ModelTierResolver` code.

### Acceptance Criteria
- Adapter correctly satisfies the `ModelResolver` interface.
- Legacy routing behavior remains identical when accessed through the adapter.
- Unit tests verify the mapping from `ModelRequest` to legacy tier results.

### References
- `docs/adr/adr-049-llm-picker.md`
- `docs/adr/adr-004-agent-roster-3-tiers.md`

### Dependencies
- Depends on: DC-LLP-001
- Required by: DC-LLP-003

---

## Issue: DC-LLP-003 — Feature flag and resolver factory

### Description
Implement the orchestration logic to switch between legacy and new routing engines.
- Extend config schema to support `routing.engine`: `"legacy" | "llm-picker" | "split"`.
- Add `routing.splitPercent` (0-100) for A/B testing.
- Implement a factory function that:
  - Returns `ModelResolverAdapter` if `"legacy"`.
  - Returns `LlmPicker` if `"llm-picker"`.
  - Implements a random weighted split if `"split"`.
- Default behavior must remain `"legacy"`.

### Acceptance Criteria
- Config validation (Zod) rejects invalid engine names or out-of-range split percentages.
- Factory correctly instantiates the requested implementation.
- Split mode distribution matches configured percentage over 1000 test iterations.

### References
- `docs/adr/adr-049-llm-picker.md`
- `docs/adr/adr-044-elo-scoring-ab-testing.md`

### Dependencies
- Depends on: DC-LLP-001, DC-LLP-002
- Required by: DC-LLP-019

---

## Issue: DC-LLP-004 — Routing rules schema and loader

### Description
Implement the infrastructure for heuristic-based routing rules.
- Define Zod schema for `RoutingRule` array.
- Create JSONC loader for `.dc/llm-picker-rules.jsonc`.
- Implement a file watcher for hot-reloading rules without restarting the process.
- Provide a default rules file with sensible initial rules (e.g., small tasks to gpt-4o-mini).

### Acceptance Criteria
- Rules file correctly handles comments via JSONC parsing.
- Invalid rules trigger descriptive validation errors.
- Changes to the rules file are detected and reflected in the live engine within 1 second.
- Unit tests cover schema validation, loading, and hot-reload events.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 2)

### Dependencies
- Depends on: DC-LLP-001
- Required by: DC-LLP-005

---

## Issue: DC-LLP-005 — Heuristic router (Tier 1)

### Description
Implement the rule evaluation engine (Tier 1 of the cascade).
- Implement the evaluation logic from ADR-049 Section 2.
- Support matching on:
  - `agents`: List of agent IDs.
  - `taskTypes`: Glob patterns.
  - `tags`: Boolean logic (AND, OR, NOT with `!` prefix).
  - `context`: Token range checks.
- Handle priority ordering (0-9 are emergency rules, evaluated first).
- Return `ModelResolution` with confidence and populated trace.

### Acceptance Criteria
- Emergency rules (priority < 10) always take precedence.
- Tag negation (e.g., `!heavy`) works as expected.
- Multiple matching rules result in the highest priority rule being selected.
- Unit tests verify all condition types and priority ordering.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 2)

### Dependencies
- Depends on: DC-LLP-001, DC-LLP-004
- Required by: DC-LLP-019

---

## Issue: DC-LLP-006 — Tag-based model classification

### Description
Move away from hardcoded tiers to a flexible, tag-based model catalog.
- Implement `ModelDescriptor` with tags (e.g., `tier:pro`, `family:claude`) and attributes.
- Create model catalog loader from `.dc/model-catalog.jsonc`.
- Implement backward compatibility mapping:
  - `AgentTier` → `tier:*` tags.
  - `ModelFamily` → `family:*` tags.
- Populate default catalog with GitHub Copilot models (auto-mapped from existing `GITHUB_MODELS`).

### Acceptance Criteria
- Catalog loader supports JSONC and validates against `ModelDescriptor` schema.
- Legacy tier/family requests correctly resolve to tagged models.
- Tag matching supports boolean logic (AND, OR, NOT).

### References
- `docs/adr/adr-049-llm-picker.md`
- `docs/adr/adr-005-families-model-agent-skill-grouping.md`

### Dependencies
- Depends on: DC-LLP-001
- Required by: DC-LLP-007

---

## Issue: DC-LLP-007 — Candidate scorer

### Description
Implement the multi-dimensional scoring engine for selecting the best model candidate.
- Create `scorer.ts` to evaluate candidates based on:
  - `cost_score`: Normalized pricing.
  - `quality_score`: Baseline model capability.
  - `elo_score`: Dynamic performance score from feedback.
  - `availability_score`: Current provider health/rate-limit state.
- Scoring weights must be configurable.
- Integrate with `SubscriptionHealth` to penalize/eliminate unhealthy providers.

### Acceptance Criteria
- Scorer returns a ranked list of candidates with score breakdowns.
- Models from providers currently in cooldown are correctly eliminated.
- Weights are applied correctly to the final aggregate score.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 3)
- `docs/adr/adr-044-elo-scoring-ab-testing.md`
- `docs/adr/adr-042-multi-subscription-management.md`

### Dependencies
- Depends on: DC-LLP-006
- Required by: DC-LLP-015, DC-LLP-019

---

## Issue: DC-LLP-008 — ProviderAdapter interface and GitHub adapter extension

### Description
Standardize how providers expose metadata to the picker.
- Define `ProviderAdapter` interface: `listModels()`, `getHealth()`, `getRateLimitState()`.
- Extend the existing GitHub Copilot adapter to implement this interface.
- Use GitHub Models API for auto-detection of available models and tags.
- Provide a fallback mechanism to `model-catalog.jsonc` for missing attributes.

### Acceptance Criteria
- GitHub adapter correctly reports its model list and health state.
- API-detected models are merged with catalog-defined metadata.
- Rate limit state is accurately reflected in the adapter output.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 4)
- `docs/adr/adr-042-multi-subscription-management.md`

### Dependencies
- Depends on: DC-LLP-001
- Required by: DC-LLP-009, DC-LLP-010, DC-LLP-011

---

## Issue: DC-LLP-009 — z.ai provider adapter

### Description
Add support for the z.ai provider.
- Create new provider adapter at `packages/providers/src/zai/`.
- Implement `ProviderAdapter` interface.
- Use `DC_ZAI_*` environment variables for authentication.
- Implement error mapping to ensure compatibility with the existing error classifier.

### Acceptance Criteria
- Adapter successfully lists models from z.ai.
- Health checks return appropriate status based on API responsiveness.
- Rate limit headers are correctly parsed into the shared state.

### References
- `docs/adr/adr-049-llm-picker.md`
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`

### Dependencies
- Depends on: DC-LLP-008

---

## Issue: DC-LLP-010 — MiniMax AI provider adapter

### Description
Add support for the MiniMax AI provider.
- Create new provider adapter at `packages/providers/src/minimax/`.
- Implement `ProviderAdapter` interface.
- Use `DC_MINIMAX_*` environment variables for authentication.
- Ensure model capabilities are correctly tagged in the catalog.

### Acceptance Criteria
- Adapter successfully authenticates and communicates with MiniMax API.
- Error payloads are correctly translated into the system's unified error format.

### References
- `docs/adr/adr-049-llm-picker.md`

### Dependencies
- Depends on: DC-LLP-008

---

## Issue: DC-LLP-011 — Kimi provider adapter enhancement

### Description
Upgrade the existing Kimi adapter to support the new LLM Picker requirements.
- Extend Kimi adapter to implement `ProviderAdapter`.
- Add `listModels()`, `getHealth()`, and `getRateLimitState()`.
- Ensure Kimi-specific error patterns are correctly handled by the classifier.

### Acceptance Criteria
- Kimi adapter provides the same level of metadata as newer adapters.
- Integration with the provider registry remains stable.

### References
- `docs/adr/adr-049-llm-picker.md`
- `epic-router.md` (DC-PROV-007)

### Dependencies
- Depends on: DC-LLP-008

---

## Issue: DC-LLP-012 — SQLite migration: routing_decisions table

### Description
Implement persistent storage for routing lineage and feedback.
- Create migration `0012_routing_decisions.sql`.
- Table columns: `request_id`, `session_id`, `timestamp`, `request_json`, `trace_json`, `feedback_json`.
- Implement `RoutingDecisionRepository` with methods for:
  - `insert`: Storing a new decision.
  - `findByRequestId`: Retrieval for feedback linking.
  - `listRecent`: For admin panel display.
- Add indexes on `session_id` and `timestamp`.

### Acceptance Criteria
- Migration applies cleanly to SQLite.
- Repository methods correctly handle JSON serialization/deserialization.
- Queries are performant under load (indexed lookups).

### References
- `docs/adr/adr-049-llm-picker.md` (Section 5)
- `docs/adr/adr-048-sqlite-issue-system.md`

### Dependencies
- Depends on: none
- Required by: DC-LLP-014, DC-LLP-022

---

## Issue: DC-LLP-013 — SQLite migration: extend model_scores

### Description
Extend the model scoring table to support more granular Elo tracking.
- Create migration `0013_extend_model_scores.sql`.
- Add `subscription` and `task_type` columns to `model_scores`.
- Update `ModelScoreRepository` to support queries filtered by these new columns.
- Ensure backward compatibility for existing simple model lookups.

### Acceptance Criteria
- Migration succeeds and preserves existing Elo data.
- Repository correctly updates the specific tuple (model, subscription, task_type).

### References
- `docs/adr/adr-049-llm-picker.md`
- `docs/adr/adr-044-elo-scoring-ab-testing.md`

### Dependencies
- Depends on: none
- Required by: DC-LLP-014, DC-LLP-025

---

## Issue: DC-LLP-014 — Feedback ingestion and Elo update

### Description
Implement the logic to close the loop between user feedback and model scoring.
- Create `feedback.ts` as a `FeedbackEvent` handler.
- Logic:
  - Locate `routing_decision` via `requestId`.
  - Update `feedback_json` in the database.
  - Recalculate and update Elo scores for the (model, subscription, task_type) tuple.
  - Manage provider cooldowns based on failure feedback or rate limit headers.

### Acceptance Criteria
- Feedback is correctly associated with the original routing decision.
- Elo updates follow the ADR-044 mathematical model.
- Cooldowns are persisted and respected by the scorer in subsequent requests.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 5)
- `docs/adr/adr-044-elo-scoring-ab-testing.md`

### Dependencies
- Depends on: DC-LLP-012, DC-LLP-013
- Required by: DC-LLP-027

---

## Issue: DC-LLP-015 — Failure handling and fallback chain

### Description
Implement the resilient fallback execution logic.
- Implement the fallback chain from ADR-049 Section 6.
- Rules:
  - If a model fails, skip to the next candidate (do not retry same model).
  - If rate limited, set cooldown for that subscription and skip.
  - If all candidates are exhausted, trigger emergency fallback rules.
  - If no models remain, return a structured error with the full decision trace.
- Integrate with the existing `RouterError` classifier.

### Acceptance Criteria
- Fallback chain continues until a success or absolute exhaustion.
- Cooldowns are triggered immediately upon 429 errors.
- The final error contains a complete log of all failed attempts.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 6)
- `docs/adr/adr-025-native-ts-router-fallback-chain.md`

### Dependencies
- Depends on: DC-LLP-007, DC-LLP-014
- Required by: DC-LLP-019

---

## Issue: DC-LLP-016 — ONNX Runtime setup and model download script

### Description
Prepare the environment for local ML inference.
- Add `onnxruntime-node` dependency to `@diricode/core`.
- Create a setup script `pnpm run llm-picker:setup`.
- Logic:
  - Download BERT (classifier) and Qwen2.5-0.5B (tiny LLM) ONNX models.
  - Verify downloads against a committed manifest of hashes.
  - Store models in `packages/core/src/llm-picker/models/` (gitignored).
- Add `.gitkeep` to the models directory.

### Acceptance Criteria
- Script correctly handles partial downloads and resumes.
- Hash verification prevents use of corrupted or malicious models.
- Environment is ready for `onnxruntime-node` execution.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 7)

### Dependencies
- Depends on: none
- Required by: DC-LLP-017, DC-LLP-018

---

## Issue: DC-LLP-017 — BERT/MiniLM classifier (Tier 2)

### Description
Implement the secondary classification tier using local BERT.
- Create `bert-classifier.ts` to run ONNX inference.
- Logic:
  - Tokenize task description + agent metadata.
  - Classify into: `simple`, `moderate`, `complex`, `expert`.
  - Use a softmax threshold (default 0.80) to decide whether to stop the cascade.
  - Gracefully skip if models are missing or if CPU load is too high.
- Performance target: < 100ms.

### Acceptance Criteria
- Classifier produces consistent labels for known benchmark tasks.
- Cascade short-circuits correctly when confidence is high.
- Inference stays within the 100ms budget on standard CPU.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 7)

### Dependencies
- Depends on: DC-LLP-016
- Required by: DC-LLP-019

---

## Issue: DC-LLP-018 — Tiny LLM router (Tier 3)

### Description
Implement the final classification tier using a local tiny LLM.
- Create `tiny-llm-router.ts` using Qwen2.5-0.5B-Instruct.
- Logic:
  - Construct a structured prompt with routing rubrics (complexity, context, latency).
  - Run inference via ONNX Runtime (INT4 quantized).
  - Parse JSON output for model recommendation and reasoning.
  - Fall back to Tier 1 result if inference fails or model is missing.
- Performance target: < 300ms.

### Acceptance Criteria
- Router successfully parses model recommendations from LLM output.
- Reasoning is captured and stored in the `DecisionTrace`.
- Inference completes within the 300ms budget.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 7)

### Dependencies
- Depends on: DC-LLP-016
- Required by: DC-LLP-019

---

## Issue: DC-LLP-019 — Cascade orchestrator

### Description
Wire the multi-tier cascade into the final `LlmPicker` engine.
- Implement the `LlmPicker` class.
- Orchestration flow:
  - Run Tier 1 (Heuristics).
  - If low confidence, run Tier 2 (BERT).
  - If Tiers disagree or confidence remains low, run Tier 3 (Tiny LLM).
- Ensure `DecisionTrace` is accurately populated at every step.
- Implement latency tracking for each tier.

### Acceptance Criteria
- Orchestrator follows the confidence-based short-circuit logic.
- Final selection integrates with the `CandidateScorer` for provider selection.
- All routing events are logged to the database via the repository.

### References
- `docs/adr/adr-049-llm-picker.md`
- `docs/adr/adr-002-dispatcher-first-agent-architecture.md`

### Dependencies
- Depends on: DC-LLP-003, DC-LLP-005, DC-LLP-007, DC-LLP-015, DC-LLP-017, DC-LLP-018
- Required by: Main agent execution loop

---

## Issue: DC-LLP-020 — Admin panel: SubscriptionList component

### Description
Build the UI for managing LLM subscriptions in `@diricode/web`.
- Create `SubscriptionList.tsx`.
- Features:
  - Table of all providers/subscriptions.
  - Active/Inactive toggles.
  - Health status badges (Green/Yellow/Red).
  - Rate limit bars and cooldown countdowns.
- Implement API endpoint for fetching live subscription data.

### Acceptance Criteria
- UI reflects real-time status from the core engine.
- Toggling a subscription immediately affects the router's candidate pool.
- Cooldown countdowns update without page refresh (SSE or polling).

### References
- `docs/adr/adr-042-multi-subscription-management.md`

### Dependencies
- Depends on: DC-LLP-008
- Required by: Admin dashboard parity

---

## Issue: DC-LLP-021 — Admin panel: ModelCatalog component

### Description
Create a visibility layer for the model registry.
- Display all available models with their tags, context windows, and pricing.
- Support filtering by provider, family, and capability tags.
- Distinguish between auto-detected models (API) and manual overrides (JSONC).

### Acceptance Criteria
- Catalog accurately represents the `model-catalog.jsonc` and dynamic provider lists.
- Filtering is responsive and accurate.

### References
- `docs/adr/adr-049-llm-picker.md`

### Dependencies
- Depends on: DC-LLP-006

---

## Issue: DC-LLP-022 — Admin panel: DecisionLog component

### Description
Implement a searchable history of routing decisions.
- Create a paginated table of recent decisions.
- Columns: Timestamp, Agent, Task Type, Winner Model, Confidence, Duration.
- Add filters for date range, agent ID, and task type.
- Support "Click to Expand" to view the full `DecisionTrace`.

### Acceptance Criteria
- History loads efficiently from the SQLite `routing_decisions` table.
- Filtering and pagination work correctly.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 5)

### Dependencies
- Depends on: DC-LLP-012

---

## Issue: DC-LLP-023 — Admin panel: LineageGraph component

### Description
Visualize the routing decision path using a flow graph.
- Integrate XYFlow to render the `DecisionTrace`.
- Nodes: Request → Rules → Candidates → Scorer → Winner → Outcome.
- Use color coding (Green for winners, Red for eliminated candidates).
- Interactive nodes show detailed scores/reasoning on click.

### Acceptance Criteria
- Graph correctly represents the hierarchy and logic of a specific decision.
- Visual representation matches the internal trace data.

### References
- `docs/adr/adr-049-llm-picker.md`

### Dependencies
- Depends on: DC-LLP-022

---

## Issue: DC-LLP-024 — Admin panel: CostDashboard component

### Description
Implement spend and usage analytics.
- Create charts for:
  - Spend per subscription/model.
  - Request volume over time.
  - Token usage trends.
- Use Recharts for data visualization.

### Acceptance Criteria
- Dashboard provides clear insight into where budget is being spent.
- Aggregations match the token usage data stored in the database.

### References
- `docs/adr/adr-049-llm-picker.md`

### Dependencies
- Depends on: DC-LLP-012

---

## Issue: DC-LLP-025 — Admin panel: EloRankings component

### Description
Visualize model performance and Elo trends.
- Display a ranking table of models per `task_type`.
- Show Elo trend sparklines over time.
- Include sample counts and "Last Updated" timestamps.

### Acceptance Criteria
- Rankings reflect the dynamic Elo scores from the `model_scores` table.
- Sparklines accurately depict recent performance fluctuations.

### References
- `docs/adr/adr-044-elo-scoring-ab-testing.md`

### Dependencies
- Depends on: DC-LLP-013, DC-LLP-014

---

## Issue: DC-LLP-026 — Admin panel: RulesEditor component

### Description
Provide a GUI for managing routing rules.
- Support Creating, Editing, and Reordering rules.
- Implement Drag-and-drop for priority adjustment.
- Validate rule definitions against the Zod schema before saving to `.dc/llm-picker-rules.jsonc`.

### Acceptance Criteria
- Changes made in the UI are persisted to the rules file correctly.
- Validation errors are surfaced clearly to the user.
- Hot-reloading is triggered upon successful save.

### References
- `docs/adr/adr-049-llm-picker.md`

### Dependencies
- Depends on: DC-LLP-004

---

## Issue: DC-LLP-028 — Admin panel: UserInstructionsEditor component

### Description
Implement a natural language instructions textarea in the Admin Panel that allows users to define routing preferences in plain text.
- Create `UserInstructionsEditor.tsx` in `packages/web/src/components/llm-picker/`.
- Features:
  - Textarea with placeholder examples (e.g., "Preferuj tańsze modele", "Unikaj GPT-4o na prostych taskach").
  - Save button that writes to `.dc/config.jsonc` under `routing.userInstructions` via the config API.
  - Character counter with 2000 character limit.
  - Live preview section showing best-effort parsing into implicit routing rules (e.g., "avoid X" → blockModels).
- Implement API endpoint for reading/writing `routing.userInstructions` if not already covered by the config API.
- Extend config Zod schema to include `routing.userInstructions` as optional string (max 2000 chars).

### How Instructions Are Consumed
- **Tier 1 (Heuristic Router):** Parsed into implicit rule overrides where possible (e.g., "avoid {model}" → `blockModels`, "prefer {tag}" → `priorityBoost`, "minimize cost" → adjusted scorer weights). Unparseable directives are forwarded to Tier 3.
- **Tier 2 (BERT Classifier):** Not consumed. Classifier operates on task complexity.
- **Tier 3 (Tiny LLM Router):** Instructions injected verbatim into the routing prompt's system section. The tiny LLM reasons over them alongside the standard rubric.

### Acceptance Criteria
- Textarea saves and loads instructions from `.dc/config.jsonc` correctly.
- Character limit enforced in the UI.
- Live preview shows parsed rules with best-effort accuracy.
- Unparsed instructions are clearly indicated as "forwarded to Tiny LLM".
- Config Zod schema validates `routing.userInstructions` as optional string, max 2000 chars.
- Component follows existing DiriCode UI patterns (shadcn/ui, Zustand store).

### References
- `docs/adr/adr-049-llm-picker.md` (Section 12)
- `docs/adr/adr-009-jsonc-config-c12-loader.md`

### Dependencies
- Depends on: DC-LLP-004 (config loader), DC-LLP-005 (heuristic router — for parsing integration)
- Required by: DC-LLP-019 (cascade orchestrator — instructions feed into routing prompt)

---

## Issue: DC-LLP-027 — Auto re-training pipeline

### Description
Automate the improvement of local ML models.
- Create `retrain.ts` to manage the training lifecycle.
- Features:
  - Threshold check: Trigger when feedback exceeds `feedbackThreshold` (default 100).
  - Data export: Extract training pairs from `routing_decisions` table.
  - Training trigger: Run local training script for BERT classifier.
  - Validation: Perform 20% holdout validation.
  - Safe swap: Rollback to `classifier-prev.onnx` if accuracy drops > 2%.
- Set up a cron job (default 24h) to check for retraining needs.

### Acceptance Criteria
- Pipeline runs without manual intervention.
- Rollback mechanism prevents regression in classification accuracy.
- Training data is correctly filtered and stratified by task type.

### References
- `docs/adr/adr-049-llm-picker.md` (Section 8)

### Dependencies
- Depends on: DC-LLP-014, DC-LLP-017

---

## Must NOT (Epic-specific)

- Must NOT modify `ModelTierResolver` (wrap it via adapter, never touch its internals).
- Must NOT introduce Python sidecar or proxy (must remain pure TypeScript + ONNX Runtime).
- Must NOT break existing routing when `routing.engine = "legacy"` (ensure it remains the default).
- Must NOT add external LLM API calls for the routing decision process itself (all classification/routing ML must be local).
- Must NOT skip `DecisionTrace` generation on any routing path, including legacy paths.
- Must NOT hardcode model capabilities (all logic must be derived from tags and attributes).
- Must NOT commit ONNX model binaries directly to the repository (use download script).

---

## Dependencies

### Upstream / External
- **ONNX Runtime for Node.js**: Required for Tier 2 and Tier 3 local inference.
- **Vercel AI SDK**: Core provider abstraction layer.
- **Provider APIs**: Availability of z.ai, MiniMax, and Kimi endpoints.

### Cross-epic
- **epic-router**: Integration with error classifier and existing Kimi adapter.
- **epic-config**: Config schema extensions for routing engine flags.
- **epic-memory**: SQLite repository patterns and migration infrastructure.
- **epic-web-ui**: UI component patterns and state management (Zustand).
- **epic-observability**: Event bus for feedback and routing logs.

### Delivery sequencing
- **Phase 1**: Foundations (DC-LLP-001 to DC-LLP-007).
- **Phase 2**: Provider Ecosystem (DC-LLP-008 to DC-LLP-011).
- **Phase 3**: Data Persistence (DC-LLP-012 to DC-LLP-015).
- **Phase 4**: ML Intelligence (DC-LLP-016 to DC-LLP-019).
- **Phase 5**: Visibility (DC-LLP-020 to DC-LLP-026, DC-LLP-028).
- **Phase 6**: Optimization (DC-LLP-027).

---

## v2 follow-up routing task

### DC-LLP-F01: A2A interface integration
Implement Agent-to-Agent (A2A) handshake protocol. Support reading `.well-known/agent.json` (Agent Cards) to dynamically discover capabilities and task lifecycle hooks via the A2A-JS SDK.

### DC-LLP-F02: Multi-model parallelism
Enable parallel dispatch of the same request to 2+ candidate models. The engine selects the first successful response or uses a consensus mechanism to improve reliability and latency.

### DC-LLP-F03: Cost optimization dashboard
Add advanced budgetary controls, including per-subscription spend limits, real-time cost alerts, and automated engine switching to cheaper models when budget thresholds are reached.
