# Epic: Web UI MVP (Primary Interface)

> **Package**: `@diricode/web`
> **Iteration**: MVP-3
> **Issue IDs**: DC-WEB-001 — DC-WEB-007
> **Dependencies**: DC-SRV SSE/API, DC-OBS-001..006, core pipeline runtime

## Summary
This epic delivers the MVP primary interface using Vite + React + shadcn/ui, optimized for:
- **UX-001**: zero learning curve
- real-time execution transparency via EventStream
- smooth approval and session workflows
- practical control over 4-dimensional work modes

Web UI is the default user surface for MVP; CLI remains entrypoint/secondary.

---

## Issue: DC-WEB-001 — Vite + React project scaffold

### Description
Initialize `@diricode/web` with:
- Vite + React 18+ + TypeScript
- Tailwind + shadcn/ui base primitives
- dev proxy to Hono server
- production build output consumable by Hono static serving path

### Acceptance Criteria
- [ ] App builds and runs in dev with proxy to server API/SSE.
- [ ] shadcn/ui setup is complete and documented.
- [ ] Shared TS config aligns with monorepo strict settings.
- [ ] Production build artifact can be served by server package.
- [ ] Basic layout shell includes regions for chat + observability panels.

### References
- `spec-mvp-diricode.md` (ADR-032)
- `.sisyphus/plans/cross-cutting.md` (TS conventions)

### Dependencies
- Depends on: monorepo/tooling baseline
- Blocks: DC-WEB-002..007

---

## Issue: DC-WEB-002 — SSE client and global state management

### Description
Create EventSource-based real-time client for `/api/v1/events` with:
- reconnection (exponential backoff)
- event normalization/dispatch
- global event-driven store (zustand or equivalent)
- selectors for chat, observability, approvals, sessions

### Acceptance Criteria
- [ ] SSE connection lifecycle handles connect/disconnect/reconnect cleanly.
- [ ] Backoff strategy avoids reconnect storms.
- [ ] Incoming events are validated/typed before state updates.
- [ ] Store slices support independent UI components.
- [ ] Reconnect flow preserves or restores meaningful UI continuity.

### References
- `analiza-observability.md` (typed event model)
- `spec-mvp-diricode.md` (SSE architecture)

### Dependencies
- Depends on: DC-OBS-001 schema stability, server SSE endpoint
- Blocks: DC-WEB-003..007

---

## Issue: DC-WEB-003 — Chat interface

### Description
Implement core chat UX:
- input + send action
- chronological user/agent message list
- streaming response rendering
- markdown rendering + syntax-highlighted code blocks

UX goal: intuitive first-use experience with no onboarding burden (UX-001).

### Acceptance Criteria
- [ ] User can send prompt and see response stream progressively.
- [ ] Message list clearly differentiates user vs agent output.
- [ ] Markdown and fenced code blocks render correctly.
- [ ] Long outputs remain performant and readable.
- [ ] Empty/loading/error states are simple and non-technical.

### References
- `spec-mvp-diricode.md` (primary Web UI, UX-001)

### Dependencies
- Depends on: DC-WEB-002

---

## Issue: DC-WEB-004 — File diff viewer

### Description
Provide a diff UI for agent-proposed modifications:
- unified diff with syntax highlighting
- before/after toggle
- per-change accept/reject controls
- integration point for approval flows

### Acceptance Criteria
- [ ] Unified diff rendering supports multi-file change sets.
- [ ] User can accept/reject individual changes.
- [ ] Before/after mode is switchable without data loss.
- [ ] Diff actions produce explicit events for auditability.
- [ ] Visual design keeps readability high for non-expert users (UX-001).

### References
- `ankieta-features-ekosystem.md` (approval + workflow decisions)
- `spec-mvp-diricode.md` (pipeline + approval principles)

### Dependencies
- Depends on: DC-WEB-002, event/action APIs

---

## Issue: DC-WEB-005 — Session management UI

### Description
Implement session lifecycle controls:
- session list
- create new session
- resume previous session
- show session metadata (tokens, cost, duration)

### Acceptance Criteria
- [ ] Session picker is available from primary layout.
- [ ] New session creation is one-click and predictable.
- [ ] Resume flow restores message/event context.
- [ ] Metadata panel displays tokens/cost/duration from observability data.
- [ ] Session transitions do not break SSE/event subscriptions.

### References
- `analiza-observability.md` (history/replay model)
- `spec-mvp-diricode.md` (session-oriented architecture)

### Dependencies
- Depends on: DC-WEB-002, memory/session APIs

---

## Issue: DC-WEB-006 — Approval dialog

### Description
Implement pre-tool approval UX (modal/inline):
- what tool
- arguments summary
- requesting agent
- reason/explanation
- actions: approve / deny / approve similar
- timeout countdown (60s default from DC-SAFE-005)

### Acceptance Criteria
- [ ] Approval requests render with complete contextual details.
- [ ] User actions emit explicit response events.
- [ ] 60s timeout is visible and enforced.
- [ ] "Approve similar" uses deterministic matching scope.
- [ ] UI remains unobtrusive outside approval-needed flows (UX-001).

### References
- `analiza-observability.md` (approval event types)
- `spec-mvp-diricode.md` + DC-SAFE-005 timeout rule

### Dependencies
- Depends on: DC-WEB-002, approval API/event integration

---

## Issue: DC-WEB-007 — Work mode selector (4 dimensions)

### Description
Implement UI controls for per-project work modes:
- Quality (5 levels)
- Autonomy (5 levels)
- Verbose (4 levels)
- Creativity (5 levels)

Persist changes to project config and reflect effective mode in runtime requests.

### Acceptance Criteria
- [ ] All 4 selectors are present and usable in main workflow.
- [ ] Option labels map exactly to mode definitions from `analiza-lean-mode.md`.
- [ ] Changes persist to project config and survive reload.
- [ ] Runtime requests include effective mode snapshot.
- [ ] UI communicates defaults clearly to reduce user confusion (UX-001).

### References
- `analiza-lean-mode.md` (primary)
- `spec-mvp-diricode.md` (ADR-012 work modes)

### Dependencies
- Depends on: config API integration, DC-WEB-002

---

## Must NOT
- Must NOT introduce TUI scope into MVP-3 web epic.
- Must NOT overload first-time users with debug-heavy UI defaults (UX-001).
- Must NOT hide agent execution path; transparency is mandatory (UX-003).
- Must NOT bypass typed event flow for component updates.

## Epic Dependencies
- **Blocked by**: server API/SSE stability, observability event schemas.
- **Blocks**: MVP-3 "Car" exit criteria (primary web experience + real-time transparency).
