# Epic: Observability v3 — Cost Analytics, Profiling & Comparison (v3.0)

> Package: `@diricode/web` + `@diricode/server` + `@diricode/core`
> Iteration: **v3.0**
> Issue IDs: **DC-OBS-013..DC-OBS-017**

## Summary

Third generation of observability features. While MVP delivered real-time transparency (Agent Tree, Metrics Bar, Live Indicator) and v2 added depth (Detail Panel, Approval UI, Timeline/Waterfall), v3 focuses on **analytics and insights** — understanding costs over time, identifying performance bottlenecks, comparing sessions side-by-side, and building custom dashboards.

The `analiza-observability.md` Section 7 lists v3 scope as: "Full re-analysis with web research (new observability tools, new patterns), cost analytics dashboard (per-session, per-agent, per-model trends), performance profiling (identify slow agents, bottleneck detection), comparison view (compare two sessions side-by-side), custom dashboards (user-defined metric views)." Open question 5 from that analysis adds: "Multi-session view: when user has multiple DiriCode sessions running — unified dashboard?"

Source: `analiza-observability.md` Section 7 (v3 scope) + Open Question 5
Ecosystem references: Langfuse (cost analytics + session comparison), LangSmith (evaluation + regression), Arize Phoenix (performance profiling), OpenTelemetry (trace analysis)

## Architectural Baseline

- MVP: EventStream backbone persists all events to SQLite (Session → Turn → Agent Span → LLM/Tool events)
- MVP: Event schema includes `tokens_in`, `tokens_out`, `cost`, `model`, `start_time`, `end_time` per event
- v2: Detail Panel provides per-agent deep-dives; Timeline/Waterfall shows Gantt chart
- v2: Session replay reconstructs EventStream from SQLite for historical browsing
- v2: JSONL transcript export enables external analysis tools
- All EventStream data is already persisted — v3 adds **aggregate queries and visualization** on top

## Issues

### DC-OBS-013 — Cost analytics dashboard

**Goal**: Provide a dashboard view showing token and cost analytics across sessions, agents, and models — enabling users to understand and optimize their spending patterns.

**Scope**
- Dashboard views:
  - **Per-session cost breakdown**: total cost, token count, duration for each session
  - **Per-agent cost breakdown**: which agents consume the most tokens/money (aggregated)
  - **Per-model cost breakdown**: spending by model (e.g., claude-opus vs claude-sonnet vs copilot)
  - **Time-series trends**: cost over time (daily/weekly/monthly) with moving averages
  - **Cost per task type**: planning tasks vs coding tasks vs review tasks
- Data source: aggregate queries on existing EventStream SQLite tables (`llm.end` events with `cost`, `model`, `tokens_in`, `tokens_out`)
- Filters: date range, project, agent, model, tier (HEAVY/MEDIUM/LOW)
- Export: CSV download of cost data
- Pricing data management:
  - Model pricing table in config (per-model cost-per-1k-tokens)
  - Fallback: use cost values from `llm.end` events (provider may supply cost directly)
  - Open question from analysis: "How to keep pricing data updated?" — use configurable pricing table, updatable via config or marketplace

**Acceptance criteria**
- [ ] Cost dashboard accessible from web UI navigation
- [ ] Per-session breakdown shows total cost, tokens, duration
- [ ] Per-agent aggregation shows which agents cost the most
- [ ] Per-model chart shows spending distribution across models
- [ ] Time-series chart with date range filter (day/week/month granularity)
- [ ] CSV export of visible cost data
- [ ] Pricing table in config for per-model cost calculation
- [ ] Dashboard respects Verbose dimension (Compact = summary only, Explain = full charts)

**References**
- `analiza-observability.md` Section 7 (v3 scope: "Cost analytics dashboard — per-session, per-agent, per-model trends")
- `analiza-observability.md` Open Question 4 (pricing accuracy)
- Wishlist 4.2: "Real-time token counter visible to user" — v3 extends this to historical analytics
- Langfuse: cost tracking and analytics patterns

---

### DC-OBS-014 — Performance profiling

**Goal**: Identify performance bottlenecks in agent execution — which agents are slow, where time is spent (LLM calls vs tool execution), and what patterns indicate degraded performance.

**Scope**
- Profiling views:
  - **Agent execution time ranking**: agents sorted by total wall time (across sessions)
  - **LLM vs tool time ratio**: for each agent, how much time is LLM generation vs tool calls
  - **Latency percentiles**: p50, p95, p99 for LLM calls (per model, per agent)
  - **Bottleneck detection**: highlight agents that took >2x their expected time (compared to historical average)
  - **Queue time analysis**: time agents spend waiting (pending state) vs actively working (running state)
  - **Tool performance**: slowest tools ranked by average execution time
- Data source: EventStream events with `start_time`/`end_time` for agents, LLM calls, and tool calls
- Comparison mode: compare current session's performance against historical averages
- Alerts: configurable threshold warnings (e.g., "agent X took 3x longer than usual")

**Acceptance criteria**
- [ ] Performance profiling page accessible from web UI
- [ ] Agent execution time ranking with sortable columns
- [ ] LLM vs tool time breakdown per agent (stacked bar chart)
- [ ] Latency percentiles computed for LLM calls (p50/p95/p99)
- [ ] Bottleneck detection highlights anomalously slow agents
- [ ] Queue time (pending → running transition) tracked and displayed
- [ ] Tool performance ranking shows slowest tools
- [ ] Historical comparison: current session vs average of last N sessions

