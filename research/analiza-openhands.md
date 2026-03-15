# Analiza Konkurencyjna: OpenHands

> Data: 8 marca 2026
> Wersja analizowana: HEAD repozytorium (marzec 2026) — UWAGA: caly kod oznaczony "LEGACY V0 — deprecated since v1.0.0, scheduled for removal April 1, 2026". OpenHands V1 korzysta z oddzielnego Software Agent SDK.
> Repo: https://github.com/All-Hands-AI/OpenHands

---

## 1. Podsumowanie

OpenHands to open-source'owy AI coding agent napisany w Pythonie, skoncentrowany na **event-driven architecture** z wieloma typami agentow, sandboxingiem Docker/Kubernetes i web-first interfejsem. Glowna przewaga to **dojrzaly system kondensacji pamieci** (10 strategii + pipeline chaining), **pluggable security analyzers** (Invariant Labs, LLM-based, GraySwan) i **wieloplatformowy runtime** (Docker, Kubernetes, remote, local). Architektura jest modularna z EventStream jako centralnym message busem, ale projekt przechodzi masywna migracje z V0 do V1 (Software Agent SDK), co oznacza ze analizowany kod jest legacy i moze nie odzwierciedlac docelowej architektury. OpenHands celuje w enterprise/zespoly (web UI, multi-user sessions), podczas gdy DiriCode celuje w solo devow z CLI-first podejsciem. Kluczowe roznice: OpenHands ma sandbox (Docker), DiriCode nie (MVP). OpenHands nie ma repo map/LSP/AST-grep, DiriCode ma. OpenHands ma 10 kondenserow, DiriCode planuje sliding window + summary.

---

## 2. Matryca Porownawcza

### A. Tozsamosc i Pozycjonowanie

| Pytanie | OpenHands | DiriCode |
|---------|-----------|----------|
| Nazwa, licencja, jezyk implementacji | OpenHands (dawniej OpenDevin), MIT, Python | DiriCode, MIT (planowane), TypeScript |
| Glowny target user | Zespoly / enterprise — web UI z multi-user sessions, GitHub App, remote runtimes | Solo developer — CLI-first, lokalny agent |
| Interfejs | **Web-first** (React frontend, WebSocket streaming) + CLI mode (wtorny) | CLI (TUI Ink/React z vim motions) |
| GitHub stats | ~50K+ gwiazdek, wielu kontrybutorów, duzy team (All Hands AI Inc.) | Nowy projekt |
| Model biznesowy | OSS (MIT) + komercyjny hosting (openhands.ai SaaS) | OSS (MIT), BYOK |
| Pozycjonowanie | "Platform for software development agents" — nacisk na autonomie, sandboxing, multi-agent, enterprise | Lokalny CLI agent AI z architektura dispatcher-first |

**Wniosek:** Fundamentalnie rozne targety. OpenHands = platform/enterprise z web UI. DiriCode = solo dev z CLI. OpenHands ma wiekszy team i community, ale celuje w inny segment. Nie sa bezposrednimi konkurentami — raczej dwie strony spektrum (enterprise vs solo dev).

### B. Architektura Agenta

| Aspekt | OpenHands | DiriCode | Wniosek |
|--------|-----------|----------|---------|
| Ile agentow / rol? | **6 agentow**: CodeActAgent (glowny, pelny dostep do narzedzi), BrowsingAgent (browser), VisualBrowsingAgent (browser z vision), ReadOnlyAgent (read-only inspekcja), LocAgent (eksploracja repo), DummyAgent (testowy). Pliki: `openhands/agenthub/*/` | Dispatcher + 10 specjalistow | OpenHands ma mniej ról ale kazdą z pelnym dostepem. DiriCode ma wiecej specjalistow z ograniczonymi uprawnieniami |
| Czy agent glowny ma dostep do narzedzi modyfikujacych? | **TAK** — CodeActAgent ma pelny dostep: bash, file edit (str_replace + LLM-based), browser, IPython, MCP tools. Plik: `agenthub/codeact_agent/codeact_agent.py` (317 linii). Tools w `agenthub/codeact_agent/tools/` (12 narzedzi) | NIE (read-only dispatcher) | DiriCode bezpieczniejszy by design. OpenHands agent glowny moze wszystko modyfikowac |
| Jak wyglada delegacja? | **First-class delegation.** `AgentDelegateAction` w `events/action/agent.py` — agent emituje akcje delegacji, `AgentController` tworzy child controller z `is_delegate=True` i zwiekszonym `delegate_level`. Parent forwarduje eventy do delegate, wstrzymuje wlasne przetwarzanie. `start_delegate()` i `end_delegate()` w `controller/agent_controller.py` (~linii 735-864). `NestedEventStore` izoluje eventy delegate'a. `AgentDelegateObservation` zwraca wynik do parenta | Unlimited nesting + loop detector | Oba maja first-class delegacje. OpenHands bardziej formalny (event-driven z izolacja), DiriCode bardziej elastyczny (unlimited nesting). Porownywalne |
| Czy jest loop detection / fail-safe? | **TAK — rozbudowany.** `StuckDetector` w `controller/stuck.py` z 5 strategiami: (1) powtarzajace sie action/observation, (2) powtarzajace sie action/error, (3) monolog bez zmian srodowiska, (4) alternating pattern, (5) context window error loop. `max_iterations` budget z config. `LoopRecoveryAction` wyzwala kondensacje lub pauzuje. `AgentStuckInLoopError` zatrzymuje agenta | Tak (ADR-003: hard limit, token budget, loop detector) | OpenHands ma **bardziej dojrzaly stuck detector** z 5 heurystykami. DiriCode planuje 3 mechanizmy. Warto zaadaptowac heurystyki z OpenHands |
| Jak zarzadzaja kontekstem agenta? | EventStream jako centralny bus. `ConversationMemory` serializuje skondensowana historie do wiadomosci LLM. 10 kondenserow (sliding window, LLM summary, attention, structured, pipeline). Kontekst per agent: agent config + conversation memory + tools. Plik: `memory/conversation_memory.py`, `memory/condenser/` | Dispatcher = minimalny kontekst | OpenHands ma **znacznie bardziej rozbudowane zarzadzanie kontekstem**. 10 kondenserow vs 1 strategia w DiriCode. Pipeline chaining to killer feature |

