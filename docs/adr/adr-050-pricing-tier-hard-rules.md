## ADR-050 — Pricing-Tier Hard Rules

| Field      | Value                                 |
| ---------- | ------------------------------------- |
| Status     | Accepted                              |
| Date       | 2026-03-30                            |
| Scope      | MVP-2                                 |
| References | ADR-042, ADR-047, ADR-049, issue #461 |

### Context

The LLM Picker needs a deterministic policy layer that can cap or require model cost before candidate scoring runs. The problem is not model quality or latency ranking. Those are separate axes. The problem is operational policy: some requests must not consume expensive models, while other requests must never be routed to low-cost models.

Without a clear semantic boundary, `pricing_tier` risks becoming overloaded. A low-cost model may be fast or slow. A premium model may be strong or simply expensive. If the picker treats price as a proxy for speed or reasoning quality, policy decisions become inconsistent and hard to debug.

Issue #461 introduces **Hard Rules** for LLM Picker routing. These rules must be static operator policy, applied before scoring, and never silently overridden by learned data or downstream ranking.

### Decision

The picker will treat `pricing_tier` as a **cost-only** dimension and apply Hard Rules as a pre-filter before candidate scoring.

#### 1. Pricing-tier semantics

`pricing_tier` means only the economic cost class of a model.

Allowed values:

- `budget`
- `standard`
- `premium`

Ordering:

`budget < standard < premium`

`pricing_tier` does **not** encode:

- speed
- latency rank
- quality rank
- reasoning strength

Those remain separate model-selection signals.

#### 2. Hard Rules scope

Hard Rules are static policy configuration. They run before candidate scoring and constrain the allowed pricing-tier range for a request.

Each rule may define:

- `min_pricing_tier`
- `max_pricing_tier`

Rules may match on request dimensions such as:

- `agent.role`
- `task.complexity`
- `mode.budget`

#### 3. Merge semantics

If multiple rules match a request:

- final `min_pricing_tier` = highest matching minimum
- final `max_pricing_tier` = lowest matching maximum

The most restrictive constraints always win.

#### 4. Conflict semantics

If merged constraints produce:

`min_pricing_tier > max_pricing_tier`

the picker must return a conflict / no-match result to the dispatcher.

The picker must **not**:

- silently pick a nearby model
- override budget intent
- downgrade a required minimum
- bypass policy because a model scored well

#### 5. Pipeline placement

The request flow is:

`request -> classification -> hard-rules filter -> candidate scoring -> selection`

Hard Rules run before scoring. The scorer only sees candidates that survive the pricing-tier filter.

#### 6. Initial curated catalog

The curated pricing catalog for MVP-2 is:

| Tier       | Models                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| `budget`   | GPT-5 mini, GPT-5.4 mini, Claude Haiku 4.5, Gemini 3 Flash, Grok Code Fast 1, Qwen2.5 |
| `standard` | GPT-5.4, Claude Sonnet 4.6, Gemini 3.1 Pro                                            |
| `premium`  | Claude Opus 4.6                                                                       |

This catalog is intentionally curated. Older generations and preview-only variants are excluded to avoid routing noise.

#### 7. Initial rule set

```json
{
  "hard_rules": [
    { "agent.role": "architect", "min_pricing_tier": "standard" },
    { "agent.role": "reviewer", "min_pricing_tier": "standard" },
    { "agent.role": "orchestrator", "min_pricing_tier": "standard" },
    { "agent.role": "coder", "min_pricing_tier": "budget" },
    { "agent.role": "researcher", "min_pricing_tier": "budget" },

    { "task.complexity": "expert", "min_pricing_tier": "premium" },
    { "task.complexity": "complex", "min_pricing_tier": "standard" },
    { "task.complexity": "simple", "max_pricing_tier": "budget" }
  ]
}
```

`moderate` intentionally has no dedicated hard rule. It remains the scorer's decision space.

### Consequences

- **Positive:** Cost policy becomes explicit, deterministic, and testable.
- **Positive:** The picker no longer conflates cost with speed or reasoning quality.
- **Positive:** Dispatcher-visible conflicts make policy mistakes obvious instead of silently expensive.
- **Negative / Trade-offs:** Some requests will fail fast with conflict instead of receiving a soft fallback.
- **Negative / Trade-offs:** The curated catalog must be maintained as Copilot model availability changes.
- **Migration notes:** Existing picker work should treat old seed catalogs as transitional. Hard Rules must use the curated cost catalog defined here.
