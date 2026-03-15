# DiriCode — Analizy do wykonania

Data: 2026-03-08
Status: ZAMKNIETE (13/13 — WSZYSTKIE TASKI KOMPLETNE)
Spec zaktualizowany: 27 ADR-ow (dodano ADR-022 do ADR-027 z TASK-002/007/012)
Nowi agenci w spec: summarizer, commit-writer (MVP), exec-decision (POC 2), namer (POC 3)

---

## UWAGI UZYTKOWNIKA (ZELAZNE WYTYCZNE)

Ponizsze uwagi dotycza calego projektu i musza byc uwzglednione we WSZYSTKICH taskach:

### UX-001: Zero stromej krzywej uczenia
Na start uzytkownik ma miec wgrane wszystkie najwazniejsze serwery MCP jako czesc frameworka — to ma dzialac od reki. Nietechniczny project manager instaluje i od razu moze robic wysokiej jakosci vibe coding. Framework umie zadawac pytania aby poprowadzic uzytkownika przed wytwarzanie MVP lub POC.

### UX-002: Orkiestracja nie moze byc zbyt agresywna
Kluczowe decyzje ZAWSZE podejmuje czlowiek. Zwlaszcza w rozpoczynaniu pracy. Agenty proponuja, czlowiek zatwierdza.

### UX-003: Transparentnosc drzewa agentow w UI
Uzytkownik musi miec mozliwosc spacerowania po rozmowie i historii. Widziec ktory agent jakiego uzyl, z jakim modelem, stopien zagniezdzenia (wiele sub- lub sub-sub-agentow). Musi to byc bardzo transparentne.

### LEGAL-001: Unikanie kopiowania kodu z kiepska licencja
Unikamy kopiowania kodu i bezposrednio rozwiazan ktore maja kiepska licencje OpenSource. Wtedy musimy zaimplementowac ich feature'y na swoj sposob — podobnie, ale nie kopiuj-wklej. Trzeba zrobic analize licencji wszystkich frameworkow ktore analizowalismy.

### ARCH-001: Kontekst dziedziczony
Idea kontekstu dziedziczonego jest kluczowa. Rozne subagenty uzywaja innych modeli, a najtansze subskrypcje maja waskie konteksty nawet dla drogich modeli (np. GitHub Copilot — mniej niz 200k). Kontekst musi byc efektywnie przekazywany i kompresowany.

### PROCESS-001: Iteracyjna implementacja (agile)
Kolejnosc: POC → MVP 1 → MVP 2 → MVP 3 → v2 → v3 itd. Najtrudniejsze i niekrytyczne funkcje przesuwamy na koniec. Wstepne POC ma dzialac jak najwczesniej — nie musi miec wszystkiego. Idziemy agile: kolo → hulajnoga → rower → samochod.

### ARCH-002: Sandbox v2/v3
Sandbox moze byc w v2 albo v3, w zaleznosci co po drodze sie pojawi wazniejsze.

### PERF-001: Prompt caching
Jesli prompt caching oszczedza mocno tokeny, musi byc w ktoryrms z MVP.

### ARCH-003: Wiecej hookow niz Claude Code
Skoro Claude Code ma ponad 12 warstw hookow (rodzajow), to DiriCode musi miec 15 a nawet do 20.

### ARCH-004: Plandex roles = agenty
Plandex roles to de facto to samo co agenty. Mozemy pozyczac pomysly na wlasne agenty z Plandex.

---

## TASK-001: Hooki — analiza OMO + Claude Code

**Status**: ✅ KOMPLETNY (2026-03-10) — wyniki w `analiza-hookow.md` (338 linii). Zmniejszony zakres — decyzja o 6 hookach MVP juz podjeta (ADR-005). Analiza potrzebna glownie dla backlogu v2/v3.
**Blok ankiety**: 3 (Hooki i modularnosc)
**Priorytet**: SREDNI (obnizony — MVP hooki juz zdecydowane)
**Blokuje**: backlog hookow v2/v3, lean mode
**Uwagi**: ARCH-003 — DiriCode docelowo 15-20 rodzajow hookow

