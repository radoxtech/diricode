# ADR-022 — Project Memory: GitHub Issues + SQLite Timeline Engine

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

DiriCode needs persistent project state (plans, requirements, roadmap, task tracking). Files-based state (Markdown) causes worktree conflicts when multiple agents work simultaneously. GitHub Issues provide a worktree-safe, versioned, API-accessible state backend.

### Decision

**GitHub Issues/Epics** as source of truth + **SQLite** as cache/timeline/search engine.

**State model:**
- Plans, requirements, roadmap → GitHub Issues and Epics.
- Each task = separate Issue.
- Epics can nest (multi-level: Epic → Epic → ... → Issue).
- REQ-IDs maintained in Issues for traceability.
- All state lives in GitHub Project — zero local state files.

**SQLite layer (in Hono server process):**
- Cache of GitHub state for fast access.
- Timeline-based memory (events and decisions over time).
- FTS5 full-text search.
- Multi-project and multi-worktree support.
- Versioned migrations.
- SQLite is CACHE — GitHub is source of truth. SQLite loss → rebuild from GitHub.

**Agent access:**
- Agents communicate through API memory service (never read state files directly).
- Worktree-safe: multiple agents/worktrees use the same API, no file conflicts.

**Abstract backend interface (future):**
- GitHub: MVP.
- GitLab Issues: v2/v3.
- Jira: v4.
- Simple local backend (no GitHub): v3/v4 — for projects without GitHub.

### Consequences

- **Positive:** Worktree-safe. Familiar GitHub UI for manual inspection. API-driven access eliminates merge conflicts. Mobile workflow: users can delegate tasks and create Issues from the **GitHub mobile app using Copilot** — enabling on-the-go task assignment that DiriCode agents pick up automatically.
- **Negative:** GitHub dependency in MVP. Offline use requires the local backend (v3/v4). API rate limits may need caching (SQLite handles this).
