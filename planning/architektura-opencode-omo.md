# Architektura OpenCode + Oh-My-OpenCode — Analiza z kodu źródłowego

> Na podstawie analizy repozytoriów: `opencode/` i `oh-my-opencode/`
> Data: 21 lutego 2026

---

## 1. OGÓLNY SCHEMAT SYSTEMU

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          KLIENTY (FRONTEND)                              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │   TUI    │  │ Desktop App  │  │  VS Code Ext │  │  Mobile App   │   │
│  │(Bubble Tea)│ │  (Electron)  │  │  (SDK)       │  │  (remote)     │   │
│  └─────┬────┘  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘   │
│        │               │                 │                   │           │
│        └───────────────┴────────┬────────┴───────────────────┘           │
│                                 │ HTTP + SSE                             │
├─────────────────────────────────┼────────────────────────────────────────┤
│                          SERWER (BACKEND)                                │
│                                 │                                        │
│  ┌──────────────────────────────▼───────────────────────────────────┐   │
│  │                    Hono HTTP Server (Bun.serve)                   │   │
│  │  ┌────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ POST /chat │ │ GET /event  │ │ GET /session│ │ POST /perm │  │   │
│  │  │ (prompt)   │ │ (SSE stream)│ │ (CRUD)     │ │ (reply)    │  │   │
│  │  └─────┬──────┘ └──────┬──────┘ └────────────┘ └────────────┘  │   │
│  │        │                │                                        │   │
│  │  ┌─────▼────────────────▼────────────────────────────────────┐  │   │
│  │  │                    EVENT BUS                               │  │   │
│  │  │  message.updated | message.part.delta | session.updated   │  │   │
│  │  │  permission.asked | session.error | session.diff          │  │   │
│  │  └─────┬──────────────────────────────────────────────────┬──┘  │   │
│  │        │                                                   │     │   │
│  │  ┌─────▼──────────────────────────────────────────────┐   │     │   │
│  │  │              PLUGIN SYSTEM                          │───┘     │   │
│  │  │  Plugin.trigger("chat.message")                     │         │   │
│  │  │  Plugin.trigger("chat.params")                      │         │   │
│  │  │  Plugin.trigger("chat.headers")                     │         │   │
│  │  │  Plugin.trigger("tool.execute.before")              │         │   │
│  │  │  Plugin.trigger("tool.execute.after")               │         │   │
│  │  │  Plugin.trigger("experimental.chat.messages.transform")│      │   │
│  │  │  Plugin.trigger("experimental.session.compacting")  │         │   │
│  │  │  Plugin.trigger("chat.system.transform")            │         │   │
│  │  │  Plugin.trigger("permission.ask")                   │         │   │
│  │  └────────────────────────────────────────────────────┘         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    SESSION LAYER                                  │   │
│  │  ┌──────────┐  ┌───────────────┐  ┌────────────┐  ┌──────────┐ │   │
│  │  │ Prompt   │  │  Processor    │  │ Compaction  │  │ Summary  │ │   │
│  │  │(user msg)│  │(stream loop)  │  │(auto-prune) │  │(git diff)│ │   │
│  │  └────┬─────┘  └───────┬───────┘  └─────┬──────┘  └──────────┘ │   │
│  │       │                │                  │                      │   │
│  │  ┌────▼────────────────▼──────────────────▼──────────────────┐  │   │
│  │  │                    LLM LAYER                               │  │   │
│  │  │  ┌─────────────────┐  ┌──────────────────────────────┐   │  │   │
│  │  │  │ Provider System │  │ ProviderTransform pipeline    │   │  │   │
│  │  │  │ (22 bundled SDKs│  │ unsupportedParts()            │   │  │   │
│  │  │  │  + custom npm)  │  │ normalizeMessages()           │   │  │   │
│  │  │  │                 │  │ applyCaching()                │   │  │   │
│  │  │  └────────┬────────┘  └──────────────┬───────────────┘   │  │   │
│  │  │           │                           │                   │  │   │
│  │  │           └──────────┬────────────────┘                   │  │   │
│  │  │              Vercel AI SDK streamText()                   │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                    TOOL LAYER                              │   │   │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │   │   │
│  │  │  │ Read │ │Write │ │ Edit │ │ Bash │ │ Grep │ │ Glob │ │   │   │
│  │  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │   │   │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────────┐  │   │   │
│  │  │  │WebFetch│ │ LS  │ │ LSP │ │ Task │ │ MCP Tools    │  │   │   │
│  │  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────────────┘  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │   │
│  │  │  Permission System│  │  Snapshot (Git)  │  │  LSP Manager │  │   │
│  │  │  (PermissionNext) │  │  (separate .git) │  │  (28 langs)  │  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  STORAGE: SQLite (sessions, messages, parts, permissions) │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CYKL ŻYCIA ZAPYTANIA — PEŁNY FLOW

### Faza 1: Klient → Serwer

```
Klient (TUI/Desktop/IDE)
  │
  ├─ POST /session/:id/chat  { parts: [{ type: "text", text: "..." }], agent?, model? }
  │
  ▼
Hono HTTP Server (Bun.serve, port configurable, mDNS discovery)
  │
  ├─ CORS middleware
  ├─ Basic Auth middleware (opcjonalny)
  ├─ Route: session.chat → SessionPrompt.prompt()
```

### Faza 2: Przygotowanie wiadomości użytkownika

```
SessionPrompt.prompt(sessionID, input)
  │
  ├─ 1. Revert cleanup (jeśli pending)
  │
  ├─ 2. createUserMessage()
  │     ├─ Resolve agent (z inputu, konfiguracji, lub Agent.defaultAgent())
  │     ├─ Resolve model (z inputu, agenta, lub ostatnio używany)
  │     ├─ Resolve variant (reasoning effort level)
  │     ├─ Process input parts:
  │     │   ├─ text → TextPart
  │     │   ├─ file → ReadTool (text/plain) lub base64 (binary)
  │     │   ├─ @agent mention → SubtaskPart (hint do delegacji)
  │     │   └─ MCP resource → ToolPart
  │     │
  │     ├─ ★ Plugin.trigger("chat.message") ← OMO: first-message variant,
  │     │                                       session setup, model override,
  │     │                                       keyword detection
  │     │
  │     └─ Persist: Session.updateMessage() + Session.updatePart() → SQLite
  │
  ├─ 3. Enter loop()
```

