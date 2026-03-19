# Plan Implementacji DiriCode (MVP)

> Dokument zawiera aktualny schemat architektury, fazy wdrozenia oraz liste zadan (backlog) dla projektu DiriCode.
> Data aktualizacji: 2026-03-09
> Status: ZATWIERDZONY PO ANKIETACH DECYZYJNYCH

---

## 1. Schemat Blokowy Architektury (Block Schema)

Architektura opiera sie na jednokierunkowym przeplywie danych, separacji warstw oraz priorytecie "Router first".

```mermaid
graph TD
    subgraph "Interfejsy (Klienci)"
        CLI[CLI App / Entrypoint]
        Web[Web UI - PRIMARY]
        TUI[Ink TUI - v2]
    end

    subgraph "Serwer (@diricode/server)"
        Hono[Hono HTTP + REST + SSE]
        EventBus[Typed Event Bus - Zod]
    end

    subgraph "Silnik Agentow (@diricode/core)"
        Dispatcher[Dispatcher Agent<br/>Zero Hooks, Read-Only]
        SubAgents[Sub-Agenci<br/>Planner, Writer, Reviewer, Verifier...]
        HookFramework[Hooks Framework<br/>6 MVP + DAG + silent fail]
        AgentLoader[Hybrydowy Loader Agentow<br/>Core TS + SKILL.md]
        SkillsLoader[Skills Loader<br/>agentskills.io]
        Pipeline[Pipeline Orchestrator<br/>Interview -> Plan -> Execute -> Verify]
        Guardrails[Guardrails<br/>Analysis/Context/Checkpoint]
    end

    subgraph "Pamiec (@diricode/memory)"
        Memory[Memory Service (@diricode/memory)<br/>SQLite + FTS5 + Timeline]
        IssuesClient[GitHub Issues API Client<br/>CRUD + Epic + Checklists]
    end

    subgraph "Narzedzia (@diricode/tools)"
        FS[Hashline Edit & FS]
        Bash[Bash + Tree-sitter]
        AST[AST-grep + Glob + Grep]
        Git[Git Safety Rails]
        Smart[Smart Code Tools<br/>smart_search/smart_unfold/smart_outline]
        MCP[MCP Session Manager<br/>export/restore + graceful shutdown]
        Annotations[Tool Annotations<br/>readOnly/destructive/idempotent]
        Heartbeat[Parent Heartbeat<br/>orphan cleanup]
    end

    subgraph "Router AI (@diricode/providers)"
        Router[Wlasny TS Router]
        Redactor[Secret Redactor]
        Failover[Order-based Failover<br/>jedyny tryb MVP]
        Backoff[Rate Limit Awareness + Exponential Backoff]
        Vercel[Wrapper Vercel AI SDK]
    end

    subgraph "External Services"
        LLMs[(LLM Providers)]
        GH[(GitHub Issues API)]
    end

    CLI --> Hono
    Web --> Hono
    TUI --> Hono

    Hono --> EventBus
    EventBus --> Dispatcher
    Dispatcher --> SubAgents
    SubAgents --> AgentLoader
    SubAgents --> SkillsLoader
    SubAgents --> HookFramework
    SubAgents --> Pipeline
    SubAgents --> Guardrails

    SubAgents --> FS
    SubAgents --> Bash
    SubAgents --> AST
    SubAgents --> Git
    SubAgents --> Smart
    SubAgents --> MCP
    SubAgents --> Annotations
    SubAgents --> Heartbeat

    SubAgents --> Memory
    Memory --> Hono
    Memory --> IssuesClient
    IssuesClient --> GH

    HookFramework --> Router
    Router --> Redactor
    Redactor --> Failover
    Failover --> Backoff
    Backoff --> Vercel
    Vercel --> LLMs
```

---

## 2. Fazy Implementacji (Phases)

Projekt jest podzielony na 5 faz. Kazda faza konczy sie testowalnym kamieniem milowym.