### Cel
Doglebna analiza hookow z Oh-My-OpenCode i Claude Code. Kategoryzacja, ocena przydatnosci, rekomendacja ktore w MVP. DiriCode ma miec 15-20 rodzajow hookow — wiecej niz Claude Code (12+).

### Pytania do odpowiedzenia
1. Jakie hooki ma OMO i jak dzialaja? (12 lifecycle hooks)
2. Jakie hooki / middleware ma Claude Code? (12+ warstw)
3. Jak je skategoryzowac? (np. routing, safety, quality, cost, context)
4. Ktore sa konieczne w POC, ktore w MVP 1/2/3, ktore w v2+?
5. Ktore maja sens dla dispatche'a (read-only agent)?
6. Co dokladnie lean mode powinien wylaczac/zmieniac?
7. Jakie NOWE hooki dodac zeby dojsc do 15-20? (analiza luk)
8. Jak hooki wplywaja na kontekst dziedziczony? (ARCH-001)

### Zrodla do przeanalizowania
- `/Users/rado/repos/diricode/analiza-hookow-omo.md`
- `/Users/rado/repos/diricode/oh-my-opencode/` (kod zrodlowy)
- `/Users/rado/repos/diricode/claude-code/` (kod zrodlowy)
- `/Users/rado/repos/diricode/architektura-opencode-omo.md`

### Oczekiwany output
Tabela: hook | kategoria | opis | POC/MVP/v2? | dispatcher? | lean mode?

---

## TASK-002: Context management i search strategy

**Status**: ✅ KOMPLETNY (2026-03-09) — wyniki w `analiza-context-management.md` (693 linii)
**Blok ankiety**: 5, 7 (Narzedzia, Kontekst i pamiec)
**Priorytet**: KRYTYCZNY
**Blokuje**: dobor narzedzi POC 1, codebase indexing, sposob przeszukiwania kodu
**Uwagi**: ARCH-001 — kontekst dziedziczony kluczowy, waskie okna kontekstowe (Copilot <200k)

### Cel
Analiza jak wszystkie 8 frameworkow zarzadza kontekstem — jak przeszukuja, pamietaja, buduja kontekst dla agentow. Rekomendacja optymalnej strategii dla DiriCode, z uwzglednieniem waskich okien kontekstowych (Copilot <200k) i kontekstu dziedziczonego.

### Pytania do odpowiedzenia
1. Jak kazdy z 8 frameworkow buduje kontekst dla AI? (repo map, indexing, embeddings, grep, AST, LSP)
2. Jak przeszukuja codebase? (grep vs AST-grep vs LSP vs embeddings vs hybrid)
3. Jak pamietaja kontekst miedzy sesjami?
4. Jak radza sobie z duzymi repozytoriami?
5. Ktore podejscie jest najlepsze pod wzgledem: precyzja, koszt tokenow, szybkosc?
6. Jaka strategia dla DiriCode? (z uwzglednieniem rodzin agentow — explorer vs code-writer maja rozne potrzeby)
7. Jak efektywnie dziedzic kontekst miedzy sub-agentami przy waskim oknie (<200k)?
8. Jak prompt caching moze redukowac koszty kontekstu? (PERF-001)

### Zrodla do przeanalizowania
- Wszystkie 8 analiz (`analiza-*.md`)
- Kody zrodlowe 8 frameworkow
- `/Users/rado/repos/diricode/mapa-funkcje.md`
- `/Users/rado/repos/diricode/mapa-braki.md`

### Oczekiwany output
Porownanie 8 podejsc + rekomendacja strategii DiriCode z uzasadnieniem

---

## TASK-003: State management z git worktrees

**Status**: ✅ ZAMKNIETY — caly state w GitHub Project (zagniezdzone Epici → Issues). SQLite = cache. Prosty lokalny backend v3/v4.
**Blok ankiety**: 9 (Storage i konfiguracja)
**Priorytet**: WYSOKI
**Blokuje**: wybor storage (Markdown vs inne), architektura stanu

### Cel
Zbadac jak stan aplikacji (todo, sesje, pamiec) powinien dzialac gdy wiele agentow pracuje na roznych git worktrees rownoczesnie.

