# DiriCode GitHub Operations & Workflow Documentation Pack

**Framework:** DiriCode - AI-driven development with epic hierarchy  
**Version:** 1.0  
**Date:** 2026-03-17

---

## 📦 Contents

This documentation pack contains complete workflows for:

1. **GitHub Operations** - Cost-effective GitHub issue and PR management
2. **Git Workflow** - Branch management, PRs, commits, and issue tracking
3. **Epic Hierarchy** - Multi-level project organization (Meta-Epic → Epic → Sub-Epic → Task)
4. **Sprint Management** - Current sprint status and implementation tracking
5. **Worktree Isolation** - AI-safe isolated development environments
6. **AI Collaboration** - LLM integration patterns and best practices

---

## 🚀 Quick Start

### Prerequisites

```bash
# Clone the main repository
git clone https://github.com/{USER}/{REPO}.git
cd {REPO}

# Install GitHub CLI
gh auth login

# Verify authentication
gh auth status
```

### Available Commands

| Command           | Purpose                                    | File                |
| ----------------- | ------------------------------------------ | ------------------- |
| `/start-work`     | Initialize task branch/worktree            | `commands/start-work.md`     |
| `/finish-work`    | Complete work, create PR, merge            | `commands/finish-work.md`    |
| `/current-sprint` | Show sprint status & task candidates       | `commands/current-sprint.md` |

---

## 📋 File Index

### Commands Directory (`.ai/commands/`)

Executable workflows for common development tasks:

1. **`start-work.md`** - Initialize worktree-based git workflow for a new `[Task]` issue
   - Validates task-level issues only
   - Queries GitHub Projects for sprint candidates
   - Creates isolated worktree with epic context
   
2. **`finish-work.md`** - Complete work workflow and create PR
   - Closes worktree cleanly
   - Creates PR with proper commit linking
   - Handles merge and cleanup
   
   
4. **`current-sprint.md`** - Current sprint status and implementation candidates
   - Shows sprint overview
   - Lists ready-to-work tasks
   - Provides health metrics

4. **`project-health.md`** - Project health check and maintenance
   - Identifies stale issues and PRs
   - Checks label consistency
   - Reports epic progress and blockers

### Agents Directory (`.ai/agents/`)

Specialized executor agents for consultative workflows:

1. **`github-workflow-executor.md`** - Git & GitHub CLI expert
   - Branch operations and naming conventions
   - Commit formatting and PR workflows
   - Issue management and GraphQL queries
   - Epic-specific operations
   - Executes: `git`, `gh`, and GitHub CLI commands

### Knowledge Directory (`.ai/knowledge/`)

Reference documentation and architectural patterns:

1. **`epic-hierarchy.md`** - Multi-level project organization
   - Four-level hierarchy: Meta-Epic → Epic → Sub-Epic → Task
   - Naming conventions and bracket prefixes
   - Parent-child relationships
   - Issue linking requirements
   
2. **`github-ops-agent.md`** - GitHub Operations Agent configuration
   - Cost optimization patterns
   - Agent delegation strategies
   - GitHub CLI automation
   - Project management integration
   
3. **`worktree-isolation.md`** - AI-safe isolated development rules
   - Worktree creation and cleanup
   - Context isolation for LLM safety
   - File access restrictions
   - Branch management
   
4. **`labels-and-setup.md`** - Project setup and labeling strategy
   - Required labels for issue tracking
   - GitHub Projects configuration
   - Sprint board setup
   - Label-based filtering
   
5. **`ai-collaboration.md`** - LLM integration patterns
   - Prompt engineering for issue workflows
   - Agent delegation and skill loading
   - Context management in isolated environments
   - Cost optimization strategies

---

## 🎯 Key Concepts

### Epic Hierarchy (4 Levels)

DiriCode uses a strict four-level hierarchy for organization:

```
[Meta-Epic] Platform Rebuild                           (Strategic)
├─ [Epic] User Authentication System                   (Major feature)
│  ├─ [Sub-Epic] Registration Flow                    (Component)
│  │  ├─ [Task] Add email validation                  (Atomic work)
│  │  ├─ [Task] Implement password reset              (Atomic work)
│  │  └─ [Task] Add 2FA support                       (Atomic work)
│  └─ [Sub-Epic] Login Flow
│     └─ [Task] Add social login
└─ [Epic] User Profiles
   └─ [Sub-Epic] Profile Management
      └─ [Task] Add profile picture upload
```

**CRITICAL RULE:** Only `[Task]` level issues can be started with `/start-work`.

### Issue-First Development

