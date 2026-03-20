# Analiza Konkurencyjna: Codex (OpenAI)

> Data: 7 marca 2026
> Wersja analizowana: v0.1.2505301731 (ostatni CHANGELOG)
> Repo: https://github.com/openai/codex
> Licencja: Apache-2.0

---

## 1. Podsumowanie

Codex CLI to open-source (Apache-2.0) agentic coding tool od OpenAI, zaimplementowany w **Rust** z cienka warstwa TypeScript/npm do dystrybucji. Projekt wyroznia sie natywna wydajnoscia Rust, zaawansowanym systemem sandboxingu multi-platformowego (Seatbelt na macOS, Seccomp+Landlock+bubblewrap na Linux, Restricted Tokens na Windows), unikalnym mechanizmem **Guardian** (AI-based approval reviewer z risk scoring 0-100) oraz **dwufazowym systemem pamieci** (ekstrakcja + konsolidacja). Architektura agentowa jest watkowa (thread-based) z kontrolowana glebokoscia nestingu — kazdy sub-agent to osobny `CodexThread` z wlasna konwersacja i sandboxem. Codex obsluguje wielu providerow (OpenAI domyslnie + Ollama + LM Studio + custom via TOML), ale bez failover/race mode. Glowna przewaga nad DiriCode to dojrzalosc sandboxingu i innowacyjny Guardian; glowna slabosci to ograniczona rozszerzalnosc (tylko 2 typy hookow) i konfiguracja TOML bez type safety.

---

## 2. Matryca Porownawcza

### A. Tozsamosc i Pozycjonowanie

| Pytanie | Codex | DiriCode |
|---------|-------|----------|
| Nazwa, licencja, jezyk implementacji | Codex CLI, Apache-2.0 (genuine open-source), Rust (core: `codex-rs/`) + TypeScript (wrapper: `codex-cli/`) | DiriCode, open-source (planowane), TypeScript |
| Glowny target user | Solo dev do enterprise — CLI, IDE extensions (VS Code/Cursor/Windsurf), desktop app, web (chatgpt.com/codex) | Solo developer |
| Interfejs | CLI (TUI ratatui) + VS Code/Cursor/Windsurf extension + Desktop app (`codex app`) + Web | CLI (TUI Ink/React) |
| GitHub stats | Repo publiczne, aktywny rozwoj. Wielki zespol OpenAI | Nowy projekt, 0 issues |
| Model biznesowy | Open-source (Apache-2.0), wymaga API key OpenAI (domyslnie) lub dowolnego providera | Open-source, BYOK (Bring Your Own Key) |
| Pozycjonowanie | "An agentic coding tool that lives in your terminal" (README.md) | Lokalny CLI agent AI z architektura dispatcher-first |

**Wniosek:** Codex jest genuine open-source (Apache-2.0) — fundamentalna roznica vs proprietary Claude Code. Implementacja w Rust daje natywna wydajnosc, ale utrudnia kontrybuowanie (wyzszy prog wejscia niz TypeScript). DiriCode w TS jest bardziej dostepny dla szerszej spolecznosci. Oba celuja w terminal-first experience.

### B. Architektura Agenta

| Aspekt | Codex | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Ile agentow / rol? | Multi-agent via `multi_agents.rs` — 5 sub-narzedzi: `spawn_agent`, `send_input`, `resume_agent`, `wait`, `close_agent`. Role-based system (`agent/role.rs`): built-in + user-defined roles jako warstwy konfiguracji TOML | Dispatcher + 10 specjalistow | Codex: dynamiczny spawn per-potrzeba. DiriCode: predefiniowani specjalisci. Codex bardziej elastyczny ale mniej przewidywalny |
| Czy agent glowny ma dostep do narzedzi modyfikujacych? | TAK — agent glowny ma pelny dostep do wszystkich narzedzi (shell, apply_patch, itp.), ograniczany przez sandbox i approval system | NIE (read-only dispatcher) | DiriCode bezpieczniejszy by design — dispatcher nie moze przypadkowo zmodyfikowac kodu. Codex polega na sandbox + approval |
| Jak wyglada delegacja? | Thread-based: kazdy agent = `CodexThread` z wlasna konwersacja, configiem, sandboxem. `fork_context: bool` pozwala dziecku odziedziczyc pelna historie rodzica via rollout JSONL snapshot (`codex-rs/core/src/tools/handlers/multi_agents.rs`) | Unlimited nesting + loop detector | Oba maja nesting. Codex: thread-based z fork context. DiriCode: dispatcher-based z delegacja |
| Czy jest loop detection / fail-safe? | Tak — `exceeds_thread_spawn_depth_limit(depth, max_depth)` w `agent/guards.rs`. Konfigurowalne: `agent_max_depth` (glebokosc nestingu) + `agent_max_threads` (calkowita liczba sub-agentow) | Tak (ADR-003: hard limit, token budget, loop detector) | Porownywalne podejscia. Codex ma 2 wymiary limitu (depth + total count) — DiriCode powinien rozwazyc limit calkowitej liczby agentow obok depth |
| Jak zarzadzaja kontekstem agenta? | `ContextManager` z truncation policies (token-based), auto-compact via `SUMMARIZATION_PROMPT`, ghost snapshots. Kazdy thread ma niezalezna historie (`context_manager/mod.rs`, `compact.rs`) | Dispatcher = minimalny kontekst | Codex ma bardziej zaawansowane zarzadzanie kontekstem per-thread z automatyczna kompakcja |
| Nicknames agentow | Losowe imiona filozofow z `agent_names.txt` (Plato, Socrates...), recykling z ordinal suffixes ("Plato the 2nd") | Nazwy specjalistow (writer, reviewer...) | Cosmetyczny detail, ale poprawia UX debugowania multi-agentowych sesji |