### Pytania do odpowiedzenia
1. Jesli stan jest w Markdown (todo.md) — co sie dzieje gdy 2 agenty na roznych worktrees edytuja go jednoczesnie?
2. Czy stan powinien byc POZA git worktree (np. w ~/.config/diricode/state/)?
3. Jak inne narzedzia (Plandex, OpenHands) rozwiazuja problem wspolbieznego stanu?
4. Czy potrzebujemy lock mechanizmu? Jakiego?
5. Jak merge'owac stan z roznych worktrees po zakonczeniu pracy?

### Zrodla do przeanalizowania
- `/Users/rado/repos/diricode/analiza-plandex.md` (Plandex uzywa branchowania)
- `/Users/rado/repos/diricode/analiza-openhands.md` (OpenHands uzywa Docker)
- Git worktree documentation

### Oczekiwany output
Rekomendacja: gdzie trzymac stan, jak synchronizowac, jak rozwiazywac konflikty

---

## TASK-004: Web framework — AI-friendly code generation

**Blok ankiety**: 11 (Interfejs)
**Priorytet**: SREDNI
**Blokuje**: wybor frameworka Web UI
**Uwagi**: UX-003 — framework musi wspierac transparentne drzewo agentow (tree view z zagniezdzonymi sub-agentami)

### Cel
Znalezc framework webowy ktory jest najbardziej przyjazny do generowania kodu przez agenty AI. Kryterium NIE jest integracja z AI na runtime — chodzi o to, jak latwo AI agent pisze kod w tym frameworku. Dodatkowe kryterium: framework musi dobrze obslugiwac tree view (drzewo agentow z zagniezdzonymi sub-agentami).

### Pytania do odpowiedzenia
1. Ktore frameworki (Next.js, Vite+React, SvelteKit, SolidStart, Astro) sa najczesciej poprawnie generowane przez LLM-y?
2. Ktore maja najprostszy boilerplate (mniej kodu = mniej bledow AI)?
3. Ktore maja najlepsza dokumentacje w training data modeli AI?
4. Ktore maja najmniej "magii" (implicit behavior ktore AI moze zle zrozumiec)?
5. Benchmarki / dane: czy sa badania o AI code generation accuracy per framework?
6. Ktory framework najlepiej wspiera tree view / nested components (dla transparentnosci agentow)?

### Zrodla do przeanalizowania
- Benchmarki AI coding (SWE-bench, HumanEval, etc.)
- Blogi / artykuly o AI-friendly frameworkach
- Porownanie boilerplate size
- Analiza training data coverage (popularnosc na GitHub)

### Oczekiwany output
Ranking frameworkow z uzasadnieniem + rekomendacja dla DiriCode

---

## TASK-005: Router architektura — modul vs mikroserwis

**Status**: ✅ KOMPLETNY (2026-03-09) — wyniki w `analiza-router.md` (574 linii)

**Status**: 🔄 W TRAKCIE (2026-03-09) — analiza kodu w toku, wyniki beda w `analiza-router.md`
**Blok ankiety**: 12 (Proxy i routing)
**Priorytet**: WYSOKI
**Blokuje**: architektura routera, priorytet budowy (router first!)
**Uwagi**: UX-001 — router musi dzialac od reki, zero konfiguracji na start

### Cel
Zdecydowac czy TS Router powinien byc oddzielnym modulem w monorepo, czy osobnym mikroserwisem. Uzasadnienie z trade-offami. Uwzglednic ze setup musi byc zero-config dla nowego uzytkownika.

### Pytania do odpowiedzenia
1. Jakie sa trade-offy: modul vs mikroserwis?
2. Jak LiteLLM dziala jako sidecar? Co dziala dobrze, co zle?
3. Czy mikroserwis pozwala na wspoldzielenie routera miedzy projektami / instancjami DiriCode?
4. Jak to wplywa na deployment (local CLI)?
5. Czy mikroserwis komplikuje setup dla solo deva / nietechnicznego PM-a?
6. Jak to wplywa na latency (dodatkowy hop networkowy)?

