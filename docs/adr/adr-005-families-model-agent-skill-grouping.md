# ADR-005 — Unified Capability Taxonomy (supersedes family grouping)

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Amended                                       |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-agent-roster.md                       |

### Context

The original "family" concept tried to classify models, agents, and skills with one shared taxonomy. In practice this produced overlapping semantics across `AgentCategory`, two separate `ModelFamily` definitions, and `ModelTag` lists.

That overlap made routing harder to reason about:
- agent handoff policy wanted one stable primary domain,
- picker scoring wanted model-suitability attributes,
- specialization wanted fine-grained free-form labels,
- providers remained the real source of model context windows and concrete model IDs.

### Decision

Replace the family abstraction with a unified capability model:

```typescript
type AgentDomain = "coding" | "review" | "research" | "planning" | "devops" | "utility";
type ModelAttribute = "reasoning" | "speed" | "agentic" | "creative" | "ui-ux" | "bulk" | "quality";

interface AgentCapabilities {
  primary: AgentDomain;
  specialization: readonly string[];
  modelAttributes: readonly ModelAttribute[];
}
```

Rules:
- Agents expose one `primary` domain for routing, handoff filtering, and high-level policy.
- Fine-grained capability matching uses `specialization` strings, not nested enum taxonomies.
- Picker scoring consumes `modelAttributes`, not families/tags.
- `ModelHints.families` is removed; provider metadata is the source of concrete model details such as context window.
- No compatibility aliases or deprecated wrappers are kept in code.

### Consequences

- **Positive:** One runtime taxonomy replaces four overlapping ones. Routing, registry search, picker scoring, and handoff policy now speak the same structural language.
- **Negative:** Historical ADR references to families are now legacy and must be interpreted through `primary` / `specialization` / `modelAttributes`.