**Wniosek:** OpenHands ma dojrzalsza architekture delegacji (event-driven, izolacja przez NestedEventStore) i **znacznie lepszy stuck detector** (5 heurystyk vs planowane 3 w DiriCode). Ale brak koncepcji read-only dispatchera — agent glowny ma pelny dostep. DiriCode's dispatcher-first jest bezpieczniejszy.

### C. Zrozumienie Kodu (Code Intelligence)

| Aspekt | OpenHands | DiriCode | Wniosek |
|--------|-----------|----------|---------|
| Jak "widzi" codebase? | **Brak repo map, brak AST, brak indeksowania.** Agent widzi pliki przez bash (`cat`, `ls`, `find`), `str_replace_editor` (read/edit), i `FileReadAction`. Brak automatycznego odkrywania struktury kodu. LocAgent ma `search_content` tool (grep-like). ReadOnlyAgent ma `grep` i `glob` tools | glob + grep + AST-grep + LSP | **DiriCode znacznie lepszy.** OpenHands polega calkowicie na agencie LLM aby "reczne" przeszukal pliki. Brak jakiegokolwiek code intelligence |
| Czy parsuje strukture kodu? | **NIE.** Brak Tree-sitter, brak AST parsingu, brak ekstrakcji klas/metod/sygnatur. Agent musi sam czytac pliki i rozumiec strukture | AST-grep tak, ale brak "repo map" | DiriCode lepszy — ma AST-grep do wyszukiwania wzorcow kodu |
| Jak wybiera pliki do kontekstu? | **Agent decyduje reczne.** LLM sam musi zdecydowac ktore pliki otworzyc/przeczytac. Microagent system (`.md` files z frontmatter) moze wstrzyknac wiedze o repo (jak `.cursorrules`), ale to manualne instrukcje, nie automatyczne indeksowanie. Plik: `microagent/microagent.py` | Agent dispatcher decyduje na podstawie opisu zadania | Porownywalne — oba polegaja na decyzji agenta LLM. Ale DiriCode ma lepsze narzedzia do eksploracji (AST-grep, LSP) |
| Czy ma LSP integration? | **NIE.** Brak LSP. Auto-lint po edycji w `runtime/utils/edit.py` (optional linter) ale to nie jest LSP | Tak, top-10 jezykow lazy install | **DiriCode znacznie lepszy.** LSP daje goto-definition, find-references, rename, diagnostics — czego OpenHands w ogole nie ma |
| Jak radzi sobie z duzymi repozytoriami? | **Slabo.** Brak indeksowania, brak cache. Agent musi reczne nawigowac. Microagents (`.md` instrukcje) moga pomoc ale to manualne. Jedyny mechanizm skalowania: kondensery kompresuja historie (nie kod) | Nieznane — potencjalna luka | OpenHands gorzej niz DiriCode. Ale DiriCode tez nie ma repo map (luka wspolna z Aiderem) |

**Wniosek:** Code intelligence to **slaby punkt OpenHands**. Brak repo map, AST, LSP — calkowicie polega na LLM aby reczne eksplorowal pliki. DiriCode z AST-grep + LSP jest znacznie lepszy. To potwierdza ze DiriCode potrzebuje Repository Intelligence (ADR nowy z analizy Aider) — ale juz teraz jest daleko przed OpenHands w tym obszarze.

### D. Routing i Obsluga Modeli

| Aspekt | OpenHands | DiriCode | Wniosek |
|--------|-----------|----------|---------|
| Ile providerow / modeli? | Przez **LiteLLM** — wspiera wszystkich providerow LiteLLM: OpenAI, Anthropic, Azure, Bedrock (dedykowany adapter `bedrock.py`), OpenRouter, Groq, DeepSeek, Kimi, Gemini, + litellm_proxy. Plik: `llm/llm.py`, `llm/model_features.py` | 22 providerow via Vercel AI SDK | Porownywalne. OpenHands przez LiteLLM (Python), DiriCode przez Vercel AI SDK (TS). Oba szerokie wsparcie |
| Czy ma failover? | **Czesciowe.** `RouterLLM` w `llm/router/base.py` z `MultimodalRouter` w `llm/router/rule_based/impl.py` — primary/secondary model selection. Jesli primary nie obsluguje multimodal content lub przekracza token limit → fallback do secondary. Ale to nie jest failover na bledy API — to rule-based routing | Tak (ADR-011: order-based failover) | DiriCode lepszy — failover na bledy API. OpenHands robi failover tylko na content-type/token limits |
| Czy ma race mode? | **NIE.** Brak concurrent requests. Rule-based selection: primary lub secondary, sekwencyjnie | Tak (ADR-011: race mode) | DiriCode lepszy |
| Per-agent model assignment? | **TAK.** `agent_config.py` zawiera `llm` field — kazdy agent moze miec osobna konfiguracje LLM. `LLMRegistry` w `llm/llm_registry.py` tworzy instancje per `service_id`. `agent_to_llm_config` mapping w konfiguracji. Pliki: `core/config/agent_config.py`, `llm/llm_registry.py` | Tak (dispatcher=fast, writer=deep, itd.) | Porownywalne — oba maja per-agent model assignment |
| Jak radzi sobie z non-Claude modelami? | Provider-specific tweaks w `llm.py`: Azure model naming, Gemini thinking params, litellm_proxy rewriting. `model_features.py` normalizuje nazwy modeli i mapuje capabilities (vision, token limits). Brak per-model edit format optimization (w przeciwienstwie do Aidera) | Adaptery per provider — do zweryfikowania | OpenHands ma basic provider tweaks ale brak per-model edit format optimization. DiriCode powinien miec to z ADR-011 rozszerzenia |
| Czy zalezy od LiteLLM? | **TAK — calkowicie.** `litellm.completion`, `litellm.acompletion`, `litellm.get_model_info`, `litellm.completion_cost` — wszedzie. `RetryMixin` w `llm/retry_mixin.py` uzywa tenacity z retries na litellm exceptions. Plik: `llm/llm.py` | NIE — wlasny TS Router (ADR-011) | DiriCode niezalezny. OpenHands (jak Aider) calkowicie zalezy od LiteLLM. Potwierdza ADR-011 |
| Cost tracking? | **TAK — rozbudowany.** `metrics.py` sledzi `TokenUsage`, `Cost`, `ResponseLatency`, `accumulated_cost`. `llm._completion_cost()` uzywa litellm.completion_cost lub response headers. Wsparcie cache read/write tokens. Plik: `llm/metrics.py` | Do zaimplementowania | OpenHands ma **dojrzaly cost tracking** — warto zaadaptowac |

