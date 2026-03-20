# DiriCode — Ankieta: Features z ekosystemu Claude Code

> **Data**: 2026-03-08
> **Status**: KOMPLETNA
> **Zrodlo**: Analiza 7 narzedzi (`analiza-narzedzi-ekosystem.md`)
> **Cel**: Decyzja ktore wzorce/features adoptowac w DiriCode, w jakiej kolejnosci

---

## Jak wypelniac

Przy kazdym feature odpowiedz:
- **TAK** / **NIE** / **POZNIEJ (vN)** / **WYMAGA ANALIZY**
- Opcjonalnie: komentarz, modyfikacje, wlasna wizja

---

## BLOK 1: SYSTEM SKILLI (zrodlo: Obsidian Skills + Superpowers)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 1.1 | SKILL.md z YAML frontmatter | Obsidian Skills | Kazdy skill = plik SKILL.md z frontmatter `name`, `description` + markdown body (workflow, examples, references) | **TAK, MVP** — Core skille hardcoded w TS, dodatkowe w formacie agentskills.io SKILL.md |
| 1.2 | Rozszerzony frontmatter z `family` | Nowy (DiriCode) | Dodac do frontmatter: `family` (coding/reasoning/creative/devops), `version`, `author`, `license`, `file_extensions`, `triggers` | **TAK, MVP** — Ale minimum: tylko `family` + `version` (wystarczajace do matchowania) |
| 1.3 | references/ subfolder | Obsidian Skills | Skill moze miec podkatalog `references/` z dokumentami ladowanymi on-demand (np. API.md, EXAMPLES.md) | **TAK, MVP** |
| 1.4 | Recursive skill discovery | Superpowers | Skanowanie `skills/*/SKILL.md` z maxDepth, automatyczne znajdowanie skilli | **POZNIEJ** — Nie MVP, dodamy iteracyjnie |
| 1.5 | Skill shadowing (priorytet) | Superpowers | Osobiste skille > workspace skille > family-default skille (nadpisywanie) | **TAK, MVP** — Hierarchia: personal > workspace > family-default |
| 1.6 | Multi-skill per repo | Obsidian Skills | Jeden repo moze zawierac wiele skilli: `skills/<name>/SKILL.md` | **TAK, MVP** — Skille organizowane w foldery wg nazwy rodziny, manualnie przypisywane |
| 1.7 | plugin.json manifest | Obsidian Skills | Metadata pakietu skilli (name, version, description, author, repo, license, keywords) | **NIE** — Frontmatter wystarczy, osobny manifest niepotrzebny |
| 1.8 | marketplace.json | Obsidian Skills | Discovery metadata dla marketplace/katalogu skilli | **NIE** — Marketplace w v2/v3 |
| 1.9 | Skill-embedded MCP server | Ankieta BLOK 10 | Skill moze zawierac MCP server (skill = wiedza + narzedzia) — juz potwierdzone, ale jak technicznie? | **TAK, MVP** — Skill moze zawierac MCP, ale MCP musi byc najpierw skonfigurowany w DiriCode |
| NEW | agentskills.io standard | Zbadany w sesji | agentskills.io to swiatowy standard skilli (Anthropic, Cursor, GitHub Copilot, OpenCode, Codex, JetBrains Junie, 87k stars) | **TAK** — DiriCode podaza za swiatowym standardem |

---

