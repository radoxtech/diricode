# DiriCode — Observability Analysis (TASK-013)

Date: 2026-03-10
Status: FINAL — all decisions confirmed by user
Language: English (per project convention for technical docs)

---

## 1. Overview

DiriCode provides real-time visibility into orchestrator and agent activity. Users always know what's happening — which agent is working, what it's doing, what it costs, and how long it takes.

Observability features are split into two release groups:

| Group | Release | Components |
|-------|---------|------------|
| **Group 1** | **MVP** | Agent Tree, Metrics Bar, Live Activity Indicator |
| **Group 2** | **v2** | Detail Panel, Pre-tool Approval, Timeline/Waterfall |

A full observability re-analysis with web research is planned for **v3**.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data backbone | **EventStream** (single source of truth) | Proven pattern in OpenHands, Codex. All agents emit events to one stream. |
| MVP scope | **3 components** (Agent Tree + Metrics Bar + Live Activity) | Covers UX-003 transparency requirement without heavy UI investment |
| v2 scope | **3 components** (Detail Panel + Pre-tool Approval + Waterfall) | Adds depth (per-agent details) and advanced visualization |
| v3 scope | **Full re-analysis** with fresh web research | Observability tools evolve fast — reassess landscape before v3 build |
| Event format | **Structured events with parent-child links** | Enables tree rendering and span nesting |
| Integration with Verbose dimension | **Verbose level controls how much observability is shown** | Silent = minimal, Narrated = everything |

---

## 2. Data Model

### Core Hierarchy

```
Session (conversation)
  └── Turn (one user prompt + full AI response)
        └── Agent Span (which agent worked)
              ├── LLM Generation (model call: model, tokens, cost, time)
              ├── Tool Call (tool name, input summary, output summary, time)
              ├── Sub-Agent Span (delegation to another agent — recursive)
              └── Human Input (approval request, when Autonomy requires it)
```

### Event Schema

Every event in the EventStream has this shape:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique event ID (UUID or ULID) |
| `parent_id` | string \| null | Parent event ID (null for top-level Turn) |
| `session_id` | string | Session this event belongs to |
| `turn_id` | string | Turn this event belongs to |
| `agent_id` | string | Which agent emitted this event (e.g., "code-writer", "dispatcher") |
| `agent_tier` | "HEAVY" \| "MEDIUM" \| "LOW" | Agent's tier from roster |
| `type` | enum | Event type (see below) |
| `status` | "pending" \| "running" \| "completed" \| "failed" \| "cancelled" | Current status |
| `start_time` | timestamp | When this event started |
| `end_time` | timestamp \| null | When this event ended (null if still running) |
| `model` | string \| null | Model used (for LLM Generation events) |
| `tokens_in` | number \| null | Input tokens (for LLM Generation events) |
| `tokens_out` | number \| null | Output tokens (for LLM Generation events) |
| `cost` | number \| null | Cost in USD (for LLM Generation events) |
| `metadata` | object | Type-specific data (tool name, input/output summaries, etc.) |

### Event Types

| Type | Description | Emitted by |
|------|-------------|------------|
| `turn.start` | User sent a prompt | System |
| `turn.end` | Full response delivered | System |
| `agent.start` | Agent began working | Dispatcher / parent agent |
| `agent.end` | Agent finished | Agent itself |
| `llm.start` | LLM call initiated | Agent |
| `llm.stream` | Streaming token chunk (optional, for Explain/Narrated) | Agent |
| `llm.end` | LLM call completed | Agent |
| `tool.start` | Tool invocation started | Agent |
| `tool.end` | Tool invocation completed | Agent |
| `delegate.start` | Sub-agent delegation started | Parent agent |
| `delegate.end` | Sub-agent delegation completed | Parent agent |
| `approval.request` | Waiting for human approval | Agent (per Autonomy level) |
| `approval.response` | Human approved/rejected | System |
| `error` | Something failed | Any |

### Ecosystem References