### Zrodla do przeanalizowania
- `/Users/rado/repos/diricode/analiza-litellm-ankieta.md`
- `/Users/rado/repos/diricode/litellm/` (kod zrodlowy)
- Architektura proxy w Plandex i OpenHands

### Oczekiwany output
Tabela trade-offow + rekomendacja z uzasadnieniem

---

## TASK-006: Config layers — analiza konkurencji

**Status**: ✅ KOMPLETNY (2026-03-10) — wyniki w `analiza-config-layers.md` (459 linii). Porownanie 8 frameworkow: warstwy, formaty, walidacja, env vars, monorepo, merge strategy. Rekomendacja: JSONC + 7 warstw + Zod + `.diricode/` + env-paths. 8 decyzji do podjecia.

**Blok ankiety**: 9 (Storage i konfiguracja)
**Priorytet**: NISKI
**Blokuje**: finalna struktura configu

### Cel
Zbadac jak konkurencyjne narzedzia strukturyzuja konfiguracje (ile warstw, co gdzie, jak overriduja).

### Pytania do odpowiedzenia
1. Ile warstw configu ma kazde z 8 narzedzi?
2. Co jest w globalnym configu vs projektowym?
3. Jak obsluguja CLI flags / env vars?
4. Jak obsluguja monorepo (workspace-level config)?
5. Jakie sa best practices?

### Zrodla do przeanalizowania
- Dokumentacja i kody 8 frameworkow (sekcje config)
- `/Users/rado/repos/diricode/porownanie-8-narzedzi.md`

### Oczekiwany output
Tabela porownawcza + rekomendacja dla DiriCode

---

## TASK-007: Codebase indexing

**Status**: ✅ KOMPLETNY (2026-03-09) — wyniki w `analiza-context-management.md` (polaczony z TASK-002)
**Blok ankiety**: 7 (Kontekst i pamiec)
**Priorytet**: SREDNI
**Blokuje**: czesc context management strategy

### Cel
Zdecydowac czy i jak DiriCode powinien automatycznie indeksowac codebase (symbole, struktura, zaleznosci). Czesc wiekszej analizy TASK-002.

### Pytania do odpowiedzenia
1. Ktore frameworki uzywaja auto-indexing? (Aider repo-map, Cline tree-sitter, etc.)
2. Jaki jest koszt indexing (czas, RAM, storage)?
3. Kiedy indeksowac? (startup, po git pull, on-demand, continuous)
4. Co indeksowac? (symbole, imports, call graph, typy, testy)
5. Jak indeks dziala z git worktrees?

### Zrodla do przeanalizowania
- Czesc TASK-002 (context management)
- Aider repo-map implementation
- Tree-sitter / LSP indexing patterns

### Oczekiwany output
Rekomendacja: co indeksowac, kiedy, jak przechowywac indeks

**UWAGA**: Moze byc polaczony z TASK-002 jako podtask.

---

## TASK-008: Lean mode — definicja

**Status**: ✅ KOMPLETNY (2026-03-10) — wyniki w `analiza-agent-roster.md` (40 agentow) + `analiza-lean-mode.md` (4 wymiary pracy: Quality, Autonomy, Verbose, Creativity).
**Blok ankiety**: 3 (Hooki i modularnosc)
**Priorytet**: NISKI
**Blokuje**: nic w MVP (lean mode moze byc v2)
**Zalezy od**: TASK-001 (hooki)

### Cel
Zdefiniowac co dokladnie lean mode wylacza, zmienia, upraszcza. Wymaga najpierw analizy hookow (TASK-001).

### Pytania do odpowiedzenia
1. Co lean mode wylacza? (hooki? agentow? narzedzia?)
2. Czy lean mode zmienia model? (tanszy model zamiast drogiego)
3. Czy lean mode zmienia approval? (auto-approve wiecej?)
4. Jak duza jest roznica w koszt tokenow: normal vs lean?
5. Czy lean mode to config flag czy oddzielny tryb?

### Zrodla do przeanalizowania
- TASK-001 (po zakonczeniu)
- OMO slim fork (co wylacza)
- Analiza kosztow tokenow per feature

