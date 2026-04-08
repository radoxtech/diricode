> ⚠️ **DEPRECATED** — GitLab integration scope was closed during the 2026-04 issue remediation (Batch 11). All related issues have been closed.

# Epic: GitLab Issues Backend (v3.1)

> Package: `@diricode/core` + new `@diricode/gitlab-mcp`
> Iteration: **v3.1**
> Issue IDs: **DC-GL-001..DC-GL-005**

## Summary

Adds GitLab as a sync adapter — a write target that pushes DiriCode's runtime state (issues, tasks, epics) from the local SQLite system to GitLab Projects for external visibility and team collaboration. Users on GitLab can export their plans and track progress in their GitLab projects while DiriCode's agents work with the local SQLite source of truth.

This fulfills the user decision from survey 11.1: "GitHub first, GitLab v2/v3, Jira v4" — DiriCode progressively supports more sync targets/adapters for external visibility (GitHub, GitLab, Jira) alongside the local SQLite runtime backend.

Source: Survey decision 11.1 (plan storage backends), `overview.md` v3 "GitLab Issues backend"
Ecosystem references: GitLab REST API v4 / GraphQL API, GitLab Epics (Premium feature), GitLab Issues + Labels + Milestones

## Architectural Baseline

- MVP: `@diricode/memory` provides the SQLite source of truth for all runtime state — issues, epics, tasks, and relationships (ADR-048)
- MVP: Pipeline (`DC-PIPE-001..008`) operates on abstract plan/issue objects backed by SQLite
- v2: `@diricode/github-mcp` provides GitHub Projects as a sync adapter — a write-only target that receives state pushes from SQLite for external visibility
- v3: GitLab sync adapter allows users to push DiriCode runtime state to GitLab Projects on equal footing with GitHub
- Sync adapters are accessed through a `SyncTarget` interface (or MCP server protocol) — implementing GitLab means supporting a second adapter behind the same interface
- User selects sync targets via config: `"syncTargets": ["github"] | ["gitlab"] | ["github", "gitlab"]` — multiple targets can be active simultaneously

## Issues

### DC-GL-001 — GitLab API client and authentication

**Goal**: Create a GitLab API client supporting personal access tokens and OAuth, covering the API surface needed for plan synchronization (issues, labels, milestones, and optionally epics).

**Scope**
- GitLab API client:
  - REST API v4 as primary (widely available, no tier restrictions for issues)
  - GraphQL API as optional enhancement (for batch queries, available on GitLab 12.0+)
  - Authentication methods:
    - Personal Access Token (PAT) — simplest, recommended for individual use
    - OAuth 2.0 — for organizational/enterprise deployments
    - CI Job Token — for GitLab CI integration
- Configuration in `.dc/config.jsonc`:
  ```jsonc
  {
    "syncTargets": ["gitlab"],
    "gitlab": {
      "host": "https://gitlab.com",    // or self-hosted
      "project": "user/repo",
      "token": "glpat-..."             // or via DC_GITLAB_TOKEN env var
    }
  }
  ```
- Self-hosted GitLab support: configurable `host` URL (not just gitlab.com)
- Rate limit handling: respect GitLab rate limits (default 300 req/min for PAT), exponential backoff
- Error mapping: GitLab API errors → DiriCode typed errors (same error types as GitHub sync adapter)

**Acceptance criteria**
- [ ] GitLab REST API v4 client implemented with authenticated requests
- [ ] PAT authentication works with `DC_GITLAB_TOKEN` env var or config
- [ ] Self-hosted GitLab URL configurable via `gitlab.host`
- [ ] Rate limit handling with exponential backoff
- [ ] Error responses mapped to DiriCode typed errors (consistent with GitHub sync adapter)
- [ ] Connection test: `dc config test-gitlab` verifies API access and permissions

