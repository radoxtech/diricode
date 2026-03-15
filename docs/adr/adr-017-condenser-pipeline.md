# ADR-017 — Condenser Pipeline (Context Compression)

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-context-management.md                 |

### Context

When conversation + context exceeds model budget, compression is needed. A single monolithic truncation loses important information. A pipeline of specialized condensers preserves more value.

### Decision

**Pipeline of 3 condensers** (order matters — cheapest first):

| Order | Condenser | Cost | Savings | Mechanism |
|-------|-----------|------|---------|-----------|
| 1 | `fileReadDedup` | Free | ~30% | Replaces duplicate file reads with placeholder |
| 2 | `observationMasking` | Free | ~20% | Replaces large tool outputs with short summary |
| 3 | `convoSummary` | Expensive (LLM call) | ~50% | AI generates summary of older conversation turns |

**Trigger:** Before each model request, if `estimatedTokens > budget.conversation`.

**Pipeline runs in order:** If condenser 1 brings tokens under budget, condensers 2 and 3 are skipped.

### Consequences

- **Positive:** Graduated compression. Cheap deduplication handles most cases. Expensive LLM summary only when needed.
- **Negative:** `convoSummary` loses nuance. Token estimation must be accurate to avoid unnecessary compression.
- **Inspiration:** OpenHands (pipeline pattern), Cline (file dedup), Plandex (ConvoSummary).
