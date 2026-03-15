# ADR-005 — Families: Model-Agent-Skill Grouping

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-agent-roster.md                       |

### Context

With 40 agents and multiple model providers, a grouping mechanism is needed to simplify model assignment and skill matching. Families provide this abstraction.

### Decision

Introduce a formal **Family** concept:

```
Family = { models[], agents[], skills[] }
```

Rules:
- Models are assigned to families (e.g., coding, reasoning, creative).
- Agents belong to families.
- Skills belong to families.
- Agent-skill matching happens by family.
- **Family Packs** are named profiles mapping each agent → model + fallbacks (simplifies config for non-technical users).

### Consequences

- **Positive:** Non-technical users can pick a "Family Pack" instead of configuring 40 individual agent-model mappings. Skill-agent matching is automatic within a family.
- **Negative:** Family boundaries must be well-defined. An agent that spans multiple domains (e.g., `creative-thinker` doing both coding and planning) needs clear family assignment rules.