### Oczekiwany output
Definicja lean mode: co wylacza, co zmienia, szacowany impact na koszty

---

## TASK-009: Storage — Markdown vs inne (kontekst worktrees)

**Status**: ✅ ZAMKNIETY — GitHub = source of truth, SQLite = cache. Markdown NIE jest storage.
**Blok ankiety**: 13 (Co odrzucic)
**Priorytet**: SREDNI
**Blokuje**: finalna decyzja o storage
**Zalezy od**: TASK-003 (state management z worktrees)

### Cel
Finalna decyzja czy Markdown (ADR-013) wystarczy jako storage, czy potrzebujemy czegos innego — szczegolnie w kontekscie git worktrees i wspolbieznych agentow.

### Pytania do odpowiedzenia
1. Czy Markdown pliki moga byc bezpiecznie edytowane wspolbieznie?
2. Czy potrzebujemy ustrukturyzowanych queries na stanie? (jesli tak — SQLite lepszy)
3. Jakie sa limity Markdown przy duzej ilosci danych (np. 1000 taskow)?
4. Czy YAML frontmatter w MD daje wystarczajaca strukture?
5. Czy mozna uzyc hybridy: MD dla human-readable + SQLite/JSON dla machine-state?

### Zrodla do przeanalizowania
- TASK-003 (po zakonczeniu)
- Jak Obsidian radzi sobie z duzymi vault'ami MD
- SQLite vs flat files benchmarki

### Oczekiwany output
Finalna rekomendacja storage z uzasadnieniem

---

## TASK-010: Analiza licencji 8 frameworkow

**Status**: ✅ KOMPLETNY (2026-03-09) — wyniki w `analiza-licencji.md`
**Blok ankiety**: — (nowy, z uwag uzytkownika)
**Priorytet**: KRYTYCZNY
**Blokuje**: cala implementacje (nie mozemy kopiowac kodu z kiepska licencja!)
**Uwagi**: LEGAL-001

### Cel
Analiza licencji open source wszystkich 8 analizowanych frameworkow. Okreslenie co mozemy pozyczac bezposrednio (kod), co mozemy pozyczac jako pomysly/architekture, a czego musimy unikac i zaimplementowac po swojemu.

### Pytania do odpowiedzenia
1. Jaka licencje ma kazdy z 8 frameworkow? (MIT, Apache 2.0, AGPL, BSL, inne)
2. Ktore licencje pozwalaja na kopiowanie kodu do projektu MIT?
3. Ktore licencje pozwalaja TYLKO na inspiracje (trzeba napisac od zera)?
4. Czy sa czesci kodu z innymi licencjami niz glowna? (sub-dependencies, vendored code)
5. Jakie sa ryzyka prawne przy kazdym frameworku?
6. Co konkretnie mozemy pozyczac z Plandex (roles → agenty)? Jaka licencja?

### Frameworki do analizy
| Framework | Repozytorium |
|-----------|-------------|
| Aider | `/Users/rado/repos/diricode/aider/` |
| Cline | `/Users/rado/repos/diricode/cline/` |
| OpenHands | `/Users/rado/repos/diricode/OpenHands/` |
| Plandex | `/Users/rado/repos/diricode/plandex/` |
| Codex CLI | `/Users/rado/repos/diricode/codex/` |
| Claude Code | `/Users/rado/repos/diricode/claude-code/` |
| OpenCode | `/Users/rado/repos/diricode/opencode/` |
| Oh-My-OpenCode | `/Users/rado/repos/diricode/oh-my-opencode/` |

### Oczekiwany output
Tabela: framework | licencja | mozna kopiowac kod? | mozna kopiowac architekture? | ryzyka | uwagi

---

## TASK-011: Prompt caching — analiza oszczednosci

**Status**: ✅ KOMPLETNY (2026-03-10) — wyniki w `analiza-prompt-caching.md`
**Blok ankiety**: — (nowy, z uwag uzytkownika)
**Priorytet**: SREDNI
**Blokuje**: decyzja w ktorym MVP wlaczyc prompt caching
**Uwagi**: PERF-001

