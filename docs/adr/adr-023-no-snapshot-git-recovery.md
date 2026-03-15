# ADR-023 — No Snapshot System (Git-Based Recovery)

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

Some AI coding tools implement their own undo/snapshot systems. DiriCode relies on git for versioning, making a separate snapshot engine redundant.

### Decision

**No snapshot/undo engine in MVP.** Recovery relies on:
- Git atomic commits per task (ADR-013).
- Checkpoint protocols in the pipeline.
- Standard git operations (revert, reset, checkout).

### Consequences

- **Positive:** No duplicate versioning. Git is the single source of truth for code state.
- **Negative:** Recovery granularity limited to commit boundaries. Mid-task recovery depends on checkpoint quality.
