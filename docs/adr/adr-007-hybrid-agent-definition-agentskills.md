# ADR-007 — Hybrid Agent Definition + agentskills.io

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-narzedzi-ekosystem.md                 |

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
