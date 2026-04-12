# MVP — Parent Epic

> Theme: Prototype-first runtime
> Iterations: POC → MVP-1 → MVP-2 → MVP-3
> PROCESS-001: Wheel → Scooter → Bicycle → Car

---

## Iteration Summary

### POC — "Wheel" (Week 1-2)

**Goal**: Prove the core runtime path works end-to-end with safe tools and a read-only dispatcher.

Epics active:

- [epic-monorepo-setup.md](epic-monorepo-setup.md) — Project scaffolding
- [epic-config.md](epic-config.md) — JSONC + c12 + Zod (#184)
- [epic-diri-router.md](epic-diri-router.md) — Model routing (DiriRouter ADR-055) (#3)
- [epic-server.md](epic-server.md) — Hono HTTP + SSE (#192)
- [epic-tools.md](epic-tools.md) — Basic file ops + bash (subset) (#5)
- [epic-safety.md](epic-safety.md) — Secret redactor + bash guard (basics)
- [epic-agents-core.md](epic-agents-core.md) — Dispatcher infrastructure
- [epic-agents-roster.md](epic-agents-roster.md) — 5 POC agents
- [epic-cli.md](epic-cli.md) — Basic CLI entrypoint (#9)
- [epic-testing-infra.md](epic-testing-infra.md) — Vitest setup + mock providers (#10)
- [epic-bun-migration.md](epic-bun-migration.md) — Bun runtime (#163)

**Exit**: User types prompt in CLI → dispatcher delegates to specialist → tools run safely → result returns with basic event visibility.

---

### MVP-1 — "Scooter" (Week 3-4)

**Goal**: Ship the first believable runtime: sequential-first execution, explicit checkpoints, evented visibility, and memory-backed continuity.

Epics active:

- [epic-memory.md](epic-memory.md) — SQLite + FTS5 + timeline + local issue system
- [epic-pipeline.md](epic-pipeline.md) — Turn lifecycle + dispatcher→specialist→tools path + sequential checkpoints
- [epic-prompt-composer.md](epic-prompt-composer.md) — Prompt Composer (NEW #631)
- [epic-agents-roster.md](epic-agents-roster.md) — +6 agents (planners, reviewers, verifier)
- [epic-safety.md](epic-safety.md) — Git safety rails (full)
- [epic-cli.md](epic-cli.md) — Session management, profile support
- [epic-tools.md](epic-tools.md) — Git tools + LSP + AST-aware structural tooling
- [epic-event-stream.md](epic-event-stream.md) — EventStream backbone (NEW #623)

**Exit**: Prompt enters system → dispatcher selects execution path → specialist uses tools → streamed progress is visible → checkpoint saved → session can resume from last valid state.

---

### MVP-2 — "Bicycle" (Week 5-6)

**Goal**: Expand reliability and autonomy without breaking the controlled MVP-1 runtime.

Epics active:

- [epic-hooks.md](epic-hooks.md) — Hook framework + 6 MVP hooks (#14)
- [epic-pipeline.md](epic-pipeline.md) — Full pipeline (Interview→Plan→Execute→Verify)
- [epic-prompt-composer.md](epic-prompt-composer.md) — Deeper compression/budget features (Layer 3)
- [epic-skills.md](epic-skills.md) — SKILL.md parser + loader + shadowing (#15)
- [epic-event-stream.md](epic-event-stream.md) — richer observability on top of stable event layer
- [epic-tools.md](epic-tools.md) — additional smart tooling, MCP basics, tool annotations
- [epic-agent-workers.md](epic-agent-workers.md) — Agent Workers (NEW #613)
- [epic-orchestrators.md](epic-orchestrators.md) — Orchestrators (NEW #614)
- [epic-permission-engine.md](epic-permission-engine.md) — Permission Engine (#621)

**Exit**: Full Interview→Plan→Execute→Verify path works on top of the already-trustworthy runtime substrate.

---

### MVP-3 — "Car" (Week 7-8)

**Goal**: Complete MVP with richer Web UI, broader observability surfaces, and the wider MVP agent set.

Epics active:

- [epic-web-dashboard.md](epic-web-dashboard.md) — Vite + React + shadcn/ui (#17)
- [epic-event-stream.md](epic-event-stream.md) — Agent Tree UI + Metrics Bar + Live Activity
- [epic-semantic-search.md](epic-semantic-search.md) — Semantic Search (NEW #632)
- [epic-code-index.md](epic-code-index.md) — Code Structural Index (NEW #633)
- [epic-agents-roster.md](epic-agents-roster.md) — Remaining MVP agents (prompt-validator, plan-reviewer, specialists, etc.)
- [epic-skills.md](epic-skills.md) — Skill-embedded MCP + references/ subfolder

**Exit**: User opens Web UI → sees live execution state derived from stable EventStream data → inspects activity/costs/history with confidence.

---

## Must NOT (MVP-wide)

- No TUI (v2)
- No annotation-driven approval flow (v2)
- No full context-monitor/autocompaction stack in the first believable runtime slice
- No skill marketplace / catalog (v2)
- No sandbox / Docker isolation (v3)
- No auto-advance / full-auto mode (v3)
- No Windows support (not planned)
- No IDE extensions (not planned)
- No voice interface (not planned)

---

## Child Epic Index

| Epic                                           | Package(s)               | Iterations  | Issues            |
| ---------------------------------------------- | ------------------------ | ----------- | ----------------- |
| [monorepo-setup](epic-monorepo-setup.md)       | root                     | POC         | DC-SETUP-001..005 |
| [config](epic-config.md)                       | packages/core            | POC         | #184              |
| [diri-router](epic-diri-router.md)             | packages/dirirouter      | POC→MVP-2   | #3                |
| [server](epic-server.md)                       | packages/server          | POC         | #192              |
| [tools](epic-tools.md)                         | packages/tools           | POC→MVP-2   | #5                |
| [memory](epic-memory.md)                       | packages/memory          | MVP-1       | DC-MEM-001..009   |
| [agent-workers](epic-agent-workers.md)         | packages/agents          | POC→MVP-3   | #613              |
| [orchestrators](epic-orchestrators.md)         | packages/orchestrators   | MVP-2       | #614              |
| [hooks](epic-hooks.md)                         | packages/core            | MVP-2       | #14               |
| [pipeline](epic-pipeline.md)                   | packages/core            | MVP-1→MVP-2 | DC-PIPE-001..009  |
| [prompt-composer](epic-prompt-composer.md)     | packages/prompt-composer | MVP-1→MVP-3 | #631              |
| [semantic-search](epic-semantic-search.md)     | packages/semantic-search | MVP-3       | #632              |
| [code-index](epic-code-index.md)               | packages/code-index      | MVP-3       | #633              |
| [safety](epic-safety.md)                       | packages/tools           | POC→MVP-1   | DC-SAFE-001..005  |
| [skills](epic-skills.md)                       | packages/agents          | MVP-2→MVP-3 | #15               |
| [event-stream](epic-event-stream.md)           | packages/core            | MVP-1→MVP-3 | #623              |
| [permission-engine](epic-permission-engine.md) | packages/core            | MVP-2       | #621              |
| [web-dashboard](epic-web-dashboard.md)         | packages/web             | MVP-3       | #17               |
| [cli](epic-cli.md)                             | apps/cli                 | POC→MVP-1   | #9                |
| [testing-infra](epic-testing-infra.md)         | root, test-utils         | POC         | #10               |
| [bun-migration](epic-bun-migration.md)         | root                     | POC         | #163              |
| [diricontext](epic-diricontext.md)             | packages/diricontext     | MVP-1       | #576-612          |

---

## Current prototype-first emphasis

The current priority order across MVP work is:

1. runtime loop and sequential execution
2. checkpoint/resume
3. evented visibility
4. semantic navigation / structural tooling
5. local-first runtime state
6. later wave execution, richer hooks, deeper context automation, broader UI polish
