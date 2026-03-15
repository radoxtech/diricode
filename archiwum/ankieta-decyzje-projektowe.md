# ANKIETA DECYZYJNA — CodeWroc / DiriCode
## Co robimy, a czego NIE robimy?

> Wypełnij kolumnę **Decyzja** dla każdego punktu:
> - **TAK** — implementujemy
> - **NIE** — świadomie pomijamy
> - **PÓŹNIEJ** — odłożone na przyszłość (post-MVP)
> - **DO DYSKUSJI** — wymaga dalszej analizy
>
> Tam gdzie jest dodatkowe pytanie, dopisz krótką odpowiedź.

---

## A. ARCHITEKTURA AGENTÓW

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| A1 | **Agent główny = dyspozytor (ZERO hooków, read-only, tylko deleguje)** | Twoja wizja z zyczenia-codewroc.md. Przeciwieństwo OMO gdzie Sisyphus ma 44 hooki i ogromny kontekst. | | |
| A2 | **Agenci wyspecjalizowani z hookami per domena** | Każdy agent ma TYLKO swoje hooki (frontend-builder ma CSS/HTML hooks, nie ma git hooks). | | |
| A3 | **Opisowe nazwy agentów** (planner, code-reviewer, frontend-builder) zamiast mitologicznych (Sisyphus, Prometheus) | OMO #1995 — społeczność narzeka na nieczytelne nazwy. | | |
| A4 | **Delegacja N-poziomowa** (agent może delegować do sub-agenta, dowolna głębokość) | OMO ma max 2 poziomy (Sisyphus → Junior). Ty chcesz nieskończoną. | | |
| A5 | **Izolowany kontekst per agent** (nie dzieli pamięci z innymi) | Kluczowa różnica vs OMO — tam kontekst monolityczny. | | |
| A6 | **Konfigurowalna polityka zwrotu kontekstu** (wynik only / wynik+decyzje / summary / pełny) | 4 opcje z Twojej wizji. | | |
| A7 | **Kategorie agentów** (visual-engineering, deep, quick, ultrabrain, writing) | Wzięte z OMO — automatyczny dobór modelu do kategorii. | | |

---

## B. HOOKI — SYSTEM MODULARNY

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| B1 | **Hooki ładowane dynamicznie** (lazy loading, nie monolityczny prompt) | OMO ładuje 44 hooki × 5 warstw = ogromny token overhead. Fork omo-slim istnieje dlatego. | | |
| B2 | **Deklarowany koszt tokenowy per hook** | Agent główny widzi ile kosztuje każdy hook przed załadowaniem. | | |
| B3 | **Centralny katalog hooków** (rejestr z ID, opisem, kosztem, warunkami aktywacji) | Twoja wizja — agenci wybierają z katalogu, nie definiują własnych. | | |
| B4 | **Hooki bazowe per agent** (automatycznie ładowane) + **dynamiczne per task** (na żądanie) | Dwa typy ładowania. | | |
| B5 | **Hooki NIE kaskadują w górę** (hook potomka nie wpływa na rodzica) | Izolacja kontekstu. | | |
| B6 | **Lean mode wbudowany** (redukcja hooków, promptów, verbosity) | OMO nie ma tego — fork slim musiał powstać. | | |

---

## C. BEZPIECZEŃSTWO I KONTROLA

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| C1 | **Approval workflow OBOWIĄZKOWY** (plan → approve → execute, zero wyjątków domyślnie) | OMO #1081 — "3/5 plans started WITHOUT my acknowledgement". Najczęściej żądana zmiana. | | |
| C2 | **Tryb auto-approve jako OPT-IN** (nie domyślny) | OMO filozofia "human intervention = failure" odwrotna do Twojej. | | |
| C3 | **Dodatkowe potwierdzenie dla destrukcyjnych operacji** (git push --force, rm -rf) nawet w auto-approve | | | |
| C4 | **Sandboxing agentów** (Docker / VM / namespace) — opcja | OC #9132 — brak sandboxingu w obu projektach. | | |
| C5 | **Granularne permissions per agent** (frontend-agent nie ma dostępu do bazy danych) | | | |
| C6 | **Git safety**: nigdy `git add .` na całym repo, respektowanie .gitignore, limit rozmiaru snapshotów | OC #3176 — 45GB, 54K plików, "fundamental design flaw". | | |
| C7 | **Snapshoty opt-in na dużych repo** (>1GB) | | | |
| C8 | **Zero telemetrii domyślnej** (opt-in only) | OC #10416 — privacy concerns. | | |
| C9 | **Automatyczny redaction credentiali** (nigdy nie trafiają do kontekstu AI) | | | |