## BLOK 2: PIPELINE PROJEKTU (zrodlo: GSD)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 2.1 | Interview -> Plan -> Execute pipeline | GSD | Ustrukturyzowany workflow: zbierz wymagania -> zbuduj plan -> wykonaj -> zweryfikuj | **TAK, MVP** — Rozne agenty dla interview, research, plan, implementacja, review |
| 2.2 | Gray area auto-detection | GSD (discuss-phase) | System automatycznie identyfikuje obszary wymagajace decyzji usera (UI layout, API format, error handling) | **TAK, MVP** |
| 2.3 | REQUIREMENTS.md z REQ-IDs | GSD | Kazde wymaganie ma unikalny ID (REQ-001), referencjonowany w planach i weryfikacji | **TAK, MVP** — Ale backend to GitHub Issues/Epiki, nie pliki .md. "Epiki i issues, dobrze numerowac" |
| 2.4 | PLAN.md z YAML frontmatter | GSD (planner) | Plan jako markdown z frontmatter: title, requirements[], files_modified[], tasks[], success_criteria | **TAK, MVP** — Format: GitHub Issues + Epic. Kazdy task = osobny Issue, polaczone Epic-iem. Worktree-safe |
| 2.5 | Plan-checker (walidacja planu) | GSD | Osobny agent/krok walidujacy plan: pokrycie wymagan, struktura, kompletnosc | **TAK, MVP** — Jakis agent pokrywa to w workflow |
| 2.6 | STATE.md jako pamiec projektu | GSD | Plik stanu z: position, decisions, blockers, session. Programmatic read/patch API | **NIE jako .md** — GitHub Issues jako backend (problem git worktree) |
| 2.7 | ROADMAP.md z fazami | GSD | Roadmapa projektu podzielona na fazy z success criteria | **GitHub Issues/Epics** — "Temat otwarty", ale nie .md pliki |
| 2.8 | Gap closure mode | GSD (verifier) | Po weryfikacji: znalezione problemy -> automatyczny fix-plan -> re-execute | **TAK, MVP** — W code-reviewer lub dodatkowy agent, opcjonalny (oszczednosc tokenow) |
| 2.9 | Goal-backward methodology | GSD (planner) | Planowanie od celu wstecz zamiast od poczatku do przodu | **TAK** — "Testowac rozne metody planowania" — dlatego 2 rozne planery (thorough + quick) |
| 2.10 | Per-phase CONTEXT.md | GSD (discuss-phase) | Plik z "zamknietymi decyzjami" per faza — planner i executor musza je respektowac | **NIE jako .md** — Problem git worktree. Decyzje w GitHub Issues |

---

## BLOK 3: WYKONANIE I DELEGACJA (zrodlo: GSD + Claude-Mem)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 3.1 | Wave-based parallel execution | GSD | Spawning executor agents w kontrolowanych falach, checkpoint/pause miedzy falami | **TAK, MVP** |
| 3.2 | Deviation rules (4 reguly) | GSD (executor) | 1) Auto-fix bugs, 2) Auto-add missing, 3) Auto-fix blocking, 4) ASK for arch changes | **TAK, MVP** |
| 3.3 | Analysis paralysis guard | GSD (executor) | 5+ reads bez write = STOP, zapobiega zawieszeniu agenta w nieskonczonej analizie | **TAK, MVP** |
| 3.4 | Atomic commits per task | GSD (executor) | Kazdy task = osobny commit, plus metadata commit na koniec | **TAK, MVP** |
| 3.5 | SUMMARY.md per execution | GSD (executor) | Kazdy executor produkuje podsumowanie: co zrobil, jakie pliki, commit hash, testy | **TAK, MVP** — Ale zapis do GitHub Issue, nie .md plik |
| 3.6 | Verifier agent (UAT) | GSD (verifier) | Osobny agent sprawdzajacy wynik vs requirements i success criteria | **TAK, MVP** — Osobny agent (nie czesc code-reviewera) |
| 3.7 | Section-based context rendering | Claude-Mem | Context podzielony na sekcje (Header, Timeline, Summary, Footer) z budzetem tokenow per sekcja | **TAK, MVP** — Najpierw przeanalizowac konkurencje |
| 3.8 | Token budget calculator | Claude-Mem | Kalkulator ekonomiki tokenow w context builderze — ile jaka sekcja "kosztuje" | **POZNIEJ** — Nie MVP |
| 3.9 | Progressive detail levels | n8n-MCP | Narzedzia z 3 poziomami detalu: minimal (~200 tok), standard (~1-2K), full (~3-8K) | **TAK, MVP** |

---

## BLOK 4: HOOKI (zrodlo: GSD + Superpowers)