### Faza 3: Główna pętla agentyczna (while true)

```
loop()
  │
  ├─ A) SubtaskPart w kolejce? → TaskTool.execute() → spawn sub-agent session
  │
  ├─ B) CompactionPart w kolejce? → SessionCompaction.process() → summary
  │
  └─ C) Normalne przetwarzanie LLM:
        │
        ├─ 1. Fetch message history: MessageV2.filterCompacted(MessageV2.stream(sessionID))
        │     (← pomiń skompaktowane narzędzia, zachowaj tylko od ostatniego summary)
        │
        ├─ 2. Insert reminders (plan-mode, build-switch hints)
        │
        ├─ 3. Create assistant message shell w DB
        │
        ├─ 4. Resolve tools:
        │     ├─ ToolRegistry.tools() — wbudowane narzędzia
        │     ├─ MCP.tools() — narzędzia z MCP serverów
        │     ├─ PermissionNext.disabled() — usuń narzędzia z deny w rulesetach
        │     └─ User overrides (per-message tool disable)
        │
        ├─ 5. ★ Plugin.trigger("experimental.chat.messages.transform")
        │         ← OMO: context injection, thinking block validation
        │
        ├─ 6. Build system prompt:
        │     ├─ SystemPrompt.environment() — OS, CWD, rules
        │     ├─ InstructionPrompt.system() — .opencode/instructions/*.md
        │     └─ Agent prompt (system prompt z definicji agenta)
        │
        ├─ 7. ★ Plugin.trigger("experimental.chat.system.transform")
        │
        └─ 8. processor.process() → LLM.stream()
```

### Faza 4: Streaming do LLM

```
LLM.stream(messages, tools, systemPrompts)
  │
  ├─ 1. Provider.getLanguage(model)
  │     ├─ Resolve SDK z BUNDLED_PROVIDERS (22 SDKs) lub BunProc.install() (npm)
  │     └─ Custom model loaders (OpenAI: sdk.responses(), Anthropic: sdk.languageModel())
  │
  ├─ 2. Build system prompt array:
  │     ├─ Agent prompt
  │     ├─ Provider-specific system prompt
  │     └─ User-level system prompt
  │
  ├─ 3. ★ Plugin.trigger("chat.params") — override temperature, topP, providerOptions
  │        ← OMO: anthropic effort level
  │
  ├─ 4. ★ Plugin.trigger("chat.headers") — inject HTTP headers
  │
  ├─ 5. ProviderTransform pipeline:
  │     ├─ .message() — normalize per provider:
  │     │   ├─ unsupportedParts() — remove unsupported modalities
  │     │   ├─ normalizeMessages() — fix toolCallIds, empty content, etc.
  │     │   └─ applyCaching() — Anthropic cache control on first 2 system + last 2 msgs
  │     ├─ .schema() — transform tool schemas per provider (Gemini: string enums)
  │     └─ .options() — set reasoning effort, store flags, thinking config
  │
  └─ 6. Vercel AI SDK streamText({
           model: ProviderTransformMiddleware(language_model),
           messages: transformed_history,
           tools: resolved_tools,
           system: system_prompts,
           maxOutputTokens: min(model.limit.output, 32000),
           experimental_repairToolCall: auto_fix_casing
         })
```

### Faza 5: Przetwarzanie streamu (Processor)

```
SessionProcessor iteruje po stream.fullStream:
  │
  ├─ "start" → session.status = "busy"
  │
  ├─ "reasoning-start/delta/end" → Create/update ReasoningPart → Bus emit
  │
  ├─ "text-start/delta/end" → Create/update TextPart → Bus emit
  │     └─ on "end": ★ Plugin.trigger("experimental.text.complete")
  │
  ├─ "tool-input-start" → Create ToolPart (status: "pending")
  │
  ├─ "tool-call" → ToolPart status: "running"
  │     ├─ DOOM LOOP DETECTION: 3 identyczne tool calls → permission check
  │     ├─ ★ Plugin.trigger("tool.execute.before")
  │     │     ← OMO: write-existing-file-guard, rules-injector,
  │     │           question-label-truncator, prometheus-md-only
  │     │
  │     ├─ Permission check: PermissionNext.ask()
  │     │     ├─ action: "allow" → continue
  │     │     ├─ action: "deny" → throw DeniedError
  │     │     └─ action: "ask" → suspend, publish Event.Asked, wait for user reply
  │     │
  │     ├─ Tool.execute(args, context)
  │     │
  │     └─ ★ Plugin.trigger("tool.execute.after")
  │           ← OMO: hashline-read-enhancer, context-window-monitor,
  │                  preemptive-compaction, tool-output-truncator,
  │                  directory-agents-injector, comment-checker,
  │                  edit-error-recovery, agent-usage-reminder,
  │                  todo-continuation-enforcer, session-notification
  │
  ├─ "tool-result" → ToolPart status: "completed" + output
  │
  ├─ "start-step" → Snapshot.track() (git write-tree)
  │
  ├─ "finish-step" → Calculate cost/tokens
  │     ├─ Context overflow check → trigger compaction if needed
  │     └─ SessionSummary.summarize() (background: compute git diffs)
  │
  └─ "error" → SessionRetry (exponential backoff, max 3 retries)

LOOP DECISION:
  ├─ finish_reason == "tool-calls" → CONTINUE (back to Phase 3)
  ├─ finish_reason == "stop" → STOP → SessionCompaction.prune()
  └─ context overflow → COMPACT → trigger compaction
```

### Faza 6: Odpowiedź do klienta (SSE)

```
Każdy Bus.publish() → automatycznie do GET /event (SSE stream)
  │
  ├─ message.part.delta → streaming text/reasoning (real-time updates)
  ├─ message.part.updated → tool state changes (pending → running → completed)
  ├─ message.updated → message finalized
  ├─ session.updated → session metadata changed
  ├─ permission.asked → czeka na odpowiedź użytkownika
  └─ session.diff → podsumowanie zmian plików

Heartbeat co 10s (keep-alive dla SSE)
```

