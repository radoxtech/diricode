# Analiza Konkurencyjna: Claude Code

> Data: 7 marca 2026
> Wersja analizowana: v2.1.71 (ostatni wpis CHANGELOG)
> Repo: https://github.com/anthropics/claude-code

---

## 1. Podsumowanie

Claude Code to proprietary CLI coding agent od Anthropic, zamkniety na ekosystem modeli Claude (haiku, sonnet, opus). Projekt ma rozbudowany system pluginow (13 w marketplace), agentow definiowanych jako pliki Markdown z YAML frontmatter, oraz hookow implementowanych jako zewnetrzne procesy (Python/bash). Architektura jest plaska (brak dispatchera) — komendy bezposrednio spawnuja agentow sekwencyjnie lub rownolegle. Glowna przewaga to natywna integracja z modelami Anthropic (w tym 1M context window, fast mode z effort levels) oraz dojrzaly system uprawnien enterprise (managed settings hierarchy). Glowna slabosci to vendor lock-in (tylko modele Claude) oraz brak transparentnosci core'a (proprietary).

---

## 2. Matryca Porownawcza

### A. Tozsamosc i Pozycjonowanie

| Pytanie | Claude Code | DiriCode |
|---------|-------------|----------|
| Nazwa, licencja, jezyk implementacji | Claude Code, proprietary (Anthropic Commercial ToS), TypeScript | DiriCode, open-source (planowane), TypeScript |
| Glowny target user | Solo dev do enterprise — pelne spektrum | Solo developer |
| Interfejs | CLI + VS Code extension + Remote Control API + Voice mode | CLI (TUI Ink/React) |
| GitHub stats | ~6,500 otwartych issues; zamkniety model rozwoju (Anthropic employees) | Nowy projekt, 0 issues |
| Model biznesowy | Komercja (wymaga Anthropic API key lub subskrypcji Claude) | Open-source, BYOK (Bring Your Own Key) |
| Pozycjonowanie | "An agentic coding tool that lives in your terminal" (README.md) | Lokalny CLI agent AI z architektura dispatcher-first |

**Wniosek:** Claude Code celuje szerzej (solo-enterprise), DiriCode swiadomie zaweza do solo dev. Claude Code jest zamkniety — DiriCode jako open-source z multi-provider ma jasna luke rynkowa.

### B. Architektura Agenta

| Aspekt | Claude Code | DiriCode | Wniosek |
|--------|-------------|----------|---------|
| Ile agentow / rol? | 13 pluginow, kazdy moze definiowac wiele agentow. Przyklad: feature-dev ma 3 (code-explorer, code-architect, code-reviewer), pr-review-toolkit ma 6 agentow-recenzentow | Dispatcher + 10 specjalistow | Claude Code ma wieksza roznorodnosc agentow dzieki pluginom, ale brak centralnego koordynatora |
| Czy agent glowny ma dostep do narzedzi modyfikujacych? | Brak wyraznie wydzielonego "agenta glownego" — core Claude ma pelny dostep do wszystkich narzedzi | NIE (read-only dispatcher) | DiriCode bezpieczniejszy by design — dispatcher nie moze przypadkowo zmodyfikowac kodu |
| Jak wyglada delegacja? | Plaska — komendy (.md) bezposrednio spawnuja agentow sekwencyjnie lub rownolegle. Agent Teams/Teammates z tmux sessions. Brak nested delegation | Unlimited nesting + loop detector | DiriCode elastyczniejszy (nesting), Claude Code prostszy (flat). Oba podejscia maja zalety |
| Czy jest loop detection / fail-safe? | Nie znaleziono w warstwie pluginow. ralph-wiggum plugin celowo tworzy loop (Stop hook interceptuje exit). Kontrola prawdopodobnie w proprietary core | Tak (ADR-003: hard limit, token budget, loop detector) | DiriCode ma explicite fail-safes, Claude Code ukrywa je w zamknietym core |
| Jak zarzadzaja kontekstem agenta? | Per-agent model assignment (haiku=tani scouting, sonnet=praca, opus=trudne problemy). Confidence scoring (0-100, prog >=80) w code-review pipeline | Dispatcher = minimalny kontekst, per-agent model assignment | Podejscie Claude Code z confidence scoring warte zaadaptowania |
| Restrykcje narzedzi per agent | Pattern-based: `Bash(git add:*), Bash(gh pr create:*)` — bardzo granularne (plik: `plugins/feature-dev/agents/code-reviewer.md`) | Lista dozwolonych narzedzi per agent | Pattern-based restriction Claude Code jest bardziej granularne i warte rozwaenia |

