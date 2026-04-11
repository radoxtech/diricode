# AI Collaboration Model for DiriCode Development

**Version:** 1.0
**Last Updated:** 2026-01-25
**Status:** Active

---

## Overview

This document defines the human/AI collaboration model for DiriCode development. It establishes clear boundaries for autonomous AI operations versus actions that require human oversight, ensuring safe and effective collaboration.

---

## CAN/CANNOT Matrix

### AI CAN (Autonomous Operations)

These actions may be performed autonomously by AI agents without human approval:

| Action                           | Notes                                         |
| -------------------------------- | --------------------------------------------- |
| Create branches                  | Feature branches following naming conventions |
| Create issues/tasks              | Must reference a parent epic                  |
| Create pull requests             | From feature branches only                    |
| Update issue status              | Moving between workflow states                |
| Move items on project board      | Within established workflow columns           |
| Assign labels                    | Using existing, configured labels only        |
| Commit to feature branches       | All commits must reference issue numbers      |
| Push to feature branches         | Own feature branches only                     |
| Create sub-epics from epics      | When human has approved the parent epic       |
| Update sprint fields             | On issues/tasks within approved scope         |
| Close issues via commit messages | Using `fixes #N` or `closes #N` syntax        |
| Add comments to issues           | Status updates, progress notes, blockers      |
| Request PR reviews               | Assigning human reviewers to PRs              |
| Update PR metadata               | Title, description, labels on own PRs         |

### AI CANNOT (Prohibited — Safety Violations)

These actions are **prohibited** for AI agents without exception:

| Prohibited Action                          | Why Prohibited                          |
| ------------------------------------------ | --------------------------------------- |
| Merge PRs to main/develop                  | Human gate is NON-NEGOTIABLE            |
| Delete remote branches without PR merge    | Risk of data loss                       |
| Force push to any branch                   | Rewrites history, breaks collaboration  |
| Create Meta-Epics                          | Strategic-level scope — human approval only |
| Approve PRs                                | Review approval requires human judgment |
| Modify protected branches directly         | Bypasses safety controls                |
| Change project settings                    | Affects all contributors                |
| Modify labels/milestones configuration     | System-level change                     |
| Merge with --no-verify or skip hooks       | Bypasses quality gates                  |
| Access credentials, secrets, or .env files | Absolute security prohibition           |

---

## Human MUST (Non-Negotiable Gates)

These responsibilities belong exclusively to humans:

| Responsibility                          | Rationale                                          |
| --------------------------------------- | -------------------------------------------------- |
| Review PRs before merge                 | Code quality, intent verification, security review |
| Approve epic creation proposals         | Scope and strategic alignment decisions            |
| Merge to main branch                    | Final quality gate — no exceptions                 |
| Resolve conflicting epic priorities     | Requires understanding of business context         |
| Make scope decisions at epic level | Strategic planning is human territory              |
| Approve architectural decisions         | Long-term impact requires human judgment           |
| Resolve merge conflicts manually        | When AI detects conflict and escalates             |

---

## Epic Collaboration Model (Prometheus-Style)

The AI and human collaborate iteratively on epic breakdown using a propose-review-execute cycle.

### Phase 1: Epic Proposal

AI analyzes requirements and proposes epic breakdown:

- Presents task titles, acceptance criteria, effort estimates
- Flags dependencies, risks, unclear requirements
- Format: comment on the epic issue with breakdown table

### Phase 2: Human Review

Human reviews the AI proposal:

- Approves, rejects, or modifies task scope
- Confirms priorities and sequencing
- Resolves ambiguities flagged by AI
- Result: written approval comment on issue

### Phase 3: AI Execution

AI executes approved breakdown:

- Creates task issues with approved titles and acceptance criteria
- Links tasks to parent epic
- Sets initial sprint fields and labels
- Posts creation summary on epic thread

### Phase 4: Task Decomposition

When a task needs further breakdown:

1. AI suggests sub-task decomposition, human confirms scope
2. AI creates task issues under approved epic
3. AI starts implementation (one task at a time, per issue)
4. AI reports progress via issue comments

### Blocked Epic Protocol

When AI encounters a blocked epic:

1. AI adds "blocked" label to epic issue
2. AI comments with specific blocking reason and options
3. AI assigns issue to human for priority decision
4. AI halts work on affected tasks — does NOT continue on blocked path
5. Human unblocks by commenting decision; AI resumes

---

## Review Gates

### Autonomous AI Execution (No Approval Needed)

| Gate                   | AI Action                                   |
| ---------------------- | ------------------------------------------- |
| Feature implementation | Implement, commit, push to feature branch   |
| Issue status update    | Move to In Progress or Review automatically |
| Sub-task creation      | Create when parent epic is approved         |
| PR creation            | Push branch and open PR autonomously        |
| Label assignment       | Apply from existing label set               |

### Human Approval Required Before Proceeding

| Gate                                  | Why Human Needed                        |
| ------------------------------------- | --------------------------------------- |
| Epic scope definition                 | Business context and priority decisions |
| Meta-Epic creation                    | Strategic planning authority            |
| Merge to main/develop                 | Final quality verification              |
| Architectural changes                 | Long-term technical impact              |
| Scope expansion beyond original issue | Prevents scope creep                    |
| Security-sensitive changes            | Access control and compliance           |

---

## PR Rejection Handling

When a human rejects or requests changes on a PR, AI follows this protocol:

### Step 1: Read Review Comments

```bash
gh pr view <pr-number> --comments
gh pr diff <pr-number>
```

AI reads ALL review comments before taking any action.

