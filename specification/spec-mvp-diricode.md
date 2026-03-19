# DiriCode — MVP Technical Specification

> Synthesizes all architectural and product decisions from 2 decision surveys, 13 analysis documents, and the full ADR rewrite.
> Enriched with results from TASK-002 (context management), TASK-007 (indexing), TASK-012 (Plandex roles), and all other TASK analyses.
> Last updated: 2026-03-10
> Status: APPROVED (post ankieta-wyniki.md + ankieta-features-ekosystem.md + full ADR rewrite)

---

## 1. Project Identity

| Attribute | Value |
|---|---|
| Name | DiriCode |
| Description | Local AI agent system with dispatcher-first architecture, project pipeline, and modular hook framework |
| Target user (MVP) | Solo developer (tool for personal use) |
| Target user (future) | Non-technical PMs + technical devs + teams |
| Deployment (MVP) | Local CLI + local HTTP server |
| Primary interface (MVP) | Web UI |
| Secondary interface (MVP) | CLI entrypoint |
| TUI | v2 |
| License | MIT |
| Governance | Minimal (README + issue templates) |
| Open-source | Yes |
| Platforms | Linux + macOS only (no Windows — DECYZJA-8) |

MVP value priorities:
1. Token cost efficiency
2. Low learning curve (UX-001: zero learning curve)
3. Vibe coding for less technical users
4. Full control and operational safety

---

## 2. Architecture Decision Records (ADR)

All 32 ADRs are maintained in `docs/adr/` (English, consistent format, one file per ADR).

### ADR Index

| ADR | Title | Scope | Group |
|-----|-------|-------|-------|
| 001 | HTTP REST + SSE Communication | MVP | Architecture |
| 002 | Dispatcher-First Agent Architecture | MVP | Architecture |
| 003 | Unlimited Nesting with Loop Detector | MVP | Architecture |
| 004 | 40-Agent Roster with 3 Tiers | MVP | Agent System |
| 005 | Families: Model-Agent-Skill Grouping | MVP | Agent System |
| 006 | AgentConfig with 4 Fallback Types | MVP | Agent System |
| 007 | Hybrid Agent Definition + agentskills.io | MVP | Agent System |
| 008 | Skill System (agentskills.io SKILL.md) | MVP | Agent System |
| 009 | JSONC Config Format with c12 Loader | MVP | Configuration |
| 010 | `.dc/` Project Directory | MVP | Configuration |
| 011 | 4-Layer Config Hierarchy | MVP | Configuration |
| 012 | 4-Dimension Work Mode System | MVP | Work Modes |
| 013 | Project Pipeline: Interview→Plan→Execute→Verify | MVP | Pipeline |
| 014 | Smart Hybrid Approval | MVP | Pipeline |
| 015 | Tool Annotations | MVP | Pipeline |
| 016 | 3-Layer Context Management Architecture | MVP | Context |
| 017 | Condenser Pipeline (Context Compression) | MVP | Context |
| 018 | SQLite Index with Tree-sitter and PageRank | MVP | Context |
| 019 | Smart Context per Subtask (Architect Agent) | MVP | Context |
| 020 | Sub-Agent Context Inheritance (toModelOutput) | MVP | Context |
| 021 | Embeddings Deferred to v2 | v2 | Context |
| 022 | Project Memory: GitHub Issues + SQLite Timeline | MVP | State |
| 023 | No Snapshot System (Git-Based Recovery) | MVP | State |
| 024 | Hook Framework: 20 Types, 6 MVP, Hybrid Model | MVP+v2+v3 | Hooks |
| 025 | Native TS Router with Fallback Chain | MVP | Router |
| 026 | Prompt Caching in MVP Phase 2 | MVP Phase 2 | Router |
| 027 | Git Safety Rails | MVP | Safety |
| 028 | Automatic Secret Redaction | MVP | Safety |
| 029 | Tree-sitter Bash Parsing for Safety | MVP | Safety |
| 030 | MCP Capabilities in MVP | MVP | Tools |
| 031 | Observability: EventStream + Agent Tree UI | MVP+v2 | UI |
| 032 | Web UI Framework: Vite + React + shadcn/ui | MVP | UI |
| 033 | Interceptor/Wrapper Split | MVP | Hooks |
| 034 | Execution Order Contract | MVP | Hooks |
| 035 | ToolCallLimit Middleware | MVP | Hooks |
| 036 | ToolRetry Middleware | MVP | Hooks |
| 037 | LLMToolEmulator Middleware | MVP | Hooks |
| 038 | LLMToolSelector Middleware | MVP | Hooks |
| 039 | Async Subagents | MVP | Agent System |
| 040 | Agent Discovery | MVP | Agent System |

Full ADR details: see [`docs/adr/`](docs/adr/README.md) (each ADR in a separate file).

---

