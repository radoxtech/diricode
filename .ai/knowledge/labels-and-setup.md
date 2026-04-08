# GitHub Labels & Project Setup Guide

Complete reference for setting up GitHub labels, GitHub Projects custom fields, and initial configuration for the workflow.

> **Development Workflow Only — Not DiriCode's Runtime**
>
> This label taxonomy is for **GitHub Project #4**, which tracks the development of DiriCode itself. These labels are used by contributors and AI agents when developing DiriCode's codebase — not by DiriCode at runtime.
>
> DiriCode's runtime issue system uses a local SQLite database as its source of truth (see [ADR-048](../../docs/adr/adr-048-sqlite-issue-system.md)). The runtime will have its own separate tag/classification scheme defined independently of this GitHub label set. Do not use this file to understand how DiriCode categorizes runtime issues or tasks.

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

| Label             | Color     | Description                                  |
| ----------------- | --------- | -------------------------------------------- |
| `level:epic`      | `#0366D6` | Major feature or initiative                  |
| `level:task`      | `#1F883D` | Individual task or work item                 |

---

### Type Labels

Categorize work by type for branch naming and health scoring.

| Label                | Color     | Description                        |
| -------------------- | --------- | ---------------------------------- |
| `feature`            | `#0075CA` | Feature-type issues                |
| `type:bug`           | `#D73A49` | Bug fix or defect resolution       |
| `type:enhancement`   | `#0075CA` | New feature or improvement         |
| `type:documentation` | `#FFF8DC` | Documentation, guides, comments    |
| `type:refactor`      | `#9E42F5` | Code refactoring or technical debt |
| `type:test`          | `#76D5FF` | Test additions or improvements     |
| `type:chore`         | `#BDBDBD` | Maintenance, tooling, dependencies |

**Branch Type Mapping (from 03-gh-workflow.md):**

- `type:bug` → `fix/` prefix
- `type:enhancement` → `feat/` prefix
- `feature` → `feat/` prefix
- `type:refactor` → `refactor/` prefix
- `type:documentation` → `docs/` prefix
- `type:test` → `test/` prefix
- `type:chore` → `chore/` prefix
- Default (no type) → `feat/` prefix

---

### Priority Labels

Define urgency and importance for issue resolution.

| Label               | Color     | Description                              |
| ------------------- | --------- | ---------------------------------------- |
| `priority:critical` | `#FF0000` | Blocking production issues, urgent fixes |
| `priority:high`     | `#FF6B35` | Important, should be done next           |
| `priority:medium`   | `#FFA500` | Standard priority, schedule next sprint  |
| `priority:low`      | `#FFEB3B` | Nice to have, backlog items              |

---

### Status Labels

Track issue resolution status and blockers.

| Label                 | Color     | Description                             |
| --------------------- | --------- | --------------------------------------- |
| `status:blocked`      | `#EF476F` | Blocked, awaiting dependency resolution |
| `status:needs-review` | `#FFD60A` | Ready for code review                   |

---

### Sprint Labels

Organize work by sprint iteration.

| Label            | Color     | Description                 |
| ---------------- | --------- | --------------------------- |
| `sprint:current` | `#17A2B8` | Current active sprint       |
| `sprint:next`    | `#138496` | Next planned sprint         |
| `sprint:backlog` | `#8B9299` | Backlog, no sprint assigned |

---

### Routing Labels for Parallel Work

These labels exist to make `/current-sprint`, `/start`, and `/project-health` capable of recommending **non-conflicting parallel work**.

#### Assignment Rules

- Every `feature` issue gets **exactly 1** `module:*` label.
- Every `feature` issue gets **1 primary** `area:*` label and optionally **1 secondary** `area:*` label.
- `conflict:*` labels are only added when the feature touches a genuinely shared surface.
- `execution:*` labels are operational hints, not long-lived planning taxonomy.

---

### Module Labels (Current Taxonomy)