**Wniosek:** Codex stosuje model watkowy (thread-based) z dynamicznym spawnem, DiriCode hierarchiczny z predefiniowanymi specjalistami. Kluczowe roznice: (1) Codex fork_context pozwala dziecku odziedziczyc historie rodzica — warty zaadaptowania. (2) Codex ma 2 wymiary limitu (depth + total threads) — bardziej granularna ochrona. (3) Agent glowny Codex ma pelny dostep do narzedzi — DiriCode z read-only dispatcherem jest bezpieczniejszy.

### C. Zrozumienie Kodu (Code Intelligence)

| Aspekt | Codex | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Jak "widzi" codebase? | 17+ narzedzi: `shell.rs`, `read_file.rs`, `list_dir.rs`, `grep_files.rs`, `search_tool_bm25.rs` (BM25 ranked text search), `apply_patch.rs`, `view_image.rs`, `js_repl.rs`, `mcp.rs` + inne (`codex-rs/core/src/tools/handlers/`) | glob + grep + AST-grep + LSP | Codex ma BM25 ranked search — lepsze niz prosty grep. DiriCode ma AST-grep i LSP — lepsze zrozumienie struktury kodu |
| Czy parsuje strukture kodu? | BM25 search (`search_tool_bm25.rs`) — ranking tekstowy bez parsowania AST. Brak repo map, brak tree-sitter w toolach | AST-grep tak, ale brak "repo map" | DiriCode lepszy — AST-grep daje strukturalne zrozumienie kodu. Codex polega na text matching |
| Jak wybiera pliki do kontekstu? | Agent autonomicznie uzywa narzedzi (grep, list_dir, read_file). Plan tool (`plan.rs`) do planowania podejscia | Agent dispatcher decyduje na podstawie opisu zadania | Oba polegaja na heurystykach agenta. Codex ma dedykowany Plan tool — wart rozwazyenia |
| Czy ma LSP integration? | Nie znaleziono w toolach — brak LSP handler w `tools/handlers/` | Tak, top-10 jezykow lazy install | DiriCode ma znaczaca przewage — LSP daje go-to-definition, find-references, diagnostics |
| Jak radzi sobie z duzymi repozytoriami? | BM25 search pomaga rankingiem. Context window do 272K tokenow (gpt-5.3-codex w `models.json`) | Nieznane — potencjalna luka | BM25 ranking pomaga Codex lepiej priorytetyzowac wyniki w duzych repo |
| Narzedzie do patchowania | `apply_patch.rs` — unified diff format (freeform patching) | Edit tool (search-replace) | Rozne podejscia: Codex unified diff vs DiriCode search-replace. Unified diff lepsze dla duzych zmian, search-replace bezpieczniejsze dla malych |

**Wniosek:** DiriCode ma przewage w code intelligence dzieki AST-grep i LSP. Codex kompensuje BM25 ranked search (lepsze niz prosty grep). Warto rozwazyc: (1) Dodanie BM25 search obok grep jako opcji rankingowej. (2) Plan tool — dedykowane narzedzie do planowania podejscia przed implementacja.

### D. Routing i Obsluga Modeli

| Aspekt | Codex | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Ile providerow / modeli? | Domyslnie OpenAI + built-in: Ollama (localhost:11434), LM Studio (localhost:1234) + custom providers via `config.toml` pod kluczem `model_providers` (`model_provider_info.rs`) | 22 providerow via Vercel AI SDK | DiriCode ma wiecej providerow out-of-the-box. Codex jest rozszerzalny via TOML ale wymaga recznej konfiguracji |
| Czy ma failover? | NIE — single provider at a time. Extensible via config ale brak automatycznego failover (`model_provider_info.rs`) | Tak (ADR-011: order-based failover) | DiriCode lepszy — automatyczny failover jest krytyczny dla reliability |
| Czy ma race mode? | NIE | Tak (ADR-011) | DiriCode lepszy |
| Per-agent model assignment? | Tak — Role system (`agent/role.rs`): role moze overridowac model, provider, instructions. Profiles system: named config profiles w `config.toml` | Tak (dispatcher=fast, writer=deep) | Porownywalne. Codex Profiles sa eleganckie — named presets do przelaczania |
| Wire API | Tylko Responses API (Chat Completions API **usuniete**). WebSocket support dla OpenAI | Vercel AI SDK (Chat Completions compatible) | Codex mocno powiazany z Responses API OpenAI. DiriCode z Vercel AI SDK jest bardziej uniwersalny |
| Model catalog | `models.json` — rozbudowane metadane: context window, reasoning levels (low/medium/high/xhigh), input modalities, truncation policy, parallel tool call support, personality variants, upgrade paths | Konfiguracja per-provider w TS | Codex model catalog jest bardziej deskryptywny — pozwala na inteligentniejszy routing |
| Konfiguracja providerow | `config.toml` pod `model_providers`: `base_url`, `env_key`, `bearer_token`, `query_params`, `http_headers`, `request_max_retries`, `stream_max_retries`, `stream_idle_timeout_ms` | Vercel AI SDK config | Codex daje wieksza kontrole per-provider (retry, timeout, headers) |

