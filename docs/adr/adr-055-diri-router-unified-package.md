# ADR-055 — diri-router Unified Package

| Field       | Value                                                                                          |
|-------------|------------------------------------------------------------------------------------------------|
| Status      | Accepted                                                                                       |
| Date        | 2026-04-03                                                                                     |
| Scope       | MVP-1 (POC integration), MVP-2 (full package)                                                  |
| Supersedes  | ADR-025, ADR-049                                                                               |
| References  | ADR-004, ADR-042, ADR-044, ADR-054                                                             |

---

## Context

The LLM routing architecture in DiriCode has evolved organically across multiple packages:

- **`@diricode/providers`**: Provider adapters, `ProviderRouter`, retry/fallback, streaming (ADR-025)
- **`@diricode/core`**: LLM Picker — `CascadeModelResolver`, heuristics, scoring (ADR-049)
- **`@diricode/picker-contracts`**: Shared Zod schemas between providers and picker
- **`ModelConfigResolver`**: Dispatcher's hardcoded tier → model mapping (legacy)

This fragmentation creates several problems:

1. **No single entry point**: Callers must know which package to import from
2. **Circular dependency risk**: Picker needs provider metadata; providers might need picker decisions
3. **Version drift**: Three separate packages must be kept in sync
4. **Mental overhead**: Developers must understand the boundary between "router" and "picker"

The core insight: **Provider routing and model selection are two aspects of the same concern** — deciding which model to use and executing the call. They cannot function separately.

---

## Decision

**Merge Provider Router and LLM Picker into a unified package: `@diricode/diri-router`.**

### Package Structure

```
@diricode/diri-router/
├── package.json                    # exports subpaths
├── src/
│   ├── index.ts                    # Main facade
│   ├── contracts/                  # Zod schemas (from picker-contracts)
│   │   ├── index.ts
│   │   ├── model-card.ts
│   │   └── subscription.ts
│   ├── providers/                  # Provider adapters (from providers)
│   │   ├── index.ts
│   │   ├── copilot/
│   │   ├── kimi/
│   │   ├── gemini/
│   │   ├── zai/
│   │   └── minimax/
│   ├── router/                     # ProviderRouter, retry, fallback, streaming
│   │   ├── index.ts
│   │   ├── router.ts
│   │   ├── error-classifier.ts
│   │   ├── retry-engine.ts
│   │   └── stream-manager.ts
│   ├── picker/                     # LLM Picker (from core)
│   │   ├── index.ts
│   │   ├── model-resolver.ts
│   │   ├── hard-rules.ts
│   │   └── types.ts
│   ├── registry/                   # ModelCardRegistry, SubscriptionRegistry
│   │   ├── index.ts
│   │   ├── model-card-registry.ts
│   │   └── subscription-registry.ts
│   └── feedback/                   # FeedbackCollector, Elo scoring prep
│       ├── index.ts
│       └── feedback-collector.ts
└── __tests__/
```

### Subpath Exports

```json
{
  "name": "@diricode/diri-router",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./contracts": {
      "import": "./dist/contracts/index.js",
      "types": "./dist/contracts/index.d.ts"
    },
    "./providers": {
      "import": "./dist/providers/index.js",
      "types": "./dist/providers/index.d.ts"
    },
    "./router": {
      "import": "./dist/router/index.js",
      "types": "./dist/router/index.d.ts"
    },
    "./picker": {
      "import": "./dist/picker/index.js",
      "types": "./dist/picker/index.d.ts"
    },
    "./feedback": {
      "import": "./dist/feedback/index.js",
      "types": "./dist/feedback/index.d.ts"
    }
  }
}
```

### Dependency Direction (Internal)

```
contracts/      ← zero deps
     ↑
providers/      ← contracts
     ↑
picker/         ← contracts, providers
     ↑
router/         ← contracts, providers, picker
     ↑
feedback/       ← contracts (minimal)
```

**No internal barrel files**: Direct imports between submodules only.

---

## Key Design Decisions

### 1. Unified `DiriRouter` Facade

Single entry point for all routing decisions:

```typescript
export interface DiriRouter {
  /**
   * Select a model for the given task.
   * Returns DecisionResponse with selected provider/model.
   */
  pick(request: DecisionRequest): Promise<DecisionResponse>;
  
  /**
   * Execute chat completion with selected model.
   * Handles retry, fallback, streaming internally.
   */
  chat(options: ChatOptions): Promise<ChatResponse>;
  
  /**
   * Stream chat completion.
   */
  stream(options: ChatOptions): AsyncIterable<StreamChunk>;
  
  /**
   * Submit feedback for a previous decision.
   * Used for Elo scoring and policy tuning.
   */
  submitFeedback(feedback: FeedbackSubmission): Promise<void>;
}
```

### 2. chatId Correlation

**Critical requirement**: Every model selection must include a conversation-scoped correlation ID.

```typescript
interface DecisionRequest {
  requestId: string;        // UUID per request (caller or generated)
  chatId: string;           // 🔥 REQUIRED: conversation/session ID
  agent: AgentInfo;
  task: TaskInfo;
  modelDimensions: ModelDimensions;
  constraints?: DecisionConstraints;
  policyOverride?: string;
  enableDeepAnalysis?: boolean;  // Toggle TinyLLM (default: false)
}
```

