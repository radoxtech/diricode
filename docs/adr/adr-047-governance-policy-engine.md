## ADR-047 — Governance & Policy Engine

| Field       | Value                                                                              |
|-------------|------------------------------------------------------------------------------------|
| Status      | Accepted                                                                           |
| Date        | 2026-03-23                                                                         |
| Scope       | MVP                                                                                |
| References  | ADR-024 (hooks), ADR-012 (work modes), ADR-014 (approval), Survey Decision A3     |

### Context

Without governance, agents make inconsistent decisions across a session and across projects. One agent uses tabs; another uses spaces. One imports from barrel files; another imports from direct paths. One wraps errors in a custom class; another throws bare strings. These inconsistencies are not bugs — they are judgment calls, and agents make them without shared context.

The root problem is architectural: agents receive task-specific context but no project-wide constraints. Each agent starts fresh with only its immediate instructions and whatever file context it picks up. It has no way to know that this project forbids `console.log`, or that imports must come from the public package API, or that all React components must have an associated test file.

Existing mechanisms do not solve this:

- **Code review** catches violations after the fact. The agent has already written non-conforming code, wasted tokens, and potentially triggered a rewrite.
- **System prompts** can carry conventions, but they are model-context that gets compressed and lost. They scale poorly as rules grow.
- **Pre-commit hooks** (ADR-024 Phase 1) catch formatting and lint issues, but only after the work is done. They cannot tell an agent *during* tool execution that a particular file path is forbidden.

The user wants project-wide rules that all agents respect, consistently, across all sessions. The rules should be:

- **Explicit**: defined in files the user can read and edit, not hidden in prompts
- **Enforceable**: applied at the moment an agent tries to take an action, not after
- **Legible**: written in plain language, not just regex patterns
- **Graduated**: violations should feed back to the agent so it can self-correct, not crash the session

Precedent from adjacent systems is instructive. **Open Policy Agent (OPA)** decouples policy decision-making from enforcement: services ask "is this allowed?" and OPA evaluates declarative Rego policies to answer. The key insight is separation — the policy lives separately from the code that checks it. **Cursor Rules** (`.cursor/rules/`) demonstrates that project-level governance for AI agents is a real user need: version-controlled markdown files that inject persistent constraints into every AI interaction. **ESLint's flat config** shows how composable, file-scoped rule sets work in practice — rules target specific file patterns, violations have configurable severity (`warn` vs `error`), and the whole thing lives in the repository.

DiriCode's governance engine draws from all three: OPA's separation of policy from enforcement, Cursor Rules' version-controlled agent instructions, and ESLint's per-category severity model.

### Decision

**DiriCode projects define governance policies in `.dc/policies/` as YAML files. These policies are enforced at runtime via the `pre-tool-use` hook from the Hook Framework (ADR-024). Violations feed back to the agent as correction context — not hard stops — unless the policy explicitly requires hard enforcement.**

#### Policy Storage

Policies live in `.dc/policies/`, alongside the rest of the project's DiriCode configuration (ADR-010). Each YAML file is a named policy covering one governance concern:

```
.dc/
  policies/
    coding-style.yml
    imports.yml
    forbidden-patterns.yml
    file-organization.yml
    naming.yml
```

Policies are version-controlled with the project. Any developer can read, edit, or add policies without touching DiriCode source code. This is the same philosophy as Cursor Rules: governance lives in the repository, not in a SaaS dashboard.

#### Policy Categories

Five categories are defined for MVP. Each maps to a different class of agent decision:

| Category | What it governs | Example rules |
|----------|-----------------|---------------|
| `coding-style` | Formatting and syntax choices | No `console.log`, no `var`, trailing commas required |
| `file-organization` | Where files go and what they are named | Components in `src/components/`, tests co-located, no files in project root except config |
| `imports` | How modules reference each other | No barrel file imports, no relative `../..` beyond 2 levels, no circular imports |
| `forbidden-patterns` | Explicit prohibited constructs | No `eval()`, no `process.exit()`, no `TODO` comments in main branch code |
| `naming` | Identifier conventions | PascalCase for components, camelCase for functions, UPPER_SNAKE for constants |

This is not an exhaustive list. Users can define policies outside these categories — the category field is freeform metadata. These five cover the most common sources of agent inconsistency in real projects.

#### Policy Language

Policies are written in YAML with human-readable descriptions alongside their machine-checkable conditions. A policy file does not require regex knowledge to read or understand. The description is the canonical statement of intent; the conditions are the operational form.

Example:

```yaml
# .dc/policies/imports.yml
name: Import Discipline
description: Keep the import graph clean and explicit.
version: 1
rules:
  - id: no-barrel-imports
    description: Import from the source module directly, not from index re-exports.
    rationale: Barrel imports create hidden coupling and slow TypeScript compilation.
    applies_to: ["**/*.ts", "**/*.tsx"]
    enforcement: soft
  - id: no-deep-relative
    description: Do not use relative imports with more than one parent directory traversal.
    example_violation: "import { foo } from '../../../utils/foo'"
    applies_to: ["**/*.ts"]
    enforcement: soft
```

The `description` and `rationale` fields are not decorative — they are injected into the feedback message the agent receives when it violates a rule. The agent needs to understand *why* a rule exists to make a better decision on retry.

#### Enforcement via `pre-tool-use` Hook

