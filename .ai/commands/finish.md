---
description: Finish work with LOCAL-ONLY testing enforcement — NO push/merge without passing local checks
---

# /finish Command

**You are executing the `/finish` command — LOCAL TESTING ENFORCED.**

## ⛔ Critical Rule: No Push Without Local Tests

**NIE WYSYŁAJ NICZEGO NA REMOTE BEZ LOKALNYCH TESTÓW PRZESZŁYCH.**

```
❌ ZABRONIONE: git push / PR create / merge
   dopóki lokalnie nie przejdzie:
   1. pnpm lint      (0 errors)
   2. pnpm typecheck (0 errors)
   3. pnpm build     (success)
   4. pnpm test      (all pass)
```

Jeśli którykolwiek check nie przechodzi → NAPRAW LOKALNIE → przetestuj ponownie → POTEM dopiero push.

---

## ⛔ Worktree-Only Command

**This command can ONLY be run from within a worktree directory.**

---

## Workflow Overview

1. **Validate** worktree location
2. **Fetch + rebase** latest `origin/main` (always — keeps branch current)
3. **🔴 LOKALNE TESTY** — wszystkie muszą przejść:
   - `pnpm lint` — 0 errors
   - `pnpm typecheck` — 0 errors
   - `pnpm build` — success
   - `pnpm test` — all pass
4. **NIE PRZECHODŹ DALEJ** dopóki krok 3 nie przejdzie w 100%
5. **Commit + Push together** (if dirty: commit and push; if clean: just push)
6. **Create** PR
7. **Merge** PR
8. **Update** issue status
9. **Return** to main repo

---

## Step 1: Validate Worktree

```bash
COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)

if [ "$COMMON_DIR" = "$GIT_DIR" ]; then
  echo "❌ ERROR: You are NOT in a worktree!"
  exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
ISSUE_NUMBER=$(echo "$CURRENT_BRANCH" | grep -oE '#[0-9]+' | tr -d '#')

echo "✅ Worktree validated"
echo "🌿 Branch: $CURRENT_BRANCH"
echo "🔢 Issue: #$ISSUE_NUMBER"
```

---

## Step 2: Fetch + Rebase Latest Main (Always)

**Always rebase onto latest main before running any quality checks.** This ensures the branch is current and tests run against the real baseline.

```bash
echo "🔄 Fetching latest main and rebasing..."
git fetch origin main

REBASE_RESULT=$(git rebase origin/main 2>&1)
REBASE_STATUS=$?

if [ $REBASE_STATUS -ne 0 ]; then
  echo "❌ Rebase failed!"
  echo "$REBASE_RESULT"
  echo ""
  echo "Resolve rebase conflicts manually, then run /finish again."
  echo "Do NOT skip the rebase — other work may have landed on main."
  exit 1
fi

echo "✅ Rebased onto latest origin/main"
echo ""
echo "Recent commits after rebase:"
git log --oneline -3
```

---

## Step 3: 🔴 LOKALNE TESTY (GATE — NIE PRZECHODŹ DALEJ BEZ TEGO)

**NIE WYSYŁAJ NICZEGO NA REMOTE DOPÓKI WSZYSTKIE NIE PRZECHODZĄ.**

```bash
echo "=============================================="
echo "🔴 KROK KRYTYCZNY: LOKALNE TESTY"
echo "=============================================="
echo "NIE pushuj dopóki wszystkie 4 checks nie przejdą!"
echo ""

# Check 1: Lint
echo "----------------------------------------------"
echo "1/4: pnpm lint"
echo "----------------------------------------------"
pnpm lint
LINT_EXIT=$?
if [ $LINT_EXIT -ne 0 ]; then
  echo ""
  echo "❌ LINT FAILED — Napraw błędy i uruchom ponownie"
  echo "❌ NIE PRZECHODŹ DALEJ — NIE PUSHUJ"
  exit 1
fi
echo "✅ Lint passed"

# Check 2: Typecheck
echo ""
echo "----------------------------------------------"
echo "2/4: pnpm typecheck"
echo "----------------------------------------------"
pnpm typecheck
TYPECHECK_EXIT=$?
if [ $TYPECHECK_EXIT -ne 0 ]; then
  echo ""
  echo "❌ TYPECHECK FAILED — Napraw błędy i uruchom ponownie"
  echo "❌ NIE PRZECHODŹ DALEJ — NIE PUSHUJ"
  exit 1
fi
echo "✅ Typecheck passed"

# Check 3: Build
echo ""
echo "----------------------------------------------"
echo "3/4: pnpm build"
echo "----------------------------------------------"
pnpm build
BUILD_EXIT=$?
if [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "❌ BUILD FAILED — Napraw błędy i uruchom ponownie"
  echo "❌ NIE PRZECHODŹ DALEJ — NIE PUSHUJ"
  exit 1
fi
echo "✅ Build passed"

# Check 4: Tests
echo ""
echo "----------------------------------------------"
echo "4/4: pnpm test"
echo "----------------------------------------------"
pnpm test
TEST_EXIT=$?
if [ $TEST_EXIT -ne 0 ]; then
  echo ""
  echo "❌ TESTS FAILED — Napraw błędy i uruchom ponownie"
  echo "❌ NIE PRZECHODŹ DALEJ — NIE PUSHUJ"
  exit 1
fi
echo "✅ Tests passed"

echo ""
echo "=============================================="
echo "✅ WSZYSTKIE LOKALNE TESTY PRZESZŁY"
echo "=============================================="
echo "Możesz teraz pushować na remote."
echo ""
```

