# Epic: diri-router — Unified Model Routing (@diricode/diri-router)

> **Note**: DiriRouter supersedes the earlier "LLM Picker" design (ADR-049 → ADR-055).

> **Supersedes**: [epic-router.md](./epic-router.md), [epic-llm-picker.md](./epic-llm-picker.md)  
> **ADR**: [ADR-055](../adr/adr-055-diri-router-unified-package.md), [ADR-055 Addendum](../adr/adr-055-addendum-context-tiers.md)  
> **Scope**: POC → MVP-2  
> **Package**: `@diricode/diri-router` (currently `@diricode/providers`)

---

## Summary

diri-router is the unified model routing layer for DiriCode. It combines:

1. **Model Selection** (Picker): Decides which model to use based on task, agent, constraints
2. **Request Execution** (Router): Executes the LLM call with retry, fallback, and streaming
3. **Feedback Loop**: Collects outcomes for Elo scoring and policy tuning

**Key principle**: Model selection and execution are inseparable. They share state (model metadata, health, quotas) and must evolve together.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    diri-router                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Picker     │  │   Router     │  │   Feedback   │      │
│  │              │  │              │  │   Collector  │      │
│  │ • Heuristic  │  │ • Retry      │  │              │      │
│  │ • Hard Rules │  │ • Fallback   │  │ • Elo prep   │      │
│  │ • Scoring    │→ │ • Streaming  │→ │ • chatId     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↑                    ↑                    ↑         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Registry   │  │   Provider   │  │   Contracts  │      │
│  │              │  │   Adapters   │  │              │      │
│  │ • ModelCards │  │              │  │ • Zod schemas│      │
│  │ • Subscriptions│ │ • Copilot   │  │ • Types      │      │
│  └──────────────┘  │ • Kimi      │  └──────────────┘      │
│                    │ • Gemini    │                         │
│                    │ • z.ai      │                         │
│                    │ • MiniMax   │                         │
│                    └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## POC Exit Criteria (MVP-1)

**Goal**: Dispatcher can route through diri-router end-to-end.

- [ ] **DC-DR-001**: Model name mapping works ("opus-4" → real provider ID)
- [ ] **DC-DR-002**: Picker → Router integration (DecisionResponse reaches ProviderRouter)
- [ ] **DC-DR-003**: Dispatcher uses diri-router (not hardcoded ModelConfigResolver)
- [ ] **DC-DR-004**: `chatId` in every DecisionRequest + FeedbackCollector interface
- [ ] **DC-DR-005**: CLI path verified (CLI → Dispatcher → diri-router → Provider)
- [ ] **DC-DR-006**: Resolver reconciliation + context window tiers (200k/800k)

---

## MVP-2 Exit Criteria

- [ ] **DC-DR-007**: Picker code moved from `@diricode/core` to `@diricode/diri-router`
- [ ] **DC-DR-008**: `picker-contracts` absorbed into diri-router
- [ ] **DC-DR-009**: Package renamed to `@diricode/diri-router`
- [ ] **DC-DR-010**: A/B ExperimentManager wired into pipeline
- [ ] **DC-DR-011**: Context window tier thresholds in code (200k/800k)

---

## v2+ Future (Not in MVP)

