# v3 — Hardening, Isolation & Advanced Workflows

> **Theme**: Sandbox execution, advanced hooks, full-auto mode, alternative backends, and advanced UX modes.
> **Prerequisite**: v2.1 complete (all v2 iterations shipped)
> **Estimated iterations**: v3.0, v3.1

---

## Vision

v3 transforms DiriCode from a polished dev tool into a hardened, enterprise-ready platform. Key additions:

1. **Sandbox / Containerized Execution** — Docker/VM isolation for agent tool execution (ARCH-002)
2. **7 Additional Hooks** — session-end, task-completed, worktree-create/remove, config-change, user-prompt-submit, subagent-stop
3. **Auto-Advance / Full-Auto Mode** — true autonomous operation with safety rails
4. **GitLab Issues Backend** — alternative to GitHub for plan/issue management
5. **Local Backend** — file-based plan storage without any Git host dependency
6. **Advanced UX Modes** — observability v3, managed/enterprise config, speech-to-text, advanced work mode features

---

## v3 Iterations

### v3.0 — Isolation & Safety

**Exit Criterion**: Agents can execute tools inside Docker containers. 7 new hooks operational. Auto-advance mode works end-to-end with configurable guardrails. Managed config layer enforces enterprise policies.

**Epics**:
- epic-sandbox.md — Docker/VM sandboxed execution
- epic-hooks-v3.md — 7 new hook types
- epic-auto-advance.md — Full-auto mode with guardrails
- epic-observability-v3.md — Cost analytics, performance profiling, comparison view

### v3.1 — Ecosystem Expansion

**Exit Criterion**: User can configure GitLab Issues as plan backend. Local file-based backend works offline. Speech-to-text input works. Remote/managed config enforces org-wide settings.

**Epics**:
- epic-gitlab.md — GitLab Issues backend
- epic-local-backend.md — File-based plan storage (no Git host)
- epic-advanced-modes.md — Enterprise config, speech-to-text, advanced features

---

## Must NOT

- No Jira integration (v4)
- No multi-user collaboration / auth / permissions (v4)
- No desktop app (explicitly out of scope — web UI covers this)
- No Windows support unless community demand warrants it

---

## Child Epics

| File | Domain | Issue ID Range | Iteration |
|------|--------|---------------|-----------|
| [epic-sandbox.md](epic-sandbox.md) | Docker/VM sandboxed execution | DC-SAND-001..DC-SAND-006 | v3.0 |
| [epic-hooks-v3.md](epic-hooks-v3.md) | 7 new hook types | DC-HOOK-013..DC-HOOK-019 | v3.0 |
| [epic-auto-advance.md](epic-auto-advance.md) | Full-auto mode | DC-ADV-001..DC-ADV-005 | v3.0 |
| [epic-observability-v3.md](epic-observability-v3.md) | Cost analytics + profiling + comparison | DC-OBS-013..DC-OBS-017 | v3.0 |
| [epic-gitlab.md](epic-gitlab.md) | GitLab Issues backend | DC-GL-001..DC-GL-005 | v3.1 |
| [epic-local-backend.md](epic-local-backend.md) | File-based plan storage | DC-LOCAL-001..DC-LOCAL-004 | v3.1 |
| [epic-advanced-modes.md](epic-advanced-modes.md) | Enterprise config + speech + advanced UX | DC-ADVUX-001..DC-ADVUX-006 | v3.1 |

---

## Dependencies on v2

| v3 Epic | Depends on v2 Epic |
|---------|-------------------|
| Sandbox | Annotation Approval (tool annotations), Hooks v2 (pre-tool-use) |
| Hooks v3 | Hook engine (MVP), Hooks v2 (complete hook registry) |
| Auto-Advance | Autonomy dimension (Full Auto level), Hook safety rails |
| Observability v3 | Observability v2 (all 6 v2 components), EventStream |
| GitLab | Pipeline (plan execution), Memory (session/issue storage) |
| Local Backend | Pipeline (plan execution), Memory (SQLite) |
| Advanced Modes | Config v2 (presets, hot-reload, GUI), TUI, Marketplace |
