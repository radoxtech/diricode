# Analiza narzedzi ekosystemu Claude Code

> **Data**: 2026-03-08
> **Status**: KOMPLETNA
> **Zakres**: 7 narzedzi z ekosystemu Claude Code, analiza techniczna + jakosc kodu + rekomendacje dla DiriCode

---

## Spis tresci

1. [Podsumowanie wykonawcze](#1-podsumowanie-wykonawcze)
2. [Macierz licencji](#2-macierz-licencji)
3. [Oceny jakosci kodu](#3-oceny-jakosci-kodu)
4. [Analiza poszczegolnych narzedzi](#4-analiza-poszczegolnych-narzedzi)
   - 4.1 Superpowers
   - 4.2 Claude-Mem
   - 4.3 Get Shit Done (GSD)
   - 4.4 n8n-MCP
   - 4.5 Obsidian Skills
   - 4.6 UI/UX Pro Max Skill
   - 4.7 Awesome Claude Code
5. [Wzorce architektoniczne do adopcji](#5-wzorce-architektoniczne-do-adopcji)
6. [Wzorce do unikania](#6-wzorce-do-unikania)
7. [Rekomendacje dla DiriCode](#7-rekomendacje-dla-diricode)
8. [Mapowanie na TASK-y z analizy-todo.md](#8-mapowanie-na-task-y)

---

## 1. Podsumowanie wykonawcze

Przeanalizowano 7 narzedzi z ekosystemu Claude Code pod katem:
- **Jakosci kodu** — czytelnosc, typowanie, wzorce, obsluga bledow
- **Architektury** — separacja odpowiedzialnosci, skalowalnosc, rozszerzalnosc
- **Uzytecznosci dla DiriCode** — co adoptowac, co zreimplementowac, czego unikac
- **Licencji** — kompatybilnosc z projektem MIT/Apache-2.0

### Kluczowe odkrycia

| Odkrycie | Wplyw na DiriCode |
|----------|-------------------|
| Claude-Mem ma najlepsza architekture (9/10) ale licencje AGPL | Studiowac wzorce, reimplementowac od zera |
| GSD ma najlepszy design agentow i workflow | Adoptowac pipeline interview→plan→execute |
| Obsidian Skills definiuje zloty standard SKILL.md | Bazowac format SKILL.md na tym wzorcu |
| Superpowers ma dojrzaly system odkrywania skilli | Adoptowac recursive discovery + shadowing |
| n8n-MCP ma wzorcowe definicje narzedzi MCP | Adoptowac annotacje narzedzi (readOnly, destructive) |
| Awesome Claude Code potwierdza: Tooling i Skills to najwazniejsze kategorie | Priorytetyzowac system skilli i narzedzi |
| UI/UX Pro Max pokazuje multi-platform skill delivery | Rozwazyc templates per-agent w przyszlosci |

---

## 2. Macierz licencji

| Narzedzie | Licencja | Autor | Mozna kopiowac kod? | Mozna adoptowac wzorce? |
|-----------|----------|-------|---------------------|------------------------|
| **Superpowers** | MIT | Jesse Vincent | ✅ Tak | ✅ Tak |
| **Claude-Mem** | **AGPL-3.0** | Alex Newman (@thedotmack) | ⛔ **NIE** — viralny copyleft | ✅ Tak (studiowac, reimplementowac) |
| **Get Shit Done** | MIT | Lex Christopherson / TACHES | ✅ Tak | ✅ Tak |
| **n8n-MCP** | MIT | Romuald Czlonkowski | ✅ Tak | ✅ Tak |
| **Obsidian Skills** | MIT | Steph Ango (@kepano) | ✅ Tak | ✅ Tak |
| **UI/UX Pro Max** | MIT | Next Level Builder | ✅ Tak | ✅ Tak |
| **Awesome Claude Code** | **CC BY-NC-ND 4.0** | hesreallyhim | ⚠️ Nie komercyjnie | ✅ Jako referencja |

### Wnioski licencyjne

- **6 z 7 narzedzi to MIT** — pelna swoboda adopcji kodu i wzorcow
- **Claude-Mem (AGPL-3.0)** — KRYTYCZNE: nie mozna kopiowac kodu, bo AGPL wymaga udostepnienia calego zrodla produktu ktory uzywa kodu AGPL. Mozna TYLKO studiowac wzorce i reimplementowac od zera
- **Awesome Claude Code (CC BY-NC-ND 4.0)** — lista kuratorska, nie kod. Nie mozna uzyc komercyjnie ani tworzyc dziel pochodnych z samej listy, ale linkowane narzedzia maja wlasne licencje

---

## 3. Oceny jakosci kodu

| Narzedzie | Jakosc kodu | Architektura | Dokumentacja | Testy | Ogolna |
|-----------|:-----------:|:------------:|:------------:|:-----:|:------:|
| **Claude-Mem** | 9/10 | 9/10 | 8/10 | 7/10 | **9/10** |
| **GSD** | 7/10 | 9/10 | 9/10 | 5/10 | **8/10** |
| **n8n-MCP** | 7/10 | 8/10 | 7/10 | 6/10 | **7.5/10** |
| **Superpowers** | 7/10 | 7/10 | 8/10 | 5/10 | **7/10** |
| **UI/UX Pro Max** | 6/10 | 7/10 | 8/10 | N/A | **7/10** |
| **Obsidian Skills** | N/A (pure docs) | 9/10 | 10/10 | N/A | **9/10** (jako standard formatu) |
| **Awesome Claude Code** | N/A (lista) | N/A | 8/10 | N/A | N/A (meta-zasob) |

### Ranking wg uzytecznosci technicznej dla DiriCode

1. 🥇 **GSD** — najlepszy design agentow, workflow pipeline, wave execution
2. 🥈 **Claude-Mem** — najlepsza jakosc kodu, migracje, context building (ale AGPL!)
3. 🥉 **Obsidian Skills** — zloty standard formatu SKILL.md
4. **n8n-MCP** — wzorcowe definicje narzedzi MCP z annotacjami
5. **Superpowers** — dojrzaly skill discovery i plugin system
6. **UI/UX Pro Max** — ciekawy model dostarczania danych do skilli
7. **Awesome Claude Code** — mapa ekosystemu i sygnal popytu

---

## 4. Analiza poszczegolnych narzedzi

### 4.1 Superpowers

**Repo**: `example-repos/tools/superpowers/`
**Licencja**: MIT
**Jakosc kodu**: 7/10

#### Co to jest
System skilli i agentow dla Claude Code / OpenCode / Cursor. Dostarcza gotowe umiejetnosci (skill files), definicje agentow, hooki i plugin do OpenCode.

#### Architektura techniczna

```
superpowers/
├── lib/skills-core.js      # Rdzen: odkrywanie i ladowanie skilli
├── hooks/session-start      # Bash hook — JSON context injection
├── .opencode/plugins/superpowers.js  # Plugin OpenCode
├── agents/                  # Agent definitions (markdown)
├── skills/                  # SKILL.md files
└── scripts/                 # Utility scripts
```

#### Analiza kodu

**`lib/skills-core.js` (~200 linii)**:
- Czysty ESM JavaScript z dobrym JSDoc
- Parser YAML frontmatter dla SKILL.md (name, description)
- Recursive skill discovery z `maxDepth` i source-type namespacing
- **Skill resolution z shadowingiem**: osobiste skille nadpisuja skille superpowers
- Git update checker z 3-sekundowym timeoutem (fail-safe)
- Brak TypeScript — czytelny ale bez typow statycznych

**`hooks/session-start`**:
- Bash script wypluwa JSON z `additionalContext`
- Obsluguje format zarowno Cursor jak i Claude hooks
- Wzorzec: hook jako prosty generator kontekstu

**`.opencode/plugins/superpowers.js`**:
- Plugin OpenCode uzywa `experimental.chat.system.transform`
- Wstrzykuje system prompt z ladowanymi skillami
- Wzorzec: plugin jako transformator prompta systemowego

**`agents/code-reviewer.md`**:
- YAML frontmatter + structured markdown prompt
- 6 wymiarow review (poprawnosc, wydajnosc, bezpieczenstwo, czytelnosc, maintainability, testability)
- Dobry wzorzec definicji agenta

#### Wzorce do adopcji

| Wzorzec | Opis | Priorytet |
|---------|------|-----------|
| Recursive skill discovery | Skanowanie katalogow z maxDepth | WYSOKI |
| Skill shadowing | Osobiste > workspace > globalne | WYSOKI |
| YAML frontmatter w SKILL.md | name + description jako minimum | WYSOKI |
| System prompt injection | Plugin transformuje prompt systemowy | SREDNI |
| Session-start hook | Generuje kontekst przy starcie sesji | SREDNI |

#### Slabosci
- Brak TypeScript — utrudnia refactoring i statyczna analize
- Brak testow jednostkowych
- Prosty model — nie skaluje sie na zlozone pipeline'y

---

### 4.2 Claude-Mem

**Repo**: `example-repos/tools/claude-mem/`
**Licencja**: ⚠️ **AGPL-3.0** — nie mozna kopiowac kodu!
**Jakosc kodu**: 9/10

#### Co to jest
System pamieci projektowej oparty o SQLite + MCP server. Przechowuje obserwacje, buduje timeline, dostarcza kontekst z inteligentnym budzetem tokenow.

#### Architektura techniczna

```
claude-mem/
├── src/
│   ├── services/
│   │   ├── sqlite/migrations.ts   # 7 migracji, FTS5, foreign keys
│   │   └── context/ContextBuilder.ts  # Orchestrator kontekstu
│   ├── servers/mcp-server.ts      # Serwer MCP z 3-warstwowym workflow
│   └── ...
└── ...
```

#### Analiza kodu (studiujemy wzorce, NIE kopiujemy)

**`migrations.ts`** — Wzorcowa implementacja migracji:
- 7 wersjonowanych migracji z `up`/`down`
- Foreign keys, indexy, FTS5 z platform detection fallback
- Wersjonowanie schematu bazy danych jest prawidlowe i kompletne
- **Wzorzec**: migracje wersjonowane z fallback na rozne platformy

**`ContextBuilder.ts`** — Czysty wzorzec orchetsratora:
- Koordynuje: config loading → DB queries → timeline building → rendering
- Architektura sekcyjna: HeaderRenderer, TimelineRenderer, SummaryRenderer, FooterRenderer
- Wbudowany kalkulator ekonomiki tokenow
- Multi-project/worktree support w zapytaniach do bazy
- **Wzorzec**: section-based rendering z budzetem tokenow

**`mcp-server.ts`** — Wzorcowy serwer MCP:
- Uzywa `@modelcontextprotocol/sdk`
- 3-warstwowy workflow: search → timeline → get_observations
- Parent heartbeat do detekcji osieroconych procesow
- Smart code tools: smart_search, smart_unfold, smart_outline (z tree-sitter)
- **Wzorzec**: hierarchiczny workflow narzedzi MCP

#### Kluczowe wzorce do REIMPLEMENTACJI (nie kopiowania!)

| Wzorzec | Opis | Priorytet |
|---------|------|-----------|
| Wersjonowane migracje SQLite | up/down z platform detection | WYSOKI |
| Section-based context rendering | HeaderRenderer, TimelineRenderer itd. | WYSOKI |
| Token budget calculator | Kalkulator ekonomiki w ContextBuilder | WYSOKI |
| 3-layer MCP workflow | search → timeline → details | SREDNI |
| Parent heartbeat | Detekcja osieroconych procesow | SREDNI |
| Smart code tools (tree-sitter) | Outline/unfold z AST parsing | NISKI (v2) |

#### Slabosci
- AGPL-3.0 — blokuje bezposrednia integracje kodu
- Zlozonosc — duzo abstrakcji na stosunkowo prosta funkcjonalnosc

---

### 4.3 Get Shit Done (GSD)

**Repo**: `example-repos/tools/get-shit-done/`
**Licencja**: MIT
**Jakosc kodu**: 8/10

#### Co to jest
Pipeline: interview → research → plan → execute → verify. Jedno polecenie (`npx get-shit-done-cc`) prowadzi uzytkownika przez caly cykl zycia projektu.

#### Architektura techniczna

```
get-shit-done/
├── bin/
│   ├── install.js           # Installer multi-runtime (Claude/OpenCode/Gemini/Codex)
│   └── gsd-tools.cjs        # CLI helper: STATE.md ops, frontmatter validation
├── workflows/
│   ├── new-project.md       # Orchestrator: interview → roadmap
│   ├── discuss-phase.md     # Per-phase interview
│   ├── plan-phase.md        # Plan creation + validation
│   ├── execute-phase.md     # Execution orchestration
│   └── execute-plan.md      # Wave/subagent execution
├── agents/                  # 12 agentow jako markdown
│   ├── gsd-planner.md       # ~800+ linii — goal-backward methodology
│   ├── gsd-executor.md      # Deviation rules, atomic commits
│   ├── gsd-verifier.md      # UAT against requirements
│   ├── gsd-plan-checker.md  # Plan validation
│   └── gsd-roadmapper.md    # ROADMAP.md + STATE.md generation
├── hooks/
│   ├── gsd-context-monitor.js  # PostToolUse: context warnings (35%/25%)
│   └── gsd-statusline.js       # Notification: model, task, context bar
└── docs/USER-GUIDE.md
```

#### Analiza kodu

**Agent prompts (gsd-planner.md, ~800+ linii)**:
- Najbardziej wyrafinowany design agentow ze wszystkich 7 narzedzi
- Goal-backward methodology: zaczynaj od celu, rozbijaj wstecz
- Task breakdown rules z explicit dependency graphs
- Wave-based parallel execution model
- Context budget rules (50% target)
- Gap closure mode + revision mode
- Checkpoint protocols
- **Wzorzec**: strukturalny prompt agenta z explicit rules i guardrails

**Executor (gsd-executor.md)**:
- 4 deviation rules:
  1. Auto-fix bugs
  2. Auto-add missing functionality
  3. Auto-fix blocking issues
  4. ASK about architectural changes
- Analysis paralysis guard: 5+ reads without write = STOP
- Authentication gates
- **Wzorzec**: deviation handling z eskalacja

**Hooks (gsd-context-monitor.js)**:
- PostToolUse hook czytajacy metryki z temp file bridge
- Context warnings: 35% = WARNING, 25% = CRITICAL
- Debounce (5 calls miedzy ostrzezeniami)
- Severity escalation obchodzi debounce
- Silent fail pattern — hook nigdy nie crashuje main process
- **Wzorzec**: context monitoring z debounce i eskalacja

**Hooks (gsd-statusline.js)**:
- Notification hook: model, task, directory, context usage bar
- Normalizacja na autocompact buffer
- GSD update check z cache
- **Wzorzec**: statusline z context bar

#### Pipeline workflow (KLUCZOWY dla DiriCode)

```
1. /gsd:new-project
   ├── Interactive interview (goals, constraints, tech)
   ├── Parallel researcher agents (optional)
   └── Output: PROJECT.md, REQUIREMENTS.md (z REQ-IDs), ROADMAP.md, STATE.md

2. Per-phase loop:
   ├── /gsd:discuss-phase N
   │   ├── Load prior context (PROJECT, REQUIREMENTS, STATE, prior CONTEXT)
   │   ├── Identify "gray areas" automatically
   │   ├── Multi-select decision areas → focused Q&A loops
   │   └── Output: {phase}-CONTEXT.md (locked decisions)
   │
   ├── /gsd:plan-phase N
   │   ├── Input: ROADMAP phase goal + REQUIREMENTS + CONTEXT + STATE
   │   ├── Create PLAN.md files (YAML frontmatter + tasks + file contracts)
   │   ├── Plan-checker validates: REQ coverage, structure, completeness
   │   └── Output: .planning/phases/NN-name/{phase}-{plan}-PLAN.md
   │
   └── /gsd:execute-phase N
       ├── gsd-tools init → executor config (model, branch, plans list)
       ├── Branch creation per phase/milestone
       ├── Spawn gsd-executor subagents in parallel WAVES
       ├── Each executor: atomic commits + SUMMARY.md + STATE update
       ├── Verifier: UAT against ROADMAP success criteria + REQ traceability
       ├── Gap closure: create fix-plans → re-execute
       └── Final: metadata commit (SUMMARY, STATE, ROADMAP, REQUIREMENTS)
```

#### Wzorce do adopcji

| Wzorzec | Opis | Priorytet |
|---------|------|-----------|
| Interview → Plan → Execute pipeline | Caly cykl zycia projektu | KRYTYCZNY |
| Goal-backward methodology | Planowanie od celu wstecz | WYSOKI |
| Wave-based parallel execution | Fale rownoleglych wykonawcow | WYSOKI |
| Deviation rules (4 rules) | Auto-fix vs ASK for arch changes | WYSOKI |
| REQ-ID traceability | Requirements → plans → verification | WYSOKI |
| Plan frontmatter schema | YAML z requirements, files, tasks | WYSOKI |
| Context monitoring + debounce | 35% WARNING, 25% CRITICAL | WYSOKI |
| Analysis paralysis guard | 5+ reads no write = STOP | SREDNI |
| Gray area identification | Auto-detect decision points | SREDNI |
| Gap closure mode | Weryfikacja → fix-plan → re-execute | SREDNI |
| STATE.md as project memory | Position, decisions, blockers, session | SREDNI |
| Silent fail hooks | Hook nigdy nie crashuje procesu | SREDNI |
| Multi-runtime installer | Adapter na Claude/OpenCode/Gemini/Codex | NISKI |

#### Slabosci
- Brak testow (pure prompt engineering, brak unit testow na gsd-tools)
- Prompty agentow sa bardzo dlugie (800+ linii) — ryzyko context overflow
- Node.js bez TypeScript w toolach CLI

---

### 4.4 n8n-MCP

**Repo**: `example-repos/tools/n8n-mcp/`
**Licencja**: MIT
**Jakosc kodu**: 7.5/10

#### Co to jest
Serwer MCP udostepniajacy 1084 wezly n8n jako narzedzia AI. Zawiera 72MB SQLite knowledge base.

#### Architektura techniczna

```
n8n-mcp/
├── src/
│   ├── index.ts              # Barrel exports
│   ├── mcp-engine.ts         # Express engine, health checks, graceful shutdown
│   ├── mcp/tools.ts          # ToolDefinition z annotacjami
│   ├── parsers/node-parser.ts  # Versioned node parser
│   └── ...
└── knowledge.db              # 72MB SQLite z 1084 node definitions
```

#### Analiza kodu

**`mcp-engine.ts`**:
- Express-based z health checks
- Session export/restore
- Graceful shutdown
- Multi-tenant via InstanceContext
- **Wzorzec**: solidny silnik MCP z session management

**`tools.ts`**:
- Well-structured ToolDefinition objects
- Annotacje: `readOnlyHint`, `idempotentHint`, `destructiveHint`
- Progressive detail levels: minimal (~200 tokenow), standard (~1-2K), full (~3-8K)
- **Wzorzec**: narzedzia MCP z annotacjami i progressive detail

**`node-parser.ts`**:
- Parsowanie wersjonowanych wezlow (versioned nodes, tool variants, output extraction)
- Duzo `as any` — udokumentowane jako "Strategic any assertion"
- Uzasadnione: external n8n schema nie ma pelnych typow TS
- **Wzorzec**: parser external schema z documented type assertions

#### Wzorce do adopcji

| Wzorzec | Opis | Priorytet |
|---------|------|-----------|
| Tool annotations | readOnlyHint, idempotentHint, destructiveHint | WYSOKI |
| Progressive detail levels | minimal/standard/full token budgets | WYSOKI |
| Session export/restore | Serializacja stanu sesji MCP | SREDNI |
| Graceful shutdown | Czysty shutdown serwera MCP | SREDNI |
| Multi-tenant InstanceContext | Wiele instancji MCP na jednym serwerze | NISKI (v2) |

#### Slabosci
- Uzywanie `as any` (choc udokumentowane)
- 72MB baza danych — ciezka zaleznosc
- Brak inline testow (testy w osobnym katalogu)

---

### 4.5 Obsidian Skills

**Repo**: `example-repos/tools/obsidian-skills/`
**Licencja**: MIT
**Jakosc kodu**: 9/10 (jako standard formatu)

#### Co to jest
Oficjalne skille Obsidian od CEO (Steph Ango). 5 skilli dla Claude Code/OpenCode/Codex CLI. Zloty standard formatu SKILL.md.

#### Architektura

```
obsidian-skills/
├── skills/
│   ├── obsidian-markdown/
│   │   ├── SKILL.md           # Definicja skilla + workflow + syntax
│   │   └── references/        # Pod-dokumenty (PROPERTIES.md, EMBEDS.md, CALLOUTS.md)
│   ├── obsidian-bases/
│   │   ├── SKILL.md
│   │   └── references/FUNCTIONS_REFERENCE.md
│   ├── json-canvas/
│   │   ├── SKILL.md
│   │   └── references/EXAMPLES.md
│   ├── obsidian-cli/SKILL.md
│   └── defuddle/SKILL.md
├── .claude-plugin/
│   ├── plugin.json            # Plugin metadata schema
│   └── marketplace.json       # Marketplace discovery
└── LICENSE
```

#### Format SKILL.md (ZLOTY STANDARD)

```yaml
---
name: obsidian-markdown
description: Create and edit Obsidian Flavored Markdown ...
---
```

Nastepnie sekcje markdown:
- **Workflow** — krok po kroku jak uzywac
- **Syntax reference** — kompletna dokumentacja
- **Examples** — pelne przyklady z kontekstem
- **References** — linki do pod-dokumentow w references/

#### Plugin metadata (.claude-plugin/plugin.json)

```json
{
  "name": "obsidian-skills",
  "version": "1.0.0",
  "description": "...",
  "author": "Steph Ango",
  "repository": "https://github.com/obsidianmd/obsidian-skills",
  "license": "MIT",
  "keywords": ["obsidian", "markdown", ...]
}
```

#### Wzorce do adopcji

| Wzorzec | Opis | Priorytet |
|---------|------|-----------|
| SKILL.md z YAML frontmatter | name + description (minimum) | KRYTYCZNY |
| references/ subfolder | Pod-dokumenty ladowane on-demand | WYSOKI |
| Workflow sections | Krok-po-kroku w SKILL.md | WYSOKI |
| plugin.json manifest | Metadata pakietu skilli | WYSOKI |
| marketplace.json | Discovery metadata | SREDNI |
| Multi-skill per repo | skills/<name>/SKILL.md pattern | SREDNI |

#### Rekomendowany rozszerzony frontmatter dla DiriCode

```yaml
---
name: <skill-id>
version: <semver>
description: <short description>
author: <author>
license: <SPDX id>
family: <coding|reasoning|creative|...>    # DiriCode-specific
file_extensions: [".md", ".canvas"]
triggers: ["wikilinks", "obsidian note"]
requires_tools: ["defuddle-cli"]           # optional
---
```

Bazuje na obserwowanym formacie Obsidian Skills, rozszerzony o pole `family` (kluczowe dla koncepcji Families w DiriCode) oraz dodatkowe metadane potrzebne do automatycznego odkrywania i dopasowywania skilli.

---

### 4.6 UI/UX Pro Max Skill

**Repo**: `example-repos/tools/ui-ux-pro-max-skill/`
**Licencja**: MIT
**Jakosc kodu**: 7/10

#### Co to jest
Data-driven skill do projektowania UI/UX. Zawiera bazy danych stylow, kolorow, typografii + szablony per-agent (Claude, OpenCode, Copilot, Gemini).

#### Architektura

```
ui-ux-pro-max-skill/
├── data/
│   ├── styles.csv             # ~90-120k tokenow danych designu
│   ├── colors.csv
│   ├── typography.csv
│   └── icons.csv
├── templates/
│   ├── platforms/
│   │   ├── claude.json        # Template per-agent
│   │   ├── opencode.json
│   │   ├── copilot.json
│   │   └── gemini.json
│   ├── skill-content.md       # Full template
│   └── quick-reference.md     # Compact template
├── scripts/
│   ├── core.py                # Assembly/build
│   ├── design_system.py       # Design system logic
│   └── search.py              # Search within data
└── SKILL.md
```

#### Analiza techniczna

**Podejscie CSV-first**:
- Dane domenowe w CSV zamiast hardcoded w promptach
- Umozliwia aktualizacje danych bez zmiany prompta
- ~90-120k tokenow jesli zaladowane w calosci — wymaga selective loading

**Per-agent templates**:
- Kazdy agent (Claude, OpenCode, Copilot, Gemini) ma dedykowany JSON template
- Dostosowuje format dostarczania do specyfiki platformy
- **Wzorzec**: multi-platform skill delivery

**Python scripts**:
- core.py — assembly danych i skilla
- design_system.py — logika design systemu
- search.py — wyszukiwanie w danych
- Mieszany tech stack (Python scripts w repo skilli) — nieoptymalne

#### Wzorce do adopcji

| Wzorzec | Opis | Priorytet |
|---------|------|-----------|
| Data-driven skills (CSV) | Dane oddzielone od promptow | SREDNI |
| Per-agent templates | Platformowy format dostarczania | NISKI (v2) |
| Selective loading | Ladowanie czesti danych wg potrzeb | SREDNI |

#### Slabosci
- Mieszany tech stack (Python w ekosystemie Node/TS)
- Bardzo duzy rozmiar (90-120k tokenow) — bez selective loading niepraktyczny
- Brak TypeScript

---

### 4.7 Awesome Claude Code

**Repo**: `example-repos/tools/awesome-claude-code/`
**Licencja**: CC BY-NC-ND 4.0 (lista kuratorska, nie kod)

#### Co to jest
Kuratorska lista narzedzi, skilli, hookow i pluginow dla Claude Code. Zawiera THE_RESOURCES_TABLE.csv z pelna baza danych wszystkich pozycji.

#### Struktura

```
awesome-claude-code/
├── README.md                  # Kuratorska lista z kategoriami
├── THE_RESOURCES_TABLE.csv    # Maszynowa baza pozycji (Category, Sub-Category, License, Stars...)
└── LICENSE                    # CC BY-NC-ND 4.0
```

#### Kategorie (sygnal popytu)

Wedlug objatosci (malejaco):

1. **Tooling** (NAJWAKSZA) — CLI frameworks, dashboardy, runtime helpers, IDE integrations, orchestratory
2. **Agent Skills** — domain-specific skill sets, skill bundles
3. **Workflows & Knowledge Guides** — workflow patterns, Ralph Wiggum (autonomous loops)
4. **Slash-Commands** — single-purpose commands (git, testing, context loading, docs)
5. **Hooks** — hook frameworks, safety hooks, prompt-injection scanning
6. **CLAUDE.md Files** — language/domain-specific prompt files
7. **Alternative Clients** — third-party UI/clients

#### Top projekty wg gwiazdek (z GitHub API)

| Projekt | Gwiazdki | Kategoria |
|---------|----------|-----------|
| affaan-m/everything-claude-code | ~66,585 | Agent Skills (meta) |
| davila7/claude-code-templates | ~22,381 | Tooling (templates) |
| K-Dense-AI/claude-scientific-skills | ~13,710 | Agent Skills (science) |
| trailofbits/skills | ~3,395 | Agent Skills (security) |
| pchalasani/claude-code-tools | ~1,558 | Tooling (session) |

#### Wnioski dla DiriCode

- **Tooling + Skills to 80% ekosystemu** — DiriCode musi miec first-class support
- **Hooks sa niszowe ale krytyczne** — safety hooks, permission gates, context monitoring
- **Session continuity** — wiele narzedzi obraca sie wokol przeszukiwania i wznawiania sesji
- **Orchestration patterns** (Ralph Wiggum) — potwierdzenie zapotrzebowania na autonomiczne petle
- **Containerized execution** — Docker/sandbox runners — potwierdza decyzje o Sandbox v2/v3

---

## 5. Wzorce architektoniczne do adopcji

### 5.1 KRYTYCZNE (Must-Have w MVP)

#### Pattern 1: SKILL.md z YAML frontmatter
- **Zrodlo**: Obsidian Skills + Superpowers
- **Opis**: Kazdy skill ma SKILL.md z frontmatter (name, description, family, version) + markdown body (workflow, examples, references)
- **DiriCode twist**: Dodac pole `family` (coding/reasoning/creative) do frontmatter
- **Implementacja**: Parser YAML frontmatter + recursive discovery (`skills/*/SKILL.md`)

#### Pattern 2: Interview → Plan → Execute Pipeline
- **Zrodlo**: GSD
- **Opis**: Ustrukturyzowany workflow: zbierz wymagania → zbuduj plan → wykonaj w falach → zweryfikuj
- **DiriCode twist**: Mapuje na agentow: project-builder (interview), planner (plan), code-writer (execute)
- **Implementacja**: Workflow engine z STATE jako plikiem stanu

#### Pattern 3: Tool Annotations (MCP)
- **Zrodlo**: n8n-MCP
- **Opis**: Kazde narzedzie MCP ma annotacje: readOnlyHint, idempotentHint, destructiveHint
- **DiriCode twist**: Router moze uzywac annotacji do decyzji o approval (destructive → pytaj usera)
- **Implementacja**: Rozszerzyc schema narzedzi o annotacje

#### Pattern 4: Context Monitoring
- **Zrodlo**: GSD (gsd-context-monitor.js)
- **Opis**: Hook monitoruje zuzycie kontekstu, ostrzega przy 35% (WARNING) i 25% (CRITICAL)
- **DiriCode twist**: Kluczowe dla Copilot (<200k context window) — ARCH-001
- **Implementacja**: PostToolUse hook z debounce i severity escalation

### 5.2 WYSOKIE (Silnie rekomendowane)

#### Pattern 5: Recursive Skill Discovery z Shadowingiem
- **Zrodlo**: Superpowers (skills-core.js)
- **Opis**: Skanuj katalogi z maxDepth, osobiste skille nadpisuja globalne
- **Prioriteta**: personal > workspace > family-default

#### Pattern 6: Wave-based Parallel Execution
- **Zrodlo**: GSD (execute-phase.md)
- **Opis**: Spawning executor agents in controlled waves, checkpoint/pause semantics
- **Powiazanie**: N-level delegation w DiriCode

#### Pattern 7: Deviation Rules
- **Zrodlo**: GSD (gsd-executor.md)
- **Opis**: 4 rules — auto-fix bugs, auto-add missing, auto-fix blocking, ASK for arch changes
- **Powiazanie**: Mandatory approval (hybrid) z ankiety

#### Pattern 8: REQ-ID Traceability
- **Zrodlo**: GSD (planner + verifier)
- **Opis**: Requirements maja IDs, plans referencjonuja IDs, verifier sprawdza coverage
- **Powiazanie**: GitHub Issues as project memory

#### Pattern 9: Section-based Context Rendering
- **Zrodlo**: Claude-Mem (ContextBuilder.ts) — REIMPLEMENTOWAC
- **Opis**: Header → Timeline → Summary → Footer, kazda sekcja z budzetem tokenow
- **Powiazanie**: Inherited context (ARCH-001)

#### Pattern 10: Progressive Detail Levels
- **Zrodlo**: n8n-MCP (tools.ts)
- **Opis**: minimal (~200 tokenow), standard (~1-2K), full (~3-8K) per tool
- **Powiazanie**: Context budget optimization

### 5.3 SREDNIE (Nice-to-Have / v2)

#### Pattern 11: Plan Frontmatter Schema
- **Zrodlo**: GSD (gsd-planner.md)
- **Opis**: YAML z title, requirements[], files_modified[], tasks[], success_criteria

#### Pattern 12: Analysis Paralysis Guard
- **Zrodlo**: GSD (gsd-executor.md)
- **Opis**: 5+ reads without write = STOP — zapobiega zawieszeniu agenta

#### Pattern 13: Silent Fail Hooks
- **Zrodlo**: GSD (hooks)
- **Opis**: Hook nigdy nie crashuje main process, ciche logowanie bledow

#### Pattern 14: STATE.md as Project Memory
- **Zrodlo**: GSD
- **Opis**: Plik stanu z position, decisions, blockers, session — read/patch API

#### Pattern 15: Gray Area Auto-Detection
- **Zrodlo**: GSD (discuss-phase.md)
- **Opis**: Automatyczna identyfikacja obszarow wymagajacych decyzji uzytkownika

---

## 6. Wzorce do unikania

| Wzorzec | Zrodlo | Dlaczego unikac |
|---------|--------|-----------------|
| `as any` assertions | n8n-MCP | Ryzyko runtime errors, zly precedens |
| 800+ liniowe prompty agentow | GSD | Context overflow, trudne w utrzymaniu |
| Mieszany tech stack w skillach | UI/UX Pro Max | Python scripts w ekosystemie Node — confusion |
| 90-120k tokenow danych w skillu | UI/UX Pro Max | Bez selective loading niepraktyczne |
| AGPL kod w produkcji | Claude-Mem | Viralny copyleft — prawne ryzyko |
| CSS-first bez CSV dla danych | UI/UX Pro Max | Dane powinny byc oddzielone ale CSV nie jest najlepszy format |
| Brak testow | Superpowers, GSD | Utrudnia refactoring, brak regresji |

---

## 7. Rekomendacje dla DiriCode

### 7.1 System Skilli (SKILL.md)

**Bazowac na**: Obsidian Skills (format) + Superpowers (discovery) + GSD (agent prompts)

```yaml
# Rekomendowany SKILL.md frontmatter
---
name: <skill-id>
version: <semver>
description: <krotki opis>
family: <coding|reasoning|creative|devops|...>
author: <autor>
license: <SPDX>
file_extensions: [".ts", ".tsx"]           # opcjonalne
triggers: ["react component", "frontend"]  # natural-language hints
requires_tools: []                         # opcjonalne
mcp_server: false                          # czy skill embedduje MCP
---

# Workflow
1. ...
2. ...

# Reference
See [references/API.md](references/API.md)
```

**Discovery**: `skills/*/SKILL.md` recursive z maxDepth=3, shadowing (personal > workspace > family-default)

### 7.2 System Hookow

**Bazowac na**: GSD (context-monitor, statusline) + Claude Code (12+ typow)

Rekomendowane typy hookow (15-20 wedlug ARCH-003):
1. `session-start` — inicjalizacja kontekstu (Superpowers)
2. `session-end` — czyszczenie, statystyki
3. `pre-tool-use` — zatwierdzenie przed uryciem narzedzia
4. `post-tool-use` — context monitoring, metryki (GSD)
5. `pre-message` — transformacja wiadomosci wejsciowej
6. `post-message` — transformacja odpowiedzi
7. `pre-commit` — walidacja przed commitem
8. `post-commit` — notyfikacja, CI trigger
9. `pre-delegation` — zatwierdzenie delegacji do subagenta
10. `post-delegation` — zbieranie wynikow delegacji
11. `context-warning` — ostrzezenie o zuzyciu kontekstu (GSD)
12. `context-critical` — krytyczne zuzycie kontekstu
13. `error` — obsluga bledow
14. `approval-request` — pytanie do uzytkownika o zgode
15. `approval-response` — odpowiedz uzytkownika
16. `plan-created` — po wygenerowaniu planu (GSD)
17. `plan-validated` — po walidacji planu
18. `statusline` — aktualizacja paska statusu (GSD)
19. `notification` — powiadomienia uzytkownika

**Implementacja hookow**: Node.js scripts z silent fail pattern (GSD), 3s timeout (Superpowers)

### 7.3 Narzedzia MCP

**Bazowac na**: n8n-MCP (tool definitions) + Claude-Mem (workflow patterns)

- Kazde narzedzie z annotacjami: `readOnlyHint`, `idempotentHint`, `destructiveHint`
- Progressive detail: minimal/standard/full
- Router uzywa annotacji do approval flow: destructive → mandatory approval

### 7.4 Pipeline Projektu (project-builder agent)

**Bazowac na**: GSD (interview → plan → execute)

DiriCode powinien miec analogiczny pipeline:
1. **project-builder** (agent) = GSD's new-project interview + discuss-phase
2. **planner** (agent) = GSD's plan-phase + plan-checker
3. **code-writer** (agent) = GSD's executor
4. **code-reviewer** (agent) = GSD's verifier
5. **explorer** (agent) = GSD's researcher (parallel fact-finding)

Z kluczowymi roznicami:
- **Web UI** zamiast CLI (ankieta)
- **Families** — agenci naleza do rodzin, matching by family
- **N-level delegation** — executory moga delegowac dalej

### 7.5 Context Management

**Bazowac na**: Claude-Mem (section rendering) + GSD (context monitoring)

- Section-based rendering z token budget per sekcja (REIMPLEMENTOWAC od zera, nie kopiowac z Claude-Mem)
- Context monitor hook: 35% WARNING, 25% CRITICAL (GSD)
- Progressive detail levels dla narzedzi (n8n-MCP)
- Kluczowe dla ARCH-001: Copilot ma <200k context window

---

## 8. Mapowanie na TASK-y

| TASK z analizy-todo.md | Narzedzia dostarczajace input |
|------------------------|-------------------------------|
| TASK-001: Hooks analysis (15-20 types) | GSD (context-monitor, statusline), Superpowers (session-start) |
| TASK-002: Context management | Claude-Mem (ContextBuilder), GSD (context-monitor), n8n-MCP (progressive detail) |
| TASK-005: Router architecture | n8n-MCP (tool annotations), GSD (deviation rules → approval flow) |
| TASK-007: Indexing | Claude-Mem (FTS5, smart_search, smart_outline) |
| TASK-010: License analysis | **DONE** — macierz licencji w sekcji 2 |
| TASK (skill system) | Obsidian Skills (format), Superpowers (discovery), GSD (agent prompts) |
| TASK (agent design) | GSD (12 agentow, pipeline), Superpowers (code-reviewer) |
| TASK (project memory) | GSD (STATE.md, REQUIREMENTS.md), Claude-Mem (timeline) |

---

## Podsumowanie

### Co ADOPTOWAC (bezposrednio lub adaptowac)
1. ✅ Format SKILL.md z Obsidian Skills (rozszerzony o `family`)
2. ✅ Recursive discovery z Superpowers (z shadowing)
3. ✅ Pipeline interview→plan→execute z GSD
4. ✅ Context monitoring hooks z GSD
5. ✅ Tool annotations z n8n-MCP
6. ✅ Wave-based execution z GSD
7. ✅ Deviation rules z GSD

### Co REIMPLEMENTOWAC od zera (wzorce ok, kod nie — AGPL)
1. ⚠️ Section-based context rendering (wzorzec Claude-Mem)
2. ⚠️ Token budget calculator (wzorzec Claude-Mem)
3. ⚠️ Wersjonowane migracje SQLite (wzorzec Claude-Mem)
4. ⚠️ 3-layer MCP workflow (wzorzec Claude-Mem)

### Czego UNIKAC
1. ⛔ Kopiowania kodu z Claude-Mem (AGPL)
2. ⛔ `as any` assertions (n8n-MCP pattern)
3. ⛔ 800+ liniowych promptow (GSD — podzielic na mniejsze)
4. ⛔ Mieszanego tech stacku w skillach (UI/UX Pro Max)
5. ⛔ Bazy 90-120k tokenow bez selective loading

---

> **Nastepny krok**: Przejsc do realizacji TASK-ow z `analizy-todo.md`, zaczynajac od TASK-010 (licencje — juz czesciowo gotowy) i TASK-005 (router — blokuje build).
