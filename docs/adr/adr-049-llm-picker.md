# ADR-049 — LLM Picker: Intelligent Model Selection Engine

| Field       | Value                                                                         |
|-------------|-------------------------------------------------------------------------------|
| Status      | Draft                                                                         |
| Date        | 2026-03-28                                                                    |
| Scope       | MVP-2                                                                         |
| References  | ADR-004 (3 tiers), ADR-005 (model families), ADR-006 (4 fallback types), ADR-025 (native TS router), ADR-042 (multi-subscription), ADR-044 (Elo/AB testing) |

### Context

DiriCode currently routes model selection via `ModelTierResolver` — a static resolver that maps `AgentTier` + `ModelFamily` + `ContextSize` to a specific model. This works for simple cases but has three structural limitations:

1. **Fixed dimensions.** Tier × family × context is too rigid. New models with unusual capability profiles (e.g., fast reasoning, vision + tool-calling, large context at low cost) do not map cleanly to the existing enum lattice.
2. **No quality feedback loop.** Routing decisions are fire-and-forget. There is no mechanism for the system to learn that model X underperforms for task type Y.
3. **No multi-subscription awareness.** ADR-042 introduced multiple subscriptions per provider. `ModelTierResolver` selects a model but does not reason about which subscription to route through, its rate-limit state, or its cost.

**LLM Picker** is a new routing engine that replaces `ModelTierResolver` — but not immediately. Per the key constraint, the legacy system must remain fully operational while LLM Picker is validated. LLM Picker is introduced as a parallel implementation behind a feature flag. When it reaches satisfactory quality, the flag is flipped and the legacy system is deprecated.

---

## Decision

### 1. Coexistence Strategy

LLM Picker is **additive**. It does not touch `ModelTierResolver`. Both systems implement a shared `ModelResolver` interface. The dispatcher selects which implementation to use based on a runtime config value.

Config toggle in `.dc/config.jsonc`:

```jsonc
{
  "routing": {
    "engine": "legacy"  // "legacy" | "llm-picker"
  }
}
```

Default is `"legacy"`. Changing to `"llm-picker"` activates the new engine for all requests. A percentage-based split (e.g., route 10% of requests through LLM Picker) is supported via:

```jsonc
{
  "routing": {
    "engine": "split",
    "splitPercent": 10  // 0-100, only meaningful when engine = "split"
  }
}
```

**Shared interface** (lives in `packages/core/src/llm-picker/types.ts`):

```typescript
interface ModelResolver {
  resolve(request: ModelRequest): Promise<ModelResolution>;
}

interface ModelRequest {
  agentName: string;
  agentTier: AgentTier;
  taskType: string;
  contextTokens: number;
  tags: string[];
  modelHints?: ModelHints;
  sessionId: string;
}

interface ModelResolution {
  model: string;
  subscription: string;
  provider: string;
  reason: ResolutionReason | string;
  confidence: number;
  trace: DecisionTrace;
  fallbackChain: FallbackCandidate[];
}
```

`ModelTierResolver` is wrapped in a thin adapter that implements `ModelResolver`. The dispatcher imports `ModelResolver`, not a concrete class.

**Migration path:** Once LLM Picker quality metrics (Elo convergence, latency p95, error rate) meet defined thresholds, change the default to `"llm-picker"`, mark `ModelTierResolver` as `@deprecated`, and remove it in the subsequent release.

---

### 2. Decision Engine — Three-Tier Cascade

All three tiers are implemented in MVP. Each tier is a separate class with a defined contract.

```
Request
  |
  v
[Tier 1: Heuristic Router]  <1ms
  |-- confident match? -------> ModelResolution (done)
  |-- ambiguous / no match
  v
[Tier 2: BERT/MiniLM Classifier]  50-100ms CPU
  |-- confident match? -------> ModelResolution (done)
  |-- low confidence
  v
[Tier 3: Tiny LLM Router]  100-300ms CPU
  |
  v
ModelResolution (done)
```

**Tier 1: Heuristic Router**

- Evaluates routing rules from `.dc/llm-picker-rules.jsonc` in priority order.
- Conditions: agent name, task type (glob), required/excluded tags, context token range.
- If a rule produces a unique, unambiguous match with no conflicting rules at the same priority level, the result is marked confident and the cascade stops.
- Confidence threshold for stopping: single matching rule with `priority < 10` (emergency range) OR a rule that explicitly sets `forceModel`.

**Tier 2: BERT/MiniLM Classifier**