### Phase 1: Router i Fundamenty (Tydzien 1)
Cel: uruchomic stabilny rdzen komunikacji i konfiguracji, zgodnie z decyzja Router first.

- Setup Turborepo, pnpm workspaces, Bun.
- `diricode.config.ts` z walidacja Zod (w tym `families`, `skills`, `providers`).
- Wlasny TS Router:
  - Wrapper na Vercel AI SDK.
  - Failover (order-based) jako jedyny tryb MVP.
  - Copilot (GitHub Models API) jako provider priorytet 1.
  - Kimi jako provider priorytet 2.
  - Secret redactor middleware.
  - Rate limit awareness + exponential backoff.
- Serwer Hono (REST + SSE) + Typed Event Bus.

### Phase 2: Narzedzia i Pamiec (Tydzien 2)
Cel: dostarczyc bezpieczne narzedzia wykonawcze i trwala pamiec oparta o serwis.

- Hashline Edit (port z OMO).
- Bezpieczny Bash oparty o Tree-sitter.
- Git narzedzia z safety rails.
- AST-grep + glob + grep.
- Smart code tools (tree-sitter): `smart_search`, `smart_unfold`, `smart_outline`.
- SQLite w Hono (versioned migrations, FTS5, timeline-based memory).
- GitHub Issues API client (CRUD issues, epics, checklists).
- Tool annotations (`readOnly`, `destructive`, `idempotent`).
- Parent heartbeat (detekcja osieroconych procesow).

### Phase 3: Silnik Agentow i Skills (Tydzien 3)
Cel: uruchomic skoordynowany silnik agentow oparty o skills, pipeline i guardrails.

- Hook framework (6 hookow MVP + silent fail + DAG):
  - `session-start`
  - `pre-commit`
  - `post-commit`
  - `error` (retry)
  - `plan-created`
  - `plan-validated`
- `agentskills.io` skill loader:
  - `SKILL.md` z YAML frontmatter (`family` + `version` minimum)
  - `references/` subfolder support
  - Skill shadowing (personal > workspace > family-default)
- Hybrydowy loader agentow (core TS + custom `SKILL.md`).
- Family matching system (`Family = { models[], agents[], skills[] }`).
- Dispatcher (read-only, zero hooks, tylko deleguje).
- Pipeline: Interview -> Plan -> Execute -> Verify.
- Guardrails:
  - Analysis paralysis guard (5+ reads = STOP)
  - Context budget (50% window)
  - Checkpoint protocols
- Deviation rules (4 reguly).
- Wave-based parallel execution.
- Loop detector + token budget per task.

### Phase 4: Agenci POC 1-3 (Tydzien 4)
Cel: wdrozyc zestaw agentow funkcjonalnych dla planowania, implementacji, review i walidacji.

- POC 1 agenci:
  - dispatcher
  - planner-thorough
  - planner-quick
  - code-writer
  - code-reviewer-thorough
  - code-reviewer-quick
  - explorer
  - architect
- POC 2 agenci:
  - git-manager
  - project-builder
- POC 3 agenci:
  - debugger
  - test-runner
  - verifier
- `code-reviewer-thorough`: 6 wymiarow (poprawnosc, wydajnosc, bezpieczenstwo, czytelnosc, maintainability, testability).
- `code-reviewer-quick`: basic sanity check, tani model.
- `planner-thorough`: goal-backward methodology.
- `planner-quick`: szybki plan.
- Verifier: osobny agent sprawdzajacy wynik vs requirements.
- Smart approval workflow (hybryda: pytaj -> zapamietuj -> smart AI).

### Phase 5: Web UI i UX (Tydzien 5)
Cel: dostarczyc glowny interfejs uzytkownika jako Web UI (PRIMARY), z pelna transparentnoscia pracy agentow.

- Web UI jako PRIMARY interface (nie TUI).
- Framework TBD (wymaga analizy TASK-004).
- Transparentne drzewo agentow (tree view):
  - Ktory agent, ktore zadanie, jaki model, stopien zagniezdzenia.
  - Uzytkownik "chodzi po drzewie" jak w file explorer.