---

## 3. SYSTEM AGENTÓW W OPENCODE (Core)

### 3.1 Definicja agenta

```typescript
// Uproszczona definicja z opencode/src/agent/
interface AgentConfig {
  name: string
  instructions: string          // system prompt agenta
  model?: string                // domyślny model  
  variant?: string              // reasoning effort variant
  permission?: Ruleset          // uprawnienia per agent
  tools?: {                     // ograniczenia narzędzi
    [toolName: string]: "allow" | "deny"
  }
  maxTokens?: number
  temperature?: number
}
```

### 3.2 Wbudowane agenty (7 w core OpenCode)

| Agent | Uprawnienia | Model | Przeznaczenie |
|-------|-------------|-------|---------------|
| **build** | Pełne (read+write+bash) | Wybrany przez usera | Domyślny — implementacja |
| **plan** | Read-only (deny: write, edit, bash) | Wybrany przez usera | Planowanie bez zmian w plikach |
| **debug** | Pełne + diagnostics | Wybrany | Debug z LSP diagnostics |
| **code-review** | Read-only | Wybrany | Przegląd kodu |
| **init** | Pełne | Wybrany | Inicjalizacja projektu |
| **compaction** | — | Konfigurowalny | Agent do kompresji kontekstu |
| **system** | — | — | Wewnętrzny agent systemowy |

### 3.3 Jak agenci się konfigurują

```
Konfiguracja (7 warstw priorytetów):
  1. Defaults → 2. opencode.jsonc (global) → 3. per-workspace → 4. .env → 5. CLI flags
  → 6. Plugin config handler → 7. Runtime overrides

Plugin config handler (OMO rejestruje się tu):
  config: (input) => {
    // Faza 1: providers → dodaj custom providery
    // Faza 2: plugin-components → zarejestruj managery
    // Faza 3: agents → zarejestruj 11 agentów OMO
    // Faza 4: tools → zarejestruj 26 narzędzi OMO
    // Faza 5: MCPs → zarejestruj 3 remote MCPs
    // Faza 6: commands → zarejestruj slash commands
  }
```

---

## 4. OH-MY-OPENCODE JAKO PLUGIN — ARCHITEKTURA

### 4.1 Rejestracja pluginu

```typescript
// oh-my-opencode/src/index.ts (uproszczone)
const OhMyOpenCodePlugin: Plugin = async (ctx) => {
  // ctx = { directory: string, client: OpenCodeClient }
  
  injectServerAuthIntoClient(ctx.client)           // auth patching
  startTmuxCheck()                                  // tmux detection
  
  const config = loadPluginConfig(ctx.directory)    // JSONC merge (Zod v4 validation)
  const managers = createManagers(config, ctx)      // TmuxSession, Background, SkillMcp, Config
  const tools = createTools(config, managers, ctx)  // 26 narzędzi via ToolRegistry
  const hooks = createHooks(config, managers, ctx)  // 44+ hooków (3 tiers)
  
  return createPluginInterface(hooks, tools, managers, config)
  // → { tool, config, chat.message, tool.execute.before, tool.execute.after, ... }
}
```

### 4.2 Inicjalizacja hooków (3 tier-y)

```
createHooks()
  │
  ├─ Tier 1: CORE HOOKS (36)
  │   ├─ Session hooks (22): context-window-monitor, preemptive-compaction,
  │   │   session-recovery, model-fallback, ralph-loop, think-mode,
  │   │   edit-error-recovery, start-work, no-sisyphus-gpt, no-hephaestus-non-gpt,
  │   │   anthropic-effort, runtime-fallback, agent-usage-reminder, non-interactive-env,
  │   │   interactive-bash-session, delegate-task-retry, prometheus-md-only,
  │   │   sisyphus-junior-notepad, question-label-truncator, task-resume-info,
  │   │   anthropic-context-window-limit-recovery, auto-update-checker
  │   │
  │   ├─ Tool Guard hooks (10): comment-checker, tool-output-truncator,
  │   │   directory-agents-injector, directory-readme-injector,
  │   │   empty-task-response-detector, rules-injector, tasks-todowrite-disabler,
  │   │   write-existing-file-guard, hashline-read-enhancer, json-error-recovery
  │   │
  │   └─ Transform hooks (4): claude-code-hooks, keyword-detector,
  │       context-injector-messages-transform, thinking-block-validator
  │
  ├─ Tier 2: CONTINUATION HOOKS (7)
  │   ├─ stop-continuation-guard
  │   ├─ compaction-context-injector
  │   ├─ compaction-todo-preserver
  │   ├─ todo-continuation-enforcer
  │   ├─ unstable-agent-babysitter
  │   ├─ background-notification
  │   └─ atlas (orchestrator state)
  │
  └─ Tier 3: SKILL HOOKS (2)
      ├─ category-skill-reminder
      └─ auto-slash-command
```

### 4.3 Jak hook przechwytuje flow

Hook nie jest jawnie "pre" czy "post" — implementuje handlery pasujące do lifecycle OpenCode:

```typescript
// Przykład: write-existing-file-guard hook
createWriteExistingFileGuard() {
  return {
    "tool.execute.before": (input) => {
      // input.toolName, input.args, input.context
      if (input.toolName === "write" && fileExists(input.args.path)) {
        // Modyfikuj output — dodaj ostrzeżenie agentowi
        return { output: "⚠️ File exists. Use `edit` tool instead of `write`." }
      }
    }
  }
}

// Przykład: hashline-read-enhancer hook
createHashlineReadEnhancer() {
  return {
    "tool.execute.after": (input) => {
      if (input.toolName === "read" && input.result) {
        // Dodaj LINE#HASH do każdej linii
        const annotated = addHashlines(input.result)
        return { output: annotated }
      }
    }
  }
}
```

### 4.4 Punkt przechwycenia każdego hooka

