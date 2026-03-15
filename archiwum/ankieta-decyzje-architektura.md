# Ankieta: Decyzje Architekturalne — Nowy Projekt (DiriCode/CodeWroc)

> Na podstawie analizy kodu źródłowego OpenCode + Oh-My-OpenCode
> Każda decyzja to wybór między wzorcem z OC/OMO a własną implementacją.
> Zaznacz: ✅ Tak / ❌ Nie / 🔄 Zmodyfikuj

---

## SEKCJA A — MODEL KLIENT-SERWER

### A1. Czy zachować architekturę klient-serwer HTTP+SSE?

OpenCode używa Hono serwera z SSE do broadcastowania zdarzeń. Klienty (TUI, Desktop, VS Code) są oddzielnymi procesami łączącymi się przez HTTP.

- [ ] ✅ Tak — silna separacja frontend/backend, wiele klientów możliwe
- [ ] ❌ Nie — monolityczna aplikacja (embedded)
- [ ] 🔄 Zmodyfikuj — WebSocket zamiast SSE (bidirectional)
- [ ] 🔄 Zmodyfikuj — gRPC/protobuf zamiast REST+SSE

**Uwaga:** SSE jest jednostronne (serwer → klient). Komendy user → serwer idą przez osobne POST endpointy. WebSocket uprościłby to ale dodaje zależność.

Mój wybór: ___

---

### A2. Runtime serwera?

OpenCode używa Bun.serve (nie Node.js). Bun jest szybszy ale mniej kompatybilny.

- [ ] ✅ Bun — szybszy, natywny SQLite, bundler wbudowany
- [ ] ❌ Node.js — większa kompatybilność, stabilniejszy ecosystem
- [ ] 🔄 Deno — bezpieczniejszy, ale inny ecosystem
- [ ] 🔄 Docker-only — runtime nie ma znaczenia jeśli konteneryzujemy

Mój wybór: ___

---

### A3. Czy zachować mDNS auto-discovery serwera?

OpenCode ogłasza serwer przez mDNS (`.local` DNS). Klienty descoberują go automatycznie.

- [ ] ✅ Tak — wygodne, zero konfiguracji dla lokalnych klientów
- [ ] ❌ Nie — stały port, użytkownik konfiguruje ręcznie
- [ ] 🔄 Tak, ale jako opcjonalna funkcja

Mój wybór: ___

---

### A4. Format API?

- [ ] ✅ REST + SSE (jak OC) — prostota, łatwość debugowania przez curl
- [ ] 🔄 OpenAI-compatible API — interoperabilność z innymi narzędziami
- [ ] 🔄 GraphQL — flexible queries
- [ ] 🔄 tRPC — type-safe full-stack

Mój wybór: ___

---

## SEKCJA B — SYSTEM PLUGINÓW / HOOKÓW

### B1. Czy zachować plugin system OpenCode (12 lifecycle hooks)?

OpenCode Plugin to async function zwracająca obiekt z handlerami. OMO rejestruje 44+ hooków w 12 punktach lifecycle.

Aktualne punkty przechwycenia:
- `chat.message` — modyfikacja wiadomości użytkownika
- `chat.params` — override parametrów LLM
- `chat.headers` — inject HTTP headers
- `experimental.chat.messages.transform` — transformacja historii
- `chat.system.transform` — transformacja system prompta
- `tool.execute.before` — przed wykonaniem narzędzia
- `tool.execute.after` — po wykonaniu narzędzia
- `experimental.text.complete` — po zakończeniu generowania tekstu
- `experimental.session.compacting` — podczas kompakcji
- `event` (session.idle, message.updated, session.error) — zdarzenia sesji

- [ ] ✅ Zachować — pozwala na modularność, OMO to dowód że to działa
- [ ] ❌ Nie — wszystko wbudowane, brak zewnętrznych pluginów
- [ ] 🔄 Zmodyfikuj — mniej hooków, bardziej opinionated
- [ ] 🔄 Zmodyfikuj — middleware pattern zamiast event hooks (kestrel-style pipeline)

Mój wybór: ___

---

### B2. Ile punktów hook potrzebujesz?

Wybierz które hooki są niezbędne w MVP:

