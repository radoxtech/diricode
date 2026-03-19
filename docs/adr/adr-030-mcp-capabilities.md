# ADR-030 — MCP Capabilities in MVP

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-narzedzi-ekosystem.md                 |

### Context

Model Context Protocol (MCP) provides a standard interface for AI tools. DiriCode implements MCP capabilities for interoperability with the broader AI tooling ecosystem.

### Decision

**MVP MCP capabilities:**

| Capability | Description |
|------------|-------------|
| 3-layer workflow | `search → timeline → details` pattern for efficient context retrieval |
| Smart code tools | Tree-sitter-based code analysis tools |
| Parent heartbeat | Detection of orphaned processes |
| Session export/restore | Serialize and resume sessions |
| Graceful shutdown | Clean termination of running agents and tools |

### Consequences

- **Positive:** Standard protocol. Interoperable with other MCP-compatible tools. Skill-embedded MCP (ADR-008) enables skills to define custom tools.
- **Negative:** MCP standard is still evolving. May need updates as the protocol matures.

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**MCP Tool Wrapping** (ADR-033)
MCP tools (from external servers) pass through the same `wrap_tool_call` middleware pipeline as native tools. This ensures consistent:
- **Safety** (ADR-027 git safety)
- **Approval** (ADR-014 smart hybrid approval)
- **Retry** (ADR-036 exponential backoff)
- **Limits** (ADR-035 call limits)

No special treatment needed — MCP tools are first-class citizens in the middleware stack.

**MCP as Wrapped Tool Source**
When MCP capabilities are discovered, the tools are automatically registered with the middleware pipeline.

**Consistency Guarantee**
Whether a tool is native (TypeScript) or external (MCP), it receives identical middleware treatment.
