# ADR-006 — AgentConfig with 4 Fallback Types

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-agent-roster.md, analiza-router.md (Plandex ModelRoleConfig pattern) |

### Context

Agents need graceful degradation when their primary model fails or hits limits. Plandex's `ModelRoleConfig` pattern provides 4 distinct fallback scenarios.

### Decision

Each agent has a configuration with **4 fallback types**:

```typescript
interface AgentConfig {
  agent: AgentType;
  modelId: string;
  fallbacks: {
    largeContext?: AgentConfig;  // Context too large → model with bigger window
    largeOutput?: AgentConfig;  // Output too large → model with bigger output limit
    error?: AgentConfig;        // Provider error → fallback model
    strong?: AgentConfig;       // Escalation to stronger model
  };
  preferCheapModel?: boolean;   // true for summarizer, commit-writer, namer
}
```

### Consequences

- **Positive:** Graceful degradation without user intervention. Each failure mode has a targeted response (not just "try another model").
- **Negative:** Configuration complexity. Mitigated by Family Packs (ADR-005) that pre-configure all fallbacks.
- **Inspiration:** Plandex (ModelRoleConfig + Model Packs). License: MIT — full freedom.
