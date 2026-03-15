# ADR-008 — Skill System (agentskills.io SKILL.md)

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-narzedzi-ekosystem.md                 |

### Context

Skills extend agent capabilities with domain-specific knowledge (prompts, references, tool definitions). A standard format enables sharing across projects and ecosystems.

### Decision

Skill system based on **agentskills.io `SKILL.md`** format.

MVP requirements:
- **Frontmatter minimum:** `family` + `version` (YAML).
- **`references/` subfolder:** Supported, loaded on-demand.
- **Skill shadowing order:** `personal > workspace > family-default`.
  - Personal: `~/.config/dc/skills`
  - Workspace: `.dc/skills`
  - Family defaults: `.dc/skills-defaults`
- **Multi-skill per repo:** Skills organized in folders by family.
- **Skill-embedded MCP:** A skill can contain MCP tool definitions (after MCP is configured in DiriCode).

### Consequences

- **Positive:** Standardized, shareable skills. Shadowing allows personal overrides without modifying workspace config.
- **Negative:** Requires frontmatter validation. On-demand loading adds slight complexity.
