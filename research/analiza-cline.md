# Analiza Konkurencyjna: Cline

> Data: 8 marca 2026
> Wersja analizowana: HEAD repozytorium (marzec 2026)
> Repo: https://github.com/cline/cline

---

## 1. Podsumowanie

Cline to open-source'owe rozszerzenie VSCode (TypeScript, ~100K+ linii kodu) bedace autonomicznym agentem AI z pelna kontrola IDE. Glowna przewaga Cline to **MCP-first architektura** (pelny klient MCP z obsluga stdio/SSE/StreamableHTTP), **system Shadow Git checkpoints** (ukryty repo git do snapshotow/undo bez ingerencji w repo usera), oraz **40+ providerow LLM** z per-model prompt variants. Cline posiada 27 narzedzi, 9 typow hookow (shell-script based), system subagentow (use_subagents tool), Focus Chain (system TODO z markdown na dysku), oraz rozbudowany system regul (cline-rules, skills, workflows z YAML frontmatter conditionals). Architektura to **single-agent z opcjonalnymi subagentami** — klasa `Task` (3628 linii) jest glownym orkiestratorem z petla `while(!abort)` + rekurencyjnym `recursivelyMakeClineRequests()`. Brak failover miedzy providerami, brak race mode, brak systematycznej redakcji sekretow. Approval oparty na ustawieniach (per-tool granular + YOLO mode), nie na AI-based risk assessment.

---

## 2. Matryca Porownawcza

### A. Tozsamosc i Pozycjonowanie

| Pytanie | Cline | DiriCode |
|---------|-------|----------|
| Nazwa, licencja, jezyk implementacji | Cline, Apache-2.0, TypeScript (VSCode extension) | DiriCode, MIT (planowane), TypeScript (CLI) |
| Glowny target user | Solo dev / zespol (VSCode users) | Solo developer (terminal-first) |
| Interfejs | IDE extension (VSCode webview panel) | CLI (TUI Ink/React z vim motions) |
| GitHub stats | ~40K+ gwiazdek, wielu kontryutorow, aktywna spolecznosc. Bus factor wyzszy niz Aider | Nowy projekt |
| Model biznesowy | OSS (Apache-2.0) + Cline cloud (hosted provider), BYOK | OSS (MIT), BYOK |
| Pozycjonowanie | "Autonomous coding agent right in your IDE" — nacisk na autonomie, MCP, visual approval w VSCode | Lokalny CLI agent AI z architektura dispatcher-first |

**Wniosek:** Cline celuje w ekosystem VSCode z visual approval UX. DiriCode celuje w terminal-first z vim motions. Rozne interfejsy, ale podobna filozofia BYOK + OSS. Cline ma wieksza baze userow i dojrzalszy ekosystem MCP.

### B. Architektura Agenta

| Aspekt | Cline | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Ile agentow / rol? | **1 glowny agent** (klasa `Task`, `src/core/task/index.ts`, 3628 linii) + opcjonalne **subagenty** (`use_subagents` tool, `src/core/task/tools/subagent/SubagentRunner.ts`). Subagenty maja ograniczony zestaw narzedzi (domyslnie: FILE_READ, LIST_FILES, SEARCH, LIST_CODE_DEF, BASH, USE_SKILL, ATTEMPT) i sa read-only w domyslnej konfiguracji | Dispatcher + 10 specjalistow | Cline = single-agent z read-only subagentami do eksploracji. DiriCode = multi-agent z pelna delegacja. Cline subagenty sa blizsze "explore" agentom DiriCode |
| Czy agent glowny ma dostep do narzedzi modyfikujacych? | **TAK** — glowny Task ma pelny dostep do 27 narzedzi w tym write_to_file, replace_in_file, execute_command, apply_patch. Brak separacji read/write na poziomie agenta glownego | NIE (read-only dispatcher) | **P0 — DiriCode bezpieczniejszy by design.** Cline agent glowny moze modyfikowac pliki bezposrednio, co zwieksza ryzyko blednych edycji bez nadzoru |
| Jak wyglada delegacja? | `use_subagents` tool spawns SubagentRunner (`SubagentRunner.ts`) ktory tworzy osobna petle agentowa z wlasnym kontekstem, systemowym promptem (`SUBAGENT_SYSTEM_SUFFIX` w `SubagentBuilder.ts`) i ograniczonym zestawem narzedzi. Subagent moze miec osobny model (configurable via `AgentConfigLoader`). Konfiguracja subagentow: `.cline/agents/` pliki YAML/JSON. Max 3 retry na stream init, osobna obsluga tokenow/kosztow | Unlimited nesting + loop detector | Cline subagenty sa plytsze — brak nested subagentow (subagent nie moze spawnovac kolejnego subagenta). DiriCode ma glebsza delegacje |
| Czy jest loop detection / fail-safe? | `consecutiveMistakeCount` + `maxConsecutiveMistakes` w `TaskState.ts` — zlicza kolejne bledne uzycia narzedzi. `autoRetryAttempts` max 3 dla pustych odpowiedzi. `taskState.abort` flag sprawdzany w wielu miejscach. `MAX_EMPTY_ASSISTANT_RETRIES = 3` w SubagentRunner. Hook `PreToolUse` moze anulowac operacje | Tak (ADR-003: hard limit, token budget, loop detector) | DiriCode ma bardziej systematyczne zabezpieczenia (token budget, semantic loop detection). Cline polega glownie na consecutiveMistakeCount |
| Jak zarzadzaja kontekstem agenta? | Caly kontekst w jednym wywolaniu LLM: system prompt (wariant per model family, 12+ wariantow w `variants/`) + user instructions (cline-rules, skills) + Focus Chain instructions + conversation history. `ContextManager.ts` zarzadza truncation/compaction. `shouldCompactContextWindow()` sprawdza threshold % | Dispatcher = minimalny kontekst, per-agent model assignment | Cline zuzywa wiecej tokenow na agent overhead (jeden duzy kontekst). DiriCode oszczedniejszy dzieki separacji kontekstu per agent. Ale Cline ma per-model prompt variants — kazdy model dostaje zoptymalizowany prompt |

**Zrodla:** `src/core/task/index.ts` (glowna petla ~linia 1379, recursivelyMakeClineRequests ~linia 2262), `src/core/task/tools/subagent/SubagentRunner.ts`, `src/core/task/tools/subagent/SubagentBuilder.ts` (SUBAGENT_DEFAULT_ALLOWED_TOOLS, SUBAGENT_SYSTEM_SUFFIX), `src/core/task/TaskState.ts`, `src/core/prompts/system-prompt/variants/index.ts`