**Wniosek:** OpenHands ma porownywalne wsparcie providerow (przez LiteLLM) i per-agent assignment, ale **slabszy failover** (rule-based, nie error-based) i **brak race mode**. Cost tracking dojrzaly. Calkowita zaleznosc od LiteLLM to ryzyko (tak jak u Aidera). DiriCode lepszy w routing, gorszy w cost tracking.

### E. System Hookow i Rozszerzalnosc

| Aspekt | OpenHands | DiriCode | Wniosek |
|--------|-----------|----------|---------|
| System hookow/pluginow? | **Brak lifecycle hooks.** Rozszerzalnosc przez: (1) microagents (`.md` files z frontmatter — knowledge injection, jak `.cursorrules`), (2) config flags (`enable_browsing`, `enable_jupyter`, etc.), (3) SecurityAnalyzer plugins (pluggable), (4) Condenser plugins (pluggable pipeline). Pliki: `microagent/microagent.py`, `memory/condenser/condenser.py` | 12 lifecycle hooks, lazy loading | DiriCode lepszy — 12 explicit lifecycle hooks vs implicit config flags |
| Ile extension points? | **~6:** (1) microagents `.md` files, (2) MCP tools (dynamic), (3) SecurityAnalyzer implementations, (4) Condenser implementations, (5) Runtime implementations (Docker/K8s/remote/local), (6) config flags. Ale brak formalnego plugin API | 12 hookow + MCP client + pliki .md agentow | DiriCode ma wiecej i lepiej zdefiniowane extension points |
| Custom agenci? | **TAK** — mozna tworzyc nowych agentow dziedziczac po `Agent` base class w `agenthub/`. Kazdy agent rejestruje sie w registry. Ale brak mechanizmu ladowania agentow z konfiguracji usera (trzeba forkowac repo lub dodac do agenthub). Plik: `controller/agent.py` (Agent registry) | Tak — `.diricode/agents/` (pliki config) | DiriCode lepszy — user definiuje agentow w plikach config bez forkowania |
| MCP support? | **TAK — first-class.** `mcp/client.py` (fastmcp Client z SSE, Stdio, StreamableHTTP). `runtime/mcp/proxy/manager.py` — MCP proxy wewnatrz sandbox. `/update_mcp_server` endpoint w action_execution_server. Agent.set_mcp_tools w `controller/agent.py`. Microagents moga deklarowac MCP tools | Tak, GitHub MCP wbudowany + zewnetrzne | Porownywalne. OpenHands ma bardziej rozbudowany MCP z proxy wewnatrz sandbox. DiriCode prostszy |
| Konfiguracja | Python dataclasses + TOML/env vars. `core/config/openhands_config.py`. Brak type-safe client-side config | `diricode.config.ts` (type-safe) | DiriCode lepszy — TS type-safe config z auto-complete |
| Microagent system? | **TAK — unikalny pattern.** `.md` files z YAML frontmatter: `name`, `agent`, `type` (knowledge/repo), `triggers` (keyword-based injection). Obsluguje `.cursorrules`, `agents.md`. `RepoMicroagent` wstrzykuje instrukcje do systemu agenta per repo. Plik: `microagent/microagent.py` | `.diricode/agents/` + pliki `.md` | Porownywalne koncepcje. OpenHands microagent = DiriCode custom agent files. OpenHands ma `triggers` (keyword-based injection) — interesujacy pattern |

**Wniosek:** OpenHands ma **rozbudowany MCP z sandbox proxy** i **unikalny microagent system z keyword triggers**. Ale brak formalnych lifecycle hooks — rozszerzalnosc jest implicit (config flags, dziedziczenie). DiriCode lepszy w explicit extension points (12 hooks). Z OpenHands warto zaadaptowac: **microagent keyword triggers** i **MCP sandbox proxy pattern**.

### F. Bezpieczenstwo i Approval

| Aspekt | OpenHands | DiriCode | Wniosek |
|--------|-----------|----------|---------|
| Approval przed destrukcja? | **TAK — rozbudowany.** `confirmation_mode` w `security_config.py`. `AgentController` sprawdza kazda akcje przez `SecurityAnalyzer`, ustawia `action.confirmation_state`. Jesli risk=HIGH lub risk=UNKNOWN (bez analyzera) → wymaga potwierdzenia. `ActionSecurityRisk` enum: LOW/MEDIUM/HIGH/UNKNOWN. `ActionConfirmationStatus`: CONFIRMED/REJECTED/AWAITING_CONFIRMATION. Pliki: `controller/agent_controller.py` (~979-1019), `events/action/action.py` | Tak (ADR-004: Smart — AI ocenia ryzyko) | **Porownywalne.** Oba maja AI-driven risk assessment. OpenHands ma wiecej formalnych stanow (UNKNOWN → confirmation). DiriCode prostszy (3 kategorie) |
| 3 kategorie ryzyka? | **TAK — 4 kategorie**: LOW, MEDIUM, HIGH, UNKNOWN. HIGH + UNKNOWN (bez analyzera) wyzwalaja confirmation. LLM przypisuje `security_risk` do kazdego tool call (deklarowane w tool description). Plik: `agenthub/codeact_agent/tools/bash.py` (tool deklaruje security_risk requirement) | Tak — safe/risky/destructive, konfigurowalne | OpenHands ma 4 kategorie (+ UNKNOWN), DiriCode 3. Obie scisle zdefiniowane |
| Ochrona przed wyciekiem sekretow? | **TAK — wielowarstwowa.** (1) Logger redaction: sensitive values → `******` (`core/logger.py` ~260-296). (2) Serialization gating: `model_dump(context={'expose_secrets': True})` w `storage/data_models/secrets.py`. (3) Memory masking: `observation_masking_condenser.py`. (4) Invariant policy: "Disallow secrets in bash commands" (`security/invariant/policies.py`). (5) SecretStr per-path exposure | Tak (ADR-014: auto-redakcja regex+heurystyki) | OpenHands ma **bardziej dojrzala ochrone sekretow** — 5 warstw vs regex+heurystyki. Warto zaadaptowac wielowarstwowe podejscie |
| Sandboxing? | **TAK — first-class.** Docker sandbox (default): `runtime/impl/docker/docker_runtime.py`. Kubernetes: `runtime/impl/kubernetes/kubernetes_runtime.py`. Remote (sysbox/gvisor): `runtime/impl/remote/remote_runtime.py`. Local (bez sandbox): `runtime/impl/local/local_runtime.py`. Overlay mounts (COW per container). Workspace path sanitization (blokada `..` traversal). Plik: `runtime/base.py` | NIE w MVP (→ v2) | **OpenHands znacznie lepszy.** Docker/K8s/remote sandboxing = izolacja. DiriCode brak sandbox w MVP — akceptowalne dla solo dev, ale luka |
| Git safety rails? | **Czesciowe.** `GitHandler` w `runtime/utils/git_handler.py` — `shlex.quote` na sciezkach, fallback do Python scripts zamiast arbitrary shell. `git_changes.py` z walidacja inputu. Pre-commit hooks: `.openhands/pre-commit.sh` w `app_conversation_service_base.py`. `send_pull_request.py` — subprocess z explicit arguments. Nie znaleziono `push --force` ani `reset --hard` w scanned code | Tak (ADR-010: blokada `git add .`, `push --force`, `reset --hard`) | DiriCode bardziej explicit — dedykowane blokady. OpenHands ma ogolne bezpieczenstwo (quoting, controlled commands) ale brak explicit blocklist |
| Parsowanie bash? | **TAK — bashlex.** `runtime/utils/bash.py` — `split_bash_commands()` uzywa `bashlex.parse()`, `escape_bash_special_chars()`. `BashSession` — persistent shell z job handling i timeouts. Invariant policies skanuja bash content dla sekretow | Tree-sitter (ADR-015) | Oba parsuja bash. OpenHands: bashlex (dedykowany bash parser). DiriCode: Tree-sitter (ogolny parser). Porownywalne bezpieczenstwo |

