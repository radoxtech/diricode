# Epic: GitLab Issues Backend (v3.1)

> Package: `@diricode/core` + new `@diricode/gitlab-mcp`
> Iteration: **v3.1**
> Issue IDs: **DC-GL-001..DC-GL-005**

## Summary

Adds GitLab Issues as an alternative plan management backend alongside the existing GitHub Issues integration (built in MVP as `@diricode/github-mcp`). Users on GitLab can store plans, epics, and issues in their GitLab projects — using the same pipeline and memory abstractions that GitHub users enjoy.

This fulfills the user decision from survey 11.1: "GitHub first, GitLab v2/v3, Jira v4" — DiriCode progressively supports more issue backends.

Source: Survey decision 11.1 (plan storage backends), `overview.md` v3 "GitLab Issues backend"
Ecosystem references: GitLab REST API v4 / GraphQL API, GitLab Epics (Premium feature), GitLab Issues + Labels + Milestones

## Architectural Baseline

- MVP: `@diricode/github-mcp` provides GitHub Issues/Epics as plan backend via MCP protocol
- MVP: Pipeline (`DC-PIPE-001..008`) operates on abstract plan/issue objects — not GitHub-specific
- MVP: Memory (`@diricode/memory`) stores session data in SQLite — plan references are stored as URLs/IDs
- The plan backend is accessed through a `PlanBackend` interface (or MCP server protocol) — adding GitLab means implementing a second backend behind the same interface
- User selects backend via config: `"planBackend": "github" | "gitlab" | "local"`

## Issues

### DC-GL-001 — GitLab API client and authentication

**Goal**: Create a GitLab API client supporting personal access tokens and OAuth, covering the API surface needed for plan management (issues, labels, milestones, and optionally epics).

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
    "planBackend": "gitlab",
    "gitlab": {
      "host": "https://gitlab.com",    // or self-hosted
      "project": "user/repo",
      "token": "glpat-..."             // or via DC_GITLAB_TOKEN env var
    }
  }
  ```
- Self-hosted GitLab support: configurable `host` URL (not just gitlab.com)
- Rate limit handling: respect GitLab rate limits (default 300 req/min for PAT), exponential backoff
- Error mapping: GitLab API errors → DiriCode typed errors (same error types as GitHub backend)

**Acceptance criteria**
- [ ] GitLab REST API v4 client implemented with authenticated requests
- [ ] PAT authentication works with `DC_GITLAB_TOKEN` env var or config
- [ ] Self-hosted GitLab URL configurable via `gitlab.host`
- [ ] Rate limit handling with exponential backoff
- [ ] Error responses mapped to DiriCode typed errors (consistent with GitHub backend)
- [ ] Connection test: `dc config test-gitlab` verifies API access and permissions

**References**
- MVP `epic-pipeline.md` DC-PIPE-001..008 (plan execution abstractions)
- Survey 11.1: "GitHub first, GitLab v2/v3, Jira v4"
- GitLab REST API v4: https://docs.gitlab.com/ee/api/rest/
- MVP `@diricode/github-mcp` pattern (to mirror for GitLab)

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
- [ ] Issue description follows same Markdown template as GitHub backend
- [ ] Filter by label, milestone, status, assignee works correctly
- [ ] Issue ID prefix (`DC-*`) is preserved in titles for searchability
- [ ] Bulk label creation on first project setup

**References**
- MVP GitHub backend: label scheme and issue template (to maintain consistency)
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

**Goal**: Package the GitLab integration as an MCP server (`@diricode/gitlab-mcp`), following the same pattern as the existing `@diricode/github-mcp` — making it discoverable, loadable per-agent, and independently testable.

**Scope**
- MCP server implementation:
  - Tools: `gitlab_create_issue`, `gitlab_update_issue`, `gitlab_close_issue`, `gitlab_list_issues`, `gitlab_search_issues`, `gitlab_create_milestone`, `gitlab_create_epic` (if available)
  - Resources: `gitlab://project/{project}/issues`, `gitlab://project/{project}/milestones`
  - Tool annotations: all write operations marked `destructiveHint: false`, `idempotentHint: false`; list/search marked `readOnlyHint: true`
- Agent loading: GitLab MCP loaded for agents that need plan management (dispatcher, planner, verifier) — not globally
- Startup: MCP server starts when `planBackend: "gitlab"` is configured
- Graceful degradation: if GitLab is unreachable, queue operations and retry (offline resilience)

**Acceptance criteria**
- [ ] `@diricode/gitlab-mcp` package created in monorepo under `packages/gitlab-mcp/`
- [ ] MCP tools for issue CRUD, milestone CRUD, epic CRUD (conditional)
- [ ] MCP resources for browsing issues and milestones
- [ ] Tool annotations present on all tools
- [ ] MCP server starts only when `planBackend: "gitlab"` is configured
- [ ] Agent-scoped loading (only relevant agents receive GitLab tools)
- [ ] Offline queue: operations queued when GitLab unreachable, retried on reconnect

**References**
- MVP `@diricode/github-mcp` (architectural mirror — same MCP server pattern)
- MCP protocol specification (tools, resources, annotations)
- Wishlist 8.2: "MCP are loaded per agent — not globally"

---

### DC-GL-005 — Backend switcher and migration tooling

**Goal**: Allow users to switch between GitHub and GitLab backends (and future backends like Local/Jira), with optional migration of existing issues between platforms.

**Scope**
- Backend switcher:
  - `dc config set planBackend gitlab` — change active backend
  - Validation: test connection to new backend before switching
  - Warning: "Existing issues in GitHub won't be migrated automatically. Use `dc migrate` to transfer."
- Migration command:
  - `dc migrate --from github --to gitlab` — copy issues, labels, milestones/epics
  - Dry-run mode: `dc migrate --dry-run` — show what would be migrated without executing
  - Mapping report: after migration, produce mapping table (old GitHub issue URL → new GitLab issue URL)
  - Status preservation: issue status (open/closed) and labels transferred
  - Limitation: comments and assignees NOT migrated in v3 (too complex, v4 consideration)
- Backend abstraction verification: ensure pipeline/memory code truly doesn't depend on GitHub-specific APIs

**Acceptance criteria**
- [ ] `dc config set planBackend gitlab` switches backend with validation
- [ ] Connection test runs before backend switch
- [ ] `dc migrate --from github --to gitlab` migrates issues, labels, milestones
- [ ] Dry-run mode shows migration plan without executing
- [ ] Mapping report generated after migration (old URL → new URL)
- [ ] Issue status and labels preserved in migration
- [ ] Pipeline/memory code works identically with GitHub and GitLab backends

**References**
- Survey 11.1: "GitHub first, GitLab v2/v3, Jira v4"
- MVP pipeline abstraction (backend-agnostic plan interface)
- v4 `epic-jira.md` (future: third backend using same abstraction)