- Fine-tuned DistilBERT or MiniLM-L6 on task complexity classification.
- Input: task description concatenated with agent metadata (name, tier, tags).
- Output: complexity class (`simple` | `moderate` | `complex` | `expert`) + recommended model tier.
- Runs via ONNX Runtime in Node.js — no Python process, no sidecar.
- Confidence threshold for stopping: softmax probability of top class >= 0.80.
- Training data: production routing decisions annotated with quality feedback from reviewer agents.

**Tier 3: Tiny LLM Router**

- Qwen2.5-0.5B-Instruct or SmolLM2 quantized to INT4, exported to ONNX.
- Invoked only when Tier 1 and Tier 2 disagree or both have confidence below threshold.
- Input prompt: structured rubric covering four criteria — task complexity, required capabilities, context size, latency sensitivity.
- Output: JSON with `{ model: string, reasoning: string }`. Reasoning stored in `DecisionTrace.tinyLlm.reasoning`.
- Runs entirely local; no external API call.

ONNX model binaries are gitignored and downloaded on first run via a setup script (`pnpm run llm-picker:setup`). Stored at `packages/core/src/llm-picker/models/`.

---

### 3. Tag-Based Model Classification

Models are not classified by fixed enum dimensions. Each model has:

```typescript
interface ModelDescriptor {
  id: string;                                    // e.g., "gpt-5.4"
  provider: Provider;
  tags: string[];                                // e.g., ["reasoning", "fast", "code", "tool-calling"]
  attributes: Record<string, number | string>;  // context_window, cost_per_1k_input, cost_per_1k_output, max_output, speed_tps
}
```

**Backward compatibility:** Existing `AgentTier` and `ModelFamily` values map into tags at resolution time:

| Existing value         | Tag injected             |
|------------------------|--------------------------|
| `AgentTier.Heavy`      | `tier:heavy`             |
| `AgentTier.Balanced`   | `tier:balanced`          |
| `AgentTier.Light`      | `tier:light`             |
| `ModelFamily.Reasoning`| `family:reasoning`       |
| `ModelFamily.Fast`     | `family:fast`            |
| `ModelFamily.Code`     | `family:code`            |

Tag matching in routing rules supports AND/OR/NOT:

- `["reasoning", "tool-calling"]` — model must have both.
- `["reasoning", "!vision"]` — model must have reasoning and must NOT have vision.
- Tag prefix `!` means negation.

Model tags are auto-detected from provider APIs where available. Providers without a model listing API use a static `model-catalog.jsonc` config file.

---

### 4. Multi-Dimensional Routing Rules

Rules are stored in `.dc/llm-picker-rules.jsonc` (git-tracked). Evaluated in ascending `priority` order. First match wins.

```typescript
interface RoutingRule {
  id: string;
  name: string;
  priority: number;        // lower = evaluated first; 0-9 = emergency
  conditions: {
    agents?: string[];
    taskTypes?: string[];  // glob patterns, e.g., "code-*"
    tags?: string[];       // request tags; supports ! negation
    contextTokensMin?: number;
    contextTokensMax?: number;
    custom?: Record<string, unknown>;
  };
  action: {
    forceModel?: string;
    forceTags?: string[];
    forceSubscription?: string;
    priorityBoost?: number;
    blockModels?: string[];
    blockSubscriptions?: string[];
  };
  enabled: boolean;
}
```

Rules with `priority` in range 0-9 are treated as emergency overrides and are always evaluated before normal rules regardless of file order.

Example rule:

```jsonc
{
  "id": "rule-code-reviewer-force-family",
  "name": "Code reviewer always uses reasoning-capable model",
  "priority": 20,
  "conditions": {
    "agents": ["code-reviewer"],
    "taskTypes": ["review-*"]
  },
  "action": {
    "forceTags": ["reasoning", "code"]
  },
  "enabled": true
}
```

---

### 5. Subscription Management

Four providers supported on day 1: GitHub Copilot, z.ai, MiniMax AI, Kimi.

Provider enum extended (additive, no breaking change):

```typescript
type Provider = "openai" | "anthropic" | "google" | "github" | "zai" | "minimax" | "kimi";
```

Provider adapters live in `packages/providers/src/`. Each adapter implements:

```typescript
interface ProviderAdapter {
  listModels(): Promise<ModelDescriptor[]>;
  getHealth(): Promise<SubscriptionHealth>;
  getRateLimitState(): Promise<RateLimitState>;
}
```

Where a provider does not expose a model listing API, the adapter falls back to a static catalog section in `.dc/model-catalog.jsonc`.

`SubscriptionSchema` and `SubscriptionHealth` from ADR-042 are used as-is.

---

### 6. Failure Handling

Failure handling operates on the `fallbackChain` returned with every `ModelResolution`.

