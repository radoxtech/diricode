---
description: Complete work in worktree, create PR, merge, and cleanup (validates quality, updates issue status, removes worktree)
---

# /finish-work Command

**You are executing the `/finish-work` command.**

## 🤖 Delegate to github-ops Subagent

**⚠️ RECOMMENDED: Delegate this workflow to the `github-ops` subagent.**

GitHub operations (git push, gh pr create, status transitions) are routine tasks best handled by the cost-effective github-ops model. Reserve the main agent for implementation work.

```typescript
delegate_task({
  subagent_type: "github-ops",
  load_skills: ["git-master"],
  prompt: "Execute the /finish-work workflow for DiriCode. Worktree: <path>. Issue: #<N>.",
  description: "Finish work workflow for current worktree",
});
```

---

## ⛔ Worktree-Only Command

**This command can ONLY be run from within a worktree directory.**

| Condition                    | Result                              |
| ---------------------------- | ----------------------------------- |
| You're in the main repo      | ❌ ERROR — use `/start-work` first  |
| You have uncommitted changes | ❌ ERROR — commit first             |
| PR not yet merged            | ❌ ERROR — merge or use `--abandon` |

---

## Workflow Overview

1. **Validate** you're in a worktree (not main repo)
2. **Check** for uncommitted changes
3. **Run** quality verification
4. **Update** issue status: `In Progress` → `Review`
5. **Push** branch to remote
6. **Create** pull request linked to issue
7. **Merge** PR (squash merge, auto-delete branch)
8. **Update** issue status: `Review` → `Done` (or `Blocked` on failure)
9. **Update** epic progress (close sub-issue checkbox if applicable)
10. **Return** to main repo and pull latest changes
11. **Remove** worktree directory
12. **Delete** local branch reference

---

## Step 1: Validate Worktree Location

```bash
COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)

if [ "$COMMON_DIR" = "$GIT_DIR" ]; then
  echo "❌ ERROR: You are in the main repository, not a worktree!"
  echo "📂 Current directory: $(pwd)"
  echo ""
  echo "This command can only be run from inside a worktree."
  echo "Use /start-work to create a worktree first."
  exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
WORKTREE_PATH=$(pwd)

# Extract issue number from branch name
# Branch format: <type>/<description>-#<issue>
ISSUE_NUMBER=$(echo "$CURRENT_BRANCH" | grep -oE '#[0-9]+' | tr -d '#')

echo "✅ In worktree"
echo "🌿 Branch: $CURRENT_BRANCH"
echo "🔢 Issue: #$ISSUE_NUMBER"
echo "📂 Location: $WORKTREE_PATH"
```

---

## Step 2: Check Uncommitted Changes

```bash
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ ERROR: You have uncommitted changes!"
  echo ""
  git status
  echo ""
  echo "Commit all changes before finishing:"
  echo "  git add ."
  echo "  git commit -m 'type(scope): description - fixes #$ISSUE_NUMBER'"
  exit 1
fi

echo "✅ No uncommitted changes"
```

---

## Step 3: Quality Verification

Run quality checks before creating the PR:

```bash
# Linter
pnpm lint

# Type check
pnpm type-check

# Build check
pnpm build:all
```

**If any checks fail:**

```
❌ Quality checks failed!

Issues found:
- Lint: Y errors
- TypeScript: Z errors
- Build: Failed

Fix these issues, commit the fixes, then run /finish-work again.
```

> **Note:** Test requirements are defined in the project test specification. See AGENTS.md for the project test policy.

---

## Step 4: Update Issue Status → Review

Before creating the PR, transition the issue to **Review** status:

```bash
# Via GitHub Projects status field
gh project item-edit \
  --project-id {PROJECT_NUMBER} \
  --id <item-id> \
  --field-id <status-field-id> \
  --single-select-option-id <review-option-id>

# Or via issue label
gh issue edit "$ISSUE_NUMBER" \
  --add-label "status:review" \
  --remove-label "status:in-progress"
```

**Status transition at this step:**

```
In Progress → Review
```

---

## Step 5: Push Branch to Remote

