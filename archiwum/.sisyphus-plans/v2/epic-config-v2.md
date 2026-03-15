# Epic: Config v2 — Substitution, Local Config, GUI, Named Presets (v2.1)

> Package: `@diricode/core` + `@diricode/web`
> Iteration: **v2.1**
> Issue IDs: **DC-CFG-005..DC-CFG-009**

## Summary

Extends MVP's 4-layer config system (defaults → global → project → CLI flags) with config substitution, local per-developer config, a web-based configuration GUI, named work mode presets, and config hot-reload via file watchers.

Survey references: Config substitution deferred from MVP (DECYZJA-7), GUI for config (wishlist 10.3), named presets for work modes (`analiza-lean-mode.md` Section 9)
Config analysis: `analiza-config-layers.md` Section 5.9 (roadmap table — v2 column)

## Architectural Baseline

- MVP: 4 layers — defaults → global (`~/.config/dc/config.jsonc`) → project (`.dc/config.jsonc`) → CLI flags/env vars
- MVP: c12 (unjs) config loader with JSONC + .env support
- MVP: Zod schema validation with partial parsing (invalid section doesn't crash)
- MVP: `DC_*` env var prefix, `.env` loading from CWD
- MVP: defu merge strategy (leftmost wins, arrays concatenated, nullish skipped)
- OpenCode pattern: `{env:VAR}` and `{file:path}` substitution
- Claude Code pattern: `settings.local.json` (gitignored per-user overrides)

## Issues

### DC-CFG-005 — Config substitution engine

**Goal**: Enable `{env:VAR_NAME}` and `{file:path}` substitution syntax in JSONC config files.

**Scope**
- `{env:VAR_NAME}` → replaced with environment variable value at load time
- `{env:VAR_NAME:default}` → with fallback default value
- `{file:./relative/path}` → replaced with file contents (trimmed)
- `{file:~/.config/dc/secrets.txt}` → absolute/home-relative paths supported
- Substitution runs after c12 loads raw JSONC but before Zod validation
- Error handling:
  - Missing env var without default → Zod validation error (field is `undefined`)
  - Missing file → warning log + field is `undefined`
  - Circular references → detect and error
- Security: substitution ONLY in config files, never in skill/agent definitions (prevents injection)
- Nested substitution: NOT supported (keep it simple — no `{env:{file:...}}`)

**Acceptance criteria**
- [ ] `{env:VAR}` resolves to environment variable value
- [ ] `{env:VAR:default}` uses default when VAR is unset
- [ ] `{file:path}` resolves to file contents
- [ ] Substitution runs before Zod validation
- [ ] Missing env var without default results in Zod error
- [ ] Missing file produces warning, not crash
- [ ] Circular reference detection
- [ ] No substitution in skill/agent YAML frontmatter

**References**
- `analiza-config-layers.md` Section 4.1 (config substitution pattern from OpenCode)
- DECYZJA-7: "Config substitution: Nie w MVP (v2)" — explicitly deferred
- OpenCode source: `config.ts` — `{env:VAR_NAME}` pattern

---

### DC-CFG-006 — Local config layer (gitignored per-developer overrides)

**Goal**: Add a 5th config layer — `.dc/config.local.jsonc` — that is gitignored and allows per-developer overrides within a shared project.

**Scope**
- New layer priority: defaults → global → project → **local** → CLI flags
- File: `.dc/config.local.jsonc` — automatically gitignored
- Auto-setup: `diricode init` adds `.dc/config.local.jsonc` to `.gitignore`
- Use cases:
  - Personal model preference (override project's model)
  - Personal API keys (not in shared config)
  - Personal work mode defaults (e.g., more verbose than team default)
  - Disabled agents/hooks for personal workflow
- Merge: same defu strategy — local overrides project, arrays concatenated
- Init command: `diricode config init-local` creates template `.dc/config.local.jsonc`

**Acceptance criteria**
- [ ] `.dc/config.local.jsonc` loaded between project and CLI layers
- [ ] `.dc/config.local.jsonc` added to `.gitignore` by `diricode init`
- [ ] Local config overrides project config correctly
- [ ] defu merge works (arrays concatenated, deep merge on objects)
- [ ] `diricode config init-local` creates template file
- [ ] Template includes commented examples for common overrides

**References**
- `analiza-config-layers.md` Section 5.2 (`.dc/` directory structure — config.local.jsonc noted for v2)
- Claude Code pattern: `settings.local.json` (gitignored per-user overrides)
- DECYZJA-3: "4 warstwy MVP; local config odroczony do v2"

---

### DC-CFG-007 — Named work mode presets

**Goal**: Allow users to define and switch between named presets that set all 4 work mode dimensions at once.

**Scope**
- Preset = named combination of Quality + Autonomy + Verbose + Creativity
- Built-in presets:
  - `budget-dev`: Cheap + Auto-Edit + Silent + Reactive — minimize cost
  - `pm-poc`: POC + Auto-Edit + Compact + Helpful — quick prototyping for non-technical users
  - `standard`: Standard + Auto-Edit + Compact + Helpful — default (matches MVP defaults)
  - `production`: Production + Suggest + Explain + Research — thorough, safety-first
  - `super-review`: Super + Ask-Everything + Narrated + Creative — maximum quality + control
- Custom presets: user defines in config:
  ```jsonc
  "presets": {
    "my-flow": {
      "quality": "standard",
      "autonomy": "auto-execute",
      "verbose": "explain",
      "creativity": "research"
    }
  }
  ```
- CLI: `diricode --preset budget-dev` or `--preset my-flow`
- Web UI: preset dropdown next to dimension selectors
- Preset overridable: `--preset production --verbose narrated` (explicit dimension overrides preset)
- Config: presets defined in global or project config

**Acceptance criteria**
- [ ] 5 built-in presets available out of the box
- [ ] Custom presets definable in config
- [ ] CLI `--preset` flag sets all 4 dimensions
- [ ] Explicit dimension flag overrides preset value
- [ ] Web UI preset dropdown works
- [ ] Preset name shown in Metrics Bar / status area
- [ ] Invalid preset name → clear error message

**References**
- `analiza-lean-mode.md` Section 9 (MVP scope — presets deferred to v2/v3)
- `analiza-lean-mode.md` Section 2-5 (all 4 dimension definitions)
- ADR-011 (4-dimension work mode system)
- Plandex: 16 Model Packs (per-provider × tier) — precedent for preset concept

---

### DC-CFG-008 — Config hot-reload with file watchers

**Goal**: Automatically reload configuration when config files change on disk, without restarting DiriCode.

**Scope**
- Watch files: global config, project config, local config, `.env`
- c12 watcher support: enable c12's built-in file watcher
- On change:
  1. Re-load changed config file
  2. Re-run layer merge (defaults → global → project → local → CLI)
  3. Re-validate with Zod
  4. If valid: update in-memory config, emit `config-change` event (for v3 hook)
  5. If invalid: log warning, keep previous valid config
- Debounce: 500ms (rapid saves don't trigger multiple reloads)
- Notification: inform user via Live Activity Indicator ("Config reloaded")
- Affected systems: work mode dimensions, agent activation matrix, MCP server list, disabled hooks/agents

**Acceptance criteria**
- [ ] Config changes detected via file watcher
- [ ] New config loaded and merged correctly
- [ ] Zod validation on reload — invalid config keeps previous
- [ ] 500ms debounce prevents rapid-fire reloads
- [ ] User notified of config reload
- [ ] Agent activation matrix updates without restart
- [ ] MCP server list updates (new servers started, removed servers stopped)

**References**
- `analiza-config-layers.md` Section 5.8 (c12 — built-in watcher support)
- `analiza-config-layers.md` Section 5.9 (roadmap: config watchers in v2)
- c12 documentation: watcher API

---

### DC-CFG-009 — Web UI configuration editor

**Goal**: Provide a graphical interface for editing DiriCode configuration, so users don't need to manually edit JSONC files.

**Scope**
- Config editor page in Web UI: `/settings`
- Sections matching config schema:
  - General: model, provider, work mode defaults
  - Work Modes: dimension defaults + preset management
  - Agents: enable/disable agents, per-agent model override
  - Hooks: enable/disable hooks
  - MCP Servers: add/remove/configure MCP servers
  - Skills: manage installed skills
- Form-based editing: dropdowns, toggles, text inputs — not raw JSON editing
- JSON Schema-driven: form generated from Zod schema → JSON Schema
- Save targets: user selects which layer to save to (global / project / local)
- Validation: real-time validation as user edits (Zod errors shown inline)
- Preview: show resulting merged config before saving
- Export: download current config as JSONC file

**Acceptance criteria**
- [ ] `/settings` page renders all config sections
- [ ] Form controls match config schema types (dropdowns for enums, toggles for booleans)
- [ ] Save to specific layer (global/project/local)
- [ ] Real-time Zod validation with inline errors
- [ ] Preview shows merged result before saving
- [ ] Export downloads JSONC file
- [ ] Changes reflected immediately (triggers hot-reload from DC-CFG-008)

**References**
- Wishlist 10.3 (GUI for config — "not just JSON editing")
- `analiza-config-layers.md` Section 5.4 (Zod schema → JSON Schema generation for IDE/GUI)
- MVP `epic-web-ui.md` (Web UI architecture — Vite + React + shadcn/ui)