**Wniosek:** DiriCode ma przewage w automatycznym failover i race mode. Codex ma lepszy model catalog (metadane modeli) i granularna konfiguracje providerow (retry, timeout). Warto zaadaptowac: (1) Rich model metadata (context window, capabilities) do inteligentniejszego routingu. (2) Per-provider retry/timeout config. (3) Named profiles do szybkiego przelaczania konfiguracji.

### E. System Hookow i Rozszerzalnosc

| Aspekt | Codex | DiriCode | Wniosek |
|--------|-------|----------|---------|
| System hookow/pluginow? | Tylko **2 typy hookow**: `AfterAgent` i `AfterToolUse` (`codex-rs/hooks/src/types.rs`). Plus: MCP support, Skills crate, Plugins module | 12 lifecycle hooks, lazy loading | DiriCode ma 6x wiecej hook types — znacznie wieksza rozszerzalnosc |
| Implementacja hookow | **In-process Rust closures** — `HookFn = Arc<dyn Fn(&HookPayload) -> BoxFuture<HookResult>>`. Nie sa zewnetrznymi procesami (`codex-rs/hooks/src/lib.rs`) | In-process TS hooks (planowane) | Oba in-process. Codex ograniczony do Rust, DiriCode do TS. Brak opcji zewnetrznych procesow w zadnym |
| Hook event data | `AfterAgent`: thread_id, turn_id, input_messages, last_assistant_message. `AfterToolUse`: call_id, tool_name, tool_kind, tool_input, executed, success, duration_ms, mutating, sandbox info, output_preview | 12 typow z roznymi payloadami | Codex hook payloads sa bogate w dane (duration_ms, sandbox info) — wart zaadaptowania |
| MCP support? | Rozbudowany: `codex-rs/rmcp-client/`, `codex-rs/mcp-server/`, `shell-tool-mcp/` (MCP server z sandboxed Bash i execve interception). MCP connection manager (`mcp_connection_manager.rs`) | Tak, GitHub MCP wbudowany + zewnetrzne | Codex ma bardziej zaawansowane MCP — shell-tool-mcp z execve interception to unikalne rozwiazanie |
| Customowi agenci? | Role system w TOML — user-defined roles overriduja model, provider, instructions. Ale NIE osobne pliki .md per agent | Tak — `.diricode/agents/` jako pliki .md | DiriCode bardziej intuicyjny — pliki .md latwe do tworzenia i zrozumienia. TOML roles mniej czytelne |
| Konfiguracja | TOML (`config.toml`) — brak type safety, brak walidacji w compile-time | `diricode.config.ts` (type-safe) | DiriCode lepszy — type-safe config eliminuje klase bledow |
| SDK | `sdk/typescript/` — TypeScript SDK wrapping CLI via JSONL nad stdin/stdout. Exposes `Codex`, `Thread`, `run()`/`runStreamed()`, structured output, image attachment | Brak SDK (MVP) | Codex SDK to wartosc dodana — pozwala osadzac Codex w wiekszych systemach |
| Skills system | `codex-rs/skills/` — osobny crate (niedokladnie zbadany) | Brak odpowiednika | Do dalszego zbadania |

**Wniosek:** Codex ma zaledwie 2 hook types vs 12 w DiriCode — to KLUCZOWA przewaga DiriCode w rozszerzalnosci. Natomiast Codex ma dojrzalsze MCP (shell-tool-mcp z execve interception), TypeScript SDK do embedowania, i bogate hook payloads (duration_ms, sandbox info). DiriCode powinien zachowac 12 hookow i wzbogacic payloads o metryki (czas wykonania, info o sandboxie).

### F. Bezpieczenstwo i Approval