**Decyzja zbiorcza**: Framework hookow + dodawanie iteracyjnie. MVP = 6 hookow + silent fail pattern + DAG.

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 4.1 | session-start hook | Superpowers | Inicjalizacja kontekstu przy starcie sesji (JSON z additionalContext) | **TAK, MVP** |
| 4.2 | session-end hook | Nowy | Czyszczenie, statystyki, zapis metryki sesji | **POZNIEJ** |
| 4.3 | pre-tool-use hook | Nowy | Zatwierdzenie przed uzyciem narzedzia (approval gate) | **POZNIEJ** |
| 4.4 | post-tool-use hook | GSD (context-monitor) | Context monitoring, metryki, warnings po kazdym uzyciu narzedzia | **POZNIEJ** |
| 4.5 | context-warning (35%) | GSD | Ostrzezenie gdy kontekst spada do 35% dostepnego okna | **NIE** — Odrzucone |
| 4.6 | context-critical (25%) | GSD | Krytyczne ostrzezenie gdy kontekst spada do 25% | **NIE** — Odrzucone |
| 4.7 | pre-delegation hook | Nowy | Zatwierdzenie przed delegacja do subagenta | **NIE** — Odrzucone |
| 4.8 | post-delegation hook | Nowy | Zbieranie i walidacja wynikow delegacji | **NIE** — Odrzucone |
| 4.9 | pre-commit hook | Nowy | Walidacja przed commitem (lint, tests, secret scan) | **TAK, MVP** |
| 4.10 | post-commit hook | Nowy | Notyfikacja, CI trigger po commicie | **TAK, MVP** |
| 4.11 | statusline hook | GSD (statusline) | Aktualizacja paska statusu: model, task, directory, context bar | **POZNIEJ** |
| 4.12 | notification hook | GSD | Powiadomienia uzytkownika (web push, sound, badge) | **POZNIEJ** |
| 4.13 | error hook | Nowy | Obsluga bledow — logowanie, retry logic, eskalacja | **TAK, MVP** — Tylko retry |
| 4.14 | approval-request hook | Nowy | Pytanie do usera o zgode (powiazane z mandatory approval) | **POZNIEJ** |
| 4.15 | approval-response hook | Nowy | Przetworzenie odpowiedzi usera (zapamietaj, naucz) | **POZNIEJ** |
| 4.16 | plan-created hook | GSD | Trigger po wygenerowaniu planu (mozna odpalic plan-checker) | **TAK, MVP** |
| 4.17 | plan-validated hook | GSD | Trigger po walidacji planu (mozna auto-execute) | **TAK, MVP** |
| 4.18 | pre-message hook | Nowy | Transformacja wiadomosci wejsciowej przed wyslaniem do modelu | **POZNIEJ** |
| 4.19 | post-message hook | Nowy | Transformacja/logowanie odpowiedzi modelu | **POZNIEJ** |
| 4.20 | Silent fail pattern | GSD | Hooki NIGDY nie crashuja main process — ciche logowanie bledow, 3s timeout | **TAK, MVP** |

---

## BLOK 5: NARZEDZIA MCP (zrodlo: n8n-MCP + Claude-Mem)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 5.1 | Tool annotations | n8n-MCP | Kazde narzedzie MCP z annotacjami: readOnlyHint, idempotentHint, destructiveHint | **TAK, MVP** — Etykiety na narzedziach (readOnly, destructive, idempotent). Approval flow pozniej |
| 5.2 | Annotation-driven approval | Nowy (DiriCode) | Router uzywa annotacji do approval flow: destructive -> mandatory user approval | **POZNIEJ (v2)** — Approval flow oparty na annotacjach, po zaimplementowaniu 5.1 |
| 5.3 | 3-layer MCP workflow | Claude-Mem | Hierarchiczny workflow: search -> timeline -> get_details (od ogolu do szczegolu) | **TAK, MVP** |
| 5.4 | Smart code tools | Claude-Mem | smart_search, smart_unfold, smart_outline z tree-sitter AST parsing | **TAK, MVP** |
| 5.5 | Parent heartbeat | Claude-Mem | Detekcja osieroconych procesow MCP — heartbeat od parent, auto-cleanup | **TAK, MVP** |
| 5.6 | Session export/restore (MCP) | n8n-MCP | Serializacja i deserializacja stanu sesji MCP | **TAK, MVP** |
| 5.7 | Graceful shutdown | n8n-MCP | Czysty shutdown serwera MCP z cleanup zasobow | **TAK, MVP** |

---

