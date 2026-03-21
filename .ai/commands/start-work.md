---
description: Initialize a worktree for a sprint feature issue, or transition an epic to In Progress and then start one of its features
---

# /start-work Command

**You are executing the `/start-work` command.**

This command creates a new git worktree for a single DiriCode **feature** issue.

It must refuse to start work that is:

- blocked
- already active
- conflicting with current active worktrees / in-progress sprint work

---

## ⛔ CRITICAL: Live GitHub Uses Features as Implementation Units

For the live GitHub board, the implementation unit is currently:

- label `feature`

You cannot create a worktree for an `epic` issue — epics are not directly implementable.

### Important note

Repo knowledge docs describe a deeper task hierarchy, but the live GitHub board currently uses `epic` + `feature`.
`/start-work` must use the **live board model** so the workflow is operational today.

---

## ⚠️ Tool Split

### GitHub data — GitHub MCP only

Use **only** these GitHub MCP tools:

| Operation                  | Tool                                                  |
| -------------------------- | ----------------------------------------------------- |
| List project items         | `github_projects_list(method="list_project_items")`   |
| Get project fields         | `github_projects_list(method="list_project_fields")`  |
| Read issue details         | `github_issue_read(method="get")`                     |
| Read issue labels          | `github_issue_read(method="get_labels")`              |
| Update project item status | `github_projects_write(method="update_project_item")` |

Project constants:

- Owner: `radoxtech`
- Repo: `diricode`
- Project number: `4`
- Status field ID: `267611642`
- Status option IDs:
  - `Todo` → `f75ad846`
  - `In Progress` → `47fc9ee4`
  - `Done` → `98236657`

Do **not** use `gh` CLI.

### Local git / worktree operations — bash only

Use local shell for:

- `git worktree add`
- `git worktree list`
- `git branch --list`
- `git status --porcelain`
- `git rev-parse --git-common-dir` / `--git-dir`
- `git pull origin main`

---

## Invocation Modes

### Mode A — Single Feature (default)

```
/start-work [#<feature-issue-number>]
```

Starts work on one feature. If no issue number is given, queries the project board and lets the user pick from safe candidates.

### Mode B — Epic

```
/start-work #<epic-issue-number>
```

When passed an `epic`-labeled issue:

1. Move the epic's project status to `In Progress`.
2. List all open, unblocked `feature` children of the epic.
3. Ask the user which single feature to start — then proceed exactly as Mode A from Step 4 onward.

An epic issue itself **never gets a worktree**. The epic status flip is just bookkeeping before normal feature selection.

---

## Workflow

### Step 1 — Validate location

Confirm you are in the main repo, not already inside a worktree:

```bash
COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
[ "$COMMON_DIR" != "$GIT_DIR" ] && echo "❌ Already in worktree" && exit 1
```

If uncommitted changes exist (`git status --porcelain` non-empty), stop and ask the user to stash or commit.

### Step 2 — Pull latest main

```bash
# Run git pull in main repo context
cd "$MAIN_REPO" && git pull origin main
```

### Step 3 — Detect issue type and select candidate

**If an issue number was passed:**

- Call `github_issue_read(method="get", issue_number=<N>)`.
- **If labeled `epic`** → Epic path:
  1. Update epic project item to `In Progress` via `github_projects_write`.
  2. Parse the epic body for child `#<number>` references (format: `- [ ] #N` or bare `#N`).
  3. For each child, call `github_issue_read(method="get")` — keep only issues that are `OPEN` + labeled `feature` + not labeled `status:blocked` + project status is not `In Progress`/`Done`.
  4. Display the eligible feature list and ask the user to pick one.
  5. Continue with the chosen feature from Step 4.
- **If labeled `feature`** → proceed directly to Step 4.
- **Any other label** → reject: only `feature` or `epic` issues are accepted.

**If no issue number was passed:**

1. Read `.sisyphus/notepads/current-sprint/report.json` if present and not stale (< 30 min old).
2. If absent or stale, execute `/current-sprint` logic first to rebuild it.
3. Use only issues from `safe_candidates` in the report.
4. Display the list and ask the user to choose one.

### Step 4 — Re-validate conflicts

