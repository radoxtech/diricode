# GitHub Workflow Reference

**Version:** 1.0.0  
**Status:** Active  
**Last Updated:** 2026-03-17

Comprehensive Git + GitHub CLI reference for DiriCode development. Copy-paste ready commands with placeholders.

> **Cross-references:**
> - Starting work on an issue → `start-work.md`
> - Finishing work / closing issues → `finish-work.md`
> - Epic breakdown and hierarchy → `epic-hierarchy.md`
> - Label setup → `labels-and-setup.md`

---

## Table of Contents

1. [Branch Naming](#branch-naming)
2. [Commit Format](#commit-format)
3. [PR Workflow](#pr-workflow)
4. [Issue Management](#issue-management)
5. [GitHub CLI Quick Reference](#github-cli-quick-reference)
6. [GraphQL Queries](#graphql-queries)
7. [Epic-Specific Operations](#epic-specific-operations)

---

## Branch Naming

### Pattern

```
<type>/<description>-#<issue>
```

### Type Mapping

| Type | Label | Use When |
|------|-------|----------|
| `feat` | `type:enhancement` | New feature or capability |
| `fix` | `type:bug` | Bug fix or defect |
| `refactor` | `type:refactor` | Code restructure, no behavior change |
| `docs` | `type:documentation` | Documentation only |
| `test` | `type:test` | Tests added or improved |
| `chore` | `type:chore` | Tooling, deps, maintenance |
| `feat` | _(default)_ | No type label assigned |

### Rules

- Description: lowercase, hyphens only, max 40 chars
- Issue number is **mandatory** — always suffix with `-#<N>`
- Must branch from `main` (or specified base)
- One issue per branch

### Examples

```bash
# Feature branch
git checkout -b feat/add-dispatcher-routing-#42

# Bug fix
git checkout -b fix/tool-timeout-crash-#87

# Refactor
git checkout -b refactor/memory-store-interface-#103

# Documentation
git checkout -b docs/update-api-reference-#55

# Test
git checkout -b test/dispatcher-unit-coverage-#91

# Chore
git checkout -b chore/update-typescript-deps-#12
```

### DiriCode Scope Values

Used in commit messages and branch names when targeting a specific module:

| Scope | Module |
|-------|--------|
| `core` | Core engine, orchestration |
| `server` | HTTP / SSE server layer |
| `providers` | LLM provider adapters |
| `memory` | Memory and context management |
| `tools` | Tool registry and execution |
| `dispatcher` | Dispatcher / router agent |
| `web` | Web UI (Vite + React) |

---

## Commit Format

### Pattern

```
type(scope): description - fixes #N
```

### Rules

- `type`: lowercase, from the list below
- `scope`: optional, lowercase module name (see DiriCode scopes above)
- `description`: imperative mood, lowercase, no period, ≤ 72 chars total
- Issue reference: `fixes #N` closes issue on merge; `refs #N` links without closing
- Use `fixes` for task-level issues; `refs` for sub-epic/epic progress notes

### Commit Types

| Type | When to Use |
|------|-------------|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `refactor` | Internal restructure, no behavior change |
| `docs` | Documentation changes |
| `test` | Adding or updating tests |
| `chore` | Tooling, scripts, dependencies |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace (non-functional) |
| `ci` | CI/CD configuration changes |
| `revert` | Reverts a previous commit |

### Examples

```bash
# Feature with scope
git commit -m "feat(dispatcher): add round-robin provider selection - fixes #42"

# Bug fix
git commit -m "fix(memory): prevent context overflow on long sessions - fixes #87"

# Refactor without closing issue
git commit -m "refactor(providers): extract base adapter class - refs #103"

# Docs
git commit -m "docs(tools): add JSDoc to all public tool functions - fixes #55"

# Chore
git commit -m "chore: update typescript to 5.4 - fixes #12"

# Multi-issue reference (use refs for non-closing)
git commit -m "feat(server): add SSE reconnection handling - fixes #71, refs #68"
```

---

## PR Workflow

### Create PR

```bash
# Standard PR (draft)
gh pr create \
  --title "feat(dispatcher): add round-robin provider selection - fixes #42" \
  --body "$(cat <<'EOF'
## Summary

- Implements round-robin selection across configured providers
- Adds fallback to first available on connection error
- Closes #42

## Changes

- `src/dispatcher/router.ts` — new `RoundRobinRouter` class
- `src/dispatcher/index.ts` — wire up router to dispatch handler
- `tests/dispatcher/router.test.ts` — unit tests for routing logic

## Testing

- [ ] Unit tests pass (`npm test`)
- [ ] Manual test: `curl -X POST /v1/dispatch` with mock providers

## Checklist

- [ ] Self-reviewed diff
- [ ] No secrets or credentials committed
- [ ] Issue linked in title (`fixes #N`)
- [ ] Branch up to date with `main`
EOF
)" \
  --draft

# Promote draft to ready
gh pr ready

# Or create ready-for-review directly
gh pr create --title "..." --body "..." --assignee "@me"
```

### Review Checklist

Before marking a PR ready for review, verify:

- [ ] Branch: `<type>/<description>-#<N>` naming followed
- [ ] Commits: each references issue number
- [ ] Title: matches `type(scope): description - fixes #N`
- [ ] Body: summary, changed files, testing instructions present
- [ ] Self-review of diff completed
- [ ] No debug logs, commented-out code, or TODOs left
- [ ] No secrets, credentials, or `.env` content
- [ ] Tests pass locally
- [ ] Branch rebased on latest `main`

### Squash-Merge (Human gate — AI cannot merge)

```bash
# Squash merge via CLI (human only)
gh pr merge <PR_NUMBER> \
  --squash \
  --subject "feat(dispatcher): add round-robin provider selection - fixes #42" \
  --delete-branch

# Verify issue auto-closed
gh issue view 42
```

### PR Status Commands

```bash
# List open PRs
gh pr list

# View PR details
gh pr view <PR_NUMBER>

# Check PR checks/CI status
gh pr checks <PR_NUMBER>

# View PR diff
gh pr diff <PR_NUMBER>

# Request review
gh pr edit <PR_NUMBER> --add-reviewer <USERNAME>

# Add label
gh pr edit <PR_NUMBER> --add-label "status:needs-review"
```

---

## Issue Management

### Create Issue

```bash
# Task issue (most common)
gh issue create \
  --title "[Task] Implement POST /api/dispatch endpoint" \
  --label "level:task,type:enhancement,priority:high" \
  --body "$(cat <<'EOF'
## Description

Implement the primary dispatch endpoint that routes requests to configured LLM providers.

## Acceptance Criteria

- [ ] `POST /api/dispatch` accepts `{ model, messages, stream }` payload
- [ ] Returns SSE stream when `stream: true`
- [ ] Returns JSON when `stream: false`
- [ ] Error response follows standard error schema
- [ ] Unit tests cover happy path and error cases

## Parent

Part of #<SUB_EPIC_NUMBER>
EOF
)"

# Epic issue
gh issue create \
  --title "[Epic] Dispatcher Agent Core" \
  --label "level:epic,lifecycle:draft" \
  --body "$(cat <<'EOF'
## Overview

Core dispatcher agent responsible for routing user requests to appropriate LLM providers.

## Tracking

- [ ] #<SUB_EPIC_NUMBER>

## Acceptance Criteria

- All sub-epics completed
- End-to-end dispatch flow working
- Load tested at 100 RPS
EOF
)"
```

### Label Operations

```bash
# Add labels
gh issue edit <ISSUE_NUMBER> --add-label "priority:high,sprint:current"

# Remove label
gh issue edit <ISSUE_NUMBER> --remove-label "sprint:backlog"

# Replace labels entirely
gh issue edit <ISSUE_NUMBER> --label "level:task,type:bug,priority:critical"
```

### Assign & Milestone

```bash
# Assign to self
gh issue edit <ISSUE_NUMBER> --assignee "@me"

# Assign to specific user
gh issue edit <ISSUE_NUMBER> --assignee <USERNAME>

# Set milestone
gh issue edit <ISSUE_NUMBER> --milestone "Sprint 4"

# Remove assignee
gh issue edit <ISSUE_NUMBER> --assignee ""
```

### Link Issues to Epics (Tracking Body Update)

```bash
# Add child to epic tracking list (edit issue body)
gh issue edit <EPIC_NUMBER> --body "$(gh issue view <EPIC_NUMBER> --json body --jq .body)
- [ ] #<CHILD_ISSUE_NUMBER>"

# Or create with parent reference in body
gh issue create \
  --title "[Task] ..." \
  --body "Part of #<PARENT_ISSUE_NUMBER>

..."
```

### Close Issue

```bash
# Close with reason
gh issue close <ISSUE_NUMBER> --comment "Completed via PR #<PR_NUMBER>"

# Close as not-planned
gh issue close <ISSUE_NUMBER> --reason "not planned"

# Reopen
gh issue reopen <ISSUE_NUMBER>
```

### Search & Filter Issues

```bash
# List open tasks in current sprint
gh issue list \
  --label "level:task" \
  --state open

# List blocked issues
gh issue list --label "status:blocked"

# List issues assigned to me
gh issue list --assignee "@me" --state open

# Search by text
gh issue list --search "dispatcher" --state open

# View issue
gh issue view <ISSUE_NUMBER>

# View with comments
gh issue view <ISSUE_NUMBER> --comments
```

### Add Comment to Issue

```bash
# Status update comment
gh issue comment <ISSUE_NUMBER> \
  --body "Progress: implemented core routing logic, tests pending. ETA: today."

# Block notification
gh issue comment <ISSUE_NUMBER> \
  --body "⚠️ BLOCKED: waiting on #<BLOCKING_ISSUE_NUMBER> to resolve provider interface."
```

---

## GitHub CLI Quick Reference

### Authentication

```bash
# Check auth status
gh auth status

# Login
gh auth login

# Switch account
gh auth switch
```

### Repository

```bash
# View repo info
gh repo view

# Clone repo
gh repo clone {USER}/{REPO}

# Open in browser
gh repo view --web
```

### Branches

```bash
# List branches
git branch -a

# Create and switch
git checkout -b feat/my-feature-#42

# Delete local branch (after merge)
git branch -d feat/my-feature-#42

# Delete remote branch
git push origin --delete feat/my-feature-#42

# Update branch from main
git fetch origin && git rebase origin/main
```

### Labels

```bash
# List all labels
gh label list

# Create label
gh label create "type:enhancement" --color "0075CA" --description "New feature"

# Edit label
gh label edit "type:enhancement" --description "Updated description"

# Delete label
gh label delete "type:enhancement" --yes
```

### Milestones

```bash
# List milestones
gh api repos/{USER}/{REPO}/milestones --jq '.[].title'

# Create milestone
gh api repos/{USER}/{REPO}/milestones \
  -f title="Sprint 5" \
  -f description="Mar 22 - Apr 4" \
  -f due_on="2026-04-04T23:59:59Z" \
  --method POST
```

---

## GraphQL Queries

Replace placeholders: `$owner` = GitHub username/org, `$repo` = repository name, `$projectNumber` = project number.

### Get Project ID

```bash
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectsV2(first: 10) {
      nodes {
        number
        id
        title
      }
    }
  }
}
' --jq '.data.user.projectsV2.nodes[] | {number, id, title}'
```

### Query Project Items (with Status + Sprint)

```graphql
{
  user(login: $owner) {
    projectV2(number: $projectNumber) {
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              state
              labels(first: 10) {
                nodes { name }
              }
            }
          }
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          sprint: fieldValueByName(name: "Sprint") {
            ... on ProjectV2ItemFieldIterationValue {
              title
              startDate
              duration
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
}
```

```bash
# Execute via CLI
gh api graphql -f query='<QUERY_ABOVE>' \
  -F owner="{USER}" \
  -F projectNumber={PROJECT_NUMBER}
```

### Query Issue Tracked Children (Direct Children)

```graphql
{
  repository(owner: $owner, name: $repo) {
    issue(number: $issueNumber) {
      number
      title
      state
      trackedIssues(first: 50) {
        nodes {
          number
          title
          state
          labels(first: 5) {
            nodes { name }
          }
        }
        totalCount
      }
      trackedIssuesCount
      closedTrackedIssuesCount
    }
  }
}
```

```bash
gh api graphql -f query='<QUERY_ABOVE>' \
  -f owner="{USER}" \
  -f repo="{REPO}" \
  -F issueNumber=<EPIC_NUMBER>
```

### Query Issues by Hierarchy Level

```graphql
{
  repository(owner: $owner, name: $repo) {
    issues(
      first: 50
      labels: ["level:epic"]
      states: [OPEN]
      orderBy: { field: CREATED_AT, direction: DESC }
    ) {
      nodes {
        number
        title
        state
        labels(first: 10) {
          nodes { name }
        }
        trackedIssuesCount
        closedTrackedIssuesCount
      }
    }
  }
}
```

```bash
# List all open epics
gh api graphql -f query='<QUERY_ABOVE>' \
  -f owner="{USER}" \
  -f repo="{REPO}" \
  --jq '.data.repository.issues.nodes[] | {number, title, trackedIssuesCount, closedTrackedIssuesCount}'
```

### Query Full Epic Hierarchy (2 Levels Deep)

```graphql
{
  repository(owner: $owner, name: $repo) {
    issue(number: $metaEpicNumber) {
      number
      title
      state
      labels(first: 10) {
        nodes { name }
      }
      trackedIssues(first: 20) {
        nodes {
          number
          title
          state
          labels(first: 10) {
            nodes { name }
          }
          trackedIssues(first: 30) {
            nodes {
              number
              title
              state
              labels(first: 10) {
                nodes { name }
              }
            }
          }
        }
      }
    }
  }
}
```

### Detect Orphan Tasks (No Parent)

```graphql
{
  repository(owner: $owner, name: $repo) {
    issues(first: 100, labels: ["level:task"], states: [OPEN]) {
      nodes {
        number
        title
        trackedBy {
          nodes { number title }
          totalCount
        }
      }
    }
  }
}
```

```bash
# Filter to orphans only
gh api graphql -f query='<QUERY_ABOVE>' \
  -f owner="{USER}" \
  -f repo="{REPO}" \
  --jq '.data.repository.issues.nodes[] | select(.trackedBy.totalCount == 0) | {number, title}'
```

### Update Project Item Status

```bash
# Get field IDs first
gh api graphql -f query='
{
  user(login: "{USER}") {
    projectV2(number: {PROJECT_NUMBER}) {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
          ... on ProjectV2IterationField {
            id
            name
            configuration { iterations { id title startDate } }
          }
        }
      }
    }
  }
}'

# Update status
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }
  ) {
    projectV2Item { id }
  }
}' \
  -f projectId="{PROJECT_ID}" \
  -f itemId="{ITEM_ID}" \
  -f fieldId="{STATUS_FIELD_ID}" \
  -f optionId="{OPTION_ID}"
```

### Add Issue to Project

```bash
gh api graphql -f query='
mutation($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {
    projectId: $projectId
    contentId: $contentId
  }) {
    item { id }
  }
}' \
  -f projectId="{PROJECT_ID}" \
  -f contentId="{ISSUE_NODE_ID}"
```

---

## Epic-Specific Operations

### Create Tracking Issue (Epic / Sub-Epic / Meta-Epic)

```bash
# Create Sub-Epic with tracking body
gh issue create \
  --title "[Sub-Epic] <Component description>" \
  --label "level:sub-epic,lifecycle:draft" \
  --body "$(cat <<'EOF'
## Overview

<What this component does and why it exists>

## Tracking

- [ ] #<TASK_NUMBER>

## Acceptance Criteria

- All tasks completed
- <Specific criteria>

## Parent

Part of #<PARENT_EPIC_NUMBER>
EOF
)"
```

### Link Child Issue to Parent Tracking

After creating a child issue, add it to the parent's tracking list:

```bash
# Get current parent body, append child reference
PARENT_BODY=$(gh issue view <PARENT_NUMBER> --json body --jq .body)
NEW_CHILD="- [ ] #<CHILD_NUMBER>"

gh issue edit <PARENT_NUMBER> \
  --body "$(printf '%s\n%s' "$PARENT_BODY" "$NEW_CHILD")"
```

### Check Epic Progress

```bash
# Quick progress check via CLI
gh api graphql -f query='
{
  repository(owner: "{USER}", name: "{REPO}") {
    issue(number: <EPIC_NUMBER>) {
      title
      trackedIssuesCount
      closedTrackedIssuesCount
    }
  }
}' --jq '.data.repository.issue | {
  title,
  open: (.trackedIssuesCount - .closedTrackedIssuesCount),
  closed: .closedTrackedIssuesCount,
  total: .trackedIssuesCount,
  progress: (if .trackedIssuesCount > 0 then (.closedTrackedIssuesCount / .trackedIssuesCount * 100 | round | tostring) + "%" else "0%" end)
}'
```

### Transition Epic Lifecycle

```bash
# Draft → Active (when sprint begins)
gh issue edit <EPIC_NUMBER> \
  --remove-label "lifecycle:draft" \
  --add-label "lifecycle:active"

# Active → Completed (after all children closed)
gh issue edit <EPIC_NUMBER> \
  --remove-label "lifecycle:active" \
  --add-label "lifecycle:completed"

# Archive at quarter-end
gh issue edit <EPIC_NUMBER> \
  --remove-label "lifecycle:completed" \
  --add-label "lifecycle:archived"
```

### List All Active Epics with Progress

```bash
gh api graphql -f query='
{
  repository(owner: "{USER}", name: "{REPO}") {
    issues(first: 50, labels: ["level:epic", "lifecycle:active"], states: [OPEN]) {
      nodes {
        number
        title
        trackedIssuesCount
        closedTrackedIssuesCount
      }
    }
  }
}' --jq '.data.repository.issues.nodes[] | 
  . + { progress: (if .trackedIssuesCount > 0 then (.closedTrackedIssuesCount / .trackedIssuesCount * 100 | round | tostring) + "%" else "n/a" end) } |
  "\(.number) \(.progress) \(.title)"'
```

### Sprint Rollover Mutation

```bash
# Update sprint field on a project item (move to next sprint)
gh api graphql -f query='
mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { iterationId: $iterationId }
    }
  ) {
    projectV2Item { id }
  }
}' \
  -f projectId="{PROJECT_ID}" \
  -f itemId="{ITEM_ID}" \
  -f fieldId="{SPRINT_FIELD_ID}" \
  -f iterationId="{NEXT_SPRINT_ITERATION_ID}"
```

---

## Placeholder Reference

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{USER}` | GitHub username or org | `your-org` |
| `{REPO}` | Repository name | `diricode` |
| `{PROJECT_NUMBER}` | Numeric project number | `1` |
| `{PROJECT_ID}` | Full project node ID | `PVT_kwHO...` |
| `{STATUS_FIELD_ID}` | Status field node ID | `PVTSSF_lAHO...` |
| `{SPRINT_FIELD_ID}` | Sprint iteration field ID | `PVTIF_lAHO...` |
| `{ITEM_ID}` | Project item node ID | `PVTI_lAHO...` |
| `{ISSUE_NODE_ID}` | Issue global node ID | `I_kwDO...` |

---

## See Also

- **`start-work.md`** — Query next task, create branch, set status to In Progress
- **`finish-work.md`** — Commit, push, create PR, close issue
- **`epic-hierarchy.md`** — 4-level hierarchy spec, tracking issue rules, edge cases
- **`labels-and-setup.md`** — All label definitions, project field IDs, setup script

---

**Last Updated:** 2026-03-17  
**Version:** 1.0.0  
**Status:** Active
