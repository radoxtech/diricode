---
description: Initialize worktree-based git workflow for a new [Task] issue (queries GitHub Projects, validates epic hierarchy, creates isolated worktree)
---

# /start-work Command

**You are executing the `/start-work` command.**

## ⛔ CRITICAL: Task-Level Issues Only

**This command ONLY starts work on `[Task]` level issues.**

The epic hierarchy has four levels — you may ONLY start work on **[Task]**:

| Level | Bracket Prefix | Example | Allowed? |
|-------|---------------|---------|----------|
| Meta-Epic | `[Meta-Epic]` | [Meta-Epic] Platform Rebuild | ❌ NO |
| Epic | `[Epic]` | [Epic] User Authentication | ❌ NO |
| Sub-Epic | `[Sub-Epic]` | [Sub-Epic] Registration Flow | ❌ NO |
| **Task** | `[Task]` | [Task] Add email validation | ✅ YES |

If the selected issue is NOT a `[Task]`, abort and inform the user.

---

## Workflow Overview

1. **Validate location** — must be in main repo, not a worktree
2. **Select task** — query GitHub Projects for `[Task]` issues in current sprint (status: "Todo" or "Ready")
3. **Show epic context** — display full parent chain: `[Meta-Epic] > [Epic] > [Sub-Epic] > [Task]`
4. **Create worktree** — `git worktree add ../{REPO}-#<issue> -b <type>/<description>-#<issue>`
5. **Update status** — move issue to "In Progress" via GraphQL mutation
6. **Output summary** — task title, epic context, branch name, worktree path

---

## Step 1: Validate Current Location

**Check you are in the main repository, NOT already in a worktree:**

```bash
COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)

if [ "$COMMON_DIR" != "$GIT_DIR" ]; then
  echo "❌ ERROR: You are already in a worktree!"
  echo "📂 Current worktree: $(pwd)"
  echo "🌿 Current branch: $(git branch --show-current)"
  echo ""
  echo "Finish your current work first:"
  echo "  1. Commit and push your changes"
  echo "  2. Create a PR: gh pr create --fill"
  echo "  3. Use /finish-work command to clean up"
  exit 1
fi
```

**Also check for uncommitted changes:**

```bash
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  WARNING: You have uncommitted changes in the main repository"
  git status --short
  echo ""
  echo "Options:"
  echo "  1. Stash: git stash push -m 'WIP before new task'"
  echo "  2. Commit: git add . && git commit -m 'chore: save before new worktree'"
  echo ""
  echo "Please stash or commit before continuing."
  exit 1
fi
```

---

## Step 2: Discover Repository Context

**Determine the repo name, GitHub owner, and Project number dynamically:**

```bash
# Get remote URL and extract owner/repo
REMOTE_URL=$(git remote get-url origin)
# Handles both SSH (git@github.com:owner/repo.git) and HTTPS (https://github.com/owner/repo.git)
REPO_FULL=$(echo "$REMOTE_URL" | sed 's/.*github\.com[:/]\(.*\)\.git/\1/' | sed 's/.*github\.com[:/]\(.*\)/\1/')
OWNER=$(echo "$REPO_FULL" | cut -d'/' -f1)
REPO=$(echo "$REPO_FULL" | cut -d'/' -f2)
REPO_DIR=$(basename "$(pwd)")

echo "📦 Repository: $OWNER/$REPO"

# Find project number (assumes project is associated with the repo)
PROJECT_NUMBER=$(gh project list --owner "$OWNER" --format json | jq -r '.projects[0].number // 1')
echo "📋 GitHub Project: #$PROJECT_NUMBER"
```

---

## Step 3: Query GitHub Projects for [Task] Issues

**MANDATORY: Query GitHub Projects for `[Task]` issues with status "Todo" or "Ready":**

```bash
# Fetch all Todo/Ready items from project
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --limit 100 | \
  jq -r '
    .items[] |
    select(
      (.status == "Todo" or .status == "Ready") and
      (.title | startswith("[Task]"))
    ) |
    "\(.priority // "No Priority")\t#\(.content.number // "?")\t\(.title)"
  ' | sort | head -20
```

**Display results to user:**

```
🎯 Available [Task] issues (sorted by priority):

  1. [Critical] #42  [Task] Add input validation to login form
  2. [High]     #38  [Task] Fix broken pagination on dashboard
  3. [Medium]   #51  [Task] Update user profile avatar upload

Which task would you like to start? (Enter issue number or press Enter for #1)
```

**If no [Task] issues found:**

```
⚠️  No [Task] issues with status "Todo" or "Ready" found in GitHub Projects.

Options:
  - Check the project board: gh project view --owner <owner>
  - Create a new issue with the [Task] prefix
  - Ask your team if tasks need to be triaged
```

