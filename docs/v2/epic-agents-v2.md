# Epic: v2 Agent Roster Expansion (v2.0)

> Package: `@diricode/core`
> Iteration: **v2.0**
> Issue IDs: **DC-AGENT-026..DC-AGENT-037**

## Summary

Implements the remaining 12 agents from the 40-agent roster that were not included in MVP. MVP delivered 25+ agents (POC through MVP-3). v2 adds the advanced planning, QA, and utility agents that require the more mature infrastructure (hooks v2, context v2, approval system).

These agents are grouped by category for implementation order. Each agent follows the hybrid loader pattern (TS + SKILL.md) established in MVP.

Source: `analiza-agent-roster.md` — agents mapped to v2 in overview.md agent→version table.

## Issues

### DC-AGENT-026 — auto-continue agent

**Goal**: Implement the binary classifier agent that decides whether work should continue after interruption, partial response, or timeout.

**Tier**: LOW | **Category**: Command & Control | **Tags**: `orchestration`

**Scope**
- Input: current work state (last agent result, pending tasks, error state)
- Output: binary `{ continue: boolean, reason: string }`
- Use cases: after partial LLM response, after timeout, after agent crash, between pipeline phases
- Must be cheapest possible model call (single sentence reasoning)
- Integration: dispatcher calls auto-continue when uncertain whether to proceed

**Acceptance criteria**
- [ ] Returns boolean decision with reason string
- [ ] Decision takes <2s on cheapest model
- [ ] Handles: partial response, timeout, crash, phase transition scenarios
- [ ] Dispatcher correctly uses decision to continue or stop

**References**
- `analiza-agent-roster.md` Section 4.2 (auto-continue spec)
- Plandex: exec-status agent pattern

---

### DC-AGENT-027 — project-roadmapper agent

**Goal**: Implement agent that manages project at epic/issue level, generates roadmaps, and breaks epics into smaller parts.

**Tier**: MEDIUM | **Category**: Strategy & Planning | **Tags**: `planning`, `sprint-management`

**Scope**
- Reads GitHub Project board (via github-operator) to understand current state
- Generates roadmap: epic hierarchy, dependencies, estimated timeline
- Breaks large epics into smaller issues with clear acceptance criteria
- Manages nested epic hierarchy (epics → sub-epics → issues)
- Output: structured roadmap document + individual issue drafts

**Acceptance criteria**
- [ ] Reads project state from GitHub Project
- [ ] Generates multi-level epic hierarchy
- [ ] Issue drafts include acceptance criteria
- [ ] Dependencies between epics identified
- [ ] Roadmap output is structured markdown

**References**
- `analiza-agent-roster.md` Section 5.6 (project-roadmapper spec)
- GSD: roadmapper pattern

---

### DC-AGENT-028 — sprint-planner agent

**Goal**: Implement agent that prioritizes backlog, groups work into sprints, and decides what to build now vs later.

**Tier**: MEDIUM | **Category**: Strategy & Planning | **Tags**: `planning`, `sprint-management`

**Scope**
- Input: backlog (from GitHub Project), dependency graph, business value signals, risk assessments
- Analyzes: technical dependencies, business value, estimated effort, risk level
- Output: sprint plan — ordered list for current sprint + tentative next 2-3 sprints
- Highlights blocking dependencies
- Considers velocity (if historical data available from memory)

**Acceptance criteria**
- [ ] Reads and prioritizes backlog from GitHub Project
- [ ] Sprint plan respects dependency ordering
- [ ] Blocking dependencies highlighted
- [ ] Business value vs effort trade-offs explained in output
- [ ] Tentative future sprints included

**References**
- `analiza-agent-roster.md` Section 5.8 (sprint-planner spec)

---

### DC-AGENT-029 — todo-manager agent

**Goal**: Implement agent that converts plans into execution DAGs with dependencies and parallelism markers.

**Tier**: LOW | **Category**: Strategy & Planning | **Tags**: `planning`, `orchestration`

**Scope**
- Input: plan from planner-thorough or planner-quick
- Output: execution DAG — which tasks can run in parallel, which are sequential
- Manages task lifecycle: pending → in_progress → completed → failed
- Reacts to changes: if task fails, recalculates downstream dependencies
- Provides ready execution plan to dispatcher

