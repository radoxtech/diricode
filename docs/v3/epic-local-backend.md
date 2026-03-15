# Epic: Local File-Based Plan Backend (v3.1)

> Package: `@diricode/core`
> Iteration: **v3.1**
> Issue IDs: **DC-LOCAL-001..DC-LOCAL-004**

## Summary

Adds a fully offline, file-based plan storage backend for users who don't use GitHub or GitLab — or who want to work without network connectivity. Plans, tasks, and metadata are stored as Markdown files with YAML frontmatter in the project's `.dc/plans/` directory, version-controlled alongside code.

This is the third plan backend (after GitHub and GitLab), completing the trio of backends committed to in the survey: "GitHub first, GitLab v2/v3, Jira v4" — with Local as a bonus for offline/simple use cases.

Source: `overview.md` v3 "File-based plan storage (no Git host)", Wishlist 7.7 (multi-project/worktree support via SQLite, but local plans need files)
Ecosystem references: Plandex (server-side DB plans), GSD (`.planning/` directory with Markdown plans), Claude Code (CLAUDE.md project instructions)

## Architectural Baseline

- MVP: `PlanBackend` interface abstracts plan storage (create/update/close/list/search)
- MVP: GitHub is the default and only backend
- v3: GitLab added as second backend (DC-GL-001..005)
- v3: Backend switcher and migration tooling (DC-GL-005)
- The Local backend implements the same `PlanBackend` interface using the filesystem instead of an API
- Worktree consideration: unlike SQLite (shared via Hono server), file-based plans live in the repo and may have git merge conflicts — trade-off is simplicity and full offline support

## Issues

### DC-LOCAL-001 — Local plan storage format

**Goal**: Define and implement the file-based plan storage format using Markdown with YAML frontmatter — human-readable, git-friendly, and structurally consistent with GitHub/GitLab issue templates.

**Scope**
- File structure:
  ```
  .dc/plans/
  ├── plan-001-auth-module.md          # Plan (equivalent to GitHub Epic/Milestone)
  ├── plan-001/
  │   ├── task-001-setup-schema.md     # Task (equivalent to GitHub Issue)
  │   ├── task-002-implement-login.md
  │   └── task-003-add-tests.md
  ├── plan-002-dashboard.md
  └── plan-002/
      └── task-001-layout.md
  ```
- Plan file format:
  ```markdown
  ---
  id: plan-001
  title: Authentication Module
  status: in-progress    # todo | in-progress | done | blocked
  priority: high         # high | medium | low
  created: 2026-03-15T10:00:00Z
  updated: 2026-03-16T14:30:00Z
  labels: [dc:type/epic]
  ---
  
  # Authentication Module
  
  ## Goal
  Implement JWT-based authentication...
  
  ## Tasks
  - [x] task-001: Setup schema
  - [ ] task-002: Implement login
  - [ ] task-003: Add tests
  ```
- Task file format:
  ```markdown
  ---
  id: task-001
  plan: plan-001
  title: Setup database schema
  status: done
  priority: high
  agent: code-writer
  labels: [dc:type/task, dc:agent/code-writer]
  created: 2026-03-15T10:05:00Z
  updated: 2026-03-15T11:20:00Z
  ---
  
  # Setup database schema
  
  ## Goal
  Create SQLite schema for users and sessions...
  
  ## Acceptance Criteria
  - [ ] Users table created
  - [ ] Sessions table created
  ```
- Auto-generated IDs: `plan-NNN` and `task-NNN` with sequential numbering (per project)
- Frontmatter parsed via `gray-matter` or similar library (lightweight YAML frontmatter parser)

**Acceptance criteria**
- [ ] Plan files stored as `.dc/plans/plan-NNN-slug.md` with YAML frontmatter
- [ ] Task files stored as `.dc/plans/plan-NNN/task-NNN-slug.md`
- [ ] Frontmatter schema validated with Zod (same validation pattern as config)
- [ ] Status field supports: todo, in-progress, done, blocked
- [ ] Sequential ID generation (no collisions)
- [ ] Files are human-readable and editable in any text editor
- [ ] Full `.dc/plans/` directory is git-trackable

**References**
- GSD pattern: `.planning/` directory with Markdown plans
- MVP pipeline: `PlanBackend` interface (create/update/close/list/search)
- Hugo/Jekyll: Markdown + YAML frontmatter as content format (proven pattern)

---

### DC-LOCAL-002 — Local PlanBackend implementation

**Goal**: Implement the `PlanBackend` interface for local filesystem — all plan and task CRUD operations work against `.dc/plans/` directory.

