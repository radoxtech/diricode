# ADR-026 — Prompt Caching in MVP Phase 2

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP Phase 2                                   |
| References  | analiza-prompt-caching.md (PERF-001)          |

### Context

Prompt caching provides 53-90% cost savings and 31-79% latency reduction by reusing previously computed prompt prefixes. Different providers implement caching differently (OpenAI: automatic, Anthropic: explicit). Implementing caching requires stable prompt prefix ordering.

### Decision

**Prompt caching implemented in MVP Phase 2** (not Phase 1).

#### Required Prompt Ordering (Stable Prefix)

```
[tools] → [system prompt] → [cached messages] → [new messages]
```

Tools and system prompt change least frequently → they form the cacheable prefix.

#### Provider-Specific Behavior

| Provider | Mechanism | Cost |
|----------|-----------|------|
| OpenAI | Automatic (no code changes) | Free (50% discount on cached input) |
| Anthropic | Explicit `cache_control` markers | Cache writes cost 25% extra, reads 90% cheaper |
| Copilot (GitHub Models) | Depends on underlying model | Varies |

#### Cost Savings Estimates

| Scenario | Without Cache | With Cache | Savings |
|----------|---------------|------------|---------|
| Multi-turn conversation (10 turns) | $0.50 | $0.10 | 80% |
| Agent delegation chain (5 agents) | $0.30 | $0.14 | 53% |
| Code review (large file) | $0.20 | $0.04 | 80% |

### Consequences

- **Positive:** Major cost reduction. Aligns with project priority #1 (token cost). Latency improvement for interactive use.
- **Negative:** Deferred to Phase 2 — Phase 1 won't have these savings. Requires stable prompt ordering discipline from day 1 (even before caching is enabled).