```bash
echo "📤 Pushing branch to remote..."
git push -u origin "$CURRENT_BRANCH"

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to push branch"
  exit 1
fi

echo "✅ Branch pushed: $CURRENT_BRANCH"
```

---

## Step 6: Create Pull Request

```bash
echo "📝 Creating pull request..."

# Create PR — commits containing "fixes #N" auto-link to the issue
gh pr create --fill

# Capture PR number and URL
PR_NUMBER=$(gh pr view --json number -q '.number')
PR_URL=$(gh pr view --json url -q '.url')

echo "✅ PR #$PR_NUMBER created: $PR_URL"
```

**PR checklist before merge:**

- [ ] PR title follows: `type(scope): description (#N)`
- [ ] PR body references the issue (`Closes #N` or `Fixes #N`)
- [ ] Epic/Sub-Epic context mentioned if applicable
- [ ] CI checks passing

---

## Step 7: Merge Pull Request

```bash
echo "🔀 Merging PR #$PR_NUMBER..."

gh pr merge "$PR_NUMBER" --squash --delete-branch

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to merge PR #$PR_NUMBER"
  echo ""
  echo "Options:"
  echo "  1. Resolve issues and retry: gh pr merge $PR_NUMBER --squash --delete-branch"
  echo "  2. Abandon: /finish-work --abandon"
  exit 1
fi

echo "✅ PR #$PR_NUMBER merged (squash, remote branch deleted)"
```

---

## Step 8: Update Issue Status → Done (or Blocked)

After successful merge:

```bash
# GitHub auto-closes the issue if commit contained "fixes #N"
# Manual close if needed:
gh issue close "$ISSUE_NUMBER" --comment "Completed in PR #$PR_NUMBER"

# Update project status to Done
gh project item-edit \
  --project-id {PROJECT_NUMBER} \
  --id <item-id> \
  --field-id <status-field-id> \
  --single-select-option-id <done-option-id>

echo "✅ Issue #$ISSUE_NUMBER status: Done"
```

**If merge failed or PR was closed without merging:**

```bash
# Transition to Blocked
gh project item-edit \
  --project-id {PROJECT_NUMBER} \
  --id <item-id> \
  --field-id <status-field-id> \
  --single-select-option-id <blocked-option-id>

gh issue comment "$ISSUE_NUMBER" \
  --body "⚠️ Blocked: PR merge failed. Manual review required."
```

**Status transitions:**

```
Review → Done     (on successful merge)
Review → Blocked  (on merge failure, CI failure, or conflict)
```

---

## Step 9: Update Epic Progress

If this task is part of a Sub-Epic, Epic, or Meta-Epic, check parent progress:

```bash
# Check for parent issue (GitHub sub-issues)
PARENT_ISSUE=$(gh issue view "$ISSUE_NUMBER" --json parent -q '.parent.number' 2>/dev/null)

if [ -n "$PARENT_ISSUE" ]; then
  echo "📊 Checking parent epic #$PARENT_ISSUE..."

  # The parent tracking issue checkbox auto-updates when a sub-issue closes.
  # Verify it updated:
  gh issue view "$PARENT_ISSUE" --json body -q '.body' | grep -E "\[x\].*#$ISSUE_NUMBER"

  # Count remaining open sub-issues
  OPEN_COUNT=$(gh issue view "$PARENT_ISSUE" --json body -q '.body' | grep -cE "^- \[ \]")

  if [ "$OPEN_COUNT" = "0" ]; then
    echo "🎉 All tasks under #$PARENT_ISSUE complete! Transitioning parent to Done."
    gh issue close "$PARENT_ISSUE" --comment "All sub-tasks completed. Closing."
  else
    echo "ℹ️  #$PARENT_ISSUE has $OPEN_COUNT tasks remaining"
  fi
fi
```

**DiriCode epic hierarchy:**

```
[Meta-Epic] #N
  └── [Epic] #N
        └── [Sub-Epic] #N
              └── [Task] #N  ← this issue (just completed)
```

**Cascade rule:** When all children of a parent are `Done`, transition the parent to `Done`.

---

## Step 10: Return to Main Repo and Pull

