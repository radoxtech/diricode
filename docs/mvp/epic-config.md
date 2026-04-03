# Epic: Configuration System (POC)

> Package: `@diricode/core`  
> Iteration: **POC**  
> Issue IDs: **DC-CORE-001..DC-CORE-004**

---

## Summary

Build the MVP configuration system for DiriCode using **c12 + JSONC + Zod** with a deterministic **4-layer merge** and platform-aware path resolution for Linux/macOS.

This epic implements all resolved decisions from `analiza-config-layers.md`:
1. **Format:** JSONC
2. **Project dir:** `.dc/`
3. **Layers:** defaults → global → project → CLI/env
4. **Library:** c12 (unjs)
5. **Env prefix:** `DC_*`
6. **.env loading:** yes (CWD)
7. **Config substitution:** not in MVP (deferred to v2)
8. **Platforms:** Linux + macOS only (no Windows)

The output of this epic is a validated, typed, and observable config pipeline that can be reused by CLI/server/core initialization.

---

## Issue: DC-CORE-001 — Config schema definition with Zod

### Description

Define the canonical DiriCode config schema in `@diricode/core` with **Zod** as the single source of truth for runtime validation and static inference.

Scope must include all MVP config domains referenced by spec/ADRs:
- `providers` (provider defaults, routing mode, account/provider options)
- `agents` (enablement/overrides for agent-level config)
- `hooks` (enabled/disabled hooks, timeout/silent-fail toggles)
- `memory` (backend and feature toggles)
- `workMode` with all **4 dimensions** (quality, autonomy, verbose, creativity)
- project/system settings (paths, project-level options, feature switches)

The schema must provide:
- `DiriCodeConfigSchema` (full object schema)
- `DiriCodeConfig` type inferred from schema
- defaults embedded at schema level where possible (MVP sensible defaults)
- support for unknown-key detection pathway used by validation/reporting layer

This issue anchors decisions: JSONC shape, `.dc/` project structure, 4D work mode model, and MVP-only scope (no substitution profiles/features from v2+).

### Acceptance Criteria

- [ ] A single exported Zod schema models all MVP config sections listed above.
- [ ] Exported type is inferred from schema (`z.infer`), not hand-written.
- [ ] Default values exist for core MVP fields (provider/routing/work mode/safety toggles).
- [ ] Work mode dimensions map to ADR-012 levels and labels (or equivalent enums/union literals).
- [ ] Schema excludes v2/v3-only constructs from strict MVP contract (e.g., no config substitution engine).
- [ ] Schema is reusable by loader and watcher pipelines (DC-CORE-002, DC-CORE-004).

### References

- `analiza-config-layers.md` (PRIMARY SOURCE, decisions 1-8)
- `spec-mvp-diricode.md` (Section 6 Config + MVP scope)
- `docs/adr/adr-009-jsonc-config-c12-loader.md`
- `docs/adr/adr-010-dc-project-directory.md`
- `docs/adr/adr-011-4-layer-config-hierarchy.md`
- `docs/adr/adr-012-4-dimension-work-mode-system.md`
- `cross-cutting.md` (Zod-for-runtime-validation convention)

### Dependencies

- **Depends on:** none
- **Blocks:** DC-CORE-002, DC-CORE-004

---

## Issue: DC-CORE-002 — c12 config loader with 4-layer merge

### Description

Implement the configuration loader using **c12** with explicit 4-layer precedence and deterministic merge behavior.

Required layer order (lowest → highest):
1. Hardcoded defaults (from Zod/default schema)
2. Global config file
3. Project config file
4. Runtime overrides from CLI flags and `DC_*` env vars

Global file locations:
- Linux: `$XDG_CONFIG_HOME/dc/config.jsonc` fallback `~/.config/dc/config.jsonc`
- macOS: `~/Library/Preferences/dc/config.jsonc`

Project file location:
- `.dc/config.jsonc`

Loader behavior requirements:
- Parse JSONC files
- Load `.env` from CWD for env hydration
- Use `DC_*` prefix for env override mapping
- Apply deep merge semantics via defu/c12-compatible strategy (higher-priority layers win while preserving deep object merges)
- Produce a normalized merged config object for downstream validation

Explicit MVP boundary:
- No config substitution (`{env:...}`/`{file:...}` or `${...}` style) in MVP
- No Windows branch

### Acceptance Criteria

- [ ] Loader resolves and merges all four layers in documented order.
- [ ] `.env` in CWD is loaded during config bootstrap.
- [ ] `DC_*` env vars override lower layers according to hierarchy.
- [ ] JSONC comments are accepted in both global and project config.
- [ ] Merge is deep and deterministic, with conflict resolution matching ADR-011 intent.
- [ ] Final merged output is passed to validation pipeline (DC-CORE-004).

### References

- `analiza-config-layers.md` (PRIMARY SOURCE, decisions 3,4,5,6,7,8)
- `docs/adr/adr-009-jsonc-config-c12-loader.md`
- `docs/adr/adr-011-4-layer-config-hierarchy.md`
- `spec-mvp-diricode.md` (Config hierarchy and examples)

