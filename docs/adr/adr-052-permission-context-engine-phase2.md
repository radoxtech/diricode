## ADR-052 — Permission Context Engine: Phase 2 (Smart)

| Field       | Value                                                                 |
|-------------|-----------------------------------------------------------------------|
| Status      | Accepted                                                              |
| Date        | 2026-03-31                                                            |
| Scope       | v2                                                                    |
| References  | ADR-051 (Phase 1), ADR-045 (ReasoningBank), DC-TOOL-010 (AST-grep) |

### Context

Phase 1 (ADR-051) delivers the structural foundation for context-aware permissions. Phase 2 adds intelligence: learning from user decisions, providing management UI, enabling semantic risk analysis, and supporting prefix-level blocking.

This is deliberately scoped to v2 because it depends on:
- Phase 1 being stable and observed in real usage
- ReasoningBank (ADR-045) for pattern learning storage
- AST-grep (DC-TOOL-010) for semantic code analysis

### Decision

**Phase 2 extends the Permission Context Engine with four smart capabilities:**

**1. Prefix-Level and Pattern Blocking**

Block entire categories of tools or operation patterns:

```typescript
BlockList {
  exactNames: ["bash", "rm-rf-wrapper"]
  prefixes:   ["git-push", "docker-deploy-prod"]
  patterns:   ["**/secret*", "*.key", "*.pem"]
}
```

Configurable per-user and per-project. Stored in `.dc/` config.

**2. Permission Management Command**

User-facing `/permissions` command:
```
/permissions list          — Show current permission levels
/permissions block <tool>  — Block a tool
/permissions allow <tool>  — Allow a tool
/permissions audit         — Show decision log
/permissions reset         — Reset to defaults
```

**3. Cross-Session Learning**

Detect patterns in user permission decisions and offer auto-suggestions:
- "You've approved 'refactor imports' 5 times — auto-approve future occurrences?"
- Confidence scoring and decay (stale patterns lose weight)
- Leverages ReasoningBank storage infrastructure

**4. Semantic Risk Analysis**

Integrate with AST-grep (DC-TOOL-010) to compute risk scores before permission prompts:

```typescript
RiskScore {
  score:         0-100
  changeSize:    "small" | "medium" | "large"
  affectedFiles: number
  isTestFile:    boolean
  isConfigFile:  boolean
}
```

Risk-adjusted prompts: high-risk changes always prompt, low-risk changes can auto-approve.

### Consequences

**Positive:**
- User decisions improve the system over time.
- Semantic analysis reduces false positives (fewer unnecessary prompts).
- Management UI gives users control and transparency.
- Prefix blocking enables project-level safety policies.

**Negative:**
- Cross-session learning requires calibration; bad patterns can cause under-prompting.
- Semantic analysis adds latency before permission decisions.
- Complexity compounds Phase 1 — requires stable Phase 1 foundation.

### Comparison with Claude Code

| Feature | Claude Code | DiriCode Phase 1 | DiriCode Phase 2 |
|---------|------------|-----------------|-----------------|
| Multi-context handlers | ✅ | ✅ | ✅ |
| Granular levels | ✅ | ✅ | ✅ |
| Audit logging | ✅ | ✅ | ✅ (enhanced) |
| Prefix blocking | ✅ | ❌ | ✅ |
| Permission UI | ✅ | ❌ | ✅ |
| Cross-session learning | ✅ | ❌ | ✅ |
| Semantic analysis | ✅ | ❌ | ✅ |

Phase 2 reaches parity with Claude Code and exceeds it in learning sophistication.

### Delivery

- **Scope**: v2
- **Issues**: DC-SAFE-006d (Prefix Blocking), DC-SAFE-006e (Permission UI), DC-SAFE-006f (Cross-Session Learning), DC-SAFE-006g (Semantic Analysis)
- **Phase 1**: See ADR-051
