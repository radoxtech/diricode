# Epic: Agents Roster Implementation (POC → MVP-3)

> **Package**: `@diricode/core`  
> **Iteration**: POC → MVP-3  
> **Issue IDs**: DC-AGENT-001 — DC-AGENT-025  
> **Dependencies**: `epic-agents-core.md` (DC-CORE-005..012), pipeline/context/safety epics

## Summary
This epic delivers **individual agent implementations** on top of the core execution framework. Each issue defines one production agent contract (prompt intent, tools, I/O, and tier rationale).

Planning constraints:
- Rollout is progressive by iteration (POC, MVP-1, MVP-2, MVP-3).
- **ARCH-004** enforced: Plandex-style roles are explicit agents, not hidden role switches.
- POC agents are implemented in TypeScript-first runtime (no skills dependency required for initial availability).

---

## POC Agents (5)

### DC-AGENT-001: dispatcher (HEAVY)
- **Responsibility**: Central coordinator that interprets user intent and delegates to the correct specialist agent(s).
- **System prompt summary**: Route safely, avoid direct file mutation, justify delegation choice, aggregate outcomes.
- **Tools access**: Registry lookup, delegation API, EventStream emitters, cost/trace metadata tools (no direct code-edit tools).
- **Inputs / outputs**: Input = user goal + session context; Output = delegation plan + aggregated final response.
- **Tier justification**: Requires high-reasoning arbitration across ambiguous requests and multi-step workflows.
- **Key distinction**: Orchestrates *who does work*; does not perform coding/review itself.
- **Ships in**: POC.

### DC-AGENT-002: code-writer (HEAVY)
- **Responsibility**: Primary implementation agent for feature code, modifications, and coherent multi-file changes.
- **System prompt summary**: Implement requested behavior exactly, prefer minimal diffs, preserve conventions/tests.
- **Tools access**: Read/Write FS tools, AST-grep, LSP symbols/refs/rename, diagnostics, test/build command execution.
- **Inputs / outputs**: Input = task plan + target files; Output = code changes + rationale + follow-up verification notes.
- **Tier justification**: Core production path for non-trivial coding where correctness and synthesis quality matter.
- **Key distinction**: General-purpose feature implementation; escalates extreme complexity to later specialist writers.
- **Ships in**: POC.

### DC-AGENT-003: code-explorer (MEDIUM)
- **Responsibility**: Read-only codebase reconnaissance for structure, dependencies, symbols, and impact surfaces.
- **System prompt summary**: Search precisely, cite evidence paths, never invent architecture not found in repo.
- **Tools access**: Read, Glob, Grep, AST search, LSP symbols/definitions/references (read-only set).
- **Inputs / outputs**: Input = question/problem area; Output = concise findings map with file-level evidence.
- **Tier justification**: Needs reliable analysis but not premium generation power; medium balance is sufficient.
- **Key distinction**: Discovers facts in repo; does not propose broad strategy (planner) or write production code.
- **Ships in**: POC.

### DC-AGENT-004: planner-quick (MEDIUM)
- **Responsibility**: Produce fast operational plans for straightforward tasks and short execution loops.
- **System prompt summary**: Output short, verifiable step list with minimal overhead and explicit completion checks.
- **Tools access**: Lightweight repo read/search + issue/context readers; no heavy implementation toolchain required.
- **Inputs / outputs**: Input = user request + constraints; Output = compact ordered plan and success criteria.
- **Tier justification**: Moderate reasoning quality needed for correctness under speed/cost pressure.
- **Key distinction**: Optimized for speed and brevity; does not perform deep architecture/risk decomposition.
- **Ships in**: POC.

### DC-AGENT-005: summarizer (LOW)
- **Responsibility**: Compress conversation and execution history into high-signal context summaries.
- **System prompt summary**: Preserve decisions, constraints, open risks, and actionable next steps.
- **Tools access**: Conversation/history readers, context-window metadata tools (no mutation tools).
- **Inputs / outputs**: Input = long transcript/events; Output = token-efficient summary with retained commitments.
- **Tier justification**: Compression task is deterministic and cost-sensitive; low tier is optimal.
- **Key distinction**: Only context reduction specialist; not a planner or reviewer.
- **Ships in**: POC.

---

## MVP-1 Agents (+6, 11 total)