| Aspekt | Codex | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Approval przed destrukcja? | Tak — rozbudowany system: `AskForApproval` z 5 trybami: OnFailure, Never, OnRequest, UnlessTrusted, Reject. `ReviewDecision`: Approved, Denied, Abort, ApprovedForSession, ApprovedExecpolicyAmendment, NetworkPolicyAmendment (`safety.rs`, `orchestrator.rs`) | Tak (ADR-004: Smart — AI ocenia ryzyko) | Codex bardziej granularny (5 trybow vs 3 kategorie). Ale DiriCode "Smart" AI-based assessment jest bardziej innowacyjny |
| Guardian (AI-based reviewer) | **UNIKALNA FUNKCJA** — oddzielny model (preferuje gpt-5.4) ocenia ryzyko narzedzia: risk_level (low/medium/high), risk_score 0-100, rationale, evidence. Fail-closed: approves only if risk_score < 80. Timeout 90s. Guardian dziala w read-only sandbox z `approval_policy = never`. Zawiera `GUARDIAN_REJECTION_MESSAGE` zapobiegajacy obchodzeniu odrzucenia (`guardian.rs`) | ADR-004: Smart Approval — AI ocenia ryzyko (planowane) | KLUCZOWE ODKRYCIE. Codex Guardian to **produkcyjna implementacja** koncepcji ktora DiriCode planuje w ADR-004. Risk scoring 0-100, fail-closed, osobny model — wzorcowa architektura do zaadaptowania |
| Sandboxing? | **Multi-platformowy**: macOS: Seatbelt (`sandbox-exec`) z policy files. Linux: Seccomp + Landlock + bubblewrap (feature-gated). Windows: Restricted Tokens. 4 poziomy: ReadOnly, WorkspaceWrite, DangerFullAccess, ExternalSandbox (`codex-rs/linux-sandbox/`, `codex-rs/windows-sandbox-rs/`) | NIE w MVP (odlozony do v2) | Codex ma OGROMNA przewage w sandboxingu — to najdojrzalszy sandbox w kategorii CLI agents. DiriCode bez sandboxa jest mniej bezpieczny |
| Ochrona przed wyciekiem sekretow? | Tak — dedykowany crate `codex-rs/secrets/` | Tak (ADR-014: auto-redakcja regex+heurystyki) | Oba chronia sekrety. Codex ma oddzielny modul — wskazuje na wyzszy priorytet |
| Git safety rails? | Shell command parsing: `codex-rs/shell-command/` z `is_dangerous_command`, `is_safe_command`. Shell escalation detection: `codex-rs/shell-escalation/` | Tak (ADR-010: blokada `git add .`, `push --force`) | Porownywalne podejscia. Codex ma oddzielne crate'y do parsowania i eskalacji |
| Parsowanie bash? | `codex-rs/shell-command/` — dedykowany parser (`parse_command`). Nie uzywa Tree-sitter | Tree-sitter (ADR-015) | DiriCode lepszy — Tree-sitter daje pelne AST vs custom parser |
| Orchestrator flow | approval → sandbox selection → first attempt → retry with escalated sandbox on denial (`tools/orchestrator.rs`) | ADR-004: 3 kategorie → decyzja | Codex orchestrator z retry + escalation to sofistykowane podejscie — sandbox escalation jest unikalne |
| Network proxy | `codex-rs/network-proxy/` — managed network allowlists, deferred/immediate network approval modes | Brak | Codex kontroluje siec per-narzedzie — dodatkowa warstwa bezpieczenstwa |
| Process hardening | `codex-rs/process-hardening/` — osobny crate | Brak | Dodatkowe utwardzanie procesow — wazne dla produkcyjnej jakosci sandboxa |
| Exec policy | `codex-rs/execpolicy/` + `codex-rs/execpolicy-legacy/` — konfiguracja polityk wykonywania | Brak odpowiednika w MVP | Granularna kontrola tego co moze byc wykonywane |

**Wniosek:** Bezpieczenstwo to KLUCZOWY differentiator Codex. Guardian AI reviewer, multi-platformowy sandbox, network proxy, exec policy, shell escalation detection — to najdojrzalszy system bezpieczenstwa wsrod CLI agents. DiriCode ma lepsze parsowanie bash (Tree-sitter), ale w kazdym innym wymiarze bezpieczenstwa Codex prowadzi. ADR-004 (Smart Approval) powinien byc rozszerzony o wzorce z Guardian (risk scoring, fail-closed, osobny model).

### G. Pamiec i Stan

| Aspekt | Codex | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Trwala pamiec miedzy sesjami? | **Dwufazowy system**: Faza 1 (Startup Extraction): skanuje do 5000 watkow, ekstrakcja raw memories via `gpt-5.1-codex-mini` (low reasoning, 70% context window), concurrency limit 8, persists `raw_memories.md`. Faza 2 (Consolidation): global lock, agent konsolidacyjny via `gpt-5.3-codex` (medium reasoning), produkuje `memory_summary.md`. Obie fazy z heartbeat, retry backoff, prune (`codex-rs/core/src/memories/`) | GitHub Issues jako project memory (ADR-007) | Fundamentalnie rozne podejscia. Codex: automatyczna ekstrakcja z historii sesji. DiriCode: explicite zapis do GitHub Issues. Codex podejscie jest bardziej automatyczne ale wymaga compute |
| Przechowywanie stanu zadan? | Session rollout/persistence: `codex-rs/core/src/rollout/` z archiwizacja sesji, listing, cursor pagination, format JSONL. State DB: `state_db.rs` — SQLite-backed | Pliki Markdown `.diricode/todo.md` (ADR-013) | Codex: SQLite + JSONL (structured, queryable). DiriCode: Markdown (human-readable, git-friendly). Rozne tradeoffs |
| Snapshot / undo? | Brak explicite snapshot system — polega na session rollouts i git | Brak snapshota — git worktrees (ADR-008) | Oba unikaja dedykowanego snapshota — git jako backup |
| Context compaction? | Inline auto-compact z `SUMMARIZATION_PROMPT` template. Remote compact support dla OpenAI. `InitialContextInjection` variants: BeforeLastUserMessage, DoNotInject (`compact.rs`) | Sliding window + summary na 90-95% (ADR-009) | Porownywalne podejscia. Codex ma remote compact (server-side) — moze byc szybsze ale wymaga API support |
| AGENTS.md? | Tak — odpowiednik CLAUDE.md. Ma narzedzie migracji z Claude Code (`external_agent_config.rs`) | Planowane (`.diricode/` context files) | Codex ulatwia migracje z Claude Code — DiriCode powinien tez rozwazyc import config z konkurentow |
| Message history | `message_history.rs`, `memory_trace.rs` — oddzielne moduly do historii wiadomosci i sladu pamieci | Do zdefiniowania | Codex ma rozbudowana infrastrukture historii — wartosc referencyjna |