- Context management UI:
  - Section-based rendering z budzetem tokenow.
  - Progressive detail levels (3 poziomy).
- System prompt injection.
- MCP session export/restore + graceful shutdown.
- Lean mode (wbudowany od dnia 1).

---

## 3. Lista Zadan (GitHub Issues / Backlog)

Ponizej gotowe tickety do utworzenia jako issues. Plan i execution sa trzymane w GitHub Issues + Epic (bez markdown state lock-in).

### Pakiet: `@diricode/core`
- **[CORE-01]** Zainicjowac Typed Event Bus (Zod) do komunikacji miedzy dispatcherem, agentami i serwerem.
- **[CORE-02]** Zbudowac parser i walidator `diricode.config.ts` (families, skills, providers, fallback order).
- **[CORE-03]** Zaimplementowac Hook Framework (6 hookow + silent fail + DAG dependency resolver).
- **[CORE-04]** Stworzyc hybrydowy loader agentow (core TS + custom `SKILL.md`) z walidacja frontmatter.
- **[CORE-05]** Usunac Markdown State Manager z core i przeniesc odpowiedzialnosc za state do `@diricode/memory`.
- **[CORE-06]** Zbudowac Loop Detector i limity tokenow per task (stop condition + telemetry).
- **[CORE-07]** Zaimplementowac Guardrails (analysis paralysis, context budget 50%, checkpoint protocols).
- **[CORE-08]** Dodac Wave-based parallel execution + deviation rules (4 reguly auto-fix/escalation).
- **[CORE-09]** Zbudowac Pipeline Orchestrator (Interview -> Plan -> Execute -> Verify) ze stanami przejsc.

### Pakiet: `@diricode/providers`
- **[PROV-01]** Zaimplementowac wrapper Vercel AI SDK dla provider abstraction i unified response format.
- **[PROV-02]** Zbudowac TS Router z order-based failover jako jedynym trybem MVP.
- **[PROV-03]** Dodac provider priority chain: Copilot (GitHub Models API) -> Kimi.
- **[PROV-04]** Zaimplementowac Secret Redactor Middleware (auto-scan env/token/key i maskowanie przed requestem).
- **[PROV-05]** Dodac rate limit awareness + exponential backoff + retry telemetry.

### Pakiet: `@diricode/memory` (NOWY)
- **[MEM-01]** Setup SQLite w Hono z versioned migrations (up/down + schema versioning).
- **[MEM-02]** Implementacja FTS5 full-text search dla notatek, decyzji i wynikow agentow.
- **[MEM-03]** Timeline-based memory (obserwacje chronologiczne z metadata: agent, task, timestamp).
- **[MEM-04]** Multi-project/worktree support w zapytaniach (project_id + worktree_id).
- **[MEM-05]** GitHub Issues API client (CRUD issues, epics, checklists) z interfejsem backend-agnostic.
- **[MEM-06]** Plan storage: GitHub Issues + Epic (kazdy task = osobny Issue, traceability REQ -> PLAN -> VERIFY).

### Pakiet: `@diricode/skills` (NOWY)
- **[SKILL-01]** `agentskills.io` `SKILL.md` parser (YAML frontmatter + markdown body).
- **[SKILL-02]** Skill discovery (`skills/*/SKILL.md`) z walidacja struktury i indexowaniem metadanych.
- **[SKILL-03]** Skill shadowing (personal > workspace > family-default) z jawna kolejnoscia rozstrzygania konfliktow.
- **[SKILL-04]** Family matching system (mapowanie `Family = {models[], agents[], skills[]}`).
- **[SKILL-05]** Skill-embedded MCP support (deklaracja MCP w skillu + bezpieczne ladowanie konfiguracji).