**Wniosek:** Bezpieczenstwo to **mocna strona OpenHands** — sandboxing Docker/K8s, pluggable security analyzers (Invariant Labs, LLM-based, GraySwan), wielowarstwowa ochrona sekretow, bashlex parsing. DiriCode ma lepsze explicit git safety rails i Tree-sitter bash parsing, ale **brak sandbox to istotna luka**. Z OpenHands warto zaadaptowac: **wielowarstwowa ochrona sekretow** i **pluggable security analyzer architecture**.

### G. Pamiec i Stan

| Aspekt | OpenHands | DiriCode | Wniosek |
|--------|-----------|----------|---------|
| Trwala pamiec miedzy sesjami? | **TAK — event persistence.** EventStream persystuje do FileStore (local, S3, Google Cloud). `State.save_to_session()` / `restore_from_session()` w `controller/state/state.py`. Session ID generowany w `core/setup.py`. Ale brak "project memory" w stylu GitHub Issues — pamiec jest per-session, nie per-project | GitHub Issues jako project memory (ADR-007) | DiriCode lepszy pod wzgledem project memory (cross-session). OpenHands lepszy pod wzgledem session persistence (save/restore) |
| Przechowywanie stanu zadan? | **TAK** — `task_tracker.py` tool w `agenthub/codeact_agent/tools/` — agent moze sledzic postep zlozonych zadan. Stan sesji: `State` object z iteracjami, metrykami, outputami. Brak external TODO persistence | Pliki Markdown `.diricode/todo.md` (ADR-013) | DiriCode lepszy — explicit Markdown TODO. OpenHands task_tracker jest in-memory per session |
| Snapshot / undo? | **Czesciowe.** `_truncate_memory_to_point()` w `agent_controller.py` — rollback pamieci do recovery point. `replay.py` dla replay event traces. `LoopRecoveryAction` wyzwala kondensacje jako forma "soft undo". Brak git-based undo. Event store layering (`nested_event_store.py`) umozliwia transactional behavior | Brak snapshota — git worktrees (ADR-008) | Rozne podejscia: OpenHands ma memory rollback (event-based), DiriCode ma git worktrees (file-based). Oba wazne. OpenHands memory rollback jest unikatowy |
| Context compaction? | **10 kondenserow — KILLER FEATURE:** (1) `conversation_window` — keep essential + drop old, (2) `amortized_forgetting` — rolling size-based forgetting, (3) `llm_summarizing` — LLM podsumowuje zapomniane eventy, (4) `llm_attention` — LLM wybiera co zachowac, (5) `structured_summary` — function-call based summaries, (6) `recent_events` — keep last N, (7) `observation_masking` — maskuj stare observations, (8) `browser_output` — kompresja browser output, (9) `no_op` — pass-through, (10) `pipeline` — chain condensers. Pliki: `memory/condenser/impl/*.py` | Sliding window + summary na 90-95% (ADR-009) | **NAJWAZNIEJSZE ODKRYCIE.** OpenHands ma 10 kondenserow z pipeline composition. DiriCode planuje 1 strategie. Pipeline chaining pozwala np.: observation_masking → amortized_forgetting → llm_summarizing → recent_events. To fundamentalnie lepsze podejscie |
| Jak radzi sobie z git worktrees? | **Brak explicit worktree support.** Git ops w `runtime/utils/git_handler.py`, `git_diff.py`, `git_changes.py`. `repo_ops.py` — higher-level repo operations. PR flow w `resolver/send_pull_request.py`. Repository info wstrzykiwany do memory (`memory.set_repository_info`). Brak worktree isolation | Natywnie — GitHub Issues globalne per repo | DiriCode lepszy — natywne worktrees z izolacja |

**Wniosek:** System kondensacji pamieci to **KILLER FEATURE OpenHands** — 10 strategii + pipeline composition to fundamentalnie lepsze podejscie niz pojedyncza strategia. DiriCode powinien **koniecznie zaadaptowac pipeline condenser** (ADR-009 wymaga przerobienia). Session persistence (save/restore) tez dojrzala. Ale brak project memory (cross-session) i brak git worktrees.

### H. UX i Developer Experience

