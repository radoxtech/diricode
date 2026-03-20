# Porównanie: DiriCode vs OpenCode vs OMO vs Claude Code vs Codex

> Data: 7 marca 2026
> Cel: Porównanie sposobu działania, mechanizmów i feature'ów pięciu narzędzi CLI AI do kodowania
> Źródła: spec-mvp-diricode.md, analiza-claude-code.md, analiza-codex.md, architektura-opencode-omo.md, mapa-funkcje.md, mapa-braki.md, repozytoria źródłowe

> **⚠️ KOREKTA (7 marca 2026, aktualizacja):** Dokument zaktualizowany po deep-dive w kod źródłowy Codex (170+ plików .rs) i Claude Code (7 pluginów, 35+ plików). Poprawiono błędy (m.in. Codex MA web search — wcześniej oznaczony jako ❌). Dodano sekcję 12 "Ukryte Mechanizmy Wewnętrzne" z 34 mechanizmami Codex i 8 mechanizmami Claude Code niewidocznymi z README.

---

## 1. Tożsamość i Pozycjonowanie

| Cecha | DiriCode | OpenCode | OMO (Oh-My-OpenCode) | Claude Code | Codex (OpenAI) |
|-------|----------|----------|----------------------|-------------|----------------|
| **Typ** | Standalone CLI agent | Standalone CLI agent | Plugin do OpenCode | Standalone CLI agent | Standalone CLI agent |
| **Licencja** | MIT (planowana) | Open-source | SUL-1.0 (niestandardowa) | Proprietary (Anthropic Commercial ToS) | Apache-2.0 |
| **Język impl.** | TypeScript (Bun) | Go + TypeScript (Bun) | TypeScript (Bun) | TypeScript | Rust + TypeScript (wrapper) |
| **Runtime** | Bun | Bun | Bun (plugin do OpenCode) | Node.js | Natywny Rust binary |
| **Target user** | Solo developer | Solo dev → zespoły | Zaawansowani deweloperzy | Solo dev → enterprise | Solo dev → enterprise |
| **Interfejsy** | CLI (TUI Ink/React) + Web UI | TUI (Bubble Tea) + Desktop + VS Code | — (rozszerza OpenCode) | CLI + VS Code + Voice + Remote API | CLI (TUI ratatui) + IDE + Desktop + Web + SDK |
| **Model biznesowy** | Open-source, BYOK | Open-source + OpenCode Zen (komercja) | Open-source (niestd. licencja) | Komercja (Anthropic API/subskrypcja) | Open-source, BYOK |
| **Tagline** | "Diri jak dyrygent" — dispatcher-first | "Open-source Claude Code alternative" | "Human intervention = failure signal" | "Agentic coding tool in your terminal" | "Agentic coding tool in your terminal" |

**Kluczowe obserwacje:**
- **DiriCode** i **Codex** to jedyne projekty z licencją przyjazną dla firm (MIT / Apache-2.0)
- **OMO** nie istnieje bez OpenCode — jest pluginem, nie standalone
- **Claude Code** to jedyny zamknięty projekt — zero dostępu do core'a
- **Codex** w Rust ma najwyższą wydajność natywną, ale najwyższy próg dla kontrybutorów

---

## 2. Architektura Agentowa

### 2.1 Model orkiestracji

| Cecha | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-------|----------|----------|-----|-------------|-------|
| **Model** | Dispatcher-first (hierarchiczny) | Flat (2 agenty: build + plan) | Multi-agent orkiestracja (11 agentów) | Flat + plugin-based agents | Thread-based multi-agent |
| **Agent główny** | Read-only dispatcher (zero write/edit/bash) | build agent (pełny dostęp) | Sisyphus orkiestrator (pełny dostęp) | Brak wydzielonego — core ma pełny dostęp | Pełny dostęp, ograniczany sandbox+approval |
| **Ile agentów?** | 10+ predefiniowanych specjalistów | 7 wbudowanych (build, plan, debug, code-review, init, compaction, system) | 11 wyspecjalizowanych | 13+ pluginów, każdy z wieloma agentami | Dynamiczny spawn — ile potrzeba |
| **Delegacja** | Unlimited nesting + loop detector | task tool → sub-sesja | task + call_omo_agent (2 mechanizmy) | Flat — komendy spawnują agentów | Thread-based: spawn_agent → send_input → wait → close_agent |
| **Nesting** | Bez limitu (z detektorem pętli) | 1 poziom (task → sub-sesja) | Wielopoziomowy | Brak (flat) | Kontrolowany: agent_max_depth + agent_max_threads |

### 2.2 Szczegóły agentów