### Pakiet: `@diricode/tools`
- **[TOOL-01]** Zaimplementowac `Hashline Edit` (ochrona przed stale-line edits + conflict feedback).
- **[TOOL-02]** Zaimplementowac bezpieczny `Bash Execution` z parserem `@tree-sitter-bash`.
- **[TOOL-03]** Zaimplementowac `Glob`, `Grep` i `AST-grep` jako zestaw search tools.
- **[TOOL-04]** Zaimplementowac `Git Manager` z safety rails (blokady destrukcyjnych komend i polityki potwierdzen).
- **[TOOL-05]** Zintegrowac MCP tooling gateway dla uruchamiania i izolacji narzedzi zewnetrznych.
- **[TOOL-06]** Tool annotations system (`readOnly`, `destructive`, `idempotent`) z expose do runtime.
- **[TOOL-07]** Smart code tools (`smart_search`, `smart_unfold`, `smart_outline`) oparte o tree-sitter.
- **[TOOL-08]** Parent heartbeat + auto-cleanup osieroconych procesow narzedzi/MCP.
- **[TOOL-09]** MCP session export/restore + graceful shutdown (serializacja stanu i cleanup zasobow).

### Pakiet: `@diricode/server` i `apps/cli`
- **[SRV-01]** Postawic serwer Hono z REST + SSE i endpointami orchestracji pipeline.
- **[SRV-02]** Zaimplementowac Event Bus bridge miedzy HTTP/SSE a core runtime.
- **[SRV-03]** Dodac memory API endpoints (timeline, search, issue-sync) dla `@diricode/memory`.
- **[CLI-01]** Zbudowac CLI entrypoint (uruchamianie sesji, profile, config layers, background lifecycle).

### Pakiet: `@diricode/agents`
- **[AGENT-01]** Zaimplementowac `dispatcher` jako read-only delegator (bez hookow, bez write).
- **[AGENT-02]** Zaimplementowac `planner-thorough` (goal-backward, pelna analiza zaleznosci).
- **[AGENT-03]** Zaimplementowac `planner-quick` (szybki plan minimalizujacy koszt tokenow).
- **[AGENT-04]** Zaimplementowac `code-writer` z integracja guardrails i checkpoint protocol.
- **[AGENT-05]** Zaimplementowac `code-reviewer-thorough` (6 wymiarow review).
- **[AGENT-06]** Zaimplementowac `code-reviewer-quick` (basic sanity check na tanim modelu).
- **[AGENT-07]** Zaimplementowac `explorer` i `architect` do research + decyzji architektonicznych.
- **[AGENT-08]** Zaimplementowac `git-manager` i `project-builder` (POC 2).
- **[AGENT-09]** Zaimplementowac `debugger`, `test-runner`, `verifier` (POC 3, verifier jako osobny gate).

### Pakiet: `@diricode/web`
- **[WEB-01]** Web UI framework setup (framework TBD po analizie TASK-004).
- **[WEB-02]** Agent tree view (transparentne drzewo agentow z modelem, taskiem i poziomem zagniezdzenia).
- **[WEB-03]** Smart Approval UI (hybryda: pytaj -> zapamietuj -> smart AI).
- **[WEB-04]** Context management dashboard (section-based rendering, progressive detail 3 poziomy, token budget).
- **[WEB-05]** Streaming odpowiedzi + progress tracking pipeline i statusow agentow.

### Pakiet: `@diricode/tui` (v2)
- **[TUI-01-v2]** Bazowy interfejs Ink v2 ze streamingiem odpowiedzi i zgodnoscia z pipeline eventami.
- **[TUI-02-v2]** Smart Approval UI v2 dla terminala (spojne reguly decyzji jak w Web UI).
- **[TUI-03-v2]** Vim motions v2 w polach input i nawigacji widokow.
- **[TUI-04-v2]** Progress dashboard v2 oparty o event stream i memory timeline (bez markdown state).

---

## 4. Kryteria akceptacji MVP

