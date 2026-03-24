# ADR-016 — 3-Layer Context Management Architecture

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-context-management.md, Survey Decision B3 |

### Context

Context management is critical for cost and quality. Models have different context windows (Copilot <200k, Kimi 1M), and most tasks don't need the full codebase. A layered approach separates indexing, compression, and composition.

### Decision

**3-layer architecture:**

| Layer | Component | Responsibility |
|-------|-----------|----------------|
| 1 | Structural Index | SQLite + tree-sitter + PageRank (ADR-018). Persistent knowledge of codebase structure. |
| 2 | Context Pipeline | 3-condenser pipeline (ADR-017). Compresses conversation to fit budget. |
| 3 | Context Composer | Assembles final prompt: system + tools + map + active files + conversation. Budget allocation per section. |

**Token budget allocation (MVP):**

| Section | Budget Share |
|---------|-------------|
| System prompt + tools + repo map | 20-40% |
| Active files (per subtask) | 30-50% |
| Conversation history | 10-20% |
| Reserve | 10-20% |

**Adaptive budgets:** Token limits are per-model (Copilot <200k gets tighter budgets than Kimi 1M).

**Progressive detail levels:** `minimal`, `standard`, `full` — applied per context section based on remaining budget.

### Consequences

- **Positive:** Efficient token usage. Each layer can evolve independently. Adaptive budgets maximize quality per model.
- **Negative:** 3 layers add implementation complexity. Budget tuning requires empirical testing.
- **Inspiration:** OpenHands (pipeline pattern), Aider (repo map), Plandex (context management).

### Addendum — Context Autopilot (Survey Decision B3, 2026-03-23)

Context Autopilot is absorbed into Layer 3 (Context Composer) rather than being a separate system. The Composer auto-detects which context categories are most relevant per task type:

- **Code tasks**: Prioritize active files + symbol index (60% budget)
- **Planning tasks**: Prioritize conversation history + project state (50% budget)
- **Review tasks**: Prioritize diff + test results + original spec (55% budget)

This replaces manual context category configuration. The architect agent (ADR-019) still selects specific files per subtask, but the Composer decides how much budget each category receives based on the task type signal.