**Wniosek:** Dwufazowy system pamieci Codex to najbardziej zaawansowane podejscie w kategorii — automatyczna ekstrakcja + konsolidacja z osobnymi modelami. DiriCode z GitHub Issues jest prostszy i git-friendly, ale mniej automatyczny. Warto rozwazyc hybrydowe podejscie: auto-memory lokalne (jak Codex) + explicite export do GitHub Issues (ADR-007). SQLite do stanu (Codex) jest bardziej skalowalne niz Markdown (DiriCode ADR-013) — potencjalna luka przy zlozonych projektach.

### H. UX i Developer Experience

| Aspekt | Codex | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Time-to-first-use | `npm i -g @openai/codex` lub `brew install --cask codex` + API key — 2 kroki | Do zbadania — planowane `npx diricode` | Porownywalne |
| TUI framework | ratatui (Rust) — natywna wydajnosc ale mniej elastyczne niz React | Ink/React (TS) — bardziej elastyczne, wolniejsze | Tradeoff: performance (Codex) vs developer experience (DiriCode) |
| Vim motions? | Nie znaleziono explicite | Od dnia 1 (TUI Ink) | DiriCode lepszy dla vim users |
| Streaming? | Tak, z chunking — 4 design docs na stream chunking | SSE (ADR-001) | Codex wiecej uwagi poswiecil streamingowi — design docs swiadcza o przemysleniu |
| Lean mode / effort levels? | Reasoning levels w model catalog: low/medium/high/xhigh. Konfigurowalne per model (`models.json`) | `--lean` (binary: on/off) (ADR-006) | Codex ma 4 poziomy (low/medium/high/xhigh) — bardziej granularne niz DiriCode binary |
| Personality variants | 2 warianty: "pragmatic" (default) i "friendly" — konfigurowalne w model instructions (`models.json`) | Brak | Ciekawy UX touch — wybor "osobowosci" agenta |
| Base instructions | MASYWNE — ~4000+ slow osadzonych w `models.json` z regulami formatowania, polityka eskalacji, guidance dla frontendu, czestotliwosc update'ow ("co 20s") | Do zdefiniowania | Codex base instructions sa bardzo rozbudowane — ryzyko ze duzy prompt overhead zjada context window |
| IDE extensions | VS Code, Cursor, Windsurf | Brak (MVP = CLI only) | Codex szerszy zasieg ale DiriCode celowo zaweza scope |
| Desktop app | Tak — `codex app` command | Brak | Dodatkowy interfejs |
| TypeScript SDK | Tak — `sdk/typescript/` z `Codex`, `Thread`, `run()`/`runStreamed()`, structured output, JSON schema, image attachment | Brak | SDK pozwala osadzac Codex w wiekszych systemach — value add |

**Wniosek:** Codex ma wiecej interfejsow (CLI + IDE + Desktop + SDK + Web) i bardziej granularne effort levels (4 vs 2). DiriCode ma vim motions i React-based TUI (elastyczniejsze). Masywne base instructions Codex (~4000+ slow) to anti-pattern — zjada context window. DiriCode powinien trzymac instructions krotkie.

---

## 3. Co DiriCode Powinien Zaadaptowac