### DC-AGENT-006: planner-thorough (HEAVY)
- **Responsibility**: Deep plan synthesis with dependency/risk mapping for complex tasks.
- **System prompt summary**: Goal-backward decomposition, explicit assumptions, edge-case checkpoints, verification gates.
- **Tools access**: Full read/search stack, architecture/context views, issue/memory history access.
- **Inputs / outputs**: Input = scoped objective + repo state; Output = detailed phased plan with acceptance checks.
- **Tier justification**: High-depth reasoning and long-context synthesis justify heavy tier.
- **Key distinction**: Strategic depth over speed; counterpart to planner-quick.
- **Ships in**: MVP-1.

### DC-AGENT-007: architect (HEAVY)
- **Responsibility**: Design target module boundaries, interfaces, and integration strategy before implementation.
- **System prompt summary**: Propose structural changes, contracts, and migration path while minimizing coupling.
- **Tools access**: Code-exploration stack, architecture map/context tools, dependency/reference analysis.
- **Inputs / outputs**: Input = feature objective + current architecture; Output = implementable design blueprint.
- **Tier justification**: Cross-cutting architectural tradeoffs require high reasoning quality.
- **Key distinction**: Decides *how the system should be shaped*, not who executes or writes all code.
- **Ships in**: MVP-1.

### DC-AGENT-008: code-reviewer-thorough (HEAVY)
- **Responsibility**: Deep review for correctness, maintainability, edge cases, and security/performance concerns.
- **System prompt summary**: Perform evidence-based critique, classify severity, propose concrete remediations.
- **Tools access**: Read/search/LSP analysis, diagnostics, test-result inspection (read-first review toolset).
- **Inputs / outputs**: Input = diff + context/spec; Output = structured findings with pass/block recommendation.
- **Tier justification**: High-stakes quality gate requiring nuanced reasoning across files.
- **Key distinction**: Depth-first reviewer; broader and stricter than quick reviewer.
- **Ships in**: MVP-1.

### DC-AGENT-009: code-reviewer-quick (MEDIUM)
- **Responsibility**: Fast sanity review for obvious defects, style violations, and low-risk inconsistencies.
- **System prompt summary**: Detect high-confidence issues quickly, avoid speculative deep architectural judgments.
- **Tools access**: Read/search, lint/diagnostic outputs, diff inspection.
- **Inputs / outputs**: Input = diff snapshot; Output = concise approve/fix list.
- **Tier justification**: Useful quality filter without heavy cost; medium fits rapid throughput.
- **Key distinction**: Speed-focused triage reviewer, not comprehensive gatekeeper.
- **Ships in**: MVP-1.

### DC-AGENT-010: verifier (MEDIUM)
- **Responsibility**: Execute test/build/lint checks and interpret failures into actionable validation reports.
- **System prompt summary**: Run objective checks first, map failures to probable causes and impacted files.
- **Tools access**: Bash (safe), test/build runners, diagnostics readers, git diff/status for scope checks.
- **Inputs / outputs**: Input = change-set + verification policy; Output = pass/fail report with evidence.
- **Tier justification**: Needs reliable interpretation and triage but not heavy creative generation.
- **Key distinction**: Runtime proof of behavior; complements reviewers that analyze code statically.
- **Ships in**: MVP-1.

### DC-AGENT-011: commit-writer (LOW)
- **Responsibility**: Produce high-quality commit messages aligned to repository conventions and intent.
- **System prompt summary**: Explain why-change succinctly, follow conventional-commit style, avoid noise.
- **Tools access**: Git diff/log/status readers; no mutation required.
- **Inputs / outputs**: Input = staged diff + context; Output = final commit subject/body text.
- **Tier justification**: Narrow NLP formatting task, ideal for low-cost tier.
- **Key distinction**: Message authoring only; no git command execution.
- **Ships in**: MVP-1.

---

## MVP-2 Agents (+4, 15 total)

### DC-AGENT-012: git-operator (MEDIUM)
- **Responsibility**: Execute safe git workflows (branching, staging, commits, merges/rebases) under policy rails.
- **System prompt summary**: Prefer non-destructive commands, verify state before/after each operation.
- **Tools access**: Git CLI operations with safety checks and policy guards.
- **Inputs / outputs**: Input = git task intent + repo state; Output = operation log + resulting branch/status.
- **Tier justification**: Operational judgment with risk implications warrants medium reliability.
- **Key distinction**: Performs git actions directly; commit-writer only drafts text.
- **Ships in**: MVP-2.

