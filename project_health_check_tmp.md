# Project Health Check — Agent Execution Script

This is the canonical execution plan for `/project-health`.

- Repo: `radoxtech/diricode`
- Project: `#4`
- GitHub data source: **GitHub MCP only**

The goal is not only backlog hygiene but also **parallel feature execution readiness** on the live GitHub board.

---

## Phase 0 — Setup

Create / reuse:

- `.sisyphus/notepads/project-health/report.json`
- `.sisyphus/notepads/project-health/issues.md`

Initialize counters for:

- repo issue counts
- project coverage
- sprint coverage
- epic / feature counts
- orphaned features
- missing structural labels
- dependency hygiene failures
- conflict labeling hygiene failures
- stale active feature work
- safe / coordination / blocked sprint feature candidates
- velocity
- hierarchy drift findings

---

## Phase 1 — Repo Issue Census

### 1.1 Open issues

Use `github_list_issues` with pagination for `OPEN`.

Collect per issue:

- number
- title
- labels
- state
- updatedAt

### 1.2 Closed issues

Use `github_list_issues` with pagination for `CLOSED`.

Collect:

- number
- closedAt
- labels

---

## Phase 2 — Project Field Discovery

Use `github_projects_list(method="list_project_fields")`.

Resolve field ids for:

- `Sprint` or `Iteration`
- `Status`

If Sprint/Iteration field exists, capture its iteration metadata.

---

## Phase 3 — Full Project Item Scan

Use `github_projects_list(method="list_project_items")` with pagination and request Sprint + Status field ids.

Collect per project item:

- item id
- issue number
- issue title
- issue state
- sprint value
- status value

Build:

- `project_numbers`
- `status_distribution`
- `no_sprint_open_issues`

---

## Phase 4 — Coverage Checks

### 4.1 Issues not in project

`repo_open_numbers - project_numbers`

### 4.2 Issues without sprint

Open project items with null sprint.

If the project has no Sprint/Iteration field at all, record that as a structural failure.

---

## Phase 5 — Live Hierarchy Integrity

### 5.1 Fetch live levels

Use `github_list_issues` for:

- `labels=["epic"]`
- `labels=["feature"]`

Compute level counts.

### 5.2 Build native child maps

For each epic, use `github_issue_read(method="get_sub_issues")` with pagination.

Expected live hierarchy edge:

- Epic → Feature

### 5.3 Detect live hierarchy failures

Record:

- orphaned features (no epic parent)
- epics with zero feature children

---

## Phase 6 — Hierarchy Model Drift

Also inspect repo-documented hierarchy levels using:

- `labels=["level:meta-epic"]`
- `labels=["level:epic"]`
- `labels=["level:sub-epic"]`
- `labels=["level:task"]`

Compare:

- live GitHub structure
- documented `.ai/knowledge/*` structure

Record drift findings, especially:

- live uses `epic`/`feature`
- documented model expects 4 levels
- zero live `level:task` issues

This section is diagnostic and should not replace the live operational model used elsewhere in the report.

---

## Phase 7 — Label Completeness

For each open issue on the live board:

- should have one of `epic` or `feature`

For each open **feature** issue:

- should have at least one `component:*` for safe routing

Recommended but not always mandatory:

- `area:*`
- `conflict:*` when the feature touches shared surfaces

Record:

- missing `epic/feature` label
- feature issues missing `component:*`
- feature issues missing `area:*`

---

## Phase 8 — Dependency Hygiene

For every open feature issue with project status `Blocked` or label `status:blocked` or `execution:blocked`:

1. read the issue body with `github_issue_read(method="get")`
2. detect whether explicit dependency metadata exists

Accepted sources:

- native GitHub dependency data if exposed by MCP response
- body line `**Depends on**: #...`

If the feature is blocked but no explicit blocker source can be determined, add it to `dependency_hygiene_failures`.

Also record features whose body explicitly says `Depends on` but the referenced issues are already closed / done; these may be stale blockers or stale status.