**MANDATORY:** Never implement anything without a linked GitHub issue.

```bash
# Commit format with issue linking
git commit -m "feat: add email validation - fixes #{ISSUE_NUMBER}"
git commit -m "fix: resolve validation bug - closes #{ISSUE_NUMBER}"
git commit -m "refactor: optimize validation - refs #{ISSUE_NUMBER}"
```

### Worktree Isolation

**For AI Development:** Always use isolated worktrees to prevent context pollution.

```
{REPO}/                              # Main repo (stays on 'main')
├── .git/                            # Real git directory
└── {REPO}-#{ISSUE_NUMBER}/          # Worktree (isolated branch)
    └── .git                         # File pointing to main .git
```

### Sprint Management

**Current Sprint Command:** Shows status and proposes task candidates.

```bash
# Show current sprint status and ready tasks
# (Command integrated in /start-work workflow)
```

---

## 🔧 Setup in Your Project

### 1. Create `.ai/` Directory Structure

```
.ai/
├── commands/
│   ├── start-work.md
│   ├── finish-work.md
│   ├── current-sprint.md
│   └── project-health.md
│   └── README.md
├── knowledge/
│   ├── epic-hierarchy.md
│   ├── github-ops-agent.md
│   ├── worktree-isolation.md
│   ├── labels-and-setup.md
│   └── ai-collaboration.md
└── README.md (this file)
```

### 2. Configure GitHub Project

```bash
# Create GitHub Project for {REPO}
gh project create --owner {USER} --title "DiriCode Sprint Board"

# Capture project number: {PROJECT_NUMBER}
gh project list --owner {USER}
```

### 3. Set Up Project Views

Create the following custom fields/views:
- **Status**: Backlog, Ready, In Progress, Review, Done
- **Epic Level**: Select the highest epic this task belongs to
- **Priority**: High, Medium, Low
- **Sprint**: Current, Next, Backlog

### 4. Create Issues with Proper Hierarchy

Use the bracket prefixes to establish hierarchy:

```bash
# Create Meta-Epic
gh issue create --title "[Meta-Epic] Project Name" \
  --body "Description of strategic goal" \
  --label "meta-epic"

# Create Epic (link to Meta-Epic in description)
gh issue create --title "[Epic] Feature Name" \
  --body "Feature description. Related: #{META_EPIC_NUMBER}" \
  --label "epic"

# Create Sub-Epic
gh issue create --title "[Sub-Epic] Component Name" \
  --body "Component description. Related: #{EPIC_NUMBER}" \
  --label "sub-epic"

# Create Task (ready for /start-work)
gh issue create --title "[Task] Specific work item" \
  --body "Task description. Related: #{SUB_EPIC_NUMBER}" \
  --label "task"
```

### 5. Add Tasks to Project Sprint

```bash
# Get project view ID
gh project view {PROJECT_NUMBER} --owner {USER} --format json

# Add issue to project
gh project item-add {PROJECT_NUMBER} --owner {USER} --url https://github.com/{USER}/{REPO}/issues/{ISSUE_NUMBER}
```

---

## ✅ Workflow Checklist

### Before Starting Work

- [ ] Authenticated with GitHub: `gh auth status`
- [ ] Main repository cloned and updated: `git pull origin main`
- [ ] Issue is `[Task]` level in current sprint
- [ ] Issue is in "Ready" or "Todo" status on project board
- [ ] No existing worktree for this issue

### Starting a Task

```bash
# 1. Execute /start-work command
# 2. Select task from sprint list
# 3. Verify epic hierarchy displayed correctly
# 4. Worktree created and checked out
# 5. Begin implementation
```

### Finishing Work

```bash
# 1. Execute /finish-work command
# 2. Review changes
# 3. PR created with issue linking
# 4. Worktree cleaned up
# 5. Back on main branch
```

---

## ✅ Best Practices

### DO:

- ✅ Create issues BEFORE starting work
- ✅ Use proper bracket prefixes: `[Meta-Epic]`, `[Epic]`, `[Sub-Epic]`, `[Task]`
- ✅ Link all commits to issues: `fixes #{ISSUE_NUMBER}`
- ✅ Use worktree isolation for each task
- ✅ Check sprint board before selecting tasks
- ✅ Use `/start-work` to initialize workflows
- ✅ Delete worktree after finishing work
- ✅ Verify epic hierarchy before starting

### DON'T:

- ❌ Commit directly to main branch
- ❌ Start work on non-Task level issues
- ❌ Skip issue creation step
- ❌ Reuse old feature branches
- ❌ Read main repo files from worktree without explicit paths
- ❌ Leave stale worktrees behind
- ❌ Merge without PR review