## BLOK 6: CONTEXT MANAGEMENT (zrodlo: GSD + Claude-Mem + n8n-MCP)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 6.1 | Context monitoring hook | GSD | PostToolUse: mierz zuzycie kontekstu, debounce (5 calls), severity escalation | **POZNIEJ** — Hooki context-* odrzucone z MVP |
| 6.2 | Context thresholds | GSD | 35% = WARNING, 25% = CRITICAL — konfigurowalne? | **POZNIEJ** — Hooki context-* odrzucone z MVP |
| 6.3 | Section-based rendering z budzetem | Claude-Mem | Kazda sekcja kontekstu ma max tokenow — priorytetyzacja sekcji | **TAK, MVP** — Potwierdzone (patrz 3.7) |
| 6.4 | Progressive detail per narzedzie | n8n-MCP | 3 poziomy detalu per narzedzie — mniej detalu gdy mniej kontekstu | **TAK, MVP** — Potwierdzone (patrz 3.9) |
| 6.5 | Debounce + severity escalation | GSD | Nie spamuj ostrzezeniami, ale CRITICAL obchodzi debounce | **POZNIEJ** — Powiazane z context hooks |
| 6.6 | Autocompact buffer normalization | GSD (statusline) | Context bar normalizowany na autocompact buffer | **POZNIEJ** |
| 6.7 | System prompt injection | Superpowers | Plugin transformuje system prompt — dodaje skille, kontekst | **TAK, MVP** |

---

## BLOK 7: PAMIEC PROJEKTU (zrodlo: GSD + Claude-Mem)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 7.1 | STATE.md z programmatic API | GSD | Stan projektu jako plik z API do read/patch (position, decisions, blockers) | **NIE jako .md** — GitHub Issues jako backend. Nie local cache, GitHub only |
| 7.2 | REQUIREMENTS.md z traceability | GSD | Wymagania z REQ-IDs, trackowalne przez plan -> execution -> verification | **TAK** — Ale w GitHub Issues/Epiki, nie .md pliki |
| 7.3 | PROJECT.md (vision doc) | GSD | Dokument wizji projektu ladowany jako kontekst bazowy | **TAK** — Jako GitHub Issue lub repo README |
| 7.4 | Versioned SQLite migrations | Claude-Mem | Migracje bazy danych z up/down i platform detection fallback | **TAK, MVP** — SQLite w Hono serverze (rozwiazuje problem worktree) |
| 7.5 | FTS5 full-text search | Claude-Mem | Pelnotekstowe wyszukiwanie w bazie pamieci | **TAK, MVP** — W SQLite w Hono |
| 7.6 | Timeline-based memory | Claude-Mem | Pamiec jako timeline obserwacji (nie flat list) | **TAK, MVP** |
| 7.7 | Multi-project/worktree support | Claude-Mem | Zapytania do bazy uwzgledniaja projekt i worktree | **TAK, MVP** — Dzieki SQLite w Hono agenci/worktree gadaja z API, nie bezposrednio z plikiem |

---

## BLOK 8: AGENCI — DESIGN PROMPTOW (zrodlo: GSD + Superpowers)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 8.1 | YAML frontmatter w agent .md | GSD + Superpowers | Agent definiowany jako markdown z frontmatter: name, description, tools, color, skills, hooks | **TAK, MVP** — Core agenci w TS, custom agenci jako SKILL.md z rozszerzonym frontmatter (brak standardu swiatowego dla agentow) |
| 8.2 | Structured review dimensions | Superpowers (code-reviewer) | Agent review z explicit wymiarami: poprawnosc, wydajnosc, bezpieczenstwo, czytelnosc, maintainability, testability | **TAK, MVP** — 2 reviewery: code-reviewer-thorough (6 wymiarow, drogi model) + code-reviewer-quick (basic sanity check, tani model) |
| 8.3 | Deviation rules w executor | GSD | 4 jasne reguly kiedy auto-fix, kiedy pytac — wbudowane w prompt agenta | **TAK, MVP** — Potwierdzone (patrz 3.2) |
| 8.4 | Analysis paralysis guard | GSD | Guardrail: 5+ reads bez write = eskalacja | **TAK, MVP** — 5 readow bez write = STOP i pytaj usera |
| 8.5 | Context budget rules | GSD (planner) | Regula: utrzymuj 50% context window wolne | **TAK, MVP** — Agent nie zuzywa wiecej niz 50% okna kontekstu, reszta na myslenie |
| 8.6 | Checkpoint protocols | GSD (executor) | Agent robi checkpoint po kazdym task, mozliwosc wznowienia | **TAK, MVP** — Zapis progressu po kazdym kroku, wznowienie po awarii zamiast od nowa |
| 8.7 | Goal-backward in planner prompt | GSD (planner) | Planner prompt nakazuje planowanie od celu wstecz | **TAK, MVP** — 2 planery: planner-thorough (goal-backward, glebokie) + planner-quick (szybki plan) |
| 8.8 | Multi-runtime installer | GSD (install.js) | Installer adaptuje agentow/skille do roznych runtime'ow (Claude/OpenCode/Gemini/Codex) | **Nie omowiony** |

