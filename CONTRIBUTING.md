# Contributing to DiriCode

DiriCode is in active development. Contributions are welcome — open an issue, discuss a design idea, or submit a PR.

> **Note: This document is for contributing to DiriCode itself.** The workflow described here uses GitHub Projects for tracking DiriCode's development. When you use DiriCode to build your own applications, your plans and tasks are stored locally in SQLite — not in GitHub Issues. See the main [README](README.md) for how end-user projects work.

Before diving in, read this document end-to-end. It covers how work is planned, how branches are managed, how AI commands fit into the workflow, and when you need an ADR.

---

## Quick Start

### Prerequisites

- Node.js >= 24
- pnpm >= 9
- GitHub CLI (`gh`) — needed for the sprint workflow

### Setup

```bash
git clone https://github.com/radoxtech/diricode.git
cd diricode
pnpm install
pnpm build
```

### Verify

```bash
pnpm test        # run all tests
pnpm lint        # lint all packages
pnpm typecheck   # TypeScript type checking
pnpm format      # format with Prettier
```

All commands run across the monorepo via [Turborepo](https://turbo.build/).

---

## GitHub Projects Workflow

Work is tracked on the [DiriCode sprint board](https://github.com/radoxtech/diricode/projects/4).

### Sprint board columns

| Column      | Meaning                                  |
| ----------- | ---------------------------------------- |
| Backlog     | Defined but not yet scheduled            |
| Ready       | Refined, unblocked, available to start   |
| In Progress | Work is active, a worktree exists        |
| Review      | PR created, waiting for review and merge |
| Done        | Merged to main                           |

### Picking a task

1. Open the [sprint board](https://github.com/radoxtech/diricode/projects/4).
2. Look in the **Ready** column.
3. Only pick issues labeled `feature` (or `bug`). Epic-level issues are not directly workable.
4. Assign yourself before starting, or use `/start-work` (see below) — it handles assignment automatically.

> **Rule:** Only `[Task]`/`feature`-level issues can be started. Starting work on an epic or sub-epic directly is not permitted — use the hierarchy to find the right leaf task.

---

## AI-Assisted Development

The `.ai/commands/` directory contains AI command definitions that work with LLM coding assistants (OpenCode, Cursor, etc.). These commands encode the full development workflow so it can be run consistently.

> Full command reference: [`.ai/README.md`](.ai/README.md)

### Available commands

| Command           | What it does                                                                 | File                                                         |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/start-work`     | Validates task eligibility, creates a git worktree, marks issue In Progress  | [`.ai/commands/start-work.md`](.ai/commands/start-work.md)   |
| `/finish-work`    | Runs quality checks, pushes branch, creates PR, merges, updates issue status | [`.ai/commands/finish-work.md`](.ai/commands/finish-work.md) |
| `/current-sprint` | Shows sprint status and lists ready tasks with safe candidate scoring        | `.ai/commands/current-sprint.md`                             |
| `/project-health` | Identifies stale issues, label inconsistencies, blocked work                 | `.ai/commands/project-health.md`                             |

These commands are not scripts — they are prompt-based workflows loaded by the AI assistant. The assistant reads the command file and follows its steps, calling GitHub CLI and git as needed.

### Typical flow

```
/start-work           → selects task, creates worktree, marks In Progress
  (implement changes)
/finish-work          → quality checks, PR creation, merge, marks Done
```

---

## Epic Hierarchy

All work in DiriCode is organized using a strict 4-level hierarchy:

```
[Meta-Epic] Strategic goal (e.g., "Authentication System")
└── [Epic] Feature or capability
    └── [Sub-Epic] Component or module
        └── [Task] Atomic unit of work  ← the only level you can start
```

Each level is a GitHub issue with a `level:*` label and a tracking body that lists its children as `- [ ] #N` checkboxes.

**You can only start work on `[Task]`-level issues** (labeled `feature` or `bug` on the live board). Higher-level issues are containers, not work units.

See [`.ai/knowledge/epic-hierarchy.md`](.ai/knowledge/epic-hierarchy.md) for the full specification: naming conventions, lifecycle states, progress rollup, and edge cases.

---

## Branch Naming & Commits

### Branch format

Branches are created automatically by `/start-work`, but the naming convention is:

```
<type>/<short-description>-#<issue-number>
```

Examples:

```
feat/add-session-storage-#91
fix/resolve-token-refresh-#42
refactor/simplify-context-composer-#67
docs/update-adr-overview-#88
```

Type prefixes come from `type:*` labels on the issue. Defaults to `feat/` if none.

> Do not reuse old branches. Each task gets a fresh branch in a dedicated worktree.

### Commit format

```
<type>(<scope>): <description> - fixes #<issue-number>
```

Examples:

```
feat(memory): add FTS5 full-text search - fixes #94
fix(providers): handle rate limit retry - closes #78
refactor(core): remove dead config fallback - refs #103
```

**Every commit must reference an issue.** No issue, no commit. This is enforced by the workflow — create an issue first, then start work.

Keywords:

- `fixes #N` or `closes #N` — auto-closes the issue on merge
- `refs #N` — links without closing (for partial work)

---

## Worktree Isolation

DiriCode uses git worktrees to keep each task's code changes isolated in its own directory.

```
repos/
├── diricode/          ← main repo (stays on 'main')
│   └── .git/
└── diricode-#94/      ← worktree for issue #94
    └── .git           ← file pointing to main .git
```

Each worktree has its own branch. You work in the worktree, not in the main repo. When work is done, `/finish-work` creates a PR from that branch and merges it.

**Why this matters for AI-assisted development:** Each worktree gives an AI assistant a clean, bounded context — it only sees the files for its task. No accidental reads from unrelated work.

Manual worktree commands:

```bash
# Create
git worktree add ../diricode-#<N> -b feat/description-#<N>

# List
git worktree list

# Remove (after merge)
git worktree remove ../diricode-#<N>
```

See [`.ai/knowledge/worktree-isolation.md`](.ai/knowledge/worktree-isolation.md) for the full safety rules, common mistakes, and error recovery.

---

## Pull Request Process

### Creating a PR

If you're using the AI workflow:

```
/finish-work
```

This runs quality checks (lint, typecheck, build), pushes the branch, creates the PR, and merges it.

If you're working manually:

```bash
# Push branch
git push -u origin feat/description-#<N>

# Create PR
gh pr create --fill
```

### PR checklist

- [ ] Title follows `type(scope): description (#N)`
- [ ] Body contains `Closes #N` or `Fixes #N`
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] Tests relevant to the change pass

### Merge strategy

All PRs use squash merge. The remote branch is deleted after merge.

### What reviewers look for

- Does the change match the issue acceptance criteria?
- Are there tests for new logic?
- Is the TypeScript correct (no `any` escapes without justification)?
- Does anything need an ADR?

---

## Architecture Decision Records (ADRs)

Significant design decisions are documented as ADRs in [`docs/adr/`](docs/adr/).

### When to write an ADR

Write one when:

- You're choosing between two plausible technical approaches
- A decision will be hard to reverse
- You're introducing a new dependency or architectural pattern
- The "why" would not be obvious from the code alone

You don't need an ADR for routine implementation choices, bug fixes, or changes that clearly follow existing patterns.

### How to propose an ADR

1. Copy [`docs/adr/adr-template.md`](docs/adr/adr-template.md)
2. Name it `adr-NNN-short-description.md` (next number in sequence)
3. Fill in Context, Decision, and Consequences
4. Open a PR with the ADR file only — no code yet
5. Get the ADR reviewed before starting implementation

The Context section should explain the problem. The Decision section should state what was decided and why the alternatives were rejected. The Consequences section should be honest about trade-offs.

Browse existing ADRs in [`docs/adr/`](docs/adr/) to understand the tone and format before writing one.

---

## Checklist Before Opening a PR

- [ ] Issue exists and is `[Task]`-level (or `feature`/`bug` label on the live board)
- [ ] Working on a dedicated branch: `<type>/description-#<N>`
- [ ] All commits reference the issue
- [ ] `pnpm lint && pnpm typecheck && pnpm build` pass
- [ ] PR body references the issue with `Closes #N`
- [ ] If this is a significant design decision: ADR written and reviewed first

---

## Getting Help

- **Sprint board:** [github.com/radoxtech/diricode/projects/4](https://github.com/radoxtech/diricode/projects/4)
- **Development workflow docs:** [`.ai/README.md`](.ai/README.md)
- **Architecture decisions:** [`docs/adr/`](docs/adr/)
- **Questions:** Open a GitHub Discussion or comment on the relevant issue
