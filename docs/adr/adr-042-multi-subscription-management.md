# ADR-042 — Multi-Subscription Model Management

| Field       | Value                                                         |
|-------------|---------------------------------------------------------------|
| Status      | Accepted                                                      |
| Date        | 2026-03-21                                                    |
| Scope       | MVP-2 (subscription rotation), v2 (quality scoring), v3 (A/B testing) |
| References  | ADR-004 (agent roster 3 tiers), ADR-005 (families), ADR-006 (4 fallback types), ADR-025 (native TS router + fallback chain), Survey Decision E1 |

### Context

DiriCode agents consume LLM tokens across multiple providers (Anthropic, OpenAI, Google, Moonshot, DeepSeek, local models). Users often have multiple subscriptions — an Azure OpenAI enterprise account, a personal Anthropic API key, a GitHub Copilot coding plan, and a free-tier Google AI key. Each subscription has independent rate limits, quotas, pricing, and reset schedules.

The current architecture (ADR-025) handles provider failover reactively: when a call fails, retry with backoff, then fall back to the next model. It does not track quota state, does not rotate between subscriptions proactively, and cannot compare model quality across providers.

**Problems this ADR solves:**

1. **Quota waste.** When one subscription hits its limit, the system retries and eventually errors out — even though an identical or equivalent model is available on a different subscription.
2. **No cost visibility.** Users cannot see which subscription is burning tokens fastest or which offers the best price for a given model family.
3. **No quality signal.** Two models that fill the same role (e.g., Opus 4.6 via Anthropic direct vs. Opus 4.6 via Azure) may differ in latency, reliability, or even output quality (different inference stacks). There is no mechanism to measure and compare.
4. **Manual key management.** Users must manually reconfigure providers when a subscription resets or a new one is added.

Industry precedent:
- **LiteLLM** groups multiple deployments under a single `model_name` with routing strategies (simple-shuffle, least-busy, usage-based, latency-based) and per-deployment cooldowns.
- **Plandex** assigns models per agent role with 4 fallback types (largeContext, largeOutput, error, strong) and auto-falls-back to OpenRouter when direct providers fail.
- **OpenRouter** provides declarative provider selection with `order`, `sort` (price/throughput/latency), and `allow_fallbacks` per request.
- **RouteLLM** uses trained router models to classify query complexity and route between strong/weak models, achieving 95% of GPT-4 performance with only 54% of GPT-4 calls.

### Decision

Introduce a **Subscription** entity and a **SubscriptionRouter** that sits between the Agent/Router layer (ADR-025) and the LLM provider APIs.

#### 1. Subscription Entity

```typescript
interface Subscription {
  id: string;                        // "anthropic-personal", "azure-work", "copilot-pro"
  provider: ProviderId;              // "anthropic", "openai", "azure", "google", "moonshot"
  credentials: CredentialSet;        // API keys, endpoints, org IDs
  models: ModelCapability[];         // Which models this subscription provides
  limits: SubscriptionLimits;        // RPM, TPM, daily quota, monthly budget
  priority: number;                  // Lower = preferred (like LiteLLM's `order`)
  enabled: boolean;                  // Can be toggled without removing config
  tags?: string[];                   // "work", "personal", "free-tier"
}

interface SubscriptionLimits {
  rpm?: number;                      // Requests per minute
  tpm?: number;                      // Tokens per minute
  dailyTokens?: number;              // Daily token budget
  monthlyBudgetUsd?: number;         // Spending cap
  resetSchedule: "rolling" | "daily-utc" | "daily-local" | "monthly";
}

interface ModelCapability {
  modelId: string;                   // "claude-opus-4.6", "gpt-5.4"
  family: ModelFamily;               // "reasoning", "creative", "fast", "bulk"
  tier: ModelTier;                   // "heavy", "medium", "low"
  contextWindow: number;             // Max input tokens
  maxOutput: number;                 // Max output tokens
  costPer1kInput: number;            // USD per 1k input tokens
  costPer1kOutput: number;           // USD per 1k output tokens
}
```

#### 2. Two-Dimensional Model Classification

Models are classified along two independent dimensions:

**Tier** (cost/capability level):

| Tier | Description | Example Models |
|------|-------------|----------------|
| HEAVY | Best reasoning, highest cost | Opus 4.6, GPT-5.4, Gemini 3.1 Pro |
| MEDIUM | Balanced cost/quality | Sonnet 4.6, Kimi 2.5, Qwen3 Coder Next |
| LOW | Cheapest, fastest, utility tasks | Haiku 4.5, DeepSeek V3.2, MiniMax M2 |

**Family** (capability profile):