**References**
- `analiza-observability.md` Section 7 (v3 scope: "Performance profiling — identify slow agents, bottleneck detection")
- `analiza-observability.md` Section 2 (Event Schema — `start_time`, `end_time`, `status` fields)
- Arize Phoenix: performance profiling patterns
- OpenTelemetry: span duration analysis

---

### DC-OBS-015 — Session comparison view

**Goal**: Compare two sessions side-by-side to understand differences in agent behavior, cost, duration, and outcomes — enabling regression detection and workflow optimization.

**Scope**
- Comparison UI:
  - **Side-by-side layout**: two sessions displayed in parallel columns
  - **Metric diff table**: cost, tokens, duration, agent count, tool call count — with delta (↑↓) indicators
  - **Agent timeline comparison**: two Waterfall views aligned on same time axis
  - **Agent tree diff**: highlight agents present in one session but not the other
  - **Model usage diff**: compare which models were used and how much
- Session selection: pick any two sessions from history (by ID, date, or search)
- Use cases:
  - "Why did this task cost $2.50 today but $0.30 yesterday?"
  - "Did the new agent configuration improve performance?"
  - "What's different about the session that failed vs the one that succeeded?"
- Data source: same EventStream SQLite queries, run for both sessions

**Acceptance criteria**
- [ ] Session picker allows selecting two sessions for comparison
- [ ] Side-by-side layout renders both sessions in parallel columns
- [ ] Metric diff table shows cost/tokens/duration/agent-count with delta values
- [ ] Agent timeline comparison aligns both Waterfall charts on same time axis
- [ ] Agent tree diff highlights agents unique to each session (visual emphasis)
- [ ] Model usage comparison shows distribution chart for each session side by side
- [ ] Deep-link: URL includes both session IDs (shareable comparison link)

**References**
- `analiza-observability.md` Section 7 (v3 scope: "Comparison view — compare two sessions side-by-side")
- v2 `epic-observability-v2.md` DC-OBS-011 (Timeline/Waterfall — reused in comparison view)
- LangSmith: evaluation comparison patterns

---

### DC-OBS-016 — Custom dashboards

**Goal**: Allow users to define their own metric dashboards by selecting which observability widgets to display, their layout, and filter configurations — personalizing the analytics experience.

**Scope**
- Dashboard builder:
  - Available widgets: cost chart, token chart, agent ranking, model breakdown, latency percentiles, tool performance, session timeline
  - Layout: drag-and-drop grid layout (2-4 columns)
  - Per-widget filters: date range, project, agent, model
  - Preset templates: "Cost Overview", "Performance Analysis", "Agent Activity" (user can clone and customize)
- Dashboard persistence: saved to user config or SQLite (survives sessions)
- Dashboard sharing: export dashboard config as JSON (importable by others)
- Default dashboard: ships with a sensible default layout (cost overview + recent sessions + top agents)

**Acceptance criteria**
- [ ] Dashboard builder UI with widget catalog
- [ ] Drag-and-drop layout supports 2-4 column grid
- [ ] At least 7 widget types available (cost, tokens, agent ranking, model breakdown, latency, tool perf, timeline)
- [ ] Per-widget filter controls (date range, project, agent, model)
- [ ] 3 preset templates: "Cost Overview", "Performance Analysis", "Agent Activity"
- [ ] Dashboard config persisted to user config / SQLite
- [ ] Export/import dashboard config as JSON
- [ ] Default dashboard auto-created on first visit

**References**
- `analiza-observability.md` Section 7 (v3 scope: "Custom dashboards — user-defined metric views")
- Grafana: dashboard builder pattern (widget catalog + drag-and-drop grid)
- Langfuse: customizable dashboard layouts

---

### DC-OBS-017 — Multi-session unified view

**Goal**: When a user has multiple DiriCode sessions running (or recently completed), provide a unified view showing all sessions' status, cost, and activity — avoiding the need to switch between sessions to understand overall workload.

**Scope**
- Unified session list:
  - Active sessions: currently running sessions with real-time status (agents active, current cost, elapsed time)
  - Recent sessions: last N completed sessions with final metrics
  - Per-session mini summary: project name, status (active/completed/failed), total cost, total tokens, duration, agent count
- Aggregate metrics across sessions:
  - Total cost today / this week / this month
  - Total tokens consumed
  - Sessions by status (active / completed / failed)
- Live updates: active sessions update in real-time via SSE
- Session navigation: click any session → navigate to its full observability view

**Acceptance criteria**
- [ ] Multi-session view accessible from web UI navigation (home/dashboard)
- [ ] Active sessions shown with real-time status updates via SSE
- [ ] Recent sessions listed with final metrics (cost, tokens, duration)
- [ ] Per-session mini summary card with project name, status, cost, tokens, duration, agent count
- [ ] Aggregate metrics bar: total cost (today/week/month), total tokens, session counts by status
- [ ] Click session card → navigates to session's full observability view
- [ ] Auto-refresh for active sessions (no manual reload needed)

**References**
- `analiza-observability.md` Open Question 5: "Multi-session view — when user has multiple DiriCode sessions running — unified dashboard?"
- v2 `epic-observability-v2.md` DC-OBS-012 (Session replay — building block for session navigation)
- Turborepo: multi-task progress dashboard pattern
