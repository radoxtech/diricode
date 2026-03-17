---
description: Show current sprint status with epic-aware progress rollup and propose implementation candidates
---

# /current-sprint Command

**You are executing the `/current-sprint` command.**

This command shows the current sprint situation, analyzes issues by status and priority across the epic hierarchy, and proposes 3-5 candidates for implementation based on readiness, priority, and dependencies.

---

## ⚠️ CRITICAL: Use Existing Script

**DO NOT create new scripts or inline bash blocks.**

**Use the canonical script:**

```bash
bash .sisyphus/scripts/current_sprint_persist.sh
```

**Location:** `.sisyphus/scripts/current_sprint_persist.sh`

**What it does:**
- Identifies the current active sprint from GitHub Project
- Fetches all `[Task]`-level issues in the current sprint with full metadata
- Resolves the epic chain for each task: `[Meta-Epic] → [Epic] → [Sub-Epic] → [Task]`
- Analyzes status distribution (Backlog, Todo, Ready, In Progress, Review, Blocked, Done)
- Computes priority breakdown (Critical, High, Medium, Low)
- Identifies blocked issues and their blockers
- Scores tasks for implementation readiness
- Produces `.sisyphus/notepads/current-sprint/report.json` (machine-readable)
- Generates human-readable summary with top 5 implementation candidates

**Output:** `.sisyphus/notepads/current-sprint/report.json`

---

## Overview

The current sprint analysis provides:

1. **Sprint Overview** — Current sprint dates, days remaining, 2-week cycle progress
2. **Epic Progress Rollup** — Completion percentage per Meta-Epic → Epic → Sub-Epic chain
3. **Status Breakdown** — Distribution across workflow states
4. **Priority Analysis** — Critical and high-priority tasks
5. **Blocked Issues** — Tasks that need unblocking
6. **Implementation Candidates** — Top 3-5 tasks ready to work on
7. **Recommended Next Task** — Single best candidate to start

---

## Quick Sprint Check (Use Script)

```bash
# Use the canonical script (DO NOT create new scripts)
bash .sisyphus/scripts/current_sprint_persist.sh
```

**After running, view the report:**

```bash
# View machine-readable report
cat .sisyphus/notepads/current-sprint/report.json | jq .

# View human summary
cat .sisyphus/notepads/current-sprint/summary.md
```

---

## Detailed Analysis

### 1. Get Current Sprint Information

```bash
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      field(name: "Sprint") {
        ... on ProjectV2IterationField {
          configuration {
            iterations {
              id
              title
              startDate
              duration
            }
            completedIterations {
              id
              title
              startDate
              duration
            }
          }
        }
      }
    }
  }
}'
```

**Identify current sprint:** Find the iteration where `startDate <= today < startDate + duration`

**Sprint cycle:** DiriCode uses 2-week sprints. Each sprint runs 14 days from `startDate`.

---

### 2. Get Tasks in Current Sprint

Only `[Task]`-level issues are sprint-assignable. Meta-Epics, Epics, and Sub-Epics track aggregate progress but do not live in sprint iterations directly.

```bash
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              number
              title
              state
              url
              assignees(first: 5) {
                nodes { login }
              }
              labels(first: 10) {
                nodes { name }
              }
              trackedInIssues(first: 1) {
                nodes {
                  number
                  title
                  trackedInIssues(first: 1) {
                    nodes {
                      number
                      title
                      trackedInIssues(first: 1) {
                        nodes { number title }
                      }
                    }
                  }
                }
              }
            }
          }
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue {
              title
              startDate
              duration
            }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          priority: fieldValueByName(name: "Priority") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}'
```

**Filter for current sprint:** Match `sprint.title` with the active iteration.

**Filter for tasks only:** Retain issues with label `level:task`.

---

### 3. Resolve Epic Chain for Each Task

Each `[Task]` must show its full parent chain. The `trackedInIssues` field provides the upward traversal:

```
[Task] #<task>
  └─ tracked in → [Sub-Epic] #<sub-epic>
       └─ tracked in → [Epic] #<epic>
            └─ tracked in → [Meta-Epic] #<meta-epic>
```

**Example display:**
```
[Meta-Epic] Authentication System → [Epic] User Registration → [Sub-Epic] API Endpoints → [Task] #130
```

If any level in the chain is missing, flag the task as `orphaned` — it may need re-parenting before work begins.

---

### 4. Analyze Status Distribution

```bash
# Group by status and count
cat report.json | jq '
  [.tasks[] | select(.sprint == "Sprint N")] |
  group_by(.status) |
  map({status: .[0].status, count: length})
'
```

**Workflow states for DiriCode:**

| Status | Meaning |
|--------|---------|
| Backlog | Not yet prioritized for sprint |
| Todo | Planned for sprint, not started |
| Ready | Dependencies resolved, clear to implement |
| In Progress | Actively being worked on |
| Review | PR open, awaiting code review / CI |
| Blocked | Blocked by dependency or issue |
| Done | Merged and closed |

---

### 5. Epic Progress Rollup