**Wniosek:** Claude Code stosuje model plaski (flat), DiriCode hierarchiczny (dispatcher). Kluczowa roznica: pattern-based tool restriction w Claude Code jest bardziej granularne niz prosta whitelist — warto zaadaptowac.

### C. Zrozumienie Kodu (Code Intelligence)

| Aspekt | Claude Code | DiriCode | Wniosek |
|--------|-------------|----------|---------|
| Jak "widzi" codebase? | Glob + Grep + Read + LS + WebSearch + ToolSearch. Brak widocznego repo map / AST indexing w warstwie pluginow | glob + grep + AST-grep + LSP | DiriCode ma AST-grep i LSP — przewaga nad Claude Code (o ile brak repo map w core) |
| Czy parsuje strukture kodu? | Brak dowodow na parsowanie AST w pluginach. Polega na Grep/Read | AST-grep tak, ale brak "repo map" | DiriCode lepszy dzieki AST-grep |
| Jak wybiera pliki do kontekstu? | Nieznane z warstwy pluginow. ToolSearch sugeruje dynamiczne odkrywanie narzedzi | Agent dispatcher decyduje | Oba podejscia opieraja sie na heurystykach agenta |
| Czy ma LSP integration? | Tak — LSP operations w liscie narzedzi (CHANGELOG) | Tak, top-10 jezykow lazy install | Porownywalne |
| Jak radzi sobie z duzymi repozytoriami? | 1M context window pomaga. Brak widocznego mechanizmu indeksowania | Nieznane — potencjalna luka | Obie platformy polegaja na duzym context window zamiast indeksowania |

**Wniosek:** DiriCode ma lekka przewage dzieki AST-grep. Oba projekty polegaja na "brute force" (duzy context window + grep) zamiast sofistykowanego repo map jak Aider.

### D. Routing i Obsluga Modeli

| Aspekt | Claude Code | DiriCode | Wniosek |
|--------|-------------|----------|---------|
| Ile providerow / modeli? | TYLKO Anthropic: haiku, sonnet, opus. Zero multi-provider | 22 providerow via Vercel AI SDK | DiriCode ma ogromna przewage — brak vendor lock-in |
| Czy ma failover? | Nie dotyczy (jeden provider) | Tak (ADR-011: order-based failover) | DiriCode lepszy |
| Czy ma race mode? | Nie dotyczy | Tak (ADR-011) | DiriCode lepszy |
| Per-agent model assignment? | Tak — `model: haiku` / `model: sonnet` w YAML frontmatter agenta (plik: `plugins/feature-dev/agents/code-explorer.md`) | Tak (dispatcher=fast, writer=deep) | Porownywalne podejscie |
| Fast mode / effort levels? | Tak — Opus 4.6 z effort levels: low/medium/high (CHANGELOG v2.1.60+) | Tak (ADR-006: `--lean`) | Claude Code bardziej granularny — 3 poziomy vs 2 |
| Zewnetrzny router? | Nie — bezposrednie API Anthropic | Nie — wlasny TS Router (ADR-011) | DiriCode bardziej ambitny — wlasny router vs bezposrednie API call |