| Hook | OpenCode | OMO używa | Twój projekt |
|------|----------|-----------|--------------|
| `chat.message` — przed zapisem wiadomości | ✅ | ✅ (model override, variant) | [ ] Tak / [ ] Nie |
| `chat.params` — override temp/topP | ✅ | ✅ (effort levels) | [ ] Tak / [ ] Nie |
| `tool.execute.before` — guard/intercept | ✅ | ✅ (write-guard, rules) | [ ] Tak / [ ] Nie |
| `tool.execute.after` — enhance output | ✅ | ✅ (hashline, monitor) | [ ] Tak / [ ] Nie |
| `messages.transform` — przepisz historię | experimental | ✅ (context inject) | [ ] Tak / [ ] Nie |
| `system.transform` — zmień system prompt | experimental | ✅ | [ ] Tak / [ ] Nie |
| `session.compacting` — inject do summary | experimental | ✅ (TODO preserve) | [ ] Tak / [ ] Nie |
| `text.complete` — po generowaniu tekstu | experimental | rzadko | [ ] Tak / [ ] Nie |
| session events — idle/error/updated | ✅ | ✅ (recovery, monitor) | [ ] Tak / [ ] Nie |

---

### B3. Czy hooki mogą blokować/modyfikować flow czy tylko obserwować?

- [ ] ✅ Pełna modyfikacja — hook może zmienić input/output, zatrzymać wykonanie (jak OMO)
- [ ] 🔄 Read-only observers — eventy tylko do monitoringu, brak modyfikacji
- [ ] 🔄 Hybryda — niektóre hooki modyfikują (before_tool), inne tylko obserwują (after_tool)

Mój wybór: ___

---

### B4. Kolejność hooków w OMO jest trójpoziomowa (Core → Continuation → Skill). Zachować taką strukturę?

- [ ] ✅ Tak — tier-based priority jest czytelna
- [ ] ❌ Nie — flat lista z numerycznym priorytetem
- [ ] 🔄 Zmodyfikuj — dwa poziomy: system hooks vs user hooks

Mój wybór: ___

---

## SEKCJA C — SYSTEM AGENTÓW

### C1. Jak definiować agentów?

OpenCode: `AgentConfig { name, instructions, model?, tools?, permission? }`  
OMO: osobne pliki per agent z dynamic prompt builderem.

- [ ] ✅ Static config (jak OC) — prosta definicja w JSON/YAML
- [ ] 🔄 Code-defined (jak OMO) — programmatic, dynamic prompt builder
- [ ] 🔄 SKILL.md-like files — markdown z YAML frontmatter
- [ ] 🔄 Hybrydowo — config dla prostych, code dla zaawansowanych

Mój wybór: ___

---

### C2. Ile wbudowanych agentów w MVP?

OpenCode ma 7 (build, plan, debug, code-review, init, compaction, system).  
OMO dodaje 11. Twoja wizja (zyczenia-codewroc.md): agent główny = DISPATCHER.

Propozycje:
- [ ] 1 — tylko dispatcher, reszta to delegacja do subagentów
- [ ] 2-3 — dispatcher + specjaliści (reader, writer)
- [ ] 5-7 — jak OpenCode core
- [ ] 10+ — jak OMO

Mój wybór: ___

---

### C3. Dispatcher-first architecture (z Twoich życzeń)

Twoja wizja: agent główny TYLKO deleguje, ZERO własnych hooków, zatwierdza plan przed wykonaniem.

- [ ] ✅ Dispatcher-first — agent główny nie wykonuje kodu, tylko planuje i deleguje
- [ ] ❌ Do-it-all — jeden agent który sam wykonuje wszystko
- [ ] 🔄 Hybryda — może samodzielnie dla prostych zadań, deleguje dla złożonych

Mój wybór: ___

---

### C4. Primary vs Subagent mode (z OMO)

OMO rozróżnia:
- `primary` — używa modelu z UI, duże zadania
- `subagent` — własny fallback chain, używany przez delegate-task

- [ ] ✅ Zachować distinction — czytelna separacja odpowiedzialności
- [ ] ❌ Jeden type — wszystkie agenty równorzędne
- [ ] 🔄 Zmodyfikuj — dodaj `orchestrator`, `worker`, `validator` typy

Mój wybór: ___

---

### C5. Approval workflow (z Twoich życzeń: mandatory)