### Dependencies

- **Depends on:** DC-CORE-001
- **Blocks:** DC-CORE-004

---

## Issue: DC-CORE-003 — Platform-aware path resolution

### Description

Implement path utilities for config discovery focused on MVP-supported platforms: **Linux and macOS only**.

Functions required:
- `getGlobalConfigDir()`
- `getProjectConfigDir()`
- `getConfigFilePath(scope)` or equivalent helper for final file path resolution

Behavior:
- Linux global path follows XDG (`$XDG_CONFIG_HOME/dc` fallback `~/.config/dc`)
- macOS global path uses `~/Library/Preferences/dc`
- Project path is `.dc/` rooted at current project context
- Optional env override support for config dir (`DC_CONFIG_DIR`) where consistent with loader
- Return clear/typed errors for unsupported platform

Out-of-scope:
- Windows support (deferred)
- v2/v3 path features (managed/remote/profile expansion)

### Acceptance Criteria

- [ ] Utilities return correct global config directory on Linux and macOS.
- [ ] Linux respects XDG fallback chain.
- [ ] Project config directory always resolves to `.dc/`.
- [ ] Unsupported platform handling is explicit and testable.
- [ ] Utilities are consumed by loader path selection (DC-CORE-002).

### References

- `analiza-config-layers.md` (PRIMARY SOURCE, decisions 2,8)
- `docs/adr/adr-010-dc-project-directory.md`
- `docs/adr/adr-011-4-layer-config-hierarchy.md`
- `spec-mvp-diricode.md` (platform constraints)

### Dependencies

- **Depends on:** none
- **Blocks:** DC-CORE-002

---

## Issue: DC-CORE-004 — Config validation and error reporting

### Description

Build validation, diagnostics, and developer-mode observability around the merged config.

Validation responsibilities:
- Validate merged config with Zod parse/safeParse
- Emit human-readable, field-level error messages
- Include **layer provenance** in errors (which layer introduced invalid value)
- Warn on unknown keys (non-fatal in MVP), but continue if valid subset can be loaded

Runtime/dev responsibilities:
- Add config watcher (dev mode) for config file changes
- On file change: reload relevant layer(s) → merge → validate → emit typed config-changed/validation event
- Keep failure mode safe: invalid updates should not crash system; preserve last known valid config where applicable

MVP alignment:
- Unknown keys are warnings, not hard failures
- No substitution engine
- Linux/macOS watcher targets only

### Acceptance Criteria

- [ ] Validation errors include path, expected type/rule, received value, and actionable message.
- [ ] Error output includes source layer attribution (defaults/global/project/CLI-env).
- [ ] Unknown keys generate warnings without aborting startup by default.
- [ ] Dev watcher re-validates on config file change and emits event payload.
- [ ] Invalid reload does not crash runtime loop; behavior is deterministic and logged.

### References

- `analiza-config-layers.md` (PRIMARY SOURCE, decisions 1-8 + partial-parse pattern)
- `docs/adr/adr-009-jsonc-config-c12-loader.md`
- `docs/adr/adr-011-4-layer-config-hierarchy.md`
- `docs/adr/adr-012-4-dimension-work-mode-system.md`
- `cross-cutting.md` (typed errors, structured logging)

### Dependencies

- **Depends on:** DC-CORE-001, DC-CORE-002
- **Blocked by (optional):** none

---

## Must NOT (MVP guardrails)

- Must NOT add Windows config path support in this epic.
- Must NOT introduce config substitution (`{env:VAR}`, `{file:path}`, `${VAR}`) in MVP.
- Must NOT add managed/enterprise or remote-org config layers.
- Must NOT expand beyond 4-layer hierarchy.
- Must NOT store secrets in project-committed defaults/templates.
- Must NOT couple config loading logic to UI-specific implementation details.
- Must NOT fail hard on unknown keys (warning path required in MVP).

---

## Dependencies (Epic-level)

### Upstream
- `DC-SETUP-*` monorepo/package scaffolding (for package wiring)
- Core logging/error primitives from `@diricode/core` conventions

### Downstream (consumers of this epic)
- `epic-diri-router` (`@diricode/diri-router`) — provider/account/routing config
- `epic-agents-core` + `epic-agents-roster` — agent/hook defaults and toggles
- `epic-pipeline` — work-mode defaults and execution guardrail config
- `epic-cli` — CLI flags mapped to layer-4 overrides
- `epic-web-ui` / observability — config change events (later iterations)

### Issue Graph
- `DC-CORE-001` → `DC-CORE-002` → `DC-CORE-004`
- `DC-CORE-003` → `DC-CORE-002`
- `DC-CORE-001` + `DC-CORE-002` → `DC-CORE-004`

---

## Notes for Planning Consistency

- ADR filenames in this repo are:
  - `adr-009-jsonc-config-c12-loader.md`
  - `adr-010-dc-project-directory.md`
  - `adr-011-4-layer-config-hierarchy.md`
  - `adr-012-4-dimension-work-mode-system.md`
- These correspond to the configuration decisions requested in planning scope.
