# Naming Conventions

**Single source of truth for all naming rules across the workflow.**

**Version:** 1.0.0  
**Status:** Active  
**Last Updated:** 2026-03-17

---

## Table of Contents

1. [Issue Titles](#issue-titles)
2. [Branch Naming](#branch-naming)
3. [Commit Format](#commit-format)
4. [Pull Request Titles](#pull-request-titles)
5. [Label Naming](#label-naming)
6. [Sprint Naming](#sprint-naming)
7. [Worktree Directory Naming](#worktree-directory-naming)

---

## Issue Titles

Issue titles use **bracket prefixes** to indicate hierarchy level. All brackets are optional for lowest-level work, but strongly recommended for clarity.

### Bracket Prefix Format

\`\`\`
[<LEVEL>] <Description>
\`\`\`

| Bracket Prefix  | Level   | Scope                                      | Example                                               |
| --------------- | ------- | ------------------------------------------ | ----------------------------------------------------- |
| \`[Meta-Epic]\` | Level 1 | Strategic goal (quarter/year span)         | \`[Meta-Epic] Authentication & Authorization System\` |
| \`[Epic]\`      | Level 2 | Feature/capability (sprint/milestone span) | \`[Epic] User Registration Flow\`                     |
| \`[Sub-Epic]\`  | Level 3 | Decomposed feature area                    | \`[Sub-Epic] Email Verification\`                     |
| \`[Task]\`      | Level 4 | Atomic work unit                           | \`[Task] Add email validation regex\`                 |
| _(no prefix)_   | Task    | Implicit/standalone task                   | \`Fix typo in README\`                                |

### Rules

- **Meta-Epic:** Represents strategic business objectives
- **Epic:** Represents complete, shippable features
- **Sub-Epic:** Represents decomposed parts of an Epic
- **Task:** Represents atomic, completable work items
- **Implicit Task:** Any issue without bracket prefix is treated as a Task

### Format Examples

✅ Valid:
\`\`\`
[Meta-Epic] Platform Scalability Initiative
[Epic] Real-time Notifications System
[Sub-Epic] Push Notification Backend
[Task] Implement Firebase Cloud Messaging integration
Fix: Handle null timestamps in user service
\`\`\`

❌ Invalid:
\`\`\`
[meta-epic] lowercase prefix # Use correct case
[Meta Epic] space in bracket # No spaces inside brackets
Task: Use [Task] not Task: # Bracket goes first
\`\`\`

---

## Branch Naming

Branch names follow the pattern:

\`\`\`
<type>/<description>-#<issue-number>
\`\`\`

### Type Prefix

Determined by the issue's \`type:\*\` label:

| Label                  | Prefix        | Use Case            |
| ---------------------- | ------------- | ------------------- |
| \`type:bug\`           | \`fix/\`      | Bug fixes           |
| \`type:enhancement\`   | \`feat/\`     | New features        |
| \`type:refactor\`      | \`refactor/\` | Code refactoring    |
| \`type:documentation\` | \`docs/\`     | Documentation       |
| \`type:test\`          | \`test/\`     | Test additions      |
| \`type:chore\`         | \`chore/\`    | Maintenance/tooling |
| _(no type)_            | \`feat/\`     | Default to feature  |

### Description Formatting

- Use **kebab-case** (lowercase, hyphens)
- Max 50 characters (including issue number)
- Be descriptive but concise
- Replace spaces with hyphens

### Examples

✅ Valid:
\`\`\`
fix/registration-form-validation-#161
feat/user-dashboard-redesign-#245
docs/api-authentication-guide-#178
refactor/payment-service-logic-#189
test/add-edge-case-coverage-#156
chore/update-dependencies-#203
\`\`\`

❌ Invalid:
\`\`\`
feature/user-dashboard # Missing issue number
fix/Registration Form Validation-#161 # Use kebab-case, spaces
bug/123 # Missing description
feat/add-this-cool-feature-#245 # Too vague ("this cool")
\`\`\`

### Creation Command

\`\`\`bash

# Assuming type:bug label on issue #161

ISSUE_NUM=161
BRANCH_NAME="fix/registration-validation-#${ISSUE_NUM}"
git checkout -b "$BRANCH_NAME"
\`\`\`

---

## Commit Format

Commit messages follow the **Conventional Commits** pattern:

\`\`\`
<type>(<scope>): <description> - fixes #<issue>

[Optional body explaining the why]
\`\`\`

### Type (Required)

Must be one of:

| Type         | Use                      | Example                                       |
| ------------ | ------------------------ | --------------------------------------------- |
| \`feat\`     | New feature              | \`feat(auth): add two-factor authentication\` |
| \`fix\`      | Bug fix                  | \`fix(api): handle null timestamps\`          |
| \`docs\`     | Documentation            | \`docs(readme): update setup instructions\`   |
| \`refactor\` | Code refactoring         | \`refactor(payment): simplify charge logic\`  |
| \`test\`     | Test additions/changes   | \`test(user): add validation edge cases\`     |
| \`chore\`    | Maintenance/tooling      | \`chore(deps): update lodash to 4.17.21\`     |
| \`ci\`       | CI/CD changes            | \`ci(workflow): add performance benchmarks\`  |
| \`perf\`     | Performance improvements | \`perf(query): add database indexing\`        |
| \`style\`    | Formatting/whitespace    | \`style(format): fix indentation\`            |

### Scope (Optional)

Contextual area of change:

- Service/component name: \`auth\`, \`payment\`, \`user\`
- Module name: \`api\`, \`web\`, \`cli\`
- Feature area: \`dashboard\`, \`notifications\`

### Description (Required)

- Start with lowercase
- Use imperative mood ("add" not "added" or "adds")
- Max 50 characters
- No period at end

### Reference (Required)

Include issue reference:

- \`fixes #<number>\` - Closes the issue
- \`refs #<number>\` - References without closing
- \`closes #<number>\` - Closes the issue

### Examples

✅ Valid:
\`\`\`
feat(auth): add email verification - fixes #161
fix(api): handle null timestamps correctly - fixes #245
docs(readme): add quick start guide - refs #178
refactor(payment): simplify charge logic - fixes #189
test(user): add validation edge case tests - closes #156
chore(deps): update dependencies - refs #203
\`\`\`

❌ Invalid:
\`\`\`
Added new feature # No type/scope
fix: Added two-factor auth # Wrong tense
feat(a): new feature # Vague scope
feat(auth): add two-factor auth # Missing issue reference
\`\`\`

---

## Pull Request Titles

PR titles mirror issue titles using the bracket format:

\`\`\`
[<LEVEL>] <Description> - #<issue>
\`\`\`

### Format

| Level     | Format                                    | Example                                    |
| --------- | ----------------------------------------- | ------------------------------------------ |
| Meta-Epic | \`[Meta-Epic] <Description> - #<number>\` | \`[Meta-Epic] Authentication System - #1\` |
| Epic      | \`[Epic] <Description> - #<number>\`      | \`[Epic] User Registration Flow - #2\`     |
| Sub-Epic  | \`[Sub-Epic] <Description> - #<number>\`  | \`[Sub-Epic] Email Verification - #3\`     |
| Task      | \`[Task] <Description> - #<number>\`      | \`[Task] Add email validation - #4\`       |
| Implicit  | \`<Description> - #<number>\`             | \`Fix typo in README - #5\`                |

### Rules

- **Exactly match** the corresponding issue title (without repeating bracket prefix if it's already there)
- **Include issue number** at the end with \`#<number>\` format
- **Capitalize properly**: Title case for main words
- **No additional details** in PR title (details go in description body)

### Examples

✅ Valid:
\`\`\`
[Task] Add email validation regex - #161
Fix registration form clearing - #245
[Epic] User Dashboard Redesign - #178
\`\`\`

❌ Invalid:
\`\`\`
PR for email validation # Missing issue number
[Task] Add email validation regex # Missing issue number
[Task] Add email validation regex #161 # Use - #161 not #161
\`\`\`

---

## Label Naming

Labels follow three naming patterns based on category:

### Pattern 1: Level Labels

\`\`\`
level:<hierarchy-level>
\`\`\`

| Label               | Use                             |
| ------------------- | ------------------------------- |
| \`level:meta-epic\` | Strategic business objectives   |
| \`level:epic\`      | Shippable features/capabilities |
| \`level:sub-epic\`  | Decomposed feature areas        |
| \`level:task\`      | Atomic work items               |

### Pattern 2: Category Labels

\`\`\`
<category>:<value>
\`\`\`

| Category     | Values                                                 | Examples                                    |
| ------------ | ------------------------------------------------------ | ------------------------------------------- |
| \`type\`     | bug, enhancement, refactor, documentation, test, chore | \`type:bug\`, \`type:enhancement\`          |
| \`priority\` | critical, high, medium, low                            | \`priority:critical\`, \`priority:high\`    |
| \`status\`   | blocked, needs-review                                  | \`status:blocked\`, \`status:needs-review\` |
| \`sprint\`   | current, next, backlog                                 | \`sprint:current\`, \`sprint:next\`         |

### Pattern 3: Project-Specific Labels

\`\`\`
<descriptor>
\`\`\`

Custom descriptive labels for project-specific categorization:
\`\`\`
urgent-security-fix
breaking-change
api-deprecated
\`\`\`

### Rules

- **Always lowercase** in category and value
- **Use hyphens** to separate words
- **Consistent prefix** for related labels (all \`type:_\`, all \`priority:_\`)
- **Singular** for label names, not plural

### Examples

✅ Valid:
\`\`\`
level:task
type:bug
priority:critical
sprint:current
breaking-change
\`\`\`

❌ Invalid:
\`\`\`
Level:Task # Uppercase
type:bugs # Plural
Priority_High # Underscore instead of hyphen
Sprint:current # Inconsistent casing
needs review # Space instead of hyphen
\`\`\`

---

## Sprint Naming

Sprint names follow the pattern:

\`\`\`
Sprint {N}
\`\`\`

Where \`{N}\` is the sprint number (1-indexed).

### Rules

- **Capitalize** "Sprint"
- **Space** between "Sprint" and number
- **Numeric only** for sprint number (no leading zeros)
- **Sequential** from 1 upward

### Usage Locations

- **GitHub Projects**: Sprint field value
- **Labels** (deprecated in favor of ProjectV2): \`sprint:1\`, \`sprint:2\`, etc.
- **Documentation**: References like "Sprint 1", "Sprint 2"

### Examples

✅ Valid:
\`\`\`
Sprint 1
Sprint 2
Sprint 15
\`\`\`

❌ Invalid:
\`\`\`
sprint 1 # Lowercase
Sprint-1 # Hyphen instead of space
Sprint001 # Leading zeros
Iteration 1 # Wrong keyword
S1 # Abbreviated
\`\`\`

### Active Sprint

- Current/active sprint uses \`sprint:current\` label (or ProjectV2 "Current" field)
- Next planned sprint uses \`sprint:next\` label

---

## Worktree Directory Naming

Worktree directories follow the pattern:

\`\`\`
../{REPO_NAME}-#{ISSUE_NUMBER}
\`\`\`

Where:

- \`{REPO_NAME}\` = Repository name (use placeholder, not project-specific name)
- \`{ISSUE_NUMBER}\` = Issue number without \`#\` prefix

### Rules

- **Parent directory** is one level up from main repo (\`../\`)
- **Repository placeholder** — use generic placeholder, never hardcode project name
- **Hash symbol** separates repo name from issue number
- **Issue number only** — no other identifiers
- **Lowercase** repository name placeholder

### Examples

✅ Valid:
\`\`\`
../{REPO}-#161 # Generic placeholder
../{REPO}-#245 # Generic placeholder
../{REPO}-#1 # Single digit issue
../diricode-#161 # If using the exact worktree
\`\`\`

❌ Invalid:
\`\`\`
../booking-system-#161 # Hardcoded project name
../company-repo-#161 # Hardcoded company prefix
../{repo}#161 # Missing hyphen or hash
../REPO-#161 # Wrong case
../{REPO}\_161 # Underscore instead of hash
\`\`\`

### Creation Context

Worktrees are typically created by commands like \`/start-work\`:

\`\`\`bash

# Example: Creating worktree for issue #161

ISSUE_NUM=161
REPO_NAME="{REPO}" # Use placeholder or detected name
BRANCH_NAME="fix/registration-validation-#${ISSUE_NUM}"

# Create worktree in parent directory

git worktree add "../${REPO_NAME}-#${ISSUE_NUM}" "$BRANCH_NAME"
\`\`\`

---

## Cross-References

- **Hierarchy Structure:** See epic-hierarchy.md
- **Label Definitions:** See labels-and-setup.md
- **Workflow Details:** See github-workflow-export/03-gh-workflow.md
- **Start Work Command:** See github-workflow-export/01-start-work.md

---

## Verification Checklist

When creating issues, branches, commits, or PRs, verify:

- [ ] Issue titles use correct bracket prefix (or none for implicit tasks)
- [ ] Branch names follow \`<type>/<description>-#<issue>\` pattern
- [ ] Commit messages use \`<type>(<scope>): <description> - fixes #<issue>\`
- [ ] PR titles match issue titles and include \`- #<number>\`
- [ ] Labels use \`category:value\` format (or descriptive pattern)
- [ ] Sprint names are \`Sprint {N}\` format
- [ ] Worktree paths use \`../{REPO}-#<number>\` pattern
- [ ] No hardcoded project names (use placeholders)
- [ ] Consistent lowercase and kebab-case throughout