The `pre-tool-use` hook (ADR-024 Phase 2) fires before every tool call. It is a Wrapper hook — it can modify the tool call, block it, or inject feedback. The policy engine registers as a `pre-tool-use` handler.

When an agent attempts a tool call that touches files (write, edit, create, bash with file arguments), the policy engine:

1. Identifies the target file(s)
2. Loads applicable policies (by `applies_to` glob match)
3. Evaluates the action against each matching rule
4. If all rules pass: tool call proceeds unchanged
5. If any rule fails: the hook injects a correction message into the agent's context and blocks the tool call

The correction message includes: which rule was violated, the rule's description and rationale, and a suggestion for how to conform. The agent then has another opportunity to attempt the action correctly.

This is the separation OPA teaches: the policy engine is the decision point (PDP); the `pre-tool-use` hook is the enforcement point (PEP). The enforcement mechanism is independent of the policy definitions.

#### Soft vs Hard Enforcement

The default enforcement mode is **soft**: a violation blocks the current tool call and injects feedback, but the agent retries. After a configurable number of retry attempts (default: 3), soft enforcement gives up and allows the action through with a logged warning. This prevents policy misconfiguration from completely halting agent execution.

Hard enforcement can be specified per rule with `enforcement: hard`. Hard violations are never bypassed — if the agent cannot comply after 3 retries, execution stops and the user is notified. Hard enforcement should be reserved for rules where violation is genuinely unacceptable (e.g., writing credentials to a file, modifying a protected directory).

| Mode | On first violation | After max retries |
|------|-------------------|-------------------|
| `soft` (default) | Block + inject feedback | Allow through + warn |
| `hard` | Block + inject feedback | Stop + escalate to user |

This mirrors how ESLint treats `warn` vs `error` severity, applied to the agent's tool-use lifecycle rather than static analysis.

#### Integration with Work Modes (ADR-012)

The Quality dimension (ADR-012) affects policy enforcement strictness:

| Quality Level | Policy behavior |
|--------------|-----------------|
| 1 (Cheap) | Policies disabled. Speed over correctness. |
| 2 (POC) | Only `hard` policies enforced. Soft policies skipped. |
| 3 (Standard, default) | All policies enforced with default retry limits. |
| 4 (Production) | All policies enforced. Retry limit reduced to 1 (violations get one correction attempt). |
| 5 (Super) | All policies enforced. Any soft violation escalated to hard. |

This means: running at Quality 1 for a quick throwaway prototype skips governance overhead entirely. Running at Quality 5 for a critical system treats all policy violations as blocking. The user does not need to reconfigure policies to change strictness — they adjust the Quality slider.

#### Integration with Approval System (ADR-014)

The approval system (ADR-014) categorizes actions as Safe, Risky, or Destructive and decides whether to ask the user. Governance policies operate at a different level: they evaluate *what* an action does, not *whether* to permit it. The two systems compose naturally.

An action can pass approval (user said yes) but still fail a governance policy (the file being written violates an import rule). Approval addresses authorization; governance addresses correctness. Both fire via the `pre-tool-use` wrapper chain.

#### Policy Precedence and Merging

Policies from `.dc/policies/` apply to the current project. If DiriCode later supports a global policy directory (`~/.config/dc/policies/`), project-level policies take precedence over global ones for the same rule ID. Within a project, all policy files are loaded and merged — there is no file priority. Rule IDs must be unique across all policy files in a project; duplicate IDs fail loudly at load time.

### Consequences

- **Positive:**
  - Agents work within explicit, documented project constraints. Code reviews spend less time on style and convention corrections.
  - Policies are version-controlled alongside code. New contributors (human or agent) read the same rules. Governance is not locked in someone's head or a private prompt.
  - Soft enforcement avoids breaking the agent loop on policy misconfiguration. A policy that generates false positives degrades gracefully.
  - The Quality dimension integration means governance automatically tightens as production risk increases, without per-policy reconfiguration.
  - Policy violations create a log of agent decisions. This is auditable: you can see which rules fired, how often, and whether the agent self-corrected.

- **Negative / Trade-offs:**
  - Policy files require maintenance. Rules that are too strict create false positives that interrupt agent flow. Rules that are too loose provide no value. Finding the right threshold takes iteration.
  - The `pre-tool-use` hook is Phase 2 (ADR-024 v2 timeline). The policy engine cannot ship until that hook type is available. Pre-commit hooks (Phase 1) provide a weaker fallback — they catch violations after the work is done, not during.
  - Soft enforcement means agents can and do violate policies after retries are exhausted. This is intentional but means governance is advisory at default quality levels, not a guarantee.
  - YAML policy files with natural-language descriptions are more readable than regex patterns, but they still require the evaluation logic to translate those descriptions into actual checks. That translation layer (how a "no barrel imports" description becomes a tree-sitter or AST query) is an implementation detail left to the policy engine.
  - No policy conflict resolution for contradictory rules: if two rules specify incompatible requirements for the same file, the agent will loop. Rule authors are responsible for ensuring consistency. Tooling to detect conflicts at policy load time is deferred.

- **Migration notes:** No prior decision addressed governance. This is a new capability. The `.dc/policies/` directory does not exist in existing projects and will not be created automatically — an empty policies directory means no governance overhead until the user opts in.
