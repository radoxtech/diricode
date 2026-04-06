# ADR-056 — Tiered Specialist Agents: Junior / Mid / Senior E2E Execution

| Field       | Value                                                                                             |
|-------------|---------------------------------------------------------------------------------------------------|
| Status      | **Accepted**                                                                                      |
| Date        | 2026-04-06                                                                                        |
| Scope       | MVP+v2                                                                                            |
| References  | Router pattern (AgentPatterns.tech), Infralovers 57% cost cut, Stanford CS146S Autonomy Spectrum, Fazm Opus orchestrator, Unprompted Mind model stacking, heyuan110 4 patterns |

---

## Context

### The Problem

When a single orchestrator routes tasks to specialized agents, two architectural choices exist:

1. **Orchestrator-Worker** — one task decomposed and executed by multiple agents in parallel, results merged by orchestrator
2. **Router** — orchestrator classifies task complexity and dispatches to exactly one agent that handles it E2E

Choice 1 (Orchestrator-Worker) suffers from CooperBench findings: ~50% lower success rates in multi-agent collaboration vs solo execution. Root causes: communication breakdown (26%), commitment failures (32%), expectation failures (42%).

Choice 2 (Router) is simpler and more reliable per-agent, but raises the question: **how do we match task complexity to agent capability efficiently?**

### The Opportunity

Literature consistently shows:
- **Different models excel at different complexity levels** — Haiku for extraction/classification, Sonnet for structured reasoning, Opus for deep/strategic reasoning
- **Prompts must be calibrated to model capability** — a prompt optimized for Opus will underperform on Haiku (and vice versa)
- **Separation of concerns reduces context pollution** — an agent trained for simple tasks doesn't accumulate irrelevant state from complex reasoning

The gap: **no explicit pattern for E2E specialist agents where each agent's instruction set is co-designed with its target model tier.**

---

## Decision

### Core Pattern: Tiered Specialist Router

```
User Request
    ↓
┌─────────────────────────────────────────────────────────┐
│                    Orchestrator                          │
│  (classifies complexity: LOW / MEDIUM / HIGH)           │
│  (selects appropriate specialist agent)                   │
└──────────────────────┬───────────────────────────────────┘
                       ↓
    ┌──────────────────┼──────────────────┐
    ↓                  ↓                  ↓
┌─────────┐      ┌───────────┐     ┌──────────┐
│ Junior  │      │    Mid    │     │  Senior  │
│ Agent   │      │   Agent   │     │  Agent   │
│(Haiku)  │      │ (Sonnet)  │     │ (Opus)   │
└────┬────┘      └─────┬─────┘     └────┬─────┘
     ↓                 ↓                 ↓
  E2E execution    E2E execution     E2E execution
```

**Rule:** Orchestrator picks ONE specialist agent. That agent handles the task E2E. No worker sub-agents, no result merging.

### Tier Definitions

| Tier | Model Class | Instruction Style | Task Profile |
|------|-------------|-------------------|--------------|
| **Junior** | Haiku 4.5, Gemini Flash 2.0, GPT-4o-mini | Short, concrete, step-by-step. No ambiguity. Explicit constraints. | Extraction, formatting, simple transforms, naming, boilerplate, single-file edits, lint fixes |
| **Mid** | Sonnet 4.6, Kimi 2.5, GPT-5.4-mini, Codex | Goal + context + constraints. Model decides approach. Moderate initiative. | Feature implementation, refactoring, multi-file changes, test writing, code review (non-critical) |
| **Senior** | Opus 4.6, Claude 4.5 Sonnet-max, GPT-5.4 | High-level objective. Model plans own approach. Strategic reasoning. Self-directed. | Architecture decisions, security-critical review, complex multi-system changes, performance optimization |

### Per-Specialization Agent Roster

Each specialization (frontend, backend, devops, etc.) gets three agent variants:

