# Epic Hierarchy Specification

**Version:** 1.0.0  
**Status:** Active  
**Last Updated:** 2026-03-17

---

## Overview

The epic hierarchy is a **fixed 4-level structure** used to organize all GitHub issues from strategic goals down to atomic work units. The hierarchy is non-configurable — exactly 4 levels, always.

```
Meta-Epic
└── Epic
    └── Sub-Epic
        └── Task
```

> **Note:** GitHub supports up to 8 levels of native hierarchy. This specification intentionally restricts to 4 levels for clarity and manageability.

---

## The 4 Levels

### Level 1: Meta-Epic `[Meta-Epic]`

| Property           | Value                                 |
| ------------------ | ------------------------------------- |
| **Bracket Prefix** | `[Meta-Epic]`                         |
| **Label**          | `level:meta-epic`                     |
| **Scope**          | Strategic goal (quarter/year span)    |
| **Owned by**       | Product leadership                    |
| **Max children**   | No hard limit (practical: ≤ 10 Epics) |

**Purpose:** Represents a high-level strategic objective. A Meta-Epic spans multiple features and capabilities. It answers "what are we building toward?".

**Title format:**

```
[Meta-Epic] <Strategic objective description>
```

**Example:**

```
[Meta-Epic] Authentication & Authorization System
```

---

### Level 2: Epic `[Epic]`

| Property           | Value                                         |
| ------------------ | --------------------------------------------- |
| **Bracket Prefix** | `[Epic]`                                      |
| **Label**          | `level:epic`                                  |
| **Scope**          | Feature or capability (sprint/milestone span) |
| **Owned by**       | Engineering team lead                         |
| **Max children**   | No hard limit (practical: ≤ 10 Sub-Epics)     |
| **Parent**         | Must reference a Meta-Epic                    |

**Purpose:** Represents a complete feature or capability. An Epic delivers user-visible value. It answers "what feature are we shipping?".

**Title format:**

```
[Epic] <Feature/capability description>
```

**Example:**

```
[Epic] User Registration Flow
```

---

### Level 3: Sub-Epic `[Sub-Epic]`

| Property           | Value                                 |
| ------------------ | ------------------------------------- |
| **Bracket Prefix** | `[Sub-Epic]`                          |
| **Label**          | `level:sub-epic`                      |
| **Scope**          | Component or module (days/week span)  |
| **Owned by**       | Senior engineer                       |
| **Max children**   | No hard limit (practical: ≤ 15 Tasks) |
| **Parent**         | Must reference an Epic                |

**Purpose:** Represents a distinct component or module within a feature. A Sub-Epic groups related Tasks that share a concern (e.g., backend API, frontend UI, data model). It answers "what component/layer are we building?".

**Title format:**

```
[Sub-Epic] <Component/module description>
```

**Example:**

```
[Sub-Epic] Registration API Endpoints
```

---

### Level 4: Task `[Task]`

| Property           | Value                             |
| ------------------ | --------------------------------- |
| **Bracket Prefix** | `[Task]`                          |
| **Label**          | `level:task`                      |
| **Scope**          | Atomic work unit (hours/day span) |
| **Owned by**       | Individual engineer               |
| **Max children**   | None (Tasks are leaf nodes)       |
| **Parent**         | Must reference a Sub-Epic         |

**Purpose:** Represents an atomic, implementable unit of work. A Task must be completable in a single sprint by a single engineer. It answers "what exactly needs to be coded/done?".

**Title format:**

```
[Task] <Atomic implementation description>
```

**Example:**

```
[Task] Implement POST /auth/register endpoint
```

---

## Tracking Issue Pattern

Each non-leaf level (Meta-Epic, Epic, Sub-Epic) acts as a **Tracking Issue** — an issue whose body contains a checkbox list of its direct children.

### Structure

```markdown
## Tracking

- [ ] #<child-issue-number> <!-- Child title auto-populated by GitHub -->
- [ ] #<child-issue-number>
- [ ] #<child-issue-number>
```

### Rules

1. **Checkbox = child issue reference.** Only use `- [ ] #<number>` format.
2. **GitHub auto-closes tracking issues** when all referenced checkboxes are checked. This behavior is **not relied upon** — completion is determined by label/status, not auto-close.
3. **Each child appears in exactly one tracking issue.** No cross-linking between hierarchy branches.
4. **Checked boxes mean merged/closed.** A Task checkbox is checked only after the implementing PR is merged and issue is closed.

### Example Tracking Issue Body

```markdown
## Overview

Handles all user-facing registration functionality from API to UI.

## Tracking

- [ ] #301 [Sub-Epic] Registration API Endpoints
- [ ] #302 [Sub-Epic] Registration UI Components
- [ ] #303 [Sub-Epic] Email Verification Flow

## Acceptance Criteria

- All sub-epics completed
- End-to-end registration flow working
- Security review passed
```

