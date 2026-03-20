# Epic: Observability v2 — Detail Panel, Approval UI, Timeline (v2.1)

> Package: `@diricode/web` + `@diricode/core`
> Iteration: **v2.1**
> Issue IDs: **DC-OBS-007..DC-OBS-012**

## Summary

Extends MVP's 3 observability components (Agent Tree, Metrics Bar, Live Activity Indicator) with 3 deeper components: a Detail Panel for per-agent deep-dives, inline Pre-tool Approval UI gated by Autonomy level, and a Timeline/Waterfall Gantt chart for visualizing parallel agent execution.

Source: `analiza-observability.md` Section 4 (Group 2 — v2 Components), Section 5 (Integration with 4 Dimensions)
Ecosystem references: Jaeger (waterfall), Arize Phoenix (color-coded operations), LangSmith (evaluation sidebar), Langfuse (Session → Trace → Observation hierarchy)

## Architectural Baseline

- MVP EventStream backbone persists all events to SQLite with parent-child linking
- Event schema: `id`, `parent_id`, `session_id`, `turn_id`, `agent_id`, `agent_tier`, `type`, `status`, `start_time`, `end_time`, `model`, `tokens_in`, `tokens_out`, `cost`, `metadata`
- MVP Agent Tree renders expandable tree from `agent.*`, `tool.*`, `llm.*`, `delegate.*` events
- Verbose dimension controls detail level: Silent → Compact → Explain → Narrated
- Autonomy dimension controls which actions require approval

## Issues

### DC-OBS-007 — Detail Panel (right panel)

**Goal**: When user clicks an agent in the Agent Tree, display a right-side panel with full agent execution details.

**Scope**
- Panel sections:
  - Agent info: name, tier, model used, tags
  - Timing: start, end, wall time, LLM time vs tool time breakdown
  - Token usage: input tokens, output tokens, cache hit %, cost
  - Input: summarized prompt (what the agent received)
  - Output: summarized result (what the agent produced)
  - Tool calls: list of tools used with input/output summaries
  - Sub-agents: list of delegated agents with their results
- Verbose dimension controls detail:
  - Compact: summary only (no raw input/output)
  - Explain: summary + truncated input/output
  - Narrated: full raw prompts and responses (scrollable)
- Panel opens/closes on Agent Tree node click (toggle)
- Panel resizable (drag border)

**Acceptance criteria**
- [ ] Click on Agent Tree node opens Detail Panel on right side
- [ ] All 7 sections populated from EventStream data
- [ ] Verbose level controls how much detail is shown
- [ ] Panel toggle (click again to close)
- [ ] Panel resize via drag handle
- [ ] Narrated mode shows full raw prompts (scrollable, syntax-highlighted)
- [ ] Tool calls section shows input/output for each tool invocation

**References**
- `analiza-observability.md` Section 4.1 (Detail Panel specification)
- MVP `epic-observability.md` DC-OBS-001 (EventStream backbone)
- MVP `epic-web-ui.md` DC-WEB-004 (Agent Tree component)

---

### DC-OBS-008 — Pre-tool Approval inline UI

**Goal**: Render approval requests inline in the Agent Tree at the exact point where an agent is waiting, gated by Autonomy dimension.

**Scope**
- Approval UI appears as a special node in the Agent Tree:
  ```
  ▼ code-writer (running, 8.2s)
      ├── tool: file_write (completed, 0.3s)
      └── 🟡 APPROVE? git push origin main
          [Approve] [Reject] [Show diff]
  ```
- Buttons: Approve, Reject, Show diff/details
- Connection to Autonomy dimension:
  - Ask Everything: every action shows approval
  - Suggest: file writes + shell commands
  - Auto-Edit: shell commands + merges
  - Auto-Execute: merges only
  - Full Auto: no approval UI (auto-approved, audit log only)
- `approval.request` event triggers UI insertion
- `approval.response` event removes UI and resumes agent
- Keyboard shortcuts: `y` = approve, `n` = reject, `d` = show diff
- Timeout: configurable auto-reject after N seconds of no response

**Acceptance criteria**
- [ ] Approval UI renders inline in Agent Tree at correct position
- [ ] Approve button resumes agent execution
- [ ] Reject button cancels the pending action
- [ ] Show diff button expands details (for file writes: show diff; for commands: show full command)
- [ ] Autonomy level correctly gates which actions trigger approval
- [ ] Full Auto mode: no approval UI, events logged to audit trail
- [ ] Keyboard shortcuts work (`y`/`n`/`d`)
- [ ] Approval timeout configurable

**References**
- `analiza-observability.md` Section 4.2 (Pre-tool Approval specification)
- `analiza-lean-mode.md` Section 3 (Autonomy dimension — 5 levels with permission matrix)
- MVP `epic-safety.md` DC-SAFE-003 (approval workflow)

---

### DC-OBS-009 — Timeline / Waterfall Gantt chart

**Goal**: Render a Gantt-style timeline showing when each agent started and stopped, with parallel agents on separate lanes.

