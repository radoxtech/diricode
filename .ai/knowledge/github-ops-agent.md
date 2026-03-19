# GitHub Operations Agent Configuration

**Purpose:** Cost-effective GitHub issue and PR management using GPT-5 mini from Copilot subscription

**Created:** 2026-03-17  
**Status:** Active

---

## Overview

The `github-ops` agent is specifically configured to handle GitHub-related operations without consuming expensive Sisyphus tokens (Claude Sonnet 4.5). Instead, it uses GPT-5 mini from your GitHub Copilot subscription.

### Why This Matters

- **Cost Savings:** GPT-5 mini is significantly cheaper than Claude Sonnet 4.5
- **Copilot Subscription:** Utilizes your existing GitHub Copilot plan
- **Appropriate Complexity:** GitHub CLI operations don't require advanced reasoning
- **Token Preservation:** Saves Sisyphus tokens for complex DiriCode development tasks

---

## Configuration

### Agent Definition

**File:** `opencode.json`

```json
{
  "agent": {
    "github-ops": {
      "model": "github-copilot/gpt-5-mini",
      "temperature": 0.3,
      "permissions": ["bash"],
      "description": "GitHub issue and PR management using cost-effective GPT-5 mini",
      "prompt_append": "You are responsible for GitHub operations in DiriCode: creating/updating issues, merging PRs, managing GitHub Projects. Always link commits to issues. Use 'gh' CLI commands for all operations. Be concise and efficient. Follow AI Collaboration Model: respect human gates, enforce issue-first development, update status via issue comments."
    }
  }
}
```

### Skill Registry

**File:** `.ai/skill-registry.json`

```json
{
  "github-ops": {
    "keywords": [
      "github issue",
      "create issue",
      "update issue",
      "merge pr",
      "merge pull request",
      "github merge",
      "close issue",
      "issue management",
      "pr management",
      "github project",
      "issue tracking",
      "sprint",
      "issues",
      "priority",
      "gh",
      "github cli",
      "issue priority",
      "sprint planning",
      "backlog",
      "milestone",
      "label",
      "assignee",
      "project board",
      "issue status",
      "pr review",
      "pull request review"
    ],
    "agent": "github-ops",
    "priority": 3,
    "description": "GitHub issue management and PR operations using GPT-5 mini (cost-effective)"
  }
}
```

---

## Automatic Activation

The `github-ops` agent **automatically activates** when you use keywords like:

- "create a GitHub issue"
- "update issue #123"
- "merge this PR"
- "close the pull request"
- "manage GitHub issues"

**Example:**

```
User: "Create a GitHub issue for the new authentication feature"

System: [Auto-detects "github issue" keyword]
        [Loads github-ops skill]
        [Delegates to github-ops agent (GPT-5 mini)]
        [Agent creates issue using gh CLI]
```

---

## Manual Delegation

You can also manually delegate GitHub operations to this agent:

### Using Task Tool

```typescript
// Delegate to github-ops agent
task({
  subagent_type: 'github-ops',
  description: 'Create GitHub issue',
  prompt:
    "Create an issue for implementing API rate limiting with title 'Add rate limiting to API endpoints' and labels 'enhancement,backend'",
});
```

### Using Background Task (Recommended)

```typescript
// Run in background (non-blocking)
background_task({
  agent: 'github-ops',
  description: 'Merge PR #45',
  prompt: 'Merge pull request #45 and delete the source branch',
});
```

---

## Supported Operations

### Issue Management