### Step 2: Categorize Feedback

| Feedback Type          | AI Response                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| Code change request    | Fix in feature branch, re-push                                    |
| Clarification question | Answer in PR comment, then fix if needed                          |
| Scope disagreement     | Comment asking human to clarify; do NOT change scope unilaterally |
| Architecture concern   | Escalate — do NOT implement alternative without human approval    |

### Step 3: Implement Fixes

```bash
git add .
git commit -m "fix: address PR review comments - refs #<issue>"
git push origin <branch>
```

### Step 4: Update Issue Status

```bash
gh issue edit <issue-number> --add-label "review"
```

### Step 5: Notify Reviewer

```bash
gh pr comment <pr-number> --body "Review comments addressed. Ready for re-review."
```

### Step 6: Re-request Review

```bash
gh pr edit <pr-number> --add-reviewer <reviewer>
```

AI does NOT:

- Self-approve after fixing
- Force-push to rewrite history
- Close and re-open the PR
- Merge without new human approval

---

## Conflict Resolution

When AI detects merge conflicts:

### Detection

```bash
git fetch origin
git diff HEAD...origin/main -- <file>
```

### Protocol

1. AI STOPS work on the conflicting branch immediately
2. AI creates a GitHub issue:
   - Title: "Merge conflict: <branch> vs main in <file>"
   - Labels: "blocked", "needs-human"
   - Body: exact files conflicting, nature of conflict
3. AI assigns the issue to the relevant human
4. AI comments on original task issue: "Blocked — see #<conflict-issue>"
5. AI does NOT attempt to auto-resolve conflicts
6. Human resolves conflict, pushes resolution
7. AI resumes from the conflict-free state

Rationale: Conflict resolution requires understanding of intent from both change sets.
Auto-resolution risks silently introducing bugs.

---

## Rate Limiting

### GitHub API Limits

| Authentication          | Requests/Hour      | Notes                                           |
| ----------------------- | ------------------ | ----------------------------------------------- |
| Authenticated (token)   | 5,000              | Standard limit for all authenticated operations |
| GraphQL (authenticated) | 5,000 points/hour  | Points vary by query complexity                 |
| Search API              | 30 requests/minute | Separate limit for search endpoints             |
| Unauthenticated         | 60                 | Never use unauthenticated for AI operations     |

### AI Rate Limit Behavior

1. AI batches GitHub operations where possible (prefer fewer, richer calls)
2. AI checks rate limit before bulk operations: `gh api rate_limit`
3. If approaching limit (< 100 remaining): AI pauses and reports status
4. AI never retries in tight loops — uses exponential backoff minimum 1s
5. AI prefers GraphQL for multi-field reads (fewer requests)

### Best Practices for AI Agents

- Use `gh` CLI (handles auth automatically)
- Prefer `--json` output to reduce follow-up calls
- Cache issue/PR data within a single session
- Do NOT poll for status changes — use webhooks or manual trigger

---

## Audit Trail

Every AI action on GitHub MUST reference an issue number. This is non-negotiable.

### Commit Messages

Required format:

```
<type>: <description> - fixes #<issue-number>
<type>: <description> - refs #<issue-number>
<type>: <description> - closes #<issue-number>
```

Examples:

```
feat: add user authentication - fixes #42
fix: resolve null pointer in login flow - refs #67
chore: update dependencies - refs #89
```

### Issue Comments

All AI status updates posted as issue comments must include:

- What action was taken
- Result (success/failure)
- Next step or blocker

Example format:

```
**AI Status Update**
- Action: Created PR #<pr-number> from branch feat/auth-#42
- Result: PR opened, review requested from human reviewer
- Next: Awaiting human review before merge
```

### PR Descriptions

AI-created PRs must include:

- Link to originating issue
- Summary of changes
- Testing notes
- Any known limitations

### GitHub Project Updates

All project board moves must be traceable to an issue event:

```bash
gh issue comment <number> --body "Status updated to In Progress. Branch: feat/<name>-#<number>"
```

---

## Worktree Safety Rules

When AI operates in git worktrees (isolated feature branches):

### Mandatory Isolation

- ALL file reads must use the worktree path, never the main repo path
- ALL bash commands must include workdir pointing to the worktree
- ALL LSP operations must use worktree file paths
- Sub-agent delegations must include explicit worktree context

### Safety Verification Before Operations

```bash
git rev-parse --git-common-dir   # Should differ from git rev-parse --git-dir
git branch --show-current        # Should be the feature branch, NOT main
```

### Never Do in Worktrees

- Access main repo files while working in a worktree
- Run commands without specifying workdir
- Mix operations between the main repo and the worktree

---

## Summary: Decision Tree

```
Is this a GitHub operation?
├─ YES: Does it modify main/develop?
│         ├─ YES: STOP. Human must do this.
│         └─ NO:  Does it create a new epic?
│                   ├─ YES: STOP. Human must approve first.
│                   └─ NO:  Does it require credentials/secrets?
│                             ├─ YES: STOP. Absolute prohibition.
│                             └─ NO:  AI may proceed autonomously.
│                                     Reference issue number in all actions.
└─ NO: Not governed by this document.
```

---

## Related Documentation

- `00-github-ops-agent.md` — GitHub Operations Agent configuration and capabilities
- `04-worktree-isolation-rules.md` — Worktree safety rules for AI operations
- `../commands/finish.md` — PR creation and merge workflow
- `AGENTS.md` — Issue-first development rule and agent boundaries

---

**Maintained by:** DiriCode project contributors
**Review cycle:** On any change to GitHub workflow or agent permissions
