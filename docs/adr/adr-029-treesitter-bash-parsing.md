# ADR-029 — Tree-sitter Bash Parsing for Safety

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

Agents generate and execute bash commands. Regex-based command parsing is unreliable (bash syntax is complex). Tree-sitter provides a proper AST parser for bash, enabling accurate safety analysis.

### Decision

**Parse bash commands through tree-sitter** before execution.

Use cases:
- Detect destructive commands (`rm -rf`, `dd`, `mkfs`).
- Identify piped commands and their risk.
- Validate command structure before execution.
- Feed into approval system (ADR-014) with accurate risk classification.

### Consequences

- **Positive:** Reliable command analysis. No regex edge cases. Accurate risk classification for approval system.
- **Negative:** Tree-sitter bash grammar must be maintained. Parsing adds minimal latency (<1ms per command).
