# ADR-007 — Hybrid Agent Definition + agentskills.io

| Field       | Value                                                         |
|-------------|---------------------------------------------------------------|
| Status      | Accepted                                                      |
| Date        | 2026-03-09                                                    |
| Scope       | MVP                                                           |
| References  | analiza-narzedzi-ekosystem.md, Survey Decision C4             |

### Context

DiriCode needs both stable, performance-critical core agents and a flexible extension mechanism for community/custom agents. The agentskills.io ecosystem provides an emerging standard.

### Decision

**Dual definition model:**
- **Core agents:** Hardcoded in TypeScript (stable execution policies, typed interfaces).
- **Custom agents:** Defined as `SKILL.md` files following the agentskills.io standard.

For custom agents, DiriCode adopts the **agentskills.io format** as de facto standard for skill/agent interoperability.

### Consequences

- **Positive:** Stable core runtime + flexible community extensions. Interoperability with other AI tooling ecosystems.
- **Negative:** Two definition paths to maintain. Core agents can't be modified without code changes (by design — stability).

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**Agent Discovery Tools** (ADR-040)
Agents defined via SKILL.md and TypeScript are now discoverable through `list_agents()` and `search_agents()` tools. The hybrid definition model (TS + SKILL.md) serves as the backend for the discovery registry.

**Registry Metadata**
SKILL.md files should include these fields for optimal discovery:
- `name`: Agent identifier
- `description`: What the agent does (used for semantic search)
- `tier`: LIGHT, MEDIUM, or HEAVY (determines execution mode)
- `primary`: Functional domain (e.g., `coding`, `review`, `research`)
- `specialization`: Free-form keywords for capability-based search
- `modelAttributes`: Picker-facing suitability hints

The discovery registry indexes both TS hardcoded agents and SKILL.md definitions at startup, providing a unified interface for the dispatcher.

### Addendum — YAML+TS+Zod Hybrid Definitions (Survey Decision C4)

**Triple-Layer Architecture for Agent Configuration**
Agent definitions now adopt a three-layer hybrid approach that balances human readability, type safety, and runtime validation:

**YAML** — Human-readable metadata layer
- Agent capability metadata, model preferences, and specialization declarations
- Tier assignments (LIGHT, MEDIUM, HEAVY) and primary domains
- Discoverable metadata indexed by the agent registry
- Edited by non-technical stakeholders, reviewed by code

**TypeScript** — Behavior and logic layer
- Agent behavior code, tool implementations, and complex orchestration logic
- Type-safe interfaces ensuring compile-time correctness
- Direct access to runtime context and execution hooks
- Maintains DiriCode's stability guarantees for core agents

**Zod** — Validation and contract layer
- Schema validation for agent YAML configs, tool inputs/outputs, and inter-agent messages
- Runtime enforcement of constraints before tools are invoked
- Unified error handling with structured validation results
- Prevents invalid configurations from reaching execution

**Why This Hybrid**
A pure TypeScript approach lacks readability and editability for non-developers. A pure YAML approach lacks type safety and complex logic. The YAML+TS+Zod combination ensures agent definitions are simultaneously human-readable (YAML), type-safe (TS), and validated at runtime (Zod), eliminating entire classes of configuration errors and enabling safer community contributions.
