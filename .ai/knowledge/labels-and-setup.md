# GitHub Labels & Project Setup Guide

Complete reference for setting up GitHub labels, GitHub Projects custom fields, and initial configuration for the workflow.

---

## Table of Contents

1. [Label Categories](#label-categories)
2. [Label Creation Commands](#label-creation-commands)
3. [GitHub Projects Setup](#github-projects-setup)
4. [Custom Fields Configuration](#custom-fields-configuration)
5. [Project Views](#project-views)
6. [Placeholder Configuration](#placeholder-configuration)
7. [Quick Setup Script](#quick-setup-script)

---

## Label Categories

### Level Labels

Track issue/task complexity and hierarchy level.

| Label | Color | Description |
|-------|-------|-------------|
| `level:meta-epic` | `#8B008B` | Cross-project meta epic, strategic direction |
| `level:epic` | `#0366D6` | Major feature or initiative |
| `level:sub-epic` | `#6F42C1` | Sub-epic, part of larger epic |
| `level:task` | `#1F883D` | Individual task or work item |

**Usage:** Applied by GraphQL field names from ProjectV2 (inherited from workflow)

---

### Type Labels

Categorize work by type for branch naming and health scoring.

| Label | Color | Description |
|-------|-------|-------------|
| `type:bug` | `#D73A49` | Bug fix or defect resolution |
| `type:enhancement` | `#0075CA` | New feature or improvement |
| `type:documentation` | `#FFF8DC` | Documentation, guides, comments |
| `type:refactor` | `#9E42F5` | Code refactoring or technical debt |
| `type:test` | `#76D5FF` | Test additions or improvements |
| `type:chore` | `#BDBDBD` | Maintenance, tooling, dependencies |

**Branch Type Mapping (from 03-gh-workflow.md):**
- `type:bug` → `fix/` prefix
- `type:enhancement` → `feat/` prefix
- `type:refactor` → `refactor/` prefix
- `type:documentation` → `docs/` prefix
- `type:test` → `test/` prefix
- `type:chore` → `chore/` prefix
- Default (no type) → `feat/` prefix

---

### Priority Labels

Define urgency and importance for issue resolution.

| Label | Color | Description |
|-------|-------|-------------|
| `priority:critical` | `#FF0000` | Blocking production issues, urgent fixes |
| `priority:high` | `#FF6B35` | Important, should be done next |
| `priority:medium` | `#FFA500` | Standard priority, schedule next sprint |
| `priority:low` | `#FFEB3B` | Nice to have, backlog items |

**Health Scoring Note:** Priority field values from 08-project-health.md:
- Critical, High, Medium, Low (status names map to GraphQL field values)

---

### Status Labels

Track issue resolution status and blockers.

| Label | Color | Description |
|-------|-------|-------------|
| `status:blocked` | `#EF476F` | Blocked, awaiting dependency resolution |
| `status:needs-review` | `#FFD60A` | Ready for code review |

**Project Status Field:** Replaces labels with ProjectV2 single-select values:
- Backlog, Todo, Ready, In Progress, Review, Blocked, Done

---

### Sprint Labels

Organize work by sprint iteration.

| Label | Color | Description |
|-------|-------|-------------|
| `sprint:current` | `#17A2B8` | Current active sprint |
| `sprint:next` | `#138496` | Next planned sprint |
| `sprint:backlog` | `#8B9299` | Backlog, no sprint assigned |

**ProjectV2 Sprint Field:** Uses iteration field (replaces labels)
- Sprint values: Sprint 1, Sprint 2, Sprint 3, Sprint 4, Sprint 5, etc.

---

## Label Creation Commands

### Copy-Paste Ready `gh label create` Commands

#### Level Labels

```bash
gh label create "level:meta-epic" \
  --color "8B008B" \
  --description "Cross-project meta epic, strategic direction"

gh label create "level:epic" \
  --color "0366D6" \
  --description "Major feature or initiative"

gh label create "level:sub-epic" \
  --color "6F42C1" \
  --description "Sub-epic, part of larger epic"

gh label create "level:task" \
  --color "1F883D" \
  --description "Individual task or work item"
```

#### Type Labels

```bash
gh label create "type:bug" \
  --color "D73A49" \
  --description "Bug fix or defect resolution"

gh label create "type:enhancement" \
  --color "0075CA" \
  --description "New feature or improvement"

gh label create "type:documentation" \
  --color "FFF8DC" \
  --description "Documentation, guides, comments"

gh label create "type:refactor" \
  --color "9E42F5" \
  --description "Code refactoring or technical debt"

gh label create "type:test" \
  --color "76D5FF" \
  --description "Test additions or improvements"

gh label create "type:chore" \
  --color "BDBDBD" \
  --description "Maintenance, tooling, dependencies"
```

#### Priority Labels

```bash
gh label create "priority:critical" \
  --color "FF0000" \
  --description "Blocking production issues, urgent fixes"

gh label create "priority:high" \
  --color "FF6B35" \
  --description "Important, should be done next"

gh label create "priority:medium" \
  --color "FFA500" \
  --description "Standard priority, schedule next sprint"

gh label create "priority:low" \
  --color "FFEB3B" \
  --description "Nice to have, backlog items"
```

#### Status Labels

```bash
gh label create "status:blocked" \
  --color "EF476F" \
  --description "Blocked, awaiting dependency resolution"

gh label create "status:needs-review" \
  --color "FFD60A" \
  --description "Ready for code review"
```

#### Sprint Labels

```bash
gh label create "sprint:current" \
  --color "17A2B8" \
  --description "Current active sprint"

gh label create "sprint:next" \
  --color "138496" \
  --description "Next planned sprint"

gh label create "sprint:backlog" \
  --color "8B9299" \
  --description "Backlog, no sprint assigned"
```

---

## GitHub Projects Setup

### Create GitHub Project

```bash
gh project create \
  --owner {USER} \
  --title "Travel Itinerary Roadmap" \
  --format markdown
```

**Output will include:**
- Project Number (e.g., `1`)
- Project ID (e.g., `PVT_kwHOADKEXM4BNVF8`)

Save these for later reference.

---

## Custom Fields Configuration

### Field 1: Status (Single Select)

**Purpose:** Track issue workflow state

**GraphQL Field Name:** `status` (from 08-project-health.md)

**Options:**

| Option | ID | Description |
|--------|-----|-------------|
| Backlog | `8afa1c37` | New issues, not yet prioritized |
| Todo | `f75ad846` | Ready to work on, no priority set |
| Ready | `d023af68` | High priority, ready next |
| In Progress | `47fc9ee4` | Actively being worked on |
| Review | `eda4c9c0` | Awaiting code review |
| Blocked | `f6ccf626` | Blocked by external dependency |
| Done | `98236657` | Completed and closed |

**Creation Command:**

```bash
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Field(input: {
      projectId: $projectId
      dataType: SINGLE_SELECT
      name: "Status"
    }) {
      projectV2Field {
        id
        name
      }
    }
  }
' -f projectId="{PROJECT_ID}" --jq '.data.createProjectV2Field.projectV2Field.id'
```

---

### Field 2: Sprint (Iteration)

**Purpose:** Organize work into sprints/iterations

**GraphQL Field Name:** `sprint` (from 01-start-work.md, 08-project-health.md)

**Sprint Iterations:**

| Sprint | ID | Duration | Dates |
|--------|-----|----------|-------|
| Sprint 0 (Completed) | `118be4cf` | Initial | - |
| Sprint 1 | `01bb0774` | 2 weeks | Jan 25 - Feb 7 |
| Sprint 2 | `fad0fc58` | 2 weeks | Feb 8 - Feb 21 |
| Sprint 3 | `2d96f7f0` | 2 weeks | Feb 22 - Mar 7 |
| Sprint 4 | `94988e66` | 2 weeks | Mar 8 - Mar 21 |
| Sprint 5 | `4befd4f8` | 2 weeks | Mar 22 - Apr 4 |

**Creation Command:**

```bash
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Field(input: {
      projectId: $projectId
      dataType: ITERATION
      name: "Sprint"
    }) {
      projectV2Field {
        id
        name
      }
    }
  }
' -f projectId="{PROJECT_ID}" --jq '.data.createProjectV2Field.projectV2Field.id'
```

---

### Field 3: Priority (Single Select)

**Purpose:** Indicate issue urgency

**GraphQL Field Name:** `priority` (from 08-project-health.md)

**Options:**

| Option | ID | Description |
|--------|-----|-------------|
| Critical | `5454fc3e` | Blocking, urgent |
| High | `568ac70b` | Important, next |
| Medium | `befae8e5` | Standard |
| Low | `c60b002b` | Backlog |

**Creation Command:**

```bash
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Field(input: {
      projectId: $projectId
      dataType: SINGLE_SELECT
      name: "Priority"
    }) {
      projectV2Field {
        id
        name
      }
    }
  }
' -f projectId="{PROJECT_ID}" --jq '.data.createProjectV2Field.projectV2Field.id'
```

---

### Field 4: Level (Single Select)

**Purpose:** Track task hierarchy and complexity

**GraphQL Field Name:** `level` (from 01-start-work.md)

**Options:**

| Option | ID | Description |
|--------|-----|-------------|
| Meta Epic | `-` | Cross-project epic |
| Epic | `-` | Major feature |
| Sub-Epic | `-` | Feature component |
| Task | `-` | Individual work item |

**Creation Command:**

```bash
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Field(input: {
      projectId: $projectId
      dataType: SINGLE_SELECT
      name: "Level"
    }) {
      projectV2Field {
        id
        name
      }
    }
  }
' -f projectId="{PROJECT_ID}" --jq '.data.createProjectV2Field.projectV2Field.id'
```

---

### Field 5: Epic (Single Select)

**Purpose:** Group tasks by epic initiative

**GraphQL Field Name:** `epic` (referenced in health scoring)

**Options:** Dynamic based on project epics

**Creation Command:**

```bash
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Field(input: {
      projectId: $projectId
      dataType: SINGLE_SELECT
      name: "Epic"
    }) {
      projectV2Field {
        id
        name
      }
    }
  }
' -f projectId="{PROJECT_ID}" --jq '.data.createProjectV2Field.projectV2Field.id'
```

---

## Project Views

### View 1: Board View (by Status)

Kanban-style board showing issues grouped by status.

**Setup:**

```bash
gh project view-create \
  --owner {USER} \
  --project {PROJECT_NUMBER} \
  --name "Board" \
  --view-type "board" \
  --group-by "status"
```

**Displays:** Status columns (Backlog, Todo, Ready, In Progress, Review, Blocked, Done)

---

### View 2: Sprint Board (by Iteration)

Filtered view showing only current sprint issues.

**Setup:**

```bash
gh project view-create \
  --owner {USER} \
  --project {PROJECT_NUMBER} \
  --name "Sprint Board" \
  --view-type "board" \
  --filter "sprint = @current" \
  --group-by "status"
```

**Displays:** Only issues in current sprint iteration

---

### View 3: Epic View (by Level)

Hierarchical view grouped by epic level.

**Setup:**

```bash
gh project view-create \
  --owner {USER} \
  --project {PROJECT_NUMBER} \
  --name "Epic View" \
  --view-type "table" \
  --group-by "epic"
```

**Displays:** Issues organized by epic grouping

---

## Placeholder Configuration

### Required Replacements

Replace these placeholders with your actual values:

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{USER}` | GitHub username or organization | `your-org` |
| `{REPO}` | Repository name | `your-repo` |
| `{PROJECT_NUMBER}` | Project number (from creation) | `1` |
| `{PROJECT_ID}` | Full project ID (from creation) | `PVT_kwHOADKEXM4BNVF8` |

### Field IDs to Update After Creation

After creating custom fields, replace these IDs:

| Placeholder | Type | Example |
|------------|------|---------|
| `{STATUS_FIELD_ID}` | Field ID | `PVTSSF_lAHOADKEXM4BNVF8zg8W1dk` |
| `{SPRINT_FIELD_ID}` | Field ID | `PVTIF_lAHOADKEXM4BNVF8zg8ZNSI` |
| `{PRIORITY_FIELD_ID}` | Field ID | `PVTSSF_lAHOADKEXM4BNVF8zg8W13Y` |
| `{LEVEL_FIELD_ID}` | Field ID | `PVTSSF_lAHOADKEXM4BNVF8zg8XXX` |
| `{EPIC_FIELD_ID}` | Field ID | `PVTSSF_lAHOADKEXM4BNVF8zg8YYY` |

---

## Quick Setup Script

Complete shell script to set up all labels and project fields in sequence.

```bash
#!/bin/bash

# Configuration
USER="{USER}"
REPO="{REPO}"
PROJECT_NUMBER="{PROJECT_NUMBER}"
PROJECT_ID="{PROJECT_ID}"

echo "=== GitHub Labels & Project Setup ==="
echo ""
echo "Repository: $USER/$REPO"
echo "Project: $PROJECT_NUMBER"
echo ""

# 1. Create Level Labels
echo "[1/4] Creating Level labels..."
gh label create "level:meta-epic" --color "8B008B" --description "Cross-project meta epic, strategic direction" --repo "$USER/$REPO"
gh label create "level:epic" --color "0366D6" --description "Major feature or initiative" --repo "$USER/$REPO"
gh label create "level:sub-epic" --color "6F42C1" --description "Sub-epic, part of larger epic" --repo "$USER/$REPO"
gh label create "level:task" --color "1F883D" --description "Individual task or work item" --repo "$USER/$REPO"

# 2. Create Type Labels
echo "[2/4] Creating Type labels..."
gh label create "type:bug" --color "D73A49" --description "Bug fix or defect resolution" --repo "$USER/$REPO"
gh label create "type:enhancement" --color "0075CA" --description "New feature or improvement" --repo "$USER/$REPO"
gh label create "type:documentation" --color "FFF8DC" --description "Documentation, guides, comments" --repo "$USER/$REPO"
gh label create "type:refactor" --color "9E42F5" --description "Code refactoring or technical debt" --repo "$USER/$REPO"
gh label create "type:test" --color "76D5FF" --description "Test additions or improvements" --repo "$USER/$REPO"
gh label create "type:chore" --color "BDBDBD" --description "Maintenance, tooling, dependencies" --repo "$USER/$REPO"

# 3. Create Priority Labels
echo "[3/4] Creating Priority labels..."
gh label create "priority:critical" --color "FF0000" --description "Blocking production issues, urgent fixes" --repo "$USER/$REPO"
gh label create "priority:high" --color "FF6B35" --description "Important, should be done next" --repo "$USER/$REPO"
gh label create "priority:medium" --color "FFA500" --description "Standard priority, schedule next sprint" --repo "$USER/$REPO"
gh label create "priority:low" --color "FFEB3B" --description "Nice to have, backlog items" --repo "$USER/$REPO"

# 4. Create Status & Sprint Labels
echo "[4/4] Creating Status and Sprint labels..."
gh label create "status:blocked" --color "EF476F" --description "Blocked, awaiting dependency resolution" --repo "$USER/$REPO"
gh label create "status:needs-review" --color "FFD60A" --description "Ready for code review" --repo "$USER/$REPO"
gh label create "sprint:current" --color "17A2B8" --description "Current active sprint" --repo "$USER/$REPO"
gh label create "sprint:next" --color "138496" --description "Next planned sprint" --repo "$USER/$REPO"
gh label create "sprint:backlog" --color "8B9299" --description "Backlog, no sprint assigned" --repo "$USER/$REPO"

echo ""
echo "✅ All labels created successfully!"
echo ""
echo "=== Next Steps ==="
echo "1. Update field IDs in workflow scripts after project creation"
echo "2. Configure GitHub Projects custom fields (see custom-fields-configuration.md)"
echo "3. Set up project views (Board, Sprint Board, Epic View)"
echo "4. Add existing issues to project"
echo ""
```

---

## Related Documentation

- **01-start-work.md** - GraphQL field names: status, sprint, priority, level, epic
- **08-project-health.md** - Health scoring based on field values
- **03-gh-workflow.md** - Label-to-branch-type mapping
- **GitHub CLI Docs** - https://cli.github.com/manual/

---

## Troubleshooting

### Label Already Exists

If label creation fails because it already exists:

```bash
# Update existing label
gh label edit "priority:critical" --color "FF0000" --description "Updated description"

# Or delete and recreate
gh label delete "priority:critical" --yes
gh label create "priority:critical" --color "FF0000" --description "Blocking production issues, urgent fixes"
```

### GraphQL Field Creation Fails

Ensure project ID is correct:

```bash
# Verify project ID
gh project list --owner {USER} --jq '.[] | {title, id}'
```

### Sprint Iteration Not Found

Create missing sprint iterations:

```bash
gh api graphql -f query='
  mutation($projectId: ID!) {
    createProjectV2Iteration(input: {
      projectId: $projectId
      title: "Sprint 6"
      startDate: "2026-04-05"
      duration: 14
    }) {
      projectV2Iteration { id title }
    }
  }
' -f projectId="{PROJECT_ID}"
```

---

**Last Updated:** 2026-03-17
**Version:** 1.0.0
**Status:** Complete Guide for Initial Setup
