# Epic: Skill Marketplace and Catalog (v2.1)

> Package: `@diricode/core` + new `@diricode/marketplace`
> Iteration: **v2.1**
> Issue IDs: **DC-MKT-001..DC-MKT-006**

## Summary

Builds a skill discovery and installation system on top of MVP's SKILL.md-based skill loading. Users can browse a catalog of community and official skills, install them with a single command, and have them auto-discovered by the skill loader.

Survey references: 10.1 (skill/plugin catalog), 10.2 (category-based discovery), 10.5 (one-command install)
v3+ deferred: 10.3 (star/popularity ranking), 10.4 (license compatibility filter), 10.6 (auto-update check)

## Architectural Baseline

- MVP skill system: SKILL.md files with frontmatter, loaded from `.dc/skills/` and `node_modules/`
- agentskills.io standard for skill format
- Skill shadowing: personal > workspace > family-default
- Multi-skill per repo (folders by family)

## Issues

### DC-MKT-001 — Skill registry and index format

**Goal**: Define the registry format for publishing and discovering skills.

**Scope**
- Registry index: JSON file listing all available skills with metadata
- Skill metadata: name, version, family, description, author, tags, compatible agents, license
- Registry hosting: GitHub repository (simple — just a JSON index + git releases)
- Versioning: semver for skills
- Index update: CLI fetches latest index on `diricode search` or periodic background check

**Acceptance criteria**
- [ ] Registry index schema defined and validated with Zod
- [ ] Index includes all metadata fields needed for search and display
- [ ] Index fetchable from GitHub repository
- [ ] Semver versioning enforced on skill entries
- [ ] Index parseable without full skill download

**References**
- Survey feature 10.1 (skill/plugin catalog)
- MVP `epic-skills.md` (SKILL.md format, agentskills.io standard)

---

### DC-MKT-002 — Category-based skill discovery

**Goal**: Implement browsable skill catalog with category filtering and text search.

**Scope**
- Categories derived from agent tags: `frontend`, `devops`, `git`, `testing`, `debugging`, `documentation`, etc.
- CLI: `diricode skills search <query>` — text search across name, description, tags
- CLI: `diricode skills browse <category>` — category-based listing
- Output: formatted table with name, version, description, install count (if available)
- Web UI: skill browser page with category sidebar and search bar

**Acceptance criteria**
- [ ] Text search matches across skill name, description, and tags
- [ ] Category filtering returns only matching skills
- [ ] CLI output formatted as readable table
- [ ] Web UI skill browser renders catalog
- [ ] Results sorted by relevance (name match > description match > tag match)

**References**
- Survey feature 10.2 (category-based discovery)

---

### DC-MKT-003 — One-command skill installation

**Goal**: Install a skill with a single CLI command that handles download, placement, and validation.

**Scope**
- CLI: `diricode install <skill-name>` or `diricode install <skill-name>@<version>`
- Download: fetch skill from registry (GitHub release or npm package)
- Placement: install to `.dc/skills/<family>/<skill-name>/`
- Validation: verify SKILL.md frontmatter, check compatibility, verify license
- Conflict detection: warn if skill shadows existing skill
- Uninstall: `diricode uninstall <skill-name>`

**Acceptance criteria**
- [ ] Single command installs skill to correct directory
- [ ] Version pinning works (@version syntax)
- [ ] SKILL.md frontmatter validated post-install
- [ ] Shadow conflict warning displayed
- [ ] Uninstall cleanly removes skill files

**References**
- Survey feature 10.5 (one-command install)

---

### DC-MKT-004 — Recursive skill discovery

**Goal**: Implement automatic discovery of skills in nested directory structures and node_modules.

**Scope**
- Scan locations: `.dc/skills/`, `node_modules/@diricode-skill-*/`, `node_modules/diricode-skill-*`
- Recursive: walk directories looking for SKILL.md files
- Discovery cache: index discovered skills in SQLite for fast lookup
- Re-scan triggers: on install/uninstall, on session-start, on config change
- Respect skill shadowing hierarchy: personal > workspace > family-default

**Acceptance criteria**
- [ ] Skills discovered in all scan locations
- [ ] Nested directory structures handled (multi-level)
- [ ] Discovery cache in SQLite for fast lookup
- [ ] Shadowing priority correctly applied
- [ ] Re-scan triggers work without restart

**References**
- Survey feature 1.4 (recursive skill discovery)
- MVP `epic-skills.md` (skill loading system)

---

### DC-MKT-005 — Skill compatibility and validation

**Goal**: Validate that installed skills are compatible with current DiriCode version and project configuration.

**Scope**
- DiriCode version compatibility: skill declares minimum version in frontmatter
- Agent compatibility: skill declares which agent families it works with
- Runtime validation: on load, verify skill's declared tools exist in current tool registry
- Incompatibility reporting: clear error message with remediation steps
- Graceful degradation: incompatible skill is skipped with warning (not crash)

**Acceptance criteria**
- [ ] Version compatibility check on install and load
- [ ] Agent compatibility check at skill activation time
- [ ] Missing tool dependency reported clearly
- [ ] Incompatible skill skipped with warning, not crash
- [ ] Remediation steps included in warning message

**References**
- agentskills.io standard (compatibility metadata)
- SKILL.md frontmatter fields

---

### DC-MKT-006 — Skill-embedded MCP integration for marketplace skills

**Goal**: Ensure marketplace-installed skills that include embedded MCP servers work correctly with the MCP session manager.

**Scope**
- Marketplace skills can include `mcp/` directory with MCP server definitions
- On skill install: register MCP servers with session manager
- On skill uninstall: deregister MCP servers
- MCP server lifecycle tied to skill activation (not always running)
- Permission model: skill's MCP server has same permissions as the agent using the skill

**Acceptance criteria**
- [ ] Skill-embedded MCP servers discovered on install
- [ ] MCP servers registered with session manager
- [ ] MCP servers start when skill is activated by an agent
- [ ] MCP servers stop when skill is deactivated
- [ ] Uninstall cleanly removes MCP registration

**References**
- Survey feature 1.9 (skill-embedded MCP)
- MVP `epic-skills.md` DC-SKILL-005 (MCP integration)
