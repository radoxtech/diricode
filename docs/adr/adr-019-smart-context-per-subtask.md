# ADR-019 — Smart Context per Subtask (Architect Agent)

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-context-management.md                 |

### Context

Loading the entire codebase into every agent's context is wasteful and often impossible (Copilot <200k). The architect agent analyzes each subtask and selects only the relevant files.

### Decision

**Architect agent decides which files each subtask needs.** Files are loaded selectively.

Mechanism:
- Architect analyzes the subtask and produces a `usesFiles` list.
- Code-writer receives **ONLY** files from `usesFiles` (not the whole repo).
- **Auto-loading:** Files mentioned in backticks in architect's response are automatically loaded.
- **Pending files:** Files in queue show only their size (not content) — saves tokens.

### Consequences

- **Positive:** Most effective approach — sends ONLY what's needed. Critical for Copilot <200k context window. Reduces cost significantly.
- **Negative:** Architect might miss relevant files. Mitigated by auto-loading from backtick mentions and agent ability to request additional files.
- **Inspiration:** Plandex (UsesFiles per subtask, checkAutoLoadContext).
