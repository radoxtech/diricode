# ADR-036 — Tool Retry with Exponential Backoff

| Field       | Value                                                     |
|-------------|-----------------------------------------------------------|
| Status      | Draft                                                     |
| Date        | 2026-03-18                                                |
| Scope       | MVP                                                       |
| References  | ADR-003, ADR-033, ADR-035                                 |

### Context

Tool calls can fail for transient reasons: rate limits, network timeouts, temporary service unavailability. Without retry logic, agents would fail tasks that could succeed with a simple delay. However, retries must be bounded and intelligent to avoid amplifying load on struggling services.

This decision complements ADR-003 (Loop Detector). The distinction:

| Mechanism | Purpose | Triggers On |
|-----------|---------|-------------|
| **Loop Detector** (ADR-003) | Prevent infinite loops | Repeated errors with same pattern |
| **Tool Retry** (this ADR) | Handle transient failures | Rate limits, timeouts, 5xx errors |

### Decision

**Implement retry with exponential backoff for transient tool failures.**

#### Retry Formula

```
delay = min(initial * factor^attempt, max_delay) ± jitter
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `initial` | 1s | Base delay for first retry |
| `factor` | 2 | Exponential growth multiplier |
| `max_delay` | 30s | Ceiling on delay between retries |
| `jitter` | 25% | Random variation (±25% of calculated delay) |
| `max_retries` | 3 | Maximum retry attempts per tool call |

**Example retry sequence with defaults:**

| Attempt | Base Delay | With Jitter (±25%) |
|---------|------------|---------------------|
| 1 | 1s | 0.75s - 1.25s |
| 2 | 2s | 1.5s - 2.5s |
| 3 | 4s | 3s - 5s |
| 4+ | 8s → capped at 30s | 22.5s - 37.5s → capped |

#### Retry Classification

Not all errors warrant retry. Use `retry_on` filter:

| Error Category | Retry? | Rationale |
|----------------|--------|-----------|
| `rate_limited` (429) | Yes | Rate limits are transient |
| `timeout` (408, 504) | Yes | Network issues are transient |
| `overloaded` (503) | Yes | Service recovering |
| `connection_error` | Yes | Network instability |
| `auth_error` (401, 403) | No | Auth issues require intervention |
| `not_found` (404) | No | Resource missing permanently |
| `validation_error` (400) | No | Input invalid, retry won't help |

#### Implementation Interface

```typescript
interface ToolRetryConfig {
  initial_delay_ms: number;      // Default: 1000
  backoff_factor: number;        // Default: 2
  max_delay_ms: number;          // Default: 30000
  jitter_percent: number;        // Default: 0.25 (25%)
  max_retries: number;           // Default: 3
  retry_on: (error: ToolError) => boolean;  // Filter function
}

function calculateBackoff(
  attempt: number,
  config: ToolRetryConfig
): number {
  const base = config.initial_delay_ms * Math.pow(config.backoff_factor, attempt);
  const capped = Math.min(base, config.max_delay_ms);
  const jitter = (Math.random() - 0.5) * 2 * config.jitter_percent * capped;
  return Math.max(0, capped + jitter);
}
```

#### Composition with ToolCallLimit (ADR-035)

**Each retry counts against the tool call limit.** If `ToolCallLimit = 10` and a tool retries 3 times before succeeding, that consumes 4 calls from the budget.

This prevents retry storms from exhausting agent resources:

```typescript
// Tool call budget tracking
const budget = new ToolCallLimit({ thread_limit: 10, run_limit: 50 });

async function invokeWithRetry(tool, args) {
  for (let attempt = 0; attempt <= max_retries; attempt++) {
    budget.consume(1);  // Each attempt counts
    
    try {
      return await tool.invoke(args);
    } catch (error) {
      if (attempt === max_retries || !config.retry_on(error)) {
        throw error;
      }
      const delay = calculateBackoff(attempt, config);
      await sleep(delay);
    }
  }
}
```

#### Global vs Per-Tool Configuration

| Level | Use Case |
|-------|----------|
| **Global default** | Applied to all tools unless overridden |
| **Per-tool override** | Tools with known rate limits (e.g., search APIs) |
| **Per-call override** | Emergency retries with extended timeouts |

### Consequences

**Positive:**
- Resilience against transient failures without manual intervention.
- Exponential backoff prevents thundering herd problems.
- Jitter distributes retry timing across agents.
- Clear separation from loop detection (transient vs structural failures).

**Negative / Trade-offs:**
- Adds latency to failing operations (delay adds up to ~60s with defaults).
- Requires careful budget accounting when composed with ToolCallLimit.
- Jitter makes timing non-deterministic (harder to reproduce issues).

**Migration notes:**
- Not applicable (new feature).

### Details

#### Default Configuration

```yaml
# agents.yaml
tool_retry:
  initial_delay_ms: 1000
  backoff_factor: 2
  max_delay_ms: 30000
  jitter_percent: 0.25
  max_retries: 3
  retry_on:
    - rate_limited
    - timeout
    - overloaded
    - connection_error
```

#### Per-Tool Override Example

```yaml
# agents.yaml - override for search tool with strict rate limits
tools:
  web_search:
    retry:
      initial_delay_ms: 2000      # Start slower
      max_retries: 5              # Try harder
      max_delay_ms: 60000         # Wait longer between retries
```

#### Interaction with Model Retry (ADR-025)

| Layer | Retries | Handles |
|-------|---------|---------|
| **Model Router** (ADR-025) | 3 retries with 15s max | Provider errors, rate limits |
| **Tool Retry** (this ADR) | 3 retries with 30s max | Tool execution failures |

These operate independently: a model call might retry, then invoke a tool that itself retries.