| Cecha | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-------|----------|----------|-----|-------------|-------|
| **Definicja agenta** | Execution Policies (TS, niezmienne) + Agent Guards (.md, konfigurowalne) | AgentConfig (JSON: name, instructions, model, tools, permissions) | Agents jako obiekty TS z YAML config + dynamiczny prompt builder | Pliki .md z YAML frontmatter | Role system (TOML config layers) + Personality templates |
| **Per-agent model** | Tak (aliasy: diricode-fast, diricode-balanced, diricode-deep) | Tak (model w AgentConfig) | Tak (primary=UI model, subagent=własny fallback chain) | Tak (model: haiku/sonnet/opus w YAML) | Tak (role overriduje model/provider) |
| **Tool restrictions** | Lista dozwolonych narzędzi per agent | permission ruleset per agent (allow/deny/ask) | createAgentToolRestrictions() — deny list lub allowlist | Pattern-based: `Bash(git add:*)` — granularne per-komenda | Sandbox-based (ReadOnly, WorkspaceWrite, DangerFullAccess) |
| **Loop protection** | Hard limit iteracji + token budget + loop detector | Doom loop detection (3 identyczne tool calls → permission check) | Todo continuation loop (buggy — #668), Ralph Loop z stop guards | Nieznane z warstwy pluginów | agent_max_depth + agent_max_threads (2 wymiary) |
| **Kontekst agenta** | Dispatcher = minimalny (widzi tylko summary wyników) | Pełna historia sesji per agent | Dynamic prompt builder (buduje prompt z komponentów per agent) | Agent ma pełną konwersację | Każdy thread = niezależna historia, fork_context opcjonalny |
| **Osobowość agenta** | Nazwy opisowe (planner, code-writer...) | Nazwy generyczne (build, plan...) | Nazwy mitologiczne (Sisyphus, Oracle...) | Plugin-specific | **System osobowości**: szablony (friendly/pragmatic/default) + migracja osobowości |

### 2.3 Diagram porównawczy modeli

```
DiriCode:                    OpenCode:                  OMO:
┌─────────────┐              ┌─────────┐                ┌──────────────┐
│  Dispatcher  │              │  build  │                │   Sisyphus   │
│  (read-only) │              │ (pełny) │                │ (orkiestrator)│
├─────────────┤              └─────────┘                ├──────────────┤
│ planner     │              ┌─────────┐                │ Oracle       │
│ code-writer │              │  plan   │                │ Librarian    │
│ code-reviewer│              │(read-only)│               │ Explore      │
│ debugger    │              └─────────┘                │ Prometheus   │
│ test-writer │              ┌─────────┐                │ Metis        │
│ docs-writer │              │  debug  │                │ Momus        │
│ git-manager │              └─────────┘                │ Hephaestus   │
│ web-researcher│              ...5 więcej               │ Atlas        │
│ refactorer  │                                         │ Junior       │
│ + custom    │                                         │ M.Looker     │
└─────────────┘                                         └──────────────┘

Claude Code:                 Codex:
┌─────────────┐              ┌──────────────────────┐
│  Core Agent │              │    Root Thread       │
│ (pełny dostęp)│            │  (pełny + sandbox)   │
├─────────────┤              ├──────────────────────┤
│ Plugin agents│              │  spawn_agent()       │
│ (per-plugin) │              │    ├─ Child Thread 1 │
│ feature-dev: │              │    │  (fork_context)  │
│  explorer   │              │    └─ Child Thread 2 │
│  architect  │              │       └─ Grandchild  │
│  reviewer   │              └──────────────────────┘
│ pr-review:  │
│  6 agentów  │
└─────────────┘
```

**Kluczowe obserwacje:**
- **DiriCode** jest JEDYNYM z read-only dispatcherem — najbezpieczniejszy by design
- **Codex** fork_context pozwala dziecku odziedziczyć historię rodzica — unikalne
- **OMO** ma najbardziej rozbudowany system agentów (11), ale zależny od OpenCode
- **Claude Code** deleguje agentów do pluginów — flat model z rozszerzeniami
- **OpenCode** sam ma tylko 7 prostych agentów — złożoność przeniesiona na OMO

---

## 3. Narzędzia (Tools)

### 3.1 Porównanie zestawu narzędzi

| Narzędzie | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-----------|:--------:|:--------:|:---:|:-----------:|:-----:|
| **File read** | ✅ | ✅ | ✅ (hashline-enhanced) | ✅ | ✅ read_file.rs |
| **File write** | ✅ | ✅ | ✅ (guard: prefer edit) | ✅ | ✅ apply_patch.rs |
| **File edit** | ✅ Hashline (hash-anchored) | ✅ (9 strategii fuzzy) | ✅ Hashline (LINE#HASH) | ✅ | ✅ apply_patch.rs (unified diff) |
| **Bash execution** | ✅ (Tree-sitter parsing) | ✅ (tree-sitter) | ✅ (interactive bash via tmux) | ✅ | ✅ shell.rs |
| **Glob** | ✅ | ✅ | ✅ (enhanced) | ✅ | ✅ list_dir.rs |
| **Grep** | ✅ | ✅ (ripgrep) | ✅ (enhanced) | ✅ | ✅ grep_files.rs |
| **BM25 search** | ❌ | ❌ | ❌ | ❌ | ✅ search_tool_bm25.rs |
| **AST-grep** | ✅ (25+ języków) | ❌ | ✅ (@ast-grep/napi) | ❌ | ❌ |
| **LSP** | ✅ (top-10, lazy install) | ✅ (28 języków) | ✅ (6 operacji, wrapper) | ✅ (częściowe) | ❌ |
| **Web search** | ✅ CORE | ❌ (plugin only) | ✅ (Exa MCP) | ✅ | ✅ web_search.rs ⚠️ |
| **Web fetch** | ✅ CORE | ✅ | ✅ | ✅ | ❌ |
| **Git operations** | ✅ (safety rails) | ✅ (snapshot) | ✅ (git-master skill) | ✅ | ✅ shell.rs |
| **MCP client** | ✅ (GitHub wbudowany) | ✅ | ✅ (3 wbudowane MCP) | ✅ (.mcp.json per plugin) | ✅ (rmcp-client, mcp-server) |
| **Task delegation** | ✅ | ✅ (task tool) | ✅ (task + call_omo_agent) | ❌ (flat) | ✅ (spawn_agent) |
| **TODO management** | ✅ (.diricode/todo.md) | ✅ (todoRead/todoWrite) | ✅ (todoWrite + enforcer) | ✅ (TodoWrite per-plugin) | ❌ |
| **Playwright** | ✅ (per-agent) | ❌ | ✅ (skill MCP) | ❌ | ❌ |
| **Interactive bash (tmux)** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Image/PDF analysis** | ❌ (v2) | ❌ | ✅ (look_at, multimodal-looker) | ❌ | ✅ view_image.rs |
| **JS REPL** | ❌ | ❌ | ❌ | ❌ | ✅ js_repl.rs |
| **Plan tool** | ❌ | ❌ | ❌ (Prometheus = osobny agent) | ❌ | ✅ plan.rs |
| **Question tool** | ❌ (approval system) | ✅ | ✅ (structured UI) | ❌ | ✅ request_user_input.rs |
| **Session management** | ❌ | ✅ | ✅ (save/load/list/search) | ❌ | ✅ (rollout/persistence) |
| **Code review (wbudowany)** | ❌ | ❌ | ❌ | ✅ (6-agentowy pipeline) | ✅ (review task + prompty) |
| **Artifacts system** | ❌ | ❌ | ❌ | ❌ | ✅ (artifacts/) |
| **RAZEM** | ~16 | ~14 | ~26 | ~12+ (z agentami pluginów) | ~20+ |

### 3.2 Unikalne mechanizmy narzędziowe

| Mechanizm | Projekt | Opis |
|-----------|---------|------|
| **Hashline Edit (LINE#HASH)** | DiriCode + OMO | Hash per linia → deterministyczne referencje → 6.7% → 68.3% success rate |
| **BM25 ranked search** | Codex | Ranking tekstowy bez AST — lepszy od prostego grepa dla dużych repo |
| **Unified diff patching** | Codex | apply_patch.rs — freeform unified diff zamiast search-replace |
| **Shell-tool-MCP z execve interception** | Codex | Patchowany Bash z przechwytywaniem execve(2) dla granularnej kontroli |
| **9 strategii fuzzy matching** | OpenCode | Edit tool próbuje 9 strategii dopasowania gdy exact match nie działa |
| **Pattern-based tool restriction** | Claude Code | `Bash(git add:*)` — granularne ograniczenie per komenda, nie per narzędzie |
| **Turn Diff Tracker** | Codex | In-memory baseline per turn + UUID rename tracking + unified diff do undo |
| **Ghost Snapshots** | Codex | Ephemeral git commit przechwytujący stan repo dla undo/forensics |
| **Unified Exec** | Codex | Centralizacja approval → sandbox → PTY → process reuse w jednym frameworku |
| **Multi-agent PR Review Pipeline** | Claude Code | 6 wyspecjalizowanych agentów (code-reviewer, silent-failure-hunter, code-simplifier, comment-analyzer, pr-test-analyzer, type-design-analyzer) |

---

## 4. Routing i Obsługa Modeli

| Cecha | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-------|----------|----------|-----|-------------|-------|
| **Providerzy** | 22 via Vercel AI SDK | 22 bundled SDKs + custom npm | — (używa providerów OpenCode + fallback chain) | TYLKO Anthropic (haiku/sonnet/opus) | OpenAI (domyślnie) + Ollama + LM Studio + custom TOML |
| **Failover** | ✅ order-based (ADR-011) | ❌ (brak natywnego) | ✅ (hook model-fallback: Opus→GPT→Gemini→Copilot→Zen→Z.ai→Kimi) | ❌ (1 provider) | ❌ (single provider) |
| **Race mode** | ✅ (ADR-011) | ❌ | ❌ | ❌ | ❌ |
| **Consensus mode** | ✅ (ADR-011) | ❌ | ❌ | ❌ | ❌ |
| **Per-agent model** | ✅ (aliasy routera) | ✅ (AgentConfig.model) | ✅ (primary=UI, subagent=fallback chain) | ✅ (YAML: model: haiku) | ✅ (Role overrides) |
| **Effort levels** | Binary: --lean on/off | Variant (reasoning effort) | ✅ (anthropic-effort hook) | 3 poziomy (low/medium/high) | 4 poziomy (low/medium/high/xhigh) |
| **Wire API** | Vercel AI SDK (Chat Completions) | Vercel AI SDK (streamText) | — (OpenCode) | Anthropic API bezpośrednio | Responses API only (Chat Completions usunięte) |
| **Provider transform** | — (Vercel AI SDK) | ProviderTransform pipeline: unsupportedParts → normalize → cache | — (OpenCode) | — (natywne API) | — (Responses API) |
| **Model metadata** | Do zdefiniowania | Model w config (basic) | DEFAULT_CATEGORIES z modelami per kategoria | — | **Rich catalog**: reasoning levels, modalities, truncation policy, context window, tool availability, parallel tool calls, personality templates per model |
| **Named profiles** | ❌ | ❌ | 8 kategorii (visual-engineering, ultrabrain, deep, artistry, quick...) | ❌ | ✅ (profiles w config.toml) |
| **Collaboration modes** | ❌ | ❌ | ❌ | ❌ | ✅ (Default, Plan — zmieniają instrukcje + dostępne narzędzia) |

**Kluczowe obserwacje:**
- **DiriCode** JEDYNY z failover + race mode + consensus mode — najambitniejszy routing
- **OMO** kompensuje brak failoveru w OpenCode własnym hookiem model-fallback (7-stopniowy chain)
- **Claude Code** = vendor lock-in (tylko Anthropic)
- **Codex** usunął Chat Completions API — wiąże się z Responses API OpenAI
- **Codex** ma najbogatsze model metadata — per-model: reasoning levels, modalities, truncation, tool support, context window, personality
- **OpenCode** ma 22 bundled SDKs ale brak automatycznego failoveru

---

## 5. Hooki i Rozszerzalność

| Cecha | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-------|----------|----------|-----|-------------|-------|
| **Ile hook types?** | 12 lifecycle hooks | 12 plugin hook points | 44 hooki w 5 warstwach (używa 12 punktów OpenCode) | 12 typów (PreToolUse, PostToolUse, SessionStart, Stop, UserPromptSubmit...) + learning hooks + cancel hooks | 2 (AfterAgent, AfterToolUse) |
| **Implementacja** | In-process TS (planowane) | Plugin system (JS/TS) | In-process TS (factory pattern: createXXX()) | Zewnętrzne procesy (Python/bash, stdin JSON → stdout JSON) | In-process Rust closures (Arc<dyn Fn>) |
| **Hook power** | transform/cancel/block/inject per hook | Zależy od hook point | Pełna modyfikacja: blokowanie, transformacja, inject, observe | Hook result: SUCCESS / CONTINUE / REJECT | Success / FailedContinue / FailedAbort |
| **Hook data** | Do zdefiniowania | toolName, args, context, result | Rich: token counts, model info, session state, agent category | JSON payload (tool_name, tool_input) | AfterToolUse: duration_ms, sandbox_info, mutating, output_preview |
| **MCP support** | ✅ (GitHub MCP wbudowany + zewnętrzne) | ✅ (stdio + HTTP, .mcp.json Claude compat) | ✅ (3 remote: Exa, Context7, Grep.app + skill-embedded) | ✅ (.mcp.json per plugin) | ✅ (rmcp-client + mcp-server + shell-tool-mcp) |
| **Custom agents** | ✅ (.diricode/agents/*.md) | ✅ (AgentConfig w JSON) | ✅ (TS objects + config) | ✅ (.md z YAML frontmatter) | ✅ (TOML roles) |
| **Plugin model** | Execution Policies (TS) + Agent Guards (.md) | Plugin = JS/TS z hook handlerami | Plugin do OpenCode (jedyny taki model) | Plugin = 5 artefaktów: commands + agents + skills + hooks + mcp.json | Plugins module (manager, marketplace, manifest, injection, curated repo, store) + Skills crate |
| **Skill system** | ❌ (MVP) | ❌ | ✅ (built-in + user-installed) | ✅ (SKILL.md + references + examples) | ✅ (loader local+remote, manager, env-var deps, injection, hot-reload via file watcher) |
| **Plugin marketplace** | ❌ (MVP) | ❌ | ❌ | ✅ (13+ pluginów) | ✅ (marketplace + curated repo) |
| **Plugin SDK / dev tools** | ❌ | ❌ | ❌ | ✅ (plugin-dev: 3 agentów + 7 skills do tworzenia pluginów) | ✅ (TypeScript SDK) |
| **Konfiguracja** | `diricode.config.ts` (type-safe) | `opencode.jsonc` (7 warstw priorytetów) | `oh-my-opencode.jsonc` (Zod v4 validation) | JSON (lax.json, strict.json, bash-sandbox.json) | `config.toml` (brak type safety) |
| **SDK** | ❌ (MVP) | VS Code Extension SDK | — (OpenCode) | Remote Control API | ✅ TypeScript SDK (JSONL stdin/stdout) |

**Kluczowe obserwacje:**
- **Codex** ma zaledwie 2 hook types — DRASTYCZNIE mniej niż reszta, ALE kompensuje to bogatym systemem skills + plugins + marketplace
- **Claude Code** JEDYNY z hookami jako zewnętrznymi procesami — izolacja + agnostyczność językowa kosztem performance
- **Claude Code** ma najpełniejsze narzędzia deweloperskie dla autorów pluginów (plugin-dev z 3 agentami i 7 skills)
- **Codex** ma hot-reload skills przez file watcher + zdalne skills (remote skill proxies)
- **DiriCode** z type-safe configiem (TS) jest najbezpieczniejszy konfiguracyjnie
- **OpenCode** 7 warstw priorytetów konfiguracji to ogromna złożoność

---

## 6. Bezpieczeństwo i Approval

| Cecha | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-------|----------|----------|-----|-------------|-------|
| **Approval system** | Smart: AI ocenia ryzyko (ADR-004), 3 kategorie: safe/risky/destructive | PermissionNext: allow/deny/ask per tool, last-match-wins ruleset | BRAK — filozofia "human intervention = failure" | Per-tool allow/ask/deny, acceptEdits mode, plan mode | 5 trybów: OnFailure/Never/OnRequest/UnlessTrusted/Reject |
| **AI-based approval** | ✅ (planowane, ADR-004) | ❌ | ❌ | ❌ | ✅ **Guardian** — osobny model (gpt-5.4), risk score 0-100, fail-closed, 90s timeout |
| **Sandbox** | ❌ (v2) | ❌ (snapshot = osobny .git) | ❌ | ✅ macOS sandbox (bash isolation, domain allowlists) | ✅ **Multi-platformowy**: Seatbelt (macOS), Seccomp+Landlock+bwrap (Linux), Restricted Tokens (Windows). 4 poziomy |
| **Sandbox escalation** | ❌ | ❌ | ❌ | ❌ | ✅ Orchestrator: approval → sandbox → attempt → retry z eskalowanym sandboxem |
| **Secret redaction** | ✅ (ADR-014: regex+heurystyki) | ❌ (brak widocznego) | ❌ | ❌ (brak w pluginach) | ✅ (codex-rs/secrets/) |
| **Git safety rails** | ✅ (ADR-010: blokada git add ., push --force) | ❌ (bug: git add . na 45GB — #3176) | ✅ (git-master skill, ale "destructive behaviour" — #1081) | ❌ (brak w pluginach) | ✅ (shell-command/ + shell-escalation/) |
| **Bash parsing** | Tree-sitter (AST) | Tree-sitter (AST) | — (OpenCode) | Regex (bash_command_validator_example.py) | Custom parser (shell-command/parse_command) |
| **Network control** | ❌ | ❌ | ❌ | ✅ (domain allowlists) | ✅ (network-proxy/ z managed allowlists + deferred approval service) |
| **Process hardening** | ❌ | ❌ | ❌ | ❌ | ✅ (process-hardening/) |
| **Command canonicalization** | ❌ | ❌ | ❌ | ❌ | ✅ (normalizacja komend dla approval cache) |
| **Commit attribution** | ❌ | ❌ | ❌ | ❌ | ✅ (auto Co-authored-by trailer) |

### Ranking bezpieczeństwa (od najlepszego):

```
1. 🥇 Codex     — sandbox multi-platform + Guardian AI + network proxy + deferred approval + exec policy + secrets + command canonicalization + commit attribution
2. 🥈 DiriCode  — smart approval (planowane) + secret redaction + git rails + Tree-sitter (ale brak sandbox)
3. 🥉 Claude Code — sandbox macOS + domain allowlists (ale regex bash parsing, brak secret redaction)
4. 4️⃣ OpenCode  — PermissionNext rulesets + Tree-sitter (ale git abuse bug, brak sandbox)
5. 5️⃣ OMO       — "human intervention = failure" — celowy brak approval (największe ryzyko)
```

---

## 7. Pamięć i Stan

| Cecha | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-------|----------|----------|-----|-------------|-------|
| **Pamięć między sesjami** | GitHub Issues (ADR-007) | ❌ (brak trwałej pamięci) | ❌ (brak — autor sceptyczny, #74) | Auto-memory: automatyczny zapis do /memory + CLAUDE.md | **Dwufazowa**: ekstrakcja (mini-model, 5000 wątków) → konsolidacja (większy model) → memory_summary.md |
| **Stan zadań** | Markdown (.diricode/todo.md) | SQLite (sessions, messages, parts, permissions via Drizzle ORM) | Boulder state + ralph-loop + continuation markers (file-based) | TodoWrite (per sesja), YAML frontmatter (.claude/ralph-loop.local.md) | SQLite (state_db.rs) + session rollouts (JSONL) |
| **Snapshot/undo** | ❌ (git worktrees, ADR-008) | ✅ (osobny .git w $DATA/snapshot/) | — (OpenCode snapshot) | ✅ (git worktree isolation) | ✅ Ghost snapshots (ephemeral git commit) + turn diff tracker + dedykowany undo task |
| **Session resume/fork** | ❌ | ✅ (basic) | ✅ (session save/load) | ❌ | ✅ Rollout reconstruction (reverse-scan JSONL → odtworzenie pełnego stanu konwersacji) |
| **Context compaction** | Sliding window + summary na 90-95% (ADR-009) | 3-mechanizmowe: pruning (40K chronionych) + auto-compact (OMO: 78%) + overflow compaction | Preemptive compaction hook (78% progu) + compaction-context-injector + todo-preserver | Automatyczny, zachowuje obrazy, sliding window | Inline auto-compact (SUMMARIZATION_PROMPT) + remote compact (server-side) + replacement history checkpoints |
| **Project context files** | .diricode/agents/*.md + diricode.config.ts | .opencode/instructions/*.md + opencode.jsonc | oh-my-opencode.jsonc + AGENTS.md (Claude Code compat) | CLAUDE.md + .claude/ | AGENTS.md + config.toml + project_doc system (ekstrakcja + blending z promptami) |
| **Shell environment** | ❌ | ❌ | ❌ | ❌ | ✅ Shell snapshots (env vars, cwd, startup script per sesja) |
| **Storage backend** | Pliki Markdown (ADR-013) | SQLite (Drizzle ORM, better-sqlite3) | — (OpenCode SQLite + file-based state) | Nieznany (proprietary core) | SQLite (state_db.rs) |

**Kluczowe obserwacje:**
- **Codex** ma najbardziej zaawansowaną pamięć — dwufazowa z osobnymi modelami do ekstrakcji i konsolidacji
- **Codex** ma też najbardziej zaawansowane undo — ghost snapshots + turn diff tracker + rollout reconstruction
- **DiriCode** z GitHub Issues jest unikalny — pamięć globalna per repo, dostępna z każdego worktree
- **OpenCode** i **OMO** NIE MAJĄ trwałej pamięci — każda sesja od zera (największa luka)
- **DiriCode** (Markdown) vs **OpenCode/Codex** (SQLite) — tradeoff: human-readable vs queryable
- **Claude Code** auto-memory jest automatyczny ale lokalny — DiriCode z GitHub Issues jest rozproszony

---

## 8. UX i Developer Experience

| Cecha | DiriCode | OpenCode | OMO | Claude Code | Codex |
|-------|----------|----------|-----|-------------|-------|
| **TUI framework** | Ink (React-based) | Bubble Tea (Go) | — (OpenCode TUI) | Ink (React-based) | ratatui (Rust) |
| **Vim motions** | ✅ od dnia 1 | ❌ (PR #12679 czeka) | ❌ | ❌ | ❌ |
| **Streaming** | SSE (ADR-001) | SSE (Bus → event stream) | — (OpenCode SSE) | CLI streaming | Stream chunking (4 design docs) |
| **Effort levels** | Binary: --lean | Variant (per model) | anthropic-effort hook | 3 (low/medium/high) | 4 (low/medium/high/xhigh) |
| **Time-to-first-use** | `npx diricode` (planowane) | `npx opencode` + config | Instalacja OMO + konfiguracja providerów + skills + MCPs | `npm i -g @anthropic-ai/claude-code` + API key | `npm i -g @openai/codex` lub `brew install` + API key |
| **Agent personality** | Nazwy opisowe (planner, code-writer...) | Nazwy generyczne (build, plan...) | Nazwy mitologiczne (Sisyphus, Prometheus, Oracle...) | Plugin-specific | System osobowości (friendly/pragmatic/default) + migracja + nazwy filozofów |
| **Tryby pracy** | Standard + Lean | Standard + Plan | Ralph Loop, Ultrawork, /start-work, /refactor, /init-deep, /handoff | Standard + Plan + Fast | Standard + Collaboration Modes (Default, Plan) |
| **Onboarding complexity** | Niski (BYOK, type-safe config) | Średni (JSONC config, wiele opcji) | WYSOKI (2 projekty, custom licencja, skills, MCPs, hooks) | Niski (1 provider, prosty setup) | Niski (1 binary, TOML config) |
| **Dokumentacja** | Do stworzenia | README + docs | Ograniczona | Mature (code.claude.com) | README + CHANGELOG |
| **Realtime / Voice** | ❌ | ❌ | ❌ | ✅ Voice | ✅ Realtime WebSocket (audio/text/handoff) + startup context injection |
| **@Mentions** | ❌ | ❌ | ❌ | ❌ | ✅ (referencje między wątkami/agentami) |
| **Telemetry** | ❌ | ❌ | ❌ | ❌ | ✅ (counters/timers na operacjach) |

---

## 9. Porównanie Mechanizmów — Jak Działają

### 9.1 Cykl życia zapytania

```
DIRICODE (planowany):
User → HTTP POST → Hono Server → Dispatcher (read-only)
  → glob/grep/read → decyzja kogo delegować
  → spawn code-writer (lub inny specjalista)
  → specjalista wykonuje z hookami → wynik do dispatchera
  → dispatcher: dalej delegować czy zwrócić? → SSE → User

OPENCODE:
User → POST /session/:id/chat → SessionPrompt.prompt()
  → Plugin.trigger("chat.message") → resolve agent/model
  → loop(): fetch history → insert reminders → resolve tools
  → Plugin.trigger("messages.transform") → build system prompt
  → Plugin.trigger("chat.params") → LLM.stream() via Vercel AI SDK
  → ProviderTransform pipeline → streamText()
  → processor: text/tool-call events → Permission check
  → Plugin.trigger("tool.execute.before") → execute → Plugin.trigger("tool.execute.after")
  → finish_reason=="tool-calls" ? → CONTINUE loop : STOP → SSE → User

OMO (nadbudówka na OpenCode):
(jak OpenCode, ale hooki OMO przechwytują na każdym kroku)
  chat.message: model-fallback, think-mode, no-sisyphus-gpt
  messages.transform: context-injector, thinking-block-validator
  tool.execute.before: write-existing-file-guard, rules-injector
  tool.execute.after: hashline-read-enhancer, context-window-monitor,
    preemptive-compaction, todo-continuation-enforcer, agent-usage-reminder...
  event handlers: session-recovery, ralph-loop, auto-update-checker

CLAUDE CODE:
User → CLI → Core Agent (proprietary) → tool call
  → Plugin hooks: PreToolUse (block/modify) → execute → PostToolUse
  → Agent Teams (tmux sessions, worktree isolation)
  → Plugin-defined agents (.md z YAML) spawnowane sekwencyjnie/równolegle
  → Multi-agent pipelines (np. review-pr: 6 agentów w pipeline)
  → streaming → User

CODEX:
User → TUI (ratatui) → CodexThread (root)
  → Contextual user message augmentation (workspace context injection)
  → ToolRouter: ResponseItem → ToolCall → dispatch through ToolRegistry
  → ToolOrchestrator: approval → command canonicalization → sandbox selection → attempt → retry
  → Unified Exec: PTY spawn → process reuse → output buffer/truncation
  → Parallel execution (ToolCallRuntime z RwLock, tokio tasks)
  → Guardian check (jeśli on-request): osobny model → risk_score
  → Network approval service (deferred/immediate per host)
  → spawn_agent? → nowy CodexThread (fork_context optional)
  → ContextManager: replacement history checkpoints → truncation → auto-compact
  → Turn diff tracker: baseline snapshot → rename tracking → unified diff
  → Ghost snapshot: ephemeral git commit
  → streaming → User
```

### 9.2 Jak każdy radzi sobie z edycją plików

| Projekt | Metoda | Odporność na drift | Opis |
|---------|--------|:-------------------:|------|
| **DiriCode** | Hashline Edit (hash-anchored) | ⭐⭐⭐⭐⭐ | LINE#HASH per linia → mismatch = force re-read |
| **OpenCode** | Edit (9 strategii fuzzy) | ⭐⭐⭐ | Exact → whitespace → indent → reindent → ... → fuzzy |
| **OMO** | Hashline Edit (LINE#HASH) | ⭐⭐⭐⭐⭐ | Identyczne z DiriCode (źródło mechanizmu) |
| **Claude Code** | Edit (standard search-replace) | ⭐⭐ | Prosty search-replace, brak fuzzy fallback |
| **Codex** | apply_patch (unified diff) + Turn Diff Tracker | ⭐⭐⭐⭐ | Unified diff z kontekstem + in-memory baseline + UUID rename tracking |

### 9.3 Jak każdy radzi sobie z bezpieczeństwem bash

| Projekt | Metoda | Opis |
|---------|--------|------|
| **DiriCode** | Tree-sitter AST | Pełne drzewo składniowe bash → bezpieczna ekstrakcja argumentów |
| **OpenCode** | Tree-sitter AST | Identyczne podejście |
| **OMO** | — (OpenCode) | Używa parsera OpenCode |
| **Claude Code** | Python regex | bash_command_validator_example.py — podatny na bypass |
| **Codex** | Custom Rust parser + execve interception + command canonicalization | parse_command + is_dangerous_command + patchowany Bash z exec wrapper + normalizacja komend dla approval cache |

---

## 10. Macierz Feature'ów — Podsumowanie

| Feature | DiriCode | OpenCode | OMO | Claude Code | Codex |
|---------|:--------:|:--------:|:---:|:-----------:|:-----:|
| Open-source (permissive) | ✅ MIT | ✅ | ⚠️ SUL-1.0 | ❌ | ✅ Apache-2.0 |
| Multi-provider | ✅ 22 | ✅ 22 | ✅ (OC) | ❌ Anthropic only | ⚠️ 3+custom |
| Failover | ✅ | ❌ | ✅ (hook) | ❌ | ❌ |
| Race mode | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-agent | ✅ 10+ | ⚠️ 7 basic | ✅ 11 | ✅ plugin-based (9+ agentów) | ✅ dynamic |
| Read-only dispatcher | ✅ | ❌ | ❌ | ❌ | ❌ |
| Nesting guards (2 dim.) | ⚠️ 1 dim. | ⚠️ doom loop | ⚠️ buggy | ❌ | ✅ depth + total |
| 12+ hook types | ✅ | ✅ | ✅ (44 na 12 punktach) | ✅ + learning + cancel | ❌ (tylko 2) |
| AI-based approval | ✅ (plan.) | ❌ | ❌ | ❌ | ✅ Guardian |
| Multi-platform sandbox | ❌ (v2) | ❌ | ❌ | ⚠️ macOS only | ✅ |
| Secret redaction | ✅ | ❌ | ❌ | ❌ | ✅ |
| Git safety rails | ✅ | ❌ | ⚠️ | ❌ | ✅ |
| Tree-sitter bash | ✅ | ✅ | ✅ (OC) | ❌ | ❌ (custom) |
| AST-grep | ✅ | ❌ | ✅ | ❌ | ❌ |
| LSP integration | ✅ top-10 | ✅ 28 lang | ✅ (OC) | ⚠️ | ❌ |
| BM25 search | ❌ | ❌ | ❌ | ❌ | ✅ |
| Hashline edit | ✅ | ❌ | ✅ | ❌ | ❌ |
| Web search | ✅ CORE | ❌ | ✅ (MCP) | ✅ | ✅ web_search.rs |
| Trwała pamięć | ✅ GitHub Issues | ❌ | ❌ | ✅ auto-memory | ✅ dwufazowa |
| Context compaction | ✅ 90-95% | ✅ 3-mech. | ✅ 78% preemptive | ✅ auto | ✅ auto-compact + remote compact |
| Type-safe config | ✅ TS | ❌ JSONC | ⚠️ Zod validation | ❌ JSON | ❌ TOML |
| Vim motions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Playwright | ✅ | ❌ | ✅ | ❌ | ❌ |
| SDK for embedding | ❌ (MVP) | VS Code SDK | ❌ | Remote Control API | ✅ TS SDK |
| Desktop app | ❌ | ✅ beta | ❌ | ❌ | ✅ (app-server) |
| Effort levels | 2 (lean) | per-model | hook-based | 3 | 4 |
| Collaboration modes | ❌ | ❌ | ❌ | ❌ | ✅ (Default, Plan) |
| Personality system | ❌ | ❌ | ❌ | ❌ | ✅ (templates + migracja) |
| Ghost snapshots / undo | ❌ | ❌ | ❌ | ❌ | ✅ |
| Rollout reconstruction | ❌ | ❌ | ❌ | ❌ | ✅ (resume/fork) |
| Shell snapshots | ❌ | ❌ | ❌ | ❌ | ✅ |
| Command canonicalization | ❌ | ❌ | ❌ | ❌ | ✅ |
| Commit attribution | ❌ | ❌ | ❌ | ❌ | ✅ (Co-authored-by) |
| Realtime/Voice/WebSocket | ❌ | ❌ | ❌ | ✅ Voice | ✅ (audio/text/handoff) |
| Network approval (deferred) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Plugin marketplace | ❌ | ❌ | ❌ | ✅ (13+) | ✅ (curated repo) |
| Plugin dev SDK | ❌ | ❌ | ❌ | ✅ (7 skills) | ✅ |
| Skill system (first-class) | ❌ | ❌ | ✅ | ✅ (SKILL.md) | ✅ (loader+manager+remote) |
| Multi-agent pipelines | ❌ | ❌ | ✅ | ✅ (6-agent PR review) | ✅ (spawn_agent chains) |
| Code review (wbudowany) | ❌ | ❌ | ❌ | ✅ (6 agentów) | ✅ (review task) |
| Cloud tasks | ❌ | ❌ | ❌ | ❌ | ✅ |
| Artifacts system | ❌ | ❌ | ❌ | ❌ | ✅ |
| Analytics/Telemetry | ❌ | ❌ | ❌ | ❌ | ✅ |
| @Mentions | ❌ | ❌ | ❌ | ❌ | ✅ |
| File watcher (hot-reload) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Feature flags (managed) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Learning output hooks | ❌ | ❌ | ❌ | ✅ | ❌ |
| Cancel/interrupt hooks | ❌ | ❌ | ❌ | ✅ | ❌ |
| Model migration tools | ❌ | ❌ | ❌ | ✅ (skill) | ❌ |

---

## 11. Ukryte Mechanizmy Wewnętrzne — Deep Dive

> Sekcja dodana po głębokim nurkowaniu w kod źródłowy (170+ plików .rs Codex, 35+ plików .md/.json Claude Code). Mechanizmy niewidoczne z README, odkryte bezpośrednio w kodzie.

### 11.1 Codex — Mechanizmy niewidoczne z README

| # | Mechanizm | Co robi | Plik źródłowy | DiriCode |
|---|-----------|---------|---------------|----------|
| 1 | **Collaboration Modes** | Tryby współpracy (Default, Plan) zmieniające developer instructions i dostępne narzędzia per-mode | `collaboration_mode_presets.rs` + `templates/collaboration_mode/` | ❌ |
| 2 | **Personality System** | Szablony osobowości (friendly/pragmatic/default) wstrzykiwane do instrukcji modelu | `templates/personalities/` + `model_info.rs` | ❌ |
| 3 | **Personality Migration** | Jednorazowa migracja ustawiająca domyślną osobowość dla istniejących instalacji (marker `.personality_migration`) | `personality_migration.rs` | ❌ |
| 4 | **Rollout Reconstruction** | Odtwarzanie stanu sesji z logów JSONL (reverse-scan) dla resume/fork/rollback — znajduje checkpoint, odtwarza historię | `codex/rollout_reconstruction.rs` | ❌ |
| 5 | **Turn Diff Tracker** | In-memory baseline snapshot per turn + UUID tracking rename'ów + unified diff do undo. Integracja z git OID | `turn_diff_tracker.rs` | ❌ |
| 6 | **Ghost Snapshots** | Ephemeral git commit ("ghost commit") przechwytujący stan repo + untracked files dla undo/forensics. Ostrzega o dużych plikach | `tasks/ghost_snapshot.rs` | ❌ |
| 7 | **Shell Snapshots** | Przechwytywanie środowiska shell (env exports, cwd, startup script) do pliku `shell_snapshots/<session_id>.[sh|ps1]`. Walidacja + cleanup starych | `shell_snapshot.rs` | ❌ |
| 8 | **Command Canonicalization** | Normalizacja komend shell do stabilnych kluczy dla approval cache — ekstrakcja inner commands z wrapper'ów, collapsing heredoc do prefixed keys | `command_canonicalization.rs` | ❌ |
| 9 | **Commit Attribution** | Auto-wstrzykiwanie `Co-authored-by` trailer do commitów generowanych przez model. Konfigurowalny, zapobiega duplikacji | `commit_attribution.rs` | ❌ |
| 10 | **Realtime System** | WebSocket conversation manager (audio/text/handoff) + startup context injection (recent work + workspace map) na starcie połączenia | `realtime_conversation.rs` + `realtime_context.rs` | ❌ |
| 11 | **Managed Features** | Feature flags z pinowaniem, normalizacją zależności i constraint enforcement. Validates at config load | `config/managed_features.rs` | ❌ |
| 12 | **Network Approval Service** | Deferred/immediate approval na sieć z per-host/protocol/port cache. Integracja z Guardian. Pending approvals z handoff registration | `tools/network_approval.rs` | ❌ |
| 13 | **Unified Exec** | Centralizacja approval → command canonicalization → sandbox selection → PTY spawn → process reuse → output buffering/truncation → sandbox retry w jednym frameworku | `unified_exec/` (4 pliki) | ❌ |
| 14 | **File Watcher** | Hot-reload skills/plugins przez filesystem events (notify crate). Debounce/coalesce → throttled `SkillsChanged`. Auto-unregister on drop | `file_watcher.rs` | ❌ |
| 15 | **@Mentions System** | Referencje między wątkami/agentami/sesjami — umożliwia cross-thread @-interactions | `mentions.rs` | ❌ |
| 16 | **Web Search** | Wbudowany web search tool (wcześniej **BŁĘDNIE** oznaczony jako brak). WebSearchToolType + templates + model-level gating | `web_search.rs` + `templates/search_tool/` + `model_info.rs` | ✅ (CORE) |
| 17 | **Code Review System** | Wbudowany review z szablonami promptów (review_format + review_prompts) i dedykowanym task runner (tasks/review.rs) | `review_format.rs` + `review_prompts.rs` + `tasks/review.rs` | ❌ |
| 18 | **Plugin System (pełny)** | Manager + registry + curated marketplace + manifest parsing/validation + injection do sesji + store + render UI | `plugins/` (7 plików: manager, marketplace, manifest, injection, curated_repo, store, render) | ❌ (MVP) |
| 19 | **Skill System (pełny)** | Loader local+remote + manager + model definitions + env-var dependency checking + injection + system skills + hot-reload via file watcher | `skills/` (8 plików: loader, manager, model, remote, injection, system, env_var_dependencies, render) | ❌ (MVP) |
| 20 | **Cloud Tasks** | Offloading ciężkich zadań do chmury (indexing, async reviews). Worker + client library do schedulowania/odbierania wyników | `cloud-tasks/` + `cloud-tasks-client/` | ❌ |
| 21 | **ChatGPT Integration** | Adapter mapujący Codex session semantics na ChatGPT API shapes | `chatgpt/` | ❌ |
| 22 | **App Server** | Desktop/web app server z protokołem (JSON schema v1/v2) i event delivery dla frontend'u | `app-server/` + `app-server-protocol/` | ❌ |
| 23 | **Artifacts System** | Centralne przechowywanie/renderowanie artefaktów (pliki, obrazy, bundles) z tool handler + runtime | `artifacts/` + `tools/handlers/artifacts.rs` | ❌ |
| 24 | **Project Doc System** | Ekstrakcja dokumentów projektowych i blending z promptami — model dostaje context z project docs | `project_doc.rs` | ❌ |
| 25 | **Analytics/Telemetry** | Counters/timers na operacjach (snapshot durations, exec times, failures). Tags + backend submission | `analytics_client.rs` | ❌ |
| 26 | **Contextual User Message** | Augmentacja user messages o kontekst workspace'u (project map, recent work) przed wysłaniem do modelu | `contextual_user_message.rs` | ❌ |
| 27 | **Environment Context** | Zbieranie git roots, directory trees, recent threads na starcie sesji — "startup context" | `environment_context.rs` | ❌ |
| 28 | **Undo Task** | Dedykowany task runner do rollback operacji z gating, cancellation i readiness semantics | `tasks/undo.rs` | ❌ |
| 29 | **User Shell Task** | Interaktywna sesja shell jako background task z lifecycle management | `tasks/user_shell.rs` | ❌ |
| 30 | **Responses API Proxy** | Proxy adaptujący response streaming/formats — decouples internal formats od public endpoints | `responses-api-proxy/` | ❌ |
| 31 | **Custom Prompts** | Konfiguracja custom promptów per profil — personalizacja base instructions i model behavior | `custom_prompts.rs` | ❌ |
| 32 | **Instructions System** | Reusable instruction blocks i variables dla prompt engineering — budowanie developer messages z komponentów | `instructions/` + `templates/model_instructions/` | ❌ |
| 33 | **API Bridge** | Centralizacja error mappingu i header handling dla providerów — single adapter layer | `api_bridge.rs` | ❌ |
| 34 | **Rich Model Metadata** | Per-model: reasoning levels, supported modalities (text/image/code), truncation policy, context window overrides, tool availability, parallel tool call support, personality templates, verbosity defaults, fallback metadata | `models_manager/model_info.rs` + `model_presets.rs` | ❌ |

**Podsumowanie Codex deep-dive:** Codex to nie "sandbox + Guardian + BM25" — to platforma z **34 ukrytymi mechanizmami** wewnętrznymi. Najważniejsze odkrycia: Unified Exec (centralizacja exec pipeline), rollout reconstruction (resume/fork z reverse-scan JSONL), ghost snapshots + turn diff tracker (zaawansowane undo), system osobowości z migracją, collaboration modes, realtime WebSocket, cloud tasks, **web search** (wcześniej błędnie oznaczony jako brak), i pełen plugin marketplace + skill system.

### 11.2 Claude Code — Mechanizmy niewidoczne z README

| # | Mechanizm | Co robi | Plik źródłowy | DiriCode |
|---|-----------|---------|---------------|----------|
| 1 | **PR Review Pipeline (6 agentów)** | Pipeline review-pr orkiestrujący 6 wyspecjalizowanych agentów: **code-reviewer** (linia-per-linia review), **silent-failure-hunter** (wykrywanie cichych błędów — połknięte wyjątki, brak logowania, edge-case returns), **code-simplifier** (sugestie uproszczenia/refaktoru → diff/patch), **comment-analyzer** (analiza komentarzy PR — toksyczność, nierozwiązane pytania), **pr-test-analyzer** (mapowanie failures CI na przyczyny w kodzie, diagnoza flakiness), **type-design-analyzer** (analiza typów/API contracts, backward compatibility, breaking changes) | `pr-review-toolkit/agents/*.md` + `commands/review-pr.md` | ❌ |
| 2 | **Feature Dev Pipeline (3 agentów)** | Pipeline feature-dev z 3 agentami: **code-explorer** (nawigacja repo, znajdowanie relevantnych plików, budowanie overview), **code-architect** (propozycje high-level design, diagramy, migracje, compatibility), **code-reviewer** (review w kontekście nowej funkcji — architecture fit, feature toggles). Orkiestrowane przez feature-dev command | `feature-dev/agents/*.md` + `commands/feature-dev.md` | ❌ |
| 3 | **Learning Output Style Hooks** | Hooki adaptujące styl odpowiedzi na podstawie feedbacku użytkownika — uczenie się preferencji tonu, formatowania, poziomu szczegółowości między sesjami | `learning-output-style/hooks/hooks.json` + `.claude-plugin/plugin.json` | ❌ |
| 4 | **Cancel/Interrupt Hooks** | Plugin ralph-wiggum z komendą `cancel-ralph` mapującą na hook → przerwanie agenta mid-run. Demonstracja mechanizmu cancel/interrupt w Claude Code ecosystem | `ralph-wiggum/commands/cancel-ralph.md` + `hooks/hooks.json` | ❌ |
| 5 | **Plugin Dev SDK (7 skills)** | Kompletny SDK do tworzenia pluginów z 7 dedykowanymi skills: **command-development** (jak pisać komendy), **skill-development** (jak budować skills), **hook-development** (jak autorować hooki + scripts), **agent-development** (jak tworzyć agentów + multi-agent pipelines), **plugin-settings** (structured settings schema + validation), **plugin-structure** (wymagane pliki, manifest), **mcp-integration** (MCP patterns, versioning, migration) | `plugin-dev/skills/*/SKILL.md` + references + examples | ❌ |
| 6 | **Plugin Validator Agent** | Agent automatycznie walidujący strukturę pluginu (wymagane pliki, manifest format, hooks, settings schema, marketplace requirements) + **skill-reviewer** (review SKILL.md na poprawność/spójność) + **agent-creator** (scaffolding nowych agentów) | `plugin-dev/agents/plugin-validator.md` + `skill-reviewer.md` + `agent-creator.md` | ❌ |
| 7 | **Model Migration Skill** | Skill prowadzący autorów przez migrację promptów/agentów między wersjami modelu (np. Claude 3→4→4.5). Kroki migracji, testy kompatybilności, szablony regresji | `claude-opus-4-5-migration/skills/claude-opus-4-5-migration/SKILL.md` + references | ❌ |
| 8 | **Settings Schema w plugin.json** | Structured settings (not just config), domain allowlists, sandbox flags per plugin deklarowane w manifest. Walidacja i enforcement przy instalacji | `.claude-plugin/plugin.json` we wszystkich pluginach | ❌ |

**Podsumowanie Claude Code deep-dive:** Claude Code to nie "flat agent + macOS sandbox". Ma zaawansowane **multi-agent pipelines** (6 agentów PR review, 3 agentów feature dev), **learning hooks** (adaptacja stylu), **cancel/interrupt** hooks, i — co najważniejsze — **pełny Plugin Dev SDK** z 3 agentami i 7 skills do tworzenia pluginów. To najbardziej dojrzały ekosystem pluginowy spośród wszystkich pięciu projektów.

---

## 12. Wnioski — Gdzie Każdy Jest Najlepszy (zaktualizowane)

| Wymiar | Najlepszy | Dlaczego |
|--------|-----------|---------|
| **Bezpieczeństwo** | **Codex** | Multi-platform sandbox + Guardian AI + network approval service + unified exec + command canonicalization + commit attribution + secrets — najdojrzalszy w kategorii |
| **Rozszerzalność** | **Claude Code** (ekosystem) / **OMO** (hooki) | Claude Code: plugin SDK z 7 skills + marketplace + validator agent. OMO: 44 hooki |
| **Multi-provider routing** | **DiriCode** | Jedyny z failover + race + consensus mode na 22 providerach |
| **Code intelligence** | **OpenCode / DiriCode** | LSP (28/10 języków) + AST-grep — Codex nie ma LSP |
| **Pamięć i undo** | **Codex** | Dwufazowa pamięć + ghost snapshots + turn diff tracker + rollout reconstruction — najgłębsze undo |
| **Autonomia agentów** | **OMO** | Ralph Loop, Ultrawork, 11 agentów — najbardziej autonomiczny system |
| **Architektura bezpieczeństwa agentów** | **DiriCode** | Read-only dispatcher — jedyny gdzie agent główny nie może nic zepsuć |
| **Onboarding / prostota** | **Claude Code / Codex** | 2 kroki do działania, zero konfiguracji |
| **Ekosystem interfejsów** | **Codex** | CLI + IDE (3 edytory) + Desktop (app-server) + Web + SDK + Realtime WebSocket |
| **Edycja plików** | **DiriCode / OMO** | Hashline Edit (68.3% success vs 6.7% baseline) |
| **Multi-agent orchestration** | **Claude Code** | 6-agentowy PR review pipeline + 3-agentowy feature dev pipeline — najdojrzalsze pipelines |
| **Plugin ecosystem** | **Claude Code** | Plugin Dev SDK (3 agentów + 7 skills), plugin validator, marketplace |
| **Model metadata** | **Codex** | Najbogsza metadata per model: reasoning levels, modalities, truncation, tool support, personalities |
| **Developer tools** | **Codex** | Collaboration modes, personality system + migration, custom prompts, instructions system |

### Gdzie DiriCode ma przewagę nad WSZYSTKIMI:

1. **Read-only dispatcher** — żaden inny projekt tego nie ma
2. **Failover + race mode + consensus** — żaden inny projekt nie ma wszystkich trzech
3. **Type-safe config (TS)** — jedyny z pełną walidacją compile-time
4. **Vim motions od dnia 1** — żaden inny nie planuje tego w core
5. **Tree-sitter bash parsing** — DiriCode + OpenCode jedyni z AST (nie regex, nie custom parser)

### Gdzie DiriCode ma lukę (zaktualizowane po deep-dive):

**Krytyczne (Codex ma, DiriCode nie):**
1. **Sandbox** — Codex multi-platformowy, DiriCode nic (v2)
2. **Unified Exec** — Codex centralizuje cały exec pipeline, DiriCode tego nie planuje
3. **Ghost snapshots + Turn diff tracker** — zaawansowane undo, DiriCode ma tylko git worktrees
4. **Rollout reconstruction** — resume/fork sesji z reverse-scan, DiriCode brak
5. **Rich model metadata** — Codex: reasoning levels, modalities, truncation per model. DiriCode: do zdefiniowania
6. **Command canonicalization** — Codex normalizuje komendy dla approval cache, DiriCode brak
7. **Personality system** — Codex: templates + migracja. DiriCode: brak

**Ważne (Claude Code ma, DiriCode nie):**
8. **Multi-agent pipelines** — Claude Code: 6-agent PR review, 3-agent feature dev. DiriCode: planowany ale nie zdefiniowany
9. **Plugin Dev SDK** — Claude Code: 3 agentów + 7 skills do tworzenia pluginów. DiriCode: brak
10. **Learning output hooks** — Claude Code adaptuje styl na podstawie feedbacku. DiriCode: brak
11. **Cancel/interrupt hooks** — Claude Code: przerwanie agenta mid-run. DiriCode: brak (ma loop detector ale nie cancel)

**Nice-to-have:**
12. **Cloud tasks** — Codex: offloading do chmury. DiriCode: local-only
13. **Realtime WebSocket** — Codex: audio/text/handoff. DiriCode: SSE only
14. **Artifacts system** — Codex: centralne przechowywanie artefaktów. DiriCode: brak
15. **Analytics/Telemetry** — Codex: counters/timers. DiriCode: brak
16. **@Mentions** — Codex: cross-thread references. DiriCode: brak

---

*Dokument porównawczy oparty na analizie kodu źródłowego (170+ plików .rs Codex, 35+ plików Claude Code), dokumentacji i issues wszystkich pięciu projektów. Fakty, nie spekulacje. Zaktualizowany po deep-dive 7 marca 2026.*
