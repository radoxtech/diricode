# ADR-021 — Embeddings Deferred to v2

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | v2                                            |
| References  | analiza-context-management.md                 |

### Context

Semantic embeddings enable similarity-based code search, but require additional infrastructure (vector DB or vector extension). Tree-sitter + PageRank + ripgrep covers ~90% of code navigation use cases.

### Decision

**No semantic embeddings in MVP.** Tree-sitter + PageRank + ripgrep is sufficient.

**v2 plan:** Add embeddings per symbol/file using hnswlib or SQLite vector extension.

### Consequences

- **Positive:** Simpler MVP. No vector DB dependency. Faster cold start.
- **Negative:** No semantic code search ("find code that does X" without knowing the function name). Acceptable for solo developer MVP.