---

## D. MODELE I PROVIDERZY

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| D1 | **Prawdziwy multi-provider** (narzędzia MUSZĄ działać z każdym modelem, nie tylko Claude) | OC #1357 — zamknięty jako "model-problem". 75+ modeli to marketing jeśli Write/Edit failuje z non-Claude. | | |
| D2 | **Adaptery per provider** (jeśli model nie umie narzędzia → adapter/retry/fallback) | | | |
| D3 | **CI testy kompatybilności per provider** (automatyczne) | | | |
| D4 | **Per-agent model assignment** (agent główny = tani model, deep agent = drogi model) | Z OMO i Twojej wizji. | | |
| D5 | **Token budget per task** (limit wydatków tokenowych) | | | |
| D6 | **Real-time token counter** widoczny dla użytkownika | | | |
| D7 | **Cost estimation przed wykonaniem** planu ("ten plan zużyje ~$X") | | | |
| D8 | **Fallback chain** (provider A nie odpowiada → automatycznie B) | Twoja wizja proxy z analiza tech stack. | | |
| D9 | **Rate limit awareness** (nie bombarduje API) | OC problemy z GitHub rate limits + provider rate limits. | | |
| D10 | **HTTP_PROXY support** (użytkownicy korporacyjni) | OC #531 — bariera dla firm. | | |
| D11 | **Natywny OpenRouter support** | OMO #1637 — brak. | | |
| D12 | **Natywny Ollama support** (modele lokalne) | | | |
| D13 | **Równoległe zapytania do tego samego modelu z różnych subskrypcji** (race/consensus/cost mode) | Twoja unikalna wizja z analiza tech stack. | | |
| D14 | **Inteligentne przełączanie między subskrypcjami** (health check + strategie routingu) | Inspiracja LiteLLM. | | |

---

## E. PAMIĘĆ I KONTEKST

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| E1 | **Trwała pamięć między sesjami** (per-projekt) | OMO #74 — autor sceptyczny, brak pamięci. Ty chcesz to. | | |
| E2 | **Pamięć strukturalna** (decyzje architektoniczne, konwencje, preferencje, znane problemy) | | | |
| E3 | **Pamięć edytowalna przez użytkownika** (dodaj/usuń/modyfikuj) | | | |
| E4 | **Automatyczne uczenie się** (agent proponuje dodanie do pamięci, user potwierdza) | | | |
| E5 | **Selektywne wstrzykiwanie pamięci** (tylko relevantne fragmenty per task, nie całość) | | | |
| E6 | **User context management** (/add, /remove, /context) | OC #1990 — brak kontroli użytkownika nad kontekstem. | | |
| E7 | **Semantic search (RAG/vector)** jako opcja | OC+OMO brak — tylko grep/glob. | | |
| E8 | **Preemptive compaction** (kompresja ZANIM kontekst się przepełni) | OC #9637 — brak auto-kompresji, 355 👍. Claude Code to ma. | | |
| E9 | **Sliding window context** z podsumowaniem starszych wiadomości | OC #4659 — odrzucone mimo jasnej wartości. | | |
| E10 | **Hash-anchored references** (inspir. OMO Hashline — weryfikacja aktualności kontekstu) | 6.7% → 68.3% sukces edycji w benchmarku. | | |

---