```bash
MAIN_REPO=$(git rev-parse --git-common-dir | sed 's|/.git/worktrees/.*||; s|/.git$||')

echo "🔙 Returning to main repository: $MAIN_REPO"
cd "$MAIN_REPO"

git checkout main
git pull origin main

echo "✅ Main branch up to date"
```

---

## Step 11: Remove Worktree

```bash
echo "🗑️  Removing worktree: $WORKTREE_PATH"
git worktree remove "$WORKTREE_PATH"

if [ $? -ne 0 ]; then
  echo "⚠️  Standard removal failed. Trying force removal..."
  git worktree remove --force "$WORKTREE_PATH"

  if [ $? -ne 0 ]; then
    echo "❌ Force removal also failed. Manual cleanup:"
    echo "   rm -rf $WORKTREE_PATH"
    echo "   git worktree prune"
  else
    echo "✅ Worktree force-removed"
  fi
else
  echo "✅ Worktree removed"
fi
```

---

## Step 12: Delete Local Branch Reference

```bash
# Prune remote references (remote branch already deleted by --delete-branch in Step 7)
git fetch --prune

# Delete local branch reference if still present
git branch -d "$CURRENT_BRANCH" 2>/dev/null || \
  echo "ℹ️  Local branch already removed"

echo "✅ Branch references cleaned"
```

---

## Final State Verification

```bash
echo ""
echo "📊 Final state:"
echo "  Branch: $(git branch --show-current)"
echo ""
echo "  Worktrees:"
git worktree list
echo ""
echo "  Recent commits:"
git log --oneline -5
echo ""
echo "✅ Work finished successfully!"
echo "   Issue #$ISSUE_NUMBER → Done"
echo "   PR #$PR_NUMBER merged into main"
echo ""
echo "Ready for next task: /start-work"
```

---

## Alternative: Abandon Work

Use when work must be discarded without merging.

```bash
/finish-work --abandon
```

**When to use:**

- Spike/research with no implementable outcome
- Wrong approach — need a complete restart
- Blocked by external dependency with no ETA

**Steps:**

1. Confirm with user:

```
⚠️  WARNING: You are about to ABANDON this work!

Branch:       <branch-name>
Issue:        #<N>
Uncommitted:  <count> changes
Commits:      <count> unpushed commits

This will DELETE all work in this worktree!

Type 'yes' to confirm:
```

2. On confirmation:

```bash
MAIN_REPO=$(git rev-parse --git-common-dir | sed 's|/.git/worktrees/.*||; s|/.git$||')
BRANCH=$(git branch --show-current)
ISSUE_NUMBER=$(echo "$BRANCH" | grep -oE '#[0-9]+' | tr -d '#')
WORKTREE_PATH=$(pwd)

cd "$MAIN_REPO"

# Force remove (ignores uncommitted changes)
git worktree remove --force "$WORKTREE_PATH"

# Delete local branch
git branch -D "$BRANCH" 2>/dev/null

# Update issue status to Blocked and comment
gh issue comment "$ISSUE_NUMBER" \
  --body "⚠️ Work abandoned on this branch. Issue returned to backlog for reassessment."

gh project item-edit \
  --project-id {PROJECT_NUMBER} \
  --id <item-id> \
  --field-id <status-field-id> \
  --single-select-option-id <blocked-option-id>

echo "🗑️  Work abandoned"
echo "   Worktree removed: $WORKTREE_PATH"
echo "   Issue #$ISSUE_NUMBER: Blocked (reassess in backlog)"
```

---

## Error Handling

### Not in Worktree

```
❌ ERROR: You are NOT in a worktree!

📂 Current directory: /Users/{USER}/repos/{REPO}

This command can only be run from within a worktree.
Use /start-work to create a worktree first.
```

### Uncommitted Changes

```
❌ ERROR: You have uncommitted changes!

Commit all changes before finishing:
  git add .
  git commit -m "type(scope): description - fixes #<issue>"

Then run /finish-work again.
```

### Quality Checks Failed

```
❌ Quality checks failed!

Fix issues → commit → run /finish-work again.
Do NOT bypass quality checks.
```

### Merge Conflict or CI Failure

```
❌ PR merge failed!

Options:
  1. Fix CI failures and retry:
     gh pr merge <N> --squash --delete-branch

  2. Mark Blocked:
     Update issue status in GitHub Projects

  3. Abandon:
     /finish-work --abandon
```