**Wniosek:** To jest KLUCZOWY differentiator DiriCode. Claude Code = vendor lock-in. DiriCode z 22 providerami i failover/race mode jest fundamentalnie bardziej elastyczny. Warto rozwazyc granularne effort levels (low/med/high) zamiast binarnego lean mode.

### E. System Hookow i Rozszerzalnosc

| Aspekt | Claude Code | DiriCode | Wniosek |
|--------|-------------|----------|---------|
| System hookow/pluginow? | Tak — 13 pluginow w marketplace. 12 typow hookow: PreToolUse, PostToolUse, SessionStart, Stop, UserPromptSubmit, InstructionsLoaded, ConfigChange, WorktreeCreate, WorktreeRemove, TeammateIdle, TaskCompleted, SubagentStop | 12 lifecycle hooks, lazy loading | Porownywalna liczba hook types |
| Implementacja hookow | ZEWNETRZNE PROCESY — Python/bash skrypty lub HTTP endpoints. Otrzymuja JSON na stdin, zwracaja JSON na stdout (plik: `plugins/security-guidance/hooks/security_reminder_hook.py`) | In-process TS hooks (planowane) | KLUCZOWA ROZNICA. Zewnetrzne procesy = izolacja + jezykowo-agnostyczne. In-process = szybsze ale mniej izolowane |
| Ile extension points? | Plugin moze zawierac: `/commands/` (.md), `/agents/` (.md), `/skills/`, `/hooks/`, `.mcp.json` — 5 typow artefaktow per plugin | 12 hookow + MCP client + pliki .md agentow | Claude Code ma bogatszy model pluginu (5 typow artefaktow vs 3) |
| Customowi agenci? | Tak — pliki .md z YAML frontmatter w katalogu agentow pluginu | Tak — `.diricode/agents/` | Identyczne podejscie (Markdown + YAML) — potwierdza ADR-012 |
| MCP support? | Tak — `.mcp.json` per plugin | Tak, GitHub MCP wbudowany + zewnetrzne | Porownywalne |
| Konfiguracja | JSON (pliki w `examples/settings/`: `lax.json`, `strict.json`, `bash-sandbox.json`) — brak type safety | `diricode.config.ts` (type-safe) | DiriCode lepszy — type-safe config eliminuje klase bledow |
| Meta-plugin (hookify) | Tak — pozwala tworzyc hooki z plikow markdown regul (plik: `plugins/hookify/hooks/`) | Brak odpowiednika | Interesujacy pattern — lowering the bar for hook creation |

**Wniosek:** Model zewnetrznych procesow hookowych Claude Code daje izolacje i agnostycznosc jezykowa kosztem performance. DiriCode powinien rozwazyc hybrydowy model: in-process TS hooks (szybkie, core) + mozliwosc uruchomienia zewnetrznego procesu (pluginy community). Plugin z 5 typami artefaktow jest bogatszy niz planowany model DiriCode.

### F. Bezpieczenstwo i Approval

| Aspekt | Claude Code | DiriCode | Wniosek |
|--------|-------------|----------|---------|
| Approval przed destrukcja? | Tak — granularne per-tool allow/ask/deny. `acceptEdits` mode, `plan` mode (CHANGELOG) | Tak (ADR-004: Smart — AI ocenia ryzyko) | Claude Code: reguly statyczne. DiriCode: AI-driven risk assessment. Oba maja zalety |
| 3 kategorie ryzyka? | Nie wprost — system allow/ask/deny per tool (konfiguracja JSON) | Tak — safe/risky/destructive, konfigurowalne | DiriCode ma czytelniejszy model mentalny (3 kategorie) |
| Ochrona przed wyciekiem sekretow? | Nie znaleziono explicite w warstwie pluginow. security-guidance plugin skanuje 9 wzorcow bezpieczenstwa (command injection, XSS, eval, pickle, os.system, SQL injection, path traversal, insecure deserialization) ale NIE secrets (plik: `plugins/security-guidance/hooks/security_reminder_hook.py`) | Tak (ADR-014: auto-redakcja regex+heurystyki) | DiriCode lepszy — explicite chroni sekrety |
| Sandboxing? | Tak — macOS sandbox dla bash z izolacja sieciowa i domain allowlists (plik: `examples/settings/bash-sandbox.json`) | NIE w MVP (odlozony do v2) | Claude Code ma przewage. DiriCode swiadomie odklada — ryzyko akceptowalne dla solo dev |
| Git safety rails? | Nie znaleziono explicite w pluginach — moze istniec w core | Tak (ADR-010: blokada `git add .`, `push --force`) | DiriCode lepszy — explicite safety rails |
| Parsowanie bash? | bash_command_validator_example.py — walidacja przez Python regex (plik: `examples/hooks/bash_command_validator_example.py`) | Tree-sitter (ADR-015) | DiriCode lepszy — AST-based parsing vs regex |
| Enterprise permissions? | Rozbudowana hierarchia: organization > team > user (managed settings). Pliki: `examples/settings/strict.json` | Brak — target solo dev | Nie dotyczy DiriCode MVP |