| Failure scenario                     | Response                                                                                      |
|--------------------------------------|-----------------------------------------------------------------------------------------------|
| Model call fails (any error)         | Immediately try next candidate in `fallbackChain`. No retry on same model.                   |
| Rate limit (429)                     | Read `Retry-After` or `x-ratelimit-reset` header. Set `cooldown.until` on that subscription. Skip in future resolutions until `cooldown.until` passes. |
| Model fails on specific task type    | Record failure in `model_scores` table. Lower Elo score for that (model, task_type) pair.    |
| All preferred candidates exhausted   | Activate emergency priority rules (priority 0-9) to find fallback outside normal constraints. |
| No model available at all            | Surface error to dispatcher with `reason: "no_model_available"`. Dispatcher escalates to user. |

Cooldown state is stored in SQLite (`subscriptions` table, `cooldown_until` column). It survives process restarts.

---

### 7. Quality Feedback Loop

```
Routing decision made
  |
  v
Decision stored in routing_decisions (SQLite) with sessionId
  |
  v
Agent executes with selected model
  |
  v
Reviewer agent evaluates output quality
  |
  v
Dispatcher sends FeedbackEvent { sessionId, success, quality: 0-1, feedbackSource }
  |
  v
Feedback linked to routing decision via sessionId
  |
  v
Elo update: (model, subscription, task_type) score updated
  |
  v
Threshold check: if new_feedback_count >= retraining_threshold (default: 100)
  |-- threshold met --> flag "retraining available"
  |
  v
Cron job (every 24h): if "retraining available"
  --> export training data from SQLite
  --> fine-tune BERT classifier
  --> validate on holdout set (20% of data)
  --> if accuracy improved: swap model file, clear flag
  --> if accuracy regressed: keep previous model, log warning
```

Previous BERT model version is retained as `classifier-prev.onnx`. Auto-rollback is triggered if new model's holdout accuracy is more than 2% below the previous model.

Elo schema is extended from ADR-044 `ModelScore`:

```typescript
interface ModelScore {
  model: string;
  subscription: string;
  taskType: string;
  eloScore: number;
  sampleCount: number;
  lastUpdated: string;
}
```

---

### 8. Decision Trace and Lineage

Every call to `ModelResolver.resolve()` produces a `DecisionTrace`. It is stored asynchronously in SQLite and returned inline in `ModelResolution` for immediate debugging.

```typescript
interface DecisionTrace {
  requestId: string;
  timestamp: string;
  request: ModelRequest;
  heuristic: {
    ran: boolean;
    result?: string;
    confident: boolean;
    durationMs: number;
    rulesMatched: string[];
  };
  classifier: {
    ran: boolean;
    result?: string;
    confidence: number;
    durationMs: number;
  };
  tinyLlm: {
    ran: boolean;
    result?: string;
    reasoning?: string;
    durationMs: number;
  };
  candidates: Array<{
    model: string;
    subscription: string;
    score: number;
    scoreBreakdown: Record<string, number>; // cost_score, quality_score, availability_score, elo_score
    eliminated: boolean;
    eliminationReason?: string;
  }>;
  selected: {
    model: string;
    subscription: string;
    totalDurationMs: number;
  };
  feedback?: {
    success: boolean;
    eloUpdate?: number;
    feedbackSource: string;
  };
}
```

SQLite migration adds table `routing_decisions` with columns: `request_id`, `session_id`, `timestamp`, `request_json`, `trace_json`, `feedback_json` (nullable).

The admin panel renders live lineage via XYFlow. Nodes: Request, each rule checked, candidate list, scoring step, winner, outcome. Edges show the path taken. Resolved nodes are colored green; eliminated candidates are red.

---

### 9. Admin Panel

Eight features, all required in MVP. Implemented as React components in `packages/web/src/components/llm-picker/`. Embedded in the DiriCode web app but architecturally separable (no web-app-specific dependencies in component internals).

Stack: React 19, Vite, Tailwind, shadcn/ui, Zustand, XYFlow. State fetched via existing DiriCode API layer.

| Feature | Component | Description |
|---|---|---|
| 1. Subscription list + status | `SubscriptionList` | Active/inactive toggle, health badge, rate limit bar, cooldown countdown, reset time |
| 2. Costs and usage | `CostDashboard` | Spend per subscription/model, request count, token usage, daily/monthly trend charts |
| 3. Model catalog | `ModelCatalog` | All available models, tags, attributes, context window, pricing (auto-detected or manual) |
| 4. Routing decisions log | `DecisionLog` | Searchable/filterable history; columns: time, agent, task_type, selected model, confidence, duration |
| 5. Lineage visualization | `LineageGraph` | XYFlow graph per decision: Request -> Rules -> Candidates -> Scoring -> Winner -> Outcome |
| 6. Elo/quality scores | `EloRankings` | Ranking table per task_type, Elo trend sparklines, sample count, last updated |
| 7. Routing rules config | `RulesEditor` | Create/edit/reorder/enable/disable routing rules; writes to `.dc/llm-picker-rules.jsonc` via API |
| 8. User prompt preferences | `UserInstructionsEditor` | Textarea for natural language routing instructions; saved to `.dc/config.jsonc` `routing.userInstructions`; see Section 12 |

