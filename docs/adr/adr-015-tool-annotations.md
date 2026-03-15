# ADR-015 — Tool Annotations

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-narzedzi-ekosystem.md                 |

### Context

Every tool (file read, bash exec, git operations, etc.) should declare its safety characteristics so the approval system and UI can make informed decisions.

### Decision

Every tool carries 3 annotations:
- `readOnlyHint: boolean` — Does this tool only read data?
- `destructiveHint: boolean` — Can this tool cause irreversible damage?
- `idempotentHint: boolean` — Is repeated execution safe?

**MVP:** Annotations are assigned to tools and displayed in UI.
**v2:** Annotation-driven approval flow replaces the policy map (ADR-014).

### Consequences

- **Positive:** Machine-readable safety metadata. Enables automatic approval decisions in v2.
- **Negative:** Annotations must be accurate — a wrong `readOnlyHint: true` on a destructive tool would bypass safety checks.
