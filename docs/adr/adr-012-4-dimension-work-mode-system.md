# ADR-012 — 4-Dimension Work Mode System

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-lean-mode.md                          |

### Context

The old spec had a single "lean mode" concept. Analysis revealed this is too coarse — users need independent control over quality, autonomy, verbosity, and creativity. These 4 orthogonal dimensions replace the old binary lean/full toggle.

### Decision

**4 independent dimensions**, each with discrete levels. Changeable per-prompt via UI controls below the chat input.

#### Quality Dimension (5 levels)

| Level | Label | Agent Activation | Use Case |
|-------|-------|-----------------|----------|
| 1 | Cheap | 1 agent, cheapest model, no review | Quick throwaway tasks |
| 2 | POC | code-writer-quick + code-reviewer-quick | Prototyping |
| 3 | Standard (DEFAULT) | Full pipeline, standard models | Normal development |
| 4 | Production | Thorough review, better models, test-writer | Production code |
| 5 | Super | Multi-reviewer, strongest models, risk-assessor | Critical systems |

#### Autonomy Dimension (5 levels)

| Level | Label | Behavior |
|-------|-------|----------|
| 1 | Ask Everything | Confirm every tool use |
| 2 | Suggest | Show plan, wait for approval |
| 3 | Auto-Edit (DEFAULT) | Auto-execute reads/edits, ask for bash/git |
| 4 | Auto-Execute | Auto-execute most operations, ask for destructive only |
| 5 | Full Auto | No confirmations (dangerous, expert only) |

#### Verbose Dimension (4 levels)

| Level | Label | Output |
|-------|-------|--------|
| 1 | Silent | Results only, no explanation |
| 2 | Compact (DEFAULT) | Brief status + results |
| 3 | Explain | Step-by-step reasoning |
| 4 | Narrated | Full thought process, educational |

#### Creativity Dimension (5 levels)

| Level | Label | Behavior |
|-------|-------|----------|
| 1 | Reactive | Only does exactly what asked |
| 2 | Helpful (DEFAULT) | Suggests improvements when relevant |
| 3 | Research | Proactively researches alternatives |
| 4 | Proactive | Suggests architectural changes |
| 5 | Creative | Unconventional approaches, brainstorming |

#### UI Integration

- Dimensions shown as **sliders/dropdowns below the chat input** (always visible).
- Changes apply to the **next prompt only** (not retroactive).
- **Presets** (named combinations like "Quick & Dirty", "Production Ready") deferred to v2/v3.

### Consequences

- **Positive:** Fine-grained control without mode switching. Users adjust exactly what they need. Agent activation matrices provide deterministic behavior per combination.
- **Negative:** 4 dimensions × multiple levels = complex interaction matrix. Mitigated by sensible defaults (Standard/Auto-Edit/Compact/Helpful) and future presets.
- **Migration:** All references to "lean mode" must be replaced with "4-dimension work mode system."