**Wniosek:** DiriCode ma lepsze podejscie do bezpieczenstwa w kilku wymiarach (Tree-sitter bash parsing, explicite secret redaction, git safety rails). Claude Code ma sandbox i enterprise permissions, czego DiriCode nie ma (i nie potrzebuje w MVP).

### G. Pamiec i Stan

| Aspekt | Claude Code | DiriCode | Wniosek |
|--------|-------------|----------|---------|
| Trwala pamiec miedzy sesjami? | Auto-memory: Claude automatycznie zapisuje uzyteczny kontekst do `/memory`. CLAUDE.md jako project-level context (CHANGELOG) | GitHub Issues jako project memory (ADR-007) | Rozne podejscia. Auto-memory = automatyczne, lokalne. GitHub Issues = explicite, rozproszone, git-friendly |
| Przechowywanie stanu zadan? | TodoWrite tool (wewnatrz sesji). ralph-wiggum: YAML frontmatter w `.claude/ralph-loop.local.md` (plik: `plugins/ralph-wiggum/hooks/`) | Pliki Markdown `.diricode/todo.md` (ADR-013) | Oba uzywaja Markdown. Claude Code bardziej ad-hoc (per-plugin), DiriCode bardziej ustrukturyzowany |
| Snapshot / undo? | Git worktree isolation: `isolation: worktree` w definicjach agentow. `--worktree` flag (CHANGELOG) | Brak snapshota — git worktrees (ADR-008) | IDENTYCZNE PODEJSCIE — potwierdza decyzje ADR-008 |
| Context compaction? | Automatyczny, zachowuje obrazy, sliding window z podsumowaniem (CHANGELOG) | Sliding window + summary na 90-95% (ADR-009) | Porownywalne podejscia. Claude Code zachowuje obrazy — DiriCode powinien tez |
| 1M context window? | Tak (CHANGELOG) | Zalezy od providera (Gemini 1M+, Claude 200K, GPT-4 128K) | DiriCode z multi-provider moze wybrac najlepszy model per kontekst |

**Wniosek:** Claude Code potwierdza decyzje DiriCode (ADR-008: git worktrees, ADR-013: stan w Markdown). Auto-memory to interesujacy pattern — warto rozwazyc automatyczne zapisywanie kontekstu miedzy sesjami obok GitHub Issues.

### H. UX i Developer Experience

