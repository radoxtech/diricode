# GitHub Workflow Specification

## Overview

This document defines the master GitHub workflow as an issue-driven, project-board-managed process designed for autonomous AI execution with human review and merge control.

Reference sources in the workflow pack:

- `github-workflow-export/README.md` (philosophy and command map)
- `github-workflow-export/01-start-work.md` (start-work flow, issue validation, status transitions)
- `github-workflow-export/03-gh-workflow.md` (branching, commits, PR lifecycle, project operations)
- `github-workflow-export/04-worktree-isolation-rules.md` (worktree safety rules)
- `github-workflow-export/07-current-sprint.md` and `08-project-health.md` (sprint/health operating model)

This master overview delegates implementation details to companion docs:

- `.ai/knowledge/epic-hierarchy.md`
- `.ai/knowledge/ai-collaboration.md`
- `.ai/knowledge/labels-and-setup.md`

---

## Issue-First Philosophy

Core rule: no implementation work starts without a linked GitHub issue.

Required outcomes of issue-first execution:

- Every branch maps to an issue.
- Every commit references the issue.
- Every PR closes or references the issue.
- Every task is visible in GitHub Projects before coding starts.

Operational sequence:

1. Select highest-priority eligible issue from project board (`Todo` or `Ready`).
2. Validate issue is open and scoped.
3. Create branch derived from issue metadata.
4. Move project status to `In Progress`.
5. Implement, commit with issue linkage, open PR, review, merge, close loop.

---

## Epic Hierarchy

Use four planning levels with strict title prefixes:

1. **[Meta-Epic]**
   - Label: `level:meta-epic`
   - Example title: `[Meta-Epic] Product Evolution`

2. **[Epic]**
   - Label: `level:epic`
   - Example title: `[Epic] Identity and Access`

3. **[Sub-Epic]**
   - Label: `level:sub-epic`
   - Example title: `[Sub-Epic] Registration Reliability`

4. **[Task]**
   - Label: `level:task`
   - Example title: `[Task] Preserve inputs on validation error`

Traceability rule: each lower level links upward (`[Task]` -> `[Sub-Epic]` -> `[Epic]` -> `[Meta-Epic]`).

For detailed hierarchy management and linking conventions, see `.ai/knowledge/epic-hierarchy.md`.

---

## Status Workflow

Canonical status path:

`Backlog -> Todo -> Ready -> In Progress -> Review -> Blocked -> Done`

Status intent:

- **Backlog**: captured but not yet prepared for execution.
- **Todo**: accepted into near-term planning queue.
- **Ready**: fully scoped and can be started immediately.
- **In Progress**: active implementation branch exists.
- **Review**: PR open and awaiting review/approval.
- **Blocked**: cannot progress due to dependency/risk.
- **Done**: merged and complete.

Transition guidance:

- New issue added to project defaults to `Backlog`.
- Sprint grooming promotes `Backlog`/`Todo` work to `Ready`.
- Start-work flow promotes selected issue to `In Progress`.
- PR creation moves work to `Review`.
- Merge completion sets `Done`.
- Any stage may move to `Blocked` when a blocker is identified.

---

## Branch Strategy

Branch naming convention:

`<type>/<description>-#<issue>`

Where:

- `<description>` is short, lowercase, and hyphenated.
- `<issue>` is the GitHub issue number.

Type mapping (from issue labels):

- `bug` -> `fix/`
- `enhancement` -> `feat/`
- `refactor` -> `refactor/`
- `documentation` -> `docs/`
- `chore` -> `chore/`
- default/fallback -> `feat/`

Branch policy:

- Always branch from latest `main`.
- Never reuse stale feature branches.
- Delete source branch after merge.

---

## Commit Conventions

Primary commit format:

`type(scope): description - fixes #N`

Examples:

- `feat(auth): add registration retry guard - fixes #42`
- `fix(form): preserve user inputs on validation failure - fixes #161`
- `docs(workflow): clarify status transitions - fixes #88`

Accepted `type` set:

