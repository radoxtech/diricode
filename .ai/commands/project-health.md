---
description: Run GitHub Project health check - sprint status, epic hygiene, issue quality, velocity metrics
---

# Project Health Check

**You are executing the `/project-health` command.**

This command performs a comprehensive health check of the GitHub Project, identifying issues with sprint assignments, epic hierarchy integrity, missing fields, stale items, and overall project hygiene. It produces an actionable health report with a scored grade (A–D).

---

## ⚠️ CRITICAL: Use Existing Script

**DO NOT create new scripts or inline bash blocks.**

**Use the canonical script:**

```bash
bash .sisyphus/scripts/project_health_persist.sh
```

**Location:** `.sisyphus/scripts/project_health_persist.sh`

**What it does:**
- Fully paginates ProjectV2.items (100 items per page) until `hasNextPage == false`
- Computes health score and grade (A–D) based on project hygiene metrics
- Audits epic hierarchy integrity (orphaned tasks, broken epic chains)
- Detects stale issues (In Progress >7d, Ready >3d)
- Checks velocity trend (issues closed per sprint)
- Produces `.sisyphus/notepads/project-health/report.json` (machine-readable)
- Appends human summary to `.sisyphus/notepads/project-health/issues.md`

**Output:** `.sisyphus/notepads/project-health/report.json`

---

## Overview

The health check audits seven dimensions:

1. **Sprint Coverage** — All open issues assigned to a sprint
2. **Project Coverage** — All repo issues tracked in the project
3. **Epic Hierarchy Integrity** — Tasks link to Sub-Epics; Sub-Epics link to Epics; Epics link to Meta-Epics
4. **Status Distribution** — Breakdown by sprint and workflow state
5. **Label Completeness** — `type:`, `priority:`, `epic:`, `layer:` labels present
6. **Stale Issues** — Items stuck in states too long
7. **Title Numbering Compliance** — Issue titles follow `M.E.S.T: [Type] Title` format

---

## Quick Health Check (Use Script)

```bash
bash .sisyphus/scripts/project_health_persist.sh
```

**View the results:**

```bash
# Machine-readable JSON report
cat .sisyphus/notepads/project-health/report.json | jq .

# Human-readable summary
tail -60 .sisyphus/notepads/project-health/issues.md
```

---

## Detailed Checks

### 1. Issues Not in Project

Find issues that exist in the repo but aren't tracked in the project:

```bash
# Get all open issue numbers from repo
gh issue list \
  --repo {USER}/{REPO} \
  --state open --limit 500 \
  --json number --jq '.[].number' | sort -n > /tmp/repo_issues.txt

# Get open issue numbers from project (paginated)
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue { number state }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}' | jq -r '.data.user.projectV2.items.nodes[]
  | select(.content.state == "OPEN")
  | .content.number' | sort -n > /tmp/project_issues.txt

# Show issues missing from project
comm -23 /tmp/repo_issues.txt /tmp/project_issues.txt
```

**Fix — add missing issues to project:**

```bash
gh project item-add {PROJECT_NUMBER} \
  --owner {USER} \
  --url https://github.com/{USER}/{REPO}/issues/<NUMBER>
```

---

### 2. Issues Without Sprint Assignment

```bash
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue { number title state }
          }
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue { title }
          }
        }
      }
    }
  }
}' | jq '[
  .data.user.projectV2.items.nodes[]
  | select(.content.state == "OPEN" and .sprint.title == null)
  | {number: .content.number, title: .content.title}
]'
```

**Fix — assign sprint:**

```bash
ITEM_ID="<PVTI_...>"
SPRINT_ITERATION_ID="<iteration-id>"

gh api graphql -f query="
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: \"<PROJECT_ID>\"
      itemId: \"$ITEM_ID\"
      fieldId: \"<SPRINT_FIELD_ID>\"
      value: { iterationId: \"$SPRINT_ITERATION_ID\" }
    }) { projectV2Item { id } }
  }
"
```

---

### 3. Epic Hierarchy Integrity

DiriCode uses a four-level hierarchy: **Meta-Epic → Epic → Sub-Epic → Task**

