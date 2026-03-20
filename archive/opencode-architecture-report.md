# OpenCode — Comprehensive Architecture Report

> Generated from source analysis of `opencode` v1.2.10  
> Entry point: `packages/opencode/src/index.ts`

---

## Table of Contents

1. [Entry Point & CLI Bootstrap](#1-entry-point--cli-bootstrap)
2. [Agent System](#2-agent-system)
3. [Session Management](#3-session-management)
4. [Provider System](#4-provider-system)
5. [Tool System](#5-tool-system)
6. [Plugin System](#6-plugin-system)
7. [Server Architecture](#7-server-architecture)
8. [Event Bus](#8-event-bus)
9. [Snapshot/Git System](#9-snapshotgit-system)
10. [MCP Protocol Integration](#10-mcp-protocol-integration)
11. [LSP Integration](#11-lsp-integration)
12. [Permission System](#12-permission-system)
13. [Configuration System](#13-configuration-system)
14. [Worktree System](#14-worktree-system)
15. [Key Dependencies](#15-key-dependencies)

---

## 1. Entry Point & CLI Bootstrap

**File**: `src/index.ts`

### Bootstrap Flow

1. Sets `process.env.AGENT = "1"` and `process.env.OPENCODE = "1"`
2. Initializes structured logging (`Log.init()`)
3. Runs one-time JSON→SQLite migration (`Migration.v1()`)
4. Constructs yargs CLI with ~20+ commands
5. Each command triggers `InstanceBootstrap` which initializes the Instance context (project detection, config loading, database, snapshot, plugin init)

### CLI Commands (registered via yargs)

| Command | Description |
|---------|-------------|
| `RunCommand` | Primary interactive mode |
| `ServeCommand` | HTTP API server |
| `WebCommand` | Web UI launch |
| `GenerateCommand` | Code generation |
| `AuthCommand` | Provider authentication |
| `AgentCommand` | Agent management |
| `McpCommand` | MCP server/client operations |
| `PrCommand` | Pull request workflows |
| `SessionCommand` | Session CRUD |
| `DbCommand` | Database operations (drizzle-kit) |

### Key Function Signatures

```typescript
// src/index.ts — main entry
yargs(process.argv.slice(2))
  .command(RunCommand)
  .command(ServeCommand)
  // ... more commands
  .parse()
```

---

## 2. Agent System

**File**: `src/agent/agent.ts`

### Agent.Info Schema

```typescript
Agent.Info = z.object({
  name: z.string(),
  description: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]),
  native: z.boolean().optional(),
  hidden: z.boolean().optional(),
  topP: z.number().optional(),
  temperature: z.number().optional(),
  color: z.string().optional(),
  permission: PermissionNext.Ruleset,   // Array of permission rules
  model: z.object({ providerID, modelID }).optional(),
  variant: z.string().optional(),
  prompt: z.string().optional(),
  options: z.record(z.string(), z.any()).optional(),
  steps: z.number().optional(),
})
```

### Built-in Agents (7 total)

| Name | Mode | Purpose | Key Details |
|------|------|---------|-------------|
| `build` | primary | Default coding agent | Full tool access, all permissions |
| `plan` | primary | Read-only planning | Denies edit tools except `.opencode/plans/*.md` |
| `general` | subagent | Parallel worker | Full tool access for delegated work |
| `explore` | subagent | Codebase exploration | Custom prompt from `prompt/explore.txt`, restricted to read-only tools |
| `compaction` | hidden | Context summarization | Triggered when token count exceeds context limit |
| `title` | hidden | Session title generation | Auto-generates session titles |
| `summary` | hidden | Session summary | Generates summaries after tool use |

### Key Functions

- **`Agent.get(name: string)`** — Returns agent config by name; merges built-in + config-defined agents
- **`Agent.list()`** — Returns all non-hidden agents
- **`Agent.defaultAgent()`** — Returns the configured default agent (defaults to "build")
- **`Agent.generate(input)`** — Uses AI to create agent configs dynamically

### Data Flow

```
Config agents (opencode.json) ──┐
                                ├─> merge + override ──> Agent.Info[]
Built-in agents ────────────────┘
```

Config agents merge with built-in agents. Setting `disable: true` on a built-in name removes it. Each agent carries its own permission `Ruleset` merged from: defaults → agent-specific rules → user config overrides.

---

## 3. Session Management

**Files**: `src/session/index.ts`, `src/session/processor.ts`, `src/session/message-v2.ts`, `src/session/llm.ts`, `src/session/compaction.ts`, `src/session/instruction.ts`, `src/session/system.ts`

### Session.Info Schema

```typescript
Session.Info = z.object({
  id: z.string(),
  slug: z.string(),
  projectID: z.string(),
  directory: z.string(),
  parentID: z.string().optional(),
  title: z.string(),
  version: z.number(),
  summary: z.string().optional(),
  share: z.string().optional(),
  revert: z.any().optional(),
  permission: PermissionNext.Ruleset.optional(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
    compacting: z.number().optional(),
    archived: z.number().optional(),
  }),
})
```

### Message Types (MessageV2)

Two top-level roles as a discriminated union:

**UserMessage**:
```typescript
MessageV2.User = {
  role: "user",
  id, sessionID,
  time: { created },
  format: OutputFormat.optional(),      // "text" | "json_schema"
  agent: string,
  model: { providerID, modelID },
  system: string.optional(),
  tools: Record<string, boolean>.optional(),
  variant: string.optional(),
  summary: { title, body, diffs: FileDiff[] }.optional(),
}
```

**AssistantMessage**:
```typescript
MessageV2.Assistant = {
  role: "assistant",
  id, sessionID,
  parentID: string,                     // links to user message
  time: { created, completed? },
  error: ErrorDiscriminatedUnion.optional(),
  modelID, providerID,
  agent: string,
  path: { cwd, root },
  cost: number,
  tokens: { total?, input, output, reasoning, cache: { read, write } },
  structured: any.optional(),
  variant: string.optional(),
  finish: string.optional(),
}
```

### Part Types (12 total)

Discriminated union on `type`:

| Part Type | Purpose |
|-----------|---------|
| `text` | AI text output with optional metadata |
| `reasoning` | Chain-of-thought/thinking tokens |
| `tool` | Tool call with state machine: `pending` → `running` → `completed` / `error` |
| `file` | File attachment (image, PDF, etc.) with source info |
| `subtask` | Delegated agent task reference |
| `step-start` / `step-finish` | Marks LLM step boundaries with snapshot + token usage |
| `snapshot` | Git tree hash checkpoint |
| `patch` | File diff tracking (hash + changed files) |
| `agent` | Agent switch marker |
| `retry` | API retry attempt record |
| `compaction` | Context compaction trigger |

### Session Processing Pipeline

**SessionProcessor** (`src/session/processor.ts`):

```
User Input
    │
    ▼
SessionProcessor.create({ assistantMessage, sessionID, model, abort })
    │
    ▼
processor.process(streamInput) ──> LLM.stream(input)
    │                                  │
    │                                  ▼
    │                          AI SDK streamText()
    │                                  │
    ▼                                  ▼
Event Loop (fullStream iteration):
  ├─ "start"            → SessionStatus.set("busy")
  ├─ "reasoning-*"      → Create/update ReasoningPart
  ├─ "text-*"           → Create/update TextPart
  ├─ "tool-input-*"     → Create ToolPart (pending)
  ├─ "tool-call"        → Update ToolPart (running), check doom loop
  ├─ "tool-result"      → Update ToolPart (completed)
  ├─ "tool-error"       → Update ToolPart (error), handle rejection
  ├─ "start-step"       → Snapshot.track(), create StepStartPart
  ├─ "finish-step"      → Calculate usage, create StepFinishPart, check compaction
  └─ "error"            → Error handling with retry logic
    │
    ▼
Returns: "continue" | "compact" | "stop"
```

**Doom Loop Detection**: If the last 3 tool calls have identical (tool, input) pairs, triggers a `doom_loop` permission check to ask user confirmation.

**Compaction** (`src/session/compaction.ts`):
- Triggered when token usage exceeds `model.limit.input - reserved_buffer`
- Default buffer: `COMPACTION_BUFFER = 20_000` tokens
- **Pruning**: Walks backwards through parts; after 40K tokens of tool calls, erases output of older tool calls (sets `compacted` timestamp)
- **PRUNE_MINIMUM**: Only prunes if >20K tokens can be reclaimed
- **PRUNE_PROTECT**: Keeps most recent 40K tokens of tool output intact
- Protected tools: `"skill"` (never pruned)
- Compaction uses the `compaction` agent to generate a summary, then posts a synthetic "Continue if you have next steps" message

### System Prompt Assembly

**SystemPrompt** (`src/session/system.ts`):
```typescript
SystemPrompt.provider(model)     // Model-specific prompt (anthropic/beast/gemini/codex/trinity/qwen)
SystemPrompt.environment(model)  // Working dir, platform, date, git status
```

**InstructionPrompt** (`src/session/instruction.ts`):
- Searches for `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md` (deprecated) walking up from project root
- Global instruction files: `~/.config/opencode/AGENTS.md`, `~/.claude/CLAUDE.md`
- Config `instructions` array: supports file paths, globs, URLs (fetched with 5s timeout)
- **Contextual instructions**: When a file is read, searches parent directories for instruction files not already loaded

### LLM Streaming (`src/session/llm.ts`)

```typescript
LLM.StreamInput = {
  user: MessageV2.User,
  agent: Agent.Info,
  abort: AbortSignal,
  sessionID: string,
  tools: Record<string, Tool>,
  system: string[],
  messages: ModelMessage[],
  model: Provider.Model,
}
```

Key behaviors:
- System prompt construction: agent prompt → custom system → user system instructions
- Plugin hooks: `"experimental.chat.system.transform"` (modify system), `"chat.params"` (modify params), `"chat.headers"` (add headers)
- Tool filtering: Removes tools disabled by permission or user override
- LiteLLM compatibility: Adds dummy `_noop` tool when history has tool calls but no active tools
- Uses `wrapLanguageModel` middleware for message transformation (via `ProviderTransform.message()`)
- OpenTelemetry integration (behind experimental flag)

---

## 4. Provider System

**Files**: `src/provider/provider.ts`, `src/provider/transform.ts`

### Provider.Model Schema

```typescript
Provider.Model = z.object({
  id: z.string(),
  providerID: z.string(),
  api: z.object({
    id: z.string(),        // Model ID within the provider (e.g., "claude-sonnet-4-20250514")
    url: z.string(),       // API endpoint URL
    npm: z.string(),       // AI SDK package (e.g., "@ai-sdk/anthropic")
  }),
  name: z.string(),
  family: z.string().optional(),
  capabilities: z.object({
    temperature: z.boolean(),
    reasoning: z.boolean(),
    attachment: z.boolean(),
    toolcall: z.boolean(),
    input: { text, audio, image, video, pdf },
    output: { text, audio, image, video },
    interleaved: z.union([z.boolean(), z.object({ field: z.string() })]),
  }),
  cost: z.object({
    input: z.number(),
    output: z.number(),
    cache: { read, write },
    experimentalOver200K: z.number().optional(),
  }),
  limit: z.object({
    context: z.number(),
    input: z.number().optional(),
    output: z.number(),
  }),
  status: z.string(),
  options: z.record(z.string(), z.any()),
  headers: z.record(z.string(), z.string()).optional(),
  release_date: z.string(),
  variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
})
```

### 22 Bundled Provider SDKs

`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/azure`, `@ai-sdk/google`, `@ai-sdk/google-vertex`, `@ai-sdk/google-vertex/anthropic`, `@ai-sdk/amazon-bedrock`, `@openrouter/ai-sdk-provider`, `@ai-sdk/xai`, `@ai-sdk/mistral`, `@ai-sdk/groq`, `@ai-sdk/deepinfra`, `@ai-sdk/cerebras`, `@ai-sdk/cohere`, `@ai-sdk/gateway`, `@ai-sdk/togetherai`, `@ai-sdk/perplexity`, `@ai-sdk/vercel`, `@ai-sdk/openai-compatible`, `@ai-sdk/github-copilot`, `@gitlab/gitlab-ai-provider`, `ai-gateway-provider`

### Custom Provider Loaders

Each loader handles authentication, model discovery, and SDK instantiation for: `anthropic`, `opencode`, `openai`, `github-copilot`, `github-copilot-enterprise`, `azure`, `azure-cognitive-services`, `amazon-bedrock`, `openrouter`, `vercel`, `google-vertex`, `google-vertex-anthropic`, `sap-ai-core`, `zenmux`, `gitlab`, `cloudflare-workers-ai`, `cloudflare-ai-gateway`, `cerebras`, `kilo`

### Provider Loading Order

```
models.dev database → env vars → stored auth keys → plugin auth loaders → custom loaders → config overrides
```

### Key Functions

- **`Provider.list()`** — Returns all configured providers with their models
- **`Provider.getModel(providerID, modelID)`** — Resolves a specific model
- **`Provider.getLanguage(providerID, modelID)`** — Returns AI SDK `LanguageModel` instance
- **`Provider.getSDK(providerID)`** — Returns cached SDK instance (cache key: xxHash32 of config)
- **`Provider.defaultModel()`** — Returns the configured default model
- **`Provider.getSmallModel()`** — Returns a lightweight model for utility tasks (titles, summaries)
- **`Provider.parseModel(string)`** — Parses `"provider/model"` string format
- **`Provider.sort(models)`** — Sorts models by capability/cost
- **`Provider.closest(query, models)`** — Fuzzy-matches a model name
- Dynamic npm package installation for non-bundled provider SDKs via `BunProc.install()`

### Provider Transform (`src/provider/transform.ts`)

Handles all provider-specific message normalization, caching annotation, reasoning variants, and schema sanitization.

**Key functions**:

- **`ProviderTransform.message(msgs, model, options)`** — Normalizes messages per provider:
  - Anthropic: Filters empty content, sanitizes toolCallIds (`[^a-zA-Z0-9_-]` → `_`)
  - Mistral: Normalizes toolCallIds to exactly 9 alphanumeric chars, injects bridge assistant messages
  - Interleaved reasoning: Routes reasoning to provider-specific fields
  - Cache control: Applies `cacheControl: ephemeral` to first 2 system + last 2 messages (Anthropic, OpenRouter, Bedrock, Copilot)
  - Unsupported parts: Replaces unsupported media types with error text messages

- **`ProviderTransform.variants(model)`** — Generates reasoning effort variants per provider SDK:
  - OpenAI: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`
  - Anthropic: `high` (budgetTokens: 16K), `max` (budgetTokens: 32K), or adaptive `low/medium/high/max`
  - Google: thinkingBudget or thinkingLevel based on model generation
  - Bedrock: `reasoningConfig` with type-specific options

- **`ProviderTransform.maxOutputTokens(model)`** — `Math.min(model.limit.output, 32_000)`

- **`ProviderTransform.options(input)`** — Provider-specific default options:
  - OpenAI: `store: false`, `promptCacheKey`
  - Google: `thinkingConfig.includeThoughts`
  - GPT-5: `reasoningEffort: "medium"`, `textVerbosity: "low"`
  - OpenRouter: `usage: { include: true }`

- **`ProviderTransform.schema(model, schema)`** — Sanitizes JSON schemas for provider compatibility (Gemini: converts integer enums to string, fixes nested arrays)

---

## 5. Tool System

**Files**: `src/tool/tool.ts`, `src/tool/registry.ts`, individual tool files

### Tool.Info Interface

```typescript
Tool.Info<Parameters, Metadata> = {
  id: string,
  init(ctx?: { agent: Agent.Info }) → {
    description: string,
    parameters: ZodSchema<Parameters>,
    execute(args: Parameters, ctx: Tool.Context) → {
      title: string,
      metadata: Metadata,
      output: string,
      attachments?: FilePart[],
    },
    formatValidationError?: (error) => string,
  }
}
```

### Tool.Context

```typescript
Tool.Context = {
  sessionID: string,
  messageID: string,
  agent: Agent.Info,
  abort: AbortSignal,
  callID?: string,
  extra?: Record<string, any>,
  messages: MessageV2.WithParts[],
  metadata(input: { title?, metadata? }) → void,    // Update UI metadata
  ask(input: PermissionInput) → Promise<void>,       // Request permission
}
```

### Built-in Tools (18+)

| Tool | File | Purpose |
|------|------|---------|
| `bash` | `bash.ts` | Shell command execution with tree-sitter parsing for permission extraction |
| `read` | `read.ts` | File reading with line ranges, contextual instruction loading |
| `edit` | `edit.ts` | Search-and-replace editing with 9 fuzzy matching strategies |
| `write` | `write.ts` | Full file creation/overwrite |
| `glob` | `glob.ts` | File pattern matching |
| `grep` | `grep.ts` | Ripgrep text search |
| `task` | `task.ts` | Subagent delegation (creates child sessions) |
| `web_fetch` | `web-fetch.ts` | URL content fetching |
| `web_search` | `web-search.ts` | Web search |
| `code_search` | `code-search.ts` | Semantic code search |
| `todowrite` | `todowrite.ts` | TODO/task list management |
| `skill` | `skill.ts` | Skill lookup and execution |
| `question` | `question.ts` | Ask user for clarification |
| `apply_patch` | `apply-patch.ts` | Multi-file patch application (used for GPT models) |
| `lsp` | `lsp.ts` | LSP operations (experimental) |
| `batch` | `batch.ts` | Parallel tool execution (experimental) |
| `plan_enter`/`plan_exit` | | Plan mode transitions (experimental) |

### Edit Tool — Fuzzy Matching Chain

The edit tool (`src/tool/edit.ts`) chains 9 replacement strategies in order:

1. **SimpleReplacer** — Exact string match
2. **LineTrimmedReplacer** — Matches after trimming whitespace from each line
3. **BlockAnchorReplacer** — Matches by first+last line anchors with Levenshtein similarity scoring (single candidate threshold: 0.0, multiple: 0.3)
4. **WhitespaceNormalizedReplacer** — Normalizes all whitespace to single spaces
5. **IndentationFlexibleReplacer** — Removes minimum common indentation before comparing
6. **EscapeNormalizedReplacer** — Handles escape sequences (`\n`, `\t`, etc.)
7. **TrimmedBoundaryReplacer** — Trims leading/trailing whitespace
8. **ContextAwareReplacer** — Uses first+last lines as anchors with ≥50% middle-line match
9. **MultiOccurrenceReplacer** — Handles `replaceAll` parameter

### Bash Tool — Command Parsing

Uses **web-tree-sitter** with `tree-sitter-bash` grammar to:
- Parse commands into AST
- Extract command names and arguments
- Resolve paths for `cd`, `rm`, `cp`, `mv`, `mkdir`, `touch`, `chmod`, `chown`, `cat`
- Detect external directory access (outside `Instance.directory`)
- Generate permission patterns (command prefix + `*` for "always" rules)
- Supports `Plugin.trigger("shell.env", ...)` for environment injection

### Task Tool — Subagent Orchestration

```
Parent Session ──TaskTool──> Session.create(parentID)──> Child Session
                                                              │
                                                              ▼
                                                        SessionPrompt.prompt()
                                                              │
                                                              ▼
                                                        Agent processes in isolated session
                                                              │
                                                              ▼
                                                        Returns text result to parent
```

Child sessions:
- Linked via `parentID`
- Default denied: `todowrite`, `todoread`, and `task` (unless agent explicitly has task permission)
- Can be resumed by passing `task_id` in subsequent calls
- Use caller's model unless agent specifies its own

### Tool Registry

```typescript
ToolRegistry.tools(model: Provider.Model, agent: Agent.Info): Record<string, Tool.Info>
```

Filtering logic:
- GPT models: Uses `apply_patch` instead of `edit`/`write`
- `web_search`/`code_search`: Only for "opencode" provider
- Experimental tools (`lsp`, `batch`, `plan_enter`, `plan_exit`): Behind config flags
- Custom tools: Loaded from `.opencode/{tool,tools}/*.{js,ts}`
- Plugin tools: Via `Plugin.list()` → `hook.tool`

---

## 6. Plugin System

**File**: `src/plugin/index.ts`, `src/plugin/codex.ts`

### Plugin Input

```typescript
PluginInput = {
  client: OpenCodeSDK,        // SDK client for API access
  project: ProjectInfo,
  worktree: string,
  directory: string,
  serverUrl: string,
  $: BunShell,                // Bun shell for commands
}
```

### Plugin Hook Names

| Hook | Purpose |
|------|---------|
| `experimental.chat.system.transform` | Modify system prompts |
| `chat.params` | Modify LLM call parameters |
| `chat.headers` | Add HTTP headers to LLM calls |
| `tool.definition` | Modify tool definitions |
| `permission.ask` | Custom permission handling |
| `event` | Event forwarding |
| `config` | Configuration injection |
| `shell.env` | Environment variables for bash tool |
| `experimental.text.complete` | Post-process text output |
| `experimental.session.compacting` | Customize compaction behavior |

### Plugin Sources

1. **Built-in npm**: `"opencode-anthropic-auth@0.0.13"` (Anthropic auth)
2. **Internal**: `CodexAuthPlugin`, `CopilotAuthPlugin`, `GitlabAuthPlugin`
3. **Config**: `plugin` array in opencode.json (npm packages or `file://` paths)
4. **Local**: `.opencode/{plugin,plugins}/*.{ts,js}`

### Codex Auth Plugin (`src/plugin/codex.ts`)

Implements full OpenAI Codex (ChatGPT Pro/Plus) authentication:
- **PKCE OAuth flow** with local callback server on port 1455
- **Headless device authorization** for non-browser environments
- Rewrites API URLs to `https://chatgpt.com/backend-api/codex/responses`
- JWT-based account ID extraction
- Token refresh management
- Model filtering to Codex-allowed set (gpt-5.x-codex variants)
- Zeroes out costs for Codex models (included with ChatGPT subscription)

### Plugin Lifecycle

```typescript
Plugin.init()      // Subscribes to Bus for event forwarding
Plugin.trigger(hookName, input, output)  // Fires hook across all loaded plugins
Plugin.list()      // Returns loaded plugin handles
```

Deduplication via Set to prevent double-initialization of same plugin.

---

## 7. Server Architecture

**File**: `src/server/server.ts`

### HTTP Server Stack

- **Framework**: Hono (with middleware: cors, streamSSE, proxy, basicAuth, websocket)
- **Runtime**: `Bun.serve()` on port 4096 (fallback to random port)
- **API**: OpenAPI spec generation via `hono-openapi`
- **Auth**: Optional basic auth via `OPENCODE_SERVER_PASSWORD`

### Route Structure

| Route | File | Purpose |
|-------|------|---------|
| `/global` | `routes/global.ts` | Global state/settings |
| `/project` | `routes/project.ts` | Project management |
| `/session` | `routes/session.ts` | Session CRUD + messaging |
| `/provider` | `routes/provider.ts` | Provider/model listing |
| `/config` | `routes/config.ts` | Configuration read/write |
| `/experimental` | `routes/experimental.ts` | Experimental features |
| `/permission` | `routes/permission.ts` | Permission management |
| `/question` | `routes/question.ts` | User question handling |
| `/mcp` | `routes/mcp.ts` | MCP server management |
| `/tui` | `routes/tui.ts` | TUI state management |
| `/pty` | `routes/pty.ts` | Pseudo-terminal |
| `/file` | `routes/file.ts` | File operations |

### Standalone Endpoints

```
PUT/DELETE  /auth/:providerID     — Provider auth management
GET         /agent                — Agent listing
GET         /skill                — Skill listing
GET         /lsp                  — LSP status
GET         /formatter            — Formatter config
GET         /vcs                  — Version control status
GET         /command              — Command listing
GET         /path                 — Path resolution
POST        /log                  — Client-side logging
POST        /instance/dispose     — Instance cleanup
GET         /event                — SSE event stream
GET         /doc                  — OpenAPI spec
```

### SSE Event Stream

```typescript
// GET /event
streamSSE(c, async (stream) => {
  // Heartbeat every 10 seconds
  // Forwards all Bus events to client
  Bus.subscribeAll((event) => stream.writeSSE({ data: JSON.stringify(event) }))
})
```

### Instance Scoping

Every request is scoped to an Instance via middleware:
- `x-opencode-directory` header, or
- `directory` query parameter

This sets up the Instance context (project, config, database) for the request.

### CORS Policy

Allows: `localhost:*`, `tauri://localhost`, `*.opencode.ai`, plus configurable whitelist in config.

### Proxy Fallback

Unmatched routes are proxied to `https://app.opencode.ai` (the web UI).

### Service Discovery

mDNS service publishing via `bonjour-service` (`MDNS.publish()`) for local network discovery.

---

## 8. Event Bus

**Files**: `src/bus/index.ts`, `src/bus/bus-event.ts`

### Event Definition

```typescript
// Define a typed event
const MyEvent = BusEvent.define("my.event", z.object({
  id: z.string(),
  value: z.number(),
}))
```

Events are registered in a global registry. Each event has a `type` string and a Zod schema for its properties.

### Bus API

```typescript
Bus.publish(eventDef, properties)              // Publish to type-specific + wildcard + GlobalBus
Bus.subscribe(eventDef, callback) → unsubscribe // Type-safe subscription
Bus.subscribeAll(callback) → unsubscribe        // Wildcard subscription
Bus.once(eventDef, callback)                    // Auto-unsubscribe after "done" return
```

### Instance Scoping

The Bus is Instance-scoped — each Instance has its own subscription map. On `Instance.dispose()`, a `Bus.InstanceDisposed` event fires and all subscriptions are cleaned up.

### GlobalBus

A separate `GlobalBus` exists for cross-Instance event forwarding (used by Worktree events and the SSE stream).

### Key Event Types

```
session.created, session.updated, session.deleted, session.diff, session.error
message.updated, message.removed
message.part.updated, message.part.delta, message.part.removed
session.compacted
worktree.ready, worktree.failed
```

`BusEvent.payloads()` generates a Zod discriminated union of all registered events (used for OpenAPI schema generation).

---

## 9. Snapshot/Git System

**File**: `src/snapshot/index.ts`

### Architecture

Uses a **separate git repository** at `~/.opencode/data/snapshot/<projectID>/` — not the project's own git repo. This allows file tracking even in non-git projects or without affecting the user's git state.

### Key Functions

```typescript
Snapshot.track()                                 // git add . && git write-tree → tree hash
Snapshot.patch(hash: string)                     // git diff --name-only → { hash, files[] }
Snapshot.restore(snapshot: string)               // git read-tree && git checkout-index -a -f
Snapshot.revert(patches: { hash, files }[])      // Per-file: git checkout <hash> -- <file>
Snapshot.diff(hash: string)                      // Single diff
Snapshot.diffFull(from: string, to: string)      // Full diff → FileDiff[]
```

### FileDiff Schema

```typescript
Snapshot.FileDiff = z.object({
  file: z.string(),
  before: z.string(),
  after: z.string(),
  additions: z.number(),
  deletions: z.number(),
  status: z.enum(["added", "deleted", "modified"]).optional(),
})
```

### Data Flow

```
Tool execution
    │
    ├─ StepStart: Snapshot.track() → tree hash stored in StepStartPart
    │
    ├─ (tool modifies files)
    │
    └─ StepFinish: Snapshot.track() → new tree hash
                   Snapshot.patch(oldHash) → PatchPart { hash, files[] }
```

### Maintenance

- Hourly GC via `Scheduler`: `git gc --prune=7.days`
- Syncs `.gitignore` exclude patterns from project's git
- Disabled for non-git projects, `cfg.snapshot === false`, or ACP client mode

---

## 10. MCP Protocol Integration

**File**: `src/mcp/index.ts`, `src/mcp/auth.ts`, `src/mcp/oauth-callback.ts`, `src/mcp/oauth-provider.ts`

### Architecture

OpenCode acts as an **MCP client only** — it connects to external MCP servers, does not expose an MCP server.

### Transport Types

| Type | Implementation | Use Case |
|------|---------------|----------|
| `local` | `StdioClientTransport` | Local process via stdin/stdout |
| `remote` | `StreamableHTTPClientTransport` (with SSE fallback) | Remote HTTP servers |

### MCP.tools() — Tool Integration

```typescript
MCP.tools(): Record<string, CoreTool>
// Converts MCP tool definitions to AI SDK Tool format
// Uses dynamicTool() + jsonSchema() for schema conversion
```

### OAuth Flow (Remote MCP)

Full PKCE OAuth implementation:
1. `MCP.startAuth()` — Initiates OAuth, opens browser
2. OAuth callback on local server
3. `MCP.authenticate()` — Exchanges code for tokens
4. Dynamic client registration support
5. Token refresh management

### Status States

```
"connected" | "disabled" | "failed" | "needs_auth" | "needs_client_registration"
```

### Key Functions

```typescript
MCP.tools()                    // All tools from all connected servers
MCP.prompts()                  // All prompts from all servers
MCP.resources()                // All resources from all servers
MCP.readResource(uri)          // Read a specific resource
MCP.getPrompt(name, args)      // Get a specific prompt
MCP.startAuth(serverName)      // Begin OAuth flow
MCP.authenticate(...)          // Complete OAuth flow
MCP.finishAuth(serverName)     // Finalize auth
```

Tool notification handling via `ToolListChangedNotificationSchema` (auto-refreshes tool list when server tools change).

---

## 11. LSP Integration

**Files**: `src/lsp/index.ts`, `src/lsp/server.ts`, `src/lsp/client.ts`

### LSP Operations

```typescript
LSP.diagnostics()                                  // Get all diagnostics across open files
LSP.hover(file, line, col)                         // Hover information
LSP.workspaceSymbol(query)                         // Workspace-wide symbol search
LSP.documentSymbol(file)                           // Document symbols
LSP.definition(file, line, col)                    // Go to definition
LSP.references(file, line, col)                    // Find all references
LSP.implementation(file, line, col)                // Find implementations
LSP.prepareCallHierarchy(file, line, col)          // Call hierarchy prep
LSP.incomingCalls(item)                            // Incoming call hierarchy
LSP.outgoingCalls(item)                            // Outgoing call hierarchy
LSP.touchFile(file, waitForDiagnostics?)           // Notify LSP of file change
```

### Built-in LSP Servers (28)

Each server definition includes: `id`, `extensions[]`, `root(file)` function (finds project root), `spawn(root)` function.

| Server | Languages | Auto-install |
|--------|-----------|-------------|
| `Typescript` | .ts, .tsx, .js, .jsx, .mjs, .cjs | via `typescript-language-server` |
| `Deno` | .ts, .tsx, .js, .jsx | requires `deno` |
| `Vue` | .vue | auto-downloads `@vue/language-server` |
| `ESLint` | .ts, .tsx, .js, .jsx, .vue | auto-builds from `vscode-eslint` GitHub |
| `Oxlint` | .ts, .tsx, .js, .jsx, .vue, .astro, .svelte | requires `oxlint` |
| `Biome` | .ts, .tsx, .js, .json, .css, .html, .graphql | via local or global |
| `Pyright` | .py, .pyi | auto-downloads via bun |
| `Ty` | .py, .pyi | experimental, requires `ty` |
| `Gopls` | .go | auto-installs via `go install` |
| `RustAnalyzer` | .rs | requires `rust-analyzer` |
| `Clangd` | .c, .cpp, .h, .hpp | auto-downloads from GitHub |
| `JDTLS` | .java | auto-downloads Eclipse JDT |
| `KotlinLS` | .kt, .kts | auto-downloads from JetBrains |
| `CSharp` | .cs | auto-installs via `dotnet tool` |
| `FSharp` | .fs, .fsi | auto-installs via `dotnet tool` |
| `SourceKit` | .swift | via Xcode toolchain |
| `Zls` | .zig, .zon | auto-downloads from GitHub |
| `ElixirLS` | .ex, .exs | auto-builds from GitHub |
| `Rubocop` | .rb, .rake | auto-installs via `gem` |
| `Svelte` | .svelte | auto-downloads |
| `Astro` | .astro | auto-downloads |
| `YamlLS` | .yaml, .yml | auto-downloads |
| `LuaLS` | .lua | auto-downloads from GitHub |
| `PHPIntelephense` | .php | auto-downloads |
| `Prisma` | .prisma | requires `prisma` CLI |
| `Dart` | .dart | requires `dart` |
| `Ocaml` | .ml, .mli | requires `ocamllsp` |
| `BashLS` | .sh, .bash, .zsh | auto-downloads |
| `TerraformLS` | .tf, .tfvars | auto-downloads from HashiCorp |
| `TexLab` | .tex, .bib | auto-downloads from GitHub |
| `Nixd` | .nix | requires `nixd` |
| `Tinymist` | .typ | auto-downloads from GitHub |
| `DockerfileLS` | Dockerfile | auto-downloads |
| `Gleam` | .gleam | requires `gleam` |
| `Clojure` | .clj, .cljs | requires `clojure-lsp` |

### Root Detection

Each LSP server has a `root(file)` function that walks up directories to find the project root:
- `NearestRoot(patterns[], excludePatterns?)` — Generic helper using `Filesystem.up()`
- Exclude patterns (e.g., Deno excludes `deno.json` directories from TypeScript LSP)
- Special cases: Rust walks up to find `[workspace]` in Cargo.toml, Kotlin checks settings.gradle → gradlew → build.gradle → pom.xml

### Client Management

- Auto-spawns LSP servers per file extension
- Caches clients per `(root, serverID)` pair
- Tracks broken servers to avoid re-spawning
- Custom LSP servers configurable via config (`command` + `extensions` + `env`)
- Instance-scoped with cleanup (shutdown all clients on dispose)
- Auto-install controlled by `OPENCODE_DISABLE_LSP_DOWNLOAD` flag

---

## 12. Permission System

**Files**: `src/permission/index.ts` (legacy), `src/permission/next.ts`

### Legacy Permission System (`Permission`)

```typescript
Permission.ask(input)           // Check approved patterns, fire plugin hook, create pending promise
Permission.respond(sessionID, permissionID, "once" | "always" | "reject")
```

- Session-scoped approval memory (wildcard pattern matching)
- `RejectedError` thrown on rejection

### New Permission System (`PermissionNext`)

```typescript
PermissionNext.Ruleset = Array<{
  permission: string,      // "bash", "edit", "task", "external_directory", "doom_loop", etc.
  pattern: string,         // Glob pattern
  action: "allow" | "deny" | "ask",
}>
```

#### Evaluation

```typescript
PermissionNext.evaluate(permission, pattern, ...rulesets): { action: "allow" | "deny" | "ask" }
// Last matching rule wins (rulesets merged in order)
```

#### Rule Resolution Order

```
Agent default rules → Agent-specific rules → User config rules → Session rules
```

#### Permission Flow

```
Tool invokes ctx.ask({ permission, patterns, always, metadata })
    │
    ▼
PermissionNext.evaluate(permission, pattern, rulesets)
    │
    ├─ "allow" → proceed immediately
    ├─ "deny"  → throw DeniedError
    └─ "ask"   → create pending promise, wait for user response
                       │
                       ▼
              PermissionNext.reply("once" | "always" | "reject")
                       │
                       ├─ "once"   → resolve, continue
                       ├─ "always" → persist to PermissionTable, resolve
                       └─ "reject" → throw RejectedError
                                     (or CorrectedError with feedback message)
```

#### Error Types

| Error | Behavior |
|-------|----------|
| `RejectedError` | User said no |
| `CorrectedError` | User said no with feedback message |
| `DeniedError` | Config rule explicitly denies (never prompted) |

#### Tool Permission Mapping

Edit-related tools are mapped to the `"edit"` permission: `write`, `edit`, `patch`, `multiedit`

#### Persistent Storage

"Always" approvals stored in `PermissionTable` per project in SQLite.

```typescript
PermissionNext.disabled(tools, ruleset): string[]
// Returns tool names that are fully denied by the ruleset
```

---

## 13. Configuration System

**File**: `src/config/config.ts`

### Precedence (low → high)

1. Remote `.well-known/opencode` config
2. Global config: `~/.config/opencode/opencode.json{,c}`
3. `OPENCODE_CONFIG` env var (file path)
4. Project config: `./opencode.json{,c}`
5. `.opencode/` directory configs
6. `OPENCODE_CONFIG_CONTENT` env var (inline JSON)
7. Managed enterprise config: `/Library/Application Support/opencode/` (macOS) or `/etc/opencode/` (Linux)

### Config.Info Schema (Key Fields)

```typescript
Config.Info = {
  // Display
  theme: string,
  keybinds: Record<string, string>,     // 80+ configurable keybinds
  tui: { ... },                         // TUI settings

  // Server
  server: { port?, password? },

  // AI
  model: { providerID, modelID },       // Default model
  small_model: { providerID, modelID }, // Utility model
  default_agent: string,                // Default agent name
  agent: Record<string, AgentConfig>,   // Agent overrides

  // Providers
  provider: Record<string, ProviderConfig>,
  disabled_providers: string[],
  enabled_providers: string[],

  // Tools & Plugins
  plugin: string[],                     // Plugin package names
  skills: string[],                     // Skill paths

  // Protocol
  mcp: Record<string, McpServerConfig>,
  lsp: Record<string, LspServerConfig>,
  formatter: Record<string, FormatterConfig>,

  // Instructions
  instructions: string[],              // File paths, globs, or URLs

  // Permissions
  permission: PermissionNext.Ruleset,

  // Features
  compaction: { auto?, prune?, reserved? },
  snapshot: boolean,
  share: ShareConfig,
  autoupdate: boolean,
  experimental: {
    output_token_max?: number,
    continue_loop_on_deny?: boolean,
    primary_tools?: string[],
    ... more flags
  },
}
```

### Dynamic Config Sources

Auto-loads from `.opencode/` directories:
- **Agents**: `.opencode/{agent,agents}/**/*.md` (markdown with YAML frontmatter)
- **Commands**: `.opencode/{command,commands}/**/*.md`
- **Plugins**: `.opencode/{plugin,plugins}/*.{ts,js}`
- **Modes**: `.opencode/{mode,modes}/*.md` (deprecated → migrated to agents)

### Value Interpolation

Supports `{env:VAR_NAME}` and `{file:path/to/file}` interpolation in config values.

### Key Functions

```typescript
Config.get()                    // Returns fully merged config
Config.updateGlobal(patch)      // Patches global JSONC config file
```

Auto-installs `@opencode-ai/plugin` dependency in `.opencode/` directories (watches for `package.json` presence).

---

## 14. Worktree System

**File**: `src/worktree/index.ts`

### Purpose

Git worktree management for isolated parallel development environments. Creates separate working copies linked to the same repository.

### Worktree.Info Schema

```typescript
Worktree.Info = z.object({
  name: z.string(),         // Random name like "brave-falcon"
  branch: z.string(),       // "opencode/<name>"
  directory: z.string(),    // ~/.opencode/data/worktree/<projectID>/<name>
})
```

### Key Functions

#### `Worktree.create(input?)`

```
1. Validate git project
2. Generate unique name (adjective-noun, e.g., "calm-rocket")
3. git worktree add --no-checkout -b opencode/<name> <directory>
4. Async: git reset --hard → Instance.provide(InstanceBootstrap) → run start scripts
5. Emit Worktree.Event.Ready or Worktree.Event.Failed
```

Name generation: 29 adjectives × 31 nouns, with collision detection (up to 26 attempts). If user provides a name, it's slugified.

#### `Worktree.remove(input)`

```
1. git worktree list --porcelain → find entry
2. git worktree remove --force
3. rm -rf directory
4. git branch -D opencode/<name>
```

#### `Worktree.reset(input)`

```
1. Find default branch: remote HEAD → main → master
2. git fetch <remote> <branch>
3. git reset --hard <target>
4. git clean -ffdx (with retry for failed removals)
5. git submodule update --init --recursive --force
6. Re-run start scripts
```

### Start Scripts

Two levels of startup commands:
1. **Project start command**: Stored in `ProjectTable`, runs first
2. **Worktree start command**: Per-worktree extra command, runs second

### Error Types

```
WorktreeNotGitError | WorktreeNameGenerationFailedError | WorktreeCreateFailedError |
WorktreeStartCommandFailedError | WorktreeRemoveFailedError | WorktreeResetFailedError
```

---

## 15. Key Dependencies

### Runtime & Framework

| Package | Version | Purpose |
|---------|---------|---------|
| **Bun** | (runtime) | JavaScript/TypeScript runtime, bundler, test runner |
| **hono** | catalog | HTTP framework (routes, middleware, SSE, WebSocket) |
| **hono-openapi** | catalog | OpenAPI schema generation |
| **solid-js** | catalog | Reactive UI framework (TUI) |
| **@opentui/core** + **@opentui/solid** | 0.1.79 | Terminal UI framework |
| **yargs** | 18.0.0 | CLI argument parsing |

### AI & LLM

| Package | Version | Purpose |
|---------|---------|---------|
| **ai** (Vercel AI SDK) | catalog | `streamText`, `generateObject`, `wrapLanguageModel`, model abstraction |
| **@ai-sdk/*** | various | 22 provider SDKs (see Provider section) |
| **@modelcontextprotocol/sdk** | 1.25.2 | MCP client implementation |

### Database & Storage

| Package | Version | Purpose |
|---------|---------|---------|
| **drizzle-orm** | 1.0.0-beta.12 | SQLite ORM |
| **drizzle-kit** | 1.0.0-beta.12 | Database migrations |

### Parsing & Analysis

| Package | Version | Purpose |
|---------|---------|---------|
| **web-tree-sitter** | 0.25.10 | Tree-sitter parser (bash command analysis) |
| **tree-sitter-bash** | 0.25.0 | Bash grammar for tree-sitter |
| **jsonc-parser** | 3.3.1 | JSONC config file parsing |
| **gray-matter** | 4.0.3 | Markdown frontmatter parsing |
| **@babel/core** | 7.28.4 | JavaScript AST (dev) |

### File & Process

| Package | Version | Purpose |
|---------|---------|---------|
| **chokidar** | 4.0.3 | File watching |
| **@parcel/watcher** | 2.5.1 | Native file watching (platform-specific) |
| **glob** | 13.0.5 | File globbing |
| **ignore** | 7.0.5 | .gitignore pattern matching |
| **bun-pty** | 0.4.8 | Pseudo-terminal for PTY routes |
| **diff** | catalog | Text diffing |

### Networking & Auth

| Package | Version | Purpose |
|---------|---------|---------|
| **bonjour-service** | 1.3.0 | mDNS service discovery |
| **@openauthjs/openauth** | catalog | OAuth implementation |
| **google-auth-library** | 10.5.0 | Google auth (Vertex AI) |
| **@aws-sdk/credential-providers** | 3.993.0 | AWS auth (Bedrock) |
| **@octokit/rest** + **@octokit/graphql** | catalog | GitHub API |

### Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| **zod** | catalog | Schema validation (pervasive) |
| **zod-to-json-schema** | 3.24.5 | JSON Schema generation |
| **remeda** | catalog | Utility functions |
| **decimal.js** | 10.5.0 | Precise cost calculations |
| **ulid** | catalog | Ordered unique IDs |
| **minimatch** | 10.0.3 | Glob pattern matching |
| **turndown** | 7.2.0 | HTML→Markdown conversion |
| **partial-json** | 0.1.7 | Streaming JSON parsing |
| **fuzzysort** | 3.1.0 | Fuzzy string matching |
| **strip-ansi** | 7.1.2 | ANSI escape removal |
| **@zip.js/zip.js** | 2.7.62 | Archive extraction |

### Workspace Packages

| Package | Purpose |
|---------|---------|
| `@opencode-ai/plugin` | Plugin interface types |
| `@opencode-ai/sdk` | Client SDK |
| `@opencode-ai/util` | Shared utilities (error, logging) |
| `@opencode-ai/script` | Build scripts |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI (yargs)                               │
│  run │ serve │ web │ generate │ auth │ agent │ mcp │ pr │ ...   │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────┐     ┌──────────────────┐
│   Instance       │────>│   Config          │
│   (project ctx)  │     │   (JSONC, multi-  │
│                  │     │    layer merge)    │
└──────┬───────────┘     └──────────────────┘
       │
       ├──────────────────────┐
       ▼                      ▼
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐
│   Session     │<───>│   Event Bus     │<───>│   Server (Hono)   │
│   (SQLite)    │     │   (pub/sub)     │     │   (HTTP/SSE/WS)   │
└──────┬───────┘     └────────────────┘     └──────────────────┘
       │                                              │
       ▼                                              ▼
┌──────────────────┐                        ┌──────────────────┐
│  SessionProcessor │                        │   Routes          │
│  (stream loop)    │                        │   12 route files  │
└──────┬───────────┘                        └──────────────────┘
       │
       ├─────────────┬──────────────┬────────────────┐
       ▼             ▼              ▼                ▼
┌──────────┐  ┌──────────┐  ┌───────────┐    ┌───────────┐
│  Agent    │  │ Provider  │  │   Tool     │    │  Plugin   │
│  System   │  │  System   │  │  Registry  │    │  System   │
│  (7+)     │  │  (22+SDK) │  │  (18+tools)│    │  (hooks)  │
└──────────┘  └──────────┘  └─────┬─────┘    └───────────┘
                                   │
              ┌────────────────────┼────────────────┐
              ▼                    ▼                ▼
       ┌───────────┐      ┌───────────┐    ┌───────────┐
       │ Snapshot   │      │   MCP      │    │   LSP      │
       │ (git-based)│      │  (client)  │    │  (28 langs)│
       └───────────┘      └───────────┘    └───────────┘
                                                   │
                                            ┌──────┴──────┐
                                            │  Permission  │
                                            │  (rulesets)  │
                                            └─────────────┘
```

---

## Cross-Cutting Patterns

### Instance State Pattern

Nearly every subsystem uses `Instance.state(() => initialState)` for lazy, Instance-scoped singleton initialization. This ensures cleanup on `Instance.dispose()`.

### Namespace Pattern

All modules use TypeScript `namespace` as a module organizer (e.g., `Session`, `Agent`, `Provider`, `Tool`, `Bus`). Not used for actual namespace scope — purely organizational.

### Zod Pervasive

Zod is used everywhere: API validation, config parsing, event schemas, message schemas, tool parameters, OpenAPI generation. The codebase uses both `zod` and `zod/v4` (`z.meta()` for OpenAPI ref annotation).

### fn() Wrapper

Many public functions use `const myFunc = fn(zodSchema, async (input) => ...)` which provides runtime input validation.

### Error Pattern

Custom errors via `NamedError.create(name, zodSchema)` — creates typed, serializable error objects with `.toObject()` and `.isInstance()` methods.

### Identifier System

`Identifier.ascending(prefix)` generates ULIDs (Universally Unique Lexicographically Sortable Identifiers) prefixed with entity type (e.g., `session_01HX...`, `message_01HX...`, `part_01HX...`).