**References**
- MVP `epic-memory.md` (SQLite as runtime state source, ADR-048)
- MVP `epic-pipeline.md` DC-PIPE-001..008 (plan execution abstractions)
- Survey 11.1: "GitHub first, GitLab v2/v3, Jira v4"
- GitLab REST API v4: https://docs.gitlab.com/ee/api/rest/
- MVP `@diricode/github-mcp` pattern (to mirror for GitLab sync adapter)

---

### DC-GL-002 — Issue and label management via GitLab

**Goal**: Implement CRUD operations for GitLab Issues and Labels, mapping DiriCode plan concepts (tasks, statuses, priorities) to GitLab primitives.

**Scope**
- Issue operations:
  - Create issue (title, description, labels, milestone, assignee)
  - Update issue (status, labels, description)
  - Close issue (on task completion)
  - List issues with filter (by label, milestone, status, assignee)
  - Search issues by text
- Label mapping (same scheme as GitHub backend):
  - Status labels: `dc:status/todo`, `dc:status/in-progress`, `dc:status/done`, `dc:status/blocked`
  - Priority labels: `dc:priority/high`, `dc:priority/medium`, `dc:priority/low`
  - Type labels: `dc:type/task`, `dc:type/epic`, `dc:type/bug`, `dc:type/spike`
  - Agent labels: `dc:agent/code-writer`, `dc:agent/planner-thorough`, etc.
- Auto-create labels: on first use, create DiriCode label set in GitLab project (with colors)
- Issue description format: same Markdown template as GitHub backend (structured sections: Goal, Scope, Acceptance Criteria, References)
- Issue ID mapping: `DC-PIPE-003` issue title prefix → searchable, linkable

**Acceptance criteria**
- [ ] Create, update, close, list, search operations for GitLab Issues
- [ ] Label auto-creation with DiriCode label scheme (status, priority, type, agent)
- [ ] Issue description follows same Markdown template as GitHub sync adapter
- [ ] Filter by label, milestone, status, assignee works correctly
- [ ] Issue ID prefix (`DC-*`) is preserved in titles for searchability
- [ ] Bulk label creation on first project setup

**References**
- MVP GitHub sync adapter: label scheme and issue template (to maintain consistency)
- GitLab Issues API: https://docs.gitlab.com/ee/api/issues.html
- GitLab Labels API: https://docs.gitlab.com/ee/api/labels.html

---

### DC-GL-003 — Epic/milestone mapping for plan hierarchies

**Goal**: Map DiriCode's plan hierarchy (Epic → Tasks) to GitLab's organizational primitives — using Milestones (free tier) or Epics (Premium tier) depending on user's GitLab subscription.

**Scope**
- Two strategies based on GitLab tier:
  - **Free tier (Milestones)**: Plan = Milestone, Tasks = Issues within milestone
    - Milestones support title, description, due date, and issue grouping
    - Limited: no parent-child milestone nesting (flat hierarchy only)
  - **Premium tier (Epics)**: Plan = Epic, Tasks = Issues linked to epic
    - Epics support parent-child nesting (hierarchical plans)
    - Epics support roadmap view (timeline)
    - Requires GitLab Premium or Ultimate
- Auto-detection: check if GitLab project supports Epics API → use Epics if available, fallback to Milestones
- Configuration override: user can force `"gitlab.planMapping": "milestones" | "epics"` in config
- Milestone operations: create, update, close, list
- Epic operations (if available): create, update, close, add child issues, list

**Acceptance criteria**
- [ ] Auto-detect GitLab tier (Epics API probe → fallback to Milestones)
- [ ] Milestone-based mapping: Plan = Milestone, Tasks = Issues in milestone
- [ ] Epic-based mapping (Premium): Plan = Epic, Tasks = child issues
- [ ] Config override for explicit strategy selection
- [ ] Plan creation creates appropriate container (Milestone or Epic)
- [ ] Task completion updates parent container progress

**References**
- GitLab Milestones API: https://docs.gitlab.com/ee/api/milestones.html
- GitLab Epics API: https://docs.gitlab.com/ee/api/epics.html
- MVP pipeline: plan hierarchy abstraction (plan → tasks)