---

## Complete Example

A complete hierarchy showing a Meta-Epic with 2 Epics, 3 Sub-Epics (distributed), and 5 Tasks:

```
#100 [Meta-Epic] Authentication & Authorization System
│   Labels: level:meta-epic
│
├── #110 [Epic] User Registration Flow
│   │   Labels: level:epic
│   │   Parent: #100
│   │
│   ├── #120 [Sub-Epic] Registration API Endpoints
│   │   │   Labels: level:sub-epic
│   │   │   Parent: #110
│   │   │
│   │   ├── #130 [Task] Implement POST /auth/register endpoint
│   │   │       Labels: level:task
│   │   │       Parent: #120
│   │   │
│   │   └── #131 [Task] Add input validation and error responses
│   │           Labels: level:task
│   │           Parent: #120
│   │
│   └── #121 [Sub-Epic] Registration UI Components
│       │   Labels: level:sub-epic
│       │   Parent: #110
│       │
│       ├── #132 [Task] Build registration form component
│       │       Labels: level:task
│       │       Parent: #121
│       │
│       └── #133 [Task] Add client-side validation
│               Labels: level:task
│               Parent: #121
│
└── #111 [Epic] User Login & Session Management
    │   Labels: level:epic
    │   Parent: #100
    │
    └── #122 [Sub-Epic] Session Token Management
        │   Labels: level:sub-epic
        │   Parent: #111
        │
        └── #134 [Task] Implement JWT token refresh logic
                Labels: level:task
                Parent: #122
```

**Issue tracking bodies:**

- `#100` body: `- [ ] #110`, `- [ ] #111`
- `#110` body: `- [ ] #120`, `- [ ] #121`
- `#111` body: `- [ ] #122`
- `#120` body: `- [ ] #130`, `- [ ] #131`
- `#121` body: `- [ ] #132`, `- [ ] #133`
- `#122` body: `- [ ] #134`

---

## Epic Lifecycle

Each level (Meta-Epic, Epic, Sub-Epic) follows a 4-state lifecycle. Labels encode the state.

```
Draft → Active → Completed → Archived
```

| State         | Label                 | Description                                    |
| ------------- | --------------------- | ---------------------------------------------- |
| **Draft**     | `lifecycle:draft`     | Defined but not yet scheduled or staffed       |
| **Active**    | `lifecycle:active`    | Currently being worked in sprint(s)            |
| **Completed** | `lifecycle:completed` | All children closed, acceptance criteria met   |
| **Archived**  | `lifecycle:archived`  | Historical record, no further changes expected |

### State Transition Rules

- **Draft → Active:** Manual transition when epic is added to a sprint milestone
- **Active → Completed:** Manual transition after engineer/lead verifies all children closed
- **Completed → Archived:** Manual transition, typically at quarter-end cleanup
- **No auto-completion:** Completion is NOT auto-detected from checkbox state

---

## Progress Rollup Calculation

Progress is calculated bottom-up. Each level's progress is the percentage of **direct children** in `Completed` or `closed` state.

### Formula

```
progress(node) = count(closed_children) / count(all_children) × 100
```

### Example Rollup

Using the example above:

- If `#130` and `#131` are both closed → `#120` progress = 100%
- If `#132` is closed, `#133` is open → `#121` progress = 50%
- `#110` progress = avg of children completion = (100% + 50%) / 2 = 75%

### GraphQL Query for Progress

