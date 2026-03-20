---
description: Show active sprint status and propose non-conflicting feature-level worktree candidates from the live GitHub project model
---

# /current-sprint Command

**You are executing the `/current-sprint` command.**

This command analyzes the active sprint for `radoxtech/diricode` and returns:

1. Sprint status
2. Epic-aware feature context
3. Blocked work
4. Active work that already occupies conflict domains
5. **Non-conflicting feature candidates**
6. **Suggested parallel work bundles** for multiple git worktrees

---

## ⚠️ CRITICAL: GitHub MCP Only for GitHub Data

Use **GitHub MCP tools only** for GitHub operations.

- Allowed for GitHub: `github_projects_list`, `github_projects_get`, `github_issue_read`, `github_list_issues`
- Allowed for local files: normal filesystem tools
- Do **not** use `gh` CLI for GitHub reads

Project constants:

- Owner: `radoxtech`
- Repo: `diricode`
- Project number: `4`

---

## Live DiriCode GitHub Model

The **live GitHub project model** currently uses:

- parent issues labeled `epic`
- implementation issues labeled `feature`

This command must therefore:

- include only `feature` issues as implementation candidates
- exclude `epic` issues from candidate output
- use epic linkage only for context and rollup

### Important note

Repo knowledge docs describe a deeper `Meta-Epic → Epic → Sub-Epic → Task` model.
However, the live GitHub board currently operates as `epic → feature`.

`/current-sprint` must use the **live GitHub model**, not the aspirational hierarchy model.

---

## Required Inputs Per Candidate

For every sprint issue considered as a candidate, collect:

- issue number
- title
- state
- labels
- body
- project status
- sprint value
- parent epic context (native sub-issue linkage or `**Epic**: #N` body reference)

### Label Taxonomy

### Live canonical labels currently used on GitHub

- `epic`
- `feature`

### Additional routing labels supported by this command

These are used for safer parallel work selection:

- `component:*` — broad subsystem ownership
- `area:*` — narrow implementation surface
- `conflict:*` — shared collision domain
- `execution:*` — operational routing hints

Examples:

- `component:web`
- `area:event-schema`
- `conflict:api-contract`
- `execution:parallel-safe`

---

## Dependency + Conflict Model

This command must distinguish:

### 1. Dependency

The feature must wait for another issue.

Treat a feature as **blocked** if any of these is true:

- Project Status = `Blocked`
- label `status:blocked` is present
- label `execution:blocked` is present
- body contains a machine-readable dependency line, e.g. `**Depends on**: #34, #41`
- GitHub-native dependency data is available in the MCP response and shows unresolved blockers

### 2. Conflict

The feature may be technically startable, but should not run in parallel with another active feature.

Treat two features as **conflicting** if any of these is true:

- they share any `conflict:*` label
- they share any `area:*` label
- one blocks the other
- both belong to a high-risk shared surface with no finer labels, especially:
  - `component:repo`
  - `component:config`
  - `component:eventstream`

---

## Selection Rules

### Candidate pool

Only consider issues that are:

- open
- in the active sprint
- labeled `feature`
- status `Todo` or `Ready`

Exclude:

- `epic` issues
- closed issues
- `In Progress`, `Review`, `Done`, `Blocked`

### Active work set

Build an **active work set** from sprint features in:

- `In Progress`
- `Review`

These occupy their conflict domains.

### Safe parallel candidate

A feature is **safe** only if:

- it is not blocked
- it does not conflict with any active feature
- it does not conflict with another already-selected safe candidate in the same bundle

### Coordination-needed candidate

A feature is **coordination-needed** if:

- it is not blocked
- but it shares `area:*`, `conflict:*`, or a high-risk component with active work or another top candidate

---

## Active Sprint Resolution

### Step 1 — Discover project fields

Use `github_projects_list(method="list_project_fields")` and record:

- Sprint / Iteration field id
- Status field id