| Family | Strength | Example Models |
|--------|----------|----------------|
| `reasoning` | Complex logic, math, architecture | Opus 4.6, GPT-5.4, Gemini 3.1 Pro |
| `creative` | Writing, brainstorming, unconventional solutions | Opus 4.6, GPT-5.4 |
| `ui-ux` | Frontend code, styling, design systems | Sonnet 4.6, Qwen3 Coder Next |
| `speed` | Low latency, high throughput | Mercury 2, Haiku 4.5, Gemini Flash |
| `web-research` | Search, browsing, information gathering | GPT-5.4, Gemini 3.1 Pro |
| `bulk` | High volume, low cost batch work | DeepSeek V3.2, Qwen3, MiniMax M2 |
| `agentic` | Tool use, multi-step execution, autonomy | Sonnet 4.6, Opus 4.6 |

A single model can belong to multiple families. For example, Opus 4.6 is `reasoning` + `creative` + `agentic`. Agent configs (ADR-006) specify `{ tier, family }` requirements instead of a specific `modelId`, and the SubscriptionRouter resolves this to the best available model across all active subscriptions.

#### 3. Subscription Health Tracking

The router maintains real-time health state per subscription:

```typescript
interface SubscriptionHealth {
  subscriptionId: string;
  status: "healthy" | "degraded" | "cooldown" | "exhausted";
  rateLimits: {
    rpmUsed: number;
    rpmLimit: number;
    rpmReset: ISO8601;               // From provider response headers
    tpmUsed: number;
    tpmLimit: number;
    tpmReset: ISO8601;
  };
  quota: {
    used: number;                    // 0.0 to 1.0 ratio
    remaining: number;
    resetAt: ISO8601;
  };
  cooldown: {
    until: ISO8601 | null;
    consecutiveFailures: number;
  };
  costs: {
    sessionSpend: number;            // USD spent this session
    dailySpend: number;              // USD spent today
    monthlySpend: number;            // USD spent this billing period
  };
  latency: {
    p50: number;                     // Milliseconds
    p95: number;
    lastMeasured: ISO8601;
  };
}
```

Health is updated after every API call by parsing provider-specific response headers:
- Anthropic: `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-tokens-remaining`
- OpenAI/Azure: `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`
- Google: `x-ratelimit-remaining` (varies by endpoint)

#### 4. Routing Strategy

When an agent needs a model, the SubscriptionRouter:

1. **Filter** — Find all subscriptions that provide a model matching `{ tier, family }`.
2. **Exclude** — Remove subscriptions in `cooldown` or `exhausted` status.
3. **Rank** — Sort remaining by: `priority` (config) → `status` (healthy > degraded) → `cost` (cheapest) → `latency` (fastest).
4. **Select** — Pick the top-ranked subscription.
5. **Call** — Make the API call through the existing ADR-025 retry/backoff pipeline.
6. **Update** — Parse response headers, update health state.

On failure:
- **429 (rate limited):** Mark subscription as `degraded`, set cooldown (exponential backoff with jitter: 7s → 14s → 28s → ... capped at 300s). Immediately retry on next eligible subscription.
- **Quota exhausted:** Mark as `exhausted`. Do not retry on this subscription until `resetAt`.
- **Provider error (500, 503):** Mark as `degraded`, apply cooldown. Retry on next subscription.
- **Auth error (401, 403):** Mark as `exhausted`, notify user. Do not retry.

**Auto-recovery:** When a subscription's `resetAt` time passes, automatically transition from `exhausted` → `healthy` and re-include in routing pool.

#### 5. Configuration

```jsonc
// .dc/config.jsonc
{
  "subscriptions": [
    {
      "id": "anthropic-work",
      "provider": "anthropic",
      "priority": 1,
      "credentials": { "$env": "ANTHROPIC_API_KEY" },
      "limits": {
        "rpm": 1000,
        "tpm": 400000,
        "monthlyBudgetUsd": 200,
        "resetSchedule": "rolling"
      }
    },
    {
      "id": "azure-enterprise",
      "provider": "azure",
      "priority": 2,
      "credentials": {
        "apiKey": { "$env": "AZURE_OPENAI_KEY" },
        "baseUrl": { "$env": "AZURE_OPENAI_ENDPOINT" }
      },
      "limits": {
        "rpm": 600,
        "tpm": 240000,
        "monthlyBudgetUsd": 500,
        "resetSchedule": "monthly"
      }
    },
    {
      "id": "deepseek-bulk",
      "provider": "deepseek",
      "priority": 10,
      "credentials": { "$env": "DEEPSEEK_API_KEY" },
      "tags": ["bulk-only"],
      "limits": {
        "rpm": 300,
        "dailyTokens": 10000000,
        "resetSchedule": "daily-utc"
      }
    }
  ]
}
```

Credentials are never stored in plain text — always `$env` references or secret manager URIs. This is enforced by the config schema validator (ADR-009).

