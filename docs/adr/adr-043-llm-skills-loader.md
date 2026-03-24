## ADR-043 — LLM-Based Skill Loader and Router

| Field       | Value                        |
|-------------|------------------------------|
| Status      | Accepted                     |
| Date        | 2026-03-22                   |
| Scope       | MVP                          |
| References  | [ADR-004](adr-004-agent-roster-3-tiers.md), [ADR-008](adr-008-skill-system-agentskills-io.md), [epic-skills.md](../mvp/epic-skills.md) |

### Context

DiriCode uses a system of 40+ specialized agents and an extensible skill system based on `SKILL.md` (compatible with agentskills.io). As the number of available skills and tools grows, including all skill definitions in every agent's system prompt becomes prohibitively expensive in terms of context tokens and can degrade model performance due to prompt "noise."

We need a strategy to dynamically select and load only the relevant skills for a given task, ensuring that "heavy" models focus their context on the actual work while a more efficient mechanism handles the routing.

### Decision

We will implement an LLM-based Skill Router that uses a **LOW tier** model (e.g., Haiku 4.5, DeepSeek V3.2) to analyze the user's task and select the necessary skills before the main **HEAVY** or **MEDIUM** agent is invoked.

**Key components:**

1.  **Skill Metadata Index:** A lightweight index (stored in the SQLite memory layer) containing the name, description, and capability tags of all available built-in and custom skills (`.dc/skills/`).
2.  **LOW-Tier Router:** A specialized utility agent that receives the task description and the skill index. It outputs a list of required skill IDs.
3.  **Dynamic Loader:** The dispatcher use the Router's output to fetch the full `SKILL.md` / `SkillDefinition` objects and inject them into the target agent's context.
4.  **Token Budgeting:** The router is constrained to select at most 3-5 skills to prevent context bloat.

**Routing Workflow:**
1.  Dispatcher receives a task.
2.  Dispatcher calls the `SkillRouter` (LOW tier).
3.  `SkillRouter` returns `['git-master', 'frontend-specialist']`.
4.  Dispatcher loads these skills and spawns the target agent (HEAVY/MEDIUM) with the injected instructions and tools.

### Consequences

- **Positive:** Significant reduction in context token usage for heavy models.
- **Positive:** Improved model focus on the task by removing irrelevant tool/skill definitions.
- **Positive:** Scalability to hundreds of skills without hitting context limits.
- **Negative / Trade-offs:** Adds a small amount of latency (one LOW-tier LLM call) before the main agent starts.
- **Negative / Trade-offs:** Potential for "routing misses" if the LOW-tier model fails to identify a relevant skill.

### Details

**Router Prompt Strategy:**
The router uses a "classification-style" prompt:
```text
Given the task: "{{task}}"
And the following available skills:
- git-master: Safe git workflows, commits, diffs.
- frontend-specialist: React, TS, CSS, accessibility.
...
Select the 1-3 most relevant skills. Return ONLY a JSON array of skill IDs.
```