### DC-AGENT-013: debugger (HEAVY)
- **Responsibility**: Systematically isolate root causes and produce minimal, validated fixes for complex defects.
- **System prompt summary**: Reproduce first, form hypotheses, test one variable at a time, prove root cause.
- **Tools access**: Full read/edit/test stack, logs, diagnostics, targeted runtime command execution.
- **Inputs / outputs**: Input = failing behavior + evidence; Output = root-cause report + fix + regression check plan.
- **Tier justification**: Complex causal reasoning and iterative analysis justify heavy tier.
- **Key distinction**: Investigation-first workflow; not generic feature implementation.
- **Ships in**: MVP-2.

### DC-AGENT-014: test-writer (MEDIUM)
- **Responsibility**: Create robust tests (unit/integration/regression) that encode expected behavior and prevent regressions.
- **System prompt summary**: Prefer failing-test-first approach, isolate behavior, keep tests deterministic.
- **Tools access**: Read/write test files, test runners, coverage outputs, diagnostics.
- **Inputs / outputs**: Input = feature/bug requirements; Output = test suite additions and execution notes.
- **Tier justification**: Requires reasoning precision with moderate complexity; medium cost-quality fit.
- **Key distinction**: Produces validation artifacts (tests), not production feature code.
- **Ships in**: MVP-2.

### DC-AGENT-015: project-builder (HEAVY)
- **Responsibility**: Conduct requirement discovery and synthesize actionable project initialization plans.
- **System prompt summary**: Clarify goals/constraints, expose assumptions, convert discussion into implementable scope.
- **Tools access**: Context/memory readers, planning templates, issue-generation helpers.
- **Inputs / outputs**: Input = high-level project intent; Output = scoped requirements + initial execution backlog.
- **Tier justification**: Ambiguous early-stage synthesis and tradeoff framing require heavy reasoning.
- **Key distinction**: Front-door discovery specialist; upstream of planner-thorough execution design.
- **Ships in**: MVP-2.

---

## MVP-3 Agents (+10, 25 total)

### DC-AGENT-016: prompt-validator (MEDIUM)
- **Responsibility**: Validate prompt completeness/consistency before planning starts.
- **System prompt summary**: Detect ambiguity, contradictions, missing constraints, and unsafe assumptions.
- **Tools access**: Prompt/context analyzers, policy/rule references, memory lookups.
- **Inputs / outputs**: Input = raw user prompt; Output = validation report + clarification checklist.
- **Tier justification**: Structured analysis task with moderate reasoning depth.
- **Key distinction**: Guards input quality pre-plan; plan-reviewer evaluates plans post-creation.
- **Ships in**: MVP-3.

### DC-AGENT-017: plan-reviewer (MEDIUM)
- **Responsibility**: Review generated plans for completeness, verifiability, and logical consistency.
- **System prompt summary**: Audit step order/dependencies and enforce measurable acceptance checkpoints.
- **Tools access**: Plan artifacts, dependency graph views, requirements references.
- **Inputs / outputs**: Input = draft plan + requirements; Output = approve/reject with corrections.
- **Tier justification**: Analytical QA role with moderate complexity.
- **Key distinction**: Reviews planning artifacts, not code diffs.
- **Ships in**: MVP-3.

### DC-AGENT-018: code-writer-hard (HEAVY)
- **Responsibility**: Solve exceptionally complex implementation tasks (algorithms, race conditions, deep refactors).
- **System prompt summary**: Spend more effort on design/proof, include risk controls and validation strategy.
- **Tools access**: Full engineering stack (edit/search/LSP/tests/build/debug aids).
- **Inputs / outputs**: Input = hard-task brief + constraints; Output = robust implementation with safety notes.
- **Tier justification**: Highest complexity coding demands premium model capability.
- **Key distinction**: Escalation path for complexity beyond standard code-writer scope.
- **Ships in**: MVP-3.

### DC-AGENT-019: code-writer-quick (MEDIUM)
- **Responsibility**: Execute small, local code edits rapidly (typos, simple renames, narrow patches).
- **System prompt summary**: Minimize latency and diff size; avoid broad refactors or architecture changes.
- **Tools access**: Lightweight edit/read/search tools, diagnostics for quick validation.
- **Inputs / outputs**: Input = micro-task edit request; Output = focused patch and quick verification.
- **Tier justification**: Needs better reliability than low tier while staying cost-efficient and fast.
- **Key distinction**: Micro-change specialist; distinct from deep or broad feature implementation agents.
- **Ships in**: MVP-3.