| Aspekt | OpenHands | DiriCode | Wniosek |
|--------|-----------|----------|---------|
| Time-to-first-use | Web UI: zaloguj sie na openhands.ai → gotowe. Self-hosted: Docker Compose → web UI. CLI: `pip install openhands-ai && openhands` — ale wymaga konfiguracji (API keys, runtime). Wiecej krokow niz Aider | Do zbadania — planowane `npx diricode` | DiriCode planuje prostszy start (npx). OpenHands wymaga Docker do sandbox |
| Vim motions? | **NIE.** Web UI — standard browser. CLI mode — basic terminal | Od dnia 1 (TUI Ink) | DiriCode lepszy |
| Streaming? | WebSocket streaming w web UI. EventStream-based w CLI | SSE (ADR-001) | Porownywalne. OpenHands WebSocket, DiriCode SSE |
| Lean mode? | **NIE.** Brak dedykowanego lean mode. Mozna wylaczac features przez config (disable_browsing, etc.) ale brak jednego flaga | `--lean` (ADR-006) | DiriCode lepszy |
| Jakosc dokumentacji? | Dobra — rozbudowana strona docs, API reference, tutorials. Ale V0→V1 migration oznacza ze wiele docs moze byc outdated | Do stworzenia | OpenHands ma docs ale ryzyko outdated content |
| Onboarding? | Web UI: Google/GitHub OAuth → gotowe. CLI: wymaga manualnej konfiguracji LLM i runtime. Provider tokens z env vars (`core/setup.py`) | Do zbadania | OpenHands web onboarding = dobry. CLI onboarding = slabszy |
| Task tracker? | **TAK** — `task_tracker.py` tool pozwala agentowi sledzic postep zlozonych zadan. Ciekawy pattern — agent sam organizuje swoja prace | Planowane | Interesujacy pattern — agent-driven task management |
| Cost tracking? | Tak — per-call metrics w `llm/metrics.py`. TokenUsage, Cost, ResponseLatency. Accumulated cost per sesja. Cache read/write tracking | Do zaimplementowania | OpenHands ma dojrzaly cost tracking (podobnie jak Aider) |

**Wniosek:** OpenHands jest web-first — dobry UX w przegladarce, slabszy w CLI. DiriCode jest CLI-first — lepszy UX w terminalu (vim motions, lean mode, SSE streaming). Z OpenHands warto zaadaptowac: **agent-driven task tracker** pattern i **cost tracking z cache awareness**.

---

## 3. Co DiriCode Powinien Zaadaptowac

| # | Co | Dlaczego | Priorytet | Wplyw na ADR |
|---|-----|---------|----------|-------------|
| 1 | **Pipeline Condenser (kompozycja kondenserow)** — mozliwosc chainowania wielu strategii kompakcji: np. observation_masking → amortized_forgetting → llm_summarizing → recent_events. Kazdy condenser w pipeline przetwarza wynik poprzedniego | OpenHands ma 10 kondenserow + pipeline composition w `memory/condenser/impl/pipeline.py`. DiriCode planuje tylko sliding window + summary. Pipeline pozwala na precyzyjne tuning: najpierw zamaskuj stare observations (tanio), potem zapomnij najstarsze (tanio), potem podsumuj LLM (drogo), potem zachowaj ostatnie N. To fundamentalnie lepsze podejscie | **P0** | **ADR-009** — przebudowac z "sliding window + summary" na "condenser pipeline z pluggable strategiami". Minimum 4 strategie w MVP: window, observation_masking, llm_summary, recent_events |
| 2 | **Wielowarstwowa ochrona sekretow** — nie tylko regex na wejsciu, ale: (1) redakcja w logach, (2) controlled serialization (expose_secrets context), (3) maskowanie w pamieci (condenser), (4) policy-based blocking (nie wysylaj sekretow w bash) | OpenHands ma 5 warstw ochrony sekretow: logger redaction, serialization gating, memory masking, invariant policy, SecretStr. Kazda warstwa lapie inny wektor wycieku. DiriCode planuje regex+heurystyki — to tylko 1 warstwa | **P0** | **ADR-014** — rozszerzyc z "regex+heurystyki" na wielowarstwowe podejscie: (1) input redaction (regex), (2) output redaction (przed logowaniem), (3) memory masking (condenser layer), (4) serialization gating (expose_secrets context) |
| 3 | **Stuck Detector z wieloma heurystykami** — 5 strategii detekcji: repeating action/observation, repeating action/error, monolog, alternating pattern, context window error loop | OpenHands `stuck.py` ma 5 dobrze zdefiniowanych heurystyk. DiriCode ADR-003 planuje hard limit + token budget + loop detector, ale bez konkretnych heurystyk. OpenHands heurystyki sa battle-tested | **P1** | **ADR-003** — dodac konkretne heurystyki stuck detection: (1) powtarzajacy sie action+observation pattern, (2) powtarzajacy sie action+error, (3) monolog bez side-effects, (4) context window overflow loop. Implementacja w loop detectorze |
| 4 | **Pluggable Security Analyzer architecture** — bazowa klasa `SecurityAnalyzer` z pluggable implementations (LLM-based, rule-based, external service) | OpenHands ma `SecurityAnalyzer` base + 3 implementacje (Invariant, LLM, GraySwan) w `security/`. DiriCode ADR-004 opisuje Smart Approval ale bez pluggable architecture. Pattern OpenHands pozwala np. dodac custom analyzery per organizacja | **P1** | **ADR-004** — rozszerzyc o pluggable analyzer interface. MVP: LLM-based analyzer (jak teraz). v2: mozliwosc dodania custom analyzers przez hooks |
| 5 | **Microagent keyword triggers** — automatyczne wstrzykiwanie wiedzy do kontekstu agenta na podstawie keyword matching w user input | OpenHands `microagent.py` — `KnowledgeMicroagent` ma `triggers` (lista keywordow). Jesli user message zawiera keyword → wiedza z `.md` file jest wstrzykiwana do system prompt. Np. trigger "docker" → wstrzykuj instrukcje o Docker. DiriCode ma custom agents ale bez keyword-based injection | **P2** | **ADR-005** (hooks) — rozwazyc hook `agent.prompt.before` ktory wstrzykuje knowledge z `.diricode/knowledge/*.md` na podstawie keyword matching |
| 6 | **Memory rollback to recovery point** — mozliwosc cofniecia pamieci agenta do okreslonego punktu (nie calej sesji, a konkretnego momentu) | OpenHands `_truncate_memory_to_point()` w `agent_controller.py` pozwala na rollback pamieci bez rollback plikow. Uzyteczne przy loop recovery — agent "zapomina" zla sciezke i probujesz od nowa. DiriCode nie ma tego mechanizmu | **P2** | **ADR-009** — dodac mozliwosc memory rollback jako czesc pipeline condenser. Trigger: loop detection lub user `/undo-memory` command |
| 7 | **Cost tracking z cache awareness** — per-call: tokeny (prompt/completion/cache_hit/cache_write) + koszt USD. Per-sesja accumulated cost. Per-agent cost breakdown | OpenHands `llm/metrics.py` — TokenUsage, Cost, ResponseLatency z cache read/write tracking. Podobnie Aider. DiriCode nie ma cost tracking | **P1** | **ADR nowy** — dodac cost tracking. Vercel AI SDK zwraca usage — wystarczy zbierac i wyswietlac w TUI. Per-agent breakdown = bonus |