- `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

Commit rules:

- Keep commits focused and issue-linked.
- Use `fixes #N` for closing intent; use `refs #N` when not closing.
- Do not commit directly to `main`.

---

## GitHub Projects Setup

Repository and ownership placeholders:

- Owner/User: `{USER}`
- Repository: `{REPO}`
- Project number: `{PROJECT_NUMBER}`
- Project internal ID: `{PROJECT_ID}`

All reusable templates and command snippets in this workflow must use placeholders only (`{USER}`, `{REPO}`, `{PROJECT_NUMBER}`, `{PROJECT_ID}`) for project-specific identifiers.

Baseline setup:

1. Create/use project board `{PROJECT_NUMBER}` under `{USER}`.
2. Add Status single-select field with options: `Backlog`, `Todo`, `Ready`, `In Progress`, `Review`, `Blocked`, `Done`.
3. Ensure all new issues are added to project and default to `Backlog`.
4. Track priority and hierarchy labels (`level:*`, priority labels, type labels).

Command pattern examples:

```bash
gh project view {PROJECT_NUMBER} --owner {USER} --web
gh project item-list {PROJECT_NUMBER} --owner {USER} --format json
gh project item-add {PROJECT_NUMBER} --owner {USER} --url https://github.com/{USER}/{REPO}/issues/<NUMBER>
gh project item-edit --project-id {PROJECT_ID} --id <ITEM_ID> --field-id <STATUS_FIELD_ID> --single-select-option-id <OPTION_ID>
```

For labels and setup standards, see `.ai/knowledge/labels-and-setup.md`.

---

## Sprint Management

Sprint execution model:

- Prioritize from project board using status and priority.
- Pull top `Ready` (or highest-priority eligible `Todo`) task.
- Keep work-in-progress bounded; move completed items to `Done` quickly.
- Run recurring health checks to detect stale items, missing project links, and status drift.

Recommended operating cadence:

- Start of work: run task selection workflow from project board.
- During sprint: maintain accurate status transitions.
- End of sprint/weekly: run project health audit and cleanup.

Cross-reference: `github-workflow-export/07-current-sprint.md` and `github-workflow-export/08-project-health.md`.

---

## AI Collaboration Summary

Collaboration mode: high AI autonomy with mandatory human review.

Division of responsibility:

- **AI agent**
  - Selects/validates issues from the project board.
  - Creates branch/worktree and performs implementation.
  - Opens/updates PR and maintains issue linkage.
  - Applies status transitions (`In Progress`, `Review`).
- **Human reviewer**
  - Reviews architecture, code quality, and risk.
  - Requests changes or approves.
  - Merges PR and confirms final completion state.

Governance rules:

- AI does not bypass review.
- Human retains merge authority.
- Auditability via issue-linked commits/PRs is mandatory.

For expanded role boundaries and practices, see `.ai/knowledge/ai-collaboration.md`.

---

## Worktree Rules Summary

Use isolated worktrees for parallel AI tasks and context safety.

Required pattern:

- Main repository remains on `main`.
- Each task uses dedicated worktree path: `../{REPO}-#<issue>`.
- Each worktree tracks exactly one task branch.

Rules:

- Never mix multiple task scopes in one worktree.
- Never implement from a dirty or uncommitted base.
- Keep branch/worktree naming aligned to issue number.
- Remove worktree after merge and cleanup.

Cross-reference: `github-workflow-export/04-worktree-isolation-rules.md`.

---

## Glossary

- **Issue-First**: policy requiring a GitHub issue before code changes.
- **[Meta-Epic] / [Epic] / [Sub-Epic] / [Task]**: four-level planning hierarchy.
- **Status Field**: project board state machine (`Backlog` through `Done`).
- **In Progress**: active implementation state with branch/worktree.
- **Review**: PR-created state awaiting approval.
- **Blocked**: temporarily halted due to external or internal dependency.
- **Worktree**: isolated checkout tied to a branch for safe parallel work.
- **Project Number (`{PROJECT_NUMBER}`)**: user-facing GitHub Project index.
- **Project ID (`{PROJECT_ID}`)**: internal GraphQL identifier used in edits.