```
Wiadomość użytkownika
  │
  ├─ ★ chat.message ← model-fallback, think-mode, start-work,
  │                     no-sisyphus-gpt, no-hephaestus-non-gpt,
  │                     non-interactive-env, stop-continuation-guard,
  │                     runtime-fallback, auto-slash-command
  │
  ├─ ★ chat.params ← anthropic-effort
  │
  ├─ ★ experimental.chat.messages.transform ← context-injector,
  │                                            thinking-block-validator,
  │                                            claude-code-hooks,
  │                                            keyword-detector
  │
  ├─ ★ chat.system.transform ← (rzadko używane)
  │
  │  [LLM generuje tool call]
  │
  ├─ ★ tool.execute.before ← write-existing-file-guard, rules-injector,
  │                           question-label-truncator, prometheus-md-only,
  │                           tasks-todowrite-disabler
  │
  │  [Tool się wykonuje]
  │
  ├─ ★ tool.execute.after ← hashline-read-enhancer, context-window-monitor,
  │                          preemptive-compaction, tool-output-truncator,
  │                          directory-agents-injector, directory-readme-injector,
  │                          comment-checker, edit-error-recovery,
  │                          json-error-recovery, agent-usage-reminder,
  │                          todo-continuation-enforcer, delegate-task-retry,
  │                          empty-task-response-detector, sisyphus-junior-notepad,
  │                          task-resume-info, interactive-bash-session,
  │                          background-notification, atlas, unstable-agent-babysitter,
  │                          category-skill-reminder, hashline-edit-diff-enhancer
  │
  │  [LLM generuje tekst / kończy odpowiedź]
  │
  ├─ ★ experimental.text.complete ← (rzadko)
  │
  ├─ ★ event (session.idle, session.error, message.updated) ←
  │      session-recovery, ralph-loop, auto-update-checker,
  │      session-notification, stop-continuation-guard,
  │      todo-continuation-enforcer, background-notification, atlas,
  │      anthropic-context-window-limit-recovery
  │
  └─ ★ experimental.session.compacting ←
         compaction-context-injector, compaction-todo-preserver
```

---

## 5. SYSTEM 11 AGENTÓW OMO

### 5.1 Tabela agentów

| # | Agent | Mode | Category | Cost | Model domyślny | Narzędzia DENY | Rola |
|---|-------|------|----------|------|----------------|----------------|------|
| 1 | **Sisyphus** | primary | utility | $$$ | UI-selected | question:allow, call_omo_agent:deny | Główny orkiestrator. Planuje z TODO, deleguje, parallel execution |
| 2 | **Hephaestus** | primary | utility | $$$ | UI-selected | question:allow, call_omo_agent:deny | Autonomiczny deep worker. Goal-oriented, GPT 5.2 Codex optymalizowany |
| 3 | **Oracle** | subagent | advisor | $$$ | own fallback | deny: write, edit, apply_patch, task | **Read-only** konsultant strategiczny. Architektura, debugging |
| 4 | **Librarian** | subagent | exploration | $ | own fallback | deny: write, edit, task, call_omo_agent | Zewnętrzne wyszukiwanie: GitHub CLI, Context7, web search |
| 5 | **Explore** | subagent | exploration | FREE | own fallback | deny: write, edit, task, call_omo_agent | Wewnętrzne przeszukiwanie codebase |
| 6 | **Metis** | subagent | advisor | $$$ | own fallback | deny: write, edit, task | Pre-planning consultant. Intent classification (6 typów) |
| 7 | **Momus** | subagent | advisor | $$$ | own fallback | deny: write, edit, task | Plan reviewer. OKAY/REJECT. Max 3 blocking issues |
| 8 | **Multimodal Looker** | subagent | utility | $ | own fallback | allowlist: read only | Analiza PDF, obrazów, diagramów |
| 9 | **Atlas** | primary | advisor | $$$ | UI-selected | deny: task, call_omo_agent (inverted) | TODO orchestrator. Dispatches parallel waves |
| 10 | **Prometheus** | special | — | — | own config | allow: edit, bash, webfetch, question | Planner. Interview mode → plan.md. Modularny prompt (6 sekcji) |
| 11 | **Sisyphus Junior** | subagent | — | — | claude-sonnet-4-6 | deny: task | Task executor. Spawned z kategorią, Claude/GPT prompt variants |

### 5.2 Mode: primary vs subagent

```
primary mode:
  └─ Używa modelu WYBRANEGO przez użytkownika w UI
     (Sisyphus, Hephaestus, Atlas)

subagent mode:
  └─ Używa WŁASNEGO fallback chain, ignoruje UI
     Oracle: claude-opus-4-6 → gpt-5.3-codex → gemini-3-pro
     Librarian: claude-haiku-4-5 → gpt-4.1-mini
     Explore: cheapest available
```

### 5.3 Delegacja — dwa mechanizmy

```
1. task (delegate-task) — CIĘŻKA delegacja
   ├─ Parametry: { prompt, category, load_skills, run_in_background, session_id }
   ├─ Tworzy NOWĄ sesję OpenCode z Sisyphus-Junior jako agent
   ├─ Category → resolve model/temperature z DEFAULT_CATEGORIES
   ├─ Background: zwraca task_id, wyniki przez background_output()
   └─ Foreground: czeka na zakończenie, zwraca wynik

2. call_omo_agent — LEKKA delegacja
   ├─ Parametry: { agent_name, prompt, run_in_background }
   ├─ Allowed: explore, librarian, oracle, hephaestus, metis, momus, multimodal-looker
   ├─ Prostszy interface niż task
   └─ Używane przez subagentów (Metis → explore)
```

### 5.4 Dynamic Agent Prompt Builder

Buduje prompty Sisyphusa/Hephaestusa dynamicznie z dostępnych komponentów:

```
buildDynamicPrompt()
  ├─ buildKeyTriggersSection() — triggery przed klasyfikacją
  ├─ buildToolSelectionTable() — tabela narzędzi sortowana cost
  ├─ buildExploreSection() — kiedy używać Explore
  ├─ buildLibrarianSection() — kiedy używać Librarian  
  ├─ buildDelegationTable() — domena → agent mapping
  ├─ buildCategorySkillsDelegationGuide() — category+skills protocol
  ├─ buildOracleSection() — reguły użycia Oracle
  ├─ buildHardBlocksSection() — wartości nieprzekraczalne
  ├─ buildAntiPatternsSection() — czego nie robić
  └─ buildDeepParallelSection() — dla non-Claude: deep parallel mode
```