---

## 4. Czego DiriCode Powinien Unikac

| # | Co | Dlaczego to problem | Jak DiriCode to rozwiazuje |
|---|-----|--------------------|-----------------------------|
| 1 | **Web-first architecture narzucona na CLI** — OpenHands jest zaprojektowany jako web platform. CLI mode jest wrecz afterthought — wymaga Docker, konfiguracji runtime, WebSocket. To sprawia ze CLI experience jest ciezki i wymaga wiele setup | DiriCode celuje w solo devow ktory chca `npx diricode` i gotowe. Przyjecie web-first architektury oznaczaloby powolniejszy start, wieksze zaleznosci, gorszy CLI UX. Web UI moze przyjsc w v2 jako addon, nie core | ADR-001: CLI-first (TUI Ink). Solo dev nie potrzebuje web UI, Docker sandbox, multi-user sessions. Zachowac prosty start |
| 2 | **Calkowita zaleznosc od Docker do podstawowego dzialania** — OpenHands wymaga Docker do sandboxing nawet dla prostych operacji edycji plikow. Bez Docker = brak sandboxu = degraded experience. Docker images musza byc zbudowane (long startup) | DiriCode w MVP nie ma sandbox (ADR: sandbox v2). Narzucenie Docker = friction dla solo dev ktory chce szybko zaczac. Sandboxing powinien byc opcjonalny, nie wymagany | ADR: sandbox odlozony do v2. MVP dziala bez Docker. Jesli sandbox bedzie dodany — opcjonalny, nie wymagany |
| 3 | **Brak code intelligence (repo map, AST, LSP) mimo rozbudowanej architektury** — OpenHands ma 6 agentow, 10 kondenserow, pluggable security, Docker sandbox... ale agent nie ma zadnych narzedzi do inteligentnego rozumienia kodu. Polega calkowicie na LLM aby reczne nawigowac pliki | To anty-wzorzec: rozbudowana infrastruktura bez core intelligence. Agent ma sandboxed bash i file edit — ale nie wie jaka jest struktura kodu. DiriCode z AST-grep + LSP jest lepszy — i powinien dalej inwestowac w code intelligence zamiast infrastrukture | ADR: AST-grep + LSP jako core narzedzia. Dodac Repository Intelligence (ADR nowy). Nie powtarzac bledu OpenHands — agent musi "widziec" kod |
| 4 | **V0→V1 migration chaos** — caly analizowany kod jest oznaczony jako "LEGACY V0 — deprecated since v1.0.0". OpenHands przepisuje architekture z Python monolith na Software Agent SDK. Oznacza to ze: (1) dokumentacja moze byc outdated, (2) API jest niestabilne, (3) uzytkownicy moga byc zdezorientowani | DiriCode powinien od poczatku projektowac stabilne API z wersjonowaniem. Unikac masywnych migration (Python V0 → SDK V1) ktore destabilizuja ekosystem. Modularna architektura DiriCode (hooks, config, agents) powinna byc projektowana na dlugi czas | ADR-005 (hooks), ADR-012 (agenci): projektowac API z myslą o backward compatibility. Semantic versioning od dnia 1 |
| 5 | **Agent glowny z pelnym dostepem do narzedzi modyfikujacych** — CodeActAgent ma bash, file edit, browser, IPython — wszystko. Brak separacji read/write. Agent moze przypadkowo zmodyfikowac pliki bez intencji usera | DiriCode's dispatcher-first (ADR-002) = agent glowny jest read-only. Modyfikacje delegowane do specjalistow z ograniczonymi uprawnieniami. To bezpieczniejsze i bardziej kontrolowane | ADR-002: Dispatcher-first. Nigdy nie dawac agentowi glownemu narzedzi modyfikujacych. Zawsze delegowac |

---

## 5. Otwarte Pytania

1. **Czy pipeline condenser wymaga przebudowy ADR-009?** OpenHands podejscie (10 kondenserow + pipeline composition) jest fundamentalnie lepsze niz "sliding window + summary". Pytanie: ile kondenserow DiriCode potrzebuje w MVP? Minimalne: (1) observation_masking (tanio — zamaskuj stare tool outputs), (2) conversation_window (keep last N), (3) llm_summary (drogo — podsumuj zapomniane). Czy pipeline composition jest wystarczajaco prosta aby dodac ja do MVP, czy to v2?

2. **Czy DiriCode potrzebuje event-driven architecture (EventStream)?** OpenHands uzywa EventStream jako centralnego message busa — wszystkie actions i observations sa eventami. To daje: persistence, replay, debugging, audit trail. DiriCode nie ma takiego busa — agenci komunikuja sie bezposrednio. Pytanie: czy EventStream pattern byłby wartosciowy dla DiriCode? Pro: persistence, replay, debugging. Con: zlozonosc, overhead, latencja.

3. **Jak zaimplementowac wielowarstwowa ochrone sekretow w TypeScript?** OpenHands ma 5 warstw w Python (logger, serialization, memory, policy, SecretStr). DiriCode planuje regex+heurystyki (ADR-014). Pytanie: jak mapowac te warstwy na TS? (1) Logger middleware (winston/pino interceptor), (2) serialization gating (custom toJSON), (3) condenser layer (nowy), (4) tool execution middleware (hook `tool.execute.before`). Czy 4 warstwy wystarczą?