### Step 2 — Fetch project items

Use `github_projects_list(method="list_project_items")` with pagination and include the Sprint + Status field ids.

### Step 3 — Resolve active sprint

If the project uses an iteration field:

- active sprint = iteration where `startDate <= today < startDate + duration`

If there is **no Sprint / Iteration field**:

- clearly state that sprint planning is not configured
- switch to **degraded mode**:
  - analyze open `feature` issues in `Todo` / `Ready`
  - still compute safe candidates and bundles
  - clearly mark the result as `No active sprint configured`

---

## Epic Context Resolution

For every candidate feature, resolve its parent epic using:

1. native sub-issue linkage
2. deterministic `**Epic**: #N` body reference

If the parent epic cannot be resolved, mark the feature as orphaned and reduce readiness.

---

## Scoring

Score each feature 0–100.

| Factor                | Weight | Notes                            |
| --------------------- | -----: | -------------------------------- |
| Status readiness      |     25 | `Ready` > `Todo`                 |
| Priority              |     20 | Critical > High > Medium > Low   |
| Dependency freedom    |     20 | blocked = 0                      |
| Parallel safety       |     20 | no active conflicts = full score |
| Epic context resolved |      5 | parent epic known                |
| Size / atomicity      |     10 | smaller, isolated work preferred |

### Tiebreakers

Prefer features that:

1. unblock other issues
2. have `execution:parallel-safe`
3. have both `component:*` and `area:*`
4. avoid shared `conflict:*`

---

## Bundle Generation

After ranking, generate **2–5 suggested bundles**.

Each bundle must:

- contain only safe feature candidates
- contain no pair sharing `area:*`
- contain no pair sharing `conflict:*`
- contain no blocker/dependent pair

Use a greedy strategy:

1. sort by score descending
2. pick highest feature
3. add next feature only if it does not conflict with any feature already in the bundle

---

## Required Output Sections

The report must include all of the following:

### 1. Sprint Overview

- sprint name or degraded-mode note
- issue counts by status
- feature count considered for execution

### 2. Active Conflict Domains

- currently occupied `component:*`
- currently occupied `area:*`
- currently occupied `conflict:*`

### 3. Blocked Features

- feature
- blocker reason
- parsed `Depends on` references if present

### 4. Ready Now — Safe Parallel Features

Only features safe to start in separate worktrees now.

For each feature show:

- issue number / title
- status / priority
- labels summary
- parent epic
- why it is safe

### 5. Ready Now — Needs Coordination

Features that are startable but not safely parallel.

For each feature show:

- why excluded from safe set
- which active feature / conflict domain caused it

### 6. Suggested Parallel Bundles

Return 2–5 bundles such as:

```text
Bundle A
- #41 Bash execution tool
- #90 SQLite database setup
- #131 Vite + React project scaffold
```

### 7. Recommended Next Single Feature

Best immediate next feature.

---

## Required Machine-Readable Output

Write:

- `.sisyphus/notepads/current-sprint/report.json`
- `.sisyphus/notepads/current-sprint/summary.md`

`report.json` must include at least:

```json
{
  "generated_at": "ISO-8601",
  "mode": "active-sprint or degraded-no-sprint",
  "active_sprint": "Sprint name or null",
  "active_conflicts": {
    "components": [],
    "areas": [],
    "conflicts": []
  },
  "blocked_features": [],
  "safe_candidates": [],
  "coordination_needed": [],
  "bundles": [],
  "recommended_next": {}
}
```

---

## Best-Practice Guardrails

Validated against current GitHub/GitLab issue dependency practices:

- use hierarchy for ownership/scope
- use dependencies for true blockers
- use labels/fields for conflict surfaces
- never suggest blocked work as ready work
- never recommend two implementation issues together if they share the same narrow implementation surface

---

## Related Commands

- `./start-work.md`
- `./project-health.md`

---

**Version:** 2.2.0