**Acceptance criteria**
- [ ] DAG correctly identifies parallel vs sequential tasks
- [ ] Task status tracking works through full lifecycle
- [ ] Failed task triggers recalculation of dependent tasks
- [ ] Dispatcher can query for next available tasks

**References**
- `analiza-agent-roster.md` Section 5.9 (todo-manager spec)
- OpenHands: task_tracker pattern

---

### DC-AGENT-030 — file-builder agent

**Goal**: Implement specialist agent for precise file change application — diffs, patches, rewrites.

**Tier**: MEDIUM | **Category**: Code Production | **Tags**: `regular-coding`

**Scope**
- Input: planned changes (diff, patch, full rewrite instructions) from code-writer or planner
- Output: applied file changes with verification
- Retry logic: if apply fails (bad diff, conflict), retry with different strategy
- Strategies: search-and-replace, unified diff apply, full file rewrite
- Separation of concerns: code-writer THINKS, file-builder APPLIES

**Acceptance criteria**
- [ ] Applies diffs/patches accurately
- [ ] Retries with alternative strategy on failure
- [ ] Reports applied changes with before/after summary
- [ ] Handles conflict detection and reporting

**References**
- `analiza-agent-roster.md` Section 6.4 (file-builder spec)
- Plandex: builder + whole-file-builder pattern

---

### DC-AGENT-031 — spec-compliance-reviewer agent

**Goal**: Implement agent that verifies implementation matches specification exactly — nothing more, nothing less.

**Tier**: MEDIUM | **Category**: Quality Assurance | **Tags**: `review`

**Scope**
- Input: specification (plan/issue) + implemented code
- Checks three dimensions:
  1. Missing requirements — did they skip something from the spec?
  2. Extra/unneeded work — did they over-engineer beyond spec?
  3. Misunderstandings — did they solve the wrong problem?
- Does NOT trust implementer's self-report — reads actual code
- Output: compliance report with pass/fail per requirement