| Label                     | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `module:core`             | Core types, contracts, interfaces, Permission Engine         |
| `module:code-index`       | Code Structural Index (tree-sitter, PageRank)               |
| `module:prompt-composer`  | Prompt Composer (3-layer context management)                |
| `module:semantic-search`  | Semantic Search (embeddings, vector search)                 |
| `module:agents`           | Agent Workers (specialized agents + skills)                 |
| `module:orchestrators`    | Orchestrators (dispatcher, delegation, coordination)        |
| `module:dirirouter`       | DiriRouter (model routing, providers, cost tracking)         |
| `module:project-planner`  | Diricontext (project knowledge graph)                       |
| `module:tools`            | Tools Runtime (MCP tool schemas + handlers)                 |
| `module:web`              | Web Dashboard                                                |
| `module:tui`              | TUI (Ink-based terminal UI)                                  |
| `module:cli`              | CLI                                                          |
| `module:server`           | Server (Hono API)                                            |
| `module:memory`           | Agent Memory                                                 |

---

### Area Labels (Cross-cutting)

| Label                | Description                                         |
| -------------------- | --------------------------------------------------- |
| `area:observability` | Observability concerns (EventStream, metrics, tracing) |
| `area:hooks`         | Hook framework concerns                             |
| `area:testing`       | Testing infrastructure                              |
| `area:config`        | Configuration system                                |

---

### Conflict Labels

Only apply these when the feature changes a shared surface that could collide with other active worktrees.

| Label                          | Use When                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `conflict:workspace-structure` | Changes monorepo layout, package boundaries, root file placement                     |
| `conflict:build-toolchain`     | Changes root build/test/lint/CI pipeline behavior                                    |
| `conflict:config-surface`      | Changes config contract, load order, or env semantics                                |
| `conflict:provider-contract`   | Changes provider interface or fallback/retry contract                                |
| `conflict:api-contract`        | Changes HTTP/SSE/session API shape or compatibility                                  |
| `conflict:event-schema`        | Changes EventStream payloads, event names, or streaming protocol                     |
| `conflict:shared-types`        | Changes reused types consumed across multiple packages                               |
| `conflict:session-schema`      | Changes session persistence shape or runtime session contract                        |
| `conflict:memory-schema`       | Changes SQLite schema, migration assumptions, or storage layout                      |
| `conflict:tool-registry`       | Changes tool registration, tool identifiers, or tool execution contract              |
| `conflict:agent-registry`      | Changes agent registration, routing identifiers, or delegation registry              |
| `conflict:prompt-contract`     | Changes prompt-builder contract, injected context shape, or skill injection contract |
| `conflict:ui-shell`            | Changes shared app shell, layout frame, or reusable UI surface                       |

---

### Execution Labels

These are optional operational hints for routing automation.

| Label                           | Meaning                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| `execution:parallel-safe`       | Issue is explicitly known to be safe for parallel worktree execution |
| `execution:coordination-needed` | Work is startable but should not be auto-bundled without review      |
| `execution:blocked`             | Blocker is explicit and unresolved                                   |

---

### Feature-to-Taxonomy Mapping (9-Module Architecture)

| Module                    | Role                                                                                     | Typical Areas                                      |
| ------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `module:project-planner`  | Diricontext — project knowledge across 3 namespaces (docs, plan, reference)              | `area:config`, `area:observability`                |
| `module:code-index`       | Tree-sitter parsing, PageRank file scoring, FTS5 symbol search                          | `area:testing`, `area:config`                      |
| `module:prompt-composer`  | 3-layer context management: structural index → condenser pipeline → context composer     | `area:hooks`, `area:config`                        |
| `module:semantic-search`  | Embedding provider abstraction, sqlite-vec storage, hybrid FTS5+vector search            | `area:testing`, `area:config`                      |
| `module:memory`           | SQLite-backed session/turn state, ReasoningBank, cross-session querying                  | `area:observability`, `area:config`                |
| `module:dirirouter`       | Context-aware model routing, provider registry, cost tracking, fallback chains           | `area:observability`, `area:config`                |
| `module:agents`           | Specialized agent workers (code-writer, planner, explorer, etc.) + skills                | `area:hooks`, `area:testing`                       |
| `module:orchestrators`    | Dispatcher, delegation, coordination, monitoring — never mutate code directly            | `area:observability`, `area:hooks`                 |
| `module:core`             | Cross-cutting permission handlers, audit logging, granular permission levels             | `area:config`, `area:testing`                      |
| `module:tools`            | MCP tool schemas + handlers, tool registration                                           | `area:hooks`, `area:testing`                       |
| `module:server`           | Hono API, HTTP/SSE/session API surface                                                   | `area:observability`, `area:config`                |
| `module:web`              | Web UI, SSE client, chat/session/approval UX                                             | `area:observability`, `area:hooks`                 |
| `module:cli`              | CLI entrypoint and session UX                                                            | `area:config`, `area:observability`                |
| `module:tui`              | Ink-based terminal UI                                                                    | `area:observability`, `area:config`                |

