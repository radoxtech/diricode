> ⚠️ **DEPRECATED** — Jira integration scope was closed during the 2026-04 issue remediation (Batch 11). All related issues have been closed.

# Epic: Jira Cloud & Server Backend (v4.0)

> Package: `@diricode/core` + new `@diricode/jira-mcp`
> Iteration: **v4.0**
> Issue IDs: **DC-JIRA-001..DC-JIRA-005**

## Summary

Adds Jira (Cloud and Server/Data Center) as the fourth plan management backend — completing enterprise issue tracker coverage. DiriCode plans map to Jira Epics, tasks map to Jira Issues, and work mode dimensions map to Jira custom fields or labels.

This is the final backend in the progression established in survey 11.1: "GitHub first, GitLab v2/v3, Jira v4." Jira was explicitly deferred to v4 because of its complex API, enterprise-heavy workflow, and the need for the backend abstraction to be battle-tested with GitHub, GitLab, and Local first.

Source: Survey 11.1 decision, `overview.md` v4 "Jira integration as plan backend"
Ecosystem references: Jira REST API v3 (Cloud), Jira REST API v2 (Server/Data Center), Atlassian Connect, Forge platform

## Architectural Baseline

- MVP: `PlanBackend` interface abstracts plan storage
- v3: GitHub, GitLab, and Local backends all implement `PlanBackend`
- v3: Backend switcher (`dc config set planBackend`) and migration tooling (`dc migrate`)
- v3: MCP server pattern for backends (`@diricode/github-mcp`, `@diricode/gitlab-mcp`)
- The Jira backend adds a fourth implementation of `PlanBackend` via `@diricode/jira-mcp`
- Jira has significantly different concepts than GitHub/GitLab (boards, sprints, story points, workflows, custom fields) — mapping requires careful design

## Issues

### DC-JIRA-001 — Jira API client and authentication

**Goal**: Create a Jira API client supporting both Jira Cloud (Atlassian Cloud) and Jira Server/Data Center, with appropriate authentication for each deployment model.

**Scope**
- Jira Cloud authentication:
  - API Token (email + token) — simplest, for individual use
  - OAuth 2.0 (3LO) — for organizational deployments
  - Atlassian Connect / Forge — for app-style integration (future consideration)
- Jira Server/Data Center authentication:
  - Personal Access Token (PAT) — available on Server 8.14+
  - Basic Auth (username + password) — legacy, discouraged but supported
  - OAuth 1.0a — complex but supported on older versions
