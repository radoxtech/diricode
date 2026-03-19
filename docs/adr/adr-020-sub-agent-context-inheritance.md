# ADR-020 — Sub-Agent Context Inheritance (toModelOutput)

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-context-management.md                 |

### Context

Sub-agents need context from their parent session, but passing the full conversation history would exceed context limits (especially for Copilot <200k). Vercel AI SDK's `toModelOutput` provides an efficient serialization mechanism.

### Decision

**3 inheritance modes** for sub-agent context:

| Mode | Context Passed | Use Case | Token Cost |
|------|----------------|----------|------------|
| Isolated | Task description + relevant files only | Independent tasks | ~1-2k |
| Summary | `toModelOutput()` from parent session | Continuation of parent work | ~1k (vs 100k full) |
| Full | Complete parent history | Debugging / review only | Up to model limit |

Default mode: **Summary** (best balance of context and cost).

### Consequences

- **Positive:** 100x token savings vs Full mode. Sub-agents get enough context to work effectively without the full conversation.
- **Negative:** Summary mode loses some nuance from parent session. Acceptable for most tasks.
- **Inspiration:** Vercel AI SDK (toModelOutput), OpenCode (session_compact).

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**Async Context Handoff** (ADR-039)
Async subagents receive context at `start_job` time — they cannot access parent conversation mid-flight. For this reason, **Isolated mode** is preferred for async agents: they receive task description + relevant files only.

**Input/Output Customization**
The dispatcher can customize what context each sub-agent receives (input transform) and how results are incorporated back (output transform). This extends the three inheritance modes with fine-grained control.

**Result Integration**
When an async agent completes, `get_result(job_id)` returns the result. The parent decides integration depth: Full, Summary (uses ADR-017 condenser), or Structured.
