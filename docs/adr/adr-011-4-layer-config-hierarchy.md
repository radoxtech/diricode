# ADR-011 — 4-Layer Config Hierarchy

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-config-layers.md (DECYZJA-3)          |

### Context

Configuration needs to come from multiple sources with clear precedence. The old spec proposed 7 layers — too complex for MVP. Analysis reduced this to 4 layers.

### Decision

**4 config layers** in MVP, highest priority wins:

| Priority | Layer | Source | Example |
|----------|-------|--------|---------|
| 4 (highest) | CLI flags + env vars | `--provider copilot`, `DC_PROVIDER=copilot` | Runtime overrides |
| 3 | Project config | `.dc/config.jsonc` | Per-project settings |
| 2 | Global config | `~/.config/dc/config.jsonc` | User-wide defaults |
| 1 (lowest) | Built-in defaults | Hardcoded in DiriCode | Sensible defaults |

Additional rules:
- **Env var prefix:** `DC_*` (not `DIRICODE_*` — DECYZJA-5).
- **`.env` loading:** Yes, from CWD (DECYZJA-6).
- **Config substitution (`${DC_FOO}` in JSONC):** Not in MVP, deferred to v2 (DECYZJA-7).
- **Merge strategy:** defu (deep defaults merge via c12).

### Consequences

- **Positive:** Simple, predictable. Users understand "project overrides global overrides defaults."
- **Negative:** No per-agent or per-hook config overrides in MVP (can be added in v2 as additional layers).