| Framework | Pattern We Adopted | Key Insight |
|-----------|-------------------|-------------|
| **OpenHands** | EventStream as single source of truth | All components read from one stream — no scattered state |
| **Codex** | TurnStarted / TurnCompleted lifecycle | Clear turn boundaries for metrics aggregation |
| **OMO** | Parent-child session tracking | Enables recursive agent tree rendering |
| **Claude Code** | agent_id + agent_type on every hook event | Every event is attributable to a specific agent |
| **Plandex** | SSE with typed message categories | Reply/BuildInfo/Describing/Error/Finished — clean type discrimination |

---

## 3. Group 1 — MVP Components

### 3.1 Agent Tree (left panel)

**What**: Expandable tree showing which agents are working, their status, model, and elapsed time. This is the primary transparency tool — directly satisfies UX-003.

**Structure**:
```
▼ dispatcher (running, 12.3s)
  ▼ planner-thorough (completed, 3.1s, claude-sonnet)
  ▼ code-writer (running, 8.2s, claude-sonnet)
    ├── tool: file_read (completed, 0.1s)
    ├── llm: generate (completed, 4.8s, 1.2k tokens)
    ├── tool: file_write (completed, 0.3s)
    └── llm: generate (running, 3.0s...)
  ○ code-reviewer-quick (pending)
```

**Status Icons**:
| Icon | Status | Meaning |
|------|--------|---------|
| ▼ | running | Agent is actively working (expandable) |
| ✓ | completed | Agent finished successfully |
| ✗ | failed | Agent failed |
| ○ | pending | Agent queued but not started |
| ⊘ | cancelled | Agent was cancelled |

**Data source**: EventStream filtered for `agent.start`, `agent.end`, `tool.start`, `tool.end`, `llm.start`, `llm.end` events.

**Interaction with Verbose dimension**:
| Verbose Level | Agent Tree Behavior |
|---------------|-------------------|
| Silent | Hidden entirely |
| Compact | Show agents only (collapsed), no tool/llm details |
| Explain | Show agents + tools + LLM calls (expanded) |
| Narrated | Show everything + token counts + raw prompts on click |

### 3.2 Metrics Bar (bottom)

**What**: Persistent bar at the bottom of the UI showing aggregate metrics for the current turn.

**Layout**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Agents: 3/5 done │ Tokens: 4.2k in / 1.8k out │ Cost: $0.03 │ 12.3s │
└──────────────────────────────────────────────────────────────────────┘
```

**Fields**:
| Field | Source | Update Frequency |
|-------|--------|-----------------|
| Agents done | Count of `agent.end` / count of `agent.start` events | On each agent.start / agent.end |
| Tokens in | Sum of `tokens_in` from all `llm.end` events in turn | On each llm.end |
| Tokens out | Sum of `tokens_out` from all `llm.end` events in turn | On each llm.end |
| Cost | Sum of `cost` from all `llm.end` events in turn | On each llm.end |
| Elapsed | Wall clock since `turn.start` | Every second (timer) |

**Interaction with Verbose dimension**:
| Verbose Level | Metrics Bar Behavior |
|---------------|---------------------|
| Silent | Show elapsed time only |
| Compact | Show agents done + elapsed time |
| Explain | Show all fields |
| Narrated | Show all fields + per-model breakdown tooltip |

### 3.3 Live Activity Indicator (top bar)

**What**: Single line at the top showing what's happening RIGHT NOW. Updates in real-time as agents start/stop.

**Examples**:
```
🔵 code-writer is generating code (claude-sonnet, 3.2s)
🔵 debugger is reading test output (0.4s)
🟡 Waiting for approval: git push to main
🟢 Done — 3 agents, $0.04, 15.2s
```

**State Machine**:
| State | Trigger | Display |
|-------|---------|---------|
| Working | Any agent has status=running | Agent name + action + model + elapsed |
| Delegating | delegate.start with no running leaf agent | "Delegating to {agent}..." |
| Waiting | approval.request | "Waiting for approval: {action}" |
| Done | turn.end | "Done — {summary}" |
| Error | error event | "Error in {agent}: {message}" |

**When multiple agents run in parallel**: Show the most recently started agent. If user wants to see all — they look at the Agent Tree.

**Interaction with Verbose dimension**:
| Verbose Level | Live Indicator Behavior |
|---------------|----------------------|
| Silent | Hidden |
| Compact | Agent name + status only |
| Explain | Agent name + action + model + elapsed |
| Narrated | Same as Explain (all detail is in Agent Tree) |

---

## 4. Group 2 — v2 Components

### 4.1 Detail Panel (right panel)

**What**: When user clicks an agent in the Agent Tree, shows full details: model, tokens, cost, input/output, tool calls, timing breakdown.

**Content**:
| Section | Data |
|---------|------|
| Agent info | Name, tier, model used, tags |
| Timing | Start, end, wall time, LLM time vs tool time |
| Token usage | Input tokens, output tokens, cache hit %, cost |
| Input | Summarized prompt (what the agent received) |
| Output | Summarized result (what the agent produced) |
| Tool calls | List of tools used with input/output |
| Sub-agents | List of delegated agents with their results |

**Interaction with Verbose dimension**:
- Compact: Summary only (no raw input/output)
- Explain: Summary + truncated input/output
- Narrated: Full raw prompts and responses

### 4.2 Pre-tool Approval (inline in Agent Tree)

**What**: When Autonomy level requires approval for an action, the approval UI appears inline in the Agent Tree at the exact point where the agent is waiting.

**Example**:
```
▼ code-writer (running, 8.2s)
    ├── tool: file_write (completed, 0.3s)
    └── 🟡 APPROVE? git push origin main
        [Approve] [Reject] [Show diff]