### Middleware Architecture (LangChain-Inspired Patterns)

**Interceptor/Wrapper Split** (ADR-033)
The hook framework now distinguishes between:
- **Interceptors**: Sequential execution for state modification (`before_model_call`, `after_tool_call`)
- **Wrappers**: Nested/onion execution for control flow (`wrap_model_call`, `wrap_tool_call`)

**Execution Order Contract** (ADR-034)
Formal guarantees: interceptors in FIFO order, wrappers nested (outermost first), after-interceptors in LIFO.

**Tool Middleware Stack**
| Component | ADR | Purpose |
|-----------|-----|---------|
| ToolCallLimit | ADR-035 | Per-tool call limits (thread/run) |
| ToolRetry | ADR-036 | Exponential backoff for transient failures |
| LLMToolEmulator | ADR-037 | LLM-based tool emulation for testing |
| LLMToolSelector | ADR-038 | Pre-filter tools with cheaper model |
| Approval | ADR-014 | Human-in-the-loop via wrap_tool_call |

**Async Subagents** (ADR-039)
HEAVY tier agents support async execution via `start_job` → `check_status` → `get_result` pattern.

**Agent Discovery** (ADR-040)
Tool-based discovery via `list_agents()` and `search_agents()` replaces static agent lists in prompts.

---

## 3. Tech Stack

### Core

