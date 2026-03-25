# Epic: Skills System and Work-Mode-Aware Specialization

> **Package**: `@diricode/core`
> **Iteration**: MVP-2 (engine) → MVP-3 (built-in skills)
> **Issue IDs**: DC-SKILL-001 — DC-SKILL-007
> **Dependencies**: DC-CORE-005..012 (agent runtime), DC-CORE-001..004 (config), DC-TOOL-001..012 (tool contracts)

## Summary
This epic defines a configurable skills system for agent specialization: typed skill definitions, loader/registry, prompt/tool/constraint injection, and built-in skills.

Key constraints:
- **Metis guidance**: skills system was **not** in POC. POC keeps hardcoded TypeScript agent behavior; skills start in MVP-2.
- Skills follow the reusable package model (OpenCode-like), with custom skills in project scope.
- Skill behavior adapts to 4 work-mode dimensions from `analiza-lean-mode.md`: Quality, Autonomy, Verbose, Creativity.
- **LLM-based routing**: a LOW-tier router handles skill selection to save context tokens for HEAVY/MEDIUM agents.

---

## Issue: DC-SKILL-001 — Skill definition interface

### Description
Define a canonical `SkillDefinition` contract:
- `name`, `description`, `instructions` (prompt text)
- `tools` (allowlisted subset)
- `constraints` (guardrails/extensions)
- optional tags/metadata for discovery

Support custom skill file format as JSON/JSONC for `.dc/skills/`.

### Acceptance Criteria
- [ ] Shared exported TS type for `SkillDefinition`.
- [ ] Zod runtime schema validates JSON/JSONC skills.
- [ ] `instructions`, `tools`, `constraints` are required in normalized runtime object.
- [ ] Validation errors are typed (`code/message/context`) and actionable.
- [ ] Contract supports future parity with SKILL.md ecosystem without breaking JSON/JSONC.

### References
- `spec-mvp-diricode.md` (ADR-008 skill system, ADR-012 work modes)
- `analiza-lean-mode.md`
- `ankieta-features-ekosystem.md` (skills decisions, shadowing, family matching)

### Dependencies
- Depends on: DC-CORE-001..004
- Blocks: DC-SKILL-002, DC-SKILL-003

---

## Issue: DC-SKILL-002 — Skill loader and registry

### Description
Implement loading and indexing pipeline:
- Built-in skills from `packages/core/skills/`
- Custom skills from `.dc/skills/`
- Registry APIs: `getByName`, `listAll`, `filterByTag`

Resolution policy:
- deterministic merge order
- custom skills can override built-ins only by explicit name conflict policy

### Acceptance Criteria
- [ ] Loader scans both roots and validates each skill definition.
- [ ] Registry supports lookup/list/filter APIs with stable ordering.
- [ ] Name conflicts are resolved deterministically and logged.
- [ ] Invalid custom skills are rejected without crashing the pipeline.
- [ ] Registry emits typed events (`skill.loaded`, `skill.rejected`) for observability.

### References
- `ankieta-features-ekosystem.md` (shadowing hierarchy concepts)
- `cross-cutting.md` (typed errors, logging)

### Dependencies
- Depends on: DC-SKILL-001
- Blocks: DC-SKILL-003, DC-SKILL-004, DC-SKILL-005, DC-SKILL-007

---

## Issue: DC-SKILL-007 — LLM-Based Skill Router

### Description
Implement a LOW-tier LLM router to dynamically select skills based on task context. This prevents context bloat in HEAVY/MEDIUM models by only loading necessary skill definitions.

Scope:
- specialized prompt for LOW-tier model (e.g., Haiku/DeepSeek)
- skill metadata extraction for routing prompt (ID, name, description)
- integration into dispatcher before agent spawning

### Acceptance Criteria
- [ ] Skill metadata is indexed in SQLite memory layer for fast retrieval.
- [ ] Router uses a LOW-tier model (cost/latency optimization).
- [ ] Router returns a JSON list of skill IDs.
- [ ] Dispatcher loads the identified skills before spawning the target agent.
- [ ] Max skill limit (e.g., 3-5) is enforced to maintain context hygiene.
- [ ] Routing decisions are traceable in EventStream metadata.

### References
- `docs/adr/adr-043-llm-skills-loader.md` (primary)
- `docs/adr/adr-004-agent-roster-3-tiers.md` (tiering strategy)

### Dependencies
- Depends on: DC-SKILL-002
- Blocks: DC-SKILL-003

---

## Issue: DC-SKILL-003 — Skill injection into agent prompts