| # | Co | Dlaczego | Wplyw na ADR |
|---|-----|---------|-------------|
| 1 | **Guardian AI Reviewer — risk scoring 0-100, fail-closed, osobny model** | Codex Guardian (`guardian.rs`) to produkcyjna implementacja koncepcji "Smart Approval" z ADR-004. Kluczowe wzorce: (1) Osobny model (prefers gpt-5.4) do oceny ryzyka — nie ten sam co agent roboczy. (2) Risk score 0-100 z progiem < 80. (3) Fail-closed — odmowa przy timeout/bledzie. (4) Read-only sandbox i `approval_policy=never` dla Guardiania. (5) `GUARDIAN_REJECTION_MESSAGE` zapobiegajacy obchodzeniu. (6) Kompaktowy transcript z budztem 10k tokenow na wiadomosci + 10k na evidence narzedzi | **ADR-004** (Smart Approval) — rozszerzyc o concrete architecture wzorowana na Guardian: osobny model, risk scoring, fail-closed, anti-circumvention message |
| 2 | **Dwufazowa pamiec miedzy sesjami — automatyczna ekstrakcja + konsolidacja** | Codex memory system (`memories/`) automatycznie wyciaga wazne informacje z historii sesji (Faza 1: scan do 5000 watkow, extraction via mini-model) i konsoliduje je (Faza 2: global lock, wiekszy model). Produkuje `raw_memories.md` → `memory_summary.md`. DiriCode z GitHub Issues jest explicite ale nie automatyczny — uzytkownik musi pamietac o zapisie | **ADR-007** (Project Memory) — rozwazyc hybrydowe podejscie: auto-memory lokalne (jak Codex) + explicite export do GitHub Issues. Auto-memory moze uzywac taniego modelu do ekstrakcji |
| 3 | **Multi-platformowy sandbox z eskalacja** | Codex ma najbardziej dojrzaly sandbox w kategorii: Seatbelt (macOS), Seccomp+Landlock+bubblewrap (Linux), Restricted Tokens (Windows). 4 poziomy: ReadOnly → WorkspaceWrite → DangerFullAccess → ExternalSandbox. Orchestrator flow: approval → sandbox → attempt → retry z eskalowanym sandboxem (`tools/orchestrator.rs`) | **ADR nowy lub rozszerzenie ADR-004** — sandbox z eskalacja jako cel v2. Architektura Codex jako referencja implementacyjna |
| 4 | **Fork context dla sub-agentow** | W `spawn_agent` parametr `fork_context: bool` pozwala dziecku odziedziczyc pelna historie konwersacji rodzica via rollout JSONL snapshot (`multi_agents.rs`). To eliminuje potrzebe ponownego budowania kontekstu w sub-agentach | **ADR-003** (delegacja) — dodac opcje fork_context przy delegacji do sub-agentow. Dispatcher moze przekazac pelny kontekst specjaliscie gdy zadanie tego wymaga |
| 5 | **Rich model metadata catalog** | `models.json` zawiera rozbudowane metadane per model: context window, reasoning levels, input modalities, truncation policy, parallel tool call support, personality variants, upgrade paths. Pozwala na inteligentny routing | **ADR-011** (Router) — rozbudowac model catalog o metadane (context window, capabilities, reasoning levels) do podejmowania lepszych decyzji routingowych |
| 6 | **Plan tool — dedykowane narzedzie planowania** | `plan.rs` — agent moze explicite zaplanowac podejscie przed implementacja. Oddziela myslenie od dzialania | **ADR-002/ADR-003** — rozwazyc Plan tool w zestawie narzedzi dispatchera do explicite planowania przed delegacja |
| 7 | **Dual guard limits (depth + total thread count)** | `agent_max_depth` + `agent_max_threads` w `guards.rs` — dwa wymiary ochrony: maksymalna glebokosc nestingu PLUS maksymalna calkowita liczba sub-agentow | **ADR-003** (delegacja) — dodac limit calkowitej liczby agentow obok istniejacego depth limit |

**Wniosek:** Codex dostarcza 3 wzorcowe implementacje dla DiriCode: Guardian (ADR-004), dwufazowa pamiec (ADR-007), multi-platformowy sandbox (v2). Fork context i rich model catalog to mniejsze ale wartosciowe ulepszenia.

---

## 4. Czego DiriCode Powinien Unikac

| # | Co | Dlaczego to problem | Jak DiriCode to rozwiazuje |
|---|-----|--------------------|-----------------------------|
| 1 | **Tylko 2 typy hookow (AfterAgent, AfterToolUse)** | Codex ma zaledwie 2 hook types vs 12 w Claude Code i 12 planowanych w DiriCode. Brak: BeforeToolUse (nie mozna zablokowac narzedzia przed wykonaniem), SessionStart, ConfigChange, UserPromptSubmit. Drastycznie ogranicza rozszerzalnosc — community nie moze dodac walidacji pre-execution, custom onboardingu, dynamicznej konfiguracji | ADR planowane 12 hookow — zachowac. Pre/Post symetria (BeforeToolUse + AfterToolUse) jest krytyczna |
| 2 | **Responses-API-only wire format** | Codex celowo USUNAL Chat Completions API i uzywa wylacznie Responses API OpenAI. To wiaze protokol komunikacji z jednym vendor'em — inni providerzy (Anthropic, Google, Ollama) nie implementuja Responses API | ADR-011: Vercel AI SDK z Chat Completions — standard przemyslowy obslugiwany przez wszystkich providerow |
| 3 | **Masywne base instructions (~4000+ slow w models.json)** | Kazda sesja zaczyna od ~4000+ slow instrukcji base osadzonych w model catalog. To zjada ~5-8K tokenow z context window ZANIM uzytkownik zada pytanie. Przy 128K context window to 4-6% overhead; przy mniejszych modelach znacznie wiecej | DiriCode powinien trzymac base instructions krotkie (<1000 slow) i ladowac dodatkowy kontekst lazy per-task |
| 4 | **Konfiguracja TOML bez type safety** | `config.toml` nie oferuje walidacji w compile-time, autocompletions w IDE, ani type checking. Bledy konfiguracji wykrywane dopiero w runtime | ADR: `diricode.config.ts` (type-safe) — TypeScript config z pelna walidacja, autocomplete, i type checking |
| 5 | **Rust core utrudnia kontrybuowanie** | Implementacja w Rust daje wydajnosc, ale podnosi prog wejscia dla kontrybutow. Wiekszosci web/JS developerow (glowny target CLI tools) nie zna Rusta | DiriCode w TypeScript jest dostepny dla szerszej spolecznosci. Ewentualne hot-pathy moga byc zoptymalizowane via native addons (N-API) |

