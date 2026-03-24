# MVP — Parent Epic

> Theme: Core engine + Web UI
> Iterations: POC → MVP-1 → MVP-2 → MVP-3
> PROCESS-001: Wheel → Scooter → Bicycle → Car

---

## Iteration Summary

### POC — "Wheel" (Week 1-2)
**Goal**: Prove the architecture works end-to-end. Validate all technical risks.

Epics active:
- [epic-monorepo-setup.md](epic-monorepo-setup.md) — Project scaffolding
- [epic-config.md](epic-config.md) — JSONC + c12 + Zod
- [epic-router.md](epic-router.md) — Copilot/Kimi + failover
- [epic-server.md](epic-server.md) — Hono HTTP + SSE
- [epic-tools.md](epic-tools.md) — Basic file ops + bash (subset)
- [epic-safety.md](epic-safety.md) — Secret redactor + bash guard (basics)
- [epic-agents-core.md](epic-agents-core.md) — Dispatcher infrastructure
- [epic-agents-roster.md](epic-agents-roster.md) — 5 POC agents
- [epic-cli.md](epic-cli.md) — Basic CLI entrypoint
- [epic-testing-infra.md](epic-testing-infra.md) — Vitest setup + mock providers

**Exit**: User types prompt in CLI → dispatcher delegates to code-writer → file created on disk via Copilot.

---

### MVP-1 — "Scooter" (Week 3-4)
**Goal**: Real task execution with planning, review, and persistent memory.

Epics active:
- [epic-memory.md](epic-memory.md) — SQLite + FTS5 + timeline + local issue system
- [epic-pipeline.md](epic-pipeline.md) — Basic pipeline (Plan→Execute only)
- [epic-context.md](epic-context.md) — Layer 1: basic context window management
- [epic-agents-roster.md](epic-agents-roster.md) — +6 agents (planners, reviewers, verifier)
- [epic-safety.md](epic-safety.md) — Git safety rails (full)
- [epic-cli.md](epic-cli.md) — Session management, profile support
- [epic-tools.md](epic-tools.md) — Git tools + AST-grep

**Exit**: "Add a login page" → planner creates plan → code-writer implements → code-reviewer reviews → atomic commit made. Memory persists.

---

### MVP-2 — "Bicycle" (Week 5-6)
**Goal**: Reliable, smart execution with hooks, guardrails, and skills.

Epics active:
- [epic-hooks.md](epic-hooks.md) — Hook framework + 6 MVP hooks
- [epic-pipeline.md](epic-pipeline.md) — Full pipeline (Interview→Plan→Execute→Verify)
- [epic-context.md](epic-context.md) — Layer 2: condenser pipeline + context budget
- [epic-skills.md](epic-skills.md) — SKILL.md parser + loader + shadowing
- [epic-observability.md](epic-observability.md) — EventStream + basic agent tree (data layer)
- [epic-tools.md](epic-tools.md) — Smart code tools + MCP basics + tool annotations
- [epic-agents-roster.md](epic-agents-roster.md) — +4 agents (git-operator, debugger, test-writer, project-builder)

**Exit**: Full pipeline Interview→Plan→Execute→Verify works. Hooks fire. Guardrails catch paralysis. Context stays under 50%. Skills loaded.

---

### MVP-3 — "Car" (Week 7-8)
**Goal**: Complete MVP with Web UI, full observability, and all MVP agents.

Epics active:
- [epic-web-ui.md](epic-web-ui.md) — Vite + React + shadcn/ui
- [epic-observability.md](epic-observability.md) — Agent Tree UI + Metrics Bar + Live Activity
- [epic-context.md](epic-context.md) — Layer 3: smart context per subtask + inheritance
- [epic-agents-roster.md](epic-agents-roster.md) — Remaining MVP agents (prompt-validator, plan-reviewer, specialists, etc.)
- [epic-skills.md](epic-skills.md) — Skill-embedded MCP + references/ subfolder

**Exit**: User opens Web UI → sees agent tree → watches pipeline execute → inspects costs. All 25+ MVP agents operational.

---

## Must NOT (MVP-wide)

- No TUI (v2)
- No annotation-driven approval flow (v2)
- No embeddings / vector search (v2)
- No context monitoring hooks (v2)
- No skill marketplace / catalog (v2)
- No sandbox / Docker isolation (v3)
- No auto-advance / full-auto mode (v3)
- No GitLab / Jira backends (v3/v4)
- No multi-user / auth / teams (v4)
- No Windows support (not planned)
- No IDE extensions (not planned)
- No voice interface (not planned)

---

## Child Epic Index

| Epic | Package(s) | Iterations | Issues |
|------|-----------|------------|--------|
| [monorepo-setup](epic-monorepo-setup.md) | root | POC | DC-SETUP-001..005 |
| [config](epic-config.md) | @diricode/core | POC | DC-CORE-001..004 |
| [router](epic-router.md) | @diricode/providers | POC | DC-PROV-001..007 |
| [server](epic-server.md) | @diricode/server | POC | DC-SRV-001..004 |
| [tools](epic-tools.md) | @diricode/tools | POC→MVP-2 | DC-TOOL-001..012 |
| [memory](epic-memory.md) | @diricode/memory | MVP-1 | DC-MEM-001..007 |
| [agents-core](epic-agents-core.md) | @diricode/core | POC→MVP-1 | DC-CORE-005..012 |
| [agents-roster](epic-agents-roster.md) | @diricode/core | POC→MVP-3 | DC-AGENT-001..025 |
| [hooks](epic-hooks.md) | @diricode/core | MVP-2 | DC-HOOK-001..005 |
| [pipeline](epic-pipeline.md) | @diricode/core | MVP-1→MVP-2 | DC-PIPE-001..008 |
| [context](epic-context.md) | @diricode/core | MVP-1→MVP-3 | DC-CTX-001..009 |
| [safety](epic-safety.md) | @diricode/tools | POC→MVP-1 | DC-SAFE-001..005 |
| [skills](epic-skills.md) | @diricode/core | MVP-2→MVP-3 | DC-SKILL-001..006 |
| [observability](epic-observability.md) | @diricode/core, web | MVP-2→MVP-3 | DC-OBS-001..006 |
| [web-ui](epic-web-ui.md) | @diricode/web | MVP-3 | DC-WEB-001..007 |
| [cli](epic-cli.md) | apps/cli | POC→MVP-1 | DC-CLI-001..004 |
| [testing-infra](epic-testing-infra.md) | root, test-utils | POC | DC-TEST-001..004 |