### Cel
Zbadac ile tokenow/kosztow oszczedza prompt caching u roznych providerow. Zdecydowac w ktorym MVP to wlaczyc.

### Pytania do odpowiedzenia
1. Jak dziala prompt caching u Anthropic (Claude)?
2. Jak dziala prompt caching u OpenAI?
3. Czy GitHub Copilot / GitHub Models API wspiera prompt caching?
4. Czy Kimi wspiera prompt caching?
5. Ile procent tokenow mozna oszczedzic przy typowym workflow agenta?
6. Jak prompt caching wplywa na architekture (co musi byc stale w prompcie)?
7. Czy prompt caching wplywa na kontekst dziedziczony (ARCH-001)?
8. W ktorym MVP warto to wlaczyc? (POC? MVP1? MVP2?)

### Zrodla do przeanalizowania
- Dokumentacja Anthropic prompt caching
- Dokumentacja OpenAI prompt caching
- GitHub Models API docs
- Kimi API docs
- Blogi o realnych oszczednosciach

### Oczekiwany output
Tabela: provider | wsparcie caching | szacowane oszczednosci | wplyw na architekture | rekomendacja MVP

---

## TASK-012: Plandex roles → DiriCode agenty

**Status**: ✅ KOMPLETNY (2026-03-09) — wyniki w `analiza-plandex-roles.md`
**Blok ankiety**: 2, 14 (Architektura agentow, Pytania otwarte)
**Priorytet**: SREDNI
**Blokuje**: finalna lista agentow i ich odpowiedzialnosci
**Uwagi**: ARCH-004

### Cel
Przeanalizowac system rol w Plandex i wyciagnac pomysly na agenty DiriCode. Plandex roles to de facto agenty — mozemy pozyczac najlepsze idee (z uwzglednieniem licencji — patrz TASK-010).

### Pytania do odpowiedzenia
1. Jakie role ma Plandex? Jak sa zdefiniowane?
2. Jak Plandex przydziela role do taskow?
3. Ktore role Plandex mapuja sie na agenty DiriCode 1:1?
4. Czy Plandex ma role ktorych DiriCode nie ma? (luki do uzupelnienia)
5. Jak Plandex obsluguje delegacje miedzy rolami?
6. Czy sa pomysly na nowe agenty DiriCode z inspiracji Plandex?

### Zrodla do przeanalizowania
- `/Users/rado/repos/diricode/analiza-plandex.md`
- `/Users/rado/repos/diricode/plandex/` (kod zrodlowy — sekcja roles)
- TASK-010 wynik (licencja Plandex)

### Oczekiwany output
Mapowanie: Plandex role → DiriCode agenty + nowe pomysly na agentow

---

## GRAF ZALEZNOSCI

```
TASK-010 (Licencje) ───────────────────> [BLOKUJE cala implementacje]
TASK-010 (Licencje) ───────────────────> TASK-012 (Plandex roles)
TASK-001 (Hooki) ──────────────────────> TASK-008 (Lean mode)
TASK-002 (Context management) ─────────> TASK-007 (Indexing) [podtask]
TASK-002 (Context management) ─────────> TASK-011 (Prompt caching) [input]
TASK-003 (State + worktrees) ──────────> TASK-009 (Storage finalna decyzja)
TASK-004 (Web framework) ─────────────> [niezalezny]
TASK-005 (Router architektura) ───────> [niezalezny]
TASK-006 (Config layers) ────────────-> [niezalezny]
```

## SUGEROWANA KOLEJNOSC REALIZACJI (zaktualizowana 2026-03-09)