---

## 🔗 GitHub Commands Quick Reference

### Issue Management

```bash
# Create issue
gh issue create --title "[Task] Task name" --body "Description"

# List sprint issues
gh issue list --project {PROJECT_NUMBER} --state open

# View issue
gh issue view {ISSUE_NUMBER}

# Link issue to PR
gh pr create --title "Fix: feature" --body "Fixes #{ISSUE_NUMBER}"
```

### Worktree Management

```bash
# List worktrees
git worktree list

# Create worktree for task
git worktree add ../{REPO}-#{ISSUE_NUMBER} -b task/issue-{ISSUE_NUMBER}

# Remove worktree
git worktree remove ../{REPO}-#{ISSUE_NUMBER}
```

### Project Management

```bash
# View project
gh project view {PROJECT_NUMBER} --owner {USER} --web

# List project items
gh project item-list {PROJECT_NUMBER} --owner {USER} --format json

# Update item status (if using GitHub CLI v2.23+)
gh project item-edit {PROJECT_NUMBER} --id {ITEM_ID} --field "Status" --single-select-option "In Progress"
```

---

## 🆘 Troubleshooting

### Issue: "Invalid task level"

**Cause:** Issue is not `[Task]` level  
**Solution:** `/start-work` only works with `[Task]` issues. Create or select a proper task.

### Issue: Permission Denied for GitHub CLI

**Solution:**

```bash
gh auth status
gh auth login
gh auth refresh
```

### Issue: Worktree Already Exists

**Solution:**

```bash
git worktree list
git worktree remove ../{REPO}-#{ISSUE_NUMBER}
```

### Issue: Uncommitted Changes in Worktree

**Solution:**

```bash
# Option 1: Stash changes
git stash push -m "WIP: {DESCRIPTION}"

# Option 2: Commit changes
git add .
git commit -m "wip: {DESCRIPTION}"
```

### Issue: Branch Diverged from Main

**Solution:**

```bash
# Update main
git checkout main
git pull origin main

# Rebase feature branch
git checkout task/issue-{ISSUE_NUMBER}
git rebase main
```

---

## 📊 Workflow Architecture

### Multi-Worktree Setup

```
{REPO}/                           # Main repo checkout
├── .git/                         # Shared git directory
├── .ai/                          # This documentation
├── src/
└── tests/

{REPO}-#123/                      # Worktree for issue #123
├── .git → ../{REPO}/.git         # Points to main .git
├── src/
└── tests/

{REPO}-#456/                      # Worktree for issue #456
├── .git → ../{REPO}/.git         # Points to main .git
├── src/
└── tests/
```

### Issue-to-Code Flow

```
Issue created on GitHub Project
    ↓
Epic hierarchy validated
    ↓
/start-work command
    ↓
Worktree created (isolated)
    ↓
Code changes committed with issue linking
    ↓
/finish-work command
    ↓
PR created → Review → Merge
    ↓
Worktree cleaned up
```

---

## 📚 Complete Reference

### Command Files
- `start-work.md` - Task initialization workflow
- `finish-work.md` - Work completion and PR creation
- `current-sprint.md` - Sprint status and candidates

### Knowledge Files
- `epic-hierarchy.md` - Four-level organization structure
- `github-ops-agent.md` - GitHub automation patterns
- `worktree-isolation.md` - Isolated development rules
- `labels-and-setup.md` - Project configuration
- `ai-collaboration.md` - LLM integration patterns

---

## 🏃 Getting Started (First-Time Setup)

1. **Clone repository and authenticate**
   ```bash
   gh auth login
   ```

2. **Explore epic hierarchy**
   - Read `.ai/knowledge/epic-hierarchy.md`

3. **Create GitHub Project**
   - Use `.ai/knowledge/labels-and-setup.md` as guide

4. **Create first issue**
   - Use proper `[Task]` bracket prefix
   - Add to project sprint board

5. **Start work**
   - Run `/start-work` command
   - Select task from sprint list

6. **Finish work**
   - Run `/finish-work` command
   - PR is created automatically

---

## 📝 Version History

| Version | Date       | Changes |
| ------- | ---------- | -------- |
| 1.0     | 2026-03-17 | Initial DiriCode documentation pack |

---

**Last Updated:** 2026-03-17  
**Framework:** DiriCode  
**Status:** Active

For questions about specific workflows, refer to the command files in `.ai/commands/`.  
For architectural patterns, refer to the knowledge files in `.ai/knowledge/`.
