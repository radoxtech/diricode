---
description: Run GitHub Project health check (Optimized) - hierarchy, sprint hygiene, dependency hygiene, conflict-safe execution readiness, and hierarchy-model drift reporting
---

# Project Health Check (Optimized)

**You are executing the `/project-health` command.**

This command audits `radoxtech/diricode` Project #4 using **GitHub MCP only** and produces a scored report.

It is optimized for **minimal token consumption** by merging multiple data-gathering phases into a single project item scan.

---

## ⚠️ CRITICAL: MCP Only & Execution Strategy

- Use only GitHub MCP tools for GitHub operations.
- Follow `.sisyphus/scripts/project_health_check.md` as the **canonical, optimized execution plan**.

---

## Execution Workflow (Optimized)

### 1. Unified Project Census
Instead of separate repo and project listings, perform a single `list_project_items` call with field expansion (Status, Sprint, Labels). This replaces multiple redundant list operations.

### 2. In-Memory Analysis
Perform labeling, coverage, and staleness checks locally using the data from Step 1.

### 3. Targeted Hierarchy Check
Only call `github_issue_read(method="get_sub_issues")` for identified epics to verify native links. **If a feature is missing its native link to an epic, fix it immediately.**

---

## Audit Dimensions

### 1. Project Coverage
Are repo issues present in the project? (Calculated in-memory).

### 2. Sprint / Iteration Coverage
Identify active sprint implementation work.

### 3. Epic Hierarchy Integrity
Are `feature` issues linked to parent `epic` issues natively?

### 4. Label Completeness
Do issues have required structural labels (`epic`, `feature`, `component:*`)?

### 5. Dependency Hygiene
Are blocked features explicitly modeled via `Depends on` body text or native metadata?

### 6. Conflict Labeling Hygiene
Verification of `area:*` and `conflict:*` metadata for safe parallel execution.

### 7. Parallel-Ready Depth
Does the active sprint contain enough **non-conflicting feature work** for multiple worktrees?

### 8. Stale Active Work
Detection of features stuck in `In Progress`, `Review`, or `Ready`.

### 9. Velocity
Tracking of closed implementation work over time.

### 10. Hierarchy Model Drift
Reporting mismatch between live GitHub (`epic/feature`) and `.ai/knowledge/*` (4-level hierarchy).

---

## Scoring Model

Score from 100 points. Key focus: **safe parallel routability**.

| Check | Max |
|---|---:|
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

## Required Outputs

- `.sisyphus/notepads/project-health/report.json`
- `.sisyphus/notepads/project-health/issues.md`

Include sections for: Project coverage, Sprint coverage, Epic hierarchy, Dependency/Conflict hygiene, Parallel-ready depth, Stale work, Velocity, Hierarchy drift, and Final score with remediation.

---

**Last Updated:** 2026-03-20
**Version:** 4.0.0 (Optimized Execution)