1. ~~**TASK-010** — Analiza licencji~~ ✅ ZROBIONE (analiza-licencji.md)
2. ~~**TASK-005** — Router architektura~~ ✅ ZROBIONE (analiza-router.md)
3. ~~**TASK-002** + **TASK-007** — Context management + indexing~~ ✅ ZROBIONE (analiza-context-management.md)
4. ~~**TASK-012** — Plandex roles → agenty~~ ✅ ZROBIONE (analiza-plandex-roles.md)
5. ~~**TASK-001** — Hooki (zmniejszony zakres — backlog v2/v3)~~ ✅ ZROBIONE (analiza-hookow.md)
6. ~~**TASK-003** — State management z worktrees~~ ✅ ZAMKNIETY — decyzja: caly state w GitHub Project (zagniezdzone Epici → Issues), SQLite = cache. Worktree problem nie istnieje (API). Prosty lokalny backend v3/v4. (ADR-007, ADR-013 zaktualizowane)
7. ~~**TASK-011** — Prompt caching (sredni, wplyw na architekture)~~ ✅ ZROBIONE (analiza-prompt-caching.md)
8. ~~**TASK-004** — Web framework (sredni, potrzebny przed budowa UI)~~ ✅ ZROBIONE + DECYZJA: **Vite + React + shadcn/ui** (ADR-028, analiza-web-framework.md z sekcja Reddit/HN research)
9. ~~**TASK-009** — Storage~~ ✅ ZAMKNIETY — GitHub = source of truth, SQLite = cache/timeline/search. Zero lokalnych plikow stanu. (ADR-007, ADR-013)
10. ~~**TASK-008** — Lean mode~~ ✅ ZROBIONE (analiza-agent-roster.md + analiza-lean-mode.md)
11. ~~**TASK-006** — Config layers~~ ✅ ZROBIONE (analiza-config-layers.md)
12. ~~**TASK-013** — Observability~~ ✅ ZROBIONE (analiza-observability.md)

---

## TASK-013: Observability — transparentnosc pracy agentow

**Status**: ✅ KOMPLETNY (2026-03-10) — wyniki w `analiza-observability.md`. MVP: Agent Tree + Metrics Bar + Live Activity Indicator. v2: Detail Panel + Pre-tool Approval + Timeline/Waterfall. v3: pelna re-analiza z web research.
**Blok ankiety**: — (nowy, z uwag uzytkownika)
**Priorytet**: WYSOKI
**Blokuje**: architektura EventStream, UI transparentnosci
**Uwagi**: UX-003 — uzytkownik musi widziec ktory agent co robi, z jakim modelem, stopien zagniezdzenia

### Cel
Zaprojektowac system observability DiriCode — jak uzytkownik widzi w real-time co robi orkiestrator i agenty. EventStream jako backbone, komponenty UI pogrupowane na MVP/v2/v3.

### Pytania odpowiedziane
1. Jaki data model? → EventStream: Session → Turn → Agent Span → {LLM, Tool, Sub-Agent, Human Input}
2. Co w MVP? → Agent Tree (drzewko agentow), Metrics Bar (tokeny/koszt/czas), Live Activity Indicator (co teraz)
3. Co w v2? → Detail Panel (szczegoly agenta), Pre-tool Approval (zatwierdzanie inline), Timeline/Waterfall (Gantt)
4. Co w v3? → Pelna re-analiza z web research, cost analytics, performance profiling, comparison view
5. Jak integruje sie z 4 wymiarami? → Verbose kontroluje ile observability jest widoczne, Autonomy kontroluje approval UI, Quality wplywa na ilosc agentow w drzewie

### Zrodla przeanalizowane
- OMO: JSONL transcripts, parent/child session tracking, toast notifications
- OpenHands: EventStream, colored ACTION/OBSERVATION, per-event token/cost
- Plandex: SSE streaming, message types (Reply/BuildInfo/Describing/Error/Finished)
- Codex: TurnStarted/Completed, head-tail buffer, agent status subscription
- Claude Code: agent_id/agent_type on events, pre/post tool hooks, JSONL transcripts
- Langfuse: Session → Trace → Observation hierarchy, session replay
- LangSmith: Waterfall timeline, evaluation sidebar
- Arize Phoenix: Color-coded operation types, expandable tree
- OpenTelemetry: Span standard (traceId, spanId, parent, kind, attributes)
- Jaeger: Gantt-style waterfall, service dependency graph
- Turborepo: Multi-line terminal progress with per-task status icons

### Oczekiwany output ✅
Pelna analiza w `analiza-observability.md` — data model, event schema, 6 komponentow UI (3 MVP + 3 v2), integracja z 4 wymiarami, roadmap v3.
