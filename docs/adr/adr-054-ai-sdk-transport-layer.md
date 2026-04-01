# ADR-054 — Vercel AI SDK as Transport Layer

| Field       | Value                                                                                          |
|-------------|------------------------------------------------------------------------------------------------|
| Status      | Accepted                                                                                       |
| Date        | 2026-04-01                                                                                     |
| Scope       | MVP-1 (transport migration), MVP-2 (LLM Picker integration)                                   |
| References  | ADR-025, ADR-042, ADR-049, Vercel AI SDK v4                                                    |

### Context

DiriCode's provider layer (`@diricode/providers`) currently defines a custom `Provider` interface (`isAvailable`, `generate`, `stream`) and custom per-provider adapters (GeminiProvider, KimiProvider, etc.). Alongside this, the LLM Picker (ADR-049) requires a separate metadata layer — `ModelDescriptor`, `ModelQuota`, `ProviderAdapter` — for intelligent model selection.

Maintaining custom transport adapters is redundant work. The **Vercel AI SDK** (`ai`, `@ai-sdk/*`) already provides:

1. **Unified `LanguageModelV4` interface** with `doGenerate()` and `doStream()` methods — identical to our `Provider.generate()` / `Provider.stream()`.
2. **Official provider packages** for all DiriCode-supported providers:
   - `@ai-sdk/github` — GitHub Copilot / GitHub Models
   - `@ai-sdk/google` — Google Gemini
   - `@ai-sdk/moonshotai` — Kimi (Moonshot AI)
   - `@ai-sdk/alibaba` — Qwen / Alibaba
   - `vercel-minimax-ai-provider` — MiniMax (community, MiniMax-maintained)
   - Community providers for z.ai / Zhipu
3. **`createProviderRegistry()`** — a built-in registry for aggregating multiple providers under a single lookup, replacing our custom `Registry`.
4. **Rich post-call metadata** — `usage.inputTokens`, `usage.outputTokens.reasoning`, `response.headers` (for rate limit extraction), `finishReason`.

However, AI SDK's `LanguageModelV4` interface has **zero model metadata**:

```typescript
type LanguageModelV4 = {
  readonly specificationVersion: 'v4';
  readonly provider: string;        // e.g. "google.generative-ai"
  readonly modelId: string;         // e.g. "gemini-2.5-flash"
  supportedUrls: Record<string, RegExp[]>;
  doGenerate(options): PromiseLike<...>;
  doStream(options): PromiseLike<...>;
}
```