Compute completion percentage at each hierarchy level by checking child checkbox status in tracking issues.

```bash
# For each Epic/Sub-Epic tracking issue, count checked vs total children
gh api graphql -f query='
{
  repository(owner: "{USER}", name: "{REPO}") {
    issues(first: 50, labels: ["level:epic"]) {
      nodes {
        number
        title
        body
        state
      }
    }
  }
}'
```

Parse each tracking issue body for `## Tracking` section:
- Count `- [x] #<n>` → completed children
- Count `- [ ] #<n>` → pending children
- Completion % = `completed / (completed + pending) * 100`

**Rollup format:**
```
[Meta-Epic] #100 — 45% complete (9/20 tasks done)
  └── [Epic] #110 — 80% complete (8/10 tasks done)
  │     └── [Sub-Epic] #120 — 100% complete ✅
  │     └── [Sub-Epic] #121 — 60% complete (3/5)
  └── [Epic] #111 — 10% complete (1/10 tasks done)
```

---

### 6. Identify Blocked Tasks

```bash
# Find tasks with Blocked status or status:blocked label
cat report.json | jq '
  [.tasks[] | select(.status == "Blocked" or (.labels | contains(["status:blocked"])))] |
  map({number, title, status, labels, epicChain})
'
```

**Resolution path:** Check if the blocking issue is also in-sprint. If yes, it may be unblocked by prioritizing the blocker as the next implementation candidate.

---

### 7. Score Implementation Readiness

**Scoring rubric (0–100):**

| Factor | Weight | Criteria |
|--------|--------|----------|
| Status | 30 | Ready = 30, Todo = 20, Backlog = 10, Blocked = 0 |
| Priority | 30 | Critical = 30, High = 25, Medium = 15, Low = 5 |
| Epic chain resolved | 15 | Full chain = 15, Missing one level = 7, Orphaned = 0 |
| Dependencies | 15 | No blockers = 15, Minor deps = 7, Blocked = 0 |
| Size | 10 | Small = 10, Medium = 7, Large = 4, XL = 0 |

**Implementation candidates** = Top 5 tasks by readiness score.

**Tiebreaker:** Prefer tasks that unblock other tasks (i.e., tasks that appear as blockers in other issues).

---

## Sprint Health Scoring

Compute an overall sprint health score (0–100) at the end of the analysis:

| Metric | Weight | Formula |
|--------|--------|---------|
| Completion velocity | 30 | `done / total * 30` |
| No blocked tasks | 20 | `(1 - blocked/total) * 20` |
| In-progress ratio | 20 | Healthy = 10–30% in-progress; outside range = deducted |
| Ready queue depth | 15 | `min(ready/2, 15)` — at least 2 ready tasks = full score |
| Unassigned critical tasks | 15 | `(1 - unassigned_critical/critical) * 15` |

**Score interpretation:**
- 80–100: Healthy sprint, on track
- 60–79: Moderate risk, monitor blockers
- 40–59: At risk, intervention needed
- 0–39: Sprint in distress, escalate

---

## Expected Output

```
==========================================
   CURRENT SPRINT STATUS
   Sprint N: <Start Date> - <End Date>
   Days Remaining: X / 14
==========================================

=== SPRINT PROGRESS ===
Total Tasks:     17
Done:             3  (18%)
In Progress:      2  (12%)
Ready:            2  (12%)
Todo:            10  (59%)
Blocked:          0   (0%)

=== PRIORITY BREAKDOWN ===
Critical:  2
High:      8
Medium:    5
Low:       2

=== EPIC PROGRESS ROLLUP ===
[Meta-Epic] #100 — 45% complete (9/20 tasks)
  └── [Epic] #110 — 80% (8/10) 🟢
  │     └── [Sub-Epic] #120 — 100% ✅
  │     └── [Sub-Epic] #121 — 60% (3/5)
  └── [Epic] #111 — 10% (1/10) 🔴

=== BLOCKED TASKS ===
Count: 1
  #145 [Task] Add input validation — blocked by #140

=== SPRINT HEALTH SCORE ===
Score: 74/100 (Moderate — monitor blockers)

=== TOP IMPLEMENTATION CANDIDATES ===

🥇 #130 [Task] Implement POST /auth/register endpoint
   Epic chain: [Meta-Epic] Auth System → [Epic] User Registration → [Sub-Epic] API Endpoints
   Status: Ready | Priority: Critical | Score: 95/100
   Labels: level:task, type:enhancement, priority:critical
   Assignee: unassigned
   → RECOMMENDED: Start with this issue

🥈 #131 [Task] Add input validation and error responses
   Epic chain: [Meta-Epic] Auth System → [Epic] User Registration → [Sub-Epic] API Endpoints
   Status: Ready | Priority: High | Score: 88/100
   Labels: level:task, type:enhancement, priority:high
   Assignee: unassigned

🥉 #132 [Task] Build registration form component
   Epic chain: [Meta-Epic] Auth System → [Epic] User Registration → [Sub-Epic] UI Components
   Status: Todo | Priority: Critical | Score: 82/100
   Labels: level:task, type:enhancement, priority:critical
   Assignee: unassigned

4. #133 [Task] Add client-side validation
   Epic chain: [Meta-Epic] Auth System → [Epic] User Registration → [Sub-Epic] UI Components
   Status: Todo | Priority: High | Score: 78/100
   Labels: level:task, type:enhancement, priority:high
   Assignee: unassigned

5. #134 [Task] Write registration integration tests
   Epic chain: [Meta-Epic] Auth System → [Epic] User Registration → [Sub-Epic] API Endpoints
   Status: Todo | Priority: Medium | Score: 65/100
   Labels: level:task, type:test, priority:medium
   Assignee: unassigned

=== RECOMMENDED NEXT TASK ===

🎯 Issue #130 — [Task] Implement POST /auth/register endpoint
   Epic: Auth System → User Registration → API Endpoints
   Why: Ready status, critical priority, no blockers, unblocks downstream tasks

   To start work:
   /start-work

   Or manually:
   gh issue view 130
   git worktree add ../{REPO}-#130 -b feat/auth-register-endpoint-#130

==========================================
   END OF SPRINT REPORT
==========================================
```