---

## BLOK 9: DATA-DRIVEN SKILLS (zrodlo: UI/UX Pro Max)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 9.1 | CSV/JSON dane w skillach | UI/UX Pro Max | Dane domenowe (style, kolory, API specs) jako pliki danych, nie hardcoded w promptach | **TAK** — Skille organizowane wg rodzin, matchowane do agentow po rodzinie |
| 9.2 | Selective loading danych | UI/UX Pro Max | Ladowanie tylko potrzebnych czesci danych (nie calych 90-120k tokenow) | **TAK** — Skille organizowane wg rodzin, matchowane do agentow po rodzinie |
| 9.3 | Per-agent templates | UI/UX Pro Max | Rozne formaty dostarczania tych samych danych dla roznych agentow/platform | **POZNIEJ (v2)** |

---

## BLOK 10: EKOSYSTEM I DISCOVERY (zrodlo: Awesome Claude Code)

| # | Feature | Zrodlo | Opis | Decyzja |
|---|---------|--------|------|---------|
| 10.1 | Skill/plugin catalog | Awesome CC | Wbudowany katalog skilli/pluginow z search (jak npm registry, ale dla skilli) | **POZNIEJ (v2)** |
| 10.2 | Category-based discovery | Awesome CC | Skille/narzedzia podzielone na kategorie: Agent Skills, Tooling, Hooks, Slash-Commands, CLAUDE.md | **POZNIEJ (v2)** |
| 10.3 | Star/popularity ranking | Awesome CC | Ranking narzedzi wg popularnosci (gwiazdki, uzycie, rating) | **POZNIEJ (v2+)** |
| 10.4 | License compatibility filter | Awesome CC + analiza | Filtrowanie narzedzi po kompatybilnosci licencji z projektem | **POZNIEJ (v2+)** |
| 10.5 | One-command install | Awesome CC pattern | `diricode install <skill-name>` — jak npm install, ale dla skilli | **POZNIEJ** |
| 10.6 | Auto-update check | Superpowers | Sprawdzanie aktualizacji skilli z cache i 3s timeout | **POZNIEJ** |

---

## BLOK 11: PYTANIA STRATEGICZNE

| # | Pytanie | Kontekst | Decyzja |
|---|---------|----------|---------|
| 11.1 | Gdzie przechowywac STATE/REQUIREMENTS/ROADMAP? | GSD uzywa .planning/ dir. DiriCode moze uzyc .diricode/ lub oddzielny katalog | **GitHub Issues/Epics** — Nie .md pliki (problem git worktree). GitHub first, GitLab v2/v3, Jira v4 |
| 11.2 | Markdown vs SQLite dla pamieci projektu? | GSD = czyste MD pliki. Claude-Mem = SQLite z FTS5. Mozna hybrydowo? | **SQLite w Hono serverze** — Baza zyje w procesie serwera DiriCode. Agenci/worktree gadaja z API |
| 11.3 | Ile hookow w MVP? | Lista ma 19 typow + silent fail pattern. Ktore krytyczne? 5? 10? 15? | **6 hookow + silent fail + DAG**: session-start, pre-commit, post-commit, error (retry), plan-created, plan-validated |
| 11.4 | Plan format: wlasny czy GSD-compatible? | Czy DiriCode powinien czytac plany GSD (kompatybilnosc) czy miec wlasny format? | **GitHub Issues + Epic** — Kazdy task = osobny Issue, plan = Epic. Worktree-independent |
| 11.5 | Auto-advance (full auto) w MVP? | GSD ma flagi --auto (skip discuss, auto-plan, auto-execute). Czy DiriCode tez? | **v3** — Auto-advance dopiero w v3 |
| 11.6 | Verifier jako osobny agent czy czesc code-reviewera? | GSD ma osobny gsd-verifier. DiriCode ma juz code-reviewer w POC 1. Laczyc czy rozdzielac? | **Osobny agent** — Verifier oddzielony od code-reviewera |
| 11.7 | Smart code tools (tree-sitter) — kiedy? | Claude-Mem ma smart_search, smart_unfold, smart_outline. Przydatne ale zlozonosc. MVP czy v2? | **TAK, MVP** — Potwierdzone (patrz 5.4) |

---

## PODSUMOWANIE PRIORYTETOW

### MVP (POC 1-3)