**Reject non-Task issues if user tries to specify one manually:**

```
❌ ERROR: Issue #<N> is a [<Level>] issue, not a [Task].

Only [Task]-level issues can be started with /start-work.
Epic hierarchy issues ([Meta-Epic], [Epic], [Sub-Epic]) cannot be directly worked on.

Please select a [Task] issue. Run /start-work without arguments to see available tasks.
```

---

## Step 4: Show Epic Context (REQUIRED)

**After task is selected, display the full parent hierarchy before proceeding:**

```bash
ISSUE_NUMBER=<selected-issue>

# Fetch issue details including parent relationships
gh issue view "$ISSUE_NUMBER" --json number,title,labels,body,state,projectItems
```

**Parse the parent chain from the issue body or linked issues.**

Issues follow naming conventions that encode hierarchy, e.g.:
- The issue title `[Task] Add validation` is a child of a `[Sub-Epic]`
- Parent relationships may be encoded in the issue body as: `Part of #<parent-issue>`

**Display epic context:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 EPIC CONTEXT

  [Meta-Epic] #10 Platform Core Infrastructure
       └── [Epic] #22 Authentication System
            └── [Sub-Epic] #35 Registration Flow
                 └── [Task] #42 Add input validation to login form ← YOU ARE HERE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task: #42 — Add input validation to login form
Priority: Critical
Status: Todo

Start work on this task? (yes/no)
```

**If parent issues cannot be resolved automatically**, display what is available:

```
📍 EPIC CONTEXT (partial — some parents unresolved)

  [Sub-Epic] #35 Registration Flow
       └── [Task] #42 Add input validation to login form ← YOU ARE HERE

Note: Full hierarchy could not be determined. Check issue #42 body for parent links.
```

---

## Step 5: Validate Issue

```bash
ISSUE_DATA=$(gh issue view "$ISSUE_NUMBER" --json number,title,labels,body,state)
ISSUE_STATE=$(echo "$ISSUE_DATA" | jq -r '.state')
ISSUE_TITLE=$(echo "$ISSUE_DATA" | jq -r '.title')
ISSUE_LABELS=$(echo "$ISSUE_DATA" | jq -r '.labels[].name')

# Must be open
if [ "$ISSUE_STATE" != "OPEN" ]; then
  echo "⚠️  WARNING: Issue #$ISSUE_NUMBER is $ISSUE_STATE"
  echo "Title: $ISSUE_TITLE"
  echo ""
  echo "Are you sure you want to work on a closed issue? (yes/no)"
fi

# Must be a [Task]
if ! echo "$ISSUE_TITLE" | grep -q '^\[Task\]'; then
  echo "❌ ERROR: Issue #$ISSUE_NUMBER is not a [Task] issue."
  echo "Title: $ISSUE_TITLE"
  echo ""
  echo "Only [Task] issues can be started. Aborting."
  exit 1
fi
```

---

## Step 6: Determine Branch Name

**Naming convention:**

```
<type>/<description>-#<issue-number>
```

**Derive type from labels:**

| Label | Branch Prefix |
|-------|--------------|
| `bug` | `fix/` |
| `enhancement` | `feat/` |
| `refactor` | `refactor/` |
| `documentation` | `docs/` |
| `chore` | `chore/` |
| *(default)* | `feat/` |

**Description generation:**

```bash
# Slugify the issue title (strip [Task] prefix, lowercase, hyphens, max 50 chars)
RAW_TITLE=$(echo "$ISSUE_TITLE" | sed 's/^\[Task\] *//')
SLUG=$(echo "$RAW_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-50)

# Determine type
if echo "$ISSUE_LABELS" | grep -q 'bug'; then
  TYPE="fix"
elif echo "$ISSUE_LABELS" | grep -q 'refactor'; then
  TYPE="refactor"
elif echo "$ISSUE_LABELS" | grep -q 'documentation'; then
  TYPE="docs"
elif echo "$ISSUE_LABELS" | grep -q 'chore'; then
  TYPE="chore"
else
  TYPE="feat"
fi

BRANCH_NAME="${TYPE}/${SLUG}-#${ISSUE_NUMBER}"
echo "🌿 Branch name: $BRANCH_NAME"
```

**Examples:**

```
# [Task] Add input validation to login form  (label: bug)
# → fix/add-input-validation-to-login-form-#42

# [Task] Implement dark mode toggle  (label: enhancement)
# → feat/implement-dark-mode-toggle-#51

# [Task] Refactor auth service  (label: refactor)
# → refactor/refactor-auth-service-#38
```

---

## Step 7: Check Worktree Doesn't Already Exist

```bash
WORKTREE_PATH="../${REPO}-#${ISSUE_NUMBER}"

if git worktree list | grep -q "${REPO}-#${ISSUE_NUMBER}"; then
  echo "❌ ERROR: Worktree already exists for issue #${ISSUE_NUMBER}"
  echo "📂 Location: $WORKTREE_PATH"
  echo ""
  echo "Options:"
  echo "  1. Resume work:    cd $WORKTREE_PATH"
  echo "  2. Remove & recreate:"
  echo "     git worktree remove $WORKTREE_PATH"
  echo "     Then run /start-work again"
  echo "  3. Force remove (if broken):"
  echo "     git worktree remove --force $WORKTREE_PATH"
  exit 1
fi

# Also check if branch already exists
if git branch --list "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
  echo "❌ ERROR: Branch '$BRANCH_NAME' already exists."
  echo ""
  echo "Options:"
  echo "  1. Delete branch: git branch -D $BRANCH_NAME"
  echo "  2. Choose a different issue"
  exit 1
fi
```

---

## Step 8: Pull Latest Main

```bash
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "develop" ]; then
  echo "⚠️  Currently on '$CURRENT_BRANCH'. Switching to main..."
  git checkout main