- ✅ Create issues with labels, assignees, milestones
- ✅ Update issue status, labels, assignees
- ✅ Close/reopen issues
- ✅ Link issues to commits (refs #N, fixes #N, closes #N)
- ✅ Add comments to issues
- ✅ Move issues through workflow states (Backlog → In Progress → Review → Done)

### Pull Request Operations

- ✅ Create PRs from feature branches
- ✅ Merge PRs (merge, squash, rebase)
- ✅ Update PR metadata (title, body, labels)
- ✅ Request reviews from human reviewers
- ✅ Add PR comments
- ✅ Close PRs without merging

### GitHub Projects

- ✅ Update issue status in Projects
- ✅ Move issues between columns
- ✅ Add issues to Projects
- ✅ Update custom fields

---

## Example Commands

### Create Issue

```bash
gh issue create \
  --title "Add rate limiting to API endpoints" \
  --body "Implement rate limiting using token bucket algorithm to protect API from abuse" \
  --label "enhancement,backend" \
  --assignee @username
```

### Update Issue

```bash
gh issue edit 123 \
  --add-label "in-progress" \
  --add-assignee @username
```

### Merge PR

```bash
gh pr merge 45 \
  --squash \
  --delete-branch \
  --subject "feat: add rate limiting - fixes #123"
```

### Close Issue

```bash
gh issue close 123 \
  --comment "Completed in PR #45"
```

---

## Integration with AI Collaboration Model

The `github-ops` agent enforces the **AI Collaboration Model** defined in `.ai/knowledge/ai-collaboration.md`:

### Human Gates (CANNOT Do)

- ❌ Merge PRs to main/develop (human review gate is non-negotiable)
- ❌ Delete remote branches without PR merge
- ❌ Force push to any branch
- ❌ Create Meta-Epics (requires human strategic approval)
- ❌ Approve PRs (requires human judgment)
- ❌ Access credentials, secrets, or .env files

### Autonomous Operations (CAN Do)

- ✅ Create branches following naming conventions
- ✅ Create issues/tasks (must reference parent epic)
- ✅ Create pull requests from feature branches
- ✅ Update issue status (move between workflow states)
- ✅ Move items on project board
- ✅ Assign labels (existing configured labels only)
- ✅ Commit to feature branches (all commits reference issue numbers)
- ✅ Push to feature branches (own feature branches only)
- ✅ Close issues via commit messages using `fixes #N` or `closes #N` syntax
- ✅ Add comments to issues (status updates, progress notes, blockers)
- ✅ Request PR reviews (assign human reviewers)

### Before Any Implementation

```typescript
// 1. Check for existing issue
background_task({
  agent: 'github-ops',
  description: 'Find or create issue',
  prompt:
    "Search for existing issues related to 'rate limiting'. If none exist, create one with title 'Add rate limiting to API endpoints' and label 'enhancement,backend'",
});

// 2. Link commits to issue
("git commit -m 'feat: implement rate limiting - fixes #123'");

// 3. Update issue status in GitHub Project
background_task({
  agent: 'github-ops',
  description: 'Update issue status',
  prompt: "Update issue #123 status to 'In Progress' in the GitHub Project",
});
```

---

## Cost Comparison

| Model             | Provider | Cost per 1M tokens (input) | Use Case             |
| ----------------- | -------- | -------------------------- | -------------------- |
| Claude Sonnet 4.5 | Sisyphus | $3.00                      | Complex DiriCode tasks |
| GPT-5 mini        | Copilot  | $0.15                      | GitHub operations    |
| **Savings**       | -        | **95% cheaper**            | -                    |

**Example Savings:**

- 100 GitHub operations with Sisyphus: ~$0.30
- 100 GitHub operations with GPT-5 mini: ~$0.015
- **Savings: $0.285 per 100 operations**

---

## Limitations

### What github-ops Agent CANNOT Do

- ❌ Code implementation (use Sisyphus or domain-specific agents)
- ❌ Code review (use oracle or review skill)
- ❌ Complex reasoning tasks (use Sisyphus)
- ❌ File editing (no edit permissions)
- ❌ Architecture decisions (requires human judgment)
- ❌ Merge to protected branches (human gate only)

### What github-ops Agent CAN Do

- ✅ GitHub CLI commands (`gh` tool)
- ✅ Issue CRUD operations
- ✅ PR management (create, update metadata, comment)
- ✅ GitHub Project updates
- ✅ Simple bash commands for GitHub operations
- ✅ Issue-first development enforcement
- ✅ Status tracking via issue comments

---

## Best Practices

### DO

- ✅ Use for all GitHub issue/PR operations
- ✅ Run in background for non-blocking operations
- ✅ Always link commits to issues using `fixes #N`, `closes #N`, or `refs #N`
- ✅ Keep prompts concise and specific
- ✅ Verify operations with `gh` commands
- ✅ Delete the source branch after merging a PR (invoke `gh pr merge --delete-branch` to keep repository clean)
- ✅ Post status updates as issue comments
- ✅ Follow AI Collaboration Model gates (respect human merge gate)
- ✅ Reference parent epics when creating sub-tasks
- ✅ Update sprint fields on issues within approved scope

### DON'T

- ❌ Use for code implementation or complex logic
- ❌ Use for code review or approval decisions
- ❌ Mix with file editing operations
- ❌ Expect advanced reasoning capabilities
- ❌ Use for security-sensitive operations requiring validation
- ❌ Merge to main/develop (wait for human review and approval)
- ❌ Force push or rewrite history
- ❌ Access or commit credentials/secrets
- ❌ Approve PRs or make unilateral scope decisions

---

## Monitoring Usage

### Check Agent Activity

```bash
# View recent GitHub operations
gh issue list --limit 20
gh pr list --limit 20

# Check issue-first compliance (all commits reference issues)
git log --oneline --grep="fixes #" --grep="closes #" --grep="refs #" -i | head -20
```

### Token Usage Tracking

- GPT-5 mini usage appears in Copilot billing
- Sisyphus tokens preserved for complex DiriCode development
- Monitor savings in OpenCode logs

---

## Troubleshooting

### Issue: Agent Not Activating

**Symptoms:** Sisyphus handles GitHub operations instead of github-ops

**Solution:**

1. Check keyword matching in prompt (use "github issue", not just "issue")
2. Manually specify agent: `Use the github-ops agent to create this issue`
3. Verify skill-registry.json has correct keywords

### Issue: Permission Denied

**Symptoms:** Agent cannot execute `gh` commands

**Solution:**

1. Verify GitHub CLI authentication: `gh auth status`
2. Check permissions in opencode.json: `"permissions": ["bash"]`
3. Re-authenticate with proper token: `gh auth login --web`
4. Verify token has repo and workflow scopes

### Issue: Commands Fail

**Symptoms:** `gh` commands return errors (e.g., "no matching repositories")

**Solution:**

1. Test command manually: `gh issue create --help`
2. Check repository context: `gh repo view`
3. Verify issue/PR exists: `gh issue view 123`
4. Ensure working in correct worktree or repository directory

### Issue: Merge Conflicts

**Symptoms:** Cannot merge PR due to conflicts

**Solution:**

1. AI MUST STOP work immediately upon detecting conflicts
2. AI creates GitHub issue with title "Merge conflict: <branch> vs main"
3. AI assigns "blocked" and "needs-human" labels
4. AI comments on original task: "Blocked — see #<conflict-issue>"
5. Human resolves conflict and pushes resolution
6. AI resumes work from conflict-free state

---

## Authentication Setup

### Prerequisites

1. GitHub CLI installed: `brew install gh`
2. GitHub Copilot subscription active
3. GitHub personal access token with repo scope

### Configuration

1. Authenticate with GitHub CLI:
   ```bash
   gh auth login --web
   ```

2. Verify authentication:
   ```bash
   gh auth status
   ```

3. Store token in secure location (typically ~/.config/gh/hosts.yml automatically handled by gh CLI)

### Token Placeholder Usage

In scripts or documentation, use placeholder for sensitive tokens:

```bash
# Example (do NOT use real token)
export GITHUB_TOKEN=<YOUR_GITHUB_TOKEN>
gh pr create --title "New feature" --body "Description"
```

Never commit real tokens to repository.

---

## Related Documentation

- **`.ai/knowledge/ai-collaboration.md`:** AI Collaboration Model and human gates
- **`opencode.json`:** Agent and skill configuration
- **`.ai/skill-registry.json`:** Skill activation keywords
- **`AGENTS.md`:** Issue-first development rule
- **`04-worktree-isolation-rules.md`:** Worktree safety rules for AI operations

---

**Last Updated:** 2026-03-17  
**Version:** 1.0.0  
**Agent:** github-ops (GPT-5 mini)  
**Status:** Active for DiriCode development
