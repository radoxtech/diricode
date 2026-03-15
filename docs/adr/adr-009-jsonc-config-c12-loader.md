# ADR-009 — JSONC Config Format with c12 Loader

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-config-layers.md (DECYZJA-1, DECYZJA-4) |

### Context

Configuration format must be editable by non-technical users, support comments for documentation, and have reliable tooling. TypeScript config was considered but rejected — too complex for target users, and c12 (unjs) provides a battle-tested loader.

### Decision

**JSONC** (JSON with Comments) as the configuration format, loaded by **c12** (unjs).

- Config file: `.dc/config.jsonc` (project-level) and `~/.config/dc/config.jsonc` (global).
- Validation: **Zod** schemas.
- Merge strategy: **defu** (deep defaults merge from c12).
- No TypeScript config files in MVP.

Example:
```jsonc
{
  // DiriCode project configuration
  "providers": {
    "default": "copilot",
    "routing": "failover"
  },
  "agents": {
    "dispatcher": { "family": "reasoning" }
  }
}
```

### Consequences

- **Positive:** Human-readable, commentable, no build step. c12 handles file discovery, env var loading, and merge automatically.
- **Negative:** No type checking at write-time (mitigated by Zod validation at load-time). JSON schema for IDE autocomplete can be provided later.