---

## Phase 9 — Conflict Labeling Hygiene

For every open feature issue in the active sprint (or all open features if no sprint exists), inspect labels.

Flag as ambiguous if:

- no `component:*`
- no `area:*`
- shared-surface work but no `conflict:*`

Shared-surface heuristics include labels / titles / bodies indicating:

- API contract work
- event schema work
- root config / workspace changes
- shared UI kit / root tooling / registries

Add ambiguous features to `conflict_hygiene_failures`.

---

## Phase 10 — Parallel-Ready Depth

Determine the active sprint if possible.

Candidate pool:

- open feature issues
- in active sprint
- status `Todo` or `Ready`

Active work set:

- sprint feature issues in `In Progress` or `Review`

Classify each candidate as:

### Safe

- not blocked
- no shared `area:*` with active work
- no shared `conflict:*` with active work
- no unresolved dependency

### Coordination-needed

- not blocked
- but shares `area:*`, `conflict:*`, or high-risk component with active work

### Blocked

- blocked by status, explicit dependency, or execution label

Compute:

- safe candidate count
- coordination-needed count
- blocked candidate count

This is the core health signal for multi-worktree feature readiness.

---

## Phase 11 — Stale Work

Using project status + `updatedAt`:

- `In Progress` older than 7 days → stale
- `Review` older than 5 days → stale
- `Ready` older than 3 days → stale queue issue

Focus this section on feature-level work items.

---

## Phase 12 — Velocity

Group closed feature issues by sprint iteration if available; otherwise by month.

Return last three periods and trend:

- improving
- stable
- declining

---

## Phase 13 — Score

Score from 100 using these dimensions:

- Project coverage: 15
- Sprint / iteration coverage: 15
- Epic hierarchy: 15
- Label completeness: 10
- Dependency hygiene: 15
- Conflict labeling hygiene: 10
- Parallel-ready depth: 10
- Stale active work: 5
- Velocity: 5

Suggested grading:

- 90–100 = A
- 80–89 = B
- 70–79 = C
- <70 = D

Guidance:

- no Sprint field → strong deduction in sprint coverage and parallel-ready depth
- blocked features without explicit blocker metadata → strong dependency hygiene deduction
- too few safe parallel features → fail parallel-ready depth
- hierarchy drift should be reported separately even if not scored as harshly as operational failures

---

## Phase 14 — Write report.json

Include at least:

```json
{
  "generated_at": "ISO-8601",
  "repo": "radoxtech/diricode",
  "project_number": 4,
  "counts": {},
  "project_coverage": {},
  "sprint_coverage": {},
  "live_hierarchy": {},
  "hierarchy_drift": {},
  "label_hygiene": {},
  "dependency_hygiene": {},
  "conflict_hygiene": {},
  "parallel_ready_depth": {
    "safe": 0,
    "coordination_needed": 0,
    "blocked": 0
  },
  "stale": {},
  "velocity": [],
  "health_score": {}
}
```

---

## Phase 15 — Write issues.md

Human-readable output must include sections for:

- Project coverage
- Sprint / iteration coverage
- Live epic→feature hierarchy integrity
- Hierarchy-model drift vs `.ai/knowledge/*`
- Missing structural labels
- Dependency hygiene failures
- Conflict labeling failures
- Parallel-ready depth
- Stale active feature work
- Velocity trend
- Health score
- Top remediation items

Top remediation items should prioritize:

1. create / repair Sprint field
2. repair epic→feature links
3. add `component:*`
4. add `area:*` / `conflict:*`
5. add explicit `Depends on` metadata to blocked features
6. resolve live-vs-documented hierarchy drift

---

## Notes

- Pagination is mandatory everywhere.
- Field ids must be discovered fresh.
- Prefer native GitHub relationships when exposed.
- When MCP cannot fully expose dependency graph details, use deterministic body conventions to avoid hidden blockers.
- The health report must help the user decide whether multiple feature worktrees can be run safely right now.