---

### 10. Package Structure

```
packages/
  core/src/
    llm-picker/
      index.ts                   -- exports ModelResolver, LlmPicker
      types.ts                   -- ModelRequest, ModelResolution, DecisionTrace, RoutingRule, ModelDescriptor
      cascade/
        heuristic-router.ts
        bert-classifier.ts
        tiny-llm-router.ts
      scorer.ts                  -- candidate scoring: cost_score, quality_score, availability_score, elo_score
      feedback.ts                -- FeedbackEvent ingestion, Elo update
      retrain.ts                 -- threshold check, cron trigger, model swap logic
      models/                    -- ONNX binaries (gitignored, downloaded on first run)
        .gitkeep
    agents/
      model-resolver-adapter.ts  -- wraps ModelTierResolver to implement ModelResolver
  providers/src/
    github/                      -- GitHub Copilot adapter
    zai/                         -- z.ai adapter
    minimax/                     -- MiniMax AI adapter
    kimi/                        -- Kimi adapter
  memory/src/db/
    migrations/
      0012_routing_decisions.sql
      0013_extend_model_scores.sql
  web/src/components/llm-picker/
    SubscriptionList.tsx
    CostDashboard.tsx
    ModelCatalog.tsx
    DecisionLog.tsx
    LineageGraph.tsx
    EloRankings.tsx
    RulesEditor.tsx
    UserInstructionsEditor.tsx
.dc/
  llm-picker-rules.jsonc         -- routing rules (git-tracked)
  model-catalog.jsonc            -- static model catalog fallback (git-tracked)
```

ONNX model binaries are downloaded by `pnpm run llm-picker:setup` (script in `packages/core/package.json`). Hash-verified against a manifest committed to the repo.

---

### 11. Auto Re-Training Pipeline

```
[Production routing + feedback]
        |
        v
  SQLite: routing_decisions + model_scores
        |
        v
  Threshold check (every 24h cron OR on each feedback write):
    new_feedback_count_since_last_train >= 100?
        |-- no  --> wait
        |-- yes --> set flag "retraining_available"
        |
        v
  Export training data: SELECT from routing_decisions WHERE feedback IS NOT NULL
        |
        v
  Fine-tune BERT classifier (Node.js child process running Python training script
  OR ONNX fine-tuning via JavaScript — decision deferred to implementation)
        |
        v
  Validate on holdout set (last 20% of exported data, stratified by task_type)
        |
        v
  Compare accuracy: new_accuracy > prev_accuracy - 0.02?
        |-- yes --> swap classifier.onnx, archive prev as classifier-prev.onnx, reset flag
        |-- no  --> keep classifier-prev.onnx as active, log regression warning, reset flag
```

Retraining threshold and cron interval are configurable in `.dc/config.jsonc`:

```jsonc
{
  "routing": {
    "retraining": {
      "feedbackThreshold": 100,
      "cronIntervalHours": 24
    }
  }
}
```

---

### 12. User Prompt Preferences

Users can write **natural language instructions** that influence how LLM Picker routes requests. These instructions are entered via a textarea in the Admin Panel, persisted to config, and read by the routing engine at decision time.

**Use cases:**
- "Preferuj tańsze modele gdy task jest prosty"
- "Unikaj GPT-4o na prostych taskach"
- "Zawsze używaj Claude na code review"
- "Minimalizuj koszty, jakość jest drugorzędna"
- "Dla agentów tier:heavy używaj wyłącznie modeli z tagiem reasoning"

**Config location** (`.dc/config.jsonc`):

```jsonc
{
  "routing": {
    "engine": "llm-picker",
    "userInstructions": "Preferuj tańsze modele. Unikaj GPT-4o na prostych taskach. Zawsze używaj Claude na code review."
  }
}
```

**Admin Panel component** (`UserInstructionsEditor`):
- Textarea with placeholder examples.
- Save button writes to `.dc/config.jsonc` via the existing config API.
- Live preview showing which routing rules the instructions map to (best-effort).
- Character limit: 2000 characters.