- UCB1 Multi-armed bandit (issue #505) — explore/exploit optimization
- Full Elo scoring with feedback loop
- Auto-policy tuning based on historical data
- Dashboard UI for routing visibility

---

## Child Issues

### Integration (POC Critical Path)

| Issue | Title | Dependencies |
|-------|-------|--------------|
| DC-DR-001 | Model name mapping layer | None |
| DC-DR-002 | Integrate Picker → Router | DC-DR-006 |
| DC-DR-003 | Dispatcher → diri-router integration | DC-DR-001, DC-DR-002 |
| DC-DR-004 | chatId correlation + FeedbackCollector | None |
| DC-DR-005 | CLI → Router path verification | DC-DR-003 |
| DC-DR-006 | Reconcile resolvers + context tiers | None |

### Refactoring (MVP-2)

| Issue | Title | Dependencies |
|-------|-------|--------------|
| DC-DR-007 | Move Picker from core to diri-router | None |
| DC-DR-008 | Absorb picker-contracts | DC-DR-007 |
| DC-DR-009 | Rename package to @diricode/diri-router | DC-DR-007, DC-DR-008 |
| DC-DR-010 | Wire A/B ExperimentManager | DC-DR-002 |
| DC-DR-011 | Update context window tier thresholds | DC-DR-006 |

---

## Superseded Issues

### From epic-router (DC-PROV)

All DC-PROV-001..007 issues are **completed or superseded**:

- DC-PROV-001: Provider registry (AI SDK) — ✅ Completed
- DC-PROV-002: Error classifier — ✅ Completed
- DC-PROV-003: Retry engine — ✅ Completed
- DC-PROV-004: Stream manager — ✅ Completed
- DC-PROV-005: Fallback chain — ✅ Completed
- DC-PROV-006: Copilot adapter — ✅ Completed
- DC-PROV-007: Kimi adapter — ✅ Completed

**Action**: Close as completed/superseded by DC-DR.

### From epic-llm-picker (DC-LLP)

DC-LLP issues partially completed, partially migrated:

**Completed** (can close):
- DC-LLP-001: ModelResolver interface — ✅ Completed
- DC-LLP-008: GitHub adapter — ✅ Completed
- DC-LLP-010: MiniMax adapter — ✅ Completed

**Migrated to DC-DR**:
- DC-LLP-005: Heuristic router → DC-DR-006 (Tier 1)
- DC-LLP-007: Candidate scorer → DC-DR-006 (Scoring)
- DC-LLP-016: ONNX setup → DC-DR-011 (future)
- DC-LLP-017: BERT classifier → Post-MVP (skip for POC)
- DC-LLP-018: TinyLLM router → DC-DR-006 (optional toggle)

**Deferred to v2**:
- DC-LLP-014: Elo feedback → Needs chatId + history
- DC-LLP-025: Elo Rankings UI → Post-MVP
- DC-LLP-027: Auto re-training → Post-MVP
- DC-LLP-032: Auto-policy tuning → Post-MVP

---

## API Contract

### DecisionRequest (Input)

```typescript
interface DecisionRequest {
  requestId: string;        // UUID per request
  chatId: string;           // 🔥 REQUIRED: conversation/session ID
  agent: {
    id: string;
    role: string;           // "coder", "reviewer", "architect"...
  };
  task: {
    type: string;           // "refactor", "research", "plan"...
    description?: string;   // For deep analysis (optional)
  };
  modelDimensions: {
    tier: "heavy" | "medium" | "low";
    modelAttributes: (
      | "reasoning"
      | "speed"
      | "agentic"
      | "creative"
      | "ui-ux"
      | "bulk"
      | "quality"
    )[];
    fallbackType: "largeContext" | "largeOutput" | "error" | "strong" | null;
  };
  constraints?: {
    requiredCapabilities?: string[];  // ["tool-calling", "vision"]
    excludedProviders?: string[];
    excludedModels?: string[];
    preferredProviders?: string[];
    preferredModels?: string[];
  };
  policyOverride?: string;      // "quality_first", "cost_optimized", "speed_first"
  enableDeepAnalysis?: boolean; // Toggle TinyLLM (default: false)
}
```

`family` + `tags` were removed during the AgentCapabilities migration. Picker-facing scoring now consumes `modelAttributes`.

### DecisionResponse (Output)

```typescript
interface DecisionResponse {
  requestId: string;
  decisionId: string;       // UUID generated by diri-router
  timestamp: string;
  status: "resolved" | "no_match" | "error";
  selected?: {
    provider: string;
    model: string;
    score: number;
  };
  candidates?: ModelCandidate[];
  decisionMeta?: {
    policyUsed: string;
    selectionLatencyMs: number;
    isFallback: boolean;
    fallbackReason?: string;
  };
  classificationTrace?: {
    tierUsed: 1 | 2 | 3;
    confidence: number;
    classification: "simple" | "moderate" | "complex" | "expert";
    latencyMs: number;
    tierHistory: Array<{
      tier: 1 | 2 | 3;
      confidence: number;
      reached: boolean;
    }>;
  };
}
```

---

## Integration Points

| Component | How it uses diri-router |
|-----------|------------------------|
| **Dispatcher** | Calls `diriRouter.pick()` to select model, then `diriRouter.chat()` to execute |
| **CLI** | Entry point for user prompts → routes through Dispatcher → diri-router |
| **Server** | HTTP API routes for chat/stream → uses diri-router internally |
| **ABExperimentManager** | Adjusts candidate weights before scoring |
| **EventStream** | Receives `picker.*` events for observability |

---

## Dependencies

**Upstream** (diri-router depends on):
- Vercel AI SDK (`@ai-sdk/*`) — transport layer
- ONNX Runtime (optional) — for TinyLLM deep analysis

**Downstream** (depend on diri-router):
- `@diricode/core` — Dispatcher (indirect via DI)
- `apps/cli` — CLI commands
- `@diricode/server` — HTTP API

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking change for consumers | Two-phase migration: integration first, rename second |
| Package size increase | Tree-shakeable subpath exports |
| ONNX complexity | Optional dependency; graceful degradation to Tier 1 only |
| chatId not provided | Make required in TypeScript; runtime error if missing |

---

## Timeline

| Phase | Scope | ETA |
|-------|-------|-----|
| POC Integration | DC-DR-001..006 | Week 1-2 |
| Package Refactor | DC-DR-007..011 | Week 3-4 |
| MVP-2 Polish | Testing, docs | Week 5-6 |
| v2+ Features | UCB1, Elo, Dashboard | Post-MVP |

---

## References

- [ADR-055: diri-router Unified Package](../adr/adr-055-diri-router-unified-package.md)
- [ADR-055 Addendum: Context Window Tiers](../adr/adr-055-addendum-context-tiers.md)
- [epic-router.md](./epic-router.md) (superseded)
- [epic-llm-picker.md](./epic-llm-picker.md) (superseded)
- Issue #505: UCB1 Multi-armed bandit (future)