| Aspekt | Claude Code | DiriCode | Wniosek |
|--------|-------------|----------|---------|
| Time-to-first-use | `npm install -g @anthropic-ai/claude-code` + API key — 2 kroki | Do zbadania — planowane `npx diricode` | Porownywalne |
| Vim motions? | Nie znaleziono | Od dnia 1 (TUI Ink) | DiriCode lepszy dla vim users |
| Streaming? | Tak (CLI streaming) | SSE (ADR-001) | Porownywalne |
| Lean mode? | Fast mode z 3 effort levels: low/medium/high (CHANGELOG) | `--lean` (binary: on/off) (ADR-006) | Claude Code bardziej granularny — 3 poziomy vs 2 |
| Jakosc dokumentacji? | README + oficjalna docs na code.claude.com. Plugin .md files sa dobrze udokumentowane | Do stworzenia | Claude Code ma mature docs |
| Slash commands? | Pliki .md — bardzo latwe tworzenie custom commands (przyklad: `plugins/feature-dev/commands/`) | Planowane | Wart zaadaptowania — .md files as commands |
| Dodatkowe interfejsy | VS Code extension, Voice mode, Remote Control API | Tylko CLI (MVP) | Claude Code szerszy, ale DiriCode celowo zaweza scope w MVP |
| Community engagement | ~6,500 open issues, uzytkownicy skarza sie na brak response od Anthropic (Issue #18642) | Nowy projekt | Lekcja: szybki response na issues jest kluczowy |

**Wniosek:** Claude Code ma dojrzalszy UX z wieloma interfejsami (VS Code, voice, remote). DiriCode celowo zaweza do CLI — to OK dla MVP. Granularne effort levels (3 poziomy) warte zaadaptowania.

---

## 3. Co DiriCode Powinien Zaadaptowac

| # | Co | Dlaczego | Wplyw na ADR |
|---|-----|---------|-------------|
| 1 | **Pattern-based tool restriction per agent** — format `Bash(git add:*), Bash(gh pr create:*)` zamiast prostej whitelisty narzedzi | Pozwala na bardzo precyzyjna kontrole — agent moze uzywac Bash, ale TYLKO do konkretnych komend. Zmniejsza surface area bledow. Znalezione w: `plugins/feature-dev/agents/code-reviewer.md` | **ADR-003** (delegacja) + **ADR-012** (definicja agentow) — rozszerzyc format .md agenta o pattern-based tool restrictions |
| 2 | **Confidence scoring w pipeline'ach multi-agentowych** — skala 0-100, prog akceptacji >=80 | Code-review command w Claude Code uzywa 4 rownoleglych agentow, kazdy zwraca confidence score. Wyniki ponizej progu sa odrzucane automatycznie. Daje measurable quality gate. Znalezione w: `plugins/code-review/commands/code-review.md` | **ADR-003** (delegacja) — dodac mechanizm confidence scoring do wynikow agentow specjalistycznych |
| 3 | **Hybrydowy model hookow: in-process TS + opcjonalne zewnetrzne procesy** | Claude Code implementuje WSZYSTKIE hooki jako zewnetrzne procesy (Python/bash na stdin/stdout). To daje izolacje i agnostycznosc jezykowa — community moze pisac hooki w dowolnym jezyku. Znalezione w: `plugins/hookify/hooks/hooks.json`, `plugins/security-guidance/hooks/security_reminder_hook.py` | **ADR nowy** lub rozszerzenie systemu hookow — dodac mozliwosc definiowania hookow jako zewnetrznych procesow (stdin JSON -> stdout JSON) obok natywnych TS hookow |
| 4 | **Granularne effort levels (3 poziomy zamiast binarnego lean)** — low/medium/high | Claude Code Fast mode pozwala na 3 poziomy wysilku. Daje uzytkownikowi wiecej kontroli niz binary lean/full. Low = szybkie pytania, medium = standardowa praca, high = trudne problemy | **ADR-006** (lean mode) — rozszerzyc z binary on/off na 3 poziomy: `--effort low|medium|high` |
| 5 | **Plugin jako 5-typowy artefakt** (commands + agents + skills + hooks + mcp) | Model pluginu Claude Code jest bogatszy niz planowany DiriCode — jeden plugin moze zawierac slash commands, agentow, skills (knowledge injection), hooki i konfiguracje MCP. Tworzy spojny ekosystem. Znalezione w: `claude-code/.claude-plugin/marketplace.json` | **ADR-012** (hybrid agent definition) — rozszerzyc koncept "pluginu" z samego agenta .md na pelny pakiet |

---

## 4. Czego DiriCode Powinien Unikac

| # | Co | Dlaczego to problem | Jak DiriCode to rozwiazuje |
|---|-----|--------------------|-----------------------------|
| 1 | **Vendor lock-in na jednego dostawce modeli** | Claude Code dziala WYLACZNIE z modelami Anthropic (haiku, sonnet, opus). Uzytkownik nie moze uzyc GPT-4, Gemini, Llama, Mistral ani zadnego innego modelu. Jesli Anthropic podniesie ceny lub zmieni API — zero alternatyw | ADR-011: Wlasny TS Router z 22 providerami, failover order-based, race mode |
| 2 | **Zlozona hierarchia uprawnien enterprise** (organization > team > user managed settings) | Claude Code buduje rozbudowany system uprawnien z managed settings, co dodaje ogromna zlozonosc. DiriCode celuje w solo dev — ta zlozonosc bylaby over-engineering | ADR-004: Smart Approval z 3 prostymi kategoriami (safe/risky/destructive) |
| 3 | **Brak explicite secret redaction** | W warstwie pluginow Claude Code nie znaleziono mechanizmu automatycznej redakcji sekretow. security-guidance plugin skanuje code security patterns (XSS, SQL injection) ale NIE sekrety (API keys, passwords, tokens) | ADR-014: Auto-redakcja regex + heurystyki |
| 4 | **Regex-based bash parsing zamiast AST** | Przykladowy hook `bash_command_validator_example.py` waliduje komendy bash przez Python regex. Regex jest podatny na bypass | ADR-015: Tree-sitter do parsowania bash — AST-based approach jest fundamentalnie bezpieczniejszy |
| 5 | **Ignorowanie community issues** | ~6,500 otwartych issues, Issue #18642 explicite prosi o ludzkie odpowiedzi. Niszczy zaufanie community | DiriCode jako open-source musi od poczatku priorytetyzowac response na issues |

---

## 5. Otwarte Pytania

1. **Czy Claude Code ma repo map / AST indexing w proprietary core?** — W warstwie pluginow nie znaleziono, ale core jest zamkniety. Jesli tak, DiriCode z samym glob+grep+AST-grep moze miec luke w code intelligence dla duzych repo (50K+ plikow). Trzeba przetestowac empirycznie.

2. **Czy zewnetrzne procesy hookow sa wystarczajaco szybkie?** — Claude Code uruchamia Python/bash per hook invocation. Overhead fork+exec per hook call moze byc znaczacy przy czestych hookach (np. PreToolUse na kazdym uzyciu narzedzia). Czy DiriCode powinien implementowac cache/pool dla zewnetrznych hookow?

3. **Jak Claude Code radzi sobie z loop detection w core?** — Plugin ralph-wiggum celowo tworzy loop (Stop hook). Czy core ma hard limits? DiriCode ma explicite ADR-003, ale wartosc konkretnych limitow (max iterations, token budget) wymaga tuningu.

4. **Czy auto-memory (automatyczne zapisywanie kontekstu) jest lepsze niz explicite GitHub Issues?** — Claude Code automatycznie zapisuje, DiriCode wymaga explicite zapisu do GitHub Issues. Mozliwe ze hybrydowe podejscie (auto-save lokalnie + explicite export do Issues) byloby najlepsze.

5. **Jak Claude Code obsluguje konflikty przy rownoleglych agentach na tych samych plikach?** — Agent Teams z tmux sessions moga powodowac race conditions na plikach. Git worktree isolation rozwiazuje to czesciowo, ale merge conflicts pozostaja.

6. **Czy Issue #13797 (agent tworzy issues w publicznym repo zamiast prywatnym usera) zostal naprawiony?** — To powazna luka bezpieczenstwa. DiriCode z ADR-007 (GitHub Issues jako pamiec) musi miec explicite walidacje ze zapisuje do WLASCIWEGO repo.

---

## 6. Rekomendacje dla Specyfikacji DiriCode

### 6.1 Zmiany w istniejacych ADR-ach

| ADR | Obecna decyzja | Proponowana zmiana | Uzasadnienie |
|-----|---------------|-------------------|-------------|
| **ADR-003** | Unlimited nesting + loop detector | Dodac: **confidence scoring** (0-100) dla wynikow agentow. Dispatcher odrzuca wyniki ponizej konfigurowalnego progu (default: 80) | Claude Code uzywa tego w code-review pipeline — daje measurable quality gate zamiast binary pass/fail |
| **ADR-006** | Binary lean mode (`--lean` on/off) | Rozszerzyc na **3 effort levels**: `--effort low|medium|high`. Low = minimalny kontekst, szybkie odpowiedzi. Medium = standard. High = pelna analiza, wiecej agentow | Claude Code Fast mode ma 3 poziomy — daje uzytkownikowi wiecej kontroli |
| **ADR-012** | Hybrid (TS code + MD prompts) | Dodac: **pattern-based tool restriction** w YAML frontmatter agenta: `tools: ["Read", "Grep", "Bash(git log:*)", "Bash(git diff:*)"]` zamiast prostej listy nazw | Claude Code format `Bash(git add:*)` jest bardzo granularny — zapobiega naduzywaniu narzedzi |

### 6.2 Nowe elementy do specyfikacji

| Propozycja | Opis | Priorytet |
|-----------|------|----------|
| **Hybrydowy model hookow** | In-process TS hooks (core, szybkie) + mozliwosc definiowania hookow jako zewnetrznych procesow (stdin JSON -> stdout JSON). Pozwala community pisac hooki w dowolnym jezyku | Medium — po MVP, przed v2 |
| **Model pluginu (5 artefaktow)** | Plugin = pakiet zawierajacy: commands/ + agents/ + skills/ + hooks/ + mcp.json. Jeden `plugin.json` manifest. Kazdy artefakt opcjonalny | Medium — rozszerzenie ADR-012 |
| **Auto-memory lokalne** | Automatyczne zapisywanie kluczowego kontekstu miedzy sesjami do `.diricode/memory/` (obok explicite GitHub Issues z ADR-007). Agent decyduje co jest warte zapamietania | Low — quality-of-life improvement |
| **Walidacja target repo w ADR-007** | Przed zapisem do GitHub Issues explicite weryfikowac ze repo docelowe jest WLASCIWE (nie publiczne repo frameworka/narzedzia). Lekcja z Issue #13797 Claude Code | High — security critical |

### 6.3 Potwierdzone decyzje

Analiza Claude Code **potwierdza** poprawnosc nastepujacych decyzji DiriCode:

| ADR | Decyzja | Potwierdzenie z Claude Code |
|-----|---------|----------------------------|
| **ADR-008** | Git worktrees zamiast snapshot | Claude Code uzywa `isolation: worktree` — identyczne podejscie |
| **ADR-011** | Wlasny TS Router (multi-provider) | Claude Code locked na Anthropic = vendor lock-in. DiriCode z 22 providerami ma kluczowa przewage |
| **ADR-012** | Agenci jako pliki .md z YAML | Claude Code uzywa identycznego formatu — walidacja podejscia |
| **ADR-013** | Stan w Markdown | Claude Code tez uzywa Markdown + YAML frontmatter do stanu (ralph-wiggum plugin) |
| **ADR-014** | Auto-redakcja sekretow | Claude Code NIE MA tego explicite w pluginach — DiriCode jest tu lepszy |
| **ADR-015** | Tree-sitter do bash | Claude Code uzywa regex — DiriCode bezpieczniejszy |

---

*Dokument wygenerowany na podstawie analizy repozytorium `anthropics/claude-code` — wylacznie fakty z kodu, dokumentacji i publicznych issues. Brak spekulacji.*