**How instructions are consumed:**

| Tier | Consumption method |
|---|---|
| Tier 1: Heuristic Router | Instructions are parsed into implicit rule overrides where possible (e.g., "avoid X" → `blockModels: ["X"]`). Parsing is best-effort; unparseable instructions are silently passed to Tier 3. |
| Tier 2: BERT Classifier | Not directly consumed. Classifier operates on task complexity, not user preferences. |
| Tier 3: Tiny LLM Router | Instructions are injected verbatim into the routing prompt's system section. The tiny LLM reasons over them alongside the standard rubric (complexity, capabilities, context, latency). |

**Parsing pipeline for Tier 1:**

1. Instructions text is split into individual directives (sentence-level).
2. Each directive is matched against known patterns:
   - `"avoid {model}"` / `"unikaj {model}"` → `blockModels`
   - `"prefer {tag}"` / `"preferuj {tag}"` → `priorityBoost` on matching tags
   - `"always use {model} for {agent/task}"` → `forceModel` with conditions
   - `"minimize cost"` → adjust scorer weights (`cost_score` weight increased)
3. Unmatched directives are stored as `unparsedInstructions` and forwarded to Tier 3.

**Validation:** No strict validation on the text content — the textarea accepts free-form natural language. The config Zod schema validates it as an optional string with max length 2000.

---

### 13. A2A Compatibility (Deferred)

The `ModelResolver` interface and `ModelRequest`/`ModelResolution` shapes are designed to align with the A2A Agent Card task lifecycle. No A2A-specific code is written in MVP. When implemented in a future version:

- Expose Agent Card at `.well-known/agent.json`.
- Implement task lifecycle via A2A-JS SDK.
- `ModelRequest` maps to A2A Task input; `ModelResolution` maps to Task output artifact.

A2A implementation is out of scope for this ADR.

---

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| LiteLLM proxy (Python sidecar) | Adds operational complexity and a Python runtime dependency. DiriCode is pure TypeScript. Violates the constraint established in epic-router.md. |
| Replace ModelTierResolver immediately | Risk of breaking existing DiriCode routing while LLM Picker is unproven. Coexistence behind a feature flag is the safer path; replacement happens when quality metrics are satisfied. |
| Fixed dimension model classification (tier x family x context) | Too rigid. New models with cross-cutting capability profiles do not fit the enum lattice. Tag-based classification is extensible without schema changes. Existing dimensions map into tags for backward compatibility. |
| Heuristic-only routing (no ML tiers) | Heuristics cannot reliably classify 20-40% of ambiguous requests. The three-tier cascade provides better routing quality on that long tail at acceptable latency. |
| External LLM as router (e.g., GPT-4o to decide which model to use) | 1-3s latency, per-call cost, and creates a dependency on an external provider for the routing layer itself. Local ONNX inference is faster, free, and offline-capable. |
| OpenRouter as universal proxy | Third-party dependency, markup on costs, added latency, and violates the self-hosted principle. Does not integrate with DiriCode's subscription management. |

---

## Consequences

### Positive

- Zero-risk migration: `ModelTierResolver` is untouched. LLM Picker is opt-in via config. The legacy path continues to work during the transition period.
- Tag-based model classification is flexible and extensible. New models with novel capability profiles are supported without enum changes.
- Full `DecisionTrace` on every routing decision enables root-cause debugging and A/B analysis.
- Elo feedback loop creates a self-improving system: routing quality increases over time as more feedback is collected.
- Auto re-training with holdout validation and rollback protects against classifier regression.
- Admin panel provides complete visibility into costs, subscription health, and routing quality — observability that does not exist in the current system.
- Architecturally separable: `packages/core/src/llm-picker/` has no hard dependency on the DiriCode web app and can be extracted as a standalone library.

### Negative / Trade-offs

- ONNX Runtime adds approximately 50MB to `node_modules`. The BERT model binary is an additional ~80MB downloaded on first run. This is a one-time setup cost.
- Full cascade (Tier 2 + Tier 3) adds 100-300ms latency on ambiguous requests. Mitigation: the majority of production requests are resolved by Tier 1 heuristics in under 1ms.
- Auto re-training requires careful validation logic. A regression in the classifier would degrade routing quality until detected and rolled back. The holdout accuracy check and `classifier-prev.onnx` rollback mechanism mitigate this, but they add implementation surface.
- The eight-feature admin panel represents significant UI work. It is scoped to MVP-2 and implemented incrementally — the routing decisions log and lineage visualization are highest priority.
- Tag-based classification requires initial tag assignment for all models in the catalog. For providers with a model listing API this is automated. For others it requires a one-time manual catalog entry.
