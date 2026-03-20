# Epic: Annotation-Driven Approval System (v2.0)

> Package: `@diricode/core` + `@diricode/tools`
> Iteration: **v2.0**
> Issue IDs: **DC-APPR-001..DC-APPR-005**

## Summary

Builds on MVP's tool annotations (DC-TOOL-001: readOnly, destructive, idempotent flags) to create an automatic approval flow. When an agent invokes a tool, the system checks the tool's annotation against the user's current Autonomy level and either auto-approves, requests approval, or blocks the action.

This is the bridge between tool metadata and the Autonomy dimension — making the 5-level permission matrix from `analiza-lean-mode.md` Section 3 actually functional.

Survey reference: Feature 5.2 "Annotation-driven approval (czeka na 5.1 z MVP)"

## Architectural Baseline

- Tool annotations from MVP: `{ readOnly: boolean, destructive: boolean, idempotent: boolean }`
- Autonomy levels: Ask Everything → Suggest → Auto-Edit → Auto-Execute → Full Auto
- `pre-tool-use` hook (DC-HOOK-007) fires before every tool invocation
- Approval UI: inline in Agent Tree (Web UI) + TUI equivalent

## Issues

### DC-APPR-001 — Approval policy engine

**Goal**: Implement the decision engine that maps (tool annotation × Autonomy level) → approval action.

**Scope**
- Define `ApprovalAction` type: `'auto-approve' | 'request-approval' | 'block'`
- Implement policy matrix matching the permission table from lean mode analysis:
  - Ask Everything: request-approval for ALL actions
  - Suggest: request-approval for file writes + shell commands
  - Auto-Edit: request-approval for shell commands + merges
  - Auto-Execute: request-approval for merges only
  - Full Auto: auto-approve all (with audit log)
- Special rule: destructive git ops (force push, rebase) ALWAYS request-approval, even in Full Auto (wishlist 3.1)
- Policy is evaluated inside `pre-tool-use` hook
- Return structured decision with reason for audit trail

**Acceptance criteria**
- [ ] Policy engine correctly maps all 5 Autonomy × 3 annotation combinations
- [ ] Destructive git ops always require approval regardless of Autonomy level
- [ ] Decision includes audit-ready reason string
- [ ] Policy is configurable (users can override defaults in config)
- [ ] Unit tests cover all matrix cells

**References**
- `analiza-lean-mode.md` Section 3 (permission matrix)
- ADR-012 (Autonomy dimension)
- Wishlist 3.1 (destructive ops always need confirmation)

---

### DC-APPR-002 — Approval request/response protocol

**Goal**: Define the EventStream protocol for approval requests — how agents pause, how UI renders the request, how user responds, how the agent resumes.

**Scope**
- `approval.request` event: contains tool name, arguments summary, risk level, agent ID, annotation data
- `approval.response` event: contains decision (approve/reject), user ID, timestamp
- Agent suspension: agent context is preserved while waiting (not discarded)
- Timeout handling: configurable approval timeout (default 5 minutes), auto-reject on timeout
- Batch approval: "Approve all from this agent" option for current turn

**Acceptance criteria**
- [ ] approval.request event contains sufficient info for informed decision
- [ ] Agent resumes correctly after approval with preserved context
- [ ] Timeout triggers auto-reject with informative message
- [ ] Batch approval works for multiple pending requests from same agent
- [ ] Rejection allows agent to take alternative path (not just fail)

**References**
- `analiza-observability.md` Section 4.2 (Pre-tool Approval spec)
- EventStream event types (approval.request, approval.response)

---

### DC-APPR-003 — Web UI approval component

**Goal**: Render approval requests inline in the Web UI Agent Tree with approve/reject/show-details buttons.

**Scope**
- Inline approval widget at the point where agent is waiting in the tree
- Show: tool name, arguments preview, risk level badge (LOW/MEDIUM/HIGH from risk-assessor)
- Buttons: [Approve] [Reject] [Show Full Args] [Approve All From Agent]
- Visual indicator: pulsing yellow for pending approval
- Sound/notification option for approval requests
- Keyboard shortcut: `y` to approve, `n` to reject when approval is focused

**Acceptance criteria**
- [ ] Approval widget renders inline in Agent Tree at correct position
- [ ] Risk level badge color-coded (green LOW, yellow MEDIUM, red HIGH)
- [ ] Approve/reject sends response via HTTP to server
- [ ] Agent tree updates immediately after approval decision
- [ ] Keyboard shortcuts work when approval is focused

**References**
- `analiza-observability.md` Section 4.2 (Pre-tool Approval UI spec)

---

### DC-APPR-004 — TUI approval component

**Goal**: Implement approval flow in TUI — terminal equivalent of Web UI approval widget.

**Scope**
- Inline text prompt when approval needed: `🟡 APPROVE? [tool] [args summary]`
- Keyboard: `y` approve, `n` reject, `d` show details, `a` approve all
- Bell/notification on approval request (terminal bell)
- Clear visual separation from agent output

**Acceptance criteria**
- [ ] Approval prompt appears inline in TUI agent tree
- [ ] y/n/d/a keyboard shortcuts work
- [ ] Terminal bell rings on approval request
- [ ] Rejected action shows clear feedback

**References**
- `analiza-observability.md` Section 4.2

---

### DC-APPR-005 — Audit log for approval decisions

**Goal**: Persist all approval decisions (both manual and auto-approved) for audit trail and compliance.

**Scope**
- Store in SQLite: timestamp, session_id, agent_id, tool_name, tool_args_hash, annotation, autonomy_level, decision, reason, user_response_time_ms
- Query API: list approvals by session, by tool, by decision type
- Export: JSON/CSV export of audit log
- Full Auto mode: all auto-approvals logged with `reason: "full-auto"` (wishlist 3.1)

**Acceptance criteria**
- [ ] All approval decisions persisted to SQLite
- [ ] Auto-approved actions in Full Auto mode also logged
- [ ] Query API returns filtered results
- [ ] Export produces valid JSON/CSV
- [ ] Audit log survives server restart

**References**
- Wishlist 3.1 (auto-approve is opt-in, audit trail)
- ADR-012 (Full Auto audit requirement)