---

## Label Creation Commands

### Copy-Paste Ready `gh label create` Commands

#### Level Labels

```bash
gh label create "level:epic" \
  --color "0366D6" \
  --description "Major feature or initiative"

gh label create "level:task" \
  --color "1F883D" \
  --description "Individual task or work item"
```

#### Type Labels

```bash
gh label create "feature" \
  --color "0075CA" \
  --description "Feature-type issues"

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

#### Module Labels

```bash
gh label create "module:core" --color "E99695" --description "Core types, contracts, interfaces, Permission Engine"
gh label create "module:code-index" --color "BFD4F2" --description "Code Structural Index (tree-sitter, PageRank)"
gh label create "module:prompt-composer" --color "C5DEF5" --description "Prompt Composer (3-layer context management)"
gh label create "module:semantic-search" --color "D4E5F9" --description "Semantic Search (embeddings, vector search)"
gh label create "module:agents" --color "0052CC" --description "Agent Workers (specialized agents + skills)"
gh label create "module:orchestrators" --color "006B75" --description "Orchestrators (dispatcher, delegation, coordination)"
gh label create "module:dirirouter" --color "FBCA04" --description "DiriRouter (model routing, providers, cost tracking)"
gh label create "module:project-planner" --color "1D76DB" --description "Diricontext (project knowledge graph)"
gh label create "module:tools" --color "5319E7" --description "Tools Runtime (MCP tool schemas + handlers)"
gh label create "module:web" --color "C2E0C6" --description "Web Dashboard"
gh label create "module:tui" --color "0E8A16" --description "TUI (Ink-based terminal UI)"
gh label create "module:cli" --color "D93F0B" --description "CLI"
gh label create "module:server" --color "FBCA04" --description "Server (Hono API)"
gh label create "module:memory" --color "FEF2C0" --description "Agent Memory"
```

#### Area Labels

```bash
gh label create "area:observability" --color "D4C5F9" --description "Observability concerns (EventStream, metrics, tracing)"
gh label create "area:hooks" --color "C5DEF5" --description "Hook framework concerns"
gh label create "area:testing" --color "76D5FF" --description "Testing infrastructure"
gh label create "area:config" --color "BFDADC" --description "Configuration system"
```

---

## GitHub Projects Setup

### Create GitHub Project

```bash
gh project create \
  --owner {USER} \
  --title "DiriCode Development Roadmap" \
  --format markdown
```

---

## Custom Fields Configuration

### Field 1: Status (Single Select)

**Purpose:** Track issue workflow state

**Options:**

| Option      | ID         | Description                       |
| ----------- | ---------- | --------------------------------- |
| Backlog     | `8afa1c37` | New issues, not yet prioritized   |
| Todo        | `f75ad846` | Ready to work on, no priority set |
| Ready       | `d023af68` | High priority, ready next         |
| In Progress | `47fc9ee4` | Actively being worked on          |
| Review      | `eda4c9c0` | Awaiting code review              |
| Blocked     | `f6ccf626` | Blocked by external dependency    |
| Done        | `98236657` | Completed and closed              |

---

### Field 2: Sprint (Iteration)

**Purpose:** Organize work into sprints/iterations

---

### Field 3: Priority (Single Select)

**Purpose:** Indicate issue urgency

**Options:**

| Option   | ID         | Description      |
| -------- | ---------- | ---------------- |
| Critical | `5454fc3e` | Blocking, urgent |
| High     | `568ac70b` | Important, next  |
| Medium   | `befae8e5` | Standard         |
| Low      | `c60b002b` | Backlog          |

---

### Field 4: Level (Single Select)

**Purpose:** Track task hierarchy and complexity

**Options:**

| Option    | ID  | Description          |
| --------- | --- | -------------------- |
| Meta Epic | `-` | Cross-project epic   |
| Epic      | `-` | Major feature        |
| Task      | `-` | Individual work item |

---

## Quick Setup Script

Complete shell script to set up all labels and project fields in sequence.

```bash
#!/bin/bash

