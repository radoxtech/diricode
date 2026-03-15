# ADR-032 — Web UI Framework: Vite + React + shadcn/ui

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-web-framework.md                      |

### Context

The Web UI is the primary interface (P0). The framework choice affects both developer productivity and AI agent code generation quality. Research across Reddit, HN, and AI agent documentation confirmed React as the optimal choice for AI-assisted development.

### Decision

**Vite + React (SPA) + shadcn/ui** for the Web UI.

#### Rationale

1. **React has the largest LLM training base** — AI agents (including DiriCode's own agents) generate React code most accurately.
2. **Vercel published official `react-best-practices` as Agent Skills** for Claude Code, Codex, Cursor, OpenCode — React is the only framework with dedicated AI tooling support.
3. **Vite over Next.js** — No routing magic, simpler setup, native integration with Hono (same server). Next.js is "least vibe coding friendly" (too many choices for AI).
4. **shadcn/ui (109k+ stars)** — Copy-paste component model, full control, excellent AI generation support.

#### Rejected Alternatives

| Framework | Reason for Rejection |
|-----------|---------------------|
| Next.js | Overengineered for local SPA. Not opinionated enough (AI struggles with custom stacks). |
| SvelteKit | Less AI training data. No dedicated AI tooling. User reported AI failures with Svelte. |

### Consequences

- **Positive:** Best AI code generation quality. Huge ecosystem. Native Hono integration (same Bun server). shadcn/ui provides production-ready components.
- **Negative:** React bundle size (mitigated by Vite tree-shaking). React isn't the "newest" framework, but has the strongest AI support.

---

## ADR Index

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