```graphql
# Get all issues under an Epic with their state
{
  repository(owner: $owner, name: $repo) {
    issue(number: $epicNumber) {
      title
      body
      trackedIssues(first: 50) {
        nodes {
          number
          title
          state
          labels(first: 5) {
            nodes {
              name
            }
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

**Progress percentage:**

```
progress = closedTrackedIssuesCount / trackedIssuesCount × 100
```

---

## GraphQL Query Snippets

### Query Full Epic Hierarchy

```graphql
# Fetch Meta-Epic with all descendants (2 levels deep)
{
  repository(owner: $owner, name: $repo) {
    issue(number: $metaEpicNumber) {
      number
      title
      state
      labels(first: 10) {
        nodes {
          name
        }
      }
      trackedIssues(first: 20) {
        nodes {
          number
          title
          state
          labels(first: 10) {
            nodes {
              name
            }
          }
          trackedIssues(first: 30) {
            nodes {
              number
              title
              state
              labels(first: 10) {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Query Issues by Hierarchy Level

```graphql
# Find all epics (filter by label)
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
          nodes {
            name
          }
        }
        trackedIssuesCount
        closedTrackedIssuesCount
      }
    }
  }
}
```

### Query for Sprint-Aware Epic Aggregation

```graphql
# Get project items with sprint + hierarchy level fields
# Used by current-sprint workflow for epic-aware scoring
{
  user(login: $owner) {
    projectV2(number: $projectNumber) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue {
              number
              title
              state
              labels(first: 10) {
                nodes {
                  name
                }
              }
              trackedIssuesCount
              closedTrackedIssuesCount
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
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
```

> **Note:** Branch naming and commit message conventions are defined in `github-workflow-spec.md`. Do not duplicate those rules here.

---

## Edge Cases

### Orphan Tasks

**Definition:** A Task (`level:task`) that has no parent Sub-Epic, or whose parent Sub-Epic does not list it in the tracking issue body.

**Detection:**

```graphql
# Tasks not tracked by any issue
{
  repository(owner: $owner, name: $repo) {
    issues(first: 100, labels: ["level:task"], states: [OPEN]) {
      nodes {
        number
        title
        trackedBy {
          nodes {
            number
            title
          }
          totalCount
        }
      }
    }
  }
}
# Filter: nodes where trackedBy.totalCount == 0
```

**Enforcement:**

- On issue creation: CI check warns if `level:task` issue has no parent reference in body
- Warning format: `⚠️ ORPHAN TASK: Issue #<n> has label level:task but is not tracked by any Sub-Epic`
- **Action required:** Engineer must assign the Task to a Sub-Epic before it can move to "In Progress"
- Orphan tasks are **never silently accepted** — they must be assigned or rejected

### Nesting Limit (>4 Levels)

**Rule:** Hierarchy depth is fixed at exactly 4 levels. No level below `[Task]` is permitted.

**Enforcement:**

- Issue title validation: Reject issue creation if title uses a bracket prefix not in `[Meta-Epic, Epic, Sub-Epic, Task]`
- PR/CI check: Scan new issues for invalid prefixes (e.g., `[Sub-Task]`, `[Micro-Task]`)
- **Violation response:** Return error: `❌ INVALID HIERARCHY: Prefix "[Sub-Task]" is not permitted. Maximum depth is 4 levels (Meta-Epic → Epic → Sub-Epic → Task)`

**What to do instead of a 5th level:**

- Break the Task into multiple sibling Tasks under the same Sub-Epic
- Create a new Sub-Epic if the scope warrants grouping

### Sprint Rollover

**Definition:** Open (incomplete) issues that remain when a sprint ends.

**Behavior:**

- Open Tasks and Sub-Epics do **not** auto-close when sprint ends
- Sprint field value is updated by the current-sprint workflow to the next sprint iteration
- Issue status is reset from "In Progress" back to "Ready" or "Todo" depending on state

**Auto-move rules:**

1. Issues in status `Done` → remain in completed sprint, not moved
2. Issues in status `In Progress` → moved to next sprint, status → `Ready`
3. Issues in status `Ready` or `Todo` → moved to next sprint, status unchanged
4. Issues in status `Blocked` → moved to next sprint, `blocked` label retained

**GraphQL mutation for sprint rollover:**

```graphql
# Update sprint field on a project item
mutation UpdateSprintField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { iterationId: $iterationId }
    }
  ) {
    projectV2Item {
      id
    }
  }
}
```

### Invalid Parent Assignment

**Definition:** An issue assigned as a child to a parent of the wrong level (e.g., a Task directly under a Meta-Epic, skipping levels).

**Rule:** Parent-child relationships must respect level order:

- Meta-Epic → Epic (only)
- Epic → Sub-Epic (only)
- Sub-Epic → Task (only)

**Enforcement:** CI check validates that the parent issue's label (`level:*`) matches the expected parent type for the child's level.

### Circular References

**Rule:** Prohibited. No issue may be its own ancestor.

**Enforcement:** GitHub's native tracked-issue system prevents self-referencing. Cross-branch references that create cycles must be detected by validation tooling before merge.

---

## Label Reference

| Label                 | Applied to                   | Meaning                                |
| --------------------- | ---------------------------- | -------------------------------------- |
| `level:meta-epic`     | Issues                       | Hierarchy level 1 — strategic goal     |
| `level:epic`          | Issues                       | Hierarchy level 2 — feature/capability |
| `level:sub-epic`      | Issues                       | Hierarchy level 3 — component/module   |
| `level:task`          | Issues                       | Hierarchy level 4 — atomic work unit   |
| `lifecycle:draft`     | Epics, Sub-Epics, Meta-Epics | Not yet active                         |
| `lifecycle:active`    | Epics, Sub-Epics, Meta-Epics | Currently in progress                  |
| `lifecycle:completed` | Epics, Sub-Epics, Meta-Epics | All children done                      |
| `lifecycle:archived`  | Epics, Sub-Epics, Meta-Epics | Historical record                      |

---

## See Also

- **`github-workflow-spec.md`** — Branch naming and commit message conventions
- **`01-start-work.md`** — How to query GitHub Projects for next task (GraphQL patterns)
- **`07-current-sprint.md`** — Sprint-aware issue aggregation and scoring
