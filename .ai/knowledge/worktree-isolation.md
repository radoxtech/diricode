# Worktree Isolation Safety Rules

> Safety reference for AI models working in git worktrees.
> See `start-work.md` for creating worktrees, `finish-work.md` for cleanup.

---

## What Is a Worktree?

A git worktree is an isolated checkout of a branch in a separate directory:

```
repos/
├── diricode/                  # Main repo (on 'main' branch)
│   ├── apps/
│   ├── libs/
│   └── .git/                  # Real git directory
│       └── worktrees/         # Worktree metadata
└── diricode-#123/             # Worktree (on feature branch)
    ├── apps/                  # Same structure as main
    ├── libs/
    └── .git                   # File (not dir!) pointing to main .git
```

Key properties:
- Each worktree has its own branch — changes don't affect main
- Multiple worktrees can coexist simultaneously
- All worktrees share the same git history

---

## Core Safety Rules

### Rule 1: One Worktree = One Task = One Branch = One Issue

```
../{REPO}-#<issue>/   →   feat/<desc>-#<issue>   →   GitHub Issue #<issue>
```

Never mix work between worktrees. Never work directly on `main` or `develop`.

### Rule 2: ALL File Reads Must Use the Worktree Path

```typescript
// ✅ CORRECT
read({ filePath: '/Users/rado/repos/diricode-#123/apps/api/src/service.ts' });

// ❌ WRONG — reads from main repo
read({ filePath: '/Users/rado/repos/diricode/apps/api/src/service.ts' });
```

### Rule 3: ALL Bash Commands Must Use `workdir`

```typescript
// ✅ CORRECT
bash({ command: 'pnpm test', workdir: '/Users/rado/repos/diricode-#123' });

// ❌ WRONG — runs in main repo by default
bash({ command: 'pnpm test' });
```

### Rule 4: ALL LSP Operations Must Use Worktree Paths

```typescript
// ✅ CORRECT
lsp_diagnostics({ filePath: '/Users/rado/repos/diricode-#123/apps/api/src/service.ts' });

// ❌ WRONG
lsp_diagnostics({ filePath: '/Users/rado/repos/diricode/apps/api/src/service.ts' });
```

### Rule 5: Delegated Subagents Must Receive Worktree Context

Every subagent prompt must include:

```
⚠️ WORKTREE ISOLATION:
Working Directory: /Users/rado/repos/diricode-#<issue>
Branch: feat/<desc>-#<issue>
Issue: #<issue>

MANDATORY: ALL file reads, bash commands, and LSP operations must use
the worktree path above. DO NOT access the main repo at /Users/rado/repos/diricode.
```

---

## Worktree Commands

### Create

```bash
git worktree add ../diricode-#<N> -b feat/<description>-#<N>
```

### List

```bash
git worktree list
```

### Remove

```bash
git worktree remove ../diricode-#<N>
```

### Prune Stale Metadata

```bash
git worktree prune
```

---

## Detecting Your Location

### Method 1: Check `.git` type

```bash
if [ -f .git ]; then
  echo "✅ In a worktree (.git is a file)"
  cat .git  # gitdir: /path/to/main/.git/worktrees/...
elif [ -d .git ]; then
  echo "ℹ️ In the main repository (.git is a directory)"
fi
```

### Method 2: Compare git dirs

```bash
COMMON=$(git rev-parse --git-common-dir)
LOCAL=$(git rev-parse --git-dir)
[ "$COMMON" != "$LOCAL" ] && echo "✅ In a worktree" || echo "ℹ️ In main repo"
```

### Method 3: Check path pattern

```bash
[[ $(pwd) == *"-#"* ]] && echo "✅ Likely in a worktree" || echo "ℹ️ Likely in main repo"
```

---

## Error Recovery

### Stale Worktree (removed directory but metadata remains)

```bash
# Clean up stale metadata
git worktree prune

# Verify
git worktree list
```

### Worktree Already Exists

```bash
# Check existing worktrees
git worktree list

# Remove the existing one first if safe to do so
git worktree remove ../diricode-#<N>

# Or use a different path/branch name
git worktree add ../diricode-#<N>-v2 -b feat/<desc>-#<N>
```

### Locked Worktree

```bash
# Unlock before removing
git worktree unlock ../diricode-#<N>

# Then remove
git worktree remove ../diricode-#<N>
```

### Worktree Has Uncommitted Changes

```bash
# From within the worktree
cd ../diricode-#<N>
git status

# Commit or stash before removing
git stash push -m "WIP before cleanup"

# Then remove with force if needed
git worktree remove --force ../diricode-#<N>
```

---

## AI-Specific Rules

Before every operation in a worktree, verify:

- [ ] File paths start with `../diricode-#<N>/` (absolute: `/Users/rado/repos/diricode-#<N>/`)
- [ ] Bash commands include `workdir` pointing to the worktree
- [ ] LSP operations use worktree file paths
- [ ] Glob patterns search within the worktree directory
- [ ] Subagent prompts include explicit worktree context
- [ ] No references to main repo path `/Users/rado/repos/diricode` (without issue suffix)

**Check `git worktree list` before creating a new worktree** — avoid duplicates.

**Never modify files outside your active worktree.**

**After finish-work completes**, the worktree is removed. Do not attempt further operations in that path.

---

## Common Mistakes

| ❌ Wrong | ✅ Correct | Why |
|----------|-----------|-----|
| `read(".../diricode/apps/...")` | `read(".../diricode-#123/apps/...")` | Reading from main |
| `bash("pnpm test")` | `bash("pnpm test", workdir="...")` | Runs in main repo |
| `glob(".../diricode/**/*.ts")` | `glob(".../diricode-#123/**/*.ts")` | Searches main files |
| Delegate without worktree path | Include worktree path in prompt | Subagent has no context |
| `cd ../diricode` in bash | Stay in worktree | Accidentally switches to main |

---

## DiriCode Monorepo Note

DiriCode is a monorepo. When you create a worktree, **all packages are available** at the worktree root — the full `apps/` and `libs/` structure is present, just like the main repo.

```
diricode-#<N>/      ← worktree root (use as workdir)
├── apps/
│   ├── web/
│   └── api/
├── libs/
└── package.json    ← root workspace config available here too
```

Run all `pnpm` commands from the worktree root. Package resolution works identically to the main repo.

---

## Related

- **`start-work.md`** — creates worktrees (cross-reference)
- **`finish-work.md`** — removes worktrees after merge (cross-reference)