# Configuration
USER="{USER}"
REPO="{REPO}"

echo "=== GitHub Labels & Project Setup ==="
echo ""
echo "Repository: $USER/$REPO"
echo ""

# 1. Create Level Labels
echo "[1/4] Creating Level labels..."
gh label create "level:epic" --color "0366D6" --description "Major feature or initiative" --repo "$USER/$REPO"
gh label create "level:task" --color "1F883D" --description "Individual task or work item" --repo "$USER/$REPO"

# 2. Create Type Labels
echo "[2/4] Creating Type labels..."
gh label create "feature" --color "0075CA" --description "Feature-type issues" --repo "$USER/$REPO"
gh label create "type:bug" --color "D73A49" --description "Bug fix or defect resolution" --repo "$USER/$REPO"
gh label create "type:enhancement" --color "0075CA" --description "New feature or improvement" --repo "$USER/$REPO"
gh label create "type:documentation" --color "FFF8DC" --description "Documentation, guides, comments" --repo "$USER/$REPO"
gh label create "type:refactor" --color "9E42F5" --description "Code refactoring or technical debt" --repo "$USER/$REPO"
gh label create "type:test" --color "76D5FF" --description "Test additions or improvements" --repo "$USER/$REPO"
gh label create "type:chore" --color "BDBDBD" --description "Maintenance, tooling, dependencies" --repo "$USER/$REPO"

# 3. Create Module Labels
echo "[3/4] Creating Module labels..."
gh label create "module:core" --color "E99695" --description "Core types, contracts, interfaces, Permission Engine" --repo "$USER/$REPO"
gh label create "module:code-index" --color "BFD4F2" --description "Code Structural Index (tree-sitter, PageRank)" --repo "$USER/$REPO"
gh label create "module:prompt-composer" --color "C5DEF5" --description "Prompt Composer (3-layer context management)" --repo "$USER/$REPO"
gh label create "module:semantic-search" --color "D4E5F9" --description "Semantic Search (embeddings, vector search)" --repo "$USER/$REPO"
gh label create "module:agents" --color "0052CC" --description "Agent Workers (specialized agents + skills)" --repo "$USER/$REPO"
gh label create "module:orchestrators" --color "006B75" --description "Orchestrators (dispatcher, delegation, coordination)" --repo "$USER/$REPO"
gh label create "module:dirirouter" --color "FBCA04" --description "DiriRouter (model routing, providers, cost tracking)" --repo "$USER/$REPO"
gh label create "module:project-planner" --color "1D76DB" --description "Diricontext (project knowledge graph)" --repo "$USER/$REPO"
gh label create "module:tools" --color "5319E7" --description "Tools Runtime (MCP tool schemas + handlers)" --repo "$USER/$REPO"
gh label create "module:web" --color "C2E0C6" --description "Web Dashboard" --repo "$USER/$REPO"
gh label create "module:tui" --color "0E8A16" --description "TUI (Ink-based terminal UI)" --repo "$USER/$REPO"
gh label create "module:cli" --color "D93F0B" --description "CLI" --repo "$USER/$REPO"
gh label create "module:server" --color "FBCA04" --description "Server (Hono API)" --repo "$USER/$REPO"
gh label create "module:memory" --color "FEF2C0" --description "Agent Memory" --repo "$USER/$REPO"

# 4. Create Area Labels
echo "[4/4] Creating Area labels..."
gh label create "area:observability" --color "D4C5F9" --description "Observability concerns (EventStream, metrics, tracing)" --repo "$USER/$REPO"
gh label create "area:hooks" --color "C5DEF5" --description "Hook framework concerns" --repo "$USER/$REPO"
gh label create "area:testing" --color "76D5FF" --description "Testing infrastructure" --repo "$USER/$REPO"
gh label create "area:config" --color "BFDADC" --description "Configuration system" --repo "$USER/$REPO"

echo ""
echo "✅ All labels created successfully!"
```

---

## Related Documentation

- **start.md** - GraphQL field names: status, sprint, priority, level, epic
- **08-project-health.md** - Health scoring based on field values
- **03-gh-workflow.md** - Label-to-branch-type mapping
- **GitHub CLI Docs** - https://cli.github.com/manual/

---

**Last Updated:** 2026-04-08
**Version:** 1.1.0
**Status:** Updated for 22-batch remediation and 9-module architecture
