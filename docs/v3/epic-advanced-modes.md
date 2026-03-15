# Epic: Advanced UX Modes — Enterprise Config, Speech-to-Text & Marketplace v2 (v3.1)

> Package: `@diricode/core` + `@diricode/web` + `@diricode/cli`
> Iteration: **v3.1**
> Issue IDs: **DC-ADVUX-001..DC-ADVUX-006**

## Summary

This epic groups several v3-scoped advanced features that don't warrant their own epic but are individually important:

1. **Managed/enterprise config** — highest-priority config layer that admins control and users cannot override (from OpenCode/Codex/Claude Code pattern)
2. **Remote org defaults** — `.well-known/diricode` remote config for organization-wide settings
3. **Profile system** — Codex-style per-project config profiles for different workflows
4. **Speech-to-text input** — voice input for the prompt field
5. **Marketplace v2 features** — star/popularity ranking, license compatibility filter, auto-update check for skills

Source:
- `analiza-config-layers.md` Section 5.9 (v3 roadmap: managed/enterprise config, remote org defaults, profile system)
- `analiza-config-layers.md` Section 2.1 (OpenCode 7-layer stack with managed layer)
- `zyczenia-codewroc.md` Section 7.1: "Speech-to-text — wbudowany, nie jako PR czekający 6 miesięcy"
- `ankieta-features-ekosystem.md` PODSUMOWANIE v3+: 10.3 (star/popularity ranking), 10.4 (license compatibility filter), 10.6 (auto-update check)
- `zyczenia-codewroc.md` Section 10.3: "GUI do konfiguracji — nie tylko edycja JSON (nice to have)"

## Architectural Baseline

- MVP: 4 config layers: defaults → global → project → CLI flags (via c12 + Zod)
- v2: adds local config (`.dc/config.local.jsonc`), config substitution (`{env:VAR}`), extends, watchers, custom commands, plugins, Windows support
- v2: Config GUI (DC-CFG-009) — web-based visual config editor
- v2: Marketplace/skill catalog (DC-MKT-001..006) — skill discovery and installation
- v3 extends config with 2 new layers at the top (managed) and bottom (remote org defaults) of the priority stack
- v3 extends marketplace with analytics and safety features

## Issues

### DC-ADVUX-001 — Managed/enterprise config layer

**Goal**: Add a highest-priority config layer that enterprise administrators can set, which individual users cannot override — enforcing organizational policies like approved models, disabled agents, mandatory approval levels, and cost limits.

**Scope**
- Managed config layer:
  - **Highest priority** in the config stack — overrides everything including CLI flags
  - Updated layer hierarchy (7 layers, matching OpenCode pattern):
    1. Remote org defaults (lowest — DC-ADVUX-002)
    2. Defaults (hardcoded)
    3. Global user config (`~/.config/dc/`)
    4. Project config (`.dc/config.jsonc`)
    5. Local config (`.dc/config.local.jsonc`) — v2
    6. CLI flags + env vars (`DC_*`)
    7. **Managed config (highest)** — this issue
  - Managed config source options:
    - File at `~/.config/dc/managed.jsonc` (deployed by IT tools like MDM/Puppet/Ansible)
    - Environment variable `DC_MANAGED_CONFIG` pointing to file path
    - Remote URL (fetched on startup, cached locally)
  - Managed settings are **read-only** from user perspective — no `dc config set` for managed keys
  - Visual indicator in web UI / TUI: managed settings show 🔒 lock icon and "Set by admin" tooltip
- Typical managed settings:
  - `allowedModels`: restrict which AI models can be used
  - `blockedModels`: blacklist specific models
  - `maxCostPerTurn`: cost limit per turn
  - `maxCostPerSession`: cost limit per session
  - `minAutonomy`: minimum autonomy level (e.g., force "Suggest" or higher — prevent full auto)
  - `requiredHooks`: hooks that must be active (e.g., license-checker always on)
  - `disabledAgents`: agents that cannot be used
  - `approvedProviders`: restrict which providers are allowed
- Merge behavior: managed settings **always win** — deep merge with managed values taking precedence over all lower layers

