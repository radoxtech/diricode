# v3 — Hardening, Swarm Coordination & Advanced Workflows

> **Theme**: Sandbox execution, advanced hooks, full-auto mode, swarm coordination, and advanced UX modes.
> **Prerequisite**: v2.1 complete (all v2 iterations shipped)
> **Estimated iterations**: v3.0, v3.1

---

## Vision

v3 transforms DiriCode from a polished dev tool into a hardened platform capable of complex agent coordination. Key additions:

1. **Sandbox / Containerized Execution** — Docker/VM isolation for agent tool execution (ARCH-002)
2. **7 Additional Hooks** — session-end, task-completed, worktree-create/remove, config-change, user-prompt-submit, subagent-stop
3. **Auto-Advance / Full-Auto Mode** — true autonomous operation with safety rails
4. **Swarm Coordination** — Bounded parallel execution and multi-agent coordination
5. **Local Backend** — file-based plan storage without any Git host dependency
6. **Advanced UX Modes** — observability v3, managed/enterprise config, speech-to-text, advanced work mode features

---

## v3 Iterations

### v3.0 — Coordination & Safety

**Exit Criterion**: Agents can execute tools inside Docker containers. 7 new hooks operational. Swarm coordination allows multiple agents to work on a task with bounded parallelism. Managed config layer enforces enterprise policies.

**Epics**:
- #253 Hooks v3
- #255 Observability v3
- Swarm Coordination
- epic-sandbox.md — Docker/VM sandboxed execution

### v3.1 — Ecosystem Expansion

**Exit Criterion**: Local file-based backend works offline. Speech-to-text input works. Remote/managed config enforces org-wide settings. DiriRouter handles complex swarm routing and cost management.

**Epics**:
- epic-local-backend.md — File-based plan storage (no Git host)
- epic-advanced-modes.md — Enterprise config, speech-to-text, advanced features

---

## Must NOT

- No Jira integration (CLOSED)
- No GitLab integration (CLOSED)
- No multi-user collaboration / auth / permissions (CLOSED)
- No desktop app (explicitly out of scope — web UI covers this)

---

## Child Epics

| File | Domain | Issue ID Range | Iteration |
|------|--------|---------------|-----------|
| [epic-sandbox.md](epic-sandbox.md) | Docker/VM sandboxed execution | DC-SAND-001..DC-SAND-006 | v3.0 |
| [epic-hooks-v3.md](epic-hooks-v3.md) | 7 new hook types | DC-HOOK-013..DC-HOOK-019 | v3.0 |
| [epic-observability-v3.md](epic-observability-v3.md) | Cost analytics + profiling + comparison | DC-OBS-013..DC-OBS-017 | v3.0 |
| [epic-local-backend.md](epic-local-backend.md) | File-based plan storage | DC-LOCAL-001..DC-LOCAL-004 | v3.1 |
| [epic-advanced-modes.md](epic-advanced-modes.md) | Enterprise config + speech + advanced UX | DC-ADVUX-001..DC-ADVUX-006 | v3.1 |

---

## Dependencies on v2

| v3 Epic | Depends on v2 Epic |
|---------|-------------------|
| Sandbox | Annotation Approval (tool annotations), Hooks v2 (pre-tool-use) |
| Hooks v3 | Hook engine (MVP), Hooks v2 (complete hook registry) |
| Swarm Coordination | DiriRouter (routing), Hooks v2 (pre-tool-use) |
| Observability v3 | Observability v2 (all 6 v2 components), EventStream |
| Local Backend | Pipeline (plan execution), Memory (SQLite) |
| Advanced Modes | Config v2 (presets, hot-reload, GUI), TUI |