- Router first: dziala failover Copilot -> Kimi w runtime.
- Plan i stan zadan sa trzymane w GitHub Issues + Epic, bez markdown lock-in.
- Hook Framework ma dokladnie 6 hookow MVP, silent fail i DAG.
- Web UI jest PRIMARY interfejsem i pokazuje drzewo agentow.
- TUI istnieje jako sciezka v2 (nie blokuje MVP).
- Guardrails, verifier i pipeline Interview -> Plan -> Execute -> Verify sa aktywne end-to-end.

---

## 5. Dodatkowe Zadania — Middleware i Async Subagents

> Zadania wynikajace z ADR-033 (Middleware) i ADR-039 (Async Subagents)

### Pakiet: `@diricode/providers` — Rozszerzenie Middleware

- **[PROV-MW-01]** Zaimplementowac `MiddlewarePipeline` class z `.pipe()` i `.invoke()` API.
- **[PROV-MW-02]** Stworzyc `SecretRedactorMiddleware` — auto-scan env vars i maskowanie przed wyslaniem do LLM.
- **[PROV-MW-03]** Stworzyc `RateLimitMiddleware` — tracking quota usage i throttling.
- **[PROV-MW-04]** Stworzyc `CacheLookupMiddleware` — in-memory cache dla idempotent tool calls (Bun native Map/WeakMap).
- **[PROV-MW-05]** Stworzyc `OutputValidatorMiddleware` — Zod validation tool output.
- **[PROV-MW-06]** Stworzyc `AnnotationEnricherMiddleware` — auto-dodawanie metadata do tool results.
- **[PROV-MW-07]** Integracja middleware pipeline z provider layer w `@diricode/providers` — wrap przed wyslaniem request do LLM.

### Pakiet: `@diricode/core` — Async Subagents

- **[CORE-ASYNC-01]** Zaimplementowac `Wave` class do parallel agent execution.
- **[CORE-ASYNC-02]** Zaimplementowac `Wave.spawn(agents[])` — tworzenie subagentow w osobnych contextach.
- **[CORE-ASYNC-03]** Zaimplementowac `Wave.collect()` — czekanie na wszystkich agentow z timeout.
- **[CORE-ASYNC-04]** Zaimplementowac `Wave.merge(results[])` — agregacja wynikow przez Verifier agenta.
- **[CORE-ASYNC-05]** Dodac `async-subagent` tool do delegacji bez blokowania parenta.
- **[CORE-ASYNC-06]** Zaimplementowac `SubagentContext` isolation — kazdy subagent ma wlasny token budget i memory.
- **[CORE-ASYNC-07]** Dodac `parent.heartbeat()` dla wykrywania orphaned subagents.
- **[CORE-ASYNC-08]** Zaimplementowac `SubagentResultAggregator` — smart merge konfliktowac wynikow.

### Pakiet: `@diricode/tools` — Tool Retry z Backoff (ADR-036)

- **[TOOL-RETRY-01]** Zaimplementowac `RetryPolicy` interface z `maxAttempts`, `backoffMs`, `jitterMs`.
- **[TOOL-RETRY-02]** Stworzyc `ExponentialBackoffRetry` — retry z exponential backoff + jitter.
- **[TOOL-RETRY-03]** Dodac `RetryMiddleware` — auto-retry transient failures przed wyslaniem do agenta.
- **[TOOL-RETRY-04]** Zaimplementowac `RetryBudget` — globalny limit retry per session (ADR-035 ToolCallLimit integration).

### Pakiet: `@diricode/tools` — Tool Call Limits (ADR-035)

- **[TOOL-LIMIT-01]** Zaimplementowac `ToolCallLimiter` z `threadLimit` i `runLimit` tracking.
- **[TOOL-LIMIT-02]** Stworzyc `ToolCallCounter` — per-thread i per-run licznik wywolan.
- **[TOOL-LIMIT-03]** Dodac `LimitExceededError` z context (tool name, thread id, limit type).
- **[TOOL-LIMIT-04]** Zintegrowac `ToolCallLimiter` z loop detector (ADR-003) — shared budget.

---

*Aktualizacja: Marzec 2026 | Odniesienia: ADR-033, ADR-034, ADR-035, ADR-036, ADR-039*