### C. Zrozumienie Kodu (Code Intelligence)

| Aspekt | Cline | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Jak "widzi" codebase? | **Tree-sitter AST** (`src/services/tree-sitter/index.ts`) — parsuje definicje top-level (klasy, funkcje, metody) z plikow. Obsluguje 17 jezykow (JS, TS, Python, Rust, Go, C, C++, C#, Ruby, Java, PHP, Swift, Kotlin). Narzedzie `list_code_definition_names` wywoluje `parseSourceCodeForDefinitionsTopLevel()`. Limit: 50 plikow, 200 plikow na listing. **Brak grafu zaleznosci** — to flat listing definicji, nie PageRank jak Aider | glob + grep + AST-grep + LSP | Cline ma Tree-sitter ale uzywa go prostiej niz Aider (flat listing vs graf). DiriCode ma AST-grep + LSP co jest bardziej precyzyjne per-plik. **Obie strony nie maja pelnego repo map z rankingiem** |
| Czy parsuje strukture kodu? | Tak — Tree-sitter `.scm` query files w `src/services/tree-sitter/queries/` (python, javascript, typescript, etc.). Wyciaga definicje klas/funkcji/metod. Output: `filename\n|definicja_linia\n|----\n` | AST-grep + LSP | Porownywalne — oba parsuja AST. Cline automatycznie (per-directory), DiriCode na zadanie (per-file via LSP) |
| Jak wybiera pliki do kontekstu? | **Manualnie + LLM-driven.** LLM uzywa narzedzi `list_files`, `search_files`, `read_file`, `list_code_definition_names` aby samodzielnie eksplorowac codebase i wybrac pliki. Brak automatycznego rankingu. Subagent moze byc uzyty do eksploracji | Agent dispatcher decyduje na podstawie opisu zadania | Oba polegaja na LLM do wyboru plikow. Brak automatycznego rankingu w obu. Cline daje LLM wiecej narzedzi do eksploracji (list_code_def), DiriCode daje LSP (goto-definition, find-references) |
| Czy ma LSP integration? | **NIE bezposrednio.** Brak LSP w runtime agenta. Cline polega na Tree-sitter (offline parsing) + `search_files` (ripgrep). Diagnostyki sa zbierane z VSCode host API, nie z wlasnego LSP | Tak, top-10 jezykow lazy install | **P1 — DiriCode lepszy.** LSP daje goto-definition, find-references, rename, diagnostics — Cline tego nie ma. Cline polega na grep + Tree-sitter |
| Jak radzi sobie z duzymi repozytoriami? | `.clineignore` wyklucza pliki. `list_files` ma limit na listing. `parseSourceCodeForDefinitionsTopLevel` limit 50 plikow per directory. Brak cache repo map miedzy sesjami (TODO w kodzie: "implement caching behavior") | Nieznane — potencjalna luka | Oba maja potencjalne problemy z duzymi repo. Cline ma limity ale brak cache. DiriCode nie zostal jeszcze przetestowany |

**Zrodla:** `src/services/tree-sitter/index.ts` (parseSourceCodeForDefinitionsTopLevel, separateFiles z lista 17 rozszerzen), `src/services/tree-sitter/queries/` (query files per jezyk), `src/services/tree-sitter/languageParser.ts`

### D. Routing i Obsluga Modeli

| Aspekt | Cline | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Ile providerow / modeli? | **40+ providerow** z dedykowanymi handlerami w `src/core/api/providers/`: anthropic, openai, openai-native, openai-codex, openrouter, bedrock, vertex, gemini, ollama, lmstudio, deepseek, requesty, together, groq, mistral, fireworks, cerebras, xai, sambanova, huggingface, doubao, minimax, moonshot, qwen, qwen-code, hicap, nebius, dify, baseten, aihubmix, asksage, sapaicore, huawei-cloud, nousresearch, zai, litellm, claude-code, vercel-ai-gateway, vscode-lm, oca, cline (cloud) | 22 providerow via Vercel AI SDK | Cline ma prawie 2x wiecej providerow. Kazdy ma dedykowany handler w osobnym pliku. DiriCode uzywa Vercel AI SDK co upraszcza ale ogranicza |
| Czy ma failover? | **NIE.** `buildApiHandler()` w `src/core/api/index.ts` tworzy **jeden** handler per mode (plan/act). Brak automatycznego przelaczania miedzy providerami. Per-provider retry z exponential backoff (`src/core/api/retry.ts`, `withRetry` decorator, max 3 retries). OpenRouter ma upstream provider ordering (OPENROUTER_PROVIDER_PREFERENCES) ale to failover po stronie OpenRouter, nie Cline | Tak (ADR-011: order-based failover) | **P1 — DiriCode lepszy.** Cline nie ma cross-provider failover. Jesli skonfigurowany provider padnie — blad |
| Czy ma race mode? | **NIE.** Brak parallel requests do wielu providerow. Promise.race uzycia w kodzie dotycza timeoutow (np. ollama), nie multi-provider race | Tak (ADR-011: race mode) | **P1 — DiriCode lepszy** |
| Per-agent model assignment? | **TAK — Plan/Act mode split.** `planModeApiProvider` i `actModeApiProvider` moga byc roznymi providerami/modelami. Subagenty moga miec osobny model (`SubagentBuilder.ts` — `applyModelOverride`). Plus **12+ prompt variants** per model family (generic, gpt-5, gemini-3, trinity, xs, hermes, devstral, next-gen, etc.) w `src/core/prompts/system-prompt/variants/` | Tak (dispatcher=fast, writer=deep) | **Porownywalne, ale Cline ma LEPSZE per-model prompt optimization.** 12+ wariantow promptu zoptymalizowanych per model family to wyrafinowane podejscie. DiriCode powinien zaadaptowac |
| Jak radzi sobie z non-Claude modelami? | **Doskonale.** Kazdy model family ma dedykowany prompt variant z: zestawem narzedzi, kolejnoscia komponentow promptu, per-model placeholderami. Np. `xs` variant ma uproszczony zestaw narzedzi, `gemini-3` ma native tool calling, `gpt-5` ma osobny format. `variant-builder.ts` i `variant-validator.ts` zapewniaja type-safe konfiguracje | Adaptery per provider — do zweryfikowania | **P0 — Cline lepszy.** Per-model prompt variants to kluczowa przewaga. DiriCode powinien zaimplementowac analogiczny system |
| Czy zalezy od LiteLLM? | **NIE.** Kazdy provider ma wlasny handler z dedykowanym SDK (openai, @anthropic-ai/sdk, @aws-sdk/client-bedrock-runtime, etc.). litellm jest jednym z providerow, nie centralnym routerem | NIE — wlasny TS Router (ADR-011) | Oba niezalezne od LiteLLM. Cline ma wiecej dedykowanych SDK. DiriCode uzywa Vercel AI SDK jako abstrakcji |

**Zrodla:** `src/core/api/index.ts` (buildApiHandler, createHandlerForProvider — giant switch), `src/core/api/providers/` (40+ plikow), `src/core/api/retry.ts` (withRetry), `src/core/prompts/system-prompt/variants/index.ts` (VARIANT_CONFIGS z 12 wariantami), `src/core/prompts/system-prompt/variants/config.template.ts` (builder pattern), `src/core/task/tools/subagent/SubagentBuilder.ts` (applyModelOverride)

### E. System Hookow i Rozszerzalnosc

| Aspekt | Cline | DiriCode | Wniosek |
|--------|-------|----------|---------|
| System hookow/pluginow? | **9 typow hookow** (`src/core/hooks/hook-factory.ts`): PreToolUse, PostToolUse, UserPromptSubmit, TaskStart, TaskResume, TaskCancel, TaskComplete, Notification, PreCompact. **Shell-script based** — hooki to skrypty w `.cline/hooks/` wykonywane jako child processes z JSON input/output | 12 lifecycle hooks, lazy loading (ADR-005) | DiriCode ma wiecej hookow (12 vs 9) i sa programatyczne (TS). Cline hooki sa shell-script based — prostsze ale mniej elastyczne |
| Ile extension points? | 9 hookow + MCP client (pelny) + cline-rules (globalne i lokalne, directory-based, z YAML frontmatter conditionals) + skills (`.cline/skills/` z SKILL.md) + workflows (`.cline/workflows/`) + custom agent configs (`.cline/agents/`) + prompt variants + Focus Chain | 12 hookow + MCP client + pliki .md agentow | **Cline ma WIECEJ extension points.** Skills, workflows, conditional rules z frontmatter, prompt variants — to bardzo rozbudowany system. DiriCode ma mniej ale bardziej koherentne |
| Custom agenci? | **TAK** — `.cline/agents/` konfiguracja subagentow via `AgentConfigLoader.ts`. Kazdy subagent moze miec: osobny model, osobny system prompt, osobny zestaw narzedzi, osobne skills. Loaded z YAML/JSON. **Uwaga:** Cline nie rozdziela Execution Policies (zahardcodowane) od Agent Guards (konfigurowalne) — subagenty maja flat config bez niezmiennych polityk wykonawczych | Tak — `.diricode/agents/` (ADR-012: Execution Policies + Agent Guards) | **P1 — DiriCode lepszy w bezpieczenstwie agentow.** ADR-012 rozdziela niezmienne Execution Policies od konfigurowalnych Agent Guards. Cline pozwala na pelna rekonfiguracje subagentow bez twardych barier — agent moze dostac dowolne narzedzia |
| MCP support? | **Pelny klient MCP** (`src/services/mcp/McpHub.ts`) — obsluguje stdio, SSE, StreamableHTTP transports. Hot-reload konfiguracji (file watcher na MCP settings). OAuth support (`McpOAuthManager`). Narzedzia: `use_mcp_tool`, `access_mcp_resource`, `load_mcp_documentation`. Remote config sync dla MCP servers | Tak, GitHub MCP wbudowany + zewnetrzne | **P1 — Cline lepszy w MCP.** Pelny klient z 3 transportami, OAuth, hot-reload. DiriCode planuje MCP ale bez takiej glebokosci |
| Konfiguracja | `.cline/` directory: rules, hooks, skills, workflows, agents. VSCode settings panel. Remote config z Cline backend. YAML frontmatter conditionals w rules (`rule-conditionals.ts` — path-based matching z picomatch) | `diricode.config.ts` (type-safe) | DiriCode ma type-safe config (lepsze DX). Cline ma wiecej opcji konfiguracji ale rozproszone (files + VSCode settings + remote config) |
| Conditional rules? | **TAK** — YAML frontmatter w cline-rules z `paths` conditional (`rule-conditionals.ts`). Reguly aktywuja sie tylko gdy sciezki plikow pasuja do glob patterns. Frontmatter parsing z fail-open semantics | Brak (reguly zawsze aktywne) | **P1 — Cline lepszy.** Conditional rules to elegancki mechanizm. DiriCode powinien zaadaptowac |

**Zrodla:** `src/core/hooks/hook-factory.ts` (9 hook types), `src/core/hooks/hook-executor.ts` (shell execution, 30s timeout, 50KB max), `src/core/context/instructions/user-instructions/cline-rules.ts` (getGlobalClineRules, getLocalClineRules), `src/core/context/instructions/user-instructions/skills.ts` (discoverSkills, getSkillContent), `src/core/context/instructions/user-instructions/workflows.ts`, `src/core/context/instructions/user-instructions/rule-conditionals.ts` (evaluatePathsConditional), `src/services/mcp/McpHub.ts`

### F. Bezpieczenstwo i Approval

| Aspekt | Cline | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Approval przed destrukcja? | **Settings-based approval** (`src/core/task/tools/autoApprove.ts`). 3 tryby: (1) `yoloModeToggled` = approve everything, (2) `autoApproveAllToggled` = approve all, (3) per-tool granular: `readFiles`, `editFiles`, `executeSafeCommands`, `executeAllCommands`, `useBrowser`, `useMcp`. Path-aware: local workspace vs external files maja osobne ustawienia. **Brak AI-based risk assessment** — czysto ustawienia | Tak (ADR-004: Smart — AI ocenia ryzyko) | **P0 — DiriCode lepszy.** Cline YOLO mode pozwala na pelna autonomie bez oceny ryzyka. DiriCode Smart Approval z AI-based risk assessment jest bezpieczniejszy |
| 3 kategorie ryzyka? | **NIE explicite.** Cline dzieli na: read ops vs write ops vs command execution vs browser vs MCP. Brak explicite safe/risky/destructive kategoryzacji | Tak — safe/risky/destructive, konfigurowalne | DiriCode bardziej systematyczny w kategoryzacji ryzyka |
| Ochrona przed wyciekiem sekretow? | **NIE ZNALEZIONO systematycznej redakcji.** Grep na "redact\|mask\|secret\|credential\|REDACTED" w calym repo znalazl referencje glownie w state migration i API key storage — ale **brak filtrowania zawartosci plikow przed wyslaniem do LLM**. API keys sa przechowywane w StateManager secrets, ale zawartosc plikow uzytkownika idzie do LLM bez redakcji | Tak (ADR-014: auto-redakcja regex+heurystyki) | **P0 — DiriCode znacznie lepszy.** Brak secret redaction w Cline to powazna luka bezpieczenstwa |
| Sandboxing? | **NIE.** Brak Docker/VM sandboxing. Komendy wykonywane bezposrednio w terminalu usera (VSCode terminal) | NIE w MVP (odlozony do v2) | Oba bez sandbox — akceptowalne dla solo dev w MVP |
| Git safety rails? | **Shadow Git checkpoint** (`src/integrations/checkpoints/`) — osobny ukryty `.git` repo do snapshotow. Ale **brak blokady destrukcyjnych komend git** (push --force, reset --hard, git add .). `CommandPermissionController.ts` ma detection niebezpiecznych znakow (backticki, newlines) i redirect detection, ale nie blokuje specyficznych komend git | Tak (ADR-010: blokada `git add .`, `push --force`, `reset --hard`) | **P1 — DiriCode lepszy w git safety.** Cline ma checkpoint system (lepszy undo) ale brak blokady destrukcyjnych komend git |
| Parsowanie bash? | **Czesciowe.** `CommandPermissionController.ts` (`src/core/permissions/`) — command-level permission via `CLINE_COMMAND_PERMISSIONS` env var z allow/deny glob patterns. Detection: redirect (`>`), subshell (`$()`), backticks, pipe chains, dangerous characters (newlines). Ale **nie uzywa Tree-sitter do parsowania bash** — regex/string matching | Tree-sitter (ADR-015) | **P1 — DiriCode lepszy.** AST-based parsing jest bardziej niezawodne niz regex matching |

**Zrodla:** `src/core/task/tools/autoApprove.ts` (AutoApprove class — yoloModeToggled, autoApproveAllToggled, per-tool granular), `src/core/permissions/CommandPermissionController.ts` (CLINE_COMMAND_PERMISSIONS, redirect detection, dangerous chars), `src/integrations/checkpoints/CheckpointGitOperations.ts` (initShadowGit), `src/integrations/checkpoints/CheckpointTracker.ts` (commits, diffs, restore)

### G. Pamiec i Stan

| Aspekt | Cline | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Trwala pamiec miedzy sesjami? | **Czesciowa.** Cline przechowuje historie zadan (conversation history) na dysku jako JSON (`src/core/task/message-state.ts`). Kazde zadanie ma osobny katalog z plikami. Ale **brak project-level memory** — kazde nowe zadanie zaczyna z czystym kontekstem (moze odczytac poprzednie zadanie przez `new_task` tool z kontekstem). Cline-rules/skills sa trwale ale to instrukcje, nie pamiec semantyczna | GitHub Issues jako project memory (ADR-007) | **P1 — DiriCode lepszy.** GitHub Issues jako project memory to trwala, przeszukiwalna pamiec semantyczna. Cline ma jedynie historie zadan |
| Przechowywanie stanu zadan? | **Focus Chain** (`src/core/task/focus-chain/index.ts`) — system TODO z markdown checklist na dysku. `FocusChainManager` zarzadza: tworzeniem, aktualizacja, file watcher (chokidar) na zmiany zewnetrzne, progress tracking (totalItems/completedItems/percentComplete), telemetria. LLM aktualizuje liste przez `task_progress` parametr w narzedziu `focus_chain`. Markdown file per task. Instrukcje dla LLM generowane dynamicznie na podstawie postpu | Pliki Markdown `.diricode/todo.md` (ADR-013) | **Porownywalne.** Oba uzywaja Markdown do stanu TODO. Cline Focus Chain jest bardziej rozbudowany (file watcher, progress %, dynamiczne instrukcje, telemetria). DiriCode prostszy ale wystarczajacy |
| Snapshot / undo? | **TAK — Shadow Git** (`src/integrations/checkpoints/`). `CheckpointGitOperations.initShadowGit()` tworzy ukryty repo git (osobny od usera). `CheckpointTracker` robi commity, diffuje, pozwala na restore do poprzedniego checkpointa. `MultiRootCheckpointManager` dla multi-root workspaces. Checkpointy tworzone automatycznie po kazdej akcji narzedzia | Brak snapshota — git worktrees (ADR-008) | **P0 — Cline lepszy w undo UX.** Shadow Git daje one-click restore do dowolnego punktu. DiriCode polega na git worktrees co jest mniej intuicyjne. **To podwaza ADR-008** |
| Context compaction? | `ContextManager.ts` (`src/core/context/context-management/`) — `shouldCompactContextWindow()` sprawdza threshold % context window. `getTruncatedMessages()` truncuje historie. `ensureToolResultsFollowToolUse()` naprawia spojnosc po truncation. `applyContextOptimizations()` — dodatkowe optymalizacje. Compaction via summarization (`summarizeTask` tool, `condense` tool) | Sliding window + summary na 90-95% (ADR-009) | **Porownywalne.** Oba uzywaja threshold-based compaction z summarization. Cline ma dodatkowe narzedzia (`condense`, `summarize_task`) ktore LLM moze wywolac proaktywnie |
| Git worktrees? | **Brak wsparcia dla git worktrees.** Shadow Git jest per-workspace, nie per-worktree | Natywnie — GitHub Issues globalne per repo | DiriCode lepiej zintegrowany z git worktrees |

**Zrodla:** `src/core/task/focus-chain/index.ts` (FocusChainManager — setupFocusChainFileWatcher, generateFocusChainInstructions, updateFCListFromToolResponse, shouldIncludeFocusChainInstructions), `src/core/task/focus-chain/file-utils.ts`, `src/core/context/context-management/ContextManager.ts` (shouldCompactContextWindow, getTruncatedMessages, ensureToolResultsFollowToolUse), `src/core/task/message-state.ts`, `src/integrations/checkpoints/CheckpointGitOperations.ts`, `src/integrations/checkpoints/CheckpointTracker.ts`, `src/integrations/checkpoints/factory.ts`

### H. UX i Developer Experience

| Aspekt | Cline | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Time-to-first-use | Instalacja z VSCode Marketplace + API key — 2 kroki. Remote config moze provisionowac klucze API dla organizacji | Do zbadania — planowane `npx diricode` | Cline ma latwy onboarding dzieki VSCode marketplace |
| Vim motions? | **NIE.** VSCode webview panel — standardowy UI. Brak vim motions w panelu Cline | Od dnia 1 (TUI Ink) | DiriCode lepszy dla vim users |
| Streaming? | Tak — streaming via provider SDKs, normalizowany do ApiStream (AsyncGenerator). UI aktualizowany przez gRPC bridge (`src/core/controller/grpc-handler.ts`) | SSE (ADR-001) | Porownywalne — oba streamuja |
| Lean mode? | **NIE.** Brak trybu oszczednego. Mozna recznie zmniejszyc kontekst (mniejszy model, wylacz Focus Chain, wylacz skills) ale brak jednego flaga | `--lean` (ADR-006) | DiriCode lepszy — jeden flag |
| Plan/Act mode? | **TAK** — explicite Plan mode i Act mode. Uzytkownik lub LLM moze przelaczac. Plan mode uzywa osobnego providera/modelu. `plan_mode_respond` i `act_mode_respond` to osobne narzedzia. Prompt dynamicznie sie zmienia w zaleznosci od mode | Brak explicite plan/act split | **P2 — Cline lepszy.** Plan/Act mode z osobnym modelem to interesujacy pattern. Tani model planuje, drogi wykonuje |
| Jakos dokumentacji? | Dobra — oficjalna strona, marketplace listing, community Discord | Do stworzenia | Cline ma dojrzala dokumentacje |
| Skills system? | **TAK** — `.cline/skills/` i globalne `~/.cline/skills/`. Kazdy skill to katalog z `SKILL.md` (YAML frontmatter: name, description + markdown body z instrukcjami). `discoverSkills()` skanuje oba katalogi. `getSkillContent()` laduje instrukcje. `use_skill` tool pozwala LLM zaladowac skill on-demand. Globalne skills maja priorytet nad projektowymi | Brak systemu skills (planowane?) | **P1 — Cline lepszy.** System skills to elegancki mechanizm reuzywania wiedzy domenowej. DiriCode powinien zaadaptowac |
| Telemetria? | Rozbudowana — `telemetryService` z eventami: FocusChainProgressFirst, FocusChainProgressUpdate, FocusChainListWritten, FocusChainIncompleteOnCompletion. Per-subagent cost tracking | Do zaimplementowania | Cline ma dojrzala telemetrie |

**Zrodla:** `src/core/context/instructions/user-instructions/skills.ts` (discoverSkills, getAvailableSkills, getSkillContent), `src/core/task/tools/subagent/SubagentBuilder.ts` (getConfiguredSkills), `src/core/task/focus-chain/index.ts` (telemetria events)

---

## 3. Co DiriCode Powinien Zaadaptowac

| # | Priorytet | Co | Dlaczego | Wplyw na ADR |
|---|-----------|-----|---------|-------------|
| 1 | **P0** | **Per-model prompt variants** — system wariantow promptu zoptymalizowanych per model family. Cline ma 12+ wariantow (generic, gpt-5, gemini-3, trinity, xs, hermes, devstral, next-gen, native-gpt-5, native-next-gen, glm). Kazdy wariant definiuje: kolejnosc komponentow promptu, zestaw narzedzi, placeholdery, per-model config. Builder pattern z type-safe validation (`variant-builder.ts`, `variant-validator.ts`) | Rozne modele wymagaja roznych promptow, zestawow narzedzi, i formatow. Generyczny prompt daje suboptymalne wyniki na non-Claude modelach. Cline odkryl ze np. model "xs" potrzebuje uproszczonego zestawu narzedzi, "gemini-3" potrzebuje native tool calling, "trinity" potrzebuje anti-looping reminders. Pliki: `src/core/prompts/system-prompt/variants/` (12 katalogow), `variant-builder.ts`, `config.template.ts` | **ADR-011** (routing) — rozszerzyc o per-model prompt configuration. Nowy komponent: PromptVariantRegistry z wariantami per model family |
| 2 | **P0** | **Shadow Git checkpoint system** — ukryty repo git do automatycznych snapshotow po kazdej akcji narzedzia. One-click restore do dowolnego punktu. Nie ingeruje w git usera | Znacznie lepszy UX undo niz pure git worktrees. Uzytkownik moze cofnac dowolna zmiane agenta bez znajomosci git. Checkpoint po kazdej akcji = granularny undo. Pliki: `src/integrations/checkpoints/CheckpointGitOperations.ts`, `CheckpointTracker.ts`, `factory.ts` | **ADR-008** — wymaga rewizji. Obecna decyzja "brak snapshot systemu" jest podwazona przez sukces Shadow Git w Cline. Propozycja: dodac opcjonalny checkpoint system oparty na shadow git OBOK worktrees |
| 3 | **P1** | **Skills system** — reuzywalne pakiety wiedzy domenowej w `.diricode/skills/`. Kazdy skill = katalog z `SKILL.md` (frontmatter: name, description, body: instrukcje). Globalne (`~/.diricode/skills/`) i projektowe, globalne z priorytetem. Agent moze zaladowac skill on-demand przez narzedzie | Pozwala userom i organizacjom pakietowac wiedze domenowa (np. "react-testing", "aws-cdk", "prisma-migrations") i reuzywac miedzy projektami. Cline skills sa proste (markdown) ale efektywne. Pliki: `src/core/context/instructions/user-instructions/skills.ts` | **ADR-005** (hooks/extensibility) — rozszerzyc o system skills. Alternatywnie: nowy ADR |
| 4 | **P1** | **Conditional rules z YAML frontmatter** — reguly (cline-rules) z warunkowym aktywowaniem na podstawie sciezek plikow. YAML frontmatter z `paths` conditional + picomatch glob matching. Fail-open semantics na bledach parsowania | Pozwala na precyzyjne targetowanie regul — np. regula "use Prisma conventions" aktywuje sie tylko dla plikow w `src/database/`. Redukuje szum w kontekscie. Pliki: `src/core/context/instructions/user-instructions/rule-conditionals.ts`, `frontmatter.ts` | **ADR-005** (hooks/extensibility) — dodac conditional activation do systemu regul DiriCode |
| 5 | **P1** | **Focus Chain (rozbudowany TODO)** — file watcher na zmiany zewnetrzne (user edytuje TODO w edytorze), progress tracking z procentami, dynamiczne instrukcje dla LLM bazowane na postepie, telemetria, debouncing aktualizacji | DiriCode ma prosty `todo.md` (ADR-013). Cline Focus Chain dodaje: (1) user moze edytowac TODO zewnetrznie i agent to widzi, (2) LLM dostaje rozne instrukcje w zaleznosci od % ukonczenia, (3) telemetria trackuje incomplete items na zakonczenie. Pliki: `src/core/task/focus-chain/index.ts`, `prompts.ts`, `file-utils.ts` | **ADR-013** (stan w Markdown) — rozszerzyc TODO system o file watcher i dynamiczne instrukcje |
| 6 | **P2** | **Plan/Act mode z osobnym modelem** — explicite rozdzielenie fazy planowania (tani model) od fazy wykonania (drogi model). Uzytkownik i LLM moga przelaczac miedzy trybami | Optymalizacja kosztow: planowanie zuzywa mniej tokenow (tani model), wykonanie wymaga precyzji (drogi model). Cline daje uzytkownikowi kontrole nad tym split. Pliki: `src/core/api/index.ts` (buildApiHandler z mode), `src/shared/tools.ts` (plan_mode_respond, act_mode_respond) | **ADR-002** (dispatcher-first) — mozna rozwazyc per-phase model assignment (dispatcher/planner = tani, executor = drogi) |
| 7 | **P2** | **Subagent system z konfigurowalnym zestawem narzedzi** — subagenty z ograniczonym zestawem narzedzi (domyslnie read-only), konfiguracja via `.cline/agents/`, osobny model per subagent | DiriCode ma delegacje ale subagenty nie maja konfigurowalnego zestawu narzedzi per agent type. Cline `SUBAGENT_DEFAULT_ALLOWED_TOOLS` i `AgentConfigLoader` pozwalaja na fine-grained control. Pliki: `SubagentBuilder.ts`, `AgentConfigLoader.ts` | **ADR-003** (delegacja) — rozwazyc per-agent tool whitelisting w konfiguracji agentow |

---

## 4. Czego DiriCode Powinien Unikac

| # | Priorytet | Co | Dlaczego to problem | Jak DiriCode to rozwiazuje |
|---|-----------|-----|--------------------|-----------------------------|
| 1 | **P0** | **YOLO mode (approve everything)** — jeden toggle ktory wylacza wszelkie approval. Cline pozwala na `yoloModeToggled = true` ktore auto-approve'uje WSZYSTKO bez wyjatkow: edycje plikow, komendy bash, operacje destructive | Calkowita utrata kontroli. Uzytkownik moze wlaczyc YOLO "zeby bylo szybciej" i agent moze usunac pliki, nadpisac konfiguracje, wykonac dowolne komendy. Brak safety net. W polaczeniu z brakiem secret redaction — katastrofalne ryzyko | ADR-004: Smart Approval z AI-based risk assessment. Nawet w "auto" mode DiriCode ocenia ryzyko i blokuje destructive operacje |
| 2 | **P0** | **Brak secret redaction** — zawartosc plikow leci do LLM bez filtrowania. API keys, credentials, tokeny — wszystko widoczne dla providera LLM | Powazan luka bezpieczenstwa. Kazdy plik dodany do kontekstu (read_file, search_files) moze zawierac sekrety ktore zostana wyslane do zewnetrznego API. Uzytkownik musi sam pamietac co jest w plikach — nie skaluje sie | ADR-014: Auto-redakcja regex + heurystyki. DiriCode filtruje znane wzorce sekretow zanim tresc trafi do LLM |
| 3 | **P0** | **Monolityczna klasa Task (3628 linii)** — glowny orkiestrator jest god-classem zawierajacym: petle agenta, tool execution, stream handling, context management, checkpoint management, focus chain, approval, retry, abort. Wszystko w jednym pliku | Trudne do testowania, utrzymania, rozszerzenia. Kazda zmiana moze zepsuc cos innego. Nowi kontrybutorzy nie wiedza gdzie zaczac. Porownywalne z god-class Aidera (`base_coder.py` 2485 linii) — Cline jest wiekszy (3628 linii) | ADR-002: Dispatcher-first z separacja odpowiedzialnosci. DiriCode architektura wieloagentowa naturalnie wymusza mniejsze, fokusowane komponenty |
| 4 | **P1** | **Shell-script hooki** — hooki wykonywane jako child processes (shell scripts) z JSON stdin/stdout. 30s timeout, 50KB limit na modyfikacje kontekstu | Mniej elastyczne niz programatyczne hooki. Wymaga pisania shell scriptow zamiast TypeScript. Debugowanie trudniejsze. Brak type safety w hookach. DX gorszy niz programatyczne API | ADR-005: 12 lifecycle hooks w TypeScript z lazy loading. Programatyczne API z type safety |
| 5 | **P1** | **Brak cross-provider failover** — jesli skonfigurowany provider padnie, Cline zwraca blad zamiast przelaczac na backup. Per-provider retry (max 3) ale nie cross-provider | Single point of failure na poziomie providera. Jesli Anthropic API ma outage — Cline nie dziala nawet jesli user ma klucze do OpenAI. 40+ providerow ale mozna uzyc tylko jednego na raz | ADR-011: TS Router z order-based failover i race mode. DiriCode automatycznie przelacza na backup provider |
| 6 | **P2** | **Brak blokady destrukcyjnych komend git** — Shadow Git checkpoint daje undo ale nie blokuje `git push --force`, `git reset --hard`, `git add .`. `CommandPermissionController` wykrywa niebezpieczne znaki (backticki, newlines) ale nie specyficzne komendy git | Agent moze wykonac `git push --force` i nadpisac remote history. Shadow Git nie pomoze jesli remote zostal uszkodzony. Checkpoint jest lokalny — push jest nieodwracalny | ADR-010: Explicite blokada `git add .`, `push --force`, `reset --hard` z mozliwoscia overrideu |

---

## 5. Otwarte Pytania

| # | Priorytet | Pytanie | Kontekst |
|---|-----------|---------|----------|
| 1 | **P0** | **Czy Shadow Git checkpoint system jest wart implementacji w DiriCode?** Cline udowodnilo ze to dziala dobrze (automatyczne snapshoty, one-click restore). Ale dodaje zlozonosc (ukryty repo, nested git handling, multi-root support). Czy git worktrees + auto-commit daja wystarczajacy undo? | ADR-008 mowi "brak snapshot systemu". Ale Shadow Git to najpopularniejszy feature Cline. Trzeba zbadac: (1) ile userow faktycznie uzywa restore, (2) czy auto-commit per edit (pattern z Aidera) daje 80% wartosci za 20% zlozonosci |
| 2 | **P0** | **Ile prompt variants potrzebuje DiriCode?** Cline ma 12+ wariantow. Czy DiriCode potrzebuje tylu? Jakie model families sa priorytetowe? Czy wystarczy 3-4 wariantow (claude, openai, gemini, generic)? | Per-model prompt optimization ma duzy wplyw na jakosc output. Ale utrzymanie 12+ wariantow to znaczny koszt. Trzeba okreslic: (1) ktore modele sa priorytetowe dla userow DiriCode, (2) ile wariantow daje 80% wartosci |
| 3 | **P1** | **Jak Cline subagenty sprawdzaja sie w praktyce?** Cline dodal subagenty stosunkowo niedawno (use_subagents tool). Czy sa uzywane? Czy sa skuteczne? Jak wypadaja w porownaniu z pelna delegacja DiriCode? | DiriCode ma pelna delegacje (unlimited nesting + loop detector). Cline ma plytkie subagenty (brak nesting, read-only default). Trzeba zbadac: (1) community feedback na subagenty Cline, (2) czy ograniczenia sa intentional czy temporary |
| 4 | **P1** | **Czy Focus Chain (rozbudowany TODO) wymaga file watchera?** Cline uzywa chokidar do obserwacji zmian w plikach TODO. To eleganckie ale dodaje zaleznosc i zlozonosc. Czy DiriCode potrzebuje file watchera czy wystarczy polling / on-demand read? | ADR-013 planuje prosty `todo.md`. File watcher pozwala userowi edytowac TODO w edytorze i agent natychmiast widzi zmiany. Ale w CLI workflow (nie IDE) user mniej prawdopodobnie edytuje TODO w osobnym oknie |
| 5 | **P1** | **Jak Cline radzi sobie z kosztami przy 40+ providerach?** Kazdy provider ma osobny handler z dedykowanym SDK. Czy to powoduje bloat w bundle? Czy Cline lazy-loaduje providery? Jak wyglada start time? | DiriCode uzywa Vercel AI SDK co jest lzejsze (jedna abstrakcja). Cline approach (40+ dedykowanych SDK) daje wiecej kontroli ale moze byc ciezsze. Trzeba zmierzyc: startup time, memory footprint |
| 6 | **P2** | **Czy Cline conditional rules moga byc rozszerzone o inne warunki niz sciezki?** Obecna implementacja obsluguje tylko `paths` conditional. Czy DiriCode powinien od razu zaimplementowac wiecej conditionals (np. branch name, file type, git status)? | `rule-conditionals.ts` ma architekture pluginowa (`conditionalEvaluators` record) — latwo dodac nowe evaluatory. DiriCode moze zaimplementowac od razu bogatszy zestaw |

---

## 6. Rekomendacje dla Specyfikacji DiriCode

### Zmiany ADR

| ADR | Obecna decyzja | Proponowana zmiana | Uzasadnienie |
|-----|----------------|-------------------|--------------|
| **ADR-008** | Brak snapshot systemu — git worktrees zamiast | **Dodac opcjonalny Shadow Git checkpoint** obok worktrees. Auto-snapshot po kazdej akcji narzedzia. One-click restore. Implementacja: ukryty `.diricode/.shadow-git/` repo | Shadow Git to killer feature Cline. Worktrees daja izolacje ale nie granularny undo. Oba systemy sa komplementarne |
| **ADR-011** | TS Router z failover i race mode | **Rozszerzyc o per-model prompt variants.** Dodac PromptVariantRegistry z wariantami per model family. Minimum 4 warianty: claude, openai, gemini, generic | Cline udowodnilo ze per-model prompt optimization ma kluczowy wplyw na jakosc. Generyczny prompt nie jest wystarczajacy |
| **ADR-005** | 12 lifecycle hooks, lazy loading | **Dodac conditional activation do systemu regul/hookow.** YAML frontmatter z `paths` (i potencjalnie `branch`, `fileType`) conditionals | Conditional rules redukuja szum w kontekscie i pozwalaja na precyzyjne targetowanie |
| **ADR-013** | Stan w Markdown (todo.md) | **Rozszerzyc o dynamiczne instrukcje dla LLM bazowane na postepie TODO.** Rozne prompty w zaleznosci od % ukonczenia. Opcjonalny file watcher dla CLI | Focus Chain Cline pokazuje ze dynamiczne instrukcje poprawiaja jakos sledzenia postepu |
| **ADR-003** | Unlimited nesting + loop detector | **Dodac per-agent tool whitelisting** w konfiguracji agentow. Kazdy agent type ma explicite liste dozwolonych narzedzi | Cline subagenty z ograniczonym zestawem narzedzi sa bezpieczniejsze. DiriCode powinien umozliwic fine-grained control |

### Nowe elementy do rozwazynia

| Element | Opis | Priorytet | Zrodlo inspiracji |
|---------|------|-----------|-------------------|
| **Skills system** | Reuzywalne pakiety wiedzy domenowej w `.diricode/skills/`. Markdown z frontmatter. Globalne + projektowe. Ladowane on-demand przez agenta | P1 | Cline skills (`src/core/context/instructions/user-instructions/skills.ts`) |
| **Plan/Act mode split** | Opcjonalny tryb gdzie planowanie (tani model) jest oddzielone od wykonania (drogi model). Uzytkownik moze przelaczac | P2 | Cline Plan/Act mode z osobnymi providerami |
| **Prompt Variant Registry** | Centralne repozytorium wariantow promptu per model family. Builder pattern z type-safe validation. Min 4 warianty | P0 | Cline `src/core/prompts/system-prompt/variants/` (12 wariantow) |

### Potwierdzone decyzje

| ADR | Decyzja | Potwierdzenie z analizy Cline |
|-----|---------|------------------------------|
| **ADR-002** | Dispatcher-first (read-only agent glowny) | Cline Task god-class (3628 linii) z pelnym dostepem do narzedzi modyfikujacych potwierdza ze DiriCode read-only dispatcher jest bezpieczniejszy i czystszy architektonicznie |
| **ADR-004** | Smart Approval (AI ocenia ryzyko) | Cline YOLO mode + settings-based approval bez AI risk assessment potwierdza ze DiriCode podejscie jest bardziej zaawansowane i bezpieczniejsze |
| **ADR-010** | Git safety rails (blokada destructive commands) | Cline brak blokady `push --force`/`reset --hard` pomimo Shadow Git potwierdza potrzebe explicite safety rails |
| **ADR-011** | Wlasny TS Router z failover i race mode | Cline brak cross-provider failover pomimo 40+ providerow potwierdza wartosc ADR-011. Robustny routing jest differentiator |
| **ADR-014** | Auto-redakcja sekretow | Cline calkowity brak secret redaction potwierdza ze ADR-014 jest krytycznie wazny |
| **ADR-015** | Tree-sitter do parsowania bash | Cline regex-based command permission zamiast AST parsing potwierdza ze Tree-sitter podejscie DiriCode jest bardziej niezawodne |
| **ADR-012** | Hybrydowa definicja agentow (Execution Policies + Agent Guards) | Cline pozwala na pelna rekonfiguracje subagentow bez niezmiennych polityk wykonawczych — agent moze dostac dowolne narzedzia. Potwierdza wartosc rozdzielenia zahardcodowanych Execution Policies od konfigurowalnych Agent Guards w DiriCode |

---

## Appendix: Kluczowe Pliki Zrodlowe Cline

| Plik | Linii (ok.) | Co zawiera | Znaczenie dla analizy |
|------|-------------|-----------|----------------------|
| `src/core/task/index.ts` | 3628 | Glowna klasa Task — petla agenta, orchestrator | Sekcja B: architektura agenta, petla, fail-safe |
| `src/core/task/ToolExecutor.ts` | 640 | Dispatcher narzedzi, PreToolUse/PostToolUse hooks | Sekcja B/E: tool execution, hooks |
| `src/shared/tools.ts` | ~200 | Enum 27 narzedzi (ClineDefaultTool) | Sekcja C/E: lista narzedzi |
| `src/core/api/index.ts` | ~400 | Factory providerow — buildApiHandler, createHandlerForProvider | Sekcja D: routing, 40+ providerow |
| `src/core/api/retry.ts` | ~100 | withRetry decorator — max 3 retries, exponential backoff | Sekcja D: retry bez failover |
| `src/core/api/providers/` | 40+ plikow | Dedykowane handlery per provider (anthropic, openai, bedrock, etc.) | Sekcja D: obsluga modeli |
| `src/core/prompts/system-prompt/variants/index.ts` | ~120 | Registry 12+ wariantow promptu per model family | Sekcja D: per-model optimization |
| `src/core/prompts/system-prompt/variants/config.template.ts` | ~80 | Builder pattern dla prompt variants | Sekcja D: jak tworzyc warianty |
| `src/core/hooks/hook-factory.ts` | ~100 | 9 typow hookow (PreToolUse, PostToolUse, etc.) | Sekcja E: extensibility |
| `src/core/hooks/hook-executor.ts` | ~200 | Shell execution hookow, 30s timeout, 50KB limit | Sekcja E: shell-script hooks |
| `src/core/task/tools/autoApprove.ts` | ~150 | AutoApprove class — YOLO, per-tool, path-aware | Sekcja F: approval settings |
| `src/core/permissions/CommandPermissionController.ts` | ~300 | Command permissions — glob patterns, redirect detection | Sekcja F: bash safety |
| `src/integrations/checkpoints/CheckpointGitOperations.ts` | ~200 | Shadow Git — initShadowGit, nested git handling | Sekcja G: snapshot system |
| `src/integrations/checkpoints/CheckpointTracker.ts` | ~300 | Checkpointy — commit, diff, restore | Sekcja G: undo/restore |
| `src/core/context/context-management/ContextManager.ts` | ~400 | Context truncation, compaction, tool_result alignment | Sekcja G: context management |
| `src/core/task/focus-chain/index.ts` | ~300 | FocusChainManager — TODO z file watcher, progress tracking | Sekcja G: stan zadan |
| `src/services/tree-sitter/index.ts` | ~160 | Tree-sitter parsing definicji, 17 jezykow | Sekcja C: code intelligence |
| `src/services/mcp/McpHub.ts` | ~500 | Pelny klient MCP — stdio/SSE/StreamableHTTP, OAuth, hot-reload | Sekcja E: MCP support |
| `src/core/context/instructions/user-instructions/cline-rules.ts` | ~200 | Globalne/lokalne reguly, remote rules, directory-based | Sekcja E: konfiguracja regul |
| `src/core/context/instructions/user-instructions/skills.ts` | ~120 | Skills discovery, SKILL.md parsing, global/project precedence | Sekcja E/H: skills system |
| `src/core/context/instructions/user-instructions/rule-conditionals.ts` | ~80 | Conditional activation regul — paths glob matching | Sekcja E: conditional rules |
| `src/core/context/instructions/user-instructions/workflows.ts` | ~40 | Workflow toggles — global i lokalne | Sekcja E: workflows |
| `src/core/task/tools/subagent/SubagentRunner.ts` | ~900 | Runner subagentow — petla, retry, tool execution | Sekcja B: subagent system |
| `src/core/task/tools/subagent/SubagentBuilder.ts` | ~150 | Builder subagentow — model override, tool whitelist, system prompt | Sekcja B: subagent konfiguracja |
| `src/core/task/tools/subagent/AgentConfigLoader.ts` | ~100 | Loader konfiguracji agentow z `.cline/agents/` | Sekcja B/E: custom agents |
| `src/core/task/StreamResponseHandler.ts` | ~300 | Obsluga streamingu — tool_use deltas, pending tool uses | Sekcja B: stream processing |
| `src/core/assistant-message/parse-assistant-message.ts` | ~200 | Parser odpowiedzi LLM na structured blocks z call_id | Sekcja B: tool call parsing |
| `src/core/task/message-state.ts` | ~200 | In-memory conversation history, persistence to disk | Sekcja G: historia konwersacji |
| `src/core/task/TaskState.ts` | ~100 | Centralny stan zadania — abort, mistakes, flags | Sekcja B: fail-safe state |
