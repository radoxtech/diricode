# CodeWroc — Lista życzeń (Non-Negotiable)

> Wymagania architektoniczne i funkcjonalne dla nowego projektu.
> Źródło: analiza OpenCode + Oh-My-OpenCode + ich issues na GitHub.
> Data: 21 lutego 2026

---

## 1. ARCHITEKTURA AGENTÓW

### 1.1 Agent główny — Dyspozytor, nie pracownik

- [ ] Agent główny **NIE MA hooków**
- [ ] Agent główny **NIE pisze kodu, NIE edytuje plików, NIE uruchamia bash**
- [ ] Agent główny **MA dostęp read-only**: czytanie plików, grep, glob, LSP — żeby wiedzieć CO delegować
- [ ] Agent główny **TYLKO deleguje** zadania agentom wyspecjalizowanym
- [ ] Kontekst agenta głównego jest **mały z definicji** — nie ma hooków, nie ma output narzędzi write/bash
- [ ] Agent główny **widzi wyniki** delegowanych zadań (success/fail + summary), ale **NIE widzi ich pełnego kontekstu roboczego**

### 1.2 Agenci wyspecjalizowani — Pracownicy z hookami

- [ ] Nazwy agentów są **opisowe** — po nazwie natychmiast wiadomo do czego agent służy (lekcja z OMO: Sisyphus, Prometheus, Hephaestus, Momus — bez dokumentacji nie wiadomo co robią)
  - ✅ `planner`, `code-reviewer`, `frontend-builder`, `git-manager`, `docs-searcher`
  - ❌ `Sisyphus`, `Prometheus`, `Hephaestus`, `Momus`, `Atlas`, `Metis`
- [ ] Każdy agent wyspecjalizowany **MA hooki** — ale tylko te, które dotyczą jego domeny
- [ ] Hooki są **dwojakie**:
  - **Bazowe per agent** — stały zestaw hooków przypisany do kategorii agenta (np. frontend-agent zawsze ma hooki walidacji CSS/HTML)
  - **Dynamiczne per task** — dodatkowe hooki aktywowane w zależności od konkretnego zadania (np. hook "sprawdź czy nie zmieniono API kontraktu" tylko gdy task dotyczy API)
- [ ] Agent wyspecjalizowany **nie ładuje hooków, których nie potrzebuje** — zero overhead
- [ ] Hooki agenta **żyją tylko w jego kontekście** — nie zaśmiecają kontekstu głównego

### 1.3 Delegacja N-poziomowa

- [ ] Agenci wyspecjalizowani **mogą sami delegować dalej** (sub-agenci)
- [ ] Dowolna głębokość delegacji — jeśli agent frontendowy potrzebuje wyspecjalizowanego agenta do animacji, może go powołać
- [ ] Każdy poziom delegacji **tworzy izolowany kontekst** — sub-agent nie widzi kontekstu rodzica (chyba że jawnie przekazany)
- [ ] Agent delegujący **czeka na wynik** sub-agenta i kontynuuje swoją pracę

### 1.4 Kontekst — izolacja i oszczędność

- [ ] **Każdy agent ma IZOLOWANY kontekst** — nie dzieli pamięci roboczej z innymi
- [ ] **Polityka zwrotu kontekstu jest KONFIGUROWALNA per agent/task:**
  - Opcja A: „wynik wraca, kontekst znika" — dla prostych tasków
  - Opcja B: „wynik + kluczowe decyzje wracają, reszta znika" — dla średnich
  - Opcja C: „kompresja → summary wraca do rodzica" — dla złożonych
  - Opcja D: „pełny kontekst wraca" — wyjątkowe przypadki (np. debug)
- [ ] Domyślna polityka: **wynik + metadata** (co zrobiono, jakie pliki zmieniono, status)
- [ ] **Żaden agent nie ma dostępu do kontekstu innego agenta** — chyba że jawnie przekazany przez rodzica
- [ ] Kontekst agenta **jest kasowany po zakończeniu zadania** (nie accumulates w tle)

---

## 2. HOOKI — Modularny system

### 2.1 Zasady ogólne

- [ ] Hooki to **moduły ładowane dynamicznie** — nie monolityczny prompt
- [ ] Hook ma **deklarowany koszt tokenowy** — agent główny widzi ile tokenu kosztuje każdy hook
- [ ] Hook ma **deklarowany typ**: pre-action, post-action, validation, transformation, injection
- [ ] Hooki **NIE kaskadują w górę** — hook agenta potomnego nie wpływa na rodzica

