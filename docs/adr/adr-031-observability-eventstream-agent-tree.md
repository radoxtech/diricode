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

**Prototype-first sequencing (clarification, 2026-03-28):**

- Observability starts with the **data/event layer first**, not with the full UI surface.
- MVP-1 priority is to make the runtime visibly alive through structured streaming of agent/tool/progress/error/checkpoint activity.
- Richer UI transparency remains important, but current delivery sequencing treats typed event emission and replayability as the foundation that must land before full polish.

#### EventStream (Single Source of Truth)

All agent activity emits structured events with:
- Timestamp, event type, agent ID, parent agent ID (for tree building).
- Tool calls, model requests, token usage, errors.
- Parent-child links enable full tree reconstruction.
- Checkpoint/resume markers and execution-state transitions are first-class event types for prototype reliability and recovery visibility.

#### MVP UI Components (3)

| Component | Description |
|-----------|-------------|
| **Agent Tree** | Hierarchical view of running agents (who spawned whom, current status, token usage). Primary observability tool. |
| **Metrics Bar** | Real-time token count, cost, elapsed time, model in use. Always visible. |
| **Live Activity Indicator** | Shows what the current agent is doing (reading file X, calling model Y, executing bash Z). |

For sequencing purposes, MVP observability is split into two layers:

1. **MVP-1 data layer:** typed EventStream, event persistence, replayability, tool/agent/error/checkpoint visibility.
2. **MVP-2/MVP-3 UI richness:** full Agent Tree polish, richer metrics surfaces, detail/timeline panels, approval UX.

#### v2 UI Components (3)

| Component | Description |
|-----------|-------------|
| **Detail Panel** | Click any agent in tree → see full conversation, tool calls, token breakdown. |
| **Pre-tool Approval** | Inline approval UI with diff preview before destructive operations. |
| **Timeline/Waterfall** | Horizontal timeline showing agent execution, parallel branches, and dependencies. |

### Consequences

- **Positive:** Full transparency (UX-003 satisfied). EventStream enables any UI component without changing core logic. Early evented visibility makes the prototype debuggable and trustworthy before the complete UI arrives.
- **Negative:** EventStream adds overhead (event emission per action). Acceptable — events are lightweight structs. Splitting data-layer observability from later UI richness increases planning complexity, but reduces product ambiguity.

### Addendum — Prototype-First Observability Clarification (2026-03-28)

The Metrics Bar and Agent Tree remain target MVP surfaces, but implementation order is clarified:

- **First priority:** streamed and persisted runtime events for tools, delegation, errors, token/cost usage, and checkpoints.
- **Second priority:** UI components that subscribe to this data with stable schemas.
- **Later priority:** richer approval/timeline/detail panels once the event backbone proves reliable.