Each level must have a parent link. Orphaned issues at any level break traceability and rollup reporting.

#### 3a. Tasks Without a Sub-Epic Parent

```bash
gh issue list \
  --repo {USER}/{REPO} \
  --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(
    (.labels | map(.name) | any(startswith("type:task")))
    and (.labels | map(.name) | any(startswith("epic:")) | not)
  ) | {number, title}'
```

**Expected:** Zero orphaned tasks. Any result requires adding the `epic:<slug>` label and a parent link in the issue body.

#### 3b. Sub-Epics Without an Epic Parent

```bash
gh issue list \
  --repo {USER}/{REPO} \
  --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(
    (.labels | map(.name) | any(. == "type:sub-epic"))
    and (.labels | map(.name) | any(startswith("epic:")) | not)
  ) | {number, title}'
```

#### 3c. Epics Without a Meta-Epic Parent

```bash
gh issue list \
  --repo {USER}/{REPO} \
  --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(
    (.labels | map(.name) | any(. == "type:epic"))
    and (.labels | map(.name) | any(startswith("meta-epic:")) | not)
  ) | {number, title}'
```

#### 3d. Epic Completion Cascade Check

An epic should be automatically closeable when all its child issues are closed. Find epics where all children are Done but the epic remains open:

```bash
# List open epics
gh issue list \
  --repo {USER}/{REPO} \
  --state open --limit 200 \
  --label "type:epic" \
  --json number,title

# For each open epic, check if any open children exist
# (Run for specific epic numbers)
gh issue list \
  --repo {USER}/{REPO} \
  --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(.name) | any(. == "epic:<slug>")) | {number, title}'
```

**Actionable:** Close epics whose all children are Done. Update status to `Done` in project.

---

### 4. Sprint Status Distribution

```bash
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      items(first: 100) {
        nodes {
          content { ... on Issue { number state } }
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue { title }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
      }
    }
  }
}' | jq '
  [.data.user.projectV2.items.nodes[] | select(.content.state == "OPEN")]
  | group_by(.sprint.title // "No Sprint")
  | map({
      sprint: .[0].sprint.title // "No Sprint",
      total: length,
      by_status: (group_by(.status.name) | map({status: .[0].status.name, count: length}))
    })
'
```

---

### 5. Label Completeness

DiriCode requires four label categories per issue:

| Category | Prefix | Example |
|----------|--------|---------|
| Type | `type:` | `type:task`, `type:epic`, `type:bug` |
| Priority | `priority:` | `priority:high`, `priority:critical` |
| Epic | `epic:` | `epic:ai-core`, `epic:auth` |
| Layer | `layer:` | `layer:backend`, `layer:frontend`, `layer:infra` |

```bash
# Missing type: label
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(.name) | any(startswith("type:")) | not) | {number, title}'

# Missing priority: label
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(.name) | any(startswith("priority:")) | not) | {number, title}'

# Missing epic: label (tasks and sub-epics only)
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(
    (.labels | map(.name) | any(. == "type:task" or . == "type:sub-epic"))
    and (.labels | map(.name) | any(startswith("epic:")) | not)
  ) | {number, title}'

# Missing layer: label
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,title,labels \
  --jq '.[] | select(.labels | map(.name) | any(startswith("layer:")) | not) | {number, title}'
```

---

### 6. Title Numbering Compliance

DiriCode issue titles follow hierarchical numbering: `M.E.S.T: [Type] Description`

- **Meta-Epic:** `M: [Meta-Epic] Title` (e.g., `1: [Meta-Epic] Core Platform`)
- **Epic:** `M.E: [Epic] Title` (e.g., `1.2: [Epic] Authentication`)
- **Sub-Epic:** `M.E.S: [Sub-Epic] Title` (e.g., `1.2.3: [Sub-Epic] OAuth Flow`)
- **Task:** `M.E.S.T: [Task] Title` (e.g., `1.2.3.4: [Task] Implement token refresh`)

```bash
# Issues not matching hierarchical numbering pattern
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,title \
  --jq '.[] | select(.title | test("^[0-9]+(\\.[0-9]+)*: \\[") | not) | {number, title}'
```