**Purpose**: 
- `chatId` links multiple requests in the same conversation
- Enables feedback correlation: "this model worked well for this chat"
- Foundation for Elo scoring (ADR-044) and A/B testing

**Ownership**:
- `chatId`: Provided by orchestrator (caller) — conversation/session scope
- `requestId`: Generated by diri-router (or provided by caller) — per-decision scope
- `executionId`: Generated by agent system — per agent.run() scope

### 3. Simplified Constraints (POC)

Removed from original ADR-049:
- ❌ `maxCostUsd` — nobody provides this upfront
- ❌ `maxLatencyMs` — replaced by `speedPreference`
- ❌ `minContextWindow` — implied by `modelDimensions.tier`

Kept:
- ✅ `speedPreference: "latency_critical" | "latency_flexible"`
- ✅ `requiredCapabilities`, `excludedProviders`, `preferredProviders`, etc.

### 4. Context Window Tiers

Model tier implies context window requirements:

| Tier | Context Window | Use Case |
|------|---------------|----------|
| **LOW** | 200k+ | Utility tasks, simple generation, commit messages |
| **MEDIUM** | 200k-800k | Standard coding, review, research |
| **HEAVY** | 800k+ | Complex reasoning, architecture, large codebase analysis |

**Scoring logic**: Models below tier threshold get heavy penalty; models above get bonus proportional to fit.

---

## Architecture Integration

### Before (Fragmented)

```
Dispatcher
    ↓
ModelConfigResolver (hardcoded: "opus-4", "sonnet-4")  ← BROKEN
    ↓
SubscriptionRouter (static priority)                   ← NO PICKER
    ↓
ProviderRouter (retry/fallback)
    ↓
AI SDK ProviderRegistry
    ↓
LLM API
```

### After (Unified)

```
Dispatcher
    ↓
DiriRouter.pick(request)  ← Integrated picker + router
    ↓ (DecisionResponse)
DiriRouter.chat(options)  ← Retry, fallback, streaming
    ↓
AI SDK ProviderRegistry   ← Transport only
    ↓
LLM API
```

---

## Migration Path

### Phase 1: POC (MVP-1)

1. **Keep packages separate**, but create integration layer
2. **Wire Dispatcher → diri-router** (even if packages not merged)
3. **Implement `chatId`** in DecisionRequest
4. **Remove broken abstractions**: `ModelConfigResolver` returns real model IDs

### Phase 2: Package Merge (MVP-2)

1. **Move code**: `core/src/llm-picker/` → `diri-router/src/picker/`
2. **Move code**: `providers/src/*` → `diri-router/src/*`
3. **Absorb**: `picker-contracts` inlined into `diri-router/contracts/`
4. **Rename**: Package `@diricode/providers` → `@diricode/diri-router`
5. **Update imports**: All consumers use new package name

### Phase 3: Optimization (v2+)

1. **Elo scoring**: Feedback loop with `chatId` correlation
2. **UCB1/Bandit**: Multi-armed bandit for explore/exploit (issue #505)
3. **Auto-tuning**: Policy adjustment based on historical data

---

## Consequences

### Positive

- **Single source of truth**: One package, one version, one mental model
- **Clear API**: `DiriRouter.pick()` → `DiriRouter.chat()` → feedback
- **Testability**: Unified test suite for entire routing pipeline
- **Observability**: Single trace from decision to execution

### Negative

- **Breaking change**: All imports must be updated
- **Package size**: Larger bundle (but tree-shakeable via subpaths)
- **Migration effort**: Two-phase migration (integration → merge)

### Neutral

- **ONNX dependency**: Still required for TinyLLM (optional, graceful degradation)
- **Provider adapter maintenance**: Same as before, just colocated

---

## References

- ADR-004: Agent roster with 3 tiers (context window mapping)
- ADR-025: Native TS Router with fallback chain (superseded)
- ADR-042: Multi-subscription management
- ADR-044: Elo scoring and A/B testing (chatId prerequisite)
- ADR-049: LLM Picker decision engine (superseded)
- ADR-054: Vercel AI SDK as transport layer
- Issue #505: UCB1 Multi-armed bandit (future optimization)

---

## Appendix: Context Window Tier Scoring

```typescript
const TIER_MIN_CONTEXT = {
  "low": 200_000,
  "medium": 200_000,
  "heavy": 800_000
};

function scoreContextWindow(
  contextWindow: number,
  tier: "low" | "medium" | "heavy"
): number {
  const minRequired = TIER_MIN_CONTEXT[tier];
  
  if (contextWindow < minRequired) {
    return -50; // Heavy penalty — model doesn't meet requirements
  }
  
  // Bonus for exceeding requirements (up to 20 points)
  const excess = contextWindow - minRequired;
  const bonus = Math.min(20, Math.floor(excess / 100_000));
  return bonus;
}
```

**Essential comment preservation**: This tier mapping (200k/800k) is based on empirical analysis of model capabilities and task requirements. Do NOT remove this comment in future refactorings — the thresholds are intentional and tested against real workloads.
