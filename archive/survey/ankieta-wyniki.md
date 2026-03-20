# DiriCode — Wyniki Ankiety Decyzyjnej

Data: 2026-03-08
Status: KOMPLETNA (14/14 blokow)

---

## BLOK 1: FUNDAMENTY

| Pytanie | Decyzja |
|---------|---------|
| Nazwa projektu | DiriCode |
| Odbiorca MVP | Solo dev (tylko dla siebie). Docelowo: nietechniczni PM-owie, techniczni devs, zespoly. Multi-user pomijamy do v2/v3/v4. |
| Deployment | Lokalne CLI only. Docker moze kiedys, ale MCP servery i subagenty moga potrzebowac zbyt duzo mocy. |
| Licencja | MIT (full open) |
| Priorytety wartosci | 1) Koszt tokenow, 2) Niski prog wejscia, 3) Vibe coding dla nietechnicznych PM-ow |
| Wizja narzedzia | Tool ma dzialac jak architekt + full-stack engineer + zespol testerow + DevOps. Umie zadawac krytyczne pytania dla osob nie zaznajomionych. |

---

## BLOK 2: ARCHITEKTURA AGENTOW

| Pytanie | Decyzja |
|---------|---------|
| Dispatcher read-only | TAK, podtrzymane. Ale moze miec kluczowe hooki (nie wszystkie — tylko istotne dla routingu). |
| Agenty MVP — rundy POC | **POC 1**: dispatcher, planner, code-writer, code-reviewer, explorer, architect. **POC 2**: git-manager. **POC 3**: debugger, test-runner. devops — pozniej. |
| Sub-delegacja | TAK — agenty moga delegowac dalej. Docelowo sub-dispatcher na osobnym git worktree. |
| Approval workflow | Hybryda: pytaj → zapamietuj → smart AI uczy sie i nie pyta ponownie o podobne akcje. Docelowo sandbox + wyuczone agenty. |
| Return policy | Essential data only. Analiza co jest krytyczne dla dispatche'a, agenty uczone zwracac minimum istotnych danych. |
| NOWY agent | **project-builder** — robi ankiete krok po kroku, pyta usera, oferuje gotowe szablony do inicjalizacji projektu. |

---

## BLOK 3: HOOKI I MODULARNOSC

| Pytanie | Decyzja |
|---------|---------|
| Hooki MVP | **ODLOZONE** — wymaga doglebnej analizy hookow z OMO i Claude Code, potem kategoryzacja i decyzja. |
| Hooki dispatche'a | **ODLOZONE** — decyzja po kategoryzacji hookow. |
| Lean mode | **ODLOZONE** — wymaga wiecej kontekstu i analizy skad ten koncept. |
| Hook priority | Automatyczny DAG — system sam rozwiazuje kolejnosc na podstawie zaleznosci miedzy hookami. |

---

## BLOK 4: MODELE I PROVIDERY

| Pytanie | Decyzja |
|---------|---------|
| Router tryby MVP | Tylko **failover** w MVP. Docelowo konfiguracja drag-drop per kategoria, potem per subagent. |
| Model per agent | Agenty maja przypisane **rodziny modeli**. Modele podzielone na rodziny wg specjalizacji (coding, reasoning, creative, etc.). |
| Providery MVP | **Copilot** (priorytet 1) via GitHub Models API, **Kimi** (priorytet 2). Reszta pozniej. ZMIANA vs spec (byl Anthropic/OpenAI/DeepSeek). |
| Reasoning effort | Multi-dimensional: nie tylko low/medium/high, ale tez rodzina modelu (coding vs reasoning vs creative). |

---

## BLOK 5: NARZEDZIA

| Pytanie | Decyzja |
|---------|---------|
| Hashline Edit | TAK, core feature MVP. Potwierdzone. |
| Narzedzia POC 1 | file.read (hashline) + file.edit (hashline) potwierdzone. Reszta narzedzi wymaga analizy context management. |
| Context management | **WYMAGA ANALIZY** — doglebna analiza jak wszystkie 8 frameworkow zarzadza kontekstem i przeszukuje go. Nie tylko OMO — porownanie wszystkich. |
| MCP servery | Built-in toolsy w MVP. MCP jako plugin system pozniej. |
| Playwright | Pozniej (nie MVP). |
| Web search | TAK, w MVP. Agenty beda mogly szukac w internecie. |

---

## BLOK 6: BEZPIECZENSTWO I KONTROLA