### 2.2 Katalog hooków

- [ ] Hooki są **zdefiniowane centralnie** (katalog/rejestr)
- [ ] Każdy hook ma: **ID, opis, koszt tokenowy, kompatybilne kategorie agentów, warunki aktywacji**
- [ ] Agenci **nie definiują swoich hooków** — wybierają z katalogu
- [ ] Można tworzyć **custom hooki** i dodawać do katalogu

### 2.3 Ładowanie hooków

- [ ] Hooki bazowe per agent: ładowane **automatycznie** przy spawn agenta
- [ ] Hooki dynamiczne per task: ładowane **na żądanie** gdy warunki aktywacji są spełnione
- [ ] **Lazy loading** — hook jest ładowany (i zużywa tokeny) dopiero gdy jest potrzebny, nie na zapas
- [ ] Agent główny **nie ładuje ŻADNYCH hooków** — zero overhead

---

## 3. BEZPIECZEŃSTWO I KONTROLA

### 3.1 Approval workflow — OBOWIĄZKOWY

- [ ] **Żaden plan NIE jest wykonywany bez akceptacji użytkownika** — nigdy, zero wyjątków
- [ ] Sekwencja: plan → prezentacja → approve/reject/modify → execute
- [ ] Użytkownik **ZAWSZE jest ostatecznym arbitrem** (lekcja z OMO #1081)
- [ ] Tryb "auto-approve" dostępny jako **opt-in**, nie domyślny
- [ ] Każda destrukcyjna operacja (git push --force, rm -rf, drop table) wymaga **dodatkowego potwierdzenia** nawet w trybie auto-approve

### 3.2 Sandboxing

- [ ] Opcja uruchamiania agentów w **izolowanym środowisku** (Docker / VM / namespace)
- [ ] Agenci NIE mają domyślnego dostępu do:
  - Credentials (.env, .ssh, .aws, .kube)
  - Plików poza workspace
  - Sieci (chyba że jawnie dozwolone)
- [ ] **Granularne permissions per agent** — agent frontendowy nie musi mieć dostępu do bazy danych

### 3.3 Git safety

- [ ] **Nigdy** `git add .` na całym repo (lekcja z OC #3176)
- [ ] Snapshoty **respektują .gitignore**
- [ ] Snapshoty mają **limit rozmiaru** (konfigurowalne)
- [ ] Snapshoty są **opt-in** na dużych repo (>1GB)
- [ ] Destrukcyjne git operacje (force push, hard reset, rebase) wymagają **jawnego potwierdzenia**
- [ ] Agent git **NIE jest automatycznie aktywowany** — użytkownik go włącza świadomie

### 3.4 Privacy

- [ ] **Zero telemetrii domyślnej** — opt-in only
- [ ] Żadne dane nie opuszczają maszyny bez jawnej zgody
- [ ] Credentiale nigdy nie trafiają do kontekstu AI (automatyczny redaction)

---

## 4. MODEL I PROVIDER

### 4.1 Prawdziwy multi-provider

- [ ] Narzędzia (Write/Edit/Bash) muszą **działać z KAŻDYM modelem** — nie tylko Claude (lekcja z OC #1357)
- [ ] Jeśli model nie potrafi wygenerować payload narzędzia → **adapter/retry/fallback**, nie "model-problem"
- [ ] Testy kompatybilności narzędzi **per provider** — automatyczne, w CI
- [ ] **Per-agent model assignment** — agent główny może używać taniego modelu (dyspozycja), agent deep może używać Opus (ciężka praca)

### 4.2 Token economy

- [ ] **Token budget per task** — limit wydatków tokenowych per delegowane zadanie
- [ ] **Real-time token counter** widoczny dla użytkownika
- [ ] **Lean mode** wbudowany (nie jako fork jak omo-slim) — redukcja hooków, promptów, verbosity
- [ ] Copilot integration **NIE tworzy syntetycznych user messages** (lekcja z OC #8030)
- [ ] **Cost estimation** przed wykonaniem planu — "ten plan zużyje ~$X"

### 4.3 Provider management

- [ ] Natywny OpenRouter support
- [ ] Natywny Ollama support (modele lokalne)
- [ ] **Fallback chain**: jeśli provider A nie odpowiada → automatycznie provider B
- [ ] **Rate limit awareness** — nie bombarduje API, respektuje limity
- [ ] HTTP_PROXY support (użytkownicy korporacyjni, lekcja z OC #531)

---

## 5. PAMIĘĆ I KONTEKST

### 5.1 Memory system

- [ ] **Trwała pamięć między sesjami** — agent pamiętają kontekst projektu
- [ ] Pamięć jest **per-projekt** (nie globalna)
- [ ] Pamięć jest **strukturalna**: decyzje architektoniczne, konwencje kodu, preferencje użytkownika, znane problemy
- [ ] Pamięć jest **edytowalna przez użytkownika** — można usunąć, zmodyfikować, dodać
- [ ] **Automatyczne uczenie się** — agent wyciąga wnioski z sesji i proponuje dodanie do pamięci (użytkownik potwierdza)
- [ ] Pamięć **NIE jest wstrzykiwana do kontekstu w całości** — tylko relevantne fragmenty per task

### 5.2 Context management

- [ ] Użytkownik **kontroluje co jest w kontekście** — /add, /remove, /context
- [ ] **Workspace directories** — możliwość dodania katalogów spoza working directory (lekcja z OC #1543)
- [ ] **Semantic search** (RAG/vector) jako opcja — nie tylko grep/glob
- [ ] **Preemptive compaction** — inteligentna kompresja ZANIM kontekst się przepełni (nie po)

---

## 6. STABILNOŚĆ I NIEZAWODNOŚĆ

### 6.1 TUI stability

- [ ] Długa historia **nie powoduje hang** (lekcja z OC #3746)
- [ ] Brak luk w historii czatu (lekcja z OC #4032)
- [ ] Nigdy **stuck na "generating"** — timeout + informacja o błędzie (lekcja z OC #2512)
- [ ] Działa w CI context — headless mode bez hang (lekcja z OC #4506)

### 6.2 Loop safety

- [ ] Continuation loop ma **hard limit** — max N iteracji (konfigurowalne, lekcja z OMO #668)
- [ ] Jeśli loop wykryje powtarzający się error → **zatrzymuje się i informuje**, nie próbuje w nieskończoność
- [ ] Historia sesji **NIGDY nie znika** — lekcja z OMO #668
- [ ] Session persistence — możliwość kontynuacji po crash/disconnect

### 6.3 Instalacja

- [ ] Instalacja działa **out of the box** na: macOS, Linux, Windows
- [ ] **Jeden command** — `npx codewroc` / `bunx codewroc` / `brew install codewroc`
- [ ] Zero bun segfaults (lekcja z OMO #1072)
- [ ] Zero platform binary issues (lekcja z OMO #1161)
- [ ] Jasny error message jeśli brakuje dependency

---

## 7. UX I INTERFACE

### 7.1 Input

- [ ] **Vim motions** w input box — od dnia 1 (lekcja z OC #1764)
- [ ] **Speech-to-text** — wbudowany, nie jako PR czekający 6 miesięcy (lekcja z OC #4695)
- [ ] **Paste text** — widoczny, edytowalny, nie `[Pasted ~1 lines]` (lekcja z OC #8501)
- [ ] **Multiline input** natywnie

### 7.2 Output

- [ ] Markdown rendering z syntax highlighting
- [ ] **Streaming** — odpowiedź pojawia się na bieżąco
- [ ] **Progress indicators** per delegowane zadanie — użytkownik widzi co każdy agent robi
- [ ] **Collapse/expand** długie output

### 7.3 Platformy

- [ ] **Windows support od dnia 1** — nie jako afterthought (lekcja z OC #631)
- [ ] **TUI (terminal)** — primary interface
- [ ] **Web UI (przeglądarka)** — secondary interface, ten sam backend co TUI
- [ ] ~~Desktop app~~ — **NIE ROBIMY** (ani macOS, ani Windows, ani Linux). Web UI pokrywa ten use case.
- [ ] VS Code extension — nice to have (niska priorytet)
- [ ] **JetBrains terminal** — musi działać (lekcja z OC #408)

---

## 8. NARZĘDZIA I INTEGRACJE

### 8.1 Wbudowane narzędzia (core)

- [ ] File operations: read, write, edit (z hash-anchored resilience jak OMO)
- [ ] Bash execution (z timeout, sandboxing opcja)
- [ ] Glob, grep (fast, parallel)
- [ ] LSP integration (go-to-def, find-refs, rename, diagnostics, symbols)
- [ ] AST-grep (search + replace z uwzględnieniem składni)
- [ ] **Web search — W CORE** (nie jako plugin, lekcja z OC #309)
- [ ] Web fetch (URL → markdown/text/html)
- [ ] Interactive bash (tmux — dla TUI apps)

### 8.2 MCP protocol

- [ ] MCP client — obsługa zewnętrznych MCP servers
- [ ] **Wbudowane MCP**: web search, dokumentacja bibliotek (Context7-like), code search (Grep.app-like)
- [ ] MCP są **ładowane per agent** — nie globalnie. Frontend agent dostaje Playwright MCP, backend agent nie.

### 8.3 Git

- [ ] Wbudowane git operations — ale **z safety rails** (patrz sekcja 3.3)
- [ ] Atomic commits
- [ ] Smart diff — agent widzi co zmienił
- [ ] Undo/rollback workflow zintegrowany

### 8.4 Browser automation

- [ ] Playwright wbudowany — testy UI, scraping, weryfikacja
- [ ] Screenshot capture jako evidence
- [ ] **Dostępny tylko dla agentów, którzy go potrzebują** (nie globalnie)

---

## 9. ORKIESTRACJA I WORKFLOW

### 9.1 Planowanie

- [ ] Plan mode z **interaktywnymi pytaniami** (jak Claude Code, lekcja z OC #3844)
- [ ] Plan → review → approve → execute pipeline
- [ ] Plany mają **estimated cost** i **estimated time**
- [ ] Plany są **persisted** — można wrócić i kontynuować

### 9.2 Execution

- [ ] **Parallel execution waves** — niezależne taski równolegle
- [ ] **Dependency tracking** — task B czeka na task A
- [ ] **Progress dashboard** — widać co jest done/in-progress/pending
- [ ] **Cancellation** — można zatrzymać w dowolnym momencie
- [ ] **Partial results** — jeśli 3/5 tasków done i cancel, to 3 wyniki zachowane

### 9.3 QA i weryfikacja

- [ ] **Automatyczne QA scenarios** per task
- [ ] Evidence capture (screenshoty, logs, test output)
- [ ] **Multi-stage review** — osobne agenty do review kodu, nie ten sam co pisał
- [ ] Reviewer **NIE ma dostępu do kontekstu implementacji** — patrzy fresh

---

## 10. GOVERNANCE I PROJEKT

### 10.1 Licencja

- [ ] **Standardowa licencja open-source** — MIT lub Apache 2.0 (nie SUL-1.0 jak OMO)
- [ ] Jasne warunki użycia komercyjnego

### 10.2 Community

- [ ] **PR-y społeczności są mergowane** w rozsądnym czasie — nie jak OC gdzie czekają miesiącami
- [ ] Contributing guide od dnia 1
- [ ] Issue templates z labeling
- [ ] **Bus factor > 1** — nie jednoosobowy projekt

### 10.3 Konfiguracja

- [ ] **Sane defaults** — działa out of the box bez konfiguracji
- [ ] Konfiguracja w jednym pliku (`codewroc.config.ts` / `.codewrocrc`)
- [ ] **GUI do konfiguracji** — nie tylko edycja JSON (nice to have)
- [ ] Per-project config (overrides global)

---

## PODSUMOWANIE — Kluczowe różnice vs. OMO

| Aspekt | OMO | CodeWroc |
|--------|-----|----------|
| Agent główny | Ma 44 hooki, ogromny kontekst | Zero hooków, read-only, tylko deleguje |
| Kontekst | Monolityczny, narasta | Izolowany per agent, czyszczony |
| Hooki | Wszystkie ładowane zawsze | Lazy, per agent, per task |
| Orkiestracja | "Human intervention = failure" | Human approval = OBOWIĄZKOWY |
| Delegacja | 2 poziomy (Sisyphus → Junior) | N poziomów (dowolna głębokość) |
| Safety | Git master "destructive" | Safety rails na wszystkim |
| Instalacja | Bun segfaults, binary issues | One command, works everywhere |
| Model compat. | Realnie Claude-only (via OC) | Adaptery per provider, CI testy |
| Pamięć | Brak (autor sceptyczny) | Per-project memory, user-editable |
| Licencja | SUL-1.0 (niestandardowa) | MIT / Apache 2.0 |
| Token cost | Fork "slim" musiał powstać | Lean mode wbudowany |
| Kontekst zwrotu | Pełny lub nic | Konfigurowalny per agent/task |
| Nazwy agentów | Mitologiczne (Sisyphus, Prometheus, Hephaestus) — nieczytelne | Opisowe — po nazwie wiadomo co robi |