```
frontend-junior    → Haiku + concrete-step prompts
frontend-mid       → Sonnet + goal-context-constraints prompts  
frontend-senior    → Opus  + high-level-objective prompts

backend-junior     → Haiku + concrete-step prompts
backend-mid        → Sonnet + goal-context-constraints prompts
backend-senior     → Opus  + high-level-objective prompts

devops-junior      → Haiku + concrete-step prompts
devops-mid         → Sonnet + goal-context-constraints prompts
devops-senior      → Opus  + high-level-objective prompts
```

### Instruction Design Principles by Tier

#### Junior (Haiku) — "Concrete Execution Agent"

```markdown
## Role
You are a precise code implementation agent. You execute well-defined tasks exactly as specified.

## Instruction Style
- KISS: Keep instructions short, no preamble
- Step-by-step: numbered steps when task has 2+ steps
- Explicit constraints: "do X, don't do Y"
- No ambiguity: if unsure, ask
- No reasoning monologue in output

## Task Types
- "Add type annotation to function X"
- "Rename variable Y to Z in file W"
- "Fix lint error on line 42"
- "Write unit test for function calculateTotal"
- "Extract props interface from component UserCard"
```

#### Mid (Sonnet) — "Goal-Oriented Implementation Agent"

```markdown
## Role
You are a skilled software engineer. You understand the goal and implement it following project conventions.

## Instruction Style
- Goal + context + constraints: describe what, provide relevant context, specify boundaries
- Model decides approach: trust the model to choose implementation strategy
- Moderate initiative: suggest improvements but stay in scope
- Reference existing patterns: "follow the style in src/utils/"

## Task Types
- "Implement the UserProfile component with avatar, name, and bio fields"
- "Refactor the auth module to use the new token service"
- "Add error handling to all API endpoints in users.ts"
- "Write integration tests for the checkout flow"
- "Review this PR for performance issues"
```

#### Senior (Opus) — "Strategic Technical Agent"

```markdown
## Role
You are a principal engineer. You analyze, plan, and execute complex technical work with minimal guidance.

## Instruction Style
- High-level objective only: describe the outcome, not the path
- Self-directed planning: model identifies files, approach, risks
- Strategic reasoning: consider tradeoffs, scalability, maintainability
- Initiative expected: propose improvements, flag concerns, architect solutions
- Minimal constraints: broad boundaries, model owns the solution design

## Task Types
- "Design the authentication architecture for microservices migration"
- "Investigate and fix the memory leak in the worker pool"
- "Review this entire feature for security vulnerabilities"
- "Optimize the database query pattern for the reporting module"
- "Plan the migration from REST to GraphQL for the platform"
```

### Orchestrator Routing Logic

```typescript
type Complexity = "LOW" | "MEDIUM" | "HIGH";

function classifyTask(task: Task, context: CodebaseContext): Complexity {
  // LOW: single file, well-defined, reversible, no systemic impact
  if (task.scope === "single-file" && task.type === "edit" && !task.risky) {
    return "LOW";
  }
  
  // HIGH: multi-file, architectural, security-sensitive, irreversible
  if (task.scope === "multi-file" || task.security || task.architectural) {
    return "HIGH";
  }
  
  // MEDIUM: default — feature work, refactoring, testing
  return "MEDIUM";
}

function route(task: Task, context: CodebaseContext): Agent {
  const complexity = classifyTask(task, context);
  const specialization = determineSpecialization(task);
  
  return agents[`${specialization}-${complexity.toLowerCase()}`];
}
```

### Routing vs Orchestrator-Worker

| Dimension | Router (This ADR) | Orchestrator-Worker |
|-----------|-------------------|---------------------|
| Agents per task | 1 (E2E) | Many (parallel/sequential) |
| Communication overhead | None | High (CooperBench: 50% penalty) |
| Context pollution | Minimal (agent stays in lane) | High (shared state) |
| Reliability | Higher (simpler execution) | Lower (coordination failures) |
| Cost efficiency | Optimized per tier | May over-provision all workers |
| Best for | Well-scoped tasks | Massively parallel independent work |
| Quality ceiling | Limited by single agent | Higher (if coordination works) |