**Scope**
- Interface implementation:
  - `createPlan(plan)` → write `.dc/plans/plan-NNN-slug.md`, create `.dc/plans/plan-NNN/` directory
  - `updatePlan(id, changes)` → update frontmatter and/or body of plan file
  - `closePlan(id)` → set `status: done` in frontmatter
  - `listPlans(filter)` → scan `.dc/plans/plan-*.md`, parse frontmatter, apply filter
  - `searchPlans(query)` → text search across plan/task file contents
  - `createTask(planId, task)` → write `.dc/plans/plan-NNN/task-NNN-slug.md`
  - `updateTask(taskId, changes)` → update task file frontmatter/body
  - `closeTask(taskId)` → set `status: done`, update parent plan's task checklist
  - `listTasks(planId, filter)` → scan plan directory, parse frontmatter, filter
- File watching: detect external edits to `.dc/plans/` (user manually editing files)
- Concurrency safety: file-level locking to prevent concurrent writes (e.g., parallel agents writing tasks simultaneously)
- Performance: cache frontmatter index in memory, invalidate on file change

**Acceptance criteria**
- [ ] All `PlanBackend` interface methods implemented for filesystem
- [ ] Plan and task CRUD operations create/modify/read Markdown files correctly
- [ ] Search works across file contents (basic text search, no FTS5 needed for files)
- [ ] Filter by status, priority, label, agent works on frontmatter fields
- [ ] Parent plan task checklist auto-updated when child task status changes
- [ ] Concurrent write safety (file locking or atomic write pattern)
- [ ] Frontmatter index cached for fast list/filter operations

**References**
- MVP `PlanBackend` interface definition
- DC-GL-005 (backend switcher — Local must plug in identically)
- Node.js `fs.watch` / chokidar for file watching

---

### DC-LOCAL-003 — Offline mode and sync considerations

**Goal**: Ensure the local backend works fully offline with no network dependency, and document the trade-offs regarding git merge conflicts when multiple developers use file-based plans.

**Scope**
- Full offline operation:
  - No network calls for any plan operation
  - No dependency on Hono server for plan storage (direct filesystem access)
  - Works in disconnected/airplane environments
- Git merge considerations:
  - Plans in `.dc/plans/` will be committed to git — team members may create conflicting plans
  - Mitigation strategy: sequential IDs per-author prefix (e.g., `plan-rado-001`) to reduce conflicts
  - Document: `.dc/plans/README.md` with merge conflict resolution guide
  - Recommendation: for team use, prefer GitHub/GitLab backends; Local backend is optimized for solo/offline use
- Startup behavior:
  - When `planBackend: "local"`, skip all GitHub/GitLab connection checks
  - `.dc/plans/` directory auto-created on first plan creation
  - Existing `.dc/plans/` files indexed on startup (warm cache)

**Acceptance criteria**
- [ ] Zero network calls when `planBackend: "local"`
- [ ] All plan/task operations work without internet connectivity
- [ ] `.dc/plans/` directory auto-created on first use
- [ ] `.dc/plans/README.md` generated with usage guide and merge conflict advice
- [ ] Startup indexes existing plans without network dependency
- [ ] Documentation clearly states: Local backend = solo/offline optimized, team = use GitHub/GitLab

**References**
- Survey 11.1: plan storage backend selection
- Git merge conflict patterns (frontmatter YAML is generally merge-friendly)
- Wishlist 7.7: worktree support considerations

---

### DC-LOCAL-004 — Migration between Local and remote backends

**Goal**: Enable bidirectional migration between Local file-based plans and GitHub/GitLab backends, extending the migration tooling from DC-GL-005.

**Scope**
- Local → GitHub/GitLab migration:
  - `dc migrate --from local --to github` — create GitHub issues from `.dc/plans/` files
  - Parse frontmatter for metadata (status, priority, labels)
  - Preserve plan hierarchy: plans → milestones/epics, tasks → issues
  - Archive local files after successful migration (move to `.dc/plans/.archive/`)
- GitHub/GitLab → Local migration:
  - `dc migrate --from github --to local` — download issues to `.dc/plans/` files
  - Useful for going offline or leaving a platform
  - Preserve issue metadata in frontmatter
- Dry-run mode: `dc migrate --dry-run` for both directions
- Mapping report: generated after migration showing file paths ↔ issue URLs

**Acceptance criteria**
- [ ] `dc migrate --from local --to github` creates issues from local plan files
- [ ] `dc migrate --from local --to gitlab` creates issues from local plan files
- [ ] `dc migrate --from github --to local` downloads issues to plan files
- [ ] `dc migrate --from gitlab --to local` downloads issues to plan files
- [ ] Metadata preserved in both directions (status, priority, labels, agent)
- [ ] Plan hierarchy mapped correctly (plan → epic/milestone, task → issue)
- [ ] Dry-run mode available for all migration directions
- [ ] Mapping report generated after each migration

**References**
- DC-GL-005 (backend switcher and migration tooling — extend with Local support)
- Survey 11.1: backend selection and migration path
- MVP `PlanBackend` interface (uniform abstraction enables migration)