### Description
When an agent is assigned a skill:
1. inject `skill.instructions` into system prompt assembly,
2. restrict available tools to skill allowlist subset,
3. append skill constraints to runtime guardrails.

This is integrated in the agent prompt builder/runtime path.

### Acceptance Criteria
- [ ] Prompt builder includes skill instructions in deterministic section order.
- [ ] Tool access is intersected: `agent tool access ∩ skill tools`.
- [ ] Constraints are enforced at runtime (not documentation-only).
- [ ] Missing tool references in skill definition produce typed validation errors.
- [ ] Injection path is traceable via EventStream metadata (skill name/version).

### References
- `spec-mvp-diricode.md` (prompt composition, tool annotations, guardrails)
- `analiza-lean-mode.md` (dimension-aware behavior shaping)

### Dependencies
- Depends on: DC-SKILL-001, DC-SKILL-002, DC-CORE-010
- Blocks: DC-SKILL-006

---

## Issue: DC-SKILL-004 — Built-in skill: `git-master`

### Description
Create built-in `git-master` skill focused on safe git workflows.

Scope:
- expertise: status/diff/add/commit/log/blame
- constrained operations aligned with git safety conventions
- instruction profile optimized for atomic, auditable changes

### Acceptance Criteria
- [ ] Built-in skill file exists under `packages/core/skills/`.
- [ ] Tool allowlist includes only approved git operations (and necessary read-only context tools).
- [ ] Constraints explicitly reference cross-cutting git rules (conventional commits, one logical change per commit).
- [ ] Skill can be retrieved via registry by name and listed by tag.
- [ ] Prompt injection shows `git-master` metadata in trace/debug output.

### References
- `cross-cutting.md` (git conventions)
- `spec-mvp-diricode.md` (ADR-027 git safety rails)

### Dependencies
- Depends on: DC-SKILL-002, DC-SKILL-003, DC-TOOL-007

---

## Issue: DC-SKILL-005 — Built-in skill: `frontend-specialist`

### Description
Create built-in `frontend-specialist` skill for modern UI implementation quality:
- React + TypeScript + CSS architecture
- accessibility and responsive design defaults
- LSP-assisted refactor/validation loop
- optional browser-agent delegation for UI verification flow

### Acceptance Criteria
- [ ] Built-in skill file exists with frontend-focused instruction corpus.
- [ ] Tool allowlist includes file read/write/edit, LSP tools, and browser-agent delegation entrypoint.
- [ ] Constraints enforce accessibility baseline and responsive validation expectations.
- [ ] Skill tags support registry filtering (`frontend`, `ui`, `a11y`).
- [ ] Skill works with both quick and thorough frontend tasks (quality-dependent execution depth).

### References
- `spec-mvp-diricode.md` (primary Web UI, UX priorities)
- `ankieta-features-ekosystem.md` (agent + skill organization)

### Dependencies
- Depends on: DC-SKILL-002, DC-SKILL-003, DC-TOOL-008

---

## Issue: DC-SKILL-006 — Work mode integration (4 dimensions)

### Description
Integrate skills with 4-dimension work modes so behavior adapts per prompt/session:
- **Quality**: detail/rigor depth in skill instructions and validation strictness
- **Creativity**: breadth of exploration and alternative proposals
- **Autonomy**: degree of auto-execution vs approval gating language
- **Verbose**: response detail/telemetry narrative style

### Acceptance Criteria
- [ ] Runtime maps work mode levels to skill execution modifiers.
- [ ] Quality affects test/review depth directives in injected instructions.
- [ ] Creativity affects exploration branch guidance in skill prompts.
- [ ] Autonomy affects action-gating language and approval handoffs.
- [ ] Verbose affects output formatting/detail profile in agent responses.

### References
- `analiza-lean-mode.md` (primary)
- `spec-mvp-diricode.md` (ADR-012)
- `analiza-observability.md` (verbose-dependent observability detail)

### Dependencies
- Depends on: DC-SKILL-003, DC-CORE work-mode runtime
- Blocks: consistent skill behavior across MVP-3 UX

---

## Must NOT
- Must NOT backport skills as a hard dependency to POC routing (Metis constraint).
- Must NOT allow skill toolsets to bypass safety rails or annotation-based restrictions.
- Must NOT treat constraints as optional prose; they must be enforceable runtime inputs.
- Must NOT include marketplace/catalog/discovery beyond local built-in + `.dc/skills` scope in MVP.

## Epic Dependencies
- **Blocked by**: agent runtime/prompt builder and tool contracts.
- **Blocks**: higher-fidelity specialist agent behavior and work-mode-consistent execution in MVP-3.