**Decision:** Use Router for all MVP tasks. Switch to Orchestrator-Worker only when evidence shows tasks genuinely require parallel decomposition and coordination succeeds reliably.

---

## Consequences

### Positive

1. **Cost optimization** — Haiku-tier agents cost ~60-80% less than Sonnet/Opus. Literature shows 57% cost cuts with static model routing (Infralovers).
2. **Context isolation** — Each agent has independent context. No cross-pollution between simple and complex tasks.
3. **Instruction clarity** — Prompts can be precisely calibrated to model capability. Haiku gets step-by-step; Opus gets objectives.
4. **Debugging simplicity** — One agent E2E. Failures are traceable to a single agent execution, not coordination breakdown.
5. **Scalable roster** — Adding a new specialization (e.g., `mobile`) means adding 3 agents (junior/mid/senior), not rearchitecting the whole system.
6. **Model improvement resilience** — When Haiku improves, only the junior agent prompt may need recalibration. Senior/mid agents remain stable.

### Negative

1. **More agents to maintain** — N specializations × 3 tiers = 3N agent definitions. With 10 specializations, that's 30 agents.
2. **Boundary ambiguity** — Some tasks sit on tier boundaries. Misclassification sends LOW tasks to HIGH agents (cost) or HIGH to LOW (quality).
3. **No cross-tier collaboration** — A junior agent cannot escalate to senior mid-task. Must fail and retry with different agent.
4. **Instruction engineering overhead** — Each tier needs distinct prompt engineering. May need benchmarks per tier to validate prompt effectiveness.
5. **Orchestrator classification is single point of failure** — If the router misclassifies, the wrong agent handles the task.

### Mitigations

| Risk | Mitigation |
|------|------------|
| Tier boundary ambiguity | Default to higher tier for ambiguous tasks; monitor and adjust thresholds |
| No escalation mid-task | Implement retry-with-tier-escalation: if agent fails confidence check, re-route to higher tier |
| Agent proliferation | Standardize tier templates; differ only in prompt and model selection, not structure |
| Routing misclassification | Log all routing decisions; A/B test classification thresholds quarterly |

---

## Implementation Notes

### Phase 1 (MVP)

Start with 2-3 specializations (e.g., `frontend`, `backend`) × 3 tiers = 6-9 agents. Monitor routing patterns before expanding.

### Phase 2

Add `devops`, `research`, `quality` specializations. Implement cost tracking per tier to validate savings.

### Phase 3

Full roster across all planned specializations. Automated prompt tuning per tier based on success rate benchmarks.

### Metrics to Track

| Metric | Target |
|--------|--------|
| Tier distribution | ~60% LOW, ~30% MEDIUM, ~10% HIGH (industry average from Infralovers) |
| Cost per task | 50%+ reduction vs single-tier deployment |
| Routing accuracy | >90% of tasks completed by first-selected tier |
| Escalation rate | <5% of tasks require re-routing to higher tier |

---

## References

- [AgentPatterns.tech — Router vs Orchestrator](https://www.agentpatterns.tech/en/agent-patterns/orchestrator-agent)
- [Infralovers — 57% Cost Cut with Model Routing](https://www.infralovers.com/blog/2026-02-19-ki-agenten-modell-optimierung/)
- [Fazm — Opus as Orchestrator, Context Window Management](https://fazm.ai/blog/opus-orchestrator-delegate-sonnet-haiku-cost)
- [Unprompted Mind — Stacking Claude Models (Haiku/Sonnet/Opus)](https://www.unpromptedmind.com/stacking-claude-models-workflow-optimization/)
- [heyuan110 — 4 Orchestration Patterns That Work](https://www.heyuan110.com/posts/ai/2026-02-26-multi-agent-orchestration/)
- [Stanford CS146S — Autonomy Spectrum](https://cs146s.stanford.edu)
- [CooperBench — Multi-Agent Collaboration Success Rates (arXiv:2601.13295)](https://arxiv.org/abs/2601.13295)

---

## Change Log

| Date | Change |
|------|--------|
| 2026-04-06 | Initial acceptance |