---

## Project Constants Reference

Replace these placeholders throughout queries:

```bash
# Placeholders — fill in from your project setup
USER="{USER}"                   # GitHub username or org
REPO="{REPO}"                   # Repository name
PROJECT_NUMBER="{PROJECT_NUMBER}" # GitHub Project number (integer)

# Retrieve project ID and field IDs
gh api graphql -f query='
{
  user(login: "'"$USER"'") {
    projectV2(number: '"$PROJECT_NUMBER"') {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2FieldCommon { id name }
          ... on ProjectV2SingleSelectField {
            id name
            options { id name }
          }
          ... on ProjectV2IterationField {
            id name
            configuration {
              iterations { id title startDate }
            }
          }
        }
      }
    }
  }
}'
```

**Save the output** to `.sisyphus/notepads/current-sprint/project-fields.json` for reuse in mutations.

---

## Starting Work on Recommended Task

### Option 1: Use /start-work Command (Recommended)

```
/start-work
```

The `/start-work` command will:
- Validate you are in the main repo (not a worktree)
- Show the top-priority `[Task]` from the current sprint
- Display full epic chain context
- Create an isolated worktree
- Move the issue to "In Progress" via GraphQL mutation

### Option 2: Manual Start

```bash
# View the task
gh issue view <number>

# Create worktree (adjust branch prefix by type label)
git worktree add ../{REPO}-#<number> -b feat/<description>-#<number>

# Move to In Progress via GraphQL
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "<PROJECT_ID>"
    itemId: "<ITEM_ID>"
    fieldId: "<STATUS_FIELD_ID>"
    value: { singleSelectOptionId: "<IN_PROGRESS_OPTION_ID>" }
  }) { projectV2Item { id } }
}'
```

**Branch prefix by `type:*` label:**

| Label | Branch prefix |
|-------|--------------|
| `type:bug` | `fix/` |
| `type:enhancement` | `feat/` |
| `type:refactor` | `refactor/` |
| `type:documentation` | `docs/` |
| `type:test` | `test/` |
| `type:chore` | `chore/` |
| _(no type label)_ | `feat/` |

---

## Related Commands

- **[gh-workflow.md](./gh-workflow.md)** — Complete GitHub CLI workflow reference
- **[start-work.md](./start-work.md)** — Start working on a task (worktree-based)
- **[project-health.md](./project-health.md)** — Comprehensive project health check
- **[create-issue.md](./create-issue.md)** — Create a new issue and add to sprint

---

## Troubleshooting

### No Current Sprint Found

If the script cannot identify an active sprint:

```bash
# List all sprint iterations
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      field(name: "Sprint") {
        ... on ProjectV2IterationField {
          configuration {
            iterations { id title startDate duration }
            completedIterations { id title startDate duration }
          }
        }
      }
    }
  }
}'
```

Check that today's date falls within `startDate` + 14 days of an active iteration. If not, a new sprint iteration may need to be created in the GitHub Project settings.

### Empty Sprint

If the current sprint has no tasks:

```bash
# Check if tasks are assigned to the wrong sprint iteration
# Run project-health to audit sprint assignments
/project-health
```

### Orphaned Tasks (Missing Epic Chain)

If tasks are missing parent references:

```bash
# Find tasks without a Sub-Epic parent
gh issue list \
  --repo "{USER}/{REPO}" \
  --label "level:task" \
  --json number,title,trackedInIssues \
  --jq '.[] | select(.trackedInIssues | length == 0) | {number, title}'
```

Orphaned tasks must be added to a Sub-Epic tracking issue before work begins. Use the `## Tracking` checkbox pattern in the parent issue body.

### Rate Limiting

```bash
# Check current rate limit status
gh api rate_limit

# If limited, use cached report while waiting for reset
cat .sisyphus/notepads/current-sprint/report.json | jq .
cat .sisyphus/notepads/current-sprint/summary.md
```

---

**Version:** 1.0.0