---

### 7. Stale Issues

```bash
# Issues In Progress for more than 7 days
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,title,labels,updatedAt \
  --jq --arg cutoff "$(date -v-7d -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  '.[] | select(
    (.labels | map(.name) | any(. == "status:in-progress"))
    and .updatedAt < $cutoff
  ) | {number, title, updatedAt}'

# Issues Ready for more than 3 days (never picked up)
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,title,labels,updatedAt \
  --jq --arg cutoff "$(date -v-3d -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '3 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  '.[] | select(
    (.labels | map(.name) | any(. == "status:ready"))
    and .updatedAt < $cutoff
  ) | {number, title, updatedAt}'
```

---

### 8. Sprint Iteration Details

```bash
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      field(name: "Sprint") {
        ... on ProjectV2IterationField {
          configuration {
            iterations {
              id title startDate duration
            }
            completedIterations {
              id title startDate duration
            }
          }
        }
      }
    }
  }
}'
```

---

### 9. Velocity Trend

Measure issues closed per sprint to track team velocity:

```bash
# Issues closed per sprint (uses updatedAt as proxy; adjust for your sprint dates)
for sprint_label in "sprint:1" "sprint:2" "sprint:3"; do
  count=$(gh issue list \
    --repo {USER}/{REPO} \
    --state closed --limit 500 \
    --label "$sprint_label" \
    --json number --jq 'length')
  echo "$sprint_label: $count closed"
done
```

**Healthy velocity trend:** Closed count is stable or increasing sprint-over-sprint.

**Warning signals:**
- Velocity declining >20% sprint-over-sprint
- Zero issues closed in a sprint
- Closed count < planned count by >30%

---

### 10. PR Review Time (AI-Driven Quality Metric)

For AI-assisted development, PR review time indicates AI output quality:

```bash
# List recent merged PRs with merge time
gh pr list \
  --repo {USER}/{REPO} \
  --state merged --limit 50 \
  --json number,title,createdAt,mergedAt \
  --jq '.[] | {
    number,
    title,
    review_hours: (
      ((.mergedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)) / 3600
      | floor
    )
  }' | jq -s 'sort_by(.review_hours)'
```

**Healthy baseline:** Median PR review time < 4 hours for AI-generated PRs.

**Warning signals:**
- PRs open > 24 hours without review comment
- Multiple review cycles on AI-generated code (indicates prompt quality issues)
- PRs closed without merge (AI output rejection rate)

---

## Expected Output

```
==========================================
   DIRICODE PROJECT HEALTH CHECK
   {date}
==========================================

=== 1. ISSUE COUNTS ===
Open:   {n}
Closed: {n}
Total:  {n}

=== 2. PROJECT COVERAGE ===
Issues in Repo:      {n}
Issues in Project:   {n}
NOT in Project:      {n}

=== 3. SPRINT DISTRIBUTION ===
Sprint 1: {n}
Sprint 2: {n}
...
No Sprint: {n}

=== 4. STATUS BY SPRINT ===
Sprint N:
  Ready:       {n}
  Todo:        {n}
  In Progress: {n}
  Review:      {n}
  Blocked:     {n}
  Done:        {n}

=== 5. EPIC HIERARCHY INTEGRITY ===
Orphaned Tasks (no Sub-Epic):   {n}
Orphaned Sub-Epics (no Epic):   {n}
Orphaned Epics (no Meta-Epic):  {n}
Completable Epics (all done):   {n}

=== 6. LABEL COVERAGE ===
Missing type:     {n}
Missing priority: {n}
Missing epic:     {n}
Missing layer:    {n}

=== 7. TITLE FORMAT VIOLATIONS ===
Non-conforming titles: {n}

=== 8. STALE ISSUES ===
In Progress >7d: {n}
Ready >3d:       {n}

=== 9. VELOCITY TREND ===
Sprint N-2: {n} closed
Sprint N-1: {n} closed
Sprint N:   {n} closed
Trend: ↑ Improving | → Stable | ↓ Declining

=== 10. HEALTH SCORE ===

HEALTH SCORE: {score}/100 ({grade})

==========================================
   HEALTH CHECK COMPLETE
==========================================
```