**Acceptance criteria**
- [ ] Reads spec and code independently (no reliance on implementer's summary)
- [ ] Identifies missing requirements with specific references
- [ ] Flags over-engineering beyond spec scope
- [ ] Produces structured compliance report
- [ ] Each spec requirement mapped to code location

**References**
- `analiza-agent-roster.md` Section 7.3 (spec-compliance-reviewer spec)

---

### DC-AGENT-032 — risk-assessor agent

**Goal**: Implement agent that evaluates security risk of operations and returns LOW/MEDIUM/HIGH classification.

**Tier**: MEDIUM | **Category**: Quality Assurance | **Tags**: `review`

**Scope**
- Input: operation description (tool call, file change, shell command)
- Output: `{ risk: 'LOW' | 'MEDIUM' | 'HIGH', factors: string[], recommendation: string }`
- Risk factors: file sensitivity (config, credentials), operation type (delete, deploy), scope (single file vs many)
- Integration with approval engine: risk level shown in approval UI
- Heuristic-based (not ML): pattern matching on paths, commands, operations

**Acceptance criteria**
- [ ] Classifies operations into LOW/MEDIUM/HIGH
- [ ] Risk factors listed for transparency
- [ ] Credential file operations always HIGH
- [ ] Destructive git ops always HIGH
- [ ] Risk level available to approval UI

**References**
- `analiza-agent-roster.md` Section 7.5 (risk-assessor spec)
- OpenHands: security_utils pattern

---

### DC-AGENT-033 — merge-coordinator agent

**Goal**: Implement agent that merges branches from multiple worktrees/sessions, resolving cross-session conflicts.

**Tier**: MEDIUM | **Category**: Quality Assurance | **Tags**: `review`, `git`

**Scope**
- Input: branches to merge, conflict information
- Checks cross-session compatibility before merge
- Resolves simple conflicts (non-overlapping changes)
- Escalates complex conflicts to user with clear explanation
- Verifies tests pass after merge

**Acceptance criteria**
- [ ] Merges non-conflicting branches automatically
- [ ] Detects and reports conflicting changes
- [ ] Simple conflicts auto-resolved (different files, non-overlapping regions)
- [ ] Complex conflicts escalated with clear diff display
- [ ] Post-merge test verification

**References**
- `analiza-agent-roster.md` Section 7.6 (merge-coordinator spec)

---

### DC-AGENT-034 — license-checker agent

**Goal**: Implement agent that checks dependency licenses and detects code copying from incompatible sources.

**Tier**: MEDIUM | **Category**: Quality Assurance | **Tags**: `review`

**Scope**
- Scans new dependencies: check SPDX license against project allowlist
- Detects: AGPL/GPL in MIT projects, missing attributions
- Scans code for copied snippets with incompatible licenses
- Output: license compliance report with violations
- Allowlist configurable in `.dc/config.jsonc`

**Acceptance criteria**
- [ ] New dependency licenses checked against allowlist
- [ ] GPL/AGPL in permissive-licensed projects flagged
- [ ] License report includes SPDX identifiers
- [ ] Allowlist configurable
- [ ] No false positives on standard MIT/Apache-2.0 deps

**References**
- `analiza-agent-roster.md` Section 7.7 (license-checker spec)
- LEGAL-001 (avoid incompatible licenses)
- `analiza-licencji.md` (license safety matrix)

---

### DC-AGENT-035 — integration-checker agent

**Goal**: Implement agent that verifies cross-system integration — "existence ≠ integration".

**Tier**: MEDIUM | **Category**: Quality Assurance | **Tags**: `review`

**Scope**
- Checks 4 integration dimensions:
  1. Exports→Imports: module A exports function, module B actually imports and calls it
  2. APIs→Consumers: endpoint exists AND frontend/client actually fetches from it
  3. Forms→Handlers: form submits to correct endpoint, handler processes correctly
  4. Data→Display: database stores data, UI component renders it
- Uses LSP (find_references) and AST-grep for verification
- Output: integration report with connected/disconnected pairs

**Acceptance criteria**
- [ ] Detects unconnected exports (exported but never imported)
- [ ] Detects unconnected APIs (endpoint exists, no consumer)
- [ ] Uses LSP for accurate reference finding
- [ ] Integration report lists all pairs with status
- [ ] Runs after multi-agent code production to verify wiring

**References**
- `analiza-agent-roster.md` Section 7.8 (integration-checker spec)
- GSD: gsd-integration-checker pattern

---

### DC-AGENT-036 — long-task-runner agent

**Goal**: Implement agent that runs long operations (tests, builds) in background, allowing other work to continue.

**Tier**: LOW | **Category**: Utility | **Tags**: `devops`

**Scope**
- Runs operations in separate process/thread
- Reports: started, progress (if available), completed/failed
- Enables parallel execution: dispatcher can start tests while code-writer continues
- Timeout handling: configurable per operation type
- Output: operation result + exit code + stdout/stderr summary

**Acceptance criteria**
- [ ] Long operations run in background without blocking pipeline
- [ ] Progress reporting for operations that support it
- [ ] Timeout kills operation and reports failure
- [ ] stdout/stderr captured and summarized
- [ ] Multiple background operations can run simultaneously

**References**
- `analiza-agent-roster.md` Section 9.5 (long-task-runner spec)
- Codex: awaiter pattern

---

### DC-AGENT-037 — github-operator agent

**Goal**: Implement agent that operates GitHub platform: PRs, issues, labels, CI status, Projects API.

**Tier**: LOW | **Category**: Utility | **Tags**: `git`, `devops`

**Scope**
- Create/update/close PRs with proper description
- Manage issues: create, label, link to epics, update status
- Read CI status and check results
- Operate GitHub Projects API (boards, columns, cards)
- Uses `gh` CLI or GitHub REST/GraphQL API
- Respects rate limits with backoff

**Acceptance criteria**
- [ ] PR creation with title, body, labels, reviewers
- [ ] Issue CRUD with epic linking
- [ ] CI status readable and interpretable
- [ ] GitHub Projects API operations work
- [ ] Rate limit handling with exponential backoff

**References**
- `analiza-agent-roster.md` Section 9.7 (github-operator spec)
- Survey features 2.3, 2.4 (REQ-IDs in GitHub Issues/Epics)

---

## Additional v2 quality/orchestration tasks anchored outside the roster list

- **DC-REVIEW-001** — Confidence-based review escalation
- **DC-MEM-008** — ReasoningBank retrieval and write path
- **DC-MEM-009** — Cross-session memory querying

These are not new roster agents themselves, but they are key v2 capabilities that the roster and review flows depend on.