**Acceptance criteria**
- [ ] Managed config loaded from `~/.config/dc/managed.jsonc` or `DC_MANAGED_CONFIG` path
- [ ] Managed settings override ALL other config layers (including CLI flags)
- [ ] `dc config set` refuses to modify managed keys with clear error message
- [ ] `dc config show` displays managed settings with 🔒 indicator
- [ ] Web UI shows lock icon on managed settings in Config GUI
- [ ] `allowedModels`, `maxCostPerTurn`, `minAutonomy`, `requiredHooks` all enforceable
- [ ] Config validation: if user config conflicts with managed config, managed wins silently (logged at debug level)

**References**
- `analiza-config-layers.md` Section 2.1 (OpenCode: layer 7 "Managed — enterprise, najwyższy")
- `analiza-config-layers.md` Section 5.9 (v3 roadmap: "Managed/enterprise config")
- `analiza-config-layers.md` Section 3.2 pattern 1: "Managed/enterprise config: OpenCode, Codex, Claude Code — admin-controlled settings which users cannot override"
- Claude Code: `settings.json` managed layer (CHANGELOG reference)
- Codex: managed features layer (highest priority in ConfigLayerStack)

---

### DC-ADVUX-002 — Remote org defaults

**Goal**: Allow organizations to publish default DiriCode configuration at a well-known URL, automatically loaded as the lowest-priority layer — providing org-wide sensible defaults that users can override.

**Scope**
- Remote config discovery:
  - URL pattern: `https://{org-domain}/.well-known/diricode.jsonc`
  - Alternatively: configured URL in global config `"remoteDefaults": "https://company.com/.well-known/diricode.jsonc"`
  - Fetched on startup with 3-second timeout (non-blocking)
  - Cached locally (`~/.cache/dc/remote-defaults.jsonc`) — used if fetch fails
  - Cache TTL: 24 hours (configurable)
- Layer position: **lowest priority** — below hardcoded defaults but above nothing
  - Updated hierarchy with remote defaults:
    1. **Remote org defaults** (this issue)
    2. Defaults (hardcoded)
    3. Global user config
    4. Project config
    5. Local config
    6. CLI flags
    7. Managed config (highest)
- Typical remote default settings:
  - `defaultModel`: org-preferred model
  - `defaultProvider`: org-preferred provider
  - `mcpServers`: org-wide MCP servers (e.g., internal documentation search)
  - `agents.custom`: org-specific custom agents
  - `rules`: org-wide coding rules/guidelines
- Security:
  - HTTPS only (no HTTP)
  - Validate JSON schema before applying
  - Log a warning if remote defaults contain unexpected keys
  - Never include secrets in remote defaults (validation check)

**Acceptance criteria**
- [ ] Remote defaults fetched from `https://{domain}/.well-known/diricode.jsonc`
- [ ] Configurable URL via `"remoteDefaults"` in global config
- [ ] 3-second timeout, non-blocking (startup not delayed if fetch fails)
- [ ] Local cache at `~/.cache/dc/remote-defaults.jsonc` with 24h TTL
- [ ] Remote defaults are lowest-priority layer (everything overrides them)
- [ ] HTTPS-only enforcement
- [ ] Schema validation before applying remote config
- [ ] `dc config show --layers` displays remote defaults layer

**References**
- `analiza-config-layers.md` Section 2.1 (OpenCode: layer 1 "Remote `.well-known/opencode` — org defaults")
- `analiza-config-layers.md` Section 5.9 (v3 roadmap: "Remote org defaults")
- `.well-known` URI convention: RFC 8615

---

### DC-ADVUX-003 — Profile system (named config presets)

**Goal**: Allow users to define named config profiles (e.g., "quick-fix", "deep-work", "review-only") that can be activated with a single command, bundling work mode dimensions and other settings into reusable presets.

**Scope**
- Profile definition in config:
  ```jsonc
  {
    "profiles": {
      "quick-fix": {
        "quality": "poc",
        "autonomy": "auto-execute",
        "verbose": "compact",
        "creativity": "reactive",
        "model": "claude-haiku"
      },
      "deep-work": {
        "quality": "production",
        "autonomy": "suggest",
        "verbose": "explain",
        "creativity": "research",
        "model": "claude-opus"
      },
      "review-only": {
        "quality": "standard",
        "autonomy": "ask-everything",
        "verbose": "narrated",
        "disabled_agents": ["code-writer", "code-writer-quick"]
      }
    }
  }
  ```