## F. NARZĘDZIA WBUDOWANE (CORE)

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| F1 | **File operations** (read, write, edit z hash-anchored resilience) | | | |
| F2 | **Bash execution** (z timeout, opcjonalny sandboxing) | | | |
| F3 | **Glob + grep** (szybkie, parallel) | | | |
| F4 | **LSP integration** (go-to-def, find-refs, rename, diagnostics, symbols) | Kluczowa przewaga OC nad prostymi chatbotami. | | |
| F5 | **AST-grep** (search + replace na drzewie składniowym, 25+ języków) | Z OMO. | | |
| F6 | **Web search W CORE** (nie jako plugin) | OC #309 — otwarty 8+ mies., każdy konkurent to ma. Świadoma decyzja OC (komercja Zen?). | | |
| F7 | **Web fetch** (URL → markdown/text/html) | | | |
| F8 | **Interactive bash** (tmux — dla TUI apps, debuggerów) | Z OMO. | | |
| F9 | **MCP protocol client** (obsługa zewnętrznych MCP servers) | | | |
| F10 | **Wbudowane MCP**: web search, docs bibliotek (Context7-like), code search (Grep.app-like) | | | |
| F11 | **Playwright** (testy UI, scraping, weryfikacja) — ładowany per agent | Z OMO skills. | | |
| F12 | **Git operations** z safety rails (atomic commits, smart diff, undo/rollback) | | | |
| F13 | **Speech-to-text** wbudowany | OC #4695 — pełna implementacja gotowa, nie mergowana od miesięcy. | | |

---

## G. ORKIESTRACJA I WORKFLOW

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| G1 | **Plan mode z interaktywnymi pytaniami** (jak Claude Code) | OC #3844 — plan mode jest read-only, pasywny. | | |
| G2 | **Plan → review → approve → execute pipeline** | | | |
| G3 | **Plany z estimated cost + estimated time** | | | |
| G4 | **Persistent plans** (można wrócić i kontynuować) | | | |
| G5 | **Parallel execution waves** (niezależne taski równolegle) | Z OMO background agents. | | |
| G6 | **Dependency tracking** (task B czeka na A) | | | |
| G7 | **Progress dashboard** (done/in-progress/pending per task) | | | |
| G8 | **Cancellation w dowolnym momencie** z zachowaniem partial results | | | |
| G9 | **Continuation loop z hard limit** (max N iteracji) | OMO #668 — infinite loop + znikająca historia. | | |
| G10 | **Automatyczne QA per task** (evidence capture, screenshoty, test output) | | | |
| G11 | **Reviewer agent oddzielny od implementatora** (fresh context, nie widzi implementacji) | Twoja wizja. | | |
| G12 | **End-to-end pipeline**: issue → plan → kod → test → PR → review | Synergia OC+OMO. | | |

---

## H. PROXY SUBSKRYPCJI (UNIKALNA FUNKCJA)

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| H1 | **Dedykowany proxy AI** (inspiracja LiteLLM, ale TypeScript + dedykowany) | Core Twojej wizji. | | |
| H2 | **Race mode** (pierwsza odpowiedź wygrywa, reszta anulowana) | | | |
| H3 | **Consensus mode** (wszystkie odpowiedzi, agregacja voting/averaging) | | | |
| H4 | **Cost mode** (równoległe do najtańszych, wybór najlepszego quality/cost) | | | |
| H5 | **Circuit breaker** dla chronicznie niedostępnych providerów | | | |
| H6 | **Health checki providerów** z exponential backoff | | | |
| H7 | **OpenAI-compatible API endpoints** (de facto standard) | | | |
| H8 | **WebSocket streaming** odpowiedzi (real-time) | | | |
| H9 | **Per-request cost attribution** (ile kosztowało konkretne zapytanie) | | | |

---

## I. INTERFEJS UŻYTKOWNIKA

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| I1 | **TUI (terminal) jako PRIMARY interface** | | | |
| I2 | **Web UI (przeglądarka) jako SECONDARY interface** (ten sam backend) | Twoja wizja modułu webowego. | | |
| I3 | **Desktop app — NIE ROBIMY** | Twoja decyzja. Web UI pokrywa ten use case. | | |
| I4 | **VS Code extension** | Nice-to-have? | | |
| I5 | **Vim motions w input** od dnia 1 | OC #1764 — PR czeka. Claude Code to ma. | | |
| I6 | **Paste text widoczny i edytowalny** (nie `[Pasted ~1 lines]`) | OC #8501 — fix gotowy, nie mergowany. | | |
| I7 | **Markdown rendering z syntax highlighting** w output | | | |
| I8 | **Streaming odpowiedzi** (na bieżąco) | | | |
| I9 | **Progress indicators per delegowany task** | | | |
| I10 | **Collapse/expand** długie output | | | |
| I11 | **Windows support od dnia 1** | OC #631 — 199 reakcji, 70% devów. 7+ mies. i 11/23 done. | | |
| I12 | **JetBrains terminal musi działać** | OC #408. | | |

