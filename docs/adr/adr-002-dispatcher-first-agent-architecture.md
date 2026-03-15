# ADR-002 — Dispatcher-First Agent Architecture

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-agent-roster.md, analiza-plandex-roles.md |

### Context

DiriCode needs a multi-agent orchestration model. The dispatcher pattern (thin orchestrator that delegates to specialized agents) was chosen over monolithic agent or flat peer-to-peer models for better cost control and separation of concerns.

### Decision

**Dispatcher-first architecture** with specialized agents organized into families.

Core principles:
- Dispatcher is the orchestrating agent with minimal own context — it routes, delegates, and monitors.
- Sub-agents return **essential data only** (not full conversation history).
- Agent names are **descriptive only** (no mythological names — explicit project decision).
- Core agents are **hardcoded in TypeScript** (stable execution policies).
- Custom agents are defined as **SKILL.md** files (agentskills.io format).

The full agent roster (40 agents across 6 categories) is defined in ADR-004.

### Consequences

- **Positive:** Clear separation of concerns. Each agent has a focused prompt and model assignment. Cost-effective (cheap agents for cheap tasks).
- **Negative:** Requires careful context passing between agents. Dispatcher quality is critical — bad routing = bad results.