- Profile activation:
  - CLI: `dc --profile quick-fix` or `dc -p quick-fix`
  - In-session: `/profile deep-work` slash command
  - Env var: `DC_PROFILE=quick-fix`
- Profile resolution: profile settings merge ON TOP of normal config (between project config and CLI flags)
- Built-in profiles: DiriCode ships with 3 default profiles that users can customize:
  - `quick`: quality=poc, autonomy=auto-execute, verbose=compact, creativity=reactive
  - `standard`: (current defaults — quality=standard, autonomy=auto-edit, verbose=compact, creativity=helpful)
  - `thorough`: quality=production, autonomy=suggest, verbose=explain, creativity=research
- Profile inheritance: `"extends": "standard"` — profile can extend another profile
- Codex inspiration: Codex has per-project profiles via its config layer stack

**Acceptance criteria**
- [ ] Profiles definable in global and project config under `"profiles"` key
- [ ] Profile activated via `--profile` CLI flag, `/profile` command, or `DC_PROFILE` env var
- [ ] Profile settings merge between project config and CLI flags in priority
- [ ] 3 built-in profiles shipped: `quick`, `standard`, `thorough`
- [ ] Profile inheritance via `"extends"` key
- [ ] `dc config profiles` lists all available profiles with their settings
- [ ] Active profile shown in Metrics Bar / status indicator

**References**
- `analiza-config-layers.md` Section 5.9 (v3 roadmap: "Profile system — Codex-style")
- `analiza-lean-mode.md` (4-dimension work modes — profiles bundle these dimensions)
- v2 `epic-config-v2.md` DC-CFG-008 (named presets — profiles build on this foundation)
- Codex: per-project profiles in config layer stack

---

### DC-ADVUX-004 — Speech-to-text input

**Goal**: Integrate speech-to-text functionality into DiriCode's input field (web UI and optionally TUI), allowing users to dictate prompts instead of typing — fulfilling a wishlist item explicitly called out as missing from competitors.

**Scope**
- Web UI integration:
  - Microphone button in the prompt input area
  - Click to start recording → transcribe → insert text into prompt field
  - Visual indicator: recording state (red dot / pulsing icon), transcription in progress
  - "Stop recording" button to end and submit
- Speech recognition engine:
  - **Option A (recommended)**: Web Speech API (browser-native, zero dependency, supported in Chrome/Edge/Safari)
  - **Option B**: Whisper.cpp (local, offline capable, higher accuracy) — consider for v3.1+ if browser API insufficient
  - **Option C**: OpenAI Whisper API (cloud, highest accuracy, but adds API cost and latency)
  - Start with Option A (Web Speech API) — zero cost, zero setup, works immediately
- Language support: English primary, user's browser locale as fallback
- TUI consideration: TUI speech-to-text is harder (no browser APIs). Options:
  - Shell-out to `whisper.cpp` CLI for offline transcription
  - Mark as "web UI only" initially, TUI support as follow-up
- Privacy: if using browser Web Speech API, audio may be sent to Google/Apple servers for processing — document this clearly. Offline option (Whisper.cpp) for privacy-sensitive users.

**Acceptance criteria**
- [ ] Microphone button visible in web UI prompt input area
- [ ] Click starts recording, click again stops recording
- [ ] Visual indicator for recording state (red dot + animation)
- [ ] Transcribed text inserted into prompt field for review before sending
- [ ] Web Speech API used as default engine (zero dependency)
- [ ] Graceful fallback: if browser doesn't support Web Speech API, hide microphone button
- [ ] Privacy notice: tooltip explaining that audio may be processed externally (browser-dependent)
- [ ] User can edit transcribed text before submitting

**References**
- `zyczenia-codewroc.md` Section 7.1: "Speech-to-text — wbudowany, nie jako PR czekający 6 miesięcy (lekcja z OC #4695)"
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- Whisper.cpp: https://github.com/ggerganov/whisper.cpp (offline alternative)
- OpenCode issue #4695 (speech-to-text PR stalled for months — DiriCode ships it)

---

### DC-ADVUX-005 — Marketplace v2: popularity ranking and license filter

**Goal**: Extend the v2 skill marketplace/catalog with popularity-based ranking and license compatibility filtering — helping users discover the best and safest skills.