---

### DC-GL-004 — GitLab MCP server packaging

**Goal**: Package the GitLab sync adapter as an MCP server (`@diricode/gitlab-mcp`), following the same pattern as the existing `@diricode/github-mcp` — making it discoverable, loadable per-agent, and independently testable.

**Scope**
- MCP server implementation:
  - Tools: `gitlab_create_issue`, `gitlab_update_issue`, `gitlab_close_issue`, `gitlab_list_issues`, `gitlab_search_issues`, `gitlab_create_milestone`, `gitlab_create_epic` (if available)
  - Resources: `gitlab://project/{project}/issues`, `gitlab://project/{project}/milestones`
  - Tool annotations: all write operations marked `destructiveHint: false`, `idempotentHint: false`; list/search marked `readOnlyHint: true`
- Agent loading: GitLab MCP loaded for agents that synchronize state (dispatcher, planner, verifier) — not globally
- Startup: MCP server starts when `syncTargets: ["gitlab"]` is configured
- Graceful degradation: if GitLab is unreachable, queue operations and retry (offline resilience)

**Acceptance criteria**
- [ ] `@diricode/gitlab-mcp` package created in monorepo under `packages/gitlab-mcp/`
- [ ] MCP tools for issue CRUD, milestone CRUD, epic CRUD (conditional)
- [ ] MCP resources for browsing issues and milestones
- [ ] Tool annotations present on all tools
- [ ] MCP server starts only when `syncTargets: ["gitlab"]` is configured
- [ ] Agent-scoped loading (only relevant agents receive GitLab tools)
- [ ] Offline queue: operations queued when GitLab unreachable, retried on reconnect

**References**
- MVP `@diricode/github-mcp` (architectural mirror — same MCP server pattern)
- MCP protocol specification (tools, resources, annotations)
- Wishlist 8.2: "MCP are loaded per agent — not globally"

---

### DC-GL-005 — Sync target switcher and migration tooling

**Goal**: Allow users to switch between GitLab and GitHub sync targets (and future targets like Jira), with optional migration of existing issues between platforms.

**Scope**
- Sync target switcher:
  - `dc config set syncTargets gitlab` — change active sync target(s)
  - `dc config set syncTargets "[github,gitlab]"` — enable multiple targets simultaneously
  - Validation: test connection to new sync target before switching
  - Warning: "Existing issues in SQLite are the source of truth. Use `dc migrate` to import existing platform issues or initialize a new project."
- Migration command:
  - `dc migrate --from github --to gitlab` — copy existing GitHub Issues into SQLite, then push to GitLab
  - Dry-run mode: `dc migrate --dry-run` — show what would be migrated without executing
  - Mapping report: after migration, produce mapping table (old GitHub issue URL → new GitLab issue URL)
  - Status preservation: issue status (open/closed) and labels transferred
  - Limitation: comments and assignees NOT migrated in v3 (too complex, v4 consideration)
- Sync adapter abstraction verification: ensure pipeline/memory code truly doesn't depend on any specific sync target API

**Acceptance criteria**
- [ ] `dc config set syncTargets gitlab` switches active target(s) with validation
- [ ] Connection test runs before target switch
- [ ] `dc migrate --from github --to gitlab` imports GitHub Issues and pushes to GitLab
- [ ] Dry-run mode shows migration plan without executing
- [ ] Mapping report generated after migration (old URL → new URL)
- [ ] Issue status and labels preserved in migration
- [ ] Pipeline/memory code works identically with different sync targets
- [ ] Multiple sync targets can be active simultaneously (state pushed to all)

**References**
- Survey 11.1: "GitHub first, GitLab v2/v3, Jira v4"
- ADR-048: SQLite as source of truth for runtime state
- MVP pipeline abstraction (backend-agnostic sync interface)
- v4 `epic-jira.md` (future: third sync target using same abstraction)
