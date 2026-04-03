# ADR-055 Addendum — Context Window Tiers

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Parent ADR  | ADR-055                                       |
| Status      | Accepted                                      |
| Date        | 2026-04-03                                    |

---

## Context

ADR-004 defines model tiers (HEAVY, MEDIUM, LOW) based on computational requirements. However, the relationship between tier and context window was implicit. This addendum formalizes the context window requirements for each tier.

## Decision

**Explicit context window thresholds per tier:**

| Tier | Min Context Window | Typical Use Case |
|------|-------------------|------------------|
| **LOW** | 200,000 tokens | Utility tasks: commit messages, naming, issue creation, summarization |
| **MEDIUM** | 200,000 tokens | Standard coding: refactoring, review, research, file operations |
| **HEAVY** | 800,000 tokens | Complex tasks: architecture, deep reasoning, large codebase analysis |

### Rationale

**Why 200k for LOW/MEDIUM?**
- Modern "small" models (Haiku, GPT-4o-mini, Gemini Flash) all support 128k-200k+
- 200k is the practical minimum for coding tasks with context
- Lower would exclude too many capable budget models

**Why 800k for HEAVY?**
- "Heavy" tasks often involve multi-file analysis or large context
- 800k separates premium models (Claude Opus 200k, Gemini Pro 1M) from standard
- Threshold chosen to include Gemini Pro (1M) and next-gen models

### Scoring Implementation

```typescript
// In model-resolver.ts scoreCandidate()
const TIER_MIN_CONTEXT = {
  "low": 200_000,
  "medium": 200_000,
  "heavy": 800_000
};

const minRequired = TIER_MIN_CONTEXT[request.modelDimensions.tier];

if (descriptor.contextWindow < minRequired) {
  score -= 50; // Heavy penalty
} else {
  // Small bonus for exceeding (up to 20 points)
  score += Math.min(20, (descriptor.contextWindow - minRequired) / 100_000);
}
```

### Examples

| Model | Context Window | Tier Compatibility |
|-------|---------------|-------------------|
| Claude Haiku | 200k | LOW ✓, MEDIUM ✓, HEAVY ✗ |
| GPT-4o-mini | 128k | LOW ✓, MEDIUM ✗ (penalty), HEAVY ✗ |
| Claude Sonnet | 200k | LOW ✓, MEDIUM ✓, HEAVY ✗ |
| GPT-4o | 128k | LOW ✓, MEDIUM ✗ (penalty), HEAVY ✗ |
| Claude Opus | 200k | LOW ✓, MEDIUM ✓, HEAVY ✗ |
| Gemini Pro | 1M | LOW ✓, MEDIUM ✓, HEAVY ✓ |

### ProviderAdapter Responsibility

`ProviderAdapter.listModels()` must return accurate `contextWindow` from official API/documentation:

```typescript
// @diricode/diri-router/providers/
interface ModelDescriptor {
  apiModel: string;
  contextWindow: number;  // ← Single source of truth
  // ...
}
```

**Hardcoding**: If API doesn't expose context window, hardcode based on official docs with source link in comment (per project convention).

---

## References

- ADR-004: Agent roster 3 tiers
- ADR-055: diri-router unified package
- Provider adapters: Copilot, Kimi, Gemini, z.ai, MiniMax