---

## Health Score Calculation

| Criteria                          | Deduction   | Max |
|-----------------------------------|-------------|-----|
| Issues not in project             | 2 per issue | -20 |
| Issues without sprint             | 2 per issue | -20 |
| Orphaned tasks (no parent epic)   | 3 per issue | -15 |
| Missing required labels           | 1 per issue | -15 |
| Non-conforming title format       | 1 per issue | -10 |
| Stale In Progress (>7d)           | 5 per issue | -10 |
| Stale Ready (>3d)                 | 3 per issue | -10 |

**Grades:**

| Score | Grade | Status |
|-------|-------|--------|
| 90–100 | A | Excellent — healthy project |
| 80–89 | B | Good — minor hygiene issues |
| 70–79 | C | Needs Attention — address this sprint |
| < 70 | D | Critical — immediate cleanup required |

---

## Actionable Recommendations

### For Each Health Issue Found

| Finding | Action |
|---------|--------|
| Issues not in project | Run `gh project item-add` for each missing issue |
| No sprint assigned | Assign sprint in project board or via GraphQL mutation |
| Orphaned task | Add `epic:<slug>` label; add parent reference in issue body |
| Orphaned sub-epic | Add `epic:<slug>` label; link to parent epic |
| Orphaned epic | Add `meta-epic:<slug>` label; link to parent meta-epic |
| Completable epic | Close the epic issue; update project status to Done |
| Missing label | Add labels via `gh issue edit <number> --add-label "<label>"` |
| Non-conforming title | Rename via `gh issue edit <number> --title "M.E.S.T: [Type] Title"` |
| Stale In Progress | Comment on issue; reassign or move back to Ready |
| Stale Ready | Move to top of sprint; assign to available team member |
| Declining velocity | Review sprint capacity; check for untracked blockers |

---

## Automated Fixes

### Add All Missing Issues to Project

```bash
for issue in $(comm -23 /tmp/repo_issues.txt /tmp/project_issues.txt); do
  echo "Adding #$issue to project..."
  gh project item-add {PROJECT_NUMBER} \
    --owner {USER} \
    --url "https://github.com/{USER}/{REPO}/issues/$issue"
done
```

### Bulk Label Missing Issues

```bash
# Add type:task label to all issues missing a type: label
gh issue list --repo {USER}/{REPO} --state open --limit 500 \
  --json number,labels \
  --jq '.[] | select(.labels | map(.name) | any(startswith("type:")) | not) | .number' \
| while read num; do
    echo "Labeling #$num..."
    gh issue edit "$num" --repo {USER}/{REPO} --add-label "type:task"
  done
```

### Close Completable Epics

```bash
# After confirming all children are closed
gh issue close <EPIC_NUMBER> \
  --repo {USER}/{REPO} \
  --comment "All child issues resolved. Epic complete."
```

---

## Related Commands

- **[current-sprint.md](./current-sprint.md)** — Current sprint status and implementation candidates
- **[start-work.md](./start-work.md)** — Start working on an issue (worktree-based)
- **[finish-work.md](./finish-work.md)** — Complete work and open a PR
- **[gh-workflow.md](./gh-workflow.md)** — Complete GitHub CLI workflow reference

---

## Troubleshooting

### GraphQL Rate Limiting

```bash
# Check current rate limit
gh api rate_limit

# Use pagination cursors for large projects
# Pass afterCursor in subsequent queries
```

### Stale Data

```bash
# Clear gh CLI cache if data seems outdated
gh cache delete --all
```

### Permission Issues

```bash
# Verify authentication
gh auth status

# Re-authenticate with project scope if needed
gh auth login --scopes "project"
```

### Date Commands (Cross-Platform)

```bash
# macOS
date -v-7d -u +%Y-%m-%dT%H:%M:%SZ

# Linux
date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ
```

---

**Last Updated:** 2026-03-17
**Version:** 1.0.0
**Project:** DiriCode (Project #{PROJECT_NUMBER})