- API versions:
  - Jira Cloud: REST API v3 (primary) + v2 (fallback for compatibility)
  - Jira Server: REST API v2 (Server doesn't support v3)
- Configuration in `.dc/config.jsonc`:
  ```jsonc
  {
    "planBackend": "jira",
    "jira": {
      "host": "https://company.atlassian.net",   // Cloud
      // OR: "host": "https://jira.company.com",  // Server
      "project": "PROJ",                          // Jira project key
      "email": "user@company.com",                // Cloud only
      "token": "..."                              // or via DC_JIRA_TOKEN env var
    }
  }
  ```
- Rate limit handling: Jira Cloud has strict rate limits (~100 req/min) — implement request queuing and exponential backoff
- Version detection: auto-detect Cloud vs Server from host URL pattern and API probe

**Acceptance criteria**
- [ ] Jira Cloud REST API v3 client with API Token and OAuth 2.0 auth
- [ ] Jira Server REST API v2 client with PAT and Basic Auth
- [ ] Auto-detection of Cloud vs Server deployment
- [ ] Rate limit handling with request queue and exponential backoff
- [ ] Configuration via `.dc/config.jsonc` and `DC_JIRA_TOKEN` / `DC_JIRA_EMAIL` env vars
- [ ] `dc config test-jira` verifies API access and project permissions
- [ ] Error mapping to DiriCode typed errors (consistent with GitHub/GitLab backends)

**References**
- v3 DC-GL-001 (GitLab API client — same pattern, different API)
- Jira Cloud REST API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- Jira Server REST API: https://docs.atlassian.com/software/jira/docs/api/REST/
- Survey 11.1: "GitHub first, GitLab v2/v3, Jira v4"

---

### DC-JIRA-002 — Plan-to-Jira concept mapping

**Goal**: Define and implement the mapping between DiriCode plan concepts (plans, tasks, statuses, priorities) and Jira concepts (epics, issues, workflows, priorities, story points).

**Scope**
- Concept mapping:
  | DiriCode Concept | Jira Mapping | Notes |
  |-----------------|-------------|-------|
  | Plan | Epic | Jira Epic is the closest to a plan container |
  | Task | Issue (type: Task or Story) | Configurable: user picks Task vs Story vs custom type |
  | Status: todo | Jira status: "To Do" | Mapped to Jira workflow's initial state |
  | Status: in-progress | Jira status: "In Progress" | Mapped to Jira workflow's active state |
  | Status: done | Jira status: "Done" | Mapped to Jira workflow's completed state |
  | Status: blocked | Jira status: "Blocked" (if exists) or label | Not all Jira workflows have "Blocked" |
  | Priority: high/medium/low | Jira priority: Highest/Medium/Lowest | Map to Jira's 5-level priority system |
  | Agent label | Jira label: `dc-agent-code-writer` | Labels (Jira labels don't support `/` or `:`) |
  | Type label | Jira label: `dc-type-task` | Labels |
- Workflow compatibility:
  - Jira has custom workflows — transitions between statuses are restricted
  - DiriCode must query available transitions before changing status
  - If a transition isn't available, log warning and skip (don't fail)
- Custom fields (optional):
  - `dc:cost` — estimated/actual cost (number field)
  - `dc:tokens` — token count (number field)
  - `dc:agent` — assigned DiriCode agent (select field)
  - Custom fields auto-created on first use (if user has admin permissions)
  - Fallback: use issue description for metadata if custom fields unavailable
- Issue description template: same structured Markdown as other backends (Goal, Scope, Acceptance Criteria, References)

**Acceptance criteria**
- [ ] Plan → Epic mapping implemented (create epic, link child issues)
- [ ] Task → Issue mapping with configurable issue type (Task/Story/custom)
- [ ] Status mapping respects Jira workflow transitions (query before transition)
- [ ] Priority mapping to Jira's priority system
- [ ] Label mapping (Jira-compatible format: `dc-agent-code-writer` instead of `dc:agent/code-writer`)
- [ ] Custom fields created if user has admin permissions, graceful fallback otherwise
- [ ] Issue description follows same Markdown template as GitHub/GitLab backends
- [ ] Workflow transition errors handled gracefully (warning, not failure)

**References**
- v3 DC-GL-002 (GitLab issue/label management — parallel implementation)
- Jira workflows: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-workflow-transitions/
- Jira custom fields: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-custom-field-contexts/

---

### DC-JIRA-003 — Sprint and board integration

**Goal**: Optionally integrate with Jira Scrum/Kanban boards and sprints — allowing DiriCode plans to be organized within existing team sprint workflows.

**Scope**
- Sprint integration (Scrum boards):
  - Detect if project uses Scrum board → discover active sprint
  - Option to assign DiriCode tasks to the active sprint
  - Configuration: `"jira.autoAssignSprint": true | false` (default: false)
  - Sprint completion: when all DiriCode tasks in a sprint are done, optionally mark sprint tasks as done
- Kanban board integration:
  - No sprints in Kanban — tasks appear on board automatically based on status
  - DiriCode status transitions → board column movement (via workflow transitions)
  - Read board configuration to understand column mapping
- Board discovery:
  - `dc jira boards` — list available boards for the project
  - `dc jira sprint` — show current sprint with DiriCode tasks
- Configuration:
  ```jsonc
  {
    "jira": {
      "board": "PROJ-board",          // optional: specific board
      "autoAssignSprint": false,      // assign tasks to active sprint
      "issueType": "Task"             // default issue type for DC tasks
    }
  }
  ```

**Acceptance criteria**
- [ ] Detect project board type (Scrum vs Kanban)
- [ ] For Scrum: discover active sprint, optionally assign tasks to it
- [ ] For Kanban: tasks appear in correct columns based on DiriCode status mapping
- [ ] `dc jira boards` lists project boards
- [ ] `dc jira sprint` shows current sprint with DiriCode task status
- [ ] `autoAssignSprint` config option controls sprint assignment
- [ ] Board/sprint operations are read-only by default (opt-in for write operations)

**References**
- Jira Agile REST API: https://developer.atlassian.com/cloud/jira/software/rest/intro/
- Jira Board API: https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/
- Jira Sprint API: https://developer.atlassian.com/cloud/jira/software/rest/api-group-sprint/

---

### DC-JIRA-004 — Jira MCP server packaging

**Goal**: Package the Jira integration as an MCP server (`@diricode/jira-mcp`), following the established pattern from GitHub and GitLab MCP servers.

**Scope**
- MCP server implementation:
  - Tools:
    - `jira_create_issue` — create issue with type, summary, description, priority, labels, epic, sprint
    - `jira_update_issue` — update fields, transition status (respecting workflow)
    - `jira_close_issue` — transition to done state
    - `jira_list_issues` — list with JQL filter support
    - `jira_search_issues` — JQL-based search (Jira's powerful query language)
    - `jira_create_epic` — create epic container
    - `jira_get_transitions` — query available workflow transitions for an issue
    - `jira_assign_sprint` — assign issue to active sprint (optional)
  - Resources:
    - `jira://project/{key}/issues` — browse project issues
    - `jira://project/{key}/boards` — browse project boards
    - `jira://project/{key}/sprints` — browse active sprints
  - Tool annotations: write operations `destructiveHint: false`, search/list `readOnlyHint: true`
- JQL support: expose Jira Query Language for powerful issue filtering (DiriCode agents can use JQL for complex queries)
- Agent loading: Jira MCP loaded only for agents that need plan management
- Startup: MCP server starts when `planBackend: "jira"` is configured

**Acceptance criteria**
- [ ] `@diricode/jira-mcp` package in monorepo under `packages/jira-mcp/`
- [ ] MCP tools for issue CRUD, epic CRUD, workflow transitions, sprint assignment
- [ ] MCP resources for browsing issues, boards, sprints
- [ ] JQL query support in `jira_search_issues` tool
- [ ] Tool annotations on all tools
- [ ] MCP server starts only when `planBackend: "jira"`
- [ ] Agent-scoped loading (only plan-management agents receive Jira tools)
- [ ] Works with both Jira Cloud and Jira Server (API version adapters)

**References**
- MVP `@diricode/github-mcp` (original MCP server pattern)
- v3 `@diricode/gitlab-mcp` (second MCP server — same pattern)
- MCP protocol specification
- JQL reference: https://support.atlassian.com/jira-service-management-cloud/docs/use-advanced-search-with-jira-query-language-jql/

---

### DC-JIRA-005 — Jira migration and backend switcher extension

**Goal**: Extend the existing migration tooling to support Jira as both source and target — enabling bidirectional migration between all four backends (GitHub ↔ GitLab ↔ Local ↔ Jira).

**Scope**
- Migration paths:
  - `dc migrate --from github --to jira` — GitHub Issues → Jira Issues
  - `dc migrate --from gitlab --to jira` — GitLab Issues → Jira Issues
  - `dc migrate --from local --to jira` — Local Markdown plans → Jira Issues
  - `dc migrate --from jira --to github` — Jira Issues → GitHub Issues
  - `dc migrate --from jira --to gitlab` — Jira Issues → GitLab Issues
  - `dc migrate --from jira --to local` — Jira Issues → Local Markdown plans
- Jira-specific mapping during migration:
  - Jira priorities (5 levels) → DiriCode priorities (3 levels): Highest/High → high, Medium → medium, Low/Lowest → low
  - Jira workflow statuses → DiriCode statuses (best-effort mapping based on status category: "To Do"→todo, "In Progress"→in-progress, "Done"→done)
  - Jira labels → DiriCode labels (format conversion: `dc-agent-code-writer` → `dc:agent/code-writer`)
  - Jira custom fields (if present) → DiriCode metadata in description
  - Sprint assignment → not migrated (sprint is board-specific)
- Dry-run mode: all migration directions support `--dry-run`
- Mapping report: generated after migration (old Jira key → new GitHub/GitLab URL or local file path)
- Bulk migration: Jira API supports bulk operations — use them for efficiency
- JQL pre-filter: `dc migrate --from jira --jql "project = PROJ AND label = dc-*"` — migrate only DiriCode-managed issues

**Acceptance criteria**
- [ ] All 6 Jira migration paths work (Jira→GitHub, Jira→GitLab, Jira→Local, and reverse)
- [ ] Priority mapping between Jira's 5 levels and DiriCode's 3 levels
- [ ] Status mapping based on Jira status categories
- [ ] Label format conversion between Jira and DiriCode conventions
- [ ] Dry-run mode for all migration directions
- [ ] Mapping report generated after each migration
- [ ] JQL pre-filter for selective migration from Jira
- [ ] Bulk API operations used for efficiency where available

**References**
- v3 DC-GL-005 (backend switcher and migration tooling — extend with Jira)
- v3 DC-LOCAL-004 (local migration — extend with Jira)
- Jira bulk operations: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/