**Scope**
- Horizontal time axis, vertical agent lanes
- Each agent = one horizontal bar (start → end)
- Color coding:
  - Green: completed successfully
  - Blue: currently running (animated pulse)
  - Red: failed
  - Gray: pending / cancelled
  - Yellow: waiting for approval
- Zoom: mouse wheel / pinch to zoom time axis
- Pan: click-drag to scroll timeline
- Click on bar → opens Detail Panel for that agent (linked)
- Nested agents: indented under parent (like Agent Tree but horizontal)
- Live update: running bars extend in real-time
- Data source: `agent.start` and `agent.end` events with timestamps
- Rendering: SVG or Canvas (not DOM bars — for performance with many agents)

**Acceptance criteria**
- [ ] Timeline renders all agents from current turn
- [ ] Parallel agents displayed on separate lanes
- [ ] Color coding correctly reflects agent status
- [ ] Zoom and pan work smoothly
- [ ] Click on agent bar opens Detail Panel
- [ ] Running agents animate (bar extends live)
- [ ] Handles 30+ agents without performance degradation
- [ ] Nested sub-agents visually indented under parent

**References**
- `analiza-observability.md` Section 4.3 (Timeline/Waterfall specification)
- Jaeger UI: waterfall trace visualization pattern
- Arize Phoenix: color-coded operation types
- MVP `epic-observability.md` DC-OBS-001 (EventStream data model)

---

### DC-OBS-010 — Session replay

**Goal**: Allow users to step through completed sessions event-by-event, replaying the Agent Tree and Timeline as they unfolded.

**Scope**
- Replay mode: select a past session → reconstruct EventStream from SQLite
- Playback controls: play, pause, step forward, step backward, speed (1x, 2x, 5x, 10x)
- Timeline scrubber: drag to any point in time → Agent Tree updates to that moment
- Same components render as live (Agent Tree, Metrics Bar, Detail Panel, Timeline)
- Useful for: debugging agent behavior, understanding cost breakdown, post-mortem analysis
- No network calls during replay — purely from persisted events

**Acceptance criteria**
- [ ] Past session selectable from session list
- [ ] Playback controls work (play/pause/step/speed)
- [ ] Timeline scrubber jumps to any point
- [ ] Agent Tree reflects state at scrubbed time
- [ ] Metrics Bar shows cumulative totals up to scrubbed time
- [ ] Works with Detail Panel (click agent at scrubbed time → see that agent's data)
- [ ] No network calls during replay

**References**
- `analiza-observability.md` Section 6 (EventStream Architecture — read path for history/replay)
- MVP `epic-memory.md` DC-MEM-003 (session history in SQLite)

---

### DC-OBS-011 — JSONL transcript export

**Goal**: Export a session's EventStream as a JSONL file for external analysis, interoperability, and archiving.

**Scope**
- Export format: one JSON object per line (JSONL), one line per event
- CLI: `diricode export <session-id> --format jsonl --output <path>`
- Web UI: "Export" button on session detail page
- Fields: all EventStream fields (id, parent_id, agent_id, type, status, timestamps, tokens, cost, metadata)
- Optionally include full prompts/responses (flag: `--include-raw`)
- Compression: optional gzip (`--gzip`)
- Interop: format inspired by Claude Code / OMO transcript export

**Acceptance criteria**
- [ ] CLI command exports session to JSONL file
- [ ] Each line is valid JSON matching EventStream schema
- [ ] `--include-raw` flag includes full prompts and responses
- [ ] `--gzip` flag produces compressed output
- [ ] Web UI export button triggers download
- [ ] Exported file parseable by standard JSONL tools (jq, etc.)

**References**
- `analiza-observability.md` Section 7 (v2 scope — JSONL transcript export)
- Claude Code: JSONL transcript format (ecosystem reference)

---

### DC-OBS-012 — Observability integration with work mode dimensions

**Goal**: Ensure all v2 observability components respond correctly to the 4-dimension work mode system.

**Scope**
- Detail Panel:
  - Compact: summary only
  - Explain: summary + truncated I/O
  - Narrated: full raw prompts
- Pre-tool Approval:
  - Controlled by Autonomy dimension (see DC-OBS-008)
  - Quality level affects which hooks generate approval events
- Timeline:
  - Quality level affects number of agent lanes (Cheap: 3-5, Super: 20-30)
  - Verbose level affects whether Timeline is shown at all (Hidden at Silent)
- Session Replay:
  - Verbose level controls replay granularity (Silent: agents only, Narrated: every event)
- All components respect user's current dimension settings in real-time (changing Verbose mid-session updates all components)

**Acceptance criteria**
- [ ] Detail Panel content adapts to Verbose level
- [ ] Pre-tool Approval gates adapt to Autonomy level
- [ ] Timeline agent count reflects Quality level's agent pool
- [ ] Silent Verbose hides Timeline and Agent Tree
- [ ] Changing a dimension mid-session updates all components immediately
- [ ] Session Replay respects Verbose level for replay granularity

**References**
- `analiza-observability.md` Section 5 (Integration with 4 Dimensions)
- `analiza-lean-mode.md` Section 2-5 (all 4 dimensions)
- ADR-011 (4-dimension work mode system)
