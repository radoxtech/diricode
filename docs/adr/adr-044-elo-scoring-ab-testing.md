# ADR-044 — Elo Scoring and A/B Testing for AI Subscriptions

| Field       | Value                                                         |
|-------------|---------------------------------------------------------------|
| Status      | Accepted                                                      |
| Date        | 2026-03-22                                                    |
| Scope       | v2 (quality scoring), v3 (A/B testing)                        |
| References  | ADR-042, ADR-055 |

### Context

ADR-042 introduced the SubscriptionRouter and health tracking for multi-subscription model management. While ADR-042 focused on availability, cost, and rate-limiting, it deferred the details of quality measurement (Elo scoring) and experimental comparison (A/B testing) to v2 and v3.

To make data-driven routing decisions, the system needs a persistent way to track how models perform across different tasks. A model might be excellent at code generation but mediocre at architectural planning. Without a formal scoring system, the router relies on static priorities, which cannot adapt to actual performance drifts or specific provider optimizations.

### Decision

Implement a centralized scoring and experimentation engine using SQLite for persistence and the Bradley-Terry model for quality estimation.

#### 1. SQLite Schema for Quality Scoring

The `quality.sqlite` database (or a dedicated table in the main project database) will store performance signals.

```sql
-- model_scores: Tracks the current estimated quality of a model-subscription pair per task type.
CREATE TABLE model_scores (
    model_id TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    task_type TEXT NOT NULL,          -- e.g., 'code-write', 'review', 'planning', 'debug'
    elo_rating REAL DEFAULT 1000.0,
    match_count INTEGER DEFAULT 0,
    avg_latency_ms REAL,
    avg_cost_usd REAL,
    success_rate REAL,                -- Ratio of successful completions (0.0 to 1.0)
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (model_id, subscription_id, task_type)
);

-- ab_experiments: Defines structured comparisons between models.
CREATE TABLE ab_experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'paused', 'completed')),
    task_filter_json TEXT,            -- JSON representing filters (tiers, families, tags)
    min_matches INTEGER DEFAULT 50,
    cost_cap_usd REAL,                -- Maximum budget allocated to this experiment
    current_spend_usd REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- comparisons: Individual records of pairwise comparisons used to calculate Elo.
CREATE TABLE comparisons (
    id TEXT PRIMARY KEY,
    experiment_id TEXT,               -- Optional link to an A/B test
    task_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    winner_model_id TEXT,
    winner_sub_id TEXT,
    loser_model_id TEXT,
    loser_sub_id TEXT,
    is_draw BOOLEAN DEFAULT 0,
    signal_source TEXT,               -- 'automated-test', 'human-feedback', 'reviewer-agent'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id)
);
```

#### 2. Bradley-Terry Elo Calculation

Elo updates occur when a comparison signal is received. We use the Bradley-Terry model to handle the probabilistic nature of LLM outputs.

**Expected Score (E):**
The probability of Model A winning against Model B is:
`E_A = 1 / (1 + 10^((Rating_B - Rating_A) / 400))`

**Rating Update:**
`NewRating_A = OldRating_A + K * (ActualScore_A - E_A)`

**K-Factor Strategy:**
To allow for rapid discovery of new models while maintaining stability for established ones:
- **K = 32** for the first 30 matches (high volatility phase).
- **K = 16** after 30 matches (steady state).

#### 3. A/B Testing Mechanics

A/B testing is implemented as a traffic splitting layer in the SubscriptionRouter.

- **Weight-based Splitting:** When an experiment is active, the router intercepts requests matching the `task_filter` and distributes them among candidates according to configured weights.
- **Cost Caps:** Every experiment must have a `cost_cap_usd`. Since A/B testing often involves running redundant tasks (e.g., generating two outputs for one prompt to compare them), the system tracks the "experimental premium" cost. Once the cap is hit, the experiment pauses.
- **Winner Declaration:** An experiment concludes when `min_matches` is reached and the 95% confidence interval for the Elo difference does not include zero. The winner's Elo is pushed to the global `model_scores`.

#### 4. Signal Collection

Quality signals come from three tiers:

1. **Deterministic (High Confidence):** Code compilation, test passes, lint success. These trigger automatic Elo updates.
2. **Agentic (Medium Confidence):** A specialized "reviewer-agent" (tier: HEAVY) evaluates the output of two models and selects the better one.
3. **Human (Golden Signal):** Explicit thumbs up/down or side-by-side choice by the user.

### Consequences

**Positive:**
- Data-driven model selection: The router automatically prefers models that actually solve tasks, not just ones that are cheap.
- Drift detection: If a provider's model quality degrades, its Elo will drop, and the router will shift traffic elsewhere.
- Safe experimentation: Cost caps ensure that A/B testing doesn't result in unexpected bills.

**Negative:**
- Performance overhead: Calculating Elo and checking experiments adds a few milliseconds to the routing logic.
- Cost: Side-by-side A/B tests double the cost of those specific requests.
- Signal noise: Automated signals (tests) may pass even if the code is poorly designed.

### Alternatives Considered

- **Global Leaderboards (e.g., LMSYS):** Rejected as a primary source because local performance on a specific codebase often differs from generic benchmarks.
- **Simple Success/Failure Ratio:** Rejected because it doesn't account for the relative difficulty of tasks. Elo naturally handles the case where a model wins against a "strong" opponent.