---

## 6. SYSTEM PROVIDERÓW W OPENCODE

### 6.1 22 bundled SDKs

| Provider | SDK | Model loaders |
|----------|-----|---------------|
| Anthropic | @ai-sdk/anthropic | languageModel() |
| OpenAI | @ai-sdk/openai | responses() (GPT-5), chatModel() |
| Google | @ai-sdk/google | languageModel() + thinkingConfig |
| Amazon Bedrock | @ai-sdk/amazon-bedrock | languageModel() |
| Azure | @ai-sdk/azure | — |
| Groq | @ai-sdk/groq | — |
| Fireworks | @ai-sdk/fireworks | — |
| Mistral | @ai-sdk/mistral | — |
| xAI | @ai-sdk/xai | — |
| Cerebras | @ai-sdk/cerebras | — |
| Together | @ai-sdk/togetherai | — |
| DeepSeek | @ai-sdk/deepseek | — |
| GLHF | @ai-sdk/glhf | languageModel() |
| Perplexity | @ai-sdk/perplexity | — |
| OpenRouter | @openrouter/ai-sdk-provider | — |
| Ollama | ollama-ai-provider | — |
| GitHub Copilot | copilot-openai | chatModel() z PKCE OAuth |
| OpenCode Zen | zen (internal) | — |
| Z.ai | z.ai SDK | — |
| Kimi | kimi-for-coding | — |
| Custom npm | BunProc.install() dynamic | — |

### 6.2 ProviderTransform — pipeline normalizacji

```
Wiadomości z sesji → ProviderTransform pipeline:

1. unsupportedParts()
   └─ Jeśli model nie obsługuje plików/obrazów → zamień na error text

2. normalizeMessages()
   ├─ Anthropic: filtruj puste content strings, sanitizuj toolCallIds [a-zA-Z0-9_-]
   ├─ Mistral: normalizuj toolCallIds do 9 znaków, insert "Done." assistant messages
   └─ Interleaved reasoning: przenieś tekst do providerOptions

3. applyCaching()
   └─ Anthropic/Claude: cacheControl.ephemeral na pierwszych 2 system + last 2 msgs

4. options()
   ├─ OpenAI: { store: false, reasoningEffort: "medium", textVerbosity: "low" }
   ├─ Anthropic: extended beta headers
   ├─ Google: { thinkingConfig: { includeThoughts: true, thinkingLevel: "high" } }
   └─ OpenRouter: { usage: { include: true } }
```

### 6.3 Model fallback chain (OMO)

```
Fallback chain w OMO (hook: model-fallback):

  Claude Opus 4.6
    ↓ (error/timeout)
  GPT 5.3 Codex
    ↓
  Gemini 3 Pro
    ↓
  GitHub Copilot
    ↓
  OpenCode Zen
    ↓
  Z.ai
    ↓
  Kimi K2P5

pendingModelFallbacks: Map<sessionID, { chain: Model[], index: number }>
```

---

## 7. SYSTEM NARZĘDZI

### 7.1 Narzędzia wbudowane OpenCode (18+)

| Tool | Typ | Możliwości |
|------|-----|-----------|
| **read** | File I/O | Odczyt plików (text/binary), katalogów, z line range |
| **write** | File I/O | Zapis pliku (overwrite), create directories |
| **edit** | File I/O | Podmiana tekstu (old_text → new_text), 9 strategii fuzzy matching |
| **multiEdit** | File I/O | Wiele edycji w jednym pliku atomowo |
| **patch** | File I/O | Apply unified diff patch |
| **bash** | Shell | Wykonanie komend, tree-sitter command parsing, timeout |
| **glob** | Search | Wyszukiwanie plików po wzorcu |
| **grep** | Search | Przeszukiwanie treści (ripgrep-like) |
| **ls** | File I/O | Listowanie katalogów |
| **webFetch** | Network | Pobieranie URL → markdown/text/html |
| **task** | Orchestration | Spawn sub-agent session |
| **todoRead** | State | Odczyt TODO listy |
| **todoWrite** | State | Zapis/modyfikacja TODO listy |
| **question** | UX | Pytanie do użytkownika (structured UI) |
| **lsp_**(6) | LSP | goto-def, find-refs, rename, prepare-rename, symbols, diagnostics |
| **sourceGraph** | Search | Sourcegraph code search |

### 7.2 Narzędzia dodane przez OMO (26 total)

| Tool | Źródło | Cel |
|------|--------|-----|
| `lsp_goto_definition` | OMO LSP wrapper | Go-to-definition z formatowaniem |
| `lsp_find_references` | OMO LSP wrapper | Find references z formatowaniem |
| `lsp_symbols` | OMO LSP wrapper | Symbole dokumentu/workspace |
| `lsp_diagnostics` | OMO LSP wrapper | Diagnostyka błędów |
| `lsp_prepare_rename` | OMO LSP wrapper | Przygotowanie rename |
| `lsp_rename` | OMO LSP wrapper | Rename symbol |
| `grep` | OMO enhanced | Enhanced grep z limitami |
| `glob` | OMO enhanced | Enhanced glob |
| `ast_grep_search` | @ast-grep/napi | AST structural search (25+ langs) |
| `ast_grep_replace` | @ast-grep/napi | AST structural replace |
| `session_save/load/list` | Session manager | Zarządzanie sesjami |
| `background_output` | Background manager | Output z background tasks |
| `background_cancel` | Background manager | Cancel background task |
| `call_omo_agent` | Agent spawner | Spawn exploration agents |
| `look_at` | Multimodal | Wyślij plik do multimodal-looker |
| `task` | Delegate-task | Primary delegation: category → Sisyphus-Junior |
| `skill_mcp` | Skill MCP manager | Invoke tools z skill-embedded MCPs |
| `skill` | Skills | Load skill content, list skills |
| `interactive_bash` | Tmux | Persistent bash z tmux awareness |
| `edit` | **Hashline-edit** | ZASTĘPUJE wbudowany edit! LINE#HASH references |
| `task_create/get/list/update` | Task system | Experimental task management |