---

## 5. Otwarte Pytania

1. **Jak Guardian radzi sobie z false positives?** — Risk score < 80 approves, >= 80 rejects. Czy to powoduje frustrujace blokady bezpiecznych operacji? Czy uzytkownik moze overridowac Guardian? `ReviewDecision::ApprovedExecpolicyAmendment` sugeruje ze tak, ale nie zbadano szczegolowo flow.

2. **Jak skaluje sie dwufazowa pamiec przy duzych projektach?** — Skanowanie 5000 watkow z ekstrakcja to potencjalnie drogie (w tokenach) i wolne. Czy `gpt-5.1-codex-mini` jest wystarczajaco tani? Jakie sa limity lease'u?

3. **Czy `codex-rs/skills/` i `codex-rs/plugins/` dodaja hook types?** — Zbadane tylko `hooks/` crate, ktory ma 2 typy. Mozliwe ze Skills i Plugins dostarczaja dodatkowe extension points — wymaga dalszej analizy.

4. **Jak Codex radzi sobie z konfliktami przy fork_context?** — Gdy dziecko i rodzic dzialaja rownolegle na tych samych plikach po forku — jakie sa mechanizmy rozwiazywania konfliktow?

5. **Czy BM25 search wystarczy bez LSP/AST?** — Codex swiadomie nie ma LSP ani AST-grep. Czy BM25 ranking jest "good enough" dla wiekszosci use cases? Jak wplywa na jakosc refaktoringow?

6. **Jak wyglada performance overhead Guardian?** — Osobny model call z 90s timeout przy kazdym `on-request` approval. Czy to nie spowalnia workflow? Czy mozna cache'owac decyzje Guardiania per-sesje?

---

## 6. Rekomendacje dla Specyfikacji DiriCode

### 6.1 Zmiany w istniejacych ADR-ach

| ADR | Obecna decyzja | Proponowana zmiana | Uzasadnienie |
|-----|---------------|-------------------|-------------|
| **ADR-003** | Unlimited nesting + loop detector | Dodac: (1) **Dual guard limits** — `max_depth` + `max_total_agents` per sesje (wzorzec z `guards.rs`). (2) **Fork context** — opcja przekazania pelnej historii konwersacji sub-agentowi via snapshot (wzorzec z `multi_agents.rs`) | Codex ma bardziej granularna ochrone (2 wymiary) i elastyczniejsze przekazywanie kontekstu (fork) |
| **ADR-004** | Smart Approval — AI ocenia ryzyko (3 kategorie) | Rozszerzyc o **Guardian architecture**: (1) Osobny model (tani, szybki) do oceny ryzyka. (2) Risk score 0-100, konfigurowalny prog. (3) Fail-closed — odmowa przy timeout/bledzie. (4) Anti-circumvention message. (5) Read-only sandbox dla reviewera. (6) Compact transcript z budztem tokenow na evidence | Codex Guardian (`guardian.rs`) to produkcyjna implementacja Smart Approval — best-in-class w kategorii |
| **ADR-006** | Binary lean mode (`--lean` on/off) | Rozszerzyc na **4 effort levels**: `--effort low|medium|high|xhigh` — analogicznie do reasoning levels w Codex `models.json` | Codex ma 4 poziomy reasoning — daje uzytkownikowi wieksza kontrole. Low = triage, medium = standard, high = zlozonosc, xhigh = trudne problemy |
| **ADR-007** | GitHub Issues jako project memory | Dodac **auto-memory lokalne** obok Issues: automatyczna ekstrakcja kluczowych informacji z historii sesji (tani model, background job) do `.diricode/memory/`. Issues pozostaja dla explicite project-level knowledge | Codex dwufazowa pamiec jest bardziej automatyczna. Hybrydowe podejscie laczy automatycznosc z git-friendly explicitness |
| **ADR-011** | Wlasny TS Router z failover/race mode | Dodac: (1) **Rich model metadata** — context window, capabilities, reasoning levels per model do inteligentniejszego routingu. (2) **Per-provider retry/timeout config**. (3) **Named profiles** do szybkiego przelaczania konfiguracji | Codex `models.json` i provider config sa bardziej deskryptywne — pozwalaja na lepsze decyzje routingowe |
| **ADR-013** | Stan w Markdown files | Rozwazyc **SQLite jako alternatywe** dla zlozonych projektow — Codex `state_db.rs` uzywa SQLite. Markdown moze nie skalowac sie przy wielu rownoczesnych sesji/watkach. Mozliwe hybrydowe podejscie: SQLite backend + Markdown export dla human-readability | Codex wybral SQLite — wskazuje na limity Markdown at scale |