4. **Czy sandbox (Docker) powinien byc wczesniej niz v2?** OpenHands pokazuje ze sandbox jest fundamentalny dla bezpieczenstwa — izoluje agenta od systemu hosta. DiriCode odlozyl to do v2. Ale: czy bez sandbox DiriCode jest wystarczajaco bezpieczny dla solo dev? ADR-004 (Smart Approval) + ADR-015 (bash parsing) + ADR-010 (git safety) pokrywaja czesc ryzyka, ale nie wszystko. Pytanie: czy warto dodac opcjonalny lightweight sandbox (np. bubblewrap/firejail) do MVP?

5. **Jak OpenHands V1 (Software Agent SDK) zmieni landscape?** Caly analizowany kod to legacy V0. V1 korzysta z oddzielnego `software-agent-sdk`. Pytanie: czy warto przeanalizowac V1 SDK gdy bedzie stabilny? Moze miec zupelnie inna architekture. Rekomendacja: re-analiza za 3-6 miesiecy gdy V1 dojrzeje.

---

## 6. Rekomendacje dla Specyfikacji DiriCode

### 6.1 Zmiany w istniejacych ADR-ach

| ADR | Obecna decyzja | Proponowana zmiana | Priorytet | Uzasadnienie |
|-----|---------------|-------------------|----------|-------------|
| **ADR-003** | Hard limit + token budget + loop detector | Dodac: **5 konkretnych heurystyk stuck detection** wzorowanych na OpenHands: (1) repeating action+observation, (2) repeating action+error, (3) monolog bez side-effects, (4) alternating action pattern, (5) context window overflow loop. Kazda heurystyka z konfigurowalnym progiem | P1 | OpenHands `stuck.py` ma battle-tested heurystyki. DiriCode ADR-003 jest zbyt ogolny — brakuje konkretnych strategii detekcji |
| **ADR-004** | Smart Approval (AI ocenia ryzyko) | Dodac: **pluggable analyzer interface** — bazowy `SecurityAnalyzer` z mozliwoscia dodawania custom implementations. MVP: LLM-based (jak teraz). v2: rule-based, external service. Hook `action.security.before` | P1 | OpenHands ma 3 pluggable analyzery. DiriCode powinien miec interface aby organizacje mogly dodac wlasne analizatory ryzyka |
| **ADR-009** | Sliding window + summary na 90-95% | **Przebudowa na pipeline condenser.** Minimum 4 kondensery w MVP: (1) observation_masking (zamaskuj stare tool outputs — tanio), (2) conversation_window (keep last N), (3) llm_summary (podsumuj zapomniane — drogo), (4) recent_events (keep last K). Pipeline: 1→2→3→4. Konfigurowalne per profil | **P0** | OpenHands ma 10 kondenserow + pipeline. Pojedyncza strategia DiriCode nie wystarczy dla dlugich sesji. Pipeline daje elastycznosc i optymalizacje kosztow |
| **ADR-014** | Auto-redakcja regex + heurystyki | Rozszerzyc na **4 warstwy ochrony**: (1) input redaction (regex — jak teraz), (2) output redaction (przed logowaniem), (3) memory masking (condenser layer — maskuj sekrety w starych observations), (4) serialization gating (expose_secrets context na obiektach z sekretami) | **P0** | OpenHands ma 5 warstw. Pojedyncza warstwa regex nie wystarczy — sekrety moga wyciec przez logi, pamiec agenta, serializacje |

### 6.2 Nowe elementy do specyfikacji

| Propozycja | Opis | Priorytet | Uzasadnienie |
|-----------|------|----------|-------------|
| **Cost Tracking z Cache Awareness** | Per-call: tokeny (prompt/completion/cache_hit/cache_write) + koszt USD. Per-sesja: accumulated cost. Per-agent: ile zuzyl kazdy agent. Wyswietlane w TUI (status bar lub per-message). Vercel AI SDK zwraca usage — wystarczy zbierac i formatowac | **P1** | Zarowno OpenHands jak i Aider maja cost tracking. DiriCode nie ma. Krytyczne dla user trust |
| **Microagent Knowledge Triggers** | Pliki `.diricode/knowledge/*.md` z frontmatter: `triggers: [keyword1, keyword2]`. Jesli user message zawiera trigger keyword → tresc pliku wstrzykiwana do system prompt agenta. Daje context-aware knowledge injection bez manualnego ladowania | **P2** | OpenHands microagent system z keyword triggers jest elegancki. Mozna zaimplementowac jako hook `agent.prompt.before` |
| **Memory Rollback API** | Mozliwosc cofniecia pamieci agenta do konkretnego punktu (nie calej sesji). Trigger: loop detection, user command `/undo-memory`, lub condenser decision. Implementacja: oznacz punkt w historii, odrzuc eventy po tym punkcie | **P2** | OpenHands `_truncate_memory_to_point()` jest unikatowy. Przydatny przy loop recovery — agent "zapomina" zla sciezke |

### 6.3 Potwierdzone decyzje

Analiza OpenHands **potwierdza** poprawnosc nastepujacych decyzji DiriCode:

| ADR | Decyzja | Potwierdzenie z OpenHands |
|-----|---------|--------------------------|
| **ADR-001** | CLI-first (TUI Ink) | OpenHands jest web-first — CLI mode jest afterthought wymagajacy Docker. DiriCode's CLI-first = prostszy start, lepszy DX dla solo dev |
| **ADR-002** | Dispatcher-first (zero narzedzi modyfikujacych na agencie glownym) | OpenHands CodeActAgent ma pelny dostep (bash, edit, browser). Brak separacji read/write = mniejsza kontrola. DiriCode's read-only dispatcher jest bezpieczniejszy |
| **ADR-007** | GitHub Issues jako project memory | OpenHands ma session persistence ale brak cross-session project memory. DiriCode's GitHub Issues = lepsza pamiec projektu |
| **ADR-008** | Git worktrees zamiast snapshot | OpenHands nie ma git worktrees. Memory rollback to nie to samo co file rollback. DiriCode's git worktrees = lepsza izolacja pracy agenta |
| **ADR-010** | Git safety rails (explicit blocklist) | OpenHands ma ogolne bezpieczenstwo (shlex.quote, controlled commands) ale brak explicit blocklist (`push --force`, `reset --hard`). DiriCode's explicit blocklist jest bezpieczniejszy |
| **ADR-011** | Wlasny TS Router (bez LiteLLM) | OpenHands (jak Aider) calkowicie zalezy od LiteLLM. DiriCode's wlasny router eliminuje te zaleznosc i ryzyko |
| **ADR-013** | Stan w Markdown (nie SQLite) | OpenHands uzywa binarnego State object z save/restore. DiriCode's Markdown state jest bardziej czytelny, debuggowalny, git-friendly |
| **ADR-015** | Tree-sitter bash parsing | OpenHands uzywa bashlex (dedykowany bash parser). Oba podejscia dobre — potwierdza ze parsowanie bash jest wazne |

