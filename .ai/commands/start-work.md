---
description: Initialize a worktree for a sprint feature issue that is unblocked and non-conflicting with active work
---

# /start-work Command

**You are executing the `/start-work` command.**

This command creates a new git worktree for a DiriCode **feature** issue.

It must refuse to start work that is:

- blocked
- already active
- conflicting with current active worktrees / in-progress sprint work

---

## ⛔ CRITICAL: Live GitHub Uses Features as Implementation Units

For the live GitHub board, the implementation unit is currently:

- label `feature`

Do **not** start work directly on:

- issues labeled `epic`

### Important note

Repo knowledge docs describe a deeper task hierarchy, but the live GitHub board currently uses `epic` + `feature`.
`/start-work` must use the **live board model** so the workflow is operational today.

---

## ⚠️ Tool Split

### GitHub data
Use **GitHub MCP only**:

- `github_projects_list`
- `github_projects_get`
- `github_issue_read`
- `github_projects_write`

### Local git / worktree operations
Use local shell tools for:

- `git worktree`
- `git branch`
- `git status`

Do not use `gh` CLI.

---

## Workflow

1. Validate that the user is in the main repo, not already inside a worktree
2. Read the latest current-sprint report if present
3. If no report is present or it is stale, execute `/current-sprint` logic first
4. Select a **safe feature** from `safe_candidates`
5. Re-validate conflicts against currently active work
6. Create the worktree and branch
7. Move the project item to `In Progress`
8. Output branch, path, feature context, and parent epic

---

## Selection Source of Truth

Primary source:

- `.sisyphus/notepads/current-sprint/report.json`

Use only issues from:

- `safe_candidates`

Do **not** auto-select from `coordination_needed` unless the user explicitly overrides.

---

## Feature Eligibility Rules

An issue is eligible only if:

- it has label `feature`
- it is open
- it is not blocked
- it is not already `In Progress` or `Review`

Reject issues labeled:

- `epic`

---

## Conflict Refusal Rules

Before creating the worktree, refuse the feature if any of these is true:

- it is in `blocked_features`
- project status is `Blocked`
- label `status:blocked` is present
- project status is already `In Progress` or `Review`
- it shares `conflict:*` with an active feature
- it shares `area:*` with an active feature
- it depends on an unresolved issue

If refused, show:

- the conflicting issue number(s)
- the shared `area:*` / `conflict:*`
- one or more safe alternatives from `safe_candidates`

---

## Branch Naming

Use repo naming conventions:

```text
<type>/<slug>-#<issue>
```

Type comes from canonical `type:*` labels when available.
If no `type:*` labels exist on the live board yet, default to `feat/`.

Preferred mapping:

- `type:bug` → `fix/`
- `type:enhancement` → `feat/`
- `type:refactor` → `refactor/`
- `type:documentation` → `docs/`
- `type:test` → `test/`
- `type:chore` → `chore/`
- default → `feat/`

---

## Worktree Naming

Use repo naming conventions:

```text
../<repo>-#<issue>
```

Example:

```text
../diricode-#41
```

---

## Project Status Update

After worktree creation, update the project item to `In Progress` using `github_projects_write(method="update_project_item")`.

Do not use raw GraphQL through `gh`.

---

## Required Output

Show:

- issue number and title
- parent epic
- why it was safe to start
- branch name
- worktree path
- any occupied conflict domains the user should avoid while the worktree is active

Example:

```text
✅ WORKTREE CREATED

Feature: #41 — DC-TOOL-004: Bash execution tool
Epic: #5 Tools Runtime
Why safe: unblocked, no shared area/conflict labels with active work
Branch: feat/bash-execution-tool-#41
Worktree: ../diricode-#41

Occupied domains now:
- component:tools
- area:tool-runtime
- conflict:tool-registry
```

---

## If No Safe Candidates Exist

Do not guess.

Return:

- no safe feature candidates available
- blocked count
- coordination-needed count
- top reasons preventing safe parallel work

Then recommend:

1. finish active conflicting work
2. resolve blocker feature
3. add missing `area:*` / `conflict:*` labels if ambiguity is preventing safe routing

---

## Related Commands

- `./current-sprint.md`
- `./project-health.md`
- `./finish-work.md`

---

**Version:** 2.2.0