**System skilli:**
- 1.1 SKILL.md (core TS + agentskills.io standard)
- 1.2 Frontmatter minimum (family + version)
- 1.3 references/ subfolder
- 1.5 Skill shadowing (personal > workspace > family-default)
- 1.6 Multi-skill per repo (foldery wg rodziny)
- 1.9 Skill-embedded MCP
- NEW agentskills.io standard

**Pipeline projektu:**
- 2.1 Interview -> Plan -> Execute (rozne agenty per faza)
- 2.2 Gray area auto-detection
- 2.3 REQ-IDs w GitHub Issues/Epiki
- 2.4 Plan format: GitHub Issues + Epic (worktree-independent)
- 2.5 Plan-checker
- 2.8 Gap closure (opcjonalny, oszczednosc tokenow)
- 2.9 Goal-backward (2 planery: thorough + quick)

**Wykonanie i delegacja:**
- 3.1 Wave-based parallel execution
- 3.2 Deviation rules (4 reguly)
- 3.3 Analysis paralysis guard (5+ reads = STOP)
- 3.4 Atomic commits per task
- 3.5 Summary do GitHub Issue
- 3.6 Verifier agent (osobny)
- 3.7 Section-based context rendering
- 3.9 Progressive detail levels (3 poziomy)

**Hooki (6 + pattern):**
- 4.1 session-start
- 4.9 pre-commit
- 4.10 post-commit
- 4.13 error (retry only)
- 4.16 plan-created
- 4.17 plan-validated
- 4.20 Silent fail pattern + DAG

**Narzedzia MCP:**
- 5.1 Tool annotations (readOnly, destructive, idempotent)
- 5.3 3-layer MCP workflow
- 5.4 Smart code tools (tree-sitter)
- 5.5 Parent heartbeat
- 5.6 Session export/restore
- 5.7 Graceful shutdown

**Context management:**
- 6.3 Section-based rendering z budzetem
- 6.4 Progressive detail per narzedzie
- 6.7 System prompt injection

**Pamiec projektu:**
- 7.2 REQ-IDs w GitHub Issues
- 7.4 SQLite w Hono (versioned migrations)
- 7.5 FTS5 full-text search
- 7.6 Timeline-based memory
- 7.7 Multi-project/worktree support

**Agenci:**
- 8.1 Core TS + custom SKILL.md
- 8.2 2 reviewery (thorough + quick)
- 8.3 Deviation rules
- 8.4 Analysis paralysis guard (5+ reads bez write = STOP)
- 8.5 Context budget (max 50% okna kontekstu)
- 8.6 Checkpoint protocols (wznowienie po awarii)
- 8.7 2 planery (thorough + quick)

**Data-driven skills:**
- 9.1 + 9.2 Dane w skillach, selective loading wg rodzin

### v2

- 1.4 Recursive skill discovery
- 3.8 Token budget calculator
- 5.2 Annotation-driven approval (czeka na 5.1 z MVP)
- 6.1 Context monitoring hook
- 6.2 Context thresholds (35%/25%)
- 6.5 Debounce + severity escalation
- 6.6 Autocompact buffer normalization
- 9.3 Per-agent templates
- 10.1 Skill/plugin catalog
- 10.2 Category-based discovery
- 10.5 One-command install (`diricode install <skill>`)

### v3+

- 4.2 session-end hook
- 4.3 + 4.4 Tool-use hooks (pre/post)
- 4.11 + 4.12 UI hooks (statusline, notification)
- 4.14 + 4.15 Approval hooks
- 4.18 + 4.19 Message hooks (pre/post)
- 10.3 Star/popularity ranking
- 10.4 License compatibility filter
- 10.6 Auto-update check
- 11.5 Auto-advance (full auto)

### ODRZUCONE

- 1.7 plugin.json manifest — Frontmatter wystarczy
- 1.8 marketplace.json — Niepotrzebne w MVP ani v2
- 2.6 STATE.md — Problem git worktree, zastapione przez GitHub Issues
- 2.10 Per-phase CONTEXT.md — Problem git worktree, zastapione przez GitHub Issues
- 4.5 + 4.6 Context hooks (warning/critical) — Odrzucone
- 4.7 + 4.8 Delegation hooks — Odrzucone

### WSZYSTKIE FOLLOW-UP ZAMKNIETE


---

> **Status**: ANKIETA KOMPLETNA. Wszystkie decyzje podjete. Nastepny krok: aktualizacja spec-mvp-diricode.md i plan-implementacji-diricode.md.
