# ADR-031 — Observability: EventStream + Agent Tree UI

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP + v2                                      |
| References  | analiza-observability.md (UX-003: full transparency) |

### Context

Users need full transparency into what agents are doing (UX-003). An event-driven architecture (EventStream) serves as the single source of truth for all agent activity, with UI components subscribing to relevant events.

### Decision

**EventStream** as the observability backbone + **6 UI components** (3 MVP, 3 v2).

#### EventStream (Single Source of Truth)

All agent activity emits structured events with:
- Timestamp, event type, agent ID, parent agent ID (for tree building).
- Tool calls, model requests, token usage, errors.
- Parent-child links enable full tree reconstruction.

#### MVP UI Components (3)

| Component | Description |
|-----------|-------------|
| **Agent Tree** | Hierarchical view of running agents (who spawned whom, current status, token usage). Primary observability tool. |
| **Metrics Bar** | Real-time token count, cost, elapsed time, model in use. Always visible. |
| **Live Activity Indicator** | Shows what the current agent is doing (reading file X, calling model Y, executing bash Z). |

#### v2 UI Components (3)

| Component | Description |
|-----------|-------------|
| **Detail Panel** | Click any agent in tree → see full conversation, tool calls, token breakdown. |
| **Pre-tool Approval** | Inline approval UI with diff preview before destructive operations. |
| **Timeline/Waterfall** | Horizontal timeline showing agent execution, parallel branches, and dependencies. |

### Consequences

- **Positive:** Full transparency (UX-003 satisfied). EventStream enables any UI component without changing core logic. Agent Tree is the killer feature for understanding multi-agent orchestration.
- **Negative:** EventStream adds overhead (event emission per action). Acceptable — events are lightweight structs.