### 7.3 Hashline Edit — kluczowa innowacja OMO

```
Standard OpenCode edit:
  edit({ file: "app.ts", old_text: "function hello()", new_text: "function world()" })
  └─ Problem: co jeśli "function hello()" występuje wielokrotnie?
     9 strategii fuzzy matching → ale wciąż podatne na drift

OMO Hashline edit:
  1. read("app.ts") → hook hashline-read-enhancer dodaje:
     "11#VK: function hello() {"
     "22#XJ:   return 'world'"
     "33#MB: }"
  
  2. Agent widzi LINE#HASH format
  
  3. edit({ type: "replace_lines", start_line: "11#VK", end_line: "33#MB", text: "..." })
     └─ Hash weryfikuje aktualność linii
     └─ Jeśli plik się zmienił → hash mismatch → error (force re-read)

  Benchmark: 6.7% → 68.3% success rate (Grok Code Fast 1)
```

---

## 8. SYSTEM PERMISJI

### 8.1 PermissionNext — nowy system

```
Ruleset = Rule[]

Rule = {
  permission: string      // "write" | "bash" | "edit" | "*" | "doom_loop" | ...
  pattern: string         // "*" | "/src/**" | "rm -rf *"
  action: "allow" | "deny" | "ask"
}

Hierarchia (od najwyższego priorytetu):
  1. Session-level (runtime permissions granted by user)
  2. Agent-level (OpenCode agent config + OMO tool restrictions)
  3. Config-level (user's opencode.jsonc)
  4. Defaults: { "*": "allow", doom_loop: "ask", external_directory: "ask", question: "deny" }

Ewaluacja: LAST matching rule wins (nie first!)
```

### 8.2 OMO tool restrictions per agent

```typescript
// Oracle — read-only advisor
createAgentToolRestrictions(["write", "edit", "apply_patch", "task"])
// → { permission: { write: "deny", edit: "deny", apply_patch: "deny", task: "deny" } }

// Explore — search only
createAgentToolRestrictions(["write", "edit", "apply_patch", "task", "call_omo_agent"])

// Multimodal Looker — ALLOWLIST (only read)
createAgentToolAllowlist(["read"])
// → { permission: { "*": "deny", read: "allow" } }
```

---

## 9. SNAPSHOT / WORKTREE SYSTEM

### 9.1 Snapshot (osobny .git repo)

```
Lokalizacja: $DATA_DIR/snapshot/$projectID/  (NIE w repo projektu!)

track():
  git add .
  git write-tree  → zwraca tree hash

patch(hash):
  git diff --name-only $hash  → lista zmienionych plików

restore(hash):
  git read-tree $hash
  git checkout-index -a -f

revert(patches):
  Przywróć konkretne pliki z snapshot hash

gc():
  git gc --prune=7.days  (periodyczny cleanup)
```

### 9.2 Kiedy snapshoty się wykonują

```
Processor.process() → stream event "start-step":
  └─ Snapshot.track() — tworzy snapshot PRZED każdym krokiem LLM

Processor.process() → stream event "finish-step":
  └─ SessionSummary.summarize() — oblicza diff między snapshot a current state

Undo/Revert:
  └─ Przywraca stan z wcześniejszego snapshot tree hash
```

---

## 10. MCP (MODEL CONTEXT PROTOCOL)

### 10.1 OpenCode: MCP Client only

```
Transporty:
  ├─ stdio (lokalne procesy)
  └─ HTTP (remote servers z OAuth)

Konfiguracja:
  ├─ opencode.jsonc → mcp: { "server-name": { command, args, env } }
  ├─ .mcp.json (Claude Code compat)
  └─ Plugin-dostarczane (OMO dodaje 3 remote MCPs)
```

### 10.2 OMO: 3 wbudowane remote MCPs

| MCP | URL | Cel |
|-----|-----|-----|
| **websearch** | mcp.exa.ai/mcp lub mcp.tavily.com/mcp/ | Web search (konfigurowalny provider) |
| **context7** | mcp.context7.com/mcp | Dokumentacja 1000+ bibliotek |
| **grep_app** | mcp.grep.app | Szukanie kodu na GitHubie |

### 10.3 Skill-embedded MCPs (OMO)

```
SKILL.md frontmatter:
---
mcp:
  name: "playwright"
  command: "npx"
  args: ["@anthropic/playwright-mcp"]
---

SkillMcpManager:
  ├─ Parsuje frontmatter SKILL.md
  ├─ Startuje MCP server (stdio lub HTTP)
  ├─ Scope: per-task (znika po zakończeniu)
  └─ Context window stays clean
```

---

## 11. LSP INTEGRATION

### 28 wbudowanych Language Serverów (OpenCode)

```
Auto-install i auto-start per język:
  TypeScript → typescript-language-server
  Python → pyright / pylsp
  Go → gopls
  Rust → rust-analyzer
  Java → jdtls
  C# → omnisharp
  Ruby → solargraph
  PHP → intelephense
  ... (28 total)

Operacje:
  ├─ textDocument/definition → lsp_goto_definition
  ├─ textDocument/references → lsp_find_references
  ├─ textDocument/rename → lsp_rename
  ├─ textDocument/prepareRename → lsp_prepare_rename
  ├─ textDocument/documentSymbol → lsp_symbols
  ├─ workspace/symbol → lsp_symbols (workspace)
  └─ textDocument/diagnostic → lsp_diagnostics

Komunikacja: JSON-RPC via stdio (vscode-jsonrpc)
```

---

## 12. KOMPAKCJA / CONTEXT MANAGEMENT

### 12.1 Trzy mechanizmy