---

## J. TECH STACK

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| J1 | **TypeScript jako jedyny język** (100%, strict mode, zero `any`) | OC 51.3% TS + OMO 100% TS. Max reużywalność. | | |
| J2 | **Node.js 20+ LTS** jako domyślny runtime | Stabilność, ekosystem. | | |
| J3 | **Bun jako alternatywny runtime** (performance) | Ryzyko: OMO #1072 segfaults, wymóg AVX2. | | |
| J4 | **Hono** jako web framework (lekki, typowany, Edge-ready) | Inspiracja LiteLLM proxy. | | |
| J5 | **Zod** do walidacji schematów | Inferencja typów, ekosystem. | | |
| J6 | **Vercel AI SDK** do komunikacji z providerami | Szybki start, dobra abstrakcja. | | |
| J7 | **p-retry + p-timeout + p-queue** (retry/timeout/concurrency) | 80/20 rule, sprawdzone utility. | | |
| J8 | **Monorepo z pnpm workspaces + Turborepo** | Wzorzec z OC. | | |
| J9 | **Vitest** jako test runner | Natywny TS, szybki. | | |
| J10 | **Rust dla hot paths** (2-5%: parser kontekstu, kompresja promptów) | OC 0.5% Rust — strategiczne. | | |
| J11 | **SSE (Server-Sent Events)** zamiast WebSocket dla event streaming | Wzorzec OC — prostsze, lepsza kompatybilność. | | |

---

## K. GOVERNANCE I PROJEKT

| # | Temat | Kontekst z analizy | Decyzja | Uwagi |
|---|-------|---------------------|---------|-------|
| K1 | **Licencja MIT lub Apache 2.0** (nie SUL-1.0 jak OMO) | | | |
| K2 | **PR-y społeczności mergowane w rozsądnym czasie** | OC — gotowe PR-y czekają miesiącami. | | |
| K3 | **Bus factor > 1** (nie jednoosobowy projekt) | OMO = 1 osoba, defensywna. | | |
| K4 | **Contributing guide od dnia 1** | | | |
| K5 | **Sane defaults** (działa out of the box bez konfiguracji) | OMO bariera wejścia jest ogromna. | | |
| K6 | **Jedna konfiguracja** (`codewroc.config.ts` / `.codewrocrc`) | OMO: jedno złe pole = cała konfiguracja odrzucona. | | |
| K7 | **Per-project config** (overrides global) | | | |
| K8 | **Partial config loading** (graceful degradation, nie all-or-nothing) | OMO #1767 — ciche odrzucanie. | | |

---

## PODSUMOWANIE — Decyzje do podjęcia

### Pytania otwarte wymagające odpowiedzi:

1. **Nazwa projektu**: CodeWroc? DiriCode? Inna?
2. **MVP scope**: Które z powyższych punktów wchodzą do MVP, a które do v2?
3. **Solo vs team**: Czy to projekt solowy czy od początku team?
4. **Target user**: Kto jest docelowym użytkownikiem? (expert dev / intermediate / beginner?)
5. **Monetyzacja**: Open-source only? Freemium? Hosted proxy jako SaaS?
6. **Runtime**: Node.js only? Opcjonalnie Bun? Deno?
7. **Web UI framework**: React? Svelte? Solid? Vue?
8. **Baza danych** (jeśli potrzebna): SQLite? PostgreSQL? Żadna (pliki)?
9. **Deployment**: Self-hosted only? Cloud option? Edge?
10. **Priorytet proxy vs agenty**: Co pierwsze — proxy subskrypcji czy system agentów?

---

> **Instrukcja**: Przejdź punkt po punkcie i wpisz TAK/NIE/PÓŹNIEJ/DO DYSKUSJI.
> Po wypełnieniu → przejdziemy do projektowania architektury na podstawie Twoich decyzji.
