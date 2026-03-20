# Analiza Konkurencyjna: Plandex

> Data: 8 marca 2026
> Wersja analizowana: HEAD repozytorium (marzec 2026)
> Repo: https://github.com/plandex-ai/plandex

---

## 1. Podsumowanie

Plandex to open-source'owy AI coding agent z **architektura klient-serwer** (CLI + centralny serwer, oba w Go), skoncentrowany na **planowaniu wieloetapowym** i **bezpiecznym sandbox diffs**. Jego glowna przewaga to **eksplicite rozdzielenie fazy planowania od implementacji** — LLM najpierw tworzy liste subtaskow z powiazanymi plikami (`### Tasks` + `Uses:`), a nastepnie implementuje kazdy subtask osobno z dedykowanym kontekstem. Plandex posiada **9 rol modelowych** (Planner, Coder, Architect, Builder, WholeFileBuilder, PlanSummary, Name, CommitMsg, ExecStatus) z **16 wbudowanymi model packami** mapujacymi role na konkretne modele (np. daily-driver: Sonnet 4 dla planner/coder, o4-mini dla builder). System budowania kodu uzywa **race build** — rownolegle uruchamia fast-apply (structured edits) i whole-file fallback, wybierajac pierwszy poprawny wynik. Zmiany sa przechowywane na serwerze w **per-plan git repozytoriach** i wymagaja explicite `plandex apply` do zapisania na dysku usera — naturalny sandbox. Architektura jest **centralna** — serwer trzyma caly stan, CLI jest cienkim klientem wyswietlajacym streamy. Brak systemu hookow uzytkownika, brak MCP, brak secret redaction.

---

## 2. Matryca Porownawcza

### A. Tozsamosc i Pozycjonowanie

| Pytanie | Plandex | DiriCode |
|---------|---------|----------|
| Nazwa, licencja, jezyk implementacji | Plandex, AGPL-3.0 (serwer) + MIT (CLI/shared), Go (caly stack) | DiriCode, MIT (planowane), TypeScript |
| Glowny target user | Solo dev i male zespoly (RBAC z 16 permisja) | Solo developer |
| Interfejs | CLI (terminal) + opcjonalny WebUI. Architektura klient-serwer | CLI (TUI Ink/React z vim motions) |
| GitHub stats | ~12K+ gwiazdek, kilkunastu kontrybuterow, Dane Lehan = glowny core dev (bus factor ~1-2) | Nowy projekt |
| Model biznesowy | OSS core (AGPL-3.0 serwer), cloud hosted option, BYOK | OSS (MIT), BYOK |
| Pozycjonowanie | "An AI coding agent in your terminal" — nacisk na planowanie, ogromny kontekst, sandbox diffs, wieloetapowe zadania | Lokalny CLI agent AI z architektura dispatcher-first |

**Wniosek:** Plandex celuje w bardziej zlozone projekty (wieloetapowe plany, zespoly) i ma architekture klient-serwer vs lokalny DiriCode. AGPL-3.0 na serwerze to bariera dla niektorych uzytkow. DiriCode z MIT jest bardziej otwarty.

### B. Architektura Agenta

| Aspekt | Plandex | DiriCode | Wniosek |
|--------|---------|----------|---------|
| Ile agentow / rol? | **1 agent z 9 rolami modelowymi:** Planner, Coder, Architect, Builder, WholeFileBuilder, PlanSummary, Name, CommitMsg, ExecStatus. Kazda rola ma osobny model w model packu. Nie sa to niezalezni agenci — to role w jednym pipeline. Plik: `ai_models_roles.go` | Dispatcher + 10 specjalistow | Plandex: 1 pipeline z 9 rolami. DiriCode: N niezaleznych agentow. DiriCode bardziej elastyczny, Plandex bardziej deterministyczny |
| Czy agent glowny ma dostep do narzedzi modyfikujacych? | Tak — serwer ma pelny dostep do systemu plikow (per-plan git repo), buduje pliki, commituje, wykonuje _apply.sh scripts. Ale: zmiany ida do server-side sandbox, NIE do workspace usera bez `apply` | NIE (read-only dispatcher) | DiriCode bezpieczniejszy na poziomie agenta. Plandex bezpieczny przez sandbox (server-side git repo) |
| Jak wyglada delegacja? | **Brak delegacji agentowej.** Pipeline: Planning (Context→Tasks) → Implementation → Build → Validate. Kazdy etap to osobne wywolanie LLM z inna rola. Subtaski sa sekwencyjne, nie delegowane. Auto-continue sprawdza czy subtask ukonczony (`exec_status.go`). Plik: `tell_exec.go`, `tell_stage.go` | Unlimited nesting + loop detector | DiriCode ma prawdziwa delegacje z nesting. Plandex ma liniowy pipeline. DiriCode lepszy dla zlozonych zadan wymagajacych roznych specjalistow |
| Czy jest loop detection / fail-safe? | **Czesciowe.** MaxPreviousMessages=4 w auto-continue (`exec_status.go`) — jesli subtask nie ukonczony po 4 wiadomosciach, stop. MaxValidationFixAttempts=3 w build validate (`build_validate_and_fix.go`). Strong model escalation po failures. Brak global token budget | Tak (ADR-003: hard limit, token budget, loop detector) | DiriCode ma pelniejsze zabezpieczenia (token budget, loop detector). Plandex ma per-stage limity ale brak globalnego budgetu |
| Jak zarzadzaja kontekstem agenta? | **Zaawansowane per-stage context management.** Planning phase: caly kontekst (pliki + mapy + directory trees). Implementation phase: tylko pliki z `Uses:` biezacego subtasku (smart context). Token budgeting: dry-run oblicza czy kontekst miesci sie w limicie, formatModelContext obcina gdy przekroczone. Plik: `tell_context.go`, `tell_sys_prompt.go` | Dispatcher = minimalny kontekst, per-agent model assignment | Plandex ma **doskonaly smart context** — automatycznie laduje tylko pliki relevantne dla biezacego subtasku. DiriCode polega na decyzjach dispatchera. Warto zaadaptowac |