### 6.2 Nowe elementy do specyfikacji

| Propozycja | Opis | Priorytet |
|-----------|------|----------|
| **Plan tool** | Dedykowane narzedzie planowania w zestawie dispatchera — agent explicite planuje podejscie przed delegacja. Oddziela faze myslenia od dzialania. Wzorzec: `plan.rs` w Codex | Medium — ulepszenie jakosci delegacji |
| **Sandbox v2 — multi-platformowy z eskalacja** | Referencja: Codex Seatbelt (macOS), Seccomp+Landlock+bwrap (Linux), Restricted Tokens (Windows). 4 poziomy z automatyczna eskalacja. Orchestrator flow: approval → sandbox → attempt → retry z eskalacja | High — cel v2, architektura Codex jako referencja |
| **Migration tool z konkurentow** | Codex ma `external_agent_config.rs` do migracji z CLAUDE.md. DiriCode powinien miec import z: CLAUDE.md → `.diricode/`, AGENTS.md (Codex) → `.diricode/`, `.aider*` → `.diricode/` | Low — quality-of-life, obniza bariere wejscia |
| **Hook payloads z metrykami** | Wzbogacic AfterToolUse o: `duration_ms`, `sandbox_info`, `output_preview` (wzorzec z Codex `hooks/src/types.rs`). Pozwala hookom na performance monitoring i auditing | Medium — wzbogaca ekosystem hookow |
| **TypeScript SDK** | SDK do embedowania DiriCode w wiekszych systemach via JSONL nad stdin/stdout. Wzorzec: `sdk/typescript/` w Codex — exposes `run()`, `runStreamed()`, structured output, JSON schema | Low — po MVP, wartosc dodana dla power users |

### 6.3 Potwierdzone decyzje

Analiza Codex **potwierdza** poprawnosc nastepujacych decyzji DiriCode:

| ADR | Decyzja | Potwierdzenie z Codex |
|-----|---------|----------------------|
| **ADR-002** | Dispatcher-First (read-only agent glowny) | Codex agent glowny ma pelny dostep do narzedzi modyfikujacych — polega na sandbox + approval. DiriCode z read-only dispatcherem jest bezpieczniejszy by design — potwierdza wartosc tego podejscia |
| **ADR-003** | Unlimited nesting + loop detector | Codex tez ma nesting z guard limits — podejscie zwalidowane. DiriCode powinien dodac dual guards (depth + total count) |
| **ADR-008** | Brak snapshot — git worktrees | Codex tez nie ma dedykowanego snapshota — polega na session rollouts i git |
| **ADR-011** | Wlasny TS Router (multi-provider, failover, race) | Codex NIE MA failover/race mode — to potwierdza wartosc differentiator DiriCode |
| **ADR-014** | Auto-redakcja sekretow | Codex ma `codex-rs/secrets/` — potwierdza ze sekrety sa priorytetem bezpieczenstwa |
| **ADR-015** | Tree-sitter do parsowania bash | Codex uzywa custom parser (`shell-command/`) bez Tree-sitter — DiriCode z Tree-sitter ma lepsze podejscie |

### 6.4 Kluczowe Roznice Architektoniczne

| Wymiar | Codex | DiriCode | Kto lepszy |
|--------|-------|----------|-----------|
| Jezyk implementacji | Rust (wydajnosc) | TypeScript (dostepnosc) | Zalezy od priorytetu |
| Agent glowny | Pelny dostep + sandbox | Read-only dispatcher | DiriCode (bezpieczenstwo) |
| Sandbox | Multi-platformowy, 4 poziomy, eskalacja | Brak w MVP | Codex (znaczaco) |
| Guardian AI reviewer | Produkcyjny, risk scoring | Planowany (ADR-004) | Codex (zaimplementowany) |
| Rozszerzalnosc hookow | 2 typy | 12 typow | DiriCode (6x wiecej) |
| Multi-provider routing | Basic (brak failover/race) | Advanced (22 providers, failover, race) | DiriCode (znaczaco) |
| Pamiec miedzy sesjami | Automatyczna dwufazowa | Explicite GitHub Issues | Rozne tradeoffs |
| Code intelligence | BM25 search, brak LSP | AST-grep + LSP | DiriCode (strukturalne) |
| Type-safe config | TOML (brak) | TypeScript (pelna) | DiriCode |
| Konfiguracja | Wymagajaca (TOML) | Intuicyjna (.ts z autocomplete) | DiriCode |

---

*Dokument wygenerowany na podstawie analizy repozytorium `openai/codex` (commit z marca 2026) — wylacznie fakty z kodu, dokumentacji i publicznych issues. Brak spekulacji.*
