## ADR-053 — Router-Centric Cost Tracking

| Field       | Value                                                                 |
|-------------|-----------------------------------------------------------------------|
| Status      | Accepted                                                              |
| Date        | 2026-03-31                                                            |
| Scope       | MVP-2 (core) + v2 (intelligence)                                      |
| References  | ADR-025, ADR-042, ADR-054, ADR-055 |

### Context

DiriCode supports multiple provider types with fundamentally different billing models:

- **API providers** (OpenAI, Anthropic, Azure paygo): pay-per-token with real-time cost calculation
- **Subscription providers** (GitHub Copilot, Azure subscription): flat rate with quota limits; effective cost is deferred and estimated

The existing DC-SAFE-004 (token guardrails) handles session budgets but lacks provider-type awareness. ADR-042 (Multi-Subscription) manages subscription health but not cross-provider cost aggregation.

Cost tracking must be **router-centric**: the router (ADR-025) is the single point through which all provider calls flow, making it the natural owner of cross-provider cost statistics.

### Decision

**Extend the Diri-Router with a cost tracking engine that understands both provider types and aggregates statistics centrally.**

**Provider Types**

```typescript
interface ApiProvider {
  type: "api";
  pricing: { inputPer1k: number; outputPer1k: number };
  // Cost = tokens × price / 1000 (immediate, accurate)
}

interface SubscriptionProvider {
  type: "subscription";
  monthlyPrice: number;
  limits: { rpm: number; tpm: number; dailyTokens: number };
  // Cost = $0 when in limit, else estimated from monthly/30
}

interface HybridProvider {
  type: "hybrid";
  // Base subscription + per-token overage (e.g., Azure)
}
```

**Cost Tracking Engine (DC-ROUTER-021)**

Centralized in the router:
- `calculateCallCost(provider, usage)` — type-aware cost calculation per call
- `getSessionCost(sessionId)` — aggregated cost for a session
- `getProviderStats(providerId)` — efficiency statistics per provider
- Real-time cost for API providers; deferred/estimated cost for subscription providers

**Provider Type Registry Extension (DC-ROUTER-020)**

Extend the existing Provider Registry (DC-PROV-001) to record provider types and pricing configurations.

**Cost Optimization Routing (DC-ROUTER-022)**

Router strategy that prefers subscription providers (within quota) over API providers:
- "Cheapest first": use subscription capacity before paying per-token
- Automatic fallback when quota exhausted
- Track savings from optimization

### Consequences

**Positive:**
- Single authoritative cost view across all providers.
- Cost-optimized routing reduces API spend for users with subscriptions.
- Transparency: users see what execution costs across provider types.
- Router-centric design avoids duplicating cost logic in every agent.

**Negative:**
- Subscription cost is inherently estimated, not exact; must communicate this clearly.
- Router becomes more complex with cost-tracking responsibility.
- Deferred cost calculation means end-of-period reconciliation is needed for accurate subscription costs.

### Delivery

- **Scope**: MVP-2 (core infrastructure); v2 (cost intelligence, forecasting, optimization suggestions)
- **Issues**: DC-ROUTER-020 (Provider Type Registry), DC-ROUTER-021 (Cost Tracking Engine), DC-ROUTER-022 (Cost Optimization Routing)
- **Not urgent**: Cost tracking is low priority in MVP-2 compared to core router functionality