Apply conflict refusal rules (see below) against the chosen feature before continuing.

### Step 5 — Create worktree

```bash
git worktree add "../diricode-#<issue>" -b "<type>/<slug>-#<issue>"
```

### Step 6 — Update feature project status

```typescript
github_projects_write(
  method="update_project_item",
  owner="radoxtech",
  project_number=4,
  item_id=<project-item-id>,
  updated_field={ id: 267611642, value: "47fc9ee4" }   // In Progress
)
```

### Step 7 — Output summary

Emit the required output block (see below).

---

## Feature Eligibility Rules

An issue is eligible only if:

- it has label `feature`
- it is `OPEN`
- it is **not** labeled `status:blocked`
- project status is **not** `In Progress`, `Review`, or `Done`

Reject issues labeled:

- `epic`

---

## Conflict Refusal Rules

Before creating the worktree, refuse the feature if any of these is true:

- it is in `blocked_features` in the sprint report
- project status is `Blocked`
- label `status:blocked` is present
- project status is already `In Progress` or `Review`
- it shares `conflict:*` labels with an active feature
- it shares `area:*` labels with an active feature
- it depends on an unresolved issue

If refused, show:

- the conflicting issue number(s)
- the shared `area:*` / `conflict:*` labels
- one or more safe alternatives from `safe_candidates`

---

## Branch Naming

```text
<type>/<slug>-#<issue>
```

Type comes from `type:*` labels when available. Default to `feat/` if none.

| Label                | Prefix      |
| -------------------- | ----------- |
| `type:bug`           | `fix/`      |
| `type:enhancement`   | `feat/`     |
| `type:refactor`      | `refactor/` |
| `type:documentation` | `docs/`     |
| `type:test`          | `test/`     |
| `type:chore`         | `chore/`    |
| _(default)_          | `feat/`     |

Slug: strip issue code prefix (e.g. `DC-TOOL-004: `), lowercase, hyphens, max 50 chars.

---

## Worktree Naming

```text
../diricode-#<issue>
```

---

## Required Output

```text
✅ WORKTREE CREATED

Feature:  #<N> — <title>
Epic:     #<E> — <epic title>
Why safe: <reason — unblocked, no shared area/conflict labels>
Branch:   <branch-name>
Worktree: ../diricode-#<N>

Occupied domains now active:
- area:<X>
- conflict:<Y>
```

When started via an epic, prepend:

```text
📌 Epic #<E> status → In Progress
```

### Auto-Proceed Rule

**AFTER outputting the summary, the orchestrator MUST auto-continue to implementation WITHOUT asking "should I start now?" or any similar confirmation question.**

The orchestrator should immediately delegate the implementation task to the appropriate agent. The only exceptions requiring user input are:

1. No safe candidates available (must show alternatives)
2. Conflict detected (must show conflicting labels and alternatives)
3. Epic mode with multiple children (MUST ask which feature to pick)

For all other cases — especially when a specific issue number was passed — proceed immediately to implementation.

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
2. resolve blocked features
3. add missing `area:*` / `conflict:*` labels if ambiguity is preventing safe routing

---

## Epic Mode — Worked Example

```
User: /start-work #11

→ github_issue_read #11 → labeled "epic"
→ Update #11 project status → In Progress
→ Parse body: children #90–#96
→ github_issue_read each → all OPEN, all labeled "feature"
→ Check project status: #92 already In Progress → skip
→ Present:

  📌 Epic #11 — Memory and Project State Backbone [MVP-1] → In Progress

  Eligible features:
    1. #90  DC-MEM-001 SQLite database setup       [Todo]
    2. #91  DC-MEM-002 Session storage             [Todo]
    3. #93  DC-MEM-003 Observation/timeline        [Todo]
    4. #94  DC-MEM-004 FTS5 full-text search       [Todo]
    5. #95  DC-MEM-005 Token usage tracking        [Todo]

  Skipped:
    #92  DC-MEM-003 (already In Progress)
    #96  DC-MEM-007 (depends on unresolved #90)

  Which feature do you want to start? (1–5)
```

---

## Related Commands

- `./current-sprint.md`
- `./project-health.md`
- `./finish-work.md`

---

**Version:** 3.2.0