```

**Connection to Autonomy dimension**: This component only appears when the Autonomy level requires asking. At Auto-Execute and Full Auto, these events are auto-approved (logged but not shown as blocking).

| Autonomy Level | Approval Behavior |
|----------------|------------------|
| Ask Everything | Approve every action |
| Suggest | Approve file writes + shell commands |
| Auto-Edit | Approve shell commands + merges |
| Auto-Execute | Approve merges only |
| Full Auto | No approval UI (all auto-approved, audit log only) |

### 4.3 Timeline / Waterfall (top panel)

**What**: Gantt-style chart showing when each agent started and stopped, with parallel agents shown on separate lanes. Inspired by Jaeger/Arize Phoenix waterfall views.

**Example** (ASCII approximation):
```
Time:    0s     2s     4s     6s     8s    10s    12s
         ├──────┼──────┼──────┼──────┼──────┼──────┤
dispatch ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██
planner  ░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
writer   ░░░░░░░░░░░████████████████████░░░░░░░░░░░░
reviewer ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██████░░░░░░
```

**Data source**: `agent.start` and `agent.end` events with timestamps. Each agent = one lane.

**Color coding**:
| Color | Meaning |
|-------|---------|
| Green | Completed successfully |
| Blue | Currently running |
| Red | Failed |
| Gray | Pending / cancelled |
| Yellow | Waiting for approval |

**Why v2**: Requires non-trivial UI work (canvas or SVG rendering, zoom, pan). Agent Tree covers the basic transparency need for MVP.

---

## 5. Integration with 4 Dimensions

### Quality Dimension

Quality level determines how many agents appear in the observability views:

| Quality | Expected Agent Count | Tree Depth |
|---------|---------------------|------------|
| Cheap | 3-5 agents | 1-2 levels |
| POC | 5-7 agents | 1-2 levels |
| Standard | 8-12 agents | 2-3 levels |
| Production | 15-20 agents | 3-4 levels |
| Super | 20-30 agents | 3-5 levels |

Higher Quality = more agents = more observability data = Agent Tree becomes more valuable.

### Autonomy Dimension

Autonomy level controls when Pre-tool Approval appears (see Section 4.2). Also affects what events are logged:

| Autonomy | Events Generated |
|----------|-----------------|
| Ask Everything | approval.request for every action |
| Suggest | approval.request for file writes + shell |
| Auto-Edit | approval.request for shell + merge |
| Auto-Execute | approval.request for merge only |
| Full Auto | No approval.request events (actions are auto-logged) |

### Verbose Dimension

Verbose is the PRIMARY control for observability detail level. See Sections 3.1-3.3 for per-component behavior.

Summary:
| Verbose | Agent Tree | Metrics Bar | Live Indicator |
|---------|-----------|-------------|----------------|
| Silent | Hidden | Time only | Hidden |
| Compact | Agents collapsed | Agents + time | Name + status |
| Explain | Full expanded | All fields | Full detail |
| Narrated | + tokens + prompts | + per-model breakdown | Same as Explain |

### Creativity Dimension

Creativity affects what kinds of agent spans appear — Research and Creative levels trigger web-researcher and creative-thinker agents, which generate additional events visible in the tree.

---

## 6. EventStream Architecture

### Write Path

```
Agent → emit(event) → EventStream (in-memory) → persist to SQLite
```

Every agent has access to an `emit()` function that writes to the EventStream. Events are:
1. Appended to in-memory buffer (for real-time UI)
2. Persisted to SQLite (for history, session replay)

### Read Path — Real-time UI

```
EventStream → subscribe(filter) → UI Component
```

Each UI component subscribes to the EventStream with a filter:
- Agent Tree: `agent.*`, `tool.*`, `llm.*`, `delegate.*`
- Metrics Bar: `llm.end`, `agent.start`, `agent.end`
- Live Indicator: `agent.start`, `agent.end`, `approval.*`, `turn.end`, `error`

### Read Path — History / Replay

```
SQLite → query(session_id, turn_id) → reconstruct EventStream → UI
```

Users can browse historical sessions and see the Agent Tree for past turns. This satisfies UX-003: "must be able to browse conversation and history."

### Ecosystem References

| Framework | What They Do | What We Take |
|-----------|-------------|--------------|
| OpenHands | EventStream as sole state container | Pattern: all state changes are events |
| Langfuse | Session → Trace → Observation hierarchy | Hierarchy: Session → Turn → Span |
| LangSmith | Waterfall timeline + evaluation sidebar | Inspiration for v2 Timeline |
| Arize Phoenix | Color-coded operation types in waterfall | Color coding for agent status |
| OpenTelemetry | Span {traceId, spanId, parent, kind, attributes} | Event schema fields |
| Jaeger | Gantt-style waterfall with service dependency | Timeline visualization pattern |
| Turborepo | Multi-line terminal progress with per-task status | Status icon system for Agent Tree |

---

## 7. MVP Scope Summary

### In MVP

- EventStream backbone (in-memory + SQLite persistence)
- Event schema with parent-child linking
- Agent Tree (left panel) — expandable, status icons, respects Verbose
- Metrics Bar (bottom) — agents done, tokens, cost, time
- Live Activity Indicator (top bar) — current agent + action
- Verbose dimension controls observability detail level
- Session history browsing (reconstruct tree from SQLite)

### In v2

- Detail Panel (right panel) — per-agent deep dive
- Pre-tool Approval (inline) — Autonomy-gated approval UI
- Timeline/Waterfall (top panel) — Gantt chart of agent work
- Session replay (step through events chronologically)
- Export: JSONL transcript export (like OMO/Claude Code)

### In v3

- Full re-analysis with web research (new observability tools, new patterns)
- Cost analytics dashboard (per-session, per-agent, per-model trends)
- Performance profiling (identify slow agents, bottleneck detection)
- Comparison view (compare two sessions side-by-side)
- Custom dashboards (user-defined metric views)

---

## 8. Open Questions (for future sessions)

1. **JSONL transcript format**: Should DiriCode emit Claude Code-compatible JSONL transcripts for interop? (v2 consideration)
2. **WebSocket vs SSE**: For streaming events to web UI — SSE is simpler, WebSocket is more flexible. TBD at implementation time.
3. **Event retention policy**: How long to keep events in SQLite? Per-session? Last N sessions? Configurable? (v2)
4. **Cost estimation accuracy**: Real-time cost depends on knowing exact model pricing. How to keep pricing data updated? (v2)
5. **Multi-session view**: When user has multiple DiriCode sessions running — unified dashboard? (v3)

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-03-10 | Initial analysis: EventStream + 3 MVP components + 3 v2 components. Research from OMO, OpenHands, Plandex, Codex, Claude Code, Langfuse, LangSmith, Phoenix, OTel, Jaeger, Turborepo. |
