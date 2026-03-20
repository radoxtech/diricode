# DiriCode Unified Agent Roster — Final Version

**Status**: FINAL
**Date**: 2026-03-10
**Sources**: OMO (10 agents + 8 categories), Plandex (9 roles), Aider (3 models), Codex (3 roles + review),
OpenHands (5 agents), GSD (12 agents), OpenCode, Superpowers (14 skills), awesome-claude-code registry
**Agent count**: 40

---

## Table of Contents

1. [Legend](#1-legend)
2. [Tags — full list](#2-tags--full-list-18)
3. [Master Table — all 40 agents](#3-master-table--all-40-agents)
4. [Category 1: Command & Control](#4-category-1-command--control)
5. [Category 2: Strategy & Planning](#5-category-2-strategy--planning)
6. [Category 3: Code Production](#6-category-3-code-production)
7. [Category 4: Quality Assurance](#7-category-4-quality-assurance)
8. [Category 5: Research & Exploration](#8-category-5-research--exploration)
9. [Category 6: Utility](#9-category-6-utility)
10. [Tier Summary](#10-tier-summary)
11. [Source Mapping](#11-source-mapping)
12. [Changelog](#12-changelog)

---

## 1. Legend

**Model tiers:**
- **HEAVY** — most expensive/capable model (opus-class, o3, gpt-5.x high reasoning)
- **MEDIUM** — good quality/cost ratio (sonnet-class, gpt-4.1, gemini-pro)
- **LOW** — cheapest/fastest (haiku-class, gpt-4.1-mini, flash)

**Agent naming convention (ADR-002):**
All names are descriptive English — no mythological references. Name must explain what the agent does.

---

## 2. Tags — full list (18)

| Tag | Description | Agents using it |
|-----|-------------|-----------------|
| `orchestration` | Managing agent flow and execution | dispatcher, auto-continue, todo-manager |
| `planning` | Planning, requirements, roadmap | planner-thorough, planner-quick, architect, prompt-validator, plan-reviewer, project-roadmapper, project-builder, sprint-planner, todo-manager, issue-writer |
| `difficult-coding` | Hard problems: algorithms, race conditions, complex integrations | code-writer-hard, architect, creative-thinker |
| `regular-coding` | Standard coding: new features, modifications | code-writer, file-builder, refactoring-agent |
| `quick-coding` | Trivial changes: typos, renames, single-line fixes | code-writer-quick, code-reviewer-quick |
| `review` | Reviewing code, plans, risk, licenses, spec compliance | code-reviewer-thorough, code-reviewer-quick, spec-compliance-reviewer, verifier, risk-assessor, plan-reviewer, merge-coordinator, license-checker, integration-checker |
| `docs-research` | Finding information internally and externally | code-explorer, web-researcher, browser-agent, codebase-mapper, issue-writer |
| `frontend` | UI/UX, CSS, animations, visual components | frontend-specialist, browser-agent |
| `creativity` | Unconventional, non-obvious approaches | creative-thinker |
| `devops` | Build, test, CI/CD, infrastructure operations | devops-operator, verifier, git-operator, github-operator, long-task-runner |
| `git` | Git and GitHub operations | commit-writer, git-operator, github-operator, merge-coordinator |
| `summarization` | Summarizing conversations and context | summarizer |
| `naming` | Naming sessions, plans, branches | namer |
| `debugging` | Finding and fixing bugs systematically | debugger, code-writer-hard, verifier, code-explorer |
| `refactoring` | Restructuring code without changing behavior | refactoring-agent, code-writer, code-reviewer-thorough |
| `testing` | Writing and managing tests, TDD | test-writer, verifier |
| `documentation` | Generating structural documentation of codebase | codebase-mapper |
| `sprint-management` | Prioritization, sprint planning, velocity | sprint-planner, project-roadmapper |

---

## 3. Master Table — all 40 agents

| # | Agent | Category | Tier | Tags | One-line description |
|---|-------|----------|------|------|---------------------|
| 1 | dispatcher | Command & Control | HEAVY | `orchestration` | Main orchestrator — parses user goal, delegates to agents, collects results |
| 2 | auto-continue | Command & Control | LOW | `orchestration` | Binary classifier: should work continue? yes/no |
| 3 | planner-thorough | Strategy & Planning | HEAVY | `planning` | Deep goal-backward analysis, risk assessment, dependency mapping |
| 4 | planner-quick | Strategy & Planning | LOW | `planning` | Fast operational plan: do A, then B, then C |
| 5 | architect | Strategy & Planning | HEAVY | `planning`, `difficult-coding` | High-level code structure: files, interfaces, patterns, module interactions |
| 6 | prompt-validator | Strategy & Planning | HEAVY | `planning` | Validates user prompt before planning: finds gaps, contradictions, hidden assumptions |
| 7 | plan-reviewer | Strategy & Planning | MEDIUM | `planning`, `review` | Reviews completed plan for verifiability, completeness, contradictions |
| 8 | project-roadmapper | Strategy & Planning | MEDIUM | `planning`, `sprint-management` | Manages project at epic/issue level, generates roadmaps |
| 9 | project-builder | Strategy & Planning | MEDIUM | `planning` | Interviews user at project start, gathers requirements and constraints |
| 10 | sprint-planner | Strategy & Planning | MEDIUM | `planning`, `sprint-management` | Prioritizes backlog, groups into sprints, decides what to build now vs later |
| 11 | todo-manager | Strategy & Planning | LOW | `planning`, `orchestration` | Converts plan into execution DAG with dependencies and parallelism |
| 12 | code-writer | Code Production | MEDIUM | `regular-coding`, `refactoring` | Main coding agent — implements features, modifications (70% of code) |
| 13 | code-writer-hard | Code Production | HEAVY | `difficult-coding`, `debugging` | Hard problems: complex algorithms, race conditions, subtle bugs |
| 14 | code-writer-quick | Code Production | LOW | `quick-coding` | Trivial changes: typos, renames, single-line fixes |
| 15 | file-builder | Code Production | MEDIUM | `regular-coding` | Precisely applies diffs/patches/rewrites to files |
| 16 | creative-thinker | Code Production | MEDIUM | `creativity`, `difficult-coding` | Non-standard approaches when conventional solutions fail |
| 17 | frontend-specialist | Code Production | MEDIUM | `frontend` | UI/UX expert: CSS, animations, responsive design, design systems |
| 18 | refactoring-agent | Code Production | MEDIUM | `refactoring`, `regular-coding` | Safe restructuring with test preservation, LSP, AST analysis |
| 19 | debugger | Code Production | HEAVY | `debugging` | Systematic debugging: reproduce → root cause → hypothesis → minimal fix |
| 20 | test-writer | Code Production | MEDIUM | `testing` | Writes tests first (TDD), generates coverage, regression tests |
| 21 | code-reviewer-thorough | Quality Assurance | HEAVY | `review`, `refactoring` | Deep review: architecture, security, edge cases, performance |
| 22 | code-reviewer-quick | Quality Assurance | LOW | `review`, `quick-coding` | Fast review: linting, style, obvious errors |
| 23 | spec-compliance-reviewer | Quality Assurance | MEDIUM | `review` | Verifies implementation matches spec exactly — nothing more, nothing less |
| 24 | verifier | Quality Assurance | MEDIUM | `review`, `devops`, `debugging`, `testing` | Runs tests/build/lint and interprets results |
| 25 | risk-assessor | Quality Assurance | MEDIUM | `review` | Evaluates security risk of operations: LOW/MEDIUM/HIGH |
| 26 | merge-coordinator | Quality Assurance | MEDIUM | `review`, `git` | Merges branches from multiple worktrees/sessions, resolves cross-session conflicts |
| 27 | license-checker | Quality Assurance | MEDIUM | `review` | Checks dependency licenses, detects code copying from incompatible sources |
| 28 | integration-checker | Quality Assurance | MEDIUM | `review` | Verifies cross-system integration: exports→imports, APIs→consumers, data flows |
| 29 | code-explorer | Research & Exploration | LOW | `docs-research`, `debugging` | Searches OUR codebase: grep, references, structure mapping |
| 30 | web-researcher | Research & Exploration | MEDIUM | `docs-research` | Searches OUTSIDE repo: docs, GitHub, Stack Overflow, API references |
| 31 | browser-agent | Research & Exploration | MEDIUM | `frontend`, `docs-research` | Browser interaction: UI testing, E2E, scraping, forms (text + visual modes) |
| 32 | codebase-mapper | Research & Exploration | MEDIUM | `documentation`, `docs-research` | Explores codebase and generates structural documentation (ARCHITECTURE.md, STACK.md) |
| 33 | summarizer | Utility | LOW | `summarization` | Compresses conversations, agent outputs, context for window management |
| 34 | commit-writer | Utility | LOW | `git` | Writes commit messages from diffs, respects project conventions |
| 35 | namer | Utility | LOW | `naming` | Names sessions, plans, branches, PR titles |
| 36 | issue-writer | Utility | LOW | `planning`, `docs-research` | Writes GitHub issue content: acceptance criteria, labels, epic links |
| 37 | long-task-runner | Utility | LOW | `devops` | Runs long operations in background (tests, builds), reports when done |
| 38 | git-operator | Utility | LOW | `git`, `devops` | Executes local git operations: branch, rebase, cherry-pick, push/pull |
| 39 | github-operator | Utility | LOW | `git`, `devops` | GitHub platform operations: PRs, issues, labels, CI status, Projects API |
| 40 | devops-operator | Utility | MEDIUM | `devops` | Infrastructure as Code: Docker, K8s, Terraform, CI/CD pipelines |

---

## 4. Category 1: Command & Control

Agents that don't write code — they manage the flow of work.

### 4.1 dispatcher

| Field | Value |
|-------|-------|
| **Tier** | HEAVY |
| **Tags** | `orchestration` |
| **Sources** | OMO:sisyphus, DiriCode:dispatcher |
| **Description** | Main orchestrator — parses user's goal, decides which agents to use, in what order, delegates, collects results, decides what to do next. The only agent that talks to the user. |
| **Key distinction** | Does NOT plan HOW to do things — only WHO should do them. Does not analyze code, does not write plans. vs todo-manager: dispatcher delegates at runtime, todo-manager plans the sequence upfront. |

### 4.2 auto-continue

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `orchestration` |
| **Sources** | Plandex:exec-status |
| **Description** | Simple binary classifier: looks at work state and answers yes/no — "should we continue?". E.g. after partial response, timeout, interruption. |
| **Key distinction** | Does NOT decide WHAT to do — only WHETHER to keep going. Cheapest possible model, binary decision. Dispatcher decides WHAT, auto-continue decides IF. |

---

## 5. Category 2: Strategy & Planning

Agents that think before anyone writes a line of code.

### 5.1 planner-thorough

| Field | Value |
|-------|-------|
| **Tier** | HEAVY |
| **Tags** | `planning` |
| **Sources** | OMO:prometheus+metis, Plandex:planner+architect, GSD:gsd-planner |
| **Description** | Deep goal-backward analysis: "what is the end goal?" → decompose into steps → identify dependencies between steps → assess risks → produce strategic plan. Uses lots of context, thinks long. |
| **Key distinction** | vs planner-quick: 10x slower, 10x more thorough. For complex features, refactors, migrations. vs architect: planner says WHAT to do (steps), architect says HOW (code structure). |

### 5.2 planner-quick

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `planning` |
| **Sources** | Plandex:planner(cheap) |
| **Description** | Fast operational plan: "do A, then B, then C". No deep analysis, no goal-backward reasoning. For simple tasks, POCs, hotfixes. |
| **Key distinction** | vs planner-thorough: doesn't analyze risks, doesn't map dependencies, doesn't decompose. Just a step list. Cheap model, fast response. |

### 5.3 architect

| Field | Value |
|-------|-------|
| **Tier** | HEAVY |
| **Tags** | `planning`, `difficult-coding` |
| **Sources** | Plandex:architect, Aider:main_model(architect-mode) |
| **Description** | High-level code structure: which files to change, what interfaces, what patterns, how modules talk to each other. Reads a lot of code but never writes production code — gives instructions to code-writer. |
| **Key distinction** | vs planner-thorough: planner gives STEPS (1. build auth, 2. build UI), architect gives STRUCTURE (auth in src/auth/, interface IAuthService, middleware in src/middleware/). vs code-writer: architect NEVER writes production code. |

### 5.4 prompt-validator

| Field | Value |
|-------|-------|
| **Tier** | HEAVY |
| **Tags** | `planning` |
| **Sources** | OMO:metis |
| **Description** | Validates user's prompt BEFORE planning: is it complete, unambiguous, technically sound? Finds gaps, contradictions, hidden assumptions, points where AI might go wrong. Output: list of problems + clarifying questions for user. |
| **Key distinction** | vs planner-thorough: doesn't create a plan — only prepares the ground. Works BEFORE planner. vs plan-reviewer: prompt-validator checks INPUT (user's prompt), plan-reviewer checks OUTPUT (finished plan). |

### 5.5 plan-reviewer

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `planning`, `review` |
| **Sources** | OMO:momus, GSD:plan-checker |
| **Description** | Evaluates a FINISHED plan (from planner-thorough or planner-quick). Checks: are steps verifiable, is anything missing, are there contradictions? Output: accept/reject + list of concerns. |
| **Key distinction** | vs code-reviewer: code-reviewer looks at CODE, plan-reviewer looks at PLAN (before code is written). vs prompt-validator: prompt-validator checks INPUT, plan-reviewer checks OUTPUT. Quality gate between planning and coding. |

### 5.6 project-roadmapper

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `planning`, `sprint-management` |
| **Sources** | GSD:roadmapper |
| **Description** | Manages the project at a high level: generates roadmap, manages epics, breaks epics into smaller parts. Looks at the entire project, not a single task. Handles nested epic hierarchy (nested epics → issues). |
| **Key distinction** | vs planner-thorough: roadmapper looks at the WHOLE PROJECT (many issues/epics), planner looks at ONE TASK. vs sprint-planner: roadmapper defines WHAT the project needs (structure), sprint-planner decides WHEN to do it (priority/order). vs issue-writer: roadmapper decides WHAT should be an issue, issue-writer WRITES the issue content. |

### 5.7 project-builder

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `planning` |
| **Sources** | GSD:new-project interview, DiriCode ADR-002 |
| **Description** | Interviews the user at project start — gathers goals, constraints, tech stack. Generates requirements document. Entry point for a new project. |
| **Key distinction** | vs planner-thorough: project-builder gathers REQUIREMENTS from user (interactively), planner plans HOW to implement them. project-builder = "what do you want?", planner = "how do we build it?". |

### 5.8 sprint-planner

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `planning`, `sprint-management` |
| **Sources** | New — replaces "scrum master" concept with actionable AI agent |
| **Description** | Takes the backlog (epics/issues from GitHub Project), analyzes dependencies, business value, technical risk, and estimated velocity. Groups work into sprints. Decides what to build NOW vs NEXT vs LATER. Produces a sprint plan that dispatcher executes. |
| **Key distinction** | vs project-roadmapper: roadmapper defines the STRUCTURE of work (epics, issues), sprint-planner decides the ORDER and TIMING (which sprint, what priority). vs todo-manager: todo-manager creates execution DAG for a SINGLE task/plan, sprint-planner prioritizes across the ENTIRE BACKLOG. vs planner-thorough: planner creates a plan for ONE feature, sprint-planner sequences MANY features. |
| **Inputs** | Backlog from GitHub Project, dependency graph, business value signals, technical risk from risk-assessor |
| **Outputs** | Sprint plan: ordered list of issues for current sprint, tentative plan for next 2-3 sprints, blocking dependencies highlighted |

### 5.9 todo-manager

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `planning`, `orchestration` |
| **Sources** | OpenHands:task_tracker (extended) |
| **Description** | Converts a plan into a concrete execution DAG with dependencies. Knows that task A and B can run in parallel, while task C waits for both. Actively manages the list — reacts to changes, rescales priorities. Gives dispatcher a ready execution plan. |
| **Key distinction** | vs planner: planner says WHAT and HOW, todo-manager says IN WHAT ORDER and WHO. vs dispatcher: dispatcher delegates at runtime, todo-manager plans delegation upfront. vs sprint-planner: sprint-planner works at BACKLOG level (which issues this sprint), todo-manager works at TASK level within a single issue/plan. |

---

## 6. Category 3: Code Production

Agents that write / modify / restructure code.

### 6.1 code-writer

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `regular-coding`, `refactoring` |
| **Sources** | OMO:hephaestus, Plandex:coder, Aider:editor_model, Codex:worker, OpenHands:codeact_agent |
| **Description** | Main coding agent. Receives plan/instructions from planner or architect, implements. New features, modifications to existing files, standard tasks. Workhorse — 70% of project code comes from this agent. |
| **Key distinction** | Good quality/cost ratio. Cannot handle truly hard problems (escalates to code-writer-hard). vs file-builder: code-writer INVENTS what to write, file-builder APPLIES it precisely. vs refactoring-agent: code-writer builds NEW functionality, refactoring-agent restructures EXISTING code. |

### 6.2 code-writer-hard

| Field | Value |
|-------|-------|
| **Tier** | HEAVY |
| **Tags** | `difficult-coding`, `debugging` |
| **Sources** | OMO:ultrabrain+deep |
| **Description** | Hard problems: complex algorithms, race conditions, subtle bugs, performance optimization, integrations with undocumented APIs. Works differently — more time analyzing, more context, more iterations. |
| **Key distinction** | vs code-writer: not just a better model. Different workflow — reads more surrounding code, builds hypotheses, tests them. Used when code-writer failed 2+ times, or when task is pre-marked as difficult. vs debugger: code-writer-hard tackles hard IMPLEMENTATION, debugger tackles hard INVESTIGATION of existing bugs. |

### 6.3 code-writer-quick

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `quick-coding` |
| **Sources** | OMO:quick, Aider:weak_model(simple edits) |
| **Description** | Trivial changes: typos, rename a variable, add an import, change a string, delete commented-out code. |
| **Key distinction** | vs code-writer: cannot handle anything requiring thought. Literally "replace X with Y". Cheapest model with clear limitations. Good for batch operations across many files. |

### 6.4 file-builder

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `regular-coding` |
| **Sources** | Plandex:builder+whole-file-builder |
| **Description** | Converts plan/diff into actual file changes. Specialist in precise application: patch, search-and-replace, full file rewrite. |
| **Key distinction** | vs code-writer: code-writer INVENTS what to write. file-builder APPLIES what code-writer invented. If apply fails (bad diff, conflict), file-builder retries — no need to repeat planning/coding. Separation of "thinking" vs "applying". |

### 6.5 creative-thinker

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `creativity`, `difficult-coding` |
| **Sources** | OMO:artistry |
| **Description** | Non-standard approaches: when conventional solutions don't work, when you need to think differently, when the problem requires a non-obvious idea. |
| **Key distinction** | vs code-writer-hard: hard does difficult but KNOWN patterns (algorithms, debugging). creative-thinker searches for NEW approaches — may propose a different design, workaround, elegant hack. vs architect: architect designs within conventions, creative-thinker breaks conventions when needed. |

### 6.6 frontend-specialist

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `frontend` |
| **Sources** | OMO:visual-engineering |
| **Description** | UI/UX specialist: CSS, animations, responsiveness, design systems, visual components, accessibility (a11y). |
| **Key distinction** | vs code-writer: code-writer can build a React component but won't make beautiful UI. frontend-specialist knows what good design looks like, knows CSS tricks, understands UX patterns. Specialized in the visual layer. |

### 6.7 refactoring-agent

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `refactoring`, `regular-coding` |
| **Sources** | New — inspired by Superpowers:receiving-code-review patterns, code-review feedback cycles |
| **Description** | Safely restructures code without changing behavior. Uses LSP for rename/references, AST-grep for pattern matching, ensures test suite stays green throughout. Handles: extract function/class, move module, rename across codebase, simplify conditionals, reduce duplication. |
| **Key distinction** | vs code-writer: code-writer builds NEW features, refactoring-agent restructures EXISTING code. Different mindset — refactoring-agent's success criterion is "all tests still pass, behavior unchanged, code is cleaner". vs code-reviewer-thorough: reviewer IDENTIFIES what should be refactored, refactoring-agent EXECUTES the refactoring. Never mixes refactoring with feature work (bugfix rule). |

### 6.8 debugger

| Field | Value |
|-------|-------|
| **Tier** | HEAVY |
| **Tags** | `debugging` |
| **Sources** | New — inspired by Superpowers:systematic-debugging, GSD:gsd-debugger |
| **Description** | Systematic bug investigation using scientific method. Four phases: (1) root cause investigation — reproduce, read errors, check recent changes, gather evidence; (2) pattern analysis — find working examples, compare; (3) hypothesis testing — single hypothesis, minimal test, one variable at a time; (4) implementation — failing test first, single fix, verify. Never guesses. Never shotgun-debugs. |
| **Key distinction** | vs code-writer-hard: code-writer-hard solves hard IMPLEMENTATION problems (writing new complex code). Debugger solves hard INVESTIGATION problems (finding WHY existing code is broken). Different workflow — debugger uses hypothesis-driven scientific method, code-writer-hard uses deep analysis and iteration. vs verifier: verifier RUNS tests and reports pass/fail. Debugger INVESTIGATES why something fails. |
| **Iron law** | No fixes without root cause investigation first. After 3 consecutive failed fixes: STOP, revert, consult. |

### 6.9 test-writer

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `testing` |
| **Sources** | New — inspired by Superpowers:test-driven-development, GSD:gsd-nyquist-auditor |
| **Description** | Dedicated test creation agent. Writes tests BEFORE implementation (TDD red-green-refactor). Also generates coverage tests for existing code, regression tests for bugs, integration tests for cross-module behavior. Understands test design: one behavior per test, real code over mocks, clear naming. |
| **Key distinction** | vs code-writer: code-writer writes production code. test-writer writes TEST code. Different mindset — test-writer thinks "what SHOULD this do?" before implementation, code-writer thinks "HOW to make this work". vs verifier: verifier RUNS tests and interprets results. test-writer WRITES the tests that verifier runs. vs debugger: debugger creates a minimal reproduction test as part of investigation. test-writer creates comprehensive test suites systematically. |
| **Iron law** | No production code without a failing test first. Test passes immediately? Wrong test — fix it. |

---

## 7. Category 4: Quality Assurance

Agents that check others' work.

### 7.1 code-reviewer-thorough

| Field | Value |
|-------|-------|
| **Tier** | HEAVY |
| **Tags** | `review`, `refactoring` |
| **Sources** | OMO:oracle+momus, Codex:ReviewTask |
| **Description** | Deep code review: architecture, security, edge cases, race conditions, performance, project pattern compliance. Read-only — never modifies code. |
| **Key distinction** | vs code-reviewer-quick: 10x slower but catches subtle bugs, security issues, design problems. For important changes (auth, payments, core logic). vs verifier: reviewer looks at code QUALITY, verifier looks at whether code WORKS. vs spec-compliance-reviewer: code-reviewer checks if code is WELL-BUILT, spec-compliance-reviewer checks if code MATCHES THE SPEC. |

### 7.2 code-reviewer-quick

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `review`, `quick-coding` |
| **Sources** | DiriCode ADR-002 |
| **Description** | Fast review: linting, style, obvious errors, convention compliance. |
| **Key distinction** | vs code-reviewer-thorough: doesn't look for edge cases or security issues. Checks: "does this look OK?". For simple PRs, trivial changes. |

### 7.3 spec-compliance-reviewer

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `review` |
| **Sources** | New — inspired by Superpowers:spec-reviewer-prompt |
| **Description** | Verifies implementation matches specification EXACTLY — nothing more, nothing less. Checks: (1) missing requirements — did they skip something?; (2) extra/unneeded work — did they over-engineer?; (3) misunderstandings — did they solve the wrong problem? Does NOT trust implementer's report — reads actual code. |
| **Key distinction** | vs code-reviewer-thorough: code-reviewer checks if code is WELL-BUILT (quality). spec-compliance-reviewer checks if code DOES WHAT WAS ASKED (completeness). Orthogonal concerns — code can be high quality but miss requirements, or match spec perfectly but be poorly written. vs plan-reviewer: plan-reviewer checks the PLAN before coding. spec-compliance-reviewer checks the CODE against the plan after coding. |

### 7.4 verifier

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `review`, `devops`, `debugging`, `testing` |
| **Sources** | DiriCode ADR-002, GSD:verifier |
| **Description** | Runs tests, build, linting. Interprets results — not just "pass/fail" but also "test X fails because Y, you need to do Z". |
| **Key distinction** | vs code-reviewer: reviewer reads CODE and evaluates. Verifier RUNS code and observes. Complementary — reviewer says "this might not work", verifier says "this doesn't work, here's the error". vs test-writer: test-writer WRITES tests, verifier RUNS them. |

### 7.5 risk-assessor

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `review` |
| **Sources** | OpenHands:security_utils |
| **Description** | Evaluates security risk of operations: can a change break things, is a tool destructive, is data safe. Levels: LOW/MEDIUM/HIGH. Input for the approval flow. |
| **Key distinction** | vs code-reviewer-thorough: reviewer looks at code quality, risk-assessor looks at OPERATIONAL SECURITY. vs license-checker: risk-assessor = security, license-checker = legal. |

### 7.6 merge-coordinator

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `review`, `git` |
| **Sources** | New — required by multi-worktree architecture |
| **Description** | Merges branches from different worktrees/sessions. Checks for cross-session conflicts, resolves them, verifies merge didn't break tests. |
| **Key distinction** | vs git-operator: git-operator does local git operations (branch, rebase), merge-coordinator joins work from MULTIPLE sessions. vs code-reviewer: reviewer evaluates quality, merge-coordinator checks COMPATIBILITY of changes from different branches. |

### 7.7 license-checker

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `review` |
| **Sources** | New — required by LEGAL-001 |
| **Description** | Checks dependency licenses and code sources. Detects: copying code from incompatible licenses (AGPL, GPL in an MIT project), missing attributions, suspicious snippets. Scans new dependencies, checks SPDX, compares against allowlist. |
| **Key distinction** | vs code-reviewer-thorough: reviewer looks at code quality. vs risk-assessor: risk-assessor = security. license-checker = LEGAL dimension of review. Three separate QA dimensions. |

### 7.8 integration-checker

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `review` |
| **Sources** | New — inspired by GSD:gsd-integration-checker |
| **Description** | Verifies cross-system integration after multiple agents/phases have completed work. Core principle: "existence ≠ integration". Checks: exports→imports (module A exports, module B actually calls it), APIs→consumers (endpoint exists AND something fetches from it), forms→handlers (form submits, API processes, result displays), data→display (database has data, UI renders it). |
| **Key distinction** | vs verifier: verifier checks that individual tasks WORK (tests pass). integration-checker checks that the SYSTEM works as a whole — multiple components wired together correctly. vs code-reviewer-thorough: reviewer checks code QUALITY within files. integration-checker checks CONNECTIONS between files/modules/layers. |

---

## 8. Category 5: Research & Exploration

Agents that find information — they don't write code, don't make decisions.

### 8.1 code-explorer

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `docs-research`, `debugging` |
| **Sources** | OMO:explore, Codex:explorer, OpenHands:loc_agent+readonly_agent |
| **Description** | Searches OUR codebase: grep, find references, map structure, find patterns, locate definitions. |
| **Key distinction** | vs web-researcher: code-explorer NEVER goes outside the repo. Searches internally. Cheap — just reads files, no API calls. vs codebase-mapper: code-explorer ANSWERS specific questions ("where is X defined?"), codebase-mapper GENERATES comprehensive documentation about the codebase. vs architect: explorer FINDS information, architect INTERPRETS it and makes decisions. |

### 8.2 web-researcher

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `docs-research` |
| **Sources** | OMO:librarian |
| **Description** | Searches OUTSIDE the repo: library docs, GitHub issues, Stack Overflow, official API docs, examples in other projects. |
| **Key distinction** | vs code-explorer: never looks at our code. Searches the outside world. More expensive — web search, API calls. vs browser-agent: web-researcher reads TEXT (API, fetch URL), browser-agent INTERACTS with a browser (clicks, fills forms). |

### 8.3 browser-agent

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `frontend`, `docs-research` |
| **Sources** | OpenHands:browsing_agent+visualbrowsing_agent |
| **Description** | Browser interaction — testing UI, E2E, scraping dynamic pages, navigation, forms. Two modes: text (accessibility tree) and visual (screenshot + multimodal). |
| **Key distinction** | vs web-researcher: web-researcher READS the internet (text, API). browser-agent USES a browser (clicks, sees rendering, takes screenshots). vs frontend-specialist: frontend-specialist WRITES UI code, browser-agent TESTS the result in a browser. |

### 8.4 codebase-mapper

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `documentation`, `docs-research` |
| **Sources** | New — inspired by GSD:gsd-codebase-mapper |
| **Description** | Explores codebase and generates structural documentation. Produces: ARCHITECTURE.md (module structure, data flow), STACK.md (technologies, versions), CONVENTIONS.md (coding patterns, naming), CONCERNS.md (tech debt, issues). Documents the PRESENT state — never writes in future tense. Essential for onboarding to unfamiliar projects. |
| **Key distinction** | vs code-explorer: code-explorer ANSWERS specific questions ("where is auth middleware?"). codebase-mapper GENERATES comprehensive documentation about the entire codebase or a focus area. vs summarizer: summarizer compresses CONVERSATION context. codebase-mapper documents CODE structure. |
| **Important constraint** | Documents what EXISTS, never what SHOULD exist. Present tense only. "The auth module uses JWT tokens" not "The auth module will use JWT tokens". |

---

## 9. Category 6: Utility

Agents for specialized tasks.

### 9.1 summarizer

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `summarization` |
| **Sources** | Plandex:summarizer |
| **Description** | Summarizes conversations, agent outputs, context. Key for context management — when context window fills up, summarizer compresses. |
| **Key distinction** | Only agent whose purpose is to REDUCE context. Doesn't make decisions, doesn't write code — only summarizes. |

### 9.2 commit-writer

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `git` |
| **Sources** | Plandex:commit-msg, Aider:weak_model(commits) |
| **Description** | Writes commit messages from diffs. Respects project conventions (conventional commits, etc). |
| **Key distinction** | Doesn't decide WHAT to commit — receives a diff and writes the message. vs git-operator: git-operator executes git operations, commit-writer only writes message text. |

### 9.3 namer

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `naming` |
| **Sources** | Plandex:namer |
| **Description** | Names sessions, plans, branches, PR titles. |
| **Key distinction** | Cheapest agent. One sentence of output. Offloads a trivial decision from other agents. |

### 9.4 issue-writer

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `planning`, `docs-research` |
| **Sources** | New — required by GitHub Project workflow |
| **Description** | Writes GitHub issue content — well-formatted, with acceptance criteria, labels, linked to epics. Specialist in precisely describing tasks. |
| **Key distinction** | vs github-operator: issue-writer writes issue CONTENT (copywriter), github-operator CREATES the issue on the platform (executor). vs project-roadmapper: roadmapper decides WHAT should be an issue, issue-writer WRITES the content. |

### 9.5 long-task-runner

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `devops` |
| **Sources** | Codex:awaiter |
| **Description** | Runs long operations (tests, build, monitoring) in parallel — work can continue on something else in the meantime. |
| **Key distinction** | vs verifier: verifier INTERPRETS results ("test X fails because Y"). long-task-runner only WAITS for the result and reports it. Simple, cheap. Clutch for the orchestrator — enables parallel waiting. |

### 9.6 git-operator

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `git`, `devops` |
| **Sources** | New — required by multi-worktree workflow |
| **Description** | Executes local git operations: creating branches, checkout, rebase, cherry-pick, stash, push/pull, resolve conflicts. |
| **Key distinction** | vs commit-writer: commit-writer writes message text, git-operator executes git commands. vs github-operator: git-operator = local repo, github-operator = GitHub platform. vs merge-coordinator: merge-coordinator joins branches from multiple sessions (strategically), git-operator executes individual operations (tactically). |

### 9.7 github-operator

| Field | Value |
|-------|-------|
| **Tier** | LOW |
| **Tags** | `git`, `devops` |
| **Sources** | New — required by GitHub Project workflow |
| **Description** | Operates GitHub: creates/updates PRs, manages issues and labels, checks CI status, reads reviews, operates GitHub Projects API. Uses gh CLI or GitHub MCP. |
| **Key distinction** | vs issue-writer: issue-writer writes CONTENT, github-operator EXECUTES platform operations (create, label, link). vs git-operator: git-operator = local git, github-operator = remote GitHub API. |

### 9.8 devops-operator

| Field | Value |
|-------|-------|
| **Tier** | MEDIUM |
| **Tags** | `devops` |
| **Sources** | New — inspired by awesome-claude-code:cc-devops-skills |
| **Description** | Infrastructure as Code specialist: Docker, Kubernetes, Terraform, CI/CD pipelines (GitHub Actions, GitLab CI), cloud configuration. Writes and modifies Dockerfiles, compose files, Terraform modules, CI workflow definitions. |
| **Key distinction** | vs code-writer: code-writer writes APPLICATION code. devops-operator writes INFRASTRUCTURE code. Different domain knowledge — devops-operator understands deployment, networking, secrets management, container orchestration. vs git-operator: git-operator does git commands, devops-operator configures the INFRASTRUCTURE that code runs on. vs long-task-runner: long-task-runner RUNS operations, devops-operator WRITES the configuration that defines those operations. |

---

## 10. Tier Summary

| Tier | Count | Agents |
|------|-------|--------|
| **HEAVY** (7) | 7 | dispatcher, planner-thorough, architect, prompt-validator, code-writer-hard, debugger, code-reviewer-thorough |
| **MEDIUM** (20) | 20 | plan-reviewer, project-roadmapper, project-builder, sprint-planner, code-writer, file-builder, creative-thinker, frontend-specialist, refactoring-agent, test-writer, spec-compliance-reviewer, verifier, risk-assessor, merge-coordinator, license-checker, integration-checker, web-researcher, browser-agent, codebase-mapper, devops-operator |
| **LOW** (13) | 13 | auto-continue, planner-quick, todo-manager, code-writer-quick, code-reviewer-quick, code-explorer, summarizer, commit-writer, namer, issue-writer, long-task-runner, git-operator, github-operator |

**Total: 40 agents** (7 HEAVY + 20 MEDIUM + 13 LOW)

Note: Verified from master table — 7 HEAVY + 20 MEDIUM + 13 LOW = 40 ✓

---

## 11. Source Mapping

Where each agent originates from — showing deduplication across frameworks.

| # | Agent | OMO | Plandex | Aider | Codex | OpenHands | GSD | New |
|---|-------|-----|---------|-------|-------|-----------|-----|-----|
| 1 | dispatcher | sisyphus | server orch. | — | — | — | — | — |
| 2 | auto-continue | — | exec-status | — | — | — | — | — |
| 3 | planner-thorough | prometheus | planner | — | — | — | gsd-planner | — |
| 4 | planner-quick | — | planner(cheap) | — | — | — | — | — |
| 5 | architect | — | architect | main(arch) | — | — | — | — |
| 6 | prompt-validator | metis | — | — | — | — | — | — |
| 7 | plan-reviewer | momus | — | — | — | — | plan-checker | — |
| 8 | project-roadmapper | — | — | — | — | — | roadmapper | — |
| 9 | project-builder | — | — | — | — | — | new-project | ADR-002 |
| 10 | sprint-planner | — | — | — | — | — | — | ✅ |
| 11 | todo-manager | — | — | — | — | task_tracker | — | extended |
| 12 | code-writer | hephaestus | coder | editor | worker | codeact | executor | — |
| 13 | code-writer-hard | ultrabrain+deep | — | — | — | — | — | — |
| 14 | code-writer-quick | quick | — | weak | — | — | — | — |
| 15 | file-builder | — | builder+whole | — | — | — | — | — |
| 16 | creative-thinker | artistry | — | — | — | — | — | — |
| 17 | frontend-specialist | visual-eng. | — | — | — | — | — | — |
| 18 | refactoring-agent | — | — | — | — | — | — | ✅ |
| 19 | debugger | — | — | — | — | — | gsd-debugger | ✅ |
| 20 | test-writer | — | — | — | — | — | nyquist | ✅ |
| 21 | code-reviewer-thorough | oracle | — | — | ReviewTask | — | — | — |
| 22 | code-reviewer-quick | — | — | — | — | — | — | ADR-002 |
| 23 | spec-compliance-reviewer | — | — | — | — | — | — | ✅ |
| 24 | verifier | — | — | — | — | — | verifier | ADR-002 |
| 25 | risk-assessor | — | — | — | — | security_utils | — | ✅ |
| 26 | merge-coordinator | — | — | — | — | — | — | ✅ |
| 27 | license-checker | — | — | — | — | — | — | ✅ (LEGAL) |
| 28 | integration-checker | — | — | — | — | — | integ-checker | ✅ |
| 29 | code-explorer | explore | — | — | explorer | loc+readonly | — | — |
| 30 | web-researcher | librarian | — | — | — | — | — | — |
| 31 | browser-agent | — | — | — | — | browsing+visual | — | — |
| 32 | codebase-mapper | — | — | — | — | — | codebase-mapper | ✅ |
| 33 | summarizer | — | summarizer | — | — | — | — | — |
| 34 | commit-writer | — | commit-msg | weak | — | — | — | — |
| 35 | namer | — | namer | — | — | — | — | — |
| 36 | issue-writer | — | — | — | — | — | — | ✅ |
| 37 | long-task-runner | — | — | — | awaiter | — | — | — |
| 38 | git-operator | — | — | — | — | — | — | ✅ |
| 39 | github-operator | — | — | — | — | — | — | ✅ |
| 40 | devops-operator | — | — | — | — | — | — | ✅ |

**Origin summary:**
- From existing frameworks: 23 agents (mapped from 1+ sources)
- New for DiriCode: 17 agents (marked ✅)

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-03-10 v1 | Initial roster: 32 agents from 7 frameworks |
| 2026-03-10 v2 (FINAL) | Added 8 agents after skills registry review: debugger, test-writer, codebase-mapper, integration-checker, devops-operator, refactoring-agent, spec-compliance-reviewer, sprint-planner. Total: 40. |
