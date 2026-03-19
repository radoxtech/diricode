# ADR-035 — Tool Call Limit Pattern

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Draft                                         |
| Date        | 2026-03-18                                    |
| Scope       | MVP                                           |
| References  | ADR-003, ADR-033                              |

### Context

ADR-003 established guardrails for unlimited nesting, including a hard iteration limit of 50. This limit protects against runaway costs but applies globally across the session. We need finer-grained control that allows per-agent budgets while maintaining the session-wide safety net.

The ToolCallLimit pattern introduces two complementary limits: a session-wide ceiling and per-agent budgets. This enables complex multi-agent workflows where some agents need more tool calls than others, without risking overall session explosion.

### Decision

**Two-tier limit system** implemented via a `wrap_tool_call` wrapper:

| Limit | Scope | Default | Purpose |
|-------|-------|---------|---------|
| `thread_limit` | Session-wide | 50 | Hard ceiling, maps to ADR-003 iteration limit |
| `run_limit` | Per-agent | Tier-based | Per-agent budget before graceful stop |

#### Tier-Specific Defaults

Per-agent tool call budgets align with ADR-004 tier assignments:

| Tier | Default `run_limit` | Model Class | Typical Use |
|------|---------------------|-------------|-------------|
| LIGHT (LOW) | 20 | Cheapest available | Utility tasks, simple generation |
| MEDIUM | 50 | Mid-range | Standard tasks, quick operations |
| HEAVY | 100 | Best available | Complex reasoning, architecture |

#### Implementation

The `wrap_tool_call` wrapper intercepts every tool execution and maintains counters:

```typescript
interface ToolCallLimitConfig {
  // Session-wide hard limit (from ADR-003)
  thread_limit: number;
  
  // Per-agent budget
  run_limit: number;
  
  // Behavior when limit hit
  on_limit_hit: 'stop' | 'summarize' | 'escalate';
}

// Default configuration per tier
const TIER_DEFAULTS: Record<AgentTier, Partial<ToolCallLimitConfig>> = {
  LIGHT: { run_limit: 20 },
  MEDIUM: { run_limit: 50 },
  HEAVY: { run_limit: 100 }
};

// Per-tool overrides (optional)
interface ToolOverride {
  tool_name: string;
  run_limit?: number;
  thread_limit?: number;
}
```

#### Wrapper Function

```typescript
function wrap_tool_call<T extends (...args: any[]) => any>(
  fn: T,
  config: ToolCallLimitConfig,
  context: {
    agent_id: string;
    tier: AgentTier;
    thread_counter: SharedCounter;
    run_counter: AgentCounter;
  }
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Check thread limit first (session-wide)
    if (context.thread_counter.value >= config.thread_limit) {
      throw new ToolCallLimitError({
        limit_type: 'thread_limit',
        limit: config.thread_limit,
        message: `Session thread_limit (${config.thread_limit}) exceeded`
      });
    }
    
    // Check per-agent run limit
    if (context.run_counter.value >= config.run_limit) {
      // Graceful stop: return summary instead of throwing
      if (config.on_limit_hit === 'summarize') {
        return {
          status: 'limit_reached',
          summary: `Agent ${context.agent_id} reached run_limit (${config.run_limit})`,
          partial_results: context.run_counter.getHistory()
        } as ReturnType<T>;
      }
      
      throw new ToolCallLimitError({
        limit_type: 'run_limit',
        limit: config.run_limit,
        agent_id: context.agent_id,
        message: `Agent run_limit (${config.run_limit}) exceeded`
      });
    }
    
    // Execute and increment counters
    context.thread_counter.increment();
    context.run_counter.increment();
    
    return fn(...args);
  }) as T;
}
```

#### Configuration Hierarchy

Tool call limits resolve in this order (first match wins):

1. **Per-tool override** (agent config)
2. **Agent-level `run_limit`** (agent definition)
3. **Tier default** (from ADR-004 assignment)
4. **Global default** (thread_limit: 50)

Example agent configuration:

```yaml
# agents/code-writer.yaml
agent:
  name: code-writer
  tier: HEAVY
  tool_call_limits:
    run_limit: 100           # Override tier default
    thread_limit: 50         # Same as global (explicit)
    on_limit_hit: summarize  # Graceful stop with summary
    
  # Per-tool overrides
  tool_overrides:
    - tool_name: file_write
      run_limit: 150         # More calls for file operations
    - tool_name: bash_execute
      run_limit: 50          # Stricter for shell commands
```

### Consequences

- **Positive:** Fine-grained cost control per agent tier. HEAVY agents get larger budgets while LIGHT agents stay constrained. Session remains protected by thread_limit.
- **Positive:** Graceful degradation. When run_limit hits, agents return summaries rather than crashing, enabling workflow continuation.
- **Negative:** Additional configuration surface. Each agent needs explicit tier assignment for defaults to apply.
- **Trade-off:** thread_limit and run_limit may conflict. If thread_limit is 50 but a HEAVY agent has run_limit: 100, the thread_limit wins. This is intentional: session safety overrides individual agent budgets.

### Details

#### Limit Behavior Matrix

| Scenario | thread_limit | run_limit | Outcome |
|----------|--------------|-----------|---------|
| Neither hit | < 50 | < tier default | Normal execution |
| run_limit only | < 50 | >= limit | Graceful stop (summary) |
| thread_limit only | >= 50 | < limit | Hard error (session stop) |
| Both hit | >= 50 | >= limit | Hard error (thread_limit priority) |

#### Migration from ADR-003

Existing iteration limit configurations map directly:

```typescript
// Before (ADR-003)
const config = {
  hard_iteration_limit: 50
};

// After (ADR-035)
const config = {
  thread_limit: 50,  // Maps from hard_iteration_limit
  run_limit: 50      // New per-agent default
};
```

The `hard_iteration_limit` field is deprecated but maintained for backward compatibility. It maps to `thread_limit` internally.

#### Counter Implementation

Counters must be:
- **Thread-safe**: Multiple agents may increment simultaneously
- **Persistent**: Survive agent restarts within a session
- **Observable**: Emit events for monitoring (ADR-031)

```typescript
interface Counter {
  value: number;
  increment(): void;
  getHistory(): ToolCallRecord[];
}

interface ToolCallRecord {
  timestamp: string;
  agent_id: string;
  tool_name: string;
  args_hash: string;
}
```