Twoja wizja: KAŻDA akcja zewnętrzna wymaga zatwierdzenia przez użytkownika.

- [ ] ✅ Mandatory approval — żadna write/bash bez zgody
- [ ] 🔄 Configurable per tool — write wymaga, read nie
- [ ] 🔄 Configurable per session — "trust mode" na czas sesji
- [ ] 🔄 Smart approval — LLM ocenia ryzyko → auto-allow niskie ryzyko

Format zatwierdzania:
- [ ] Inline w TUI (jak OC — wstrzymaj sesję, czekaj na input)
- [ ] Osobny panel "approvals queue"
- [ ] dry-run mode — pokaż plan, zatwierdź hurtowo

Mój wybór: ___

---

### C6. N-level delegation (z Twoich życzeń)

Twoja wizja: Dispatcher → Level1 → Level2 → ... z izolowanym kontekstem na każdym poziomie.

- [ ] ✅ Unlimited nesting — jak OMO (task→Sisyphus-Junior→kolejny task)
- [ ] 🔄 Max 2 poziomy — dispatcher + workers (zapobiega nieskończonej rekurencji)
- [ ] 🔄 Max 3 poziomy — dispatcher + workers + specialists
- [ ] ❌ Bez delegacji — płaska architektura, jeden agent wszystko

Zabezpieczenie przed nieskończoną rekurencją:
- [ ] Hard limit N poziomów (np. 5)
- [ ] Timeout per level
- [ ] Token budget per level
- [ ] OMO Ralph Loop detector (wykrywa petlę przez hash aktywności)

Mój wybór: ___

---

### C7. Opcja zapamiętywania pomiędzy sesjami

Twoja wizja: per-project persistent memory.

- [ ] ✅ Separate memory file per project (np. `.opencode/memory.md`)
- [ ] 🔄 SQLite-backed memory z semantic search
- [ ] 🔄 SKILL.md-like memory (markdown frontmatter)
- [ ] 🔄 Zewnętrzna baza (Qdrant, Pinecone) — vector memory
- [ ] ❌ Brak persistent memory — clean slate każda sesja

Format:
- [ ] Agent sam pisze/czyta (jak TODO system w OMO)
- [ ] Structured (key-value z kategoriami)
- [ ] Nienstrukcturyzowany (free-form text)

Mój wybór: ___

---

## SEKCJA D — SYSTEM PROVIDERÓW I MODELI

### D1. Jak bundlować providery?