**Jeśli którykolwiek check nie przeszedł:**

```
❌ LOKALNE TESTY NIE PRZESZŁY

❌ NIE PUSHUJ!
❌ NIE MERGUJ!

Napraw błędy → uruchom testy ponownie → jak wszystkie przejdą → POTEM push

Nie wysyłaj wadliwego kodu na remote.
```

---

## Step 4: Commit + Push Together

**If uncommitted changes exist: stage, commit with proper message, and push together.
If working tree is clean: just push existing commits.**

```bash
echo "📦 Checking for uncommitted changes..."

if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Uncommitted changes found — committing and pushing together"

  # Stage all changes
  git add .

  # Commit with proper message referencing the issue
  git commit -m "$(git log -1 --format='%s') - fixes #$ISSUE_NUMBER"
  echo "✅ Committed"
else
  echo "✅ Working tree clean — nothing to commit"
fi

echo ""
echo "📤 Pushing branch to remote..."
git push -u origin "$CURRENT_BRANCH"

if [ $? -ne 0 ]; then
  echo "❌ Push failed"
  exit 1
fi

echo "✅ Branch pushed"
```

---

## Step 5: Create Pull Request

```bash
echo "📝 Creating pull request..."
gh pr create --fill

PR_NUMBER=$(gh pr view --json number -q '.number')
echo "✅ PR #$PR_NUMBER created"
```

---

## Step 6: Merge Pull Request

```bash
echo "🔀 Merging PR #$PR_NUMBER..."
gh pr merge "$PR_NUMBER" --squash --delete-branch

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to merge PR"
  exit 1
fi

echo "✅ PR merged (squash, branch deleted)"
```

---

## Step 7: Update Issue Status

```bash
gh project item-edit \
  --project-id 4 \
  --id <item-id> \
  --field-id 267611642 \
  --single-select-option-id 98236657

echo "✅ Issue #$ISSUE_NUMBER → Done"
```

---

## Step 8: Return to Main

```bash
MAIN_REPO=$(git rev-parse --git-common-dir | sed 's|/.git/worktrees/.*||; s|/.git$||')
cd "$MAIN_REPO"
git checkout main
git pull origin main
echo "✅ Back on main, updated"
```

---

## Error States

### Rebase Failed

```
❌ Rebase failed — origin/main has diverged.

Resolve conflicts manually:
  git rebase --abort  (to cancel)
  git rebase origin/main  (to retry)

Then run /finish again.
Do NOT skip the rebase.
```

### Test Failed → STOP

```
❌ LOKALNE TESTY NIE PRZESZŁY

Fix errors locally → run /finish again → push after all pass

NIE PUSHUJ WADLIWEGO KODU!
```

### Push Failed

```
❌ Push failed

Napraw problem lokalnie, potem push ponownie.
```

### Merge Failed (CI failing)

```
❌ CI failing — nie merguj dopóki CI nie przejdzie

Lokalne testy przeszły, ale CI na remote nie.
To oznacza że testy w cache są nieaktualne — napraw i pushuj jeszcze raz.
```

---

## Workflow Diagram

```
START
  ↓
Validate worktree
  ↓
Fetch + rebase origin/main
  ↓
🔴 LOKALNE TESTY:
  ├─ pnpm lint      → FAIL → NAPRAW → RETEST
  ├─ pnpm typecheck → FAIL → NAPRAW → RETEST
  ├─ pnpm build     → FAIL → NAPRAW → RETEST
  └─ pnpm test      → FAIL → NAPRAW → RETEST
  ↓ (ALL PASS)
📦 Commit + push together (if dirty)
  ↓
📝 Create PR
  ↓
🔀 Merge
  ↓
✅ Done
```

---

## See Also

- **[finish-work.md](./finish-work.md)** — Oryginalny workflow
- **[start.md](./start.md)** — Start task
