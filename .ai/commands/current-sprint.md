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

The **live GitHub project model** uses issues with `**Iteration**` body markers to denote sprint assignments:

| Iteration | Sprint | Period |
|-----------|--------|--------|
| POC | Sprint 1 | Week 1-2 |
| MVP-1 | Sprint 2 | Week 3-4 |
| MVP-2 | Sprint 3 | Week 5-6 |
| MVP-3 | Sprint 4 | Week 7-8 |

**Issue Structure:**

- `level:epic` — parent planning issues (DO NOT implement)
- `level:task` — atomic implementation units (implement these)
- `**Iteration**: X` — sprint assignment marker in issue body

---

### Label Taxonomy (Required for Parallel Routing)

Every `level:task` issue should have:

- `component:*` — broad subsystem ownership (e.g., `component:tools`, `component:agents`)
- `area:*` — narrow implementation surface (e.g., `area:file-read`, `area:agent-dispatcher`)

Optional routing labels:

- `conflict:*` — shared collision domain (e.g., `conflict:workspace-structure`)
- `execution:*` — operational hints (`execution:parallel-safe`, `execution:blocked`)

---

## Dependency + Conflict Model

### 1. Dependency

The feature must wait for another issue. Treat as **blocked** if:

- Project Status = `Blocked`
- label `status:blocked` or `execution:blocked` is present
- body contains `**Depends on**: #N`
- GitHub-native dependency data shows unresolved blockers

### 2. Conflict

Features should not run in parallel if they share:

- any `conflict:*` label
- any `area:*` label
- high-risk shared surface without finer labels:
  - `component:repo`, `component:config`, `component:eventstream`

---

## Selection Rules

### Candidate Pool

Only consider issues that are:

- open
- in the active sprint
- labeled `level:task`
- status `Todo` or `Ready`

**Exclude:** `level:epic` issues, closed issues, `In Progress`, `Review`, `Done`, `Blocked`

### Active Work Set

Features in `In Progress` or `Review` occupy their conflict domains.

### Safe vs Coordination-Needed

- **Safe**: Not blocked, no conflicts with active work or other candidates
- **Coordination-needed**: Shares area/conflict with other candidates

---

## Sprint Resolution (CRITICAL)

### Step 1 — Discover project fields

```javascript
github_projects_list(method="list_project_fields")
```

Record the Sprint/Iteration field id and Status field id.

### Step 2 — Fetch project items

```javascript
github_projects_list(method="list_project_items")
```

### Step 3 — Resolve sprint (TWO METHODS)

#### Method A: GitHub Projects Sprint Field (Preferred)

If project items have Sprint field values populated:

- active sprint = iteration where `startDate <= today < startDate + duration`
- Filter items by current sprint iteration id

#### Method B: **Iteration** Body Marker (Fallback)

If Sprint field is NOT populated on items (common case), parse from issue body:

```
**Iteration**: POC       → Sprint 1
**Iteration**: MVP-1     → Sprint 2
**Iteration**: MVP-2    → Sprint 3
**Iteration**: MVP-3    → Sprint 4
```

Patterns like `POC → MVP-1` or `MVP-1 → MVP-2` indicate an issue spans sprints.

**Rules:**
- Extract `**Iteration**: ` value until newline
- `POC` alone → Sprint 1
- `MVP-1` or `POC → MVP-1` → Sprint 2
- `MVP-2` or `MVP-1 → MVP-2` or `POC → MVP-2` → Sprint 3
- `MVP-3` or `MVP-2 → MVP-3` → Sprint 4

### Step 4 — Determine Active Sprint

Today's date determines active sprint:

| Date Range | Active Sprint | Iteration |
|------------|--------------|-----------|
| 2026-03-15 to 2026-03-28 | Sprint 1 | POC |
| 2026-03-29 to 2026-04-11 | Sprint 2 | MVP-1 |
| 2026-04-12 to 2026-04-25 | Sprint 3 | MVP-2 |
| 2026-04-26 to 2026-05-09 | Sprint 4 | MVP-3 |

---

## Epic Context Resolution

For each candidate, resolve parent epic via:

1. Native sub-issue linkage (preferred)
2. `**Epic**: #N` body reference

Mark orphaned features (no epic) with reduced readiness.

---

## Scoring

| Factor | Weight | Notes |
|--------|-------:|-------|
| Status readiness | 25 | `Ready` > `Todo` |
| Priority | 20 | Critical > High > Medium > Low |
| Dependency freedom | 20 | blocked = 0 |
| Parallel safety | 20 | no active conflicts = full score |
| Epic context resolved | 5 | parent epic known |
| Size / atomicity | 10 | smaller, isolated work preferred |

### Tiebreakers

Prefer features that:
1. unblock other issues
2. have `execution:parallel-safe`
3. have both `component:*` and `area:*`
4. avoid shared `conflict:*`

---

## Bundle Generation

Generate **2–5 bundles** using greedy strategy:

1. Sort by score descending
2. Pick highest feature
3. Add next only if no `area:*`, `conflict:*`, or high-risk component overlap

**Bundle rules:**
- Only safe candidates
- No `area:*` overlap within bundle
- No `conflict:*` overlap within bundle
- No blocker/dependent pairs

---

## Required Output Sections

### 1. Sprint Overview

- sprint name and period
- issue counts by status and iteration
- feature count considered

### 2. Active Conflict Domains

- occupied `component:*`
- occupied `area:*`
- occupied `conflict:*`

### 3. Blocked Features

- feature, blocker reason, `Depends on` references

### 4. Ready Now — Safe Parallel Features

For each: issue #, title, status, priority, labels, parent epic, why safe

### 5. Ready Now — Needs Coordination

For each: why excluded, which conflict domain caused it

### 6. Suggested Parallel Bundles

2–5 bundles with rationale

### 7. Recommended Next Single Feature

Best immediate next feature with reasoning

---

## Required Machine-Readable Output

Write to:
- `.sisyphus/notepads/current-sprint/report.json`
- `.sisyphus/notepads/current-sprint/summary.md`

### report.json Schema

```json
{
  "generated_at": "ISO-8601",
  "mode": "active-sprint | degraded-no-sprint",
  "active_sprint": "Sprint name or null",
  "sprint_period": "ISO date range or null",
  "sprint_note": "How sprint was resolved",
  "sprint_overview": {
    "total_open": 0,
    "total_closed": 0,
    "by_iteration": {}
  },
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

- use hierarchy for ownership/scope
- use dependencies for true blockers
- use labels/fields for conflict surfaces
- never suggest blocked work as ready
- never recommend two issues together sharing same narrow surface

---

## Related Commands

- `./start-work.md`
- `./project-health.md`

---

**Version:** 4.0.0 (Iteration body marker resolution)