#### 6. Model Quality Scoring (v2)

Track output quality per model to inform routing decisions over time.

```typescript
interface ModelScore {
  modelId: string;
  subscriptionId: string;
  taskType: string;                  // "code-write", "review", "plan", "debug"
  elo: number;                       // Starting at 1000, updated via Bradley-Terry
  matchCount: number;                // Number of scored comparisons
  metrics: {
    avgTokensPerTask: number;
    avgLatencyMs: number;
    avgCostUsd: number;
    successRate: number;             // 0.0 to 1.0
  };
  lastUpdated: ISO8601;
}
```

Quality signals come from:
- **Automated:** Did the code compile? Did tests pass? Did the reviewer approve?
- **Human feedback:** Thumbs up/down on agent output (lightweight, optional).
- **Pairwise comparison:** When two subscriptions provide equivalent models, occasionally route the same task to both and let the reviewer agent or human pick the better output.

Elo updates use the Bradley-Terry model:
```
E_A = 1 / (1 + 10^((R_B - R_A) / 400))
R'_A = R_A + K * (S_A - E_A)
```
K-factor: 32 for first 30 matches, 16 thereafter. Score differences below 50 Elo points are treated as noise.

#### 7. A/B Testing (v3)

Structured experiments comparing models on identical tasks.

```typescript
interface ABExperiment {
  id: string;
  name: string;                      // "opus-vs-gpt5-for-code-review"
  status: "active" | "paused" | "completed";
  candidates: Array<{
    subscriptionId: string;
    modelId: string;
    weight: number;                  // Traffic allocation (0.0 to 1.0)
  }>;
  taskFilter: {                      // Which tasks enter the experiment
    agentTags?: string[];            // "coding", "planning", "quality"
    tiers?: ModelTier[];
    families?: ModelFamily[];
  };
  results: {
    candidateId: string;
    elo: number;
    matchCount: number;
    avgCost: number;
    avgLatency: number;
    successRate: number;
  }[];
  minMatches: number;                // Minimum comparisons before declaring winner (default: 50)
  createdAt: ISO8601;
  completedAt?: ISO8601;
}
```

A/B tests are opt-in. They run transparently alongside normal work — the user does not notice unless they check the experiment dashboard. Results feed back into the quality scoring system.

### Alternatives Considered

| Alternative | Reason Rejected |
|-------------|----------------|
| **LiteLLM proxy** (external process) | Adds operational complexity (separate process, configuration duplication). DiriCode already has a native TS router (ADR-025). Embedding subscription logic in-process is simpler and gives full control over health tracking. |
| **Single provider with multiple keys** | Too narrow. Users have subscriptions across different providers (Anthropic + Azure + Google), not just multiple keys for one provider. |
| **OpenRouter as universal proxy** | Creates dependency on a third-party service. Violates the self-hosted, zero-external-dependency principle. Also adds latency and cost markup. |
| **Manual provider switching** | Poor UX. Users should not need to reconfigure when one subscription hits limits. The whole point is automatic rotation. |

### Consequences

**Positive:**
- Users maximize their available LLM capacity across all subscriptions without manual intervention.
- Cost optimization — the router prefers cheaper subscriptions when quality is equivalent.
- Quality visibility — over time, the system learns which models perform best for which tasks, enabling data-driven model selection.
- No vendor lock-in — adding a new provider is a config change, not a code change.
- Auto-recovery from rate limits and quota exhaustion — the system self-heals when limits reset.

**Negative / Trade-offs:**
- **Configuration complexity.** Multiple subscriptions with limits, priorities, and credentials add config surface area. Mitigated by sensible defaults and Family Packs (ADR-005) that pre-configure common subscription setups.
- **Health tracking overhead.** Parsing response headers and maintaining per-subscription state adds memory and CPU overhead. Acceptable — health state is a handful of numbers per subscription, updated once per API call.
- **Quality scoring requires volume.** Elo ratings need ~50+ comparisons to be meaningful. Low-traffic deployments may not generate enough signal. Mitigated by conservative K-factor and treating sub-50-match scores as provisional.
- **A/B testing doubles cost** for tested tasks. This is opt-in and should only run on a small percentage of traffic. The experiment config includes traffic weight controls.
- **Phased delivery.** Full feature set spans three releases (MVP-2, v2, v3). Early users get subscription rotation without quality insights.

### Addendum — "Try Cheap First" Routing Strategy (Survey Decision E1, 2026-03-23)

Before routing to the requested tier, the SubscriptionRouter first attempts a LOW-tier model when the task complexity is ambiguous. If the LOW-tier model handles the task successfully (code compiles, tests pass, reviewer approves), the cost savings are captured. If the LOW-tier model fails or produces low-quality output, the router escalates to the originally requested tier.