```
1. PRUNING (po każdej pętli):
   ├─ Skanuj wstecz narzędzia tool outputs
   ├─ Chroń ostatnie 40 000 tokenów
   ├─ Starsze outpuxy → state.time.compacted = Date.now()
   └─ Skompaktowane: "[Old tool result content cleared]"

2. AUTO-COMPACTION (OMO: preemptive-compaction hook):
   ├─ Śledzi token usage per session (cache: provider, model, tokens)
   ├─ Ratio = totalInputTokens / actualLimit
   ├─ Jeśli ≥ 78% → client.session.summarize({ auto: true })
   └─ Actual limit: 200K default, 1M jeśli ANTHROPIC_1M_CONTEXT

3. OVERFLOW COMPACTION (OpenCode core):
   ├─ Po "finish-step": total_tokens >= usable_limit?
   ├─ Tak → queue CompactionPart
   ├─ Compaction agent generuje structured summary:
   │     Goal, Instructions, Discoveries, Accomplished, Relevant files
   ├─ ★ Plugin.trigger("experimental.session.compacting")
   │     ← OMO: compaction-context-injector (dodaje TODO state, background tasks)
   │     ← OMO: compaction-todo-preserver (zachowuje TODO przez kompakcję)
   └─ filterCompacted(): zachowaj tylko messages od ostatniego summary
```

### 12.2 OMO context-window-monitor

```
Event: message.updated (assistant, finished)
  └─ Cache: { providerID, modelID, tokens } per session

Tool.execute.after:
  ├─ Read cached tokens
  ├─ Compute ratio = input_tokens / actual_limit
  ├─ 70%: append "⚠ Context at 70%" to tool output
  ├─ 78%: trigger preemptive compaction
  └─ 90%+: emergency mode
```

---

## 13. STORAGE

### 13.1 SQLite (via Drizzle ORM)

```
Tabele:
  ├─ session — id, slug, project_id, parent_id, directory, title, summary_*, permission
  ├─ message — id, session_id, data (JSON: role, agent, model, cost, tokens, error, finish)
  └─ part — id, message_id, session_id, data (JSON discriminated union)

Part types (12):
  text, tool, reasoning, step-start, step-finish, patch, file, agent, subtask, compaction

File-based storage (via Storage.write):
  ├─ session_diff → diffs per session
  ├─ boulder-state → Sisyphus work tracking
  ├─ ralph-loop → loop state persistence
  └─ run-continuation → continuation markers
```

### 13.2 Konfiguracja (7 warstw)

```
1. Defaults (hardcoded)
2. opencode.jsonc global (~/.config/opencode/opencode.jsonc)
3. Per-workspace (.opencode/opencode.jsonc)  
4. .env interpolation ($VAR w JSONC)
5. CLI flags (--model, --agent, etc.)
6. Plugin config handler (OMO phase 1-6)
7. Runtime overrides (permission grants, model changes)

OMO config (osobny plik):
  Project: .opencode/oh-my-opencode.jsonc
  User: ~/.config/opencode/oh-my-opencode.jsonc
  Format: JSONC z Zod v4 validation
  22+ sub-schemas
```

---

## 14. KLUCZOWE ZALEŻNOŚCI

### OpenCode

