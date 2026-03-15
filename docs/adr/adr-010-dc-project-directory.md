# ADR-010 — `.dc/` Project Directory

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-config-layers.md (DECYZJA-2)          |

### Context

The project needs a local directory for configuration, skills, and project-specific data. The name should be short, recognizable, and not conflict with existing tooling conventions.

### Decision

**`.dc/`** as the project-level directory (not `.diricode/`).

Structure:
```
.dc/
├── config.jsonc          # Project config
├── skills/               # Workspace skills
├── skills-defaults/      # Family default skills
└── rules/                # Project rules (v2)
```

Global directory: `~/.config/dc/` (XDG-compliant).

### Consequences

- **Positive:** Short, easy to type. Follows 2-letter convention (like `.vscode/`, `.nx/`). Won't conflict with any known tool.
- **Negative:** Less immediately recognizable than `.diricode/`. Acceptable trade-off for brevity.
- **Migration:** All references to `.diricode/` in existing documents must be updated to `.dc/`.