| Pytanie | Decyzja |
|---------|---------|
| Permission system | Allowlist/denylist per agent w MVP. Docelowo ruleset-based jako opcja. |
| Sandbox | NIE w MVP. To v2/v3. |
| Git safety | ADR-010 (zelazne zasady git) + sub-dispatcher moze tworzyc git worktree gdy potrzebne. |
| Secret redaction | Auto-scan + wzorce. Automatyczne skanowanie env, .env, API keys, tokens, passwords. |

---

## BLOK 7: KONTEKST I PAMIEC

| Pytanie | Decyzja |
|---------|---------|
| GitHub Issues jako pamiec | TAK, ale **bez lock-in na GitHub**. Interfejs abstrakcyjny — docelowo wsparcie GitLab Issues, Jira etc. GitHub jako pierwszy backend. |
| Compaction | **Hybrid**: AI summary + hierarchiczna kompakcja (szczegoly → podsumowania → kluczowe punkty). |
| Background tasks | TAK — agenty musza umiec pracowac w tle gdy brak zaleznosci. Web search i inne powinny uzywac roznych providerow rownolegle. |
| Context init | **NOWY AGENT: project-builder** — robi ankiete krok po kroku, pyta usera, oferuje gotowe szablony. Guided setup, nie auto-context. |
| Codebase indexing | **WYMAGA ANALIZY** — czesc wiekszej analizy context management. |

---

## BLOK 8: SNAPSHOT I UNDO

| Pytanie | Decyzja |
|---------|---------|
| Snapshot system | Git jako baza. Checkpoints (tagged commits) mozliwe do rozpatrzenia po analizie context management. |
| Worktree lifecycle | Auto-cleanup po zakonczeniu pracy sub-dispatche'a. |

---

## BLOK 9: STORAGE I KONFIGURACJA

| Pytanie | Decyzja |
|---------|---------|
| Config format | `diricode.config.ts` (TypeScript + Zod). Nietechniczni uzytkownicy nie edytuja recznie — DiriCode (moze agent?) generuje/modyfikuje config za nich. |
| Config layers | 3 warstwy: global (~/.config/diricode/) > projekt (.diricode/) > CLI flags. Wymaga analizy konkurencji. |
| State management | **WYMAGA ANALIZY** — szczegolnie w kontekscie git worktrees (state musi dzialac z wieloma worktrees). |

---

## BLOK 10: SKILLS SYSTEM

| Pytanie | Decyzja |
|---------|---------|
| Skills w MVP | TAK, SKILL.md w MVP. |
| Skill delivery | Przez system **rodzin**. Skille podzielone na rodziny, agenty tez maja rodziny — matching przez rodziny. |
| Skill-embedded MCP | TAK — skill moze zawierac MCP server. Skill = wiedza + narzedzia. |

---

## BLOK 11: INTERFEJS (TUI/WEB)

| Pytanie | Decyzja |
|---------|---------|
| TUI framework | Ink (React-based) potwierdzone. |
| Web UI | **ZMIANA**: Web UI jako **glowny interfejs** MVP. TUI w v2. PM-owie potrzebuja Web UI, nie terminala. |
| Vim motions | TAK w TUI (gdy TUI bedzie dostepny). |
| Streaming UX | **Lepiej niz OMO**: pelny wglad w drzewo agentow — ktory agent, ktore zadanie, jaki model, stopien zagniezdzenia. Uzytkownik "chodzi po drzewie" jak w file explorer. |
| Platform | macOS + Linux w MVP. Windows (WSL) experimental. |
| Web framework | **WYMAGA ANALIZY** — kryterium: ktory framework jest najbardziej AI-friendly do generowania kodu przez agenty (nie integracja runtime, ale sam proces tworzenia kodu). |

---

## BLOK 12: PROXY I ROUTING

| Pytanie | Decyzja |
|---------|---------|
| Router architektura | **WYMAGA ANALIZY** — oddzielny modul vs mikroserwis. Mikroserwis ciekawy (mozna hostowac oddzielnie). |
| Cost tracking | Szczegolowy per-request: model, tokeny in/out, koszt, agent, task. Dashboard z wykresami. |
| Copilot integration | GitHub Models API. Copilot token daje dostep do wielu modeli (Claude, GPT, Gemini). Zero dodatkowych kosztow. |

---

## BLOK 13: CO ODRZUCIC

### Z Oh-My-OpenCode odrzucic:
- Mitologiczne nazwy agentow (DiriCode uzywa nazw opisowych)
- Fork slim/fat (lean mode wbudowany)
- Storage wymaga nadal analizy z powodu git worktrees

### Z OpenCode odrzucic:
- Monolityczny agent (DiriCode ma agentow)
- LiteLLM sidecar (wlasny TS Router)
- BubbleTea TUI (Web UI + Ink)