OpenCode bundluje 22 @ai-sdk/* w package.json.  
Problem: ogromne node_modules (każdy SDK to bundle).

- [ ] ✅ Bundle all — jak OC, działa od razu
- [ ] 🔄 Lazy install — pobierz provider na żądanie (jak OC dla custom npm)
- [ ] 🔄 Tylko top-5 — Anthropic, OpenAI, Google, Groq, Ollama
- [ ] 🔄 Vercel AI SDK custom provider pattern — jeden adapter, custom endpoints
- [ ] 🔄 OpenAI-compatible interface — one-size-fits-all dla OpenAI-compatible APIs

Mój wybór: ___

---

### D2. ProviderTransform pipeline — zachować?

OMO/OC mają pipeline: unsupportedParts → normalizeMessages → applyCaching → options.

- [ ] ✅ Zachować — każdy provider ma quirki, bez tego jest mnóstwo bugów
- [ ] 🔄 Uproszczone — tylko normalizacja, brak cache control
- [ ] 🔄 Per-provider adaptery (Strategy pattern) zamiast pipeline

Mój wybór: ___

---

### D3. Model fallback chain (z OMO)

OMO implementuje: Claude → GPT → Gemini → GitHub Copilot → Zen → Z.ai → Kimi  
Działa automatycznie przy błędzie API.

- [ ] ✅ Automatyczny fallback — użytkownik nie widzi błędu
- [ ] 🔄 Fallback z powiadomieniem — "Przełączam na model X"
- [ ] ❌ Brak fallback — twardy błąd, user decyduje

Mój wybór: ___

---

### D4. Category-based model selection (z OMO)?

OMO mapuje kategorię zadania → model:
```
quick → Claude Haiku (tani)
deep → GPT 5.3 Codex (mocny)
visual-engineering → Gemini 3 Pro
```

- [ ] ✅ Tak — task category → automatic model selection
- [ ] 🔄 Tak, ale konfigurowalne przez usera
- [ ] ❌ Nie — user zawsze wybiera model manualnie

Mój wybór: ___

---

### D5. Reasoning effort levels?

OpenCode i OMO obsługują `variant`: low/medium/high/xhigh odpowiadające reasoning effort.

- [ ] ✅ Tak — expose reasoning effort do usera i agentów
- [ ] 🔄 Uproszczone — tylko fast/normal/deep
- [ ] ❌ Nie — zostawić modelowi

Mój wybór: ___

---

## SEKCJA E — SYSTEM NARZĘDZI

### E1. Hashline Edit (kluczowa innowacja OMO)?

OMO zastępuje wbudowany `edit` tool własnym opartym na LINE#HASH:
- Agent dostaje plik z tagami `"11#VK: function hello()"`
- Edit używa hash do weryfikacji aktualności linii
- Efekt: 6.7% → 68.3% success rate

- [ ] ✅ Tak — wdrożyć hashline edit jako domyślny mechanizm
- [ ] 🔄 Tak, ale opcjonalnie (feature flag)
- [ ] ❌ Nie — standard fuzzy match wystarczy
- [ ] 🔄 Inne podejście — AST-based edit zamiast text-based

Mój wybór: ___

---

### E2. AST Search/Replace (ast_grep)?

OMO dodaje `ast_grep_search` i `ast_grep_replace` z @ast-grep/napi (25+ langs, native binary).
Pozwala na strukturalne przekształcenia kodu (np. "wszystkie funkcje bez return type").

- [ ] ✅ Tak — strukturalne wyszukiwanie jest game changer
- [ ] 🔄 Opcjonalnie — tylko jeśli user zainstaluje ast-grep CLI
- [ ] ❌ Nie — grep + regex wystarczy

Mój wybór: ___

---

### E3. LSP Integration (28 serwerów)?

OpenCode auto-instaluje i uruchamia LSP servery per język.  
Narzędzia: lsp_goto_definition, lsp_find_references, lsp_rename, lsp_diagnostics.

- [ ] ✅ Zachować — agenty powinny widzieć semantykę kodu (nie tylko tekst)
- [ ] 🔄 Uproszczone — tylko diagnostics (błędy kompilacji)
- [ ] 🔄 Opcjonalne — LSP jako optional feature
- [ ] ❌ Nie — zbyt ciężkie, grep wystarczy

Ile serwerów bundlować?
- [ ] Wszystkie 28 (jak OC)
- [ ] Top-10 (JS/TS, Python, Go, Rust, Java, C#, Ruby, PHP, Kotlin, Swift)
- [ ] Top-5 (JS/TS, Python, Go, Rust, Java)
- [ ] Tylko na żądanie (lazy install)

Mój wybór: ___

---

### E4. Zewnętrzne MCP serwery (jak OMO — websearch, context7, grep.app)?

OMO dołącza 3 remote MCPs out-of-the-box. Każdy wymaga API key.

Bundlować gotowe MCPs?
- [ ] ✅ Tak — web search + docs search wbudowane
- [ ] 🔄 Opcjonalne — user konfiguruje które MCPs chce
- [ ] ❌ Nie — user sam konfiguruje MCP servery

Jeśli tak, które?
- [ ] Web search (Exa/Tavily/Perplexity)
- [ ] Docs search (Context7)
- [ ] Code search (grep.app)
- [ ] GitHub API (ghx/gh CLI wrapper)
- [ ] Własne rozwiązanie proxy

Mój wybór: ___

---

### E5. Skill-embedded MCPs (z OMO)?

SKILL.md frontmatter może zawierać MCP definition → automatycznie start/stop per task.

- [ ] ✅ Tak — skills mogą dołączać własne narzędzia (playwright, databases, etc.)
- [ ] ❌ Nie — za skomplikowane w MVP
- [ ] 🔄 Zmodyfikuj — SKILL.md bez MCP, ale z tool declarations

Mój wybór: ___

---

### E6. Doom loop detection (wbudowane w OC)?

OpenCode liczy identyczne tool calls w sesji. 3 duplikaty → permission check (wymuszenie zatwierdzenia).

- [ ] ✅ Zachować — agenci naprawdę wpadają w pętle
- [ ] 🔄 Zmodyfikuj — niższy threshold (2 zamiast 3)
- [ ] 🔄 OMO Ralph Loop (hash-based detection) — bardziej zaawansowane
- [ ] ❌ Nie

Mój wybór: ___

---

## SEKCJA F — SYSTEM PERMISJI

### F1. PermissionNext — zachować ruleset-based system?

Nowy system OC: `Rule { permission, pattern, action: allow|deny|ask }`  
Hierarchia: session > agent > config > defaults  
Ewaluacja: LAST matching rule wins (nie first!)

- [ ] ✅ Zachować ten model — elastyczny, dobrze przemyślany
- [ ] 🔄 Uproszczony — tylko 3 poziomy allow/deny/ask per tool
- [ ] 🔄 Capability-based — agent dostaje "capabilities" (tokeny uprawnień)
- [ ] 🔄 RBAC — role-based access control

Mój wybór: ___

---

### F2. Domyślna polityka permisji (z Twoich życzeń)?

Twoja wizja: safety rails na wszystkim.

- [ ] ✅ Default DENY all writes — każda modyfikacja wymaga zgody
- [ ] 🔄 Default ALLOW writes ale DENY bash (external commands)  
- [ ] 🔄 Default ASK — każde narzędzie pyta za pierwszym razem, zapamiętuje  
- [ ] ❌ Default ALLOW all — jak OC defaults

Mój wybór: ___

---

### F3. Sandbox mode dla agentów?

- [ ] ✅ Tak — izolowane środowisko (Docker/container) per agent run
- [ ] 🔄 Tak, opcjonalnie — `--sandbox` flag
- [ ] ❌ Nie — za duży overhead

Mój wybór: ___

---

### F4. Agent-level tool allowlist/denylist (z OMO)?

OMO każdemu agentowi przypisuje dozwolone/zakazane narzędzia.  
Oracle: deny write/edit/bash. Multimodal Looker: TYLKO read.

- [ ] ✅ Zachować — agents should have minimal necessary permissions
- [ ] 🔄 Tylko denylist (nie allowlist) — prościej
- [ ] ❌ Wszystkie agenty mają te same uprawnienia

Mój wybór: ___

---

## SEKCJA G — ZARZĄDZANIE KONTEKSTEM

### G1. Hashline Read Enhancement (OMO)?

Po odczytaniu pliku hook dodaje `LINE#HASH` do każdej linii.  
Pliki stają się cięższe (więcej tokenów) ale edycje są prawidłowe.

- [ ] ✅ Zawsze hashline — niezawodność > oszczędność tokenów
- [ ] 🔄 Opcjonalne — agent sam decyduje kiedy używać
- [ ] 🔄 Tylko dla plików które będą edytowane
- [ ] ❌ Nie — standard read

Mój wybór: ___

---

### G2. Strategia kompakcji kontekstu?

OpenCode: 3 mechanizmy — pruning (co pętlę), auto-compaction (78% limit), overflow compaction.

- [ ] ✅ Zachować wszystkie 3 mechanizmy
- [ ] 🔄 Tylko compaction structured summary (bez pruning)
- [ ] 🔄 Własne podejście — sliding window bez kompakcji
- [ ] 🔄 Użytkownik decyduje kiedy kompaktować

Próg auto-kompakcji:
- [ ] 78% (jak OMO)
- [ ] 90% (bardziej agresywne)
- [ ] 60% (konserwatywne)
- [ ] Konfigurowalny

Mój wybór: ___

---

### G3. TODO-based state management (z OMO)?

OMO używa todoRead/todoWrite jako "pamięć roboczą" agenta między pętlami.  
Problem: agents sometimes write to TODO even when not asked.

- [ ] ✅ Zachować — todoWrite/todoRead to prosty ale skuteczny stan
- [ ] 🔄 Zachować, ale wyłączone domyślnie (opt-in)
- [ ] 🔄 Zastąpić bardziej strukturalnym state management
- [ ] ❌ Nie — agents shouldn't have persistent workaround state

Mój wybór: ___

---

### G4. Background tasks (z OMO)?

OMO pozwala uruchamiać agentów w tle (async) i sprawdzać wynik przez `background_output`.

- [ ] ✅ Tak — parallel agent execution jest potężne
- [ ] 🔄 Tak, ale max 3 równolegle (resource control)
- [ ] ❌ Nie — synchroniczne tylko, prostsze zarządzanie błędami

Mój wybór: ___

---

## SEKCJA H — SNAPSHOT I UNDO

### H1. Snapshot system — osobny .git repo (jak OC)?

OpenCode tworzy snapshoty w `$DATA_DIR/snapshot/$projectID/` — POZA repozytorium projektu.  
Każdy krok LLM = osobne `git write-tree`.

- [ ] ✅ Zachować — nie pollute working repo, undo/redo działa czysto
- [ ] 🔄 Zmodyfikuj — snapshoty w `.opencode/snapshots/` wewnątrz repo
- [ ] 🔄 Inne — system plików diff (nie git-based)
- [ ] ❌ Nie — bez undo możliwości

Mój wybór: ___

---

### H2. Granularność snapshotów?

- [ ] ✅ Per LLM step (jak OC) — każdy step = snapshot
- [ ] 🔄 Per tool execution — snapshot po każdym zapisie pliku
- [ ] 🔄 Per user approval — snapshot gdy user zatwierdza akcję
- [ ] 🔄 Manual only — user triggeruje snapshot

Mój wybór: ___

---

### H3. Undo scope?

- [ ] ✅ Cały projekt (revert konkretnych plików)
- [ ] 🔄 Per-file undo (lik VS Code - tylko jeden plik)
- [ ] 🔄 Per-session undo (cofnij całą sesję)

Mój wybór: ___

---

## SEKCJA I — STORAGE I KONFIGURACJA

### I1. Storage backend?

OpenCode: SQLite via Drizzle ORM (sessions, messages, parts).

- [ ] ✅ SQLite — prosta, embedded, zero-config
- [ ] 🔄 PostgreSQL — jeśli potrzebna multi-user lub cloud
- [ ] 🔄 Pliki markdown/JSON — human-readable, git-trackable
- [ ] 🔄 Hybrydowo — SQLite dla runtime, export do markdown

Mój wybór: ___

---

### I2. Format konfiguracji?

OpenCode używa JSONC (JSON with comments) z 7 warstwami priorytetów.  
OMO używa Zod v4 do walidacji swojego osobnego pliku JSONC.

- [ ] ✅ JSONC + Zod validation (jak OMO)
- [ ] 🔄 TOML (bardziej czytelny, mniej nawiasów)
- [ ] 🔄 YAML (ale YAML pitfalls)
- [ ] 🔄 TypeScript config (jak Vite/Vitest — type-safe)

Ile warstw precedence?
- [ ] 7 (jak OC): defaults → global → workspace → .env → CLI → plugin → runtime
- [ ] 3 prosty: defaults → workspace → runtime
- [ ] 5: defaults → global → workspace → CLI → runtime

Mój wybór: ___

---

### I3. Jeden plik konfiguracyjny czy osobne per feature?

OpenCode: `opencode.jsonc` (wszystko)  
OMO: osobny `oh-my-opencode.jsonc`

- [ ] ✅ Jeden plik — prostota
- [ ] 🔄 Osobne per moduł (`agents.jsonc`, `providers.jsonc`, `tools.jsonc`)
- [ ] 🔄 Hierarchia katalogów (`.diricode/config/`)

Mój wybór: ___

---

## SEKCJA J — SKILLS SYSTEM

### J1. SKILL.md support?

OpenCode i OMO obsługują SKILL.md — markdown files z YAML frontmatter definiujące reużywalne "procedury".

- [ ] ✅ Tak — skills to potężny mechanizm repo-specific knowledge
- [ ] 🔄 Tak, ale tylko global (nie per-repo)
- [ ] ❌ Nie — wszystko w system prompt lub memory

Mój wybór: ___

---

### J2. Jak skills są dostarczane do agenta?

OpenCode: agent sam decyduje kiedy użyć `/` slash command.  
OMO: `category-skill-reminder` hook automatycznie reminds agenta o dostępnych skills.  
OMO: `auto-slash-command` hook może automatycznie triggerować skill.

- [ ] ✅ Auto-reminder (jak OMO) — agent nigdy nie zapomni o dostępnych skills
- [ ] 🔄 Na żądanie — agent sam wyszukuje skills
- [ ] 🔄 Context injection — skill content automatycznie w system prompt
- [ ] 🔄 Hybrydowo — inject dla małych skills, reminder dla dużych

Mój wybór: ___

---

## SEKCJA K — TECHNOLOGIA (OC SPECYFICZNE)

### K1. Event Bus (typed events via Zod)?

OpenCode używa typed event bus publikujący 12+ typów zdarzeń.  
Każdy event ma Zod schema. Bus obsługuje cross-instance (multiple server instances) i per-instance.

- [ ] ✅ Typed event bus — type safety dla wszystkich eventów
- [ ] 🔄 Simple EventEmitter — mniej overhead
- [ ] 🔄 Redis Pub/Sub — jeśli multi-process potrzebne
- [ ] 🔄 Observables (RxJS) — composable streams

Mój wybór: ___

---

### K2. TUI framework?

OpenCode używa Ink (React dla terminala). Bubble Tea (Go) jest alternatywą.

- [ ] ✅ Ink (React-based) — spójne z TypeScript codebase
- [ ] 🔄 Bubble Tea (Go) — jeśli Go tech stack
- [ ] 🔄 Simple readline/prompts — bez fancy TUI
- [ ] 🔄 Web-only interface (brak TUI)

Mój wybór: ___

---

### K3. Lean mode (z Twoich życzeń)?

Twoja wizja: lean mode built-in od początku.

Definicja lean mode:
- [ ] Tylko najprostsze narzędzia (read, write, bash, grep)
- [ ] Bez delegacji/subagentów
- [ ] Minimalne context injection (brak auto-enrichment)
- [ ] Mniejszy model (fast/cheap)
- [ ] Wszystkie powyższe + toggle w runtime

Mój wybór: ___

---

### K4. Tree-sitter integration?

OpenCode używa tree-sitter do parsowania komend bash (bezpieczne extractowanie argumentów) i wykrywania języka pliku.

- [ ] ✅ Tak — właściwe parsowanie komend shell > regex
- [ ] 🔄 Tylko wykrywanie języka (nie parsowanie bash)
- [ ] ❌ Nie — zbyt ciężka zależność

Mój wybór: ___

---

### K5. Retry strategy?

OpenCode: exponential backoff, max 3 próby przy errorze modelu.  
OMO: `session-recovery` hook + `delegate-task-retry` hook.

- [ ] ✅ Automatyczny retry z backoff (jak OC)
- [ ] 🔄 Retry z powiadomieniem usera
- [ ] 🔄 Brak automatycznego retry — user decyduje
- [ ] 🔄 OMO-style recovery (próba naprawy przez hook przed retry)

Mój wybór: ___

---

## SEKCJA L — PROXY I MONETYZACJA

### L1. Proxy subscription model (z analiz)?

Twoja wizja: proxy dириcode → różni providerzy, user płaci DiriCode.

Czy warstwa proxy powinna być:
- [ ] ✅ Wbudowana w serwer (jeden proces)
- [ ] 🔄 Oddzielny microservice
- [ ] 🔄 OMO-style injectServerAuth — patch na SDK level

Jak obsługiwać credentials:
- [ ] ✅ Własne API keys per user (user płaci bezpośrednio)
- [ ] 🔄 Pooled keys za subscry pcją (ty płacisz hurtowo, user płaci Tobie)
- [ ] 🔄 Hybrydowo — opcja własnych lub pooled

Mój wybór: ___

---

### L2. Rate limiting i billing?

- [ ] ✅ Token counting per session + user (jak OMO context-window-monitor)
- [ ] 🔄 Request-based billing
- [ ] 🔄 Time-based billing
- [ ] ❌ Brak billing w MVP

Mój wybór: ___

---

### L3. Multi-tenancy?

- [ ] ✅ Tak — wiele userów na jednym serwerze, izolacja danych
- [ ] 🔄 Single-user tylko (local tool)
- [ ] 🔄 Opcjonalne — tryb lokalny i cloud

Jak izolacja danych:
- [ ] SQLite per user (osobna baza)
- [ ] Row-level security w shared DB
- [ ] Namespace-based (userId prefix)

Mój wybór: ___

---

## SEKCJA M — CO ODRZUCIĆ / NIE KOPIOWAĆ

### M1. Co z OMO wydaje Ci się over-engineered?

Zaznacz co chcesz POMINĄĆ w swoim projekcie:

- [ ] 44+ hooków (za dużo edge cases)
- [ ] 11 agentów na starcie (zbyt złożone)
- [ ] Dynamic prompt builder (zbyt skomplikowany do utrzymania)
- [ ] Model fallback chain (7 modeli to za dużo)
- [ ] Category-based model selection
- [ ] Background tasks (async agents)
- [ ] OMO Atlas agent (TODO orchestrator)
- [ ] Skill-embedded MCPs (per-task MCP start/stop)
- [ ] Ralph loop detector (hashmap-based)
- [ ] Question label truncator
- [ ] Auto-update checker
- [ ] Interactive bash session / tmux awareness
- [ ] Unstable agent babysitter

Własne uwagi: ___

---

### M2. Co z OpenCode wydaje Ci się problematyczne?

Zaznacz problemy które chcesz rozwiązać inaczej:

- [ ] Git snapshot system (abuse potential, issue #3176)
- [ ] 22 bundled providers (ogromne node_modules)
- [ ] 28 auto-installed LSP servers (ciężkie, resource hungry)
- [ ] todoWrite agent abuse (wpadają w infinit TODO loop, issue #668)
- [ ] Doom loop detection naiwny (tylko 3 identyczne calls)
- [ ] Brak approval workflow (agenty piszą bez pytania)
- [ ] Brak multi-user support
- [ ] Brak billing / resource limits
- [ ] Compaction straci za dużo kontekstu
- [ ] Model selection zbyt skomplikowana hierarchia

Własne uwagi: ___

---

## PYTANIA OTWARTE

**Q1. Twój stack technologiczny:**
- Backend: TypeScript (Bun) / TypeScript (Node) / Go / Python / inne: ___
- Storage: SQLite / PostgreSQL / inne: ___
- Frontend/TUI: Ink(React) / Bubble Tea / Web only / inne: ___

**Q2. Target audience MVP:**
- [ ] Tylko ja (local tool)
- [ ] Mały zespół (5-20 userów)
- [ ] Publiczne SaaS

**Q3. Deployment MVP:**
- [ ] Local CLI only
- [ ] Self-hosted (Docker)
- [ ] Cloud-hosted (managed)

**Q4. Które z 43 zidentyfikowanych problemów OpenCode/OMO są KRYTYCZNE dla Ciebie?**
(numery z ankiety-decyzje-projektowe.md):  
___

**Q5. Przewidujesz własne agenty specjalistyczne (poza dispatcher)?**
Jeśli tak, jakie: ___

**Q6. Czy projekt będzie open-source?**
- [ ] Tak, MIT
- [ ] Tak, Apache 2.0
- [ ] Tak, AGPL (użycie komercyjne wymaga umowy)
- [ ] Closed source
- [ ] Hybrydowo (core open, extensions closed)

**Q7. Priorytety architektury (jeśli jest konflikt):**
Upszereguj: Bezpieczeństwo / Szybkość / Elastyczność / Prostota / Koszt / Utrzymywalność

Mój ranking: ___

---

## SZYBKIE DECYZJE MVP (TICK TO IMPLEMENT)

Jeśli szybko: zaznacz co wchodzi do MVP:

| Funkcja | Wchodzi do MVP |
|---------|----------------|
| HTTP + SSE architektura | [ ] |
| Plugin/hook system | [ ] |
| Dispatcher agent | [ ] |
| Approval workflow mandatory | [ ] |
| Hashline edit | [ ] |
| AST grep | [ ] |
| LSP integration | [ ] |
| PermissionNext rulesets | [ ] |
| Snapshot/undo (separate git) | [ ] |
| Background tasks | [ ] |
| Model fallback chain | [ ] |
| Skills system | [ ] |
| Persistent memory per project | [ ] |
| Compaction (context management) | [ ] |
| MCP client support | [ ] |
| Multi-user / multi-tenancy | [ ] |
| Billing/token tracking | [ ] |
| Sandbox mode | [ ] |
| Lean mode | [ ] |
| N-level delegation | [ ] |

---

*Arkusz wypełniony przez: ___*  
*Data: ___*
