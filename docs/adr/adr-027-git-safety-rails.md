# ADR-027 — Git Safety Rails

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

AI agents executing git commands can cause irreversible damage (force push, hard reset, data loss). Hard safety rules are non-negotiable.

### Decision

**Mandatory git safety rules (no exceptions):**

| Rule | Enforcement |
|------|-------------|
| Never `git add .` without explicit review of staged files | Hard block |
| `git push --force` requires additional explicit confirm | Always prompt |
| `git reset --hard` requires confirmation | Always prompt |
| Atomic commits per task | Enforced by pipeline |
| Branch protection | Respect remote branch protection rules |

These rules apply regardless of the Autonomy dimension (ADR-012) setting — even "Full Auto" mode cannot bypass git safety rails.

### Consequences

- **Positive:** Prevents catastrophic data loss. Users can trust agents with git operations.
- **Negative:** Slightly slower workflow due to confirmations. Acceptable trade-off for safety.