This is inspired by RouteLLM's trained complexity classifier but uses a simpler heuristic: tasks with fewer than 200 input tokens and no architectural tags are candidates for LOW-tier first. The quality scoring system (v2) refines this heuristic over time.

The "try cheap first" strategy is opt-in per work mode — enabled by default at Quality levels 1-2, disabled at Quality levels 4-5, configurable at Quality level 3.

### Addendum — 3D Model Classification: Tier × Family × Context Size (2026-03-24)

#### 1. Motivation & Problem Statement

The same model (e.g., Claude Opus) can be available across multiple subscriptions at different context window sizes. For instance, a GitHub Copilot subscription provides Opus with 200K context at a lower cost, while an Anthropic direct API provides Opus with a 1M context window at a higher price point.

The current 2D classification (Tier × Family) cannot distinguish these variants. As a result, the router cannot prefer the cheaper 200K subscription when massive context isn't needed. Adding context size as a third dimension enables cost-optimized routing based on actual task context requirements.

#### 2. ContextGroup Type Definition

```typescript
type ContextGroup = "standard" | "extended" | "massive";

// Thresholds (input tokens only — output limits remain with ADR-006's largeOutput fallback):
// standard: ≤200,000 input tokens  — most tasks, cheapest subscriptions
// extended: 200,001–999,999 tokens — large codebases, multi-file analysis
// massive:  ≥1,000,000 tokens      — full-repo analysis, massive document processing
```

#### 3. Updated ModelCapability Interface

The `contextGroup` is a derived categorical dimension used for routing.

```typescript
interface ModelCapability {
  // ... existing fields ...
  contextWindow: number;        // exact token limit (existing)
  contextGroup: ContextGroup;   // categorical routing dimension (NEW)
}
```

**Derivation rule:**
- `contextWindow ≤ 200,000` → `"standard"`
- `200,001 ≤ contextWindow ≤ 999,999` → `"extended"`
- `contextWindow ≥ 1,000,000` → `"massive"`

#### 4. Updated Routing Strategy

We insert a new **Step 1.5** into the routing strategy described in Section 4:

**Step 1.5 — Filter by Context Group:**
- If the agent request includes `contextRequired: ContextGroup`, retain only subscriptions whose model's `contextGroup` is ≥ the required group (standard < extended < massive).
- If `contextRequired` isn't specified, default to `"standard"` and prefer subscriptions with `contextGroup: "standard"`.

This ensures the router picks the cheapest subscription offering the model at standard context when massive context isn't needed. For example, Copilot (Opus 200K) is selected over Anthropic direct (Opus 1M) for typical tasks.

#### 5. Agent-Side Context Request

This integrates with the `AgentConfig` from ADR-006:

```typescript
// Extension to agent model request:
interface AgentModelRequest {
  tier: ModelTier;
  family: ModelFamily;
  contextRequired?: ContextGroup;  // Optional — defaults to "standard"
}
```

Most agents never set `contextRequired` and receive standard context, which is sufficient for over 90% of tasks. Agents that work with large codebases, such as the architect or codebase-mapper, can configure `contextRequired: "extended"`. Rare scenarios like full-repo analysis use `contextRequired: "massive"`. This can be set statically in agent config or dynamically by the orchestrator.

#### 6. Auto-Detection & Local Registry

| Provider      | API Endpoint           | Returns Context Window | Field                      |
|---------------|------------------------|------------------------|----------------------------|
| Anthropic     | `GET /v1/models`       | ✅                     | `max_input_tokens`         |
| Google Gemini | `GET /v1beta/models`   | ✅                     | `inputTokenLimit`          |
| GitHub Models | `GET /catalog/models`  | ✅                     | `limits.max_input_tokens`  |
| OpenAI        | `GET /v1/models`       | ❌                     | —                          |
| Azure OpenAI  | `GET /openai/models`   | ❌                     | —                          |
| DeepSeek      | `GET /models`          | ❌                     | —                          |

Providers that expose the context window via API allow the system to auto-detect `contextGroup` on subscription initialization. For others, we use a local model metadata registry (`packages/providers/src/model-metadata.ts`) with hardcoded values. API auto-detection always takes precedence.

#### 7. Reconciliation with ADR-006 `largeContext` Fallback

ADR-006 defines `largeContext` as a reactive fallback that escalates to a model with a bigger window when the context is too large. The 3D classification mechanism complements this:

- **Context groups (proactive):** The router picks the correct context group upfront based on `contextRequired`, preventing context issues before they occur.
- **`largeContext` fallback (reactive):** When a task's actual input exceeds the current model's context window at runtime, the router escalates to a subscription offering a higher context group.

The `largeContext` fallback remains the essential escalation mechanism for cases where the agent's context needs were underestimated.