---

## Appendix: Kluczowe Pliki Zrodlowe OpenHands

| Plik | Linii (ok.) | Co zawiera | Znaczenie |
|------|-------------|-----------|----------|
| `controller/agent_controller.py` | 1392 | Glowna petla agenta, delegacja, stuck detection, confirmation, loop recovery | **Kluczowy** — serce systemu |
| `controller/stuck.py` | ~500 | StuckDetector: 5 heurystyk detekcji petli | **Wazny** — inspiracja dla ADR-003 |
| `agenthub/codeact_agent/codeact_agent.py` | 317 | Glowny agent CodeAct — function calling, tool mapping | Wazny — porownanie z DiriCode dispatcher |
| `agenthub/readonly_agent/readonly_agent.py` | ~100 | Read-only agent (inspekcja bez modyfikacji) | Interesujacy — odpowiednik DiriCode dispatcher concept |
| `memory/condenser/impl/pipeline.py` | ~80 | Pipeline condenser — chainowanie strategii | **Najwazniejszy** — killer feature do zaadaptowania |
| `memory/condenser/impl/llm_summarizing_condenser.py` | ~100 | LLM-based summarization z detailed prompt | Wazny — referencja dla ADR-009 |
| `memory/condenser/impl/observation_masking_condenser.py` | ~40 | Maskowanie starych observations | Wazny — tania optymalizacja kontekstu |
| `memory/condenser/impl/amortized_forgetting_condenser.py` | ~60 | Size-based rolling forgetting | Wazny — strategia kompakcji |
| `memory/conversation_memory.py` | ~200 | Serializacja historii do LLM messages | Wazny — jak historia jest przekazywana do LLM |
| `security/analyzer.py` | ~50 | SecurityAnalyzer base class | Wazny — pluggable analyzer interface |
| `security/invariant/analyzer.py` | ~150 | InvariantAnalyzer (Docker-based external policy) | Wazny — zaawansowany analyzer |
| `security/invariant/policies.py` | ~30 | Default policy: "Disallow secrets in bash commands" | Wazny — przyklad policy |
| `security/llm/analyzer.py` | ~50 | LLM-based risk analyzer | Wazny — lightweight analyzer |
| `llm/llm.py` | ~500 | Glowny LLM wrapper (litellm) | Wazny — porownanie z DiriCode router |
| `llm/router/rule_based/impl.py` | ~100 | MultimodalRouter — primary/secondary routing | Wazny — porownanie z ADR-011 |
| `llm/metrics.py` | ~100 | TokenUsage, Cost, ResponseLatency tracking | Wazny — referencja dla cost tracking |
| `llm/retry_mixin.py` | ~80 | Tenacity-based retry z exponential backoff | Wazny — retry strategy |
| `llm/llm_registry.py` | ~80 | LLMRegistry — per-service LLM instances | Wazny — per-agent model management |
| `events/stream.py` | ~200 | EventStream — centralny message bus | Wazny — architektura event-driven |
| `events/action/agent.py` | ~250 | AgentDelegateAction, FinishAction, LoopRecoveryAction | Wazny — event types dla delegacji |
| `events/action/action.py` | ~100 | ActionSecurityRisk enum, ActionConfirmationStatus | Wazny — bezpieczenstwo |
| `microagent/microagent.py` | ~150 | Microagent system: .md files z frontmatter, keyword triggers | Interesujacy — knowledge injection pattern |
| `mcp/client.py` | ~100 | MCP client (fastmcp: SSE, Stdio, StreamableHTTP) | Interesujacy — MCP integration |
| `runtime/base.py` | ~700 | Runtime base: run, edit, call_tool_mcp, git, security | Wazny — runtime architecture |
| `runtime/utils/bash.py` | ~600 | BashSession, split_bash_commands (bashlex), escape | Wazny — bash parsing (porownanie z ADR-015) |
| `runtime/utils/edit.py` | ~300 | FileEditRuntimeMixin, LLM-based edit fallback, auto-lint | Wazny — file edit strategy |
| `runtime/utils/git_handler.py` | ~160 | GitHandler: shlex.quote, Python script fallback | Wazny — git safety |
| `runtime/impl/docker/docker_runtime.py` | ~550 | DockerRuntime: container build/run, mounts, overlay | Wazny — sandbox architecture |
| `core/config/security_config.py` | ~30 | confirmation_mode, security_analyzer config | Wazny — security config |
| `core/config/agent_config.py` | ~50 | Per-agent LLM config | Wazny — per-agent model assignment |
| `core/config/llm_config.py` | ~200 | LLM config: model, retry, tokens, cost overrides | Wazny — LLM configuration |
| `storage/data_models/secrets.py` | ~150 | Secrets model z expose_secrets gating | Wazny — wielowarstwowa ochrona sekretow |
| `core/logger.py` | ~300 | Logger z sensitive value redaction | Wazny — log-level secret protection |
| `agenthub/codeact_agent/tools/bash.py` | ~90 | Bash tool description z security_risk contract | Interesujacy — tool-level security |
| `agenthub/codeact_agent/tools/str_replace_editor.py` | ~150 | String-replace editor (jak Aider SEARCH/REPLACE) | Interesujacy — edit strategy |
| `agenthub/codeact_agent/tools/task_tracker.py` | ~50 | Agent-driven task management | Interesujacy — task tracking pattern |

---

*Dokument wygenerowany na podstawie analizy kodu zrodlowego repozytorium `All-Hands-AI/OpenHands` — wylacznie fakty z kodu. Brak spekulacji. Caly analizowany kod oznaczony jako "LEGACY V0" — wyniki moga nie odzwierciedlac docelowej architektury V1.*