### DC-AGENT-020: creative-thinker (HEAVY)
- **Responsibility**: Generate unconventional solution options when standard approaches stall.
- **System prompt summary**: Produce multiple novel strategies with tradeoffs, constraints, and risks.
- **Tools access**: Research/context readers, architecture references, optional web/docs lookup.
- **Inputs / outputs**: Input = blocked/problematic objective; Output = ranked alternative solution set.
- **Tier justification**: High-divergence reasoning and synthesis quality benefit from heavy tier.
- **Key distinction**: Exploration of novel approaches, not default execution path.
- **Ships in**: MVP-3.

### DC-AGENT-021: frontend-specialist (HEAVY)
- **Responsibility**: Deliver high-quality UI/UX implementation across accessibility, responsiveness, and visual polish.
- **System prompt summary**: Prioritize usability, semantics, interaction quality, and design-system consistency.
- **Tools access**: Frontend code tools, browser testing (Playwright), screenshots/DOM inspection, lint/tests.
- **Inputs / outputs**: Input = UI requirement + existing components; Output = production-ready frontend changes.
- **Tier justification**: Complex visual+interaction synthesis and cross-state UX behavior justify heavy tier.
- **Key distinction**: Dedicated UI/UX depth versus generalist code-writing.
- **Ships in**: MVP-3.

### DC-AGENT-022: refactoring-agent (MEDIUM)
- **Responsibility**: Improve code structure without behavior changes (rename/extract/move/simplify patterns).
- **System prompt summary**: Preserve semantics, keep tests green, apply safe mechanical transformations first.
- **Tools access**: LSP rename/refs/defs, AST-grep replace/search, diagnostics, test runners.
- **Inputs / outputs**: Input = refactor objective + target scope; Output = semantics-preserving structural patch.
- **Tier justification**: Precision and tooling skill matter more than heavy creative generation.
- **Key distinction**: Behavior-preserving cleanup specialist, separate from feature delivery.
- **Ships in**: MVP-3.

### DC-AGENT-023: web-researcher (MEDIUM)
- **Responsibility**: Gather external technical evidence (docs, APIs, examples) to unblock implementation decisions.
- **System prompt summary**: Prefer primary sources, cite links, summarize applicability and caveats.
- **Tools access**: Web search/fetch, URL analyzers, documentation extraction tools.
- **Inputs / outputs**: Input = research question; Output = sourced brief with actionable recommendations.
- **Tier justification**: Requires synthesis and source triage beyond low-tier summarization.
- **Key distinction**: External-knowledge specialist; code-explorer is repo-internal only.
- **Ships in**: MVP-3.

### DC-AGENT-024: browser-agent (MEDIUM)
- **Responsibility**: Execute browser interactions for UI testing, flow validation, and dynamic content inspection.
- **System prompt summary**: Interact deterministically, capture artifacts, report reproducible UI findings.
- **Tools access**: Playwright/browser automation, screenshot capture, page state extraction.
- **Inputs / outputs**: Input = navigation/test scenario; Output = interaction log + evidence artifacts.
- **Tier justification**: Procedural reliability and moderate interpretation needs fit medium tier.
- **Key distinction**: Performs live browser actions; web-researcher primarily reads web content.
- **Ships in**: MVP-3.

### DC-AGENT-025: codebase-mapper (MEDIUM)
- **Responsibility**: Produce structural maps/documentation of codebase modules, flows, and boundaries.
- **System prompt summary**: Describe what exists now (present tense), cite files/symbols, avoid speculative design.
- **Tools access**: Read/search/LSP graphing tools, architecture summary generators.
- **Inputs / outputs**: Input = repository scope/focus area; Output = architecture map and navigable technical summary.
- **Tier justification**: Broad synthesis across many files needs medium reasoning without heavy generation cost.
- **Key distinction**: Documentation-level structural synthesis; code-explorer answers narrower point queries.
- **Ships in**: MVP-3.

---

## Must NOT
- Must NOT redefine agent runtime/lifecycle contracts already owned by `epic-agents-core.md`.
- Must NOT collapse distinct roles into a single polymorphic “mega-agent” (ARCH-004).
- Must NOT introduce skills-system hard dependency for initial POC agent availability.
- Must NOT break tier policy (HEAVY/MEDIUM/LOW) from configured model mapping.

## Dependencies (Epic-level)
- Upstream: DC-CORE-005..012.
- Downstream: pipeline phases, observability agent tree, web UI live execution views.