**Scope**
- Popularity ranking (survey 10.3):
  - Star/like system: users can star skills they find useful
  - Download count: track how many times a skill has been installed
  - Ranking algorithm: weighted score combining stars, downloads, recency, and author reputation
  - Display: ranked list in marketplace with star count and download count badges
  - Data storage: marketplace metadata in DiriCode's central registry (hosted service or GitHub-based)
- License compatibility filter (survey 10.4):
  - Each skill declares its license in frontmatter (`license: MIT`)
  - User's project license detected from `package.json` or `LICENSE` file
  - Filter: "Show only skills compatible with my project license"
  - Compatibility matrix: MIT ✅ with everything, GPL ❌ with proprietary, Apache ✅ with MIT, etc.
  - Warning: if user tries to install incompatible skill → clear warning with explanation
  - References `analiza-licencji.md` for license safety matrix
- Auto-update check (survey 10.6):
  - On session start (or configurable interval): check installed skills for available updates
  - Non-blocking: 3-second timeout, cache result for 24 hours
  - Notification: "3 skills have updates available. Run `dc skills update` to upgrade."
  - No auto-install: user explicitly triggers update (safety)

**Acceptance criteria**
- [ ] Skills display star count and download count in marketplace listing
- [ ] Users can star/unstar skills from marketplace UI
- [ ] Ranking algorithm sorts skills by weighted score
- [ ] License field in skill frontmatter parsed and displayed
- [ ] License compatibility filter available in marketplace search
- [ ] Incompatible license warning shown before install (with explanation)
- [ ] Auto-update check runs on session start with 3s timeout
- [ ] Update notification shown (non-blocking) when updates available
- [ ] `dc skills update` command applies pending updates

**References**
- `ankieta-features-ekosystem.md` 10.3: "Star/popularity ranking"
- `ankieta-features-ekosystem.md` 10.4: "License compatibility filter"
- `ankieta-features-ekosystem.md` 10.6: "Auto-update check"
- `analiza-licencji.md` (license safety matrix — compatibility rules)
- v2 `epic-marketplace.md` DC-MKT-001..006 (marketplace foundation)

---

### DC-ADVUX-006 — Config GUI enhancements for v3 layers

**Goal**: Extend the v2 Config GUI (DC-CFG-009) to visualize and manage the new v3 config layers — managed config (read-only view), remote org defaults, and profiles.

**Scope**
- Managed config in GUI:
  - Read-only section showing managed settings with 🔒 lock icons
  - Tooltip: "This setting is controlled by your organization administrator"
  - Cannot be edited through GUI (enforced)
  - Source display: shows where managed config is loaded from (file path or URL)
- Remote org defaults in GUI:
  - Section showing remote defaults with "Org defaults" label
  - Override indicator: show when a user setting overrides an org default
  - Cache status: "Last fetched: 2h ago" with manual refresh button
  - Connection status: green if reachable, red if using cached version
- Profile manager in GUI:
  - List all profiles (built-in + custom)
  - Create new profile: form with all work mode dimensions + model + custom settings
  - Edit existing profile
  - Activate profile: one-click activation
  - Profile comparison: side-by-side view of two profiles
- Layer visualizer (enhancement):
  - Show all 7 config layers with their current values
  - Highlight which layer is "winning" for each setting
  - Useful for debugging config issues ("why is my model setting being overridden?")

**Acceptance criteria**
- [ ] Managed config section visible in Config GUI (read-only, with lock icons)
- [ ] Remote org defaults section with cache status and refresh button
- [ ] Profile manager: list, create, edit, delete, activate profiles
- [ ] Profile comparison: side-by-side view of two profiles
- [ ] Layer visualizer: all 7 layers shown with "winning" layer highlighted per setting
- [ ] Override indicators: show when a higher layer overrides a lower layer's value
- [ ] All new sections respect Verbose dimension (compact vs full detail)

**References**
- v2 `epic-config-v2.md` DC-CFG-009 (Config GUI foundation)
- DC-ADVUX-001 (managed config — GUI must display it)
- DC-ADVUX-002 (remote org defaults — GUI must display them)
- DC-ADVUX-003 (profiles — GUI must manage them)
- `zyczenia-codewroc.md` Section 10.3: "GUI do konfiguracji"