| Component | Technology | ADR | Rationale |
|---|---|---|---|
| Runtime | Bun | — | Fast runtime with native TS support |
| Web framework (server) | Hono | ADR-001 | Lightweight HTTP API + SSE |
| Storage / memory engine | SQLite (in Hono server) | ADR-022 | Worktree-safe state, timeline, FTS5 |
| Search in memory | SQLite FTS5 | ADR-018 | Full-text search on symbols and state |
| LLM Router | Native TS Router | ADR-025 | Full control over failover and policies |
| Config format | JSONC | ADR-009 | Human-readable, commentable, no build step |
| Config loader | c12 (unjs) + Zod validation | ADR-009 | Battle-tested loader + type-safe validation |
| AI SDK | Vercel AI SDK (@ai-sdk/*) | ADR-025 | Provider integrations + streaming |
| Skill standard | agentskills.io (SKILL.md) | ADR-008 | Ecosystem interoperability |
| Code parsing | tree-sitter | ADR-018, ADR-029 | Symbol extraction + bash safety |
| Testing | Vitest | — | Fast unit tests |
| Web UI framework | Vite + React + shadcn/ui | ADR-032 | AI-friendly, zero magic, Hono integration |
| Monorepo | pnpm workspaces + Turborepo | — | Build orchestration and caching |

### MVP Providers

1. Copilot (priority 1) — GitHub Models API
2. Kimi (priority 2)

Anthropic/OpenAI/DeepSeek are not MVP-first providers in the current specification.

### Interfaces

| Interface | Status |
|---|---|
| Web UI | P0, primary interface |
| CLI | P0, entrypoint/orchestration |
| TUI (Ink) | P1 / v2 |

### Core Tools (MVP)

| Tool | Status | Safety |
|---|---|---|
| File read/edit (Hashline) | CORE | readOnlyHint / idempotentHint |
| Bash execution | CORE | tree-sitter guard (ADR-029) |
| Glob + grep/search | CORE | readOnlyHint |
| Web search + web fetch | CORE | readOnlyHint |
| AST-grep | CORE | readOnlyHint |
| LSP integration (top set) | MVP/P1 | readOnlyHint |
| Git operations | CORE | Safety rails (ADR-027) |
| MCP client capabilities | CORE | Per ADR-030 |

---

## 4. Monorepo — Package Structure

```text
diricode/
├── packages/
│   ├── core/            # @diricode/core — engine, agents, hook registry, pipeline
│   ├── server/          # @diricode/server — Hono HTTP+SSE API
│   ├── web/             # @diricode/web — primary Web UI (Vite + React + shadcn/ui)
│   ├── tui/             # @diricode/tui — Ink TUI (v2)
│   ├── tools/           # @diricode/tools — hashline, ast-grep, lsp, bash safety
│   ├── providers/       # @diricode/providers — Copilot/Kimi adapters + router
│   ├── memory/          # @diricode/memory — SQLite + FTS5 + timeline
│   └── github-mcp/      # @diricode/github-mcp — GitHub Issues/Epics integration
├── apps/
│   └── cli/             # binary entrypoint
├── .dc/
│   └── config.jsonc     # project config (JSONC format, ADR-009/010)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 5. Provider Routing

**MVP mode:** Failover-first (ADR-025).

**Future modes:** Race, consensus, load balancing (v2+).

**Per-agent assignment:**
- Agents are mapped to model families (coding/reasoning/creative) via ADR-005.
- Router selects concrete provider model based on family + cost policy.
- Each agent has 4 fallback types (ADR-006): largeContext, largeOutput, error, strong.

**Operational requirements:**
- Retry with exponential backoff (max 3 retries, max 15s delay).
- Error classification: 7 types (ADR-025).
- Stream inactivity timeout: 60s.
- Cost metadata per request (model, tokens in/out, cost, agent, task).

---

## 6. Configuration

Config format: **JSONC** loaded by **c12** (unjs), validated by **Zod** (ADR-009).
Project directory: **`.dc/`** (ADR-010).
Hierarchy: **4 layers** — defaults → global → project → CLI flags (ADR-011).
Env var prefix: **`DC_*`** (DECYZJA-5).

Example project config (`.dc/config.jsonc`):

```jsonc
{
  // DiriCode project configuration
  "providers": {
    "default": "copilot",
    "routing": "failover",
    "accounts": [
      { "provider": "copilot", "priority": 1 },
      { "provider": "kimi", "priority": 2 }
    ]
  },

  "families": {
    "coding": {
      "models": ["copilot/claude-sonnet", "kimi/k2-coding"],
      "agents": ["code-writer", "code-reviewer-thorough", "code-reviewer-quick", "debugger", "test-writer"],
      "skills": ["coding-default"]
    },
    "reasoning": {
      "models": ["copilot/gpt-reasoning", "kimi/k2-reasoning"],
      "agents": ["dispatcher", "planner-thorough", "planner-quick", "architect", "verifier", "project-builder"],
      "skills": ["planning-default"]
    },
    "creative": {
      "models": ["copilot/gemini-creative"],
      "agents": ["creative-thinker"],
      "skills": ["ux-discovery-default"]
    }
  },

  "skills": {
    "standard": "agentskills.io",
    "roots": {
      "personal": "~/.config/dc/skills",
      "workspace": ".dc/skills",
      "familyDefaults": ".dc/skills-defaults"
    },
    "shadowingOrder": ["personal", "workspace", "family-default"],
    "requireFrontmatter": ["family", "version"],
    "allowSkillEmbeddedMcp": true
  },

  "hooks": {
    "enabled": ["session-start", "pre-commit", "post-commit", "error-retry", "plan-created", "plan-validated"],
    "silentFail": true,
    "timeoutMs": 3000,
    "dagAutoOrder": true
  },

  "memory": {
    "backend": "sqlite-hono",
    "issueBackend": "github",
    "fts5": true,
    "timeline": true,
    "multiProject": true,
    "multiWorktree": true
  },

  "pipeline": {
    "phases": ["interview", "plan", "execute", "verify"],
    "waveExecution": true,
    "analysisParalysisReadLimit": 5,
    "contextBudgetMaxWindowRatio": 0.5,
    "checkpointing": true,
    "atomicCommitPerTask": true
  },

  // Work mode defaults (ADR-012)
  "workMode": {
    "quality": 3,
    "autonomy": 3,
    "verbose": 2,
    "creativity": 2
  }
}
```

API keys are stored in environment variables (`DC_COPILOT_API_KEY`, `DC_KIMI_API_KEY`) or `.env` file in CWD (DECYZJA-6). Never in config files.

---

## 7. MVP Scope — IN vs OUT

### IN (MVP)

| Area | Scope | ADR |
|---|---|---|
| Interface | Web UI as primary interface (P0) | ADR-032 |
| Architecture | HTTP + SSE, dispatcher-first | ADR-001, ADR-002 |
| Agents | 40 agents, 3 tiers, 6 categories | ADR-004 |
| Work modes | 4-dimension system (quality, autonomy, verbose, creativity) | ADR-012 |
| Hooks | Framework + 6 MVP hooks + silent fail + DAG | ADR-024 |
| Memory & state | SQLite in Hono + GitHub Issues/Epics as source of truth | ADR-022 |
| Planning & review | 2 planners + 2 reviewers + separate verifier | ADR-004 |
| Skills | agentskills.io SKILL.md + shadowing + references/ + skill-embedded MCP | ADR-008 |
| Families | Formal family system with model-agent-skill matching | ADR-005 |
| Pipeline | Interview → Plan → Execute → Verify | ADR-013 |
| Delegation | Wave-based execution + nested delegation with loop detector | ADR-003 |
| Guardrails | Analysis paralysis (5 reads), context budget 50%, checkpoints | ADR-013 |
| Tools | Tool annotations (readOnly/destructive/idempotent) | ADR-015 |
| MCP | 3-layer workflow, smart code tools, heartbeat, export/restore, graceful shutdown | ADR-030 |
| Safety | Git safety rails + secret redaction + tree-sitter bash | ADR-027/028/029 |
| Config | JSONC + c12 + 4 layers + `.dc/` directory + `DC_*` env vars | ADR-009/010/011 |
| Context | 3-layer architecture + condenser pipeline + SQLite index | ADR-016/017/018 |
| Observability | EventStream + Agent Tree + Metrics Bar + Live Activity | ADR-031 |
| Router | Native TS, failover-first, 7 error types, Vercel AI SDK | ADR-025 |

### OUT (Not-MVP / v2+)

| Feature | When | ADR |
|---|---|---|
| TUI (Ink) as full interface | v2 | — |
| Annotation-driven approval flow | v2 | ADR-014/015 |
| Context monitoring hooks | v2 | ADR-024 |
| pre-tool-use / post-tool-use hooks | v2 | ADR-024 |
| Observability: Detail Panel, Pre-tool Approval, Timeline | v2 | ADR-031 |
| Semantic embeddings | v2 | ADR-021 |
| Prompt caching | MVP Phase 2 | ADR-026 |
| Recursive skill discovery | v2 | — |
| Work mode presets (named combinations) | v2/v3 | ADR-012 |
| session-end hook | v3 | ADR-024 |
| worktree-create/remove hooks | v3 | ADR-024 |
| config-change hook | v3 | ADR-024 |
| user-prompt-submit hook | v3 | ADR-024 |
| subagent-stop hook | v3 | ADR-024 |
| Config value substitution (`${DC_FOO}`) | v2 | ADR-011 |
| GitLab Issues backend | v2/v3 | ADR-022 |
| Jira backend | v4 | ADR-022 |
| Local backend (no GitHub) | v3/v4 | ADR-022 |
| Skill/plugin catalog and marketplace | v2+ | — |
| Multi-user / cloud / SaaS | Beyond MVP | — |
| IDE extension | Beyond MVP | — |
| Voice interface | Beyond MVP | — |
| Windows support | Not planned | ADR-001 |

---

## 8. Key Execution Rules (MVP)

1. Every plan task gets a separate Issue and a separate atomic commit (ADR-013, ADR-022).
2. Verifier is independent from reviewer — validates against REQ-IDs (ADR-004).
3. Hooks never crash the main process: silent fail + 3s timeout (ADR-024).
4. Agents respect context budget ≤ 50% of window (ADR-016).
5. After 5 reads without a write, agent stops and escalates decision (ADR-013).
6. Architectural changes require ASK — deviation rule #4 (ADR-013).
7. Git safety rails are absolute — even Full Auto mode cannot bypass them (ADR-027).
8. Secrets are redacted before any data is sent to providers (ADR-028).

---

## 9. Bootstrap Plan (Implementation Order)

1. **Router first:** Provider layer Copilot/Kimi + failover policy (ADR-025).
2. **Memory layer:** @diricode/memory — SQLite + FTS5 + timeline + API in Hono (ADR-022).
3. **Issues abstraction:** GitHub-first backend for plans, requirements, roadmap (ADR-022).
4. **Agent core:** Dispatcher + dual planners + dual reviewers + code-writer + code-explorer + architect + summarizer + commit-writer (ADR-002, ADR-004).
5. **Hook framework:** 6 MVP hooks + DAG + silent fail (ADR-024).
6. **Pipeline engine:** Interview → Plan → Execute → Verify + wave execution (ADR-013).
7. **Guardrails:** Analysis paralysis, context budget, checkpoint protocols (ADR-013, ADR-016).
8. **Tool annotations + MCP capabilities** (ADR-015, ADR-030).
9. **Config system:** JSONC + c12 + 4 layers + `.dc/` directory (ADR-009, ADR-010, ADR-011).
10. **Context management:** 3-layer architecture + condenser pipeline + SQLite index (ADR-016, ADR-017, ADR-018).
11. **Observability:** EventStream + Agent Tree + Metrics Bar + Live Activity (ADR-031).
12. **Web UI** (primary) with agent tree view and pipeline status (ADR-032).
13. **Remaining agents:** POC 2 and POC 3 agents from the roster (ADR-004).

---

## 10. Immutable Pillars

The following decisions are foundational and not subject to change:

| Pillar | ADR | Description |
|--------|-----|-------------|
| HTTP + SSE | ADR-001 | Client-server communication protocol |
| Dispatcher-first | ADR-002 | Agent orchestration model |
| Nested delegation + loop guard | ADR-003 | Recursive agent delegation with safety |
| Git safety rails | ADR-027 | Non-negotiable git operation safety |
| Secret redaction | ADR-028 | Automatic secret masking |
| Tree-sitter bash | ADR-029 | Safe bash command parsing |
| JSONC + c12 config | ADR-009 | Configuration format and loader |
| `.dc/` directory | ADR-010 | Project directory convention |
| `DC_*` env vars | ADR-011 | Environment variable prefix |
| 4-dimension work modes | ADR-012 | Replaces old "lean mode" concept |

---

DiriCode: You conduct, agents execute the plan in stages, with cost, context, and risk control.