### Worktree Removal Failed

```bash
# Manual cleanup
rm -rf /Users/{USER}/repos/{REPO}-#<issue>
git worktree prune
git worktree list  # Confirm clean
```

---

## Complete Walkthrough

**Scenario:** Task issue #42, branch `feat/add-task-scheduler-#42`

```bash
# Step 1 — Validate worktree
# ✅ In worktree: /Users/{USER}/repos/{REPO}-#42
# 🌿 Branch: feat/add-task-scheduler-#42
# 🔢 Issue: #42

# Step 2 — Check uncommitted changes
# ✅ Clean working tree

# Step 3 — Quality checks
# pnpm lint       → ✅ 0 errors
# pnpm type-check → ✅ 0 errors
# pnpm build:all  → ✅ Success

# Step 4 — Update status
# Issue #42: In Progress → Review

# Step 5 — Push branch
# ✅ Branch pushed: feat/add-task-scheduler-#42

# Step 6 — Create PR
# ✅ PR #15: https://github.com/{USER}/{REPO}/pull/15

# Step 7 — Merge PR
# ✅ PR #15 squash-merged, branch deleted

# Step 8 — Update status
# ✅ Issue #42: Review → Done (auto-closed by merge)

# Step 9 — Epic progress
# Parent [Sub-Epic] #35: 3/5 tasks done
# Parent [Epic] #20: 1/3 sub-epics done

# Step 10 — Return to main
# ✅ On main, pulled latest

# Step 11 — Remove worktree
# ✅ Removed: /Users/{USER}/repos/{REPO}-#42

# Step 12 — Clean branch refs
# ✅ git fetch --prune complete

echo "✅ Work finished! Issue #42: Done | PR #15: Merged"
echo "Ready for next task: /start-work"
```

---

## Command Flags

| Flag        | Purpose                                                  | Usage                    |
| ----------- | -------------------------------------------------------- | ------------------------ |
| (none)      | Full workflow: validate → quality → PR → merge → cleanup | `/finish-work`           |
| `--abandon` | Discard work, remove worktree, mark issue Blocked        | `/finish-work --abandon` |
| `--force`   | Force cleanup even if PR not merged — **DANGEROUS**      | `/finish-work --force`   |

---

## Status Transition Reference

```
Backlog → Todo → Ready → In Progress → Review → Done
                                              ↘ Blocked
```

| Event                            | Transition              |
| -------------------------------- | ----------------------- |
| /start-work executed             | `Ready → In Progress`   |
| /finish-work started, PR created | `In Progress → Review`  |
| PR merged successfully           | `Review → Done`         |
| Merge failed / CI failure        | `Review → Blocked`      |
| /finish-work --abandon           | `In Progress → Blocked` |

### Epic Cascade

```
Task Done → check [Sub-Epic]: all tasks done? → Sub-Epic Done
Sub-Epic Done → check [Epic]: all sub-epics done? → Epic Done
Epic Done → check [Meta-Epic]: all epics done? → Meta-Epic Done
```

---

## Worktree Cleanup Reference

```bash
# List all worktrees
git worktree list

# Remove a specific worktree
git worktree remove /Users/{USER}/repos/{REPO}-#<issue>
git worktree remove --force /Users/{USER}/repos/{REPO}-#<issue>

# Prune stale metadata
git worktree prune

# Confirm clean state
git worktree list
```

**Boulder file** (Sisyphus orchestration): After completing a task, the orchestrator updates `.sisyphus/boulder.json` to mark the item complete and select the next task. Do not modify this file manually.

---

## See Also

- **[start-work.md](./start-work.md)** — Create worktree, begin task
- **[gh-workflow.md](./gh-workflow.md)** — Complete GitHub CLI reference
- **[epic-hierarchy.md](../knowledge/epic-hierarchy.md)** — Epic levels, naming, status rules
- **[worktree-isolation.md](../knowledge/worktree-isolation.md)** — Worktree safety rules
- **[ai-collaboration.md](../knowledge/ai-collaboration.md)** — AI autonomy boundaries and human gates