fi

echo "📥 Pulling latest changes..."
git pull origin main || (sleep 2 && git pull origin main) || (sleep 4 && git pull origin main)

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to pull latest main. Check network connection."
  exit 1
fi
```

---

## Step 9: Create Worktree

```bash
echo "🌿 Creating isolated worktree..."
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to create worktree."
  echo "Possible causes:"
  echo "  - Branch '$BRANCH_NAME' already exists on remote"
  echo "  - Directory '$WORKTREE_PATH' already exists"
  echo "  - Insufficient disk space"
  exit 1
fi

echo "✅ Worktree created: $WORKTREE_PATH"
```

**Worktree directory structure after creation:**

```
repos/
├── {REPO}/                    ← Main repo (stays on 'main')
│   └── .git/
│       └── worktrees/
│           └── {REPO}-#<issue>/
└── {REPO}-#<issue>/           ← New worktree (on feature branch)
    └── .git                   ← File, not dir — points to main .git
```

---

## Step 10: Update GitHub Project Status to "In Progress"

**Use GraphQL mutation to update project item status:**

```bash
# Step 1: Get the project item ID for this issue
ITEM_ID=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $issue: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issue) {
        projectItems(first: 10) {
          nodes { id }
        }
      }
    }
  }
' -f owner="$OWNER" -f repo="$REPO" -F issue="$ISSUE_NUMBER" \
  --jq '.data.repository.issue.projectItems.nodes[0].id')

if [ -z "$ITEM_ID" ]; then
  echo "⚠️  Could not find project item ID for issue #$ISSUE_NUMBER"
  echo "    Issue may not be in a GitHub Project. Adding label 'in-progress' as fallback."
  gh issue edit "$ISSUE_NUMBER" --add-label "in-progress"
else
  # Step 2: Get project ID and status field ID
  PROJECT_ID=$(gh api graphql -f query='
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) { id }
      }
    }
  ' -f owner="$OWNER" -F number="$PROJECT_NUMBER" \
    --jq '.data.user.projectV2.id // empty')

  # Fallback: try organization
  if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID=$(gh api graphql -f query='
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) { id }
        }
      }
    ' -f owner="$OWNER" -F number="$PROJECT_NUMBER" \
      --jq '.data.organization.projectV2.id // empty')
  fi

  # Step 3: Find the Status field and "In Progress" option ID
  STATUS_FIELD_ID=$(gh api graphql -f query='
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  ' -f projectId="$PROJECT_ID" \
    --jq '.data.node.fields.nodes[] | select(.name == "Status") | .id')

  IN_PROGRESS_OPTION_ID=$(gh api graphql -f query='
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  ' -f projectId="$PROJECT_ID" \
    --jq '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "In Progress") | .id')

  # Step 4: Update the status
  gh api graphql -f mutation='
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item { id }
      }
    }
  ' -f projectId="$PROJECT_ID" \
    -f itemId="$ITEM_ID" \
    -f fieldId="$STATUS_FIELD_ID" \
    -f optionId="$IN_PROGRESS_OPTION_ID"

  echo "✅ GitHub Project status updated to 'In Progress'"