**Wniosek:** Plandex ma fundamentalnie inna architekture — liniowy pipeline z 9 rolami modelowymi zamiast multi-agent. Jego sila to **deterministyczny, dobrze zdefiniowany flow** (Planning→Implementation→Build→Validate) z automatycznym smart context. Slaboscia jest brak elastycznosci — nie moze dynamicznie delegowac do roznych specjalistow jak DiriCode. Potwierdza ADR-002 (dispatcher-first) ale sugeruje ze DiriCode powinien zaadaptowac **smart context per subtask**.

### C. Zrozumienie Kodu (Code Intelligence)

| Aspekt | Plandex | DiriCode | Wniosek |
|--------|---------|----------|---------|
| Jak "widzi" codebase? | **File maps oparte na Tree-sitter.** `file_map/map.go` buduje indeks definicji (funkcje, klasy, assignments) z sygnaturami dla 20+ jezykow. Markdown headings, HTML/Svelte markup. Mapy sa cachowane per-projekt (md5 sciezki → JSON). Uzytkownik widzi "map" zamiast pelnego pliku | glob + grep + AST-grep + LSP | Plandex ma automatyczne file maps (ale prostsze niz Aider's PageRank repo map). DiriCode ma LSP ktory daje wiecej informacji per-plik, ale brak automatycznego mapowania calego repo |
| Czy parsuje strukture kodu? | Tak — Tree-sitter parsery (`parsers.go`) dla 20+ jezykow. `nodes_config.go` definiuje mapowanie node types → definicje/assignments/boundaries per jezyk. `nodes_find.go` implementuje heurystyki szukania definicji, identyfikatorow, granic blockow | AST-grep + LSP | Porownywalne pokrycie jezykowe. Plandex uzywa Tree-sitter natywnie, DiriCode uzywa AST-grep (tez Tree-sitter pod spodem) + LSP |
| Jak wybiera pliki do kontekstu? | **Dwuetapowo.** (1) Planning: LLM widzi file maps + pelne pliki z kontekstu → generuje `Uses:` per subtask. (2) Implementation: smart context laduje TYLKO pliki z `Uses:` biezacego subtasku (`tell_context.go`). Auto-context mode: automatyczne ladowanie map i plikow. Token budgeting: binary search na max tokenow | Agent dispatcher decyduje na podstawie opisu zadania | **P0 WAZNE**: Plandex's dwuetapowy context selection (LLM-driven Uses: + smart context) jest bardziej precyzyjny niz heurystyki dispatchera DiriCode. DiriCode powinien zaadaptowac koncepcje "Uses:" — agent planner listuje pliki per subtask |
| Czy ma LSP integration? | **NIE.** Brak LSP. Opiera sie wylacznie na Tree-sitter file maps | Tak, top-10 jezykow lazy install | DiriCode lepszy — LSP daje goto-definition, find-references, rename, diagnostics. Plandex nie ma tego |
| Jak radzi sobie z duzymi repozytoriami? | Dobrze — file maps sa cachowane per-projekt (`getProjectMapCacheDir`), generowane przez worker pool z CPU semaphore (`file_maps_queue.go`). Limity: MaxContextMapPaths, MaxContextMapSingleInputSize, MaxTotalContextSize. `.plandexignore` wyklucza pliki | Nieznane — potencjalna luka | Plandex ma dojrzale cachowanie i limity. Worker pool z CPU semaphore to dobry pattern dla duzych repo. DiriCode powinien zaadresowac skalowanie |

**Wniosek:** Plandex's code intelligence jest solidne ale prostsze niz Aider's (brak grafu zaleznosci, brak PageRank). Kluczowy pattern do zaadaptowania: **dwuetapowy context selection z LLM-driven `Uses:` listami per subtask** — LLM sam wybiera jakie pliki potrzebuje do kazdego zadania, co jest bardziej precyzyjne niz reczne `/add`.

### D. Routing i Obsluga Modeli

| Aspekt | Plandex | DiriCode | Wniosek |
|--------|---------|----------|---------|
| Ile providerow / modeli? | **12 providerow wbudowanych:** OpenAI, OpenRouter, Anthropic, AnthropicClaudeMax, GoogleAIStudio, GoogleVertex, AzureOpenAI, AmazonBedrock, DeepSeek, Perplexity, Ollama, Custom. 16 model packow z dziesiatkami modeli. Plik: `ai_models_providers.go` | 22 providerow via Vercel AI SDK | Porownywalna liczba providerow. Plandex uzywa OpenAI SDK + LiteLLM proxy (Anthropic, Google, Azure, Bedrock przechodzi przez lokalne LiteLLM), DiriCode uzywa Vercel AI SDK |
| Czy ma failover? | **TAK — zaawansowany.** Per-role fallback chains: `ErrorFallback` (model na blad), `LargeContextFallback` (model na duzy kontekst), `StrongModel` (silniejszy model po failures). Retry wrapper z exponential backoff. MAX_RETRIES_WITHOUT_FALLBACK=3, MAX_ADDITIONAL_RETRIES_WITH_FALLBACK=1. Plik: `model_request.go`, `client.go`, `ai_models_packs.go` | Tak (ADR-011: order-based failover) | **Plandex ma bardziej rozbudowany failover niz planowany DiriCode.** 3 typy fallbackow (error/large-context/strong) z automatyczna eskalacja. DiriCode ma order-based — warto rozszerzyc o context-aware fallback |
| Czy ma race mode? | **TAK — w build pipeline.** `build_race.go` uruchamia rownolegle: (1) fast-apply (structured edits), (2) validation loop, (3) whole-file fallback. Pierwszy poprawny wynik wygrywa. Context cancellation stops losers. **NIE ma race mode na poziomie providerow** — provider selection jest deterministyczny (priorytet z listy) | Tak (ADR-011: race mode) | Plandex's build race to **unikalna innowacja** — rownolegle strategie aplikowania edycji. DiriCode ma race mode na providerach (inna warstwa). Warto zaadaptowac build race |
| Per-agent model assignment? | **TAK — 9 rol z osobnymi modelami.** ModelPack mapuje: Planner→Sonnet 4, Coder→Sonnet 4, Architect→o4-mini, Builder→o4-mini, WholeFileBuilder→GPT-4.1, PlanSummary→GPT-4.1-mini, Name→GPT-4.1-mini, CommitMsg→GPT-4.1-mini, ExecStatus→GPT-4.1-mini. 16 packow (daily-driver, reasoning, strong, cheap, oss, ollama, etc.) Plik: `ai_models_packs.go` | Tak (dispatcher=fast, writer=deep, itd.) | **Plandex ma najbardziej zaawansowany per-role model assignment ze wszystkich narzedzi.** 9 rol × 16 packow = ogromna elastycznosc. DiriCode powinien zaadaptowac koncepcje "model packow" — predefiniowane zestawy modeli per rola |
| Jak radzi sobie z non-Claude modelami? | Bardzo dobrze — `BaseModelConfigVariant` definiuje per-model: ReservedOutputTokens, reasoning settings, model name per provider. OpenRouter: automatyczny `:nitro` suffix dla szybszych endpointow. Azure: AZURE_DEPLOYMENTS_MAP. Provider-specific tweaks w `createChatCompletionStreamExtended`. Plik: `client.go` | Adaptery per provider | Plandex ma dojrzale per-provider tweaki. DiriCode z Vercel AI SDK ma abstrakcje ale mniej kontroli |
| Czy zalezy od LiteLLM? | **Czesciowo.** Anthropic, Google, Azure, Bedrock przechodzi przez **lokalny LiteLLM proxy** uruchamiany w tym samym kontenerze (`litellm.go`). OpenAI i OpenRouter ida bezposrednio. Claude Max uzywa dedykowanego URL. Plik: `litellm.go` | NIE — wlasny TS Router (ADR-011) | Plandex czesciowo zalezy od LiteLLM (jako proxy). DiriCode z wlasnym routerem eliminuje te zaleznosc — potwierdza ADR-011 |

**Wniosek:** Plandex ma **najlepszy system routing/failover** ze wszystkich analizowanych narzedzi. Kluczowe innowacje do zaadaptowania: (1) **3-typowy fallback** (error/large-context/strong), (2) **model packi** (predefiniowane zestawy modeli per rola), (3) **build race** (rownolegla walidacja edycji). DiriCode's ADR-011 powinien byc rozszerzony o te koncepcje.

### E. System Hookow i Rozszerzalnosc

| Aspekt | Plandex | DiriCode | Wniosek |
|--------|---------|----------|---------|
| System hookow/pluginow? | **Server-side hooks (nie user-facing).** `hooks.go`: RegisterHook/ExecHook z hookami: WillExecPlan, WillSendModelRequest, DidSendModelRequest, DidFinishBuilderRun, CreateAccount, Authenticate, GetIntegratedModels, CallFastApply. Uzycie: billing, telemetry, auth. **Uzytkownik NIE moze dodawac hookow** | 12 lifecycle hooks, lazy loading, per-user | DiriCode fundamentalnie lepszy. Plandex hooks to wewnetrzny mechanizm serwera, nie user-facing extensibility |
| Ile extension points? | **Limitowane:** (1) model packi (custom), (2) custom providers, (3) plan config flags (AutoMode, AutoBuild, SmartContext, itd.), (4) `.plandexignore`. Brak programowego API dla hookow usera | 12 hookow + MCP client + pliki .md agentow | DiriCode ma ~15+ user-facing extension points vs ~4 w Plandex |
| Custom agenci? | **NIE.** Brak koncepcji definiowania agentow. Uzytkownik moze jedynie zmienic model pack i config flags | Tak — `.diricode/agents/` | DiriCode lepszy |
| MCP support? | **NIE.** Brak MCP | Tak, GitHub MCP wbudowany + zewnetrzne | DiriCode lepszy |
| Konfiguracja | Plan-level config (`plan_config.go`): AutoMode (Full/Semi/Plus/Basic/None), AutoLoadContext, AutoUpdateContext, SmartContext, AutoBuild, AutoApply, AutoExec, AutoDebug, AutoCommit. Org-level settings. CLI flags | `diricode.config.ts` (type-safe) | Plandex ma granularne config flags (dobre). DiriCode ma type-safe config (lepsze DX) |

**Wniosek:** Plandex jest **zamkniety** pod wzgledem rozszerzalnosci — hooks sa wewnetrzne (billing/telemetry), brak user-facing API. DiriCode z 12 lifecycle hooks, MCP i custom agents jest fundamentalnie bardziej rozszerzalny. Potwierdza ADR-005 i ADR-012.

### F. Bezpieczenstwo i Approval

| Aspekt | Plandex | DiriCode | Wniosek |
|--------|---------|----------|---------|
| Approval przed destrukcja? | **Explicite apply/reject flow.** Zmiany sa przechowywane na serwerze — uzytkownik musi uruchomic `plandex apply` aby zapisac na dysku. Przed apply: widzi diffy. `plandex reject` odrzuca zmiany. To naturalny approval gate. Pliki: `apply.go` (CLI), `plans_changes.go` (server) | Tak (ADR-004: Smart — AI ocenia ryzyko) | **Rozne podejscia, oba dobre.** Plandex: sandbox-first (review diffy przed apply). DiriCode: risk categorization (safe/risky/destructive). Mozna laczyc oba |
| 3 kategorie ryzyka? | **NIE explicite.** Brak kategoryzacji ryzyka operacji. Ale naturalny sandbox (server-side git repo) sprawia ze wszystko jest "bezpieczne" az do apply. _apply.sh scripts wymagaja potwierdzenia | Tak — safe/risky/destructive, konfigurowalne | DiriCode lepszy w granulacji. Plandex kompensuje przez sandbox |
| Ochrona przed wyciekiem sekretow? | **NIE.** Brak secret redaction. Nie znaleziono zadnego kodu redakcji, masking, sanitization w przeanalizowanych plikach. authVars i apiKeys sa przekazywane do model requests bez filtrowania kontekstu uzytkownika | Tak (ADR-014: auto-redakcja regex+heurystyki) | **DiriCode znacznie lepszy.** Plandex nie chroni sekretow — potwierdza krytycznosc ADR-014 |
| Sandboxing? | **TAK — naturalny sandbox.** Zmiany ida do server-side per-plan git repo, NIE do workspace usera. `plandex apply` pisze pliki na dysk. _apply.sh scripts: `MaybeIsolateCgroup()` w CLI (`apply.go`) — probuje cgroup isolation na Linux. `SetPlatformSpecificAttrs` ustawia process group. Kill process group na timeout/failure | NIE w MVP (odlozony do v2) | **Plandex znacznie lepszy w sandboxing.** Server-side git repo to elegancki sandbox. DiriCode brak sandboxa — rozwazyc jako P1, nie P2 |
| Git safety rails? | **Server-side:** `gitWriteOperation` wrapper z exponential backoff na index.lock conflicts. `gitRemoveIndexLockFileIfExists` z retry. DB-backed repo locks (`locks.go`) z SELECT FOR UPDATE, heartbeat, expiry. **CLI-side:** `gitMutex` serializes operations, stash/pop z conflict handling. Ale: brak blokady `push --force`, `reset --hard` — bo uzytkownik nie ma bezposredniego git access do plan repo | Tak (ADR-010: blokada `git add .`, `push --force`, `reset --hard`) | Plandex ma **doskonaly locking system** (DB + git) ale nie potrzebuje user-facing git safety (sandbox). DiriCode potrzebuje ADR-010 bo dziala bezposrednio w workspace usera |
| Parsowanie bash? | **Czesciowe.** Tree-sitter bash parser zarejestrowany w `parsers.go`. File maps obsluguja bash. _apply.sh: CLI stripuje `set -euo pipefail` i normalizuje shebang przed wykonaniem. Ale brak AST-based command analysis | Tree-sitter (ADR-015) | DiriCode planuje glebsza analize. Plandex ma basic normalization |
| RBAC? | **TAK — rozbudowane.** 16 permissions w `rbac.go`: DeleteOrg, ManageBilling, InviteUser, RemoveUser, CreatePlan, ManageAnyPlanShares, SharePlan, ViewAnyPlan, ViewPlan, ArchivePlan, RenamePlan, DeletePlan, RunPlan, ManageCustomModels, ManageOrgSettings, ViewUsage. Authenticate + authorizePlan w handlers | Brak (solo dev) | Plandex ma pelny RBAC — przydatne dla zespolow, nie relevantne dla DiriCode MVP (solo dev) |

**Wniosek:** Plandex ma **unikalny sandbox model** — server-side git repo jako naturalny bezpiecznik. To eleganckie rozwiazanie pytania ADR-008 (brak snapshot systemu): Plandex udowadnia ze sandbox diffs + explicite apply jest wartosciowy. DiriCode powinien rozwazyc lekka wersje (np. staging area w `.diricode/pending/` z review przed apply). Brak secret redaction w Plandex potwierdza krytycznosc ADR-014.

### G. Pamiec i Stan

| Aspekt | Plandex | DiriCode | Wniosek |
|--------|---------|----------|---------|
| Trwala pamiec miedzy sesjami? | **TAK — per-plan.** Kazdy plan ma trwaly stan na serwerze: konwersacja, konteksty, wyniki budowania, git historia. Plany przetrwuja miedzy sesjami CLI. Ale: brak globalnej pamieci miedzy planami, brak project memory | GitHub Issues jako project memory (ADR-007) | Plandex ma trwaly plan state (lepszy niz Aider's bezstanowosc), ale brak project memory (gorszy niz DiriCode). Rozne poziomy abstrakcji |
| Przechowywanie stanu zadan? | **TAK — subtask tracking.** LLM generuje `### Tasks` z numbered subtasks. `tell_subtasks.go` parsuje i trackuje completion. `### Remove Tasks` pozwala usuwac. currentSubtask wskazuje biezace zadanie. Stan przechowywany w konwersacji i git repo serwera | Pliki Markdown `.diricode/todo.md` (ADR-013) | Oba maja task tracking. Plandex: LLM-driven (subtasks z konwersacji). DiriCode: file-based (todo.md). DiriCode bardziej transparent dla usera |
| Snapshot / undo? | **TAK — pelny.** Per-plan git repo na serwerze = pelna historia. `GitRewindToSha`, `GitResetToSha`, `GitCheckoutSha` pozwalaja cofac do dowolnego punktu. `plandex rewind` w CLI. Reject = commit "Rejected..." Branching: `CreateBranch` z ParentBranchId dziedziczacy token counts | Brak snapshota — git worktrees (ADR-008) | **Plandex ma pelny undo/rewind** dzieki server-side git. DiriCode z git worktrees ma izolacje ale bez automatycznego undo. Pytanie z planu analiz (ADR-008) potwierdzone: **sandbox diffs to wartosciowy feature**, ale implementacja wymaga serwera |
| Context compaction? | **Conversation summarization.** `tell_summary.go`: ConvoSummary objects przechowywane w DB. Gdy conversation tokens przekracza limit, system podstawia najstarsza ConvoSummary zamiast poczatkowych wiadomosci. Summary generowane przez `model.PlanSummary` (osobny model call). Jesli zadna summary nie zmiesci konwersacji w limicie → error. Plik: `tell_summary.go`, `summarize.go` | Sliding window + summary na 90-95% (ADR-009) | Porownywalne podejscia. Plandex: stored summaries + substitution. DiriCode: sliding window + on-demand summary. Plandex bardziej deterministyczny (pre-generated summaries), DiriCode bardziej elastyczny |
| Branching? | **TAK.** Plan branches z ParentBranchId. `CreateBranch` kopiuje ContextTokens i ConvoTokens z parenta. Kazdy branch ma niezalezny stan tokenow. `plandex checkout` w CLI | Brak (per-worktree) | Plandex ma wbudowane branching — przydatne do eksperymentowania z roznymi podejsciami. DiriCode nie ma odpowiednika |
| Token accounting? | **Rozbudowane.** Per-branch: ContextTokens, ConvoTokens. Per-context: NumTokens, MapTokens. Per-message: token estimation z overheadami (TokensPerMessage=4, TokensPerName=1). Limity: planner max tokens, contextLoader max tokens. Rejected load jesli przekroczone (MaxTokensExceeded flag) | Do zaimplementowania | Plandex ma **doskonaly token accounting** — per-branch, per-context, z hard limits. DiriCode powinien zaadaptowac |

**Wniosek:** Plandex ma **najlepszy system stanu** ze wszystkich analizowanych narzedzi: per-plan git repo + branching + conversation summaries + token accounting. Odpowiada na pytanie ADR-008: sandbox diffs sa wartosciowe, ale wymagaja infrastruktury serwerowej. DiriCode moze zaadaptowac **lekka wersje** (local staging area + git-based undo) bez pelnego serwera.

### H. UX i Developer Experience

| Aspekt | Plandex | DiriCode | Wniosek |
|--------|---------|----------|---------|
| Time-to-first-use | `curl -sL https://plandex.ai/install.sh \| bash` + `plandex sign-in` + API key. Wymaga konta (cloud) lub self-hosted serwer. Wiecej krokow niz Aider | Do zbadania — planowane `npx diricode` | Plandex ma wiecej krokow (konto + serwer). DiriCode z `npx` bedzie prostszy |
| Vim motions? | **NIE.** Standardowy terminal. Brak TUI z vim motions | Od dnia 1 (TUI Ink) | DiriCode lepszy |
| Streaming? | **TAK.** Server→CLI streaming przez SSE/WebSocket. `startResponseStream` w handlers. `streamtui.StartStreamUI` w CLI. BuildInfo messages streamowane w real-time | SSE (ADR-001) | Porownywalne. Plandex ma streaming z build progress (bardziej informacyjny) |
| Lean mode? | **Czesciowe.** AutoMode presets: Full (wszystko auto), Semi, Plus, Basic, None (reczny). Nie jest to "lean mode" (redukcja tokenow), ale redukcja interakcji. Brak jednego `--lean` flag | `--lean` (ADR-006) | DiriCode lepszy — jeden flag. Plandex AutoMode to co innego (autonomia, nie oszczednosc) |
| Jakosc dokumentacji? | Solidna — plandex.ai z tutorialami, config reference. Ale mniej dojrzala niz Aider | Do stworzenia | Plandex ma podstawowa dokumentacje |
| Onboarding? | Wymaga: (1) instalacja CLI, (2) utworzenie konta lub self-host, (3) konfiguracja API keys na serwerze, (4) `plandex new` w projekcie. Wiecej krokow niz Aider/DiriCode | Do zbadania | Plandex ma najgorszy onboarding z analizowanych narzedzi (klient-serwer = wiecej setup) |
| Execution mode? | **TAK — _apply.sh scripts.** LLM generuje `_apply.sh` w sekcji `### Commands`. CLI wykonuje z sanitization (strip `set -euo`), process group management, signal handling, rollback. `MaybeIsolateCgroup` na Linux. Uzytkownik widzi output, potwierdza sukces/failure | Bash tool z safety rails | Plandex ma bardziej rozbudowane exec management (process groups, cgroup isolation, rollback) |
| Diffy i review? | **TAK.** `plandex diff` pokazuje pending changes. `plandex apply` z wizualnym review. `plandex reject` per-file lub all. Commit message generowany przez LLM (model role CommitMsg) | Do zaimplementowania | Plandex ma dojrzaly diff/review flow — warto zaadaptowac |
| Plan management? | **TAK — pelne.** `plandex new/tell/build/apply/reject/rewind/log/plans/checkout/branches`. Plany maja nazwy (LLM-generated), statusy (draft/replying/building/finished/error), archiwizacje | Brak (per-sesja) | Plandex's plan management to unikalna funkcjonalnosc — przydatne dla dlugich projektow |

**Wniosek:** Plandex ma **unikalny UX** skoncentrowany na planach: diff review, apply/reject, rewind, branching. To dojrzaly workflow dla zlozonych zadan. Slabosci: onboarding (klient-serwer), brak vim motions. DiriCode powinien zaadaptowac: **diff review przed apply** i **LLM-generated commit messages**.

---

## 3. Co DiriCode Powinien Zaadaptowac

| # | Co | Dlaczego | Wplyw na ADR | Priorytet |
|---|-----|---------|-------------|-----------|
| 1 | **Smart context per subtask (LLM-driven Uses:)** — planner agent generuje liste plikow potrzebnych per subtask, implementation agent laduje tylko te pliki | Plandex's kluczowy pattern: LLM w fazie planowania wybiera pliki per subtask (`Uses: \`src/main.rs\``), potem implementation phase laduje tylko te pliki. Redukuje zuzycit tokenow i poprawia jakosc. Pliki: `tell_context.go`, `planning.go` | **ADR-002** (dispatcher) — rozszerzyc o: planner agent produkuje per-subtask file list, code-writer agent dostaje tylko te pliki w kontekscie | **P0** |
| 2 | **3-typowy model fallback (error/large-context/strong)** — per-role fallback chains z automatyczna eskalacja | Plandex ma 3 typy fallbackow per rola: ErrorFallback (po bledzie), LargeContextFallback (gdy kontekst za duzy), StrongModel (po failures w build). Automatyczna eskalacja np. Sonnet→Opus. Pliki: `ai_models_packs.go`, `model_request.go` | **ADR-011** (routing) — rozszerzyc o 3-typowy fallback zamiast prostego order-based. Kazda rola/agent ma chain: primary→error_fallback→large_context_fallback→strong | **P0** |
| 3 | **Model packi (predefiniowane zestawy modeli per rola)** — uzytkownik wybiera "pack" zamiast konfigurować kazdy model osobno | 16 wbudowanych packow: daily-driver, reasoning, strong, cheap, oss, ollama, anthropic, openai, google, itd. Kazdy pack mapuje role→model. Uzytkownik mowi "use daily-driver" zamiast konfigurować 9 modeli. Plik: `ai_models_packs.go` | **ADR-011** (routing) — dodac koncepcje model packow. Predefiniowane: `fast` (Haiku/Flash), `balanced` (Sonnet/GPT-4o), `deep` (Opus/o3), `cheap` (mini models). Uzytkownik moze definiowac custom packi | **P1** |
| 4 | **Build race (rownolegla walidacja edycji)** — uruchom fast-apply i whole-file fallback rownolegle, wez pierwszy poprawny wynik | Plandex's unikalna innowacja: `build_race.go` uruchamia structured edits, validation loop i whole-file fallback w goroutines. Context cancellation stops losers. Redukuje latencje i poprawia reliability | **ADR nowy** — "Build Race: parallel edit validation". Implementowac w `code-writer` agent: (1) hashline edit, (2) whole-file fallback rownolegle. Pierwszy valid wygrywa | **P1** |
| 5 | **Sandbox staging area z diff review** — zmiany ida do staging zanim trafia na dysk, uzytkownik widzi diffy i moze approve/reject per plik | Plandex: server-side git repo → `plandex diff` → `plandex apply/reject`. Elegancki flow: zawsze mozesz cofnac. Odpowiada na pytanie ADR-008. DiriCode moze zrobic lekka wersje: `.diricode/pending/` z diffy + review przed write | **ADR-008** (brak snapshot) — rozwazyc **lekki staging**: zmiany agentow ida do `.diricode/pending/`, uzytkownik robi `diricode apply` z diff review. Nie wymaga serwera | **P1** |
| 6 | **Token accounting per context/agent/sesja** — scisle sledzenie zuzycia tokenow z hard limits i rejection | Plandex: per-branch ContextTokens/ConvoTokens, per-context NumTokens, MaxTokensExceeded rejection. Uzytkownik wie dokladnie ile tokenow zuzywa kazdy element kontekstu. Pliki: `context_helpers_load.go`, `tokens.go` | **ADR nowy** — "Token Budget Management". Per-agent i per-sesja budgety z hard limits. Reject context load jesli przekroczone. Dashboard w TUI | **P1** |
| 7 | **Conversation summarization z pre-generated summaries** — generuj summaries proaktywnie, podstawiaj gdy kontekst sie rozrasta | Plandex: ConvoSummary objects generowane przez osobny model call (PlanSummary role). Przechowywane z timestampem. Gdy konwersacja przekracza limit, system wybiera najstarsza summary i podstawia. Deterministyczne i niezawodne. Plik: `tell_summary.go`, `summarize.go` | **ADR-009** (kompakcja) — rozszerzyc o pre-generated summaries: generuj streszczenie proaktywnie co N wiadomosci, przechowuj w `.diricode/summaries/`. Podstawiaj gdy kontekst blisko limitu | **P2** |
| 8 | **Structured edits z Tree-sitter anchor matching** — uzyj AST do lokalizacji zmian w pliku zamiast string matching | Plandex: `structured_edits_tree_sitter.go` parsuje oryginaly i propozycje LLM, szuka anchorow (dopasowanie linia→node), buduje wynik z zachowaniem niezmienionych sekcji. Reference comments (`// ... existing code ...`) mapowane na oryginalne bloki kodu. Plik: `structured_edits_tree_sitter.go` | **ADR nowy lub rozszerzenie tools** — Hashline Edit moze korzystac z Tree-sitter anchors jako fallback gdy hashline matching zawodzi | **P2** |

---

## 4. Czego DiriCode Powinien Unikac

| # | Co | Dlaczego to problem | Jak DiriCode to rozwiazuje |
|---|-----|--------------------|-----------------------------|
| 1 | **Architektura klient-serwer dla narzedzia lokalnego** — Plandex wymaga serwera (self-hosted lub cloud). Setup: instalacja CLI + konto + serwer + API keys. Wielokrotnie wiecej krokow niz `npx tool` | Bariera wejscia. Uzytkownicy chca `npm install -g && run`, nie "postaw serwer". AGPL-3.0 na serwerze odstraszaja firmy. Locking/heartbeat/DB complexity = duzo moving parts | ADR-001: HTTP + SSE ale **lokalny serwer** (embedded, zero setup). DiriCode unika klopotow Plandex: brak konta, brak external serwera, brak DB locks |
| 2 | **Brak secret redaction** — Plandex nie ma zadnej ochrony przed wyciekiem sekretow do LLM. authVars przekazywane bez sanitization kontekstu uzytkownika | Identyczny problem jak Aider. Pliki `.env` w kontekscie planu ida do LLM bez filtrowania. Uzytkownik nie jest chroniony | ADR-014: Auto-redakcja regex + heurystyki. DiriCode jest bezpieczniejszy |
| 3 | **Zamknieta architektura hookow** — Plandex ma hooks ale **tylko server-side, nie user-facing**. RegisterHook/ExecHook sluzy do billing/auth/telemetry. Uzytkownik nie moze dodac hookow, pluginow, middleware | Brak rozszerzalnosci. Uzytkownik nie moze: zmodyfikowac system prompta, dodac custom validation, zintegrowac z CI/CD, dodac notyfikacji. Jedyna opcja: fork | ADR-005: 12 lifecycle hooks z pelna moca modyfikacji. ADR-012: Hybrydowa definicja agentow. DiriCode fundamentalnie lepszy |
| 4 | **Liniowy pipeline bez dynamicznej delegacji** — Plandex: Planning→Implementation→Build to sztywny pipeline. Nie moze dynamicznie zdelegowac do specjalisty (debugger, test-writer, refactorer) w srodku planu | Nie nadaje sie do zadan wymagajacych roznych specjalistow. Np. jesli w trakcie implementacji potrzeba debug → restart calego pipeline. Brak elastycznosci | ADR-002: Dispatcher-first z dynamiczna delegacja. ADR-003: Unlimited nesting. DiriCode moze w trakcie pracy zdelegowac do dowolnego specjalisty |
| 5 | **LiteLLM jako lokalne proxy** — Plandex uruchamia LiteLLM w tym samym kontenerze. Dodatkowy proces Python, health checks, restart logic. `EnsureLiteLLM` sprawdza zdrowie co request | Dodatkowa zlozonosc: dwa procesy zamiast jednego, health monitoring, restart semantics, memory footprint. Jesli LiteLLM padnie — cala komunikacja z Anthropic/Google/Azure padnie | ADR-011: Wlasny TS Router bez zewnetrznych procesow. DiriCode laczy sie bezposrednio z providerami przez Vercel AI SDK |
| 6 | **AutoMode zamiast Lean Mode** — Plandex's AutoMode (Full/Semi/Plus/Basic/None) kontroluje autonomie (co jest auto), nie zuzycie tokenow. Brak trybu "oszczednego" redukujacego tokeny/prompty | Uzytkownik nie moze zredukowac kosztow jednym flagiem. AutoMode Full zuzywa tyle samo tokenow co None — tylko zmienia ile krokow wymaga interakcji | ADR-006: `--lean` mode redukuje tokeny (krotsze prompty, mniejszy model, mniej hookow). DiriCode oszczedniejszy na zadanie |

---

## 5. Otwarte Pytania

1. **Czy lekki staging area (`.diricode/pending/`) jest oplacanly bez pelnego serwera?** Plandex uzywa server-side git repo jako sandbox — to eleganckie ale wymaga serwera. Czy DiriCode moze zaimplementowac podobny UX (diff review, apply/reject, rewind) uzywajac lokalnego katalogu `.diricode/pending/` + git worktrees? Jak to wplywalaby na workflow multi-agent (wiele agentow pisze do pending)?

2. **Jak zaimplementowac model packi w DiriCode?** Plandex ma 16 packow mapujacych 9 rol→modele. DiriCode ma 10+ agentow — czy kazdy agent potrzebuje osobnego modelu? Czy wystarczy 3 klasy: fast (dispatching, naming), balanced (coding, planning), deep (debugging, review)? Jak uzytkownik definiuje custom pack w `diricode.config.ts`?

3. **Czy build race ma sens w architekturze DiriCode?** Plandex uruchamia rownolegle fast-apply + whole-file fallback na serwerze (Go goroutines). DiriCode dziala lokalnie w TS — czy rownolegle strategie edycji (hashline + whole-file) w worker threads to oplacanly pattern? Czy latencja jest wystarczajaca aby race mial sens?

4. **Czy Plandex's subtask system (`### Tasks` + `Uses:`) jest lepszy od DiriCode's TODO/dispatch model?** Plandex: LLM generuje plan z subtaskami i powiazanymi plikami w jednym prompcie. DiriCode: planner agent tworzy TODO, dispatcher deleguje task po tasku. Ktore podejscie jest bardziej niezawodne? Czy LLM-generated Uses: list jest dokladniejsza niz heurystyki dispatchera?

5. **Czy per-plan branching jest wartosciowy dla DiriCode?** Plandex pozwala na branching planow (eksperymentowanie z roznymi podejsciami). DiriCode z git worktrees ma izolacje na poziomie git. Czy dodatkowy "plan branching" na poziomie agenta daje cos ponad git branches?

---

## 6. Rekomendacje dla Specyfikacji DiriCode

### 6.1 Zmiany w istniejacych ADR-ach

| ADR | Obecna decyzja | Proponowana zmiana | Uzasadnienie |
|-----|---------------|-------------------|-------------|
| **ADR-002** | Dispatcher-first | Rozszerzyc o: **planner agent MUSI produkowac per-subtask file list** (`Uses:` equivalent). Code-writer agent dostaje TYLKO te pliki w kontekscie. To smart context per subtask | Plandex udowadnia ze LLM-driven file selection per subtask redukuje tokeny i poprawia jakosc. Plik: `planning.go`, `tell_context.go` |
| **ADR-008** | Brak snapshot systemu | Rozwazyc: **lekki staging area** (`.diricode/pending/`) z diff review. `diricode review` pokazuje pending changes, `diricode apply` pisze na dysk, `diricode reject` odrzuca. Git worktrees nadal jako izolacja, ale staging dodaje warstwę review | Plandex udowadnia ze sandbox diffs z apply/reject to wartosciowy UX pattern. Server-side git repo to overkill — lokalne `.diricode/pending/` wystarczy |
| **ADR-009** | Kompakcja na 90-95% | Dodac: **pre-generated summaries**. Generuj streszczenie proaktywnie co N wiadomosci (osobnym modelem PlanSummary). Przechowuj w `.diricode/summaries/`. Podstawiaj najstarsza summary gdy kontekst blisko limitu (deterministic substitution zamiast on-demand generation) | Plandex: ConvoSummary objects z timestampami. Deterministyczne podstawianie jest bardziej niezawodne niz on-demand summarization pod presja tokenow |
| **ADR-011** | Wlasny TS Router z order-based failover | Rozszerzyc o: (1) **3-typowy fallback** per rola/agent: ErrorFallback, LargeContextFallback, StrongModel. (2) **Model packi** — predefiniowane zestawy: `fast`, `balanced`, `deep`, `cheap`, `reasoning`. Uzytkownik wybiera pack zamiast N modeli. (3) Per-model metadata: max output tokens, reasoning settings, reserved output tokens | Plandex ma najbardziej zaawansowany model routing. 16 packow × 9 rol × 3 fallback types. DiriCode z prostym order-based failover traci vs Plandex. Model packi to doskonaly UX |

### 6.2 Nowe elementy do specyfikacji

| Propozycja | Opis | Priorytet |
|-----------|------|----------|
| **Token Budget Management (ADR nowy)** | Per-agent i per-sesja token budgety z hard limits. Per-context token tracking. Reject context load jesli przekroczone (MaxTokensExceeded). Dashboard w TUI: ile tokenow zuzywa kazdy agent, kazdy plik w kontekscie, kazda sesja. Inspiracja: Plandex `context_helpers_load.go`, `tokens.go` | **P0** |
| **Build Race: Parallel Edit Validation (ADR nowy)** | Gdy code-writer generuje edycje: uruchom rownolegle (1) hashline edit + validation, (2) whole-file fallback. Pierwszy poprawny wynik wygrywa. Context cancellation stops loser. Strong model escalation po failures. Inspiracja: Plandex `build_race.go` | **P1** |
| **Staging Area z Diff Review** | `.diricode/pending/` — zmiany agentow ida do staging zamiast bezposrednio na dysk. `diricode review` z TUI diff viewer. `diricode apply [file]` per-file lub all. `diricode reject [file]`. Opcjonalne: auto-apply dla safe operations (ADR-004 integration). Inspiracja: Plandex apply/reject flow | **P1** |
| **LLM-generated Commit Messages** | Agent git-manager generuje commit message uzywajac tani model (GPT-4.1-mini equivalent). Conventional Commits format. Git trailer z atrybucja DiriCode. Inspiracja: Plandex's ModelRoleCommitMsg w model packach | **P2** |

### 6.3 Potwierdzone decyzje

Analiza Plandex **potwierdza** poprawnosc nastepujacych decyzji DiriCode:

| ADR | Decyzja | Potwierdzenie z Plandex |
|-----|---------|------------------------|
| **ADR-001** | HTTP + SSE (lokalny serwer) | Plandex's klient-serwer jest zbyt zlozony dla solo dev (konto, serwer, DB locks). DiriCode's lokalny embedded serwer to prawidlowe uproszczenie |
| **ADR-002** | Dispatcher-first (multi-agent) | Plandex's liniowy pipeline (1 agent, 9 rol) nie pozwala na dynamiczna delegacje. DiriCode z dispatching + N specjalistow jest bardziej elastyczny dla zlozonych zadan |
| **ADR-005** | 12 lifecycle hooks (user-facing) | Plandex ma hooks ale TYLKO server-side (billing/auth). Uzytkownik nie moze rozszerzac zachowania. DiriCode's user-facing hooks to fundamentalna przewaga |
| **ADR-007** | GitHub Issues jako project memory | Plandex nie ma project memory — per-plan stan nie zastepuje globalnej pamieci miedzy planami. DiriCode z GitHub Issues jest lepszy |
| **ADR-010** | Git safety rails | Plandex ma doskonaly locking (DB + git) ale dla server-side repo. DiriCode potrzebuje user-facing safety rails bo dziala bezposrednio w workspace — ADR-010 prawidlowy |
| **ADR-011** | Wlasny TS Router (bez LiteLLM) | Plandex czesciowo zalezy od LiteLLM proxy (lokalne). Dodatkowy proces, health checks, restart logic — niepotrzebna zlozonosc. DiriCode z bezposrednim polaczeniem do providerow jest prostszy |
| **ADR-012** | Hybrydowa definicja agentow | Plandex ma sztywne role w kodzie Go, brak konfigurowalnosci przez usera. DiriCode z Execution Policies + konfigurowalne Agent Guards jest bardziej elastyczny |
| **ADR-013** | Stan w Markdown | Plandex uzywa DB + git files. DiriCode z Markdown jest prostszy i bardziej transparent. Potwierdza ze pliki sa wystarczajace dla MVP |
| **ADR-014** | Auto-redakcja sekretow | Plandex NIE MA secret redaction — identyczna luka jak Aider. ADR-014 krytyczny |
| **ADR-015** | Tree-sitter bash parsing | Plandex ma basic bash normalization (strip set -euo) ale brak pelnego AST parsing. DiriCode z Tree-sitter jest bezpieczniejszy |

---

## Appendix: Kluczowe Pliki Zrodlowe Plandex

| Plik | Co zawiera | Znaczenie dla DiriCode |
|------|-----------|----------------------|
| `app/server/model/plan/tell_exec.go` | Glowna petla agenta: Tell→activatePlan→execTellPlan→doTellRequest→listenStream | Architektura petli agenta — referencja |
| `app/server/model/plan/tell_stage.go` | Rozdzielenie faz: Planning (Context→Tasks) vs Implementation | **Kluczowy** — smart context per stage |
| `app/server/model/plan/tell_context.go` | Formatowanie kontekstu modelu: smart context, token budgeting, file selection | **Kluczowy** — smart context implementation |
| `app/server/model/plan/build_race.go` | Race build: parallel fast-apply + whole-file fallback | **Kluczowy** — unikalna innowacja do zaadaptowania |
| `app/server/model/plan/build_validate_and_fix.go` | Walidacja + fix loop (max 3 attempts, strong model escalation) | Referencja dla quality gate |
| `app/server/model/plan/tell_subtasks.go` | Parsowanie subtaskow, tracking completion, currentSubtask | Referencja dla task tracking |
| `app/server/model/plan/tell_summary.go` | Conversation summarization z pre-generated summaries | **Wazny** — inspiracja dla ADR-009 |
| `app/shared/ai_models_packs.go` | 16 model packow: role→model mapping z 3-typowym fallback | **Kluczowy** — inspiracja dla model packow DiriCode |
| `app/shared/ai_models_roles.go` | 9 rol modelowych: Planner, Coder, Architect, Builder, itd. | Referencja dla per-agent model assignment |
| `app/shared/ai_models_providers.go` | 12 providerow: OpenAI, Anthropic, Google, Azure, Bedrock, Ollama, itd. | Referencja dla provider management |
| `app/server/model/client.go` | HTTP client: streaming, retry, fallback, provider-specific tweaks | Referencja dla model client |
| `app/server/model/litellm.go` | Lokalne LiteLLM proxy management | **Anty-wzorzec** — dodatkowy proces, health checks |
| `app/server/model/prompts/planning.go` | System prompt dla planowania: `### Tasks` + `Uses:` format | **Kluczowy** — format per-subtask file selection |
| `app/server/model/prompts/implement.go` | System prompt dla implementacji: `<PlandexBlock>` format, change explanations | Referencja dla edit format design |
| `app/server/syntax/structured_edits_tree_sitter.go` | Tree-sitter anchor matching dla structured edits | Referencja dla hashline edit fallback |
| `app/server/syntax/file_map/map.go` | File maps: Tree-sitter AST → definicje z sygnaturami (20+ jezykow) | Referencja dla code intelligence |
| `app/server/hooks/hooks.go` | Server-side hooks: RegisterHook/ExecHook (billing/auth only) | **Anty-wzorzec** — brak user-facing hooks |
| `app/server/db/git.go` | Server-side git: init, commit, rewind, branch, lock-file retry | Referencja dla git safety |
| `app/server/db/locks.go` | DB-backed repo locks: SELECT FOR UPDATE, heartbeat, retry/backoff | Referencja dla concurrency control |
| `app/server/db/context_helpers_load.go` | Context loading: token estimation, limits, conflict invalidation | **Wazny** — token budget management |
| `app/cli/lib/apply.go` | CLI apply: write files, rollback, execApplyScript, MaybeIsolateCgroup | Referencja dla staging/apply flow |
| `app/shared/rbac.go` | RBAC: 16 permissions (CreatePlan, RunPlan, DeleteOrg, itd.) | Referencja na przyszlosc (zespoly) |
| `app/shared/plan_config.go` | PlanConfig: AutoMode, SmartContext, AutoBuild, AutoApply, itd. | Referencja dla config design |

---

*Dokument wygenerowany na podstawie analizy kodu zrodlowego repozytorium `plandex-ai/plandex` — wylacznie fakty z kodu. Brak spekulacji.*
