# Epic Hierarchy Specification

**Version:** 1.1.0
**Status:** Active
**Last Updated:** 2026-04-08

---

## Overview

The epic hierarchy is a simple 2-level structure used to organize all GitHub issues from strategic goals down to atomic work units.

```
Epic
└── Task
```

---

## The 2 Levels

### Level 1: Epic `level:epic`

| Property | Value |
| --- | --- |
| **Label** | `level:epic` |
| **Scope** | Feature or capability (sprint/milestone span) |
| **Owned by** | Engineering lead |
| **Max children** | No hard limit (practical: ≤ 20 tasks) |

**Purpose:** Represents a complete feature or capability. An Epic delivers user-visible value. It answers "what feature are we shipping?".

**Title format:**
```
[Epic] <Feature/capability description>
```

---

### Level 2: Task `level:task`

| Property | Value |
| --- | --- |
| **Label** | `level:task` |
| **Scope** | Atomic work unit (hours/day span) |
| **Owned by** | Individual engineer |
| **Max children** | None (Tasks are leaf nodes) |
| **Parent** | Must reference an Epic |

**Purpose:** Represents an atomic, implementable unit of work. A Task must be completable in a single sprint by a single engineer. It answers "what exactly needs to be coded/done?".

**Title format:**
```
[Task] <Atomic implementation description>
```

---

## Child List Comment Pattern

Each Epic acts as a tracking issue. Since the GitHub sub-issues API is not used (returns 404), children are tracked via a "child list" comment on the Epic.

### Structure

The first or a pinned comment on the Epic issue contains a checkbox list of its direct Task children:

```markdown
## Child Tasks

- [ ] #<task-issue-number>
- [ ] #<task-issue-number>
- [ ] #<task-issue-number>
```

### Rules

1. **Checkbox = child issue reference.** Use `- [ ] #<number>` format.
2. **Checked boxes mean merged/closed.** A Task checkbox is checked only after the implementing PR is merged and the issue is closed.
3. **Manual Synchronization.** Engineers must ensure the child list comment is updated when new tasks are created or status changes.

---

## Current Epics & Module Mapping

The following epics are active in the repository, organized by their respective modules and waves.

### Diricontext Waves
- **#576**: Core Graph Foundation (Wave 1)
- **#577**: MCP Server Shell (Wave 2)
- **#578**: Outcome Tools (Wave 3)
- **#579**: Capabilities (Wave 4)
- **#580**: Integrations + Polish (Wave 5)
- **#608**: CGI (Wave 6)

### Core Infrastructure
- **#3**: Provider Router → DiriRouter
- **#4**: Server API
- **#5**: Tools Runtime
- **#9**: CLI
- **#10**: Testing Infrastructure
- **#14**: Hook Framework
- **#15**: Skills System
- **#17**: Web Dashboard
- **#163**: Bun Migration
- **#184**: Config System
- **#192**: Server Foundation
- **#613**: Agent Workers
- **#614**: Orchestrators
- **#621**: Permission Engine
- **#623**: EventStream

### New Module Epics
- **#631**: Prompt Composer
- **#632**: Semantic Search
- **#633**: Code Structural Index

### Extension Epics
- **#186**: Hooks v2
- **#253**: Hooks v3
- **#185**: Approval System
- **#252**: Sandbox
- **#254**: Auto-Advance
- **#190**: Observability v2
- **#255**: Observability v3
- **#257**: Local File-Based Plan Backend
- **#258**: Advanced UX
- **#634**: Memory v2
- **#635**: Core v3 Advanced Protocol
- **#636**: Provider DX

---

## Epic Lifecycle

Each level follows a 4-state lifecycle. Labels encode the state.

```
Draft → Active → Completed → Archived
```

| State | Label | Description |
| --- | --- | --- |
| **Draft** | `lifecycle:draft` | Defined but not yet scheduled or staffed |
| **Active** | `lifecycle:active` | Currently being worked in sprint(s) |
| **Completed** | `lifecycle:completed` | All children closed, acceptance criteria met |
| **Archived** | `lifecycle:archived` | Historical record, no further changes expected |

---

## Progress Rollup Calculation

Progress is calculated bottom-up. Each level's progress is the percentage of **direct children** in `closed` state.

### Formula
```
progress(epic) = count(closed_tasks) / count(all_tasks) × 100
```

---

## Edge Cases

### Orphan Tasks
**Definition:** A Task (`level:task`) that has no parent Epic, or whose parent Epic does not list it in the child list comment.

**Enforcement:**
- On issue creation: CI check warns if `level:task` issue has no parent reference in its description or comment.
- **Action required:** Engineer must assign the Task to an Epic before it can move to "In Progress".

---

## Label Reference

| Label | Applied to | Meaning |
| --- | --- | --- |
| `level:epic` | Issues | Hierarchy level 1 — feature/capability |
| `level:task` | Issues | Hierarchy level 2 — atomic work unit |
| `lifecycle:draft` | Epics | Not yet active |
| `lifecycle:active` | Epics | Currently in progress |
| `lifecycle:completed` | Epics | All children done |
| `lifecycle:archived` | Epics | Historical record |

---

## See Also
- **`github-workflow-spec.md`** — Branch naming and commit message conventions
- **`start.md`** — How to query GitHub Projects for next task
- **`07-current-sprint.md`** — Sprint-aware issue aggregation and scoring
