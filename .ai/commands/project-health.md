---
description: Run GitHub Project health check - hierarchy, sprint hygiene, dependency hygiene, conflict-safe execution readiness, and hierarchy-model drift reporting
---

# Project Health Check

**You are executing the `/project-health` command.**

This command audits `radoxtech/diricode` Project #4 using **GitHub MCP only** and produces a scored report.

---

## ⚠️ CRITICAL: MCP Only & Execution Strategy

- Use only GitHub MCP tools for GitHub operations.
- Follow this script as the **canonical execution plan**.

---

## Audit Dimensions

### 1. Project Coverage (15 pts)

Are repo issues present in the project? (Calculated in-memory).

### 2. Sprint / Iteration Coverage (15 pts)

Identify active sprint implementation work.

**FAIL if:** No Sprint iteration field exists in Project #4.

### 3. Epic Hierarchy Integrity (15 pts)

Are `level:task` issues linked to parent `level:epic` issues natively?

**Check:**
- `level:epic` issues have proper children
- `level:task` issues have `parent_issue_url` set
- No orphaned `level:task` issues

### 4. Label Completeness (10 pts)

Do issues have required structural labels?

**Required labels per issue type:**

| Issue Type | Required Labels |
|------------|-----------------|
| `level:meta-epic` | `level:meta-epic` |
| `level:epic` | `level:epic` |
| `level:sub-epic` | `level:sub-epic` |
| `level:task` | `level:task` + `component:*` + `area:*` |

### 5. Dependency Hygiene (15 pts)

Are blocked features explicitly modeled via `Depends on` body text or native metadata?

**Check for:**
- `status:blocked` label
- `execution:blocked` label
- `**Depends on**: #N` in body

### 6. Conflict Labeling Hygiene (10 pts)

Verification of `area:*` and `conflict:*` metadata for safe parallel execution.

**Check:**
- `level:task` issues have `component:*` labels
- `level:task` issues have `area:*` labels
- Shared surface issues have `conflict:*` labels

### 7. Parallel-Ready Depth (10 pts)

Does the active sprint contain enough **non-conflicting feature work** for multiple worktrees?

**Check:**
- Count of `level:task` issues in Todo/Ready
- Non-conflicting pairs available for parallel work

### 8. Stale Active Work (5 pts)

Detection of features stuck in `In Progress`, `Review`, or `Ready` for > 3 days.

### 9. Velocity (5 pts)

Tracking of closed implementation work over time.

---

## Scoring Model

Score from 100 points.

| Check | Max |
|-------|----:|
| Project coverage | 15 |
| Sprint / iteration coverage | 15 |
| Epic hierarchy | 15 |
| Label completeness | 10 |
| Dependency hygiene | 15 |
| Conflict labeling hygiene | 10 |
| Parallel-ready depth | 10 |
| Stale active work | 5 |
| Velocity | 5 |

---

## Execution Workflow

### Phase 1 — Project Census

1. `github_projects_list(method="list_project_items")` with field expansion (Status, Sprint, Labels)
2. `github_projects_list(method="list_project_fields")` for field IDs

### Phase 2 — In-Memory Analysis

Perform all checks using collected data:
- Coverage calculation
- Label completeness
- Conflict labeling
- Parallel-ready depth
- Stale work detection
- Velocity calculation

### Phase 3 — Targeted Hierarchy Check

For `level:epic` issues, verify sub-issue linkage:
- `github_issue_read(method="get_sub_issues")` on key epics

### Phase 4 — Dependency Hygiene

For blocked `level:task` issues, verify dependency metadata exists.

---

## Hierarchy Model

The documented hierarchy in `.ai/knowledge/epic-hierarchy.md`:

```
Meta-Epic (level:meta-epic)
└── Epic (level:epic)
    └── Sub-Epic (level:sub-epic)
        └── Task (level:task)
```

**Current live state:**
- Issues #1-17: `level:epic` (17 epics)
- Issues #18-137: `level:task` (120 tasks)

Report any drift between documented and live models.

---

## Required Outputs

- `.sisyphus/notepads/project-health/report.json`
- `.sisyphus/notepads/project-health/issues.md`

Include sections for: Project coverage, Sprint coverage, Epic hierarchy, Dependency/Conflict hygiene, Parallel-ready depth, Stale work, Velocity, Hierarchy drift, and Final score with remediation.

---

## Remediation Priorities

| Priority | Action |
|----------|--------|
| P0 | Add Sprint field to Project #4 |
| P0 | Ensure all `level:task` issues have `component:*` and `area:*` |
| P1 | Add missing issues to Project #4 |
| P1 | Fix orphaned `level:task` issues (no parent epic) |
| P2 | Add `conflict:*` labels to shared-surface features |

---

**Last Updated:** 2026-03-20
**Version:** 5.0.0 (4-level hierarchy)