### Explicit NOT doing w MVP:
- Multi-user (auth, permissions, teams)
- Cloud/SaaS
- IDE extension (VS Code etc.)
- Auto-deploy (CI/CD management)
- Voice interface
- Image generation

---

## BLOK 14: PYTANIA OTWARTE

| Pytanie | Decyzja |
|---------|---------|
| Custom agents | TAK — `.diricode/agents/*.md`. Agent Guard w Markdown + przypisanie do rodziny. |
| Priorytet budowy | **Router first**. Najpierw TS Router/proxy (Copilot, Kimi, failover), potem agenty, potem UI. |
| MVP timeline | 2-4 tygodnie na POC 1. |
| Testowanie agentow | Unit testy + mock AI responses. Tanie, szybkie, deterministyczne. |
| Rodziny | **FORMALNY KONCEPT architektoniczny**. `Family = { models[], agents[], skills[] }`. Kazda rodzina ma swoje defaults. |

---

## ELEMENTY WYMAGAJACE ANALIZY (TODO)

| # | Temat | Kontekst | Blok |
|---|-------|----------|------|
| 1 | Hooki — analiza OMO + Claude Code | Kategoryzacja hookow, decyzja ktore w MVP, ktore dla dispatche'a | 3 |
| 2 | Context management & search strategy | Analiza wszystkich 8 frameworkow — jak przeszukuja, pamietaja, zarzadzaja kontekstem | 5, 7 |
| 3 | State management z git worktrees | Jak stan (todo, sesje) dziala z wieloma worktrees rownoczesnie | 9 |
| 4 | Web framework (AI-friendly) | Ktory framework jest najbardziej przyjazny do generowania kodu przez agenty AI | 11 |
| 5 | Router architektura | Oddzielny modul vs mikroserwis — uzasadnienie, trade-offy | 12 |
| 6 | Config layers — analiza konkurencji | Jak inne narzedzia (Aider, Cline, Claude Code) strukturyzuja config | 9 |
| 7 | Codebase indexing | Czesc analizy context management — auto-index vs lazy | 7 |
| 8 | Lean mode | Doglebniejsza analiza co dokladnie wylaczac/zmieniac | 3 |
| 9 | Storage (Markdown vs inne) | Analiza w kontekscie git worktrees — czy MD wystarczy | 13 |

---

## KLUCZOWE ZMIANY VS SPEC (spec-mvp-diricode.md)

| Aspekt | Spec mowil | Ankieta zmienila na |
|--------|-----------|---------------------|
| Providery MVP | Anthropic, OpenAI, DeepSeek | **Copilot** (prio 1), **Kimi** (prio 2) |
| Glowny interfejs | TUI (Ink) | **Web UI** (TUI pozniej) |
| Agenty MVP | 10+ od razu | **6 w POC 1**, git-manager w POC 2, debugger+test-runner w POC 3 |
| Priorytet budowy | Nie okreslony | **Router first** |
| Nowy agent | — | **project-builder** (guided setup z ankieta) |
| Nowy pattern | — | **Rodziny** jako formalny koncept (Family = {models[], agents[], skills[]}) |
| MCP | Czesc MVP | **Built-in toolsy w MVP**, MCP pozniej |
| Sandbox | W spec | **v2/v3** |
| GitHub Issues | Lock-in na GitHub | **Abstrakcyjny interfejs** (GitHub first, potem GitLab, Jira) |

---

## CYTATY UZYTKOWNIKA (kluczowe)

> "Koszt tokenow, niski prog uczenia - wejscia, mozliwe robienie vibe coding przez nietechnicznych projekt managerow."

> "tool umie zadawac krytyczne pytania dla osoby nie zaznajomionej. tool ma dzialac jak architekt i full stack enginner oraz zespol testerow i devopsow"

> "na ten moment wszystko zwiazane z wieloma uzytkownikami pomijamy, powrocimy do tematu w v2, lub v3, lub v4"

> "kazdy agent musi wiedziec do jakiej rodziny nalezy, modele podzielimy na rodziny"

> "uzytkownik musi miec mozliwosc pelnego wgladu w konteksty jakby chodzil po drzewie, jasno ma byc widoczne jaki agent ktore zadanie robil, jakiego modelu uzyl i stopien zagniezdzenia"

> "chce taki framework ktory mozna najlepiej wykorzystac przy wytwarzaniu kodu przez agenty ai, ktory najbardziej ai friendly"

> "nietechniczni nie beda rzezbic recznie zadnych konfigow, zrobi to diricode za ich pomoca, moze nawet agent?"

> "zakladamy, ze dispatcher moze uzywac subdispatcherow, czasami subdispatcher moze zrobic osobna git worktree jesli to konieczne"
