# ADR-033 — Interceptor/Wrapper Hook Split

| Field       | Value                        |
|-------------|------------------------------|
| Status      | Draft                        |
| Date        | 2026-03-18                   |
| Scope       | MVP                          |
| References  | ADR-024                      |

### Context

ADR-024 established a hook framework with 20 hook types across the agent lifecycle. These hooks serve different architectural purposes: some observe and modify state, others control execution flow. Using a single pattern for all hooks creates unnecessary complexity and limits what hook authors can accomplish.

We need two distinct patterns:

- **Interceptors** for sequential state observation and modification
- **Wrappers** for nested execution control (retry, short-circuit, transform)

This split aligns with established patterns in web frameworks (Express middleware vs higher-order functions) and provides clear mental models for hook authors.

### Decision

**Two hook patterns: Interceptors and Wrappers.**

#### Interceptors

Interceptors follow a sequential, node-style execution model. They run before or after an operation and can observe or modify state, but cannot control the execution flow of the operation itself.

Characteristics:

- Execute sequentially in declaration order
- Can read and modify context/state
- Cannot retry, abort, or transform the operation
- Silent fail: interceptor errors do not stop the operation

TypeScript interfaces:

```typescript
interface BeforeModelCallInterceptor {
  (context: ModelContext): Promise<ModelContext> | ModelContext;
}

interface AfterModelCallInterceptor {
  (context: ModelContext, result: ModelResult): Promise<ModelResult> | ModelResult;
}

interface BeforeToolCallInterceptor {
  (context: ToolContext): Promise<ToolContext> | ToolContext;
}

interface AfterToolCallInterceptor {
  (context: ToolContext, result: ToolResult): Promise<ToolResult> | ToolResult;
}
```

#### Wrappers

Wrappers follow a nested, onion-style execution model. They wrap an operation completely and can retry, short-circuit, or transform both input and output.

Characteristics:

- Execute nested (outer wraps inner)
- Can read, modify, and transform input/output
- Can retry the wrapped operation
- Can short-circuit (return without calling the wrapped operation)
- Responsible for calling the next/inner function

TypeScript interfaces:

```typescript
interface WrapModelCall {
  (context: ModelContext, next: () => Promise<ModelResult>): Promise<ModelResult>;
}

interface WrapToolCall {
  (context: ToolContext, next: () => Promise<ToolResult>): Promise<ToolResult>;
}
```

### Mapping ADR-024 Hooks to Interceptor/Wrapper Categories

| Hook | Category | Rationale |
|------|----------|-----------|
| `session-start` | Interceptor (before_model_call) | Initialize state, no control flow needed |
| `pre-commit` | Wrapper (wrap_tool_call) | Can block commit, transform message |
| `post-commit` | Interceptor (after_tool_call) | Notify, update issues, pure side effects |
| `error-retry` | Wrapper (wrap_model_call) | Core purpose is retry logic |
| `plan-created` | Interceptor (after_model_call) | Review plan, no execution control |
| `plan-validated` | Wrapper (wrap_model_call) | Can reject/approve, transform plan |
| `pre-tool-use` | Wrapper (wrap_tool_call) | Can block, transform, or retry tool |
| `post-tool-use` | Interceptor (after_tool_call) | Log, observe, no control flow |
| `context-monitor` | Interceptor (before_model_call) | Check thresholds, pure observation |
| `preemptive-compaction` | Wrapper (wrap_model_call) | Can trigger compaction, modify context |
| `rules-injection` | Interceptor (before_model_call) | Inject rules, state modification |
| `file-guard` | Wrapper (wrap_tool_call) | Can block file modifications |
| `loop-detection` | Wrapper (wrap_model_call) | Can intervene in execution |
| `session-end` | Interceptor (after_model_call) | Cleanup, pure side effects |
| `task-completed` | Interceptor (after_model_call) | Report, observe, no control |
| `worktree-create` | Interceptor (after_tool_call) | Post-creation setup |
| `worktree-remove` | Interceptor (after_tool_call) | Post-removal cleanup |
| `config-change` | Interceptor (after_model_call) | React to changes, no control |
| `user-prompt-submit` | Wrapper (wrap_model_call) | Can transform, block, or enrich prompt |
| `subagent-stop` | Interceptor (after_model_call) | Cleanup, report, no control |

### Execution Behavior

#### Interceptor Execution (Sequential)

```
Before Interceptor 1 -> Before Interceptor 2 -> OPERATION -> After Interceptor 2 -> After Interceptor 1
```

- Each interceptor receives the output of the previous
- Order matters: first registered runs first
- Errors logged silently, operation continues

#### Wrapper Execution (Nested/Onion)

```
Wrapper 1 starts
  Wrapper 2 starts
    OPERATION
  Wrapper 2 ends
Wrapper 1 ends
```

- Outer wrapper controls inner wrapper
- Can catch, retry, transform, or short-circuit
- Must explicitly call `next()` to continue

### Consequences

- **Positive:** Clear mental models for hook authors. Interceptors for observation, wrappers for control. Extends ADR-024 with implementation guidance without changing the hook list.
- **Negative / Trade-offs:** Two patterns to learn instead of one. Some hooks could reasonably fit either category (decision documented above).
- **Migration notes:** Existing hook implementations may need refactoring to fit the appropriate pattern. ADR-024 hook types remain valid, this ADR adds the execution model layer.

### Details

#### Hook Registration Example

```typescript
// Interceptor registration (sequential)
registry.registerInterceptor('before_model_call', async (ctx) => {
  ctx.metadata.startTime = Date.now();
  return ctx;
});

// Wrapper registration (nested)
registry.registerWrapper('wrap_model_call', async (ctx, next) => {
  try {
    return await next();
  } catch (error) {
    if (isRetryable(error)) {
      return await next(); // retry once
    }
    throw error;
  }
});
```

#### Safety Rules

Both patterns inherit from ADR-024:

| Rule | Interceptor | Wrapper |
|------|-------------|---------|
| Silent fail | Yes | Yes |
| Timeout | 3s | 3s |
| Error handling | Log, continue | Log, continue |
| DAG resolution | N/A (sequential) | N/A (explicit nesting) |
