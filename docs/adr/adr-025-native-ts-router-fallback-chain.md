# ADR-025 — Native TS Router with Fallback Chain

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-router.md                             |

### Context

The model router must handle provider failures, rate limits, and context overflow gracefully. A native TypeScript module (not a microservice) provides the best integration with agents, hooks, and policy engine. Patterns from Plandex's retry/fallback system were analyzed.

### Decision

**Native TS module** (in-process, not microservice) based on **Vercel AI SDK** (`@ai-sdk/*`).

#### Error Classification (7 types)

| Error Kind | Example | Action |
|------------|---------|--------|
| `rate_limited` | 429 Too Many Requests | Retry with backoff |
| `context_overflow` | Input too large | Fallback to larger-context model |
| `overloaded` | 503 Service Unavailable | Retry with backoff |
| `quota_exhausted` | Monthly limit reached | Fallback to different provider |
| `auth_error` | 401/403 | Fail immediately, notify user |
| `not_found` | Model doesn't exist | Fail immediately, notify user |
| `other` | Unknown errors | Retry once, then fail |

#### Retry Strategy

- Primary model: retry up to `MAX_RETRIES` (default: 3) with exponential backoff.
- After primary exhausted: switch to fallback model, retry up to `MAX_RETRIES_AFTER_FALLBACK` (default: 2).
- Max retry delay: `MAX_RETRY_DELAY_MS` (default: 15000ms).

#### Streaming

- **Inactivity timeout:** `STREAM_INACTIVITY_TIMEOUT` (default: 60000ms). If no tokens received for 60s, abort and retry.
- Streaming via Vercel AI SDK's streaming primitives.

#### Configuration

- Fallback chain is **config-driven** per family (ADR-005).
- Each agent's `AgentConfig` (ADR-006) defines model + 4 fallback types.
- MVP mode: **failover-first** (try primary → fallback → fail).
- Future modes: race, consensus, load balancing (v2+).

#### Constants

| Constant | Default | Configurable |
|----------|---------|--------------|
| MAX_RETRIES | 3 | Yes |
| MAX_RETRIES_AFTER_FALLBACK | 2 | Yes |
| MAX_RETRY_DELAY_MS | 15000 | Yes |
| STREAM_INACTIVITY_TIMEOUT | 60000 | Yes |

### Consequences

- **Positive:** Full control over retry logic, error classification, and fallback chains. No external dependency (no LiteLLM). Direct integration with agent system.
- **Negative:** Must maintain provider adapters ourselves (mitigated by Vercel AI SDK doing most of the heavy lifting).
- **Inspiration:** Plandex (retry wrapper + fallback chain pattern). License: MIT.

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**wrap_model_call Pattern** (ADR-033)
The router/fallback chain can be expressed as composed `wrap_model_call` wrappers:
```typescript
const resilientModel = wrap_model_call([
  modelRetryWrapper,     // ADR-036 pattern applied to models
  modelFallbackWrapper,  // This ADR's fallback logic
  actualModelCall
]);
```

**Retry/Fallback Composition**
The four fallback types are implemented as wrappers: Round Robin, Priority, Cost-Optimized, Context-Aware.

**Model Retry vs Tool Retry**
- **Model retry** (`wrap_model_call`): Handles provider failures at LLM API level
- **Tool retry** (`wrap_tool_call` from ADR-033): Handles tool execution failures

These compose in the middleware pipeline.