| Pakiet | Rola |
|--------|------|
| **hono** | HTTP server framework |
| **Bun.serve** | Runtime serwera |
| **drizzle-orm + better-sqlite3** | ORM + SQLite storage |
| **ai (Vercel AI SDK)** | Unified LLM interface (streamText, middleware) |
| **@ai-sdk/*** (22 pakietów) | Provider SDKs |
| **yargs** | CLI framework (20+ commands) |
| **ink + react** | TUI rendering (Bubble Tea-like) |
| **tree-sitter*** | Parsowanie komend shell, wykrywanie języków |
| **vscode-jsonrpc** | LSP komunikacja |
| **marked/mdast** | Markdown processing |
| **diff** | Unified diff generation |

### Oh-My-OpenCode

| Pakiet | Rola |
|--------|------|
| **@opencode-ai/plugin** | Plugin SDK (Plugin, ToolDefinition types) |
| **@opencode-ai/sdk** | Client SDK (AgentConfig, Message types) |
| **@ast-grep/napi** | AST search/replace (native binary) |
| **@modelcontextprotocol/sdk** | MCP protocol client/server |
| **zod v4** | Config schema validation |
| **jsonc-parser** | JSON with comments |
| **commander** | CLI additions |
| **picomatch** | Glob matching |
| **js-yaml** | SKILL.md frontmatter parsing |
| **@code-yeongyu/comment-checker** | AI comment pattern detection |

---

## 15. KATEGORIE I MODELE DOMYŚLNE (OMO)

```typescript
DEFAULT_CATEGORIES = {
  "visual-engineering": { model: "google/gemini-3-pro", variant: "high" },
  ultrabrain:           { model: "openai/gpt-5.3-codex", variant: "xhigh" },
  deep:                 { model: "openai/gpt-5.3-codex", variant: "medium" },
  artistry:             { model: "google/gemini-3-pro", variant: "high" },
  quick:                { model: "anthropic/claude-haiku-4-5" },
  "unspecified-low":    { model: "anthropic/claude-sonnet-4-6" },
  "unspecified-high":   { model: "anthropic/claude-opus-4-6", variant: "max" },
  writing:              { model: "kimi-for-coding/k2p5" },
}
```

---

## PODSUMOWANIE — KLUCZOWE WZORCE ARCHITEKTONICZNE

| Wzorzec | Gdzie | Jak |
|---------|-------|-----|
| **Client-Server + SSE** | OpenCode core | Hono server, Bus → SSE broadcast, wielokrotne klienty |
| **Plugin as Hook Provider** | OMO → OpenCode | Plugin zwraca obiekt z handlerami dla 12+ lifecycle hooks |
| **Factory Pattern** | Wszystko w OMO | createXXX() functions, zero klas poza managerami |
| **Middleware Pipeline** | ProviderTransform | Messages → unsupportedParts → normalize → cache → send |
| **Ruleset Permission** | PermissionNext | Last-match-wins evaluation, 4-layer merge |
| **Separate Git Repo** | Snapshot system | $DATA/snapshot/ — nie pollute working repo |
| **Zod Schema Validation** | Config, tools, agents | Runtime validation + TypeScript type inference |
| **Fallback Chain** | Model selection, providers | Ordered list, auto-switch on error |
| **Event-driven** | Bus system | Pub/sub per-instance, global cross-instance |
| **Hash-anchored Edit** | Hashline system | LINE#HASH tags → deterministic references → mismatch protection |
| **3-Tier Hook Loading** | OMO hooks | Core (36) → Continuation (7) → Skill (2), safeCreateHook wrapper |
| **Dynamic Prompt Builder** | Agent prompts | Buduje prompt z dostępnych komponentów, tabel, sekcji |

---

## 16. EWOLUCJA ARCHITEKTURY — STARE VS NOWE WZORCE

> Na podstawie ADR-033 do ADR-040 — przejscie z monolitu na LangChain-Inspired modular architecture

### 16.1 Przeglad zmian architektonicznych

```
STARY PATTERN (OpenCode 1.x + OMO legacy):
┌─────────────────────────────────────────────────────────────┐
│ Monolityczny plugin z 44 hookami w jednym miejscu           │
│ Bezposrednie wywolania tool.execute przed LLM               │
│ Static agent prompts (hardcoded w TS)                       │
│ Synchroniczna orkiestracja (jeden agent czeka na drugi)     │
│ Globalny event bus bez typowania                            │
│ Tool output jako plain text (brak struktury)                │
└─────────────────────────────────────────────────────────────┘

NOWY PATTERN (DiriCode / OpenCode 2.x):
┌─────────────────────────────────────────────────────────────┐
│ Modular components (Router, Memory, Tools jako osobne)      │
│ Middleware pipeline przed LLM request (ADR-033)             │
│ Dynamic prompt assembly z SKILL.md + runtime data           │
│ Async subagents z parallel wave execution (ADR-039)         │
│ Tool retry with exponential backoff (ADR-036)               │
│ Tool call limits per session (ADR-035)                      │
└─────────────────────────────────────────────────────────────┘
```

### 16.2 Tabela kontrastujaca — Stare vs Nowe wzorce

| Aspekt | STARY PATTERN (Legacy) | NOWY PATTERN (LangChain-Inspired) | ADR |
|--------|------------------------|-----------------------------------|-----|
| **Orchestracja** | Single-threaded, synchroniczna | Async subagents z wave-based parallel | ADR-039 |
| **Agent Prompts** | Static, hardcoded w TypeScript | Dynamic assembly z SKILL.md templates | ADR-007 |
| **Tool Calls** | Bezposrednie execute przed LLM | Middleware pipeline z transformacjami | ADR-033 |
| **Event System** | Globalny bus bez typowania | Typed Event Bus (Zod schemas) | — |
| **Memory** | Session-only (brak persistence) | SQLite + FTS5 + Timeline service | — |
| **Tool Output** | Plain text | Structured + Annotations (readOnly/destructive/idempotent) | ADR-015 |
| **Error Handling** | Silent fail lub crash | Guardrails + Checkpoint protocols | ADR-014 |
| **Router Logic** | Provider-specific w kazdym agentcie | Centralny TS Router z failover | ADR-025 |
| **Context Management** | Manual (brak kontroli) | Context budget + Progressive detail | ADR-020 |
| **Skill System** | Ad-hoc (rozne formaty) | Standard SKILL.md z YAML frontmatter | ADR-007 |

### 16.3 Kluczowe inspiracje z LangChain

```typescript
// STARY: Bezposrednie tool execution
const result = await tool.execute(args)  // bez middleware

// NOWY: Middleware chain (ADR-033, ADR-034)
const result = await toolChain
  .pipe(secretRedactor)      // mask secrets
  .pipe(rateLimitGuard)      // check quotas
  .pipe(cacheLookup)         // check cache
  .pipe(executeTool)         // actual execution
  .pipe(outputValidator)     // validate structure
  .pipe(annotationEnricher)  // add metadata
  .invoke(args)
```

### 16.4 Async Subagents — Evolucja delegacji

```
LEGACY PATTERN (OMO):
  task() → tworzy nowa sesje OpenCode
  → czeka na zakonczenie (blocking)
  → zwraca wynik
  
  Problem: 1 subagent = 1 czekajacy agent glowny

NOWY PATTERN (ADR-039):
  wave.spawn([agent1, agent2, agent3])  // parallel
  → kazdy dostaje wlasny kontekst
  → wave.collect() czeka na wszystkich
  → merge results przez Verifier agenta
  
  Zaleta: N subagents = 1 orchestration overhead
```

### 16.5 Typed Event Bus — Evolucja komunikacji

```typescript
// STARY: Brak typowania, string-based events
bus.emit('session.updated', data)  // data: any

// NOWY: Zod-validated events (compile-time safety + runtime validation)
const SessionUpdatedEvent = z.object({
  sessionId: z.string(),
  status: z.enum(['idle', 'busy', 'error']),
  timestamp: z.number()
})

bus.emit('session.updated', validatedData)
// Compile-time safety + runtime validation
```

### 16.6 Tool Annotations — Evolucja bezpieczenstwa

```typescript
// STARY: Brak informacji o narzedziach
const tools = [readTool, writeTool, bashTool]
// Agent nie wie ktore sa destructive

// NOWY: Explicit annotations (ADR-015)
const tools = [
  { ...readTool, annotations: { readOnly: true, idempotent: true } },
  { ...writeTool, annotations: { destructive: true, idempotent: false } },
  { ...bashTool, annotations: { destructive: true, idempotent: false } }
]
// Dispatcher moze auto-approve readOnly, pytac o destructive
```

### 16.7 Podsumowanie migracji

| Metryka | Legacy | LangChain-Inspired | Improvement |
|---------|--------|-------------------|-------------|
| Modularyzacja | Low (monolit) | High (components) | 5x separacji |
| Parallel execution | Brak | Wave-based | N-x speedup |
| Type safety | Runtime only | Zod compile+runtime | 90% mniej bugow |
| Context control | Manual | Budget + progress detail | 50% mniej tokenow |
| Tool safety | All-or-nothing | Granular annotations | Controllable risk |
| Skill portability | Brak | SKILL.md standard | Reusable ecosystem |

---

*Ostatnia aktualizacja: Marzec 2026 | ADR-033 through ADR-040 (async subagents: ADR-039; tool annotations: ADR-015)*