fi
```

---

## Step 11: Output Summary

**Display full context before the user starts working:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ WORKTREE CREATED SUCCESSFULLY

📝 Task:         #<issue> — <title>
🎯 Epic Context: [Meta-Epic] #N > [Epic] #N > [Sub-Epic] #N > [Task] #<issue>
🌿 Branch:       <type>/<description>-#<issue>
📂 Worktree:     ../{REPO}-#<issue>
🔗 Issue URL:    https://github.com/<owner>/<repo>/issues/<issue>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  WORKTREE ISOLATION: ALL work MUST happen inside the worktree!

Next steps:

  1. Change to the worktree directory:
     cd ../{REPO}-#<issue>

  2. Verify you're in the right place:
     git branch --show-current
     # Expected: <type>/<description>-#<issue>

  3. Load task context:
     - Read AGENTS.md for project rules
     - Review the issue: gh issue view <issue>

  4. Implement your changes:
     - All reads, writes, and bash commands must use the worktree path
     - Commit frequently with: git commit -m "type(scope): description - refs #<issue>"

  5. When done, use /finish-work

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Worktree Isolation Rules (MANDATORY)

After worktree creation, **all subsequent operations must use the worktree path**, not the main repo path.

```
WORKTREE_PATH = ../{REPO}-#<issue>   (absolute: /path/to/repos/{REPO}-#<issue>)
MAIN_REPO     = ../{REPO}             (DO NOT access this for implementation work)
```

**Correct tool usage patterns:**

```typescript
// ✅ File reads
read({ filePath: '/path/to/repos/{REPO}-#<issue>/src/...' })

// ✅ Bash commands
bash({ command: 'pnpm test', workdir: '/path/to/repos/{REPO}-#<issue>' })

// ✅ LSP operations
lsp_diagnostics({ filePath: '/path/to/repos/{REPO}-#<issue>/src/...' })

// ✅ Subagent delegation — ALWAYS include worktree context
delegate_task({
  prompt: `
    ⚠️ CRITICAL: You are working in an isolated worktree.
    Working Directory: /path/to/repos/{REPO}-#<issue>
    Branch: <type>/<description>-#<issue>
    MANDATORY: ALL file reads and bash commands must use the worktree path.
    DO NOT access /path/to/repos/{REPO} (main repo).
    
    Task: [actual task description]
  `
})
```

---

## Error Handling Reference

### Already in a Worktree

```
❌ ERROR: You are already in a worktree!
📂 Current: /path/to/{REPO}-#<prev-issue>

Finish current work first:
  1. Commit all changes
  2. Push: git push -u origin <branch>
  3. Create PR: gh pr create --fill
  4. Run /finish-work to clean up
```

### Issue is Not a [Task]

```
❌ ERROR: Issue #<N> has title "[<Level>] ..." — this is a [<Level>], not a [Task].

Only [Task]-level issues can be started.
[Meta-Epic], [Epic], and [Sub-Epic] issues define scope, not implementation work.

Select a [Task] issue to start work.
```

### Worktree Already Exists

```
❌ ERROR: Worktree already exists for issue #<N>
📂 Location: ../{REPO}-#<N>

Options:
  1. Resume:  cd ../{REPO}-#<N>
  2. Remove:  git worktree remove ../{REPO}-#<N>  (then re-run /start-work)
  3. Force:   git worktree remove --force ../{REPO}-#<N>
```

### Branch Already Exists

```
❌ ERROR: Branch '<branch-name>' already exists.

Delete it with: git branch -D <branch-name>
Or choose a different issue.
```

### Issue Not Found

```
❌ ERROR: Issue #<N> does not exist.

Create it with: gh issue create --title "[Task] Description"
Or list available tasks: gh issue list --state open
```

### No Tasks Available

```
⚠️  No [Task] issues with status "Todo" or "Ready" found.

Check the project board:
  gh project view "$PROJECT_NUMBER" --owner "$OWNER"

Or view all open issues:
  gh issue list --state open
```

### Network Failure

```bash
# Retry with backoff
git pull origin main || (sleep 2 && git pull origin main) || (sleep 4 && git pull origin main)
gh issue view "$ISSUE_NUMBER" || (sleep 2 && gh issue view "$ISSUE_NUMBER")
```

```
❌ ERROR: Network connectivity issues.

Check:
  - Internet connection
  - GitHub status: https://www.githubstatus.com
  - Authentication: gh auth status

Retry once connection is restored.
```

---

## Usage

```bash
# Automatic mode — queries GitHub Projects for highest priority [Task]
/start-work

# Manual mode — specify a [Task] issue number directly
/start-work #<issue-number>
```

---

## See Also

- **[finish-work.md](./finish-work.md)** — Complete work, create PR, clean up worktree
- **[gh-workflow.md](./gh-workflow.md)** — Full GitHub CLI workflow reference
- **`.ai/knowledge/epic-hierarchy.md`** — Epic level definitions and bracket prefixes
- **`.ai/knowledge/naming-conventions.md`** — Branch naming rules
- **`.ai/knowledge/labels-and-setup.md`** — Label definitions for branch type detection
