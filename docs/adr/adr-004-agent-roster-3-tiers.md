# ADR-004 — 40-Agent Roster with 3 Tiers

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-agent-roster.md, analiza-plandex-roles.md |

### Context

The agent roster was designed through analysis of 8 reference tools (Aider, Cline, Codex, Claude Code, OpenCode/OMO, OpenHands, Plandex, GSD) and Plandex role mapping. Agents are assigned to 3 model tiers (HEAVY, MEDIUM, LOW) based on task complexity and cost requirements.

### Decision

**40 agents** organized into **6 categories** and **3 model tiers**.

#### Categories and Agents

**Command & Control (2)**

| Agent | Tier | Tag | Description |
|-------|------|-----|-------------|
| dispatcher | HEAVY | orchestration | Routes tasks, manages execution flow |
| auto-continue | MEDIUM | orchestration | Autonomous continuation decisions |

**Strategy & Planning (9)**

| Agent | Tier | Tag | Description |
|-------|------|-----|-------------|
| planner-thorough | HEAVY | planning | Goal-backward deep analysis, strategic plan |
| planner-quick | MEDIUM | planning | Fast operational plan, low-cost |
| architect | HEAVY | planning | Smart context — decides files per subtask |
| prompt-validator | MEDIUM | quality | Validates prompt quality before execution |
| plan-reviewer | HEAVY | quality | Reviews plans for completeness and feasibility |
| project-roadmapper | MEDIUM | planning | Creates project roadmaps from requirements |
| project-builder | HEAVY | planning | End-to-end project scaffolding |
| sprint-planner | MEDIUM | planning | Breaks roadmap into sprints/iterations |
| todo-manager | LOW | utility | Manages task lists and tracking |

**Code Production (9)**

| Agent | Tier | Tag | Description |
|-------|------|-----|-------------|
| code-writer | HEAVY | coding | Primary coder (structured-edit + whole-file modes) |
| code-writer-hard | HEAVY | coding | Complex tasks requiring different workflow |
| code-writer-quick | MEDIUM | coding | Simple edits, boilerplate |
| file-builder | MEDIUM | coding | File/directory scaffolding |
| creative-thinker | HEAVY | creative | Unconventional approaches, brainstorming |
| frontend-specialist | HEAVY | coding | UI/UX focused development |
| refactoring-agent | HEAVY | coding | Safe refactoring with verification |
| debugger | HEAVY | coding | Root cause analysis and fixing |
| test-writer | MEDIUM | coding | Test generation and coverage |

**Quality Assurance (8)**

| Agent | Tier | Tag | Description |
|-------|------|-----|-------------|
| code-reviewer-thorough | HEAVY | quality | 6-dimension review (correctness, performance, security, readability, maintainability, testability) |
| code-reviewer-quick | MEDIUM | quality | Basic sanity check, fast |
| spec-compliance-reviewer | MEDIUM | quality | Validates against requirements/spec |
| verifier | HEAVY | quality | Independent UAT/traceability validation |
| risk-assessor | MEDIUM | quality | Evaluates risk of proposed changes |
| merge-coordinator | MEDIUM | utility | Manages merge conflicts and strategy |
| license-checker | LOW | utility | Validates dependency licenses |
| integration-checker | MEDIUM | quality | Cross-module integration validation |

**Research & Exploration (4)**

| Agent | Tier | Tag | Description |
|-------|------|-----|-------------|
| code-explorer | MEDIUM | research | Codebase navigation, pattern discovery |
| web-researcher | MEDIUM | research | External documentation and examples |
| browser-agent | MEDIUM | research | Web browsing, scraping, verification |
| codebase-mapper | MEDIUM | research | Repository structure and dependency mapping |

**Utility (8)**

| Agent | Tier | Tag | Description |
|-------|------|-----|-------------|
| summarizer | LOW | utility | Conversation compaction for narrow context windows |
| commit-writer | LOW | utility | Automatic commit messages |
| namer | LOW | utility | Auto-naming (variables, files, branches) |
| issue-writer | LOW | utility | GitHub Issue creation |
| long-task-runner | MEDIUM | utility | Manages long-running background tasks |
| git-operator | MEDIUM | utility | Git operations with safety rails |
| github-operator | MEDIUM | utility | GitHub API operations |
| devops-operator | MEDIUM | utility | CI/CD, deployment operations |

#### Tier Summary

| Tier | Count | Model Class | Use Case |
|------|-------|-------------|----------|
| HEAVY | 7 | Best available (e.g., Opus 4.6, GPT-5.4) | Complex reasoning, architecture, thorough review |
| MEDIUM | 20 | Mid-range (e.g., Sonnet 4.6, Kimi 2.5) | Standard tasks, quick operations |
| LOW | 13 | Cheapest available (e.g., Haiku 4.5, DeepSeek V3.2) | Utility tasks, simple generation |

#### Tags (Individual, Not Combined)

Tags: `orchestration`, `planning`, `coding`, `quality`, `research`, `creative`, `utility`.

Each agent has exactly ONE tag.

### Consequences

- **Positive:** Fine-grained cost control. Each agent gets exactly the model tier it needs. Clear categorization simplifies family assignment.
- **Negative:** 40 agents require careful prompt engineering. Model assignment per agent adds configuration complexity (mitigated by Family Packs — ADR-005).
