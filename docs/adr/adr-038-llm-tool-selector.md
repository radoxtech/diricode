# ADR-038 — LLM Tool Selector (Tool Pre-filtering)

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Draft                                         |
| Date        | 2026-03-18                                    |
| Scope       | v2                                            |
| References  | ADR-002, ADR-007, ADR-033                     |

### Context

ADR-002 defines a dispatcher-first architecture with 40+ specialized agents. ADR-007 establishes the hybrid agent definition model where agents expose tools through the agentskills.io format. At this scale, every model call includes 40+ tool definitions in the prompt.

This creates three problems:

1. **Token bloat**: Each tool definition adds hundreds of tokens. 40 tools can consume 10,000+ tokens before any user input.
2. **Context pressure**: Large tool sets eat into the context window, leaving less room for actual work.
3. **Noise**: Models perform worse when forced to choose from irrelevant options. A frontend agent does not need database migration tools.

The solution is tool pre-filtering: use a cheaper model to select the relevant subset of tools before invoking the primary (more expensive) model.

### Decision

**Implement LLMToolSelector as a `wrap_model_call` wrapper.**

Before each model invocation, a lightweight selector model analyzes the conversation context and user intent. It returns a ranked list of relevant tool IDs. The wrapper then passes only those tools (plus mandatory ones) to the primary model.

#### Architecture

The selector integrates via the wrapper pattern from ADR-033:

```typescript
interface LLMToolSelectorConfig {
  selector_model?: string;        // Model for selection (default: cheap from router)
  max_tools: number;              // Max tools to pass to primary model
  always_include: string[];       // Tool IDs always included (e.g., "ask_user")
  fallback_on_error: boolean;     // Pass all tools if selector fails
  min_relevance_score?: number;   // Optional threshold for selection
}

interface ToolSelectorResult {
  selected_tools: string[];       // Tool IDs to include
  confidence: number;             // Selector confidence score
  reasoning?: string;             // Optional explanation
}
```

#### Execution Flow

```
User Request
    |
    v
wrap_model_call (LLMToolSelector)
    |
    |-- 1. Call selector_model with context + all tool names/descriptions
    |      (no full tool schemas, just metadata)
    |
    |-- 2. Selector returns top-N relevant tool IDs
    |
    |-- 3. Merge with always_include list
    |
    |-- 4. Call primary model with filtered tool set
    |
    v
Primary Model Response
```

#### Cost Analysis

| Scenario | Without Selector | With Selector | Savings |
|----------|-----------------|---------------|---------|
| 40 tools, 1 call | 10K tokens + expensive model | 500 tokens (cheap) + 2K tokens (expensive) | ~70% |
| 40 tools, 5 calls | 50K tokens + expensive model | 500 tokens (cheap) + 10K tokens (expensive) | ~75% |
| Selector error (fallback) | N/A | 500 tokens (cheap) + 10K tokens (expensive) | 0% |

The selector uses minimal context (tool names + descriptions, not full schemas). The expensive model receives only relevant tools, reducing both input tokens and cognitive load.

#### Configuration

Tool selector configuration attaches to agent config (per ADR-006):

```typescript
interface AgentConfig {
  agent: AgentType;
  modelId: string;
  tool_selector?: LLMToolSelectorConfig;
  fallbacks: { /* ... */ };
}
```

Example configurations:

```yaml
# High-traffic dispatcher agent
agents:
  dispatcher:
    modelId: gpt-5.4
    tool_selector:
      max_tools: 10
      always_include: ["delegate_task", "ask_user", "escalate"]
      fallback_on_error: true

# Specialized agent with few tools (no selector needed)
agents:
  commit_writer:
    modelId: haiku-4.5
    # No tool_selector: passes all 3 tools directly
```

#### Error Handling

If the selector fails (timeout, parse error, invalid output), the wrapper follows the `fallback_on_error` policy:

- **true** (default): Pass all tools to the primary model. Slightly more expensive but safe.
- **false**: Fail fast with error. Use when tool selection is critical for safety.

#### Selection Prompt

The selector uses a structured prompt (not exposed to user):

```
You are a tool selector. Given the conversation context, select the most
relevant tools for the next action.

Available tools:
- search_code: Search codebase for patterns
- read_file: Read file contents
- edit_file: Modify file contents
- run_tests: Execute test suite
- deploy_service: Deploy to production
...

Conversation context:
[truncated to fit cheap model context window]

Respond with JSON:
{
  "selected_tools": ["tool_id_1", "tool_id_2", ...],
  "confidence": 0.85,
  "reasoning": "User asked to fix a bug, so search and read tools are relevant"
}
```

### Consequences

- **Positive:**
  - Significant cost reduction for dispatcher and multi-tool agents (60-80% token savings).
  - Improved model accuracy by reducing choice overload.
  - Scales to 100+ tools without linear token growth.
  - Graceful degradation: fallback preserves correctness.

- **Negative / Trade-offs:**
  - Additional latency: one cheap model call before each primary call.
  - Configuration complexity: tuning `max_tools` and `always_include` per agent.
  - Selector errors risk missing critical tools (mitigated by `always_include` and fallback).
  - Extra infrastructure: monitoring selector accuracy, caching popular selections.

- **Migration notes:**
  - Agents with fewer than 10 tools should not use the selector (overhead exceeds savings).
  - Start with dispatcher agent only, expand based on metrics.
  - Monitor selector confidence scores; low scores indicate need for tuning.

### Details

#### Integration with Agent Config System (ADR-006)

The tool selector configuration extends the existing `AgentConfig` interface. It respects the same fallback chain: if `selector_model` fails, the agent's `fallbacks.error` model can be used for selection.

#### Integration with Wrapper Pattern (ADR-033)

`LLMToolSelector` implements `WrapModelCall`:

```typescript
const toolSelectorWrapper: WrapModelCall = async (context, next) => {
  const config = context.agentConfig.tool_selector;
  if (!config || context.availableTools.length <= config.max_tools) {
    return next(); // Skip if disabled or few tools
  }

  try {
    const selected = await selectTools(context, config);
    context.filteredTools = selected;
    return next();
  } catch (error) {
    if (config.fallback_on_error) {
      return next(); // Pass all tools
    }
    throw error;
  }
};
```

#### Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Selector latency | < 200ms | > 500ms |
| Selector accuracy | > 90% | < 85% |
| Token savings | > 60% | < 40% |
| Fallback rate | < 5% | > 10% |

Selector accuracy = (tools actually used by primary model) / (tools selected by selector).

#### Future Extensions (v2+)

1. **Semantic caching**: Cache selector results for similar queries.
2. **Tool embeddings**: Use vector similarity instead of LLM call for static tool sets.
3. **Hierarchical selection**: Two-level selector (family -> tool) for 100+ tools.
4. **Dynamic always_include**: Inject tools based on conversation state, not just static config.
