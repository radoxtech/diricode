# v4 — Enterprise Integration & Collaboration

> **Theme**: Jira integration, multi-user collaboration, auth, permissions, and team workflows.
> **Prerequisite**: v3.1 complete (all v3 iterations shipped)
> **Estimated iterations**: v4.0, v4.1

---

## Vision

v4 transforms DiriCode from a single-user power tool into a team-capable platform. Key additions:

1. **Jira Integration** — fourth plan backend, completing enterprise issue tracker coverage (GitHub → GitLab → Local → Jira)
2. **Multi-User Collaboration** — authentication, permissions, team roles, concurrent sessions, and shared workspaces

These features were explicitly deferred to v4 in survey decisions: "GitHub first, GitLab v2/v3, Jira v4" (survey 11.1) and multi-user was identified as the latest-stage feature across all surveys.

---

## v4 Iterations

### v4.0 — Jira Backend

**Exit Criterion**: User can configure Jira Cloud or Jira Server as plan backend. Issues, epics, sprints map to DiriCode plan concepts. Migration from GitHub/GitLab/Local to Jira works bidirectionally.

**Epics**:
- epic-jira.md — Jira Cloud & Server as plan backend

### v4.1 — Multi-User Collaboration

**Exit Criterion**: Multiple users can connect to a shared DiriCode server. Authentication (OAuth/SAML) works. Team roles (admin/developer/viewer) enforce permissions. Concurrent sessions don't conflict. Shared agent configurations and memory are team-scoped.

**Epics**:
- epic-multi-user.md — Auth, permissions, teams, concurrent sessions

---

## Must NOT

- No desktop app (explicitly out of scope at all versions — web UI covers this)
- No mobile app (not discussed in any survey)
- No custom AI model training (out of scope)
- No cloud-hosted SaaS offering (DiriCode is local-first; server is your machine)

---

## Child Epics

| File | Domain | Issue ID Range | Iteration |
|------|--------|---------------|-----------|
| [epic-jira.md](epic-jira.md) | Jira Cloud & Server backend | DC-JIRA-001..DC-JIRA-005 | v4.0 |
| [epic-multi-user.md](epic-multi-user.md) | Auth, permissions, teams | DC-MULTI-001..DC-MULTI-005 | v4.1 |

---

## Dependencies on v3

| v4 Epic | Depends on v3 Epic |
|---------|-------------------|
| Jira | GitLab backend (DC-GL-005 backend switcher), Local backend (migration tooling), Pipeline abstraction |
| Multi-User | Sandbox (agent isolation), Managed config (admin-controlled settings), Auto-advance (full-auto safety rails for team use) |

---

## Relationship to Earlier Versions

v4 builds on the entire foundation:

| Foundation | Provided By | Used in v4 |
|-----------|-------------|------------|
| Plan abstraction | MVP pipeline (DC-PIPE-001..008) | Jira implements `PlanBackend` interface |
| Backend switcher | v3 (DC-GL-005) | Extended with Jira as 4th backend |
| Migration tooling | v3 (DC-GL-005, DC-LOCAL-004) | Extended with Jira source/target |
| Hono HTTP server | MVP server (DC-SRV-001..006) | Auth middleware, session management |
| EventStream | MVP observability (DC-OBS-001) | Team-scoped events, shared dashboards |
| Config layers | MVP (4 layers) → v2 (6) → v3 (7) | Team config layer, per-user overrides in team context |
| Agent isolation | v3 sandbox (DC-SAND-001..006) | Multi-user safety — agents can't access other users' data |