No `contextWindow`, no `maxOutput`, no capability flags (`canReason`, `toolCall`, `vision`), no pricing data. Some providers have internal capability detection (e.g., OpenAI's private `getOpenAILanguageModelCapabilities()`) but none expose it on the interface.

**Community research confirms the gap is universal.** Projects using AI SDK maintain separate model metadata through:

- **Static bundles**: `llm-info` (npm), `@continuedev/llm-info` (Continue IDE) — hardcoded model cards
- **Community catalogs**: `models.dev` (3,100+ stars, used by LangChain and Mastra) — TOML-based model registry
- **Live APIs**: `pricetoken` (Bayesian-scored pricing), Vercel AI Gateway (`/v1/models` endpoint)
- **In-app registries**: Every serious AI SDK project maintains its own model card layer

This confirms that DiriCode's `ModelDescriptor` / `ModelQuota` / `ProviderAdapter` layer is not only valid but industry-standard practice.

### Decision

Adopt **Vercel AI SDK as the transport layer** for all LLM communication, while preserving DiriCode's **Model Card layer** (`ModelDescriptor`, `ModelQuota`, `ProviderAdapter`) as the metadata/decision layer for the LLM Picker.

#### 1. Two Parallel Registries

```
Model Card Registry (ours)          →  "should I pick this model?" (routing decision)
AI SDK Provider Registry            →  "can I call this model?" (transport execution)
```

- **Model Card Registry** (`ProviderAdapter.listModels()` → `ModelDescriptor[]`) provides context window, capabilities, pricing tier, and quota data for the LLM Picker's scoring engine.
- **AI SDK Provider Registry** (`createProviderRegistry()`) provides callable `LanguageModelV4` instances for actual LLM communication.

Both registries are keyed by `(providerId, modelId)` — they are two views of the same model.

#### 2. Transport Layer Migration

Replace the custom `Provider` interface with AI SDK:

| Before (Custom)                         | After (AI SDK)                              |
|-----------------------------------------|---------------------------------------------|
| `Provider.generate(options)`            | `generateText({ model, ... })`              |
| `Provider.stream(options)`              | `streamText({ model, ... })`                |
| `Provider.isAvailable()`               | Provider constructor (throws on bad auth)   |
| `Registry.register(provider)`           | `createProviderRegistry({ ... })`           |
| `Registry.get(name)`                    | `registry.languageModel("provider:model")`  |
| `GeminiProvider` (custom)               | `@ai-sdk/google` (official)                 |
| `KimiProvider` (custom)                 | `@ai-sdk/moonshotai` (official)             |
| `CopilotProvider` (custom via ai-sdk)   | `@ai-sdk/github` (already used internally)  |

#### 3. Model Cards Remain Bundled (No SQLite)

Model card data (`ModelDescriptor`) must be **statically bundled** with the application — as TypeScript constants or JSON files, one entry per `(provider, modelId)`. This ensures:

- Model metadata is available **without runtime database access**
- Cards ship as part of the application bundle
- Updates require code changes (intentional — model metadata changes are breaking decisions, not runtime data)

```typescript
// Example: packages/providers/src/model-cards/google.ts
export const googleModelCards: ModelDescriptor[] = [
  {
    apiModel: "gemini-2.5-flash",
    contextWindow: 1048576,
    maxOutput: 8192,
    canReason: true,
    toolCall: true,
    vision: true,
    attachment: true,
    quotaMultiplier: 1,
  },
  // ...
];
```

#### 4. Post-Call Data Extraction

AI SDK's `generateText` / `streamText` return rich metadata that feeds back into the LLM Picker:

- `usage.inputTokens.total` / `.cacheRead` / `.cacheWrite` — for cost tracking
- `usage.outputTokens.total` / `.reasoning` — reasoning token separation for pricing
- `response.headers` — extract `x-ratelimit-remaining-*` for reactive quota updates in `ModelQuota`
- `finishReason` — success/failure detection for feedback loop

#### 5. Error Classification Preserved

The custom error classifier (ADR-025, DC-PROV-003) remains as middleware around AI SDK calls. AI SDK throws provider-specific errors; our classifier normalizes them to the 7-kind `ProviderErrorKind` enum. This is consistent with the existing architecture — the classifier was already designed to wrap raw errors.

#### 6. What Gets Deleted

- `packages/providers/src/providers/gemini.ts` — replaced by `@ai-sdk/google`
- `packages/providers/src/providers/kimi.ts` — replaced by `@ai-sdk/moonshotai`
- Custom `Provider` interface (`isAvailable`, `generate`, `stream`) — replaced by `LanguageModelV4`
- Custom `Registry` class — replaced by `createProviderRegistry()`

#### 7. What Gets Kept

- `ModelDescriptor` — model metadata for LLM Picker decisions
- `ModelQuota` — per-model quota tracking
- `ProviderAdapter` — interface for listing models and quotas per provider
- `ProviderErrorKind` / `ClassifiedError` — error normalization layer
- `ProviderRouter` — error-kind-based routing logic (wraps AI SDK calls)
- Stream Manager — timeout/lifecycle management around AI SDK streams

### Consequences

- **Positive:**
  - Eliminates ~500 lines of custom provider adapter code
  - Official SDK packages are maintained by Vercel and provider teams — bug fixes, new models, API changes handled upstream
  - `createProviderRegistry()` gives us string-based model lookup (`"google:gemini-2.5-flash"`) matching AI SDK ecosystem conventions
  - Post-call `usage` data is richer than what our custom adapters captured (cache tokens, reasoning tokens)
  - Community tooling (tracing, observability) works out of the box with AI SDK
  - Model cards remain fully under our control — no dependency on AI SDK for metadata

- **Negative:**
  - Must maintain model card data manually (mitigated: can augment with `llm-info`, `models.dev`, or `pricetoken` packages)
  - AI SDK version upgrades may require adapter updates (mitigated: we only use the stable `LanguageModelV4` interface)
  - Two registries to keep in sync (mitigated: both keyed by same `providerId:modelId`, can validate at startup)

- **Neutral:**
  - Error classifier wrapping pattern is unchanged — it already assumed raw errors from providers
  - LLM Picker architecture (ADR-049) is completely unaffected — it only consumes `ModelDescriptor` and `ModelQuota`, never calls providers directly

### Community Metadata Patterns (Research Summary)

For future reference, these are the established patterns for model metadata alongside AI SDK:

| Package/Source | Type | Coverage | Key Feature |
|---|---|---|---|
| `llm-info` | Static npm bundle | 50+ models | Tokenizer IDs for `@xenova/transformers` |
| `@continuedev/llm-info` | Static npm bundle | 100+ models | Regex-based model ID matching |
| `models.dev` | Community catalog | 600+ models | TOML files, used by LangChain/Mastra |
| `pricetoken` | Live API + seed data | 200+ models | Bayesian confidence scoring for pricing |
| Vercel AI Gateway | Dynamic API | All AI SDK models | `/v1/models` with context_window, pricing |

DiriCode may adopt one or more of these as **seed data sources** for `ModelDescriptor` initialization, while maintaining the authority to override values based on operational experience.
