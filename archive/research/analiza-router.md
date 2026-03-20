# Analiza Router — TASK-005

> **Cel**: Zbadac jak istniejace narzedzia implementuja routing providerow AI,
> i zaproponowac architekture routera dla DiriCode.
>
> Data analizy: 9 marca 2026
> Zrodla: Plandex (Go), OpenCode (TS), OMO config, LiteLLM (Python), Codex CLI

---

## 1. PODSUMOWANIE WYKONAWCZE

DiriCode potrzebuje **routera providerow AI** ktory:
- Kieruje requesty do wlasciwego providera (Copilot prio 1, Kimi prio 2)
- Obsluguje failover miedzy providerami
- Klasyfikuje bledy i decyduje: retry vs fallback vs stop
- Parsuje Retry-After z headerow i body
- Obsluguje streaming z timeoutami na nieaktywnosc
- Integruje sie z Vercel AI SDK (@ai-sdk/*)

**Rekomendacja**: Modul TypeScript oparty na Vercel AI SDK z wlasna warstwa retry/fallback wzorowana na Plandex, BEZ LiteLLM jako dependency.

---

## 2. ANALIZA PER FRAMEWORK

### 2.1 Plandex (Go) — NAJLEPSZA REFERENCJA

**Pliki zrodlowe**:
- `app/server/model/model_error.go` (281 linii) — klasyfikacja bledow
- `app/server/model/client_stream.go` (340 linii) — retry + fallback + streaming
- `app/server/model/client.go` (560 linii) — inicjalizacja klientow, stale
- `app/shared/ai_models_errors.go` — typy wspoldzielone

#### 2.1.1 Architektura

```
Request → providerComposite key → clients map → withStreamingRetries() → stream
                                                      |
                                               ClassifyModelError()
                                                      |
                                        ┌─────────────┼─────────────┐
                                        │             │             │
                                     Retriable   Non-retriable   Fallback
                                     (retry)     (check fallback) (switch model)
```

#### 2.1.2 Klasyfikacja bledow

**ModelError** — centralny typ bledu:
```go
type ModelErrKind string
const (
    ErrOverloaded                 // model przeciazony, retriable
    ErrContextTooLong             // kontekst za duzy, nie retriable
    ErrRateLimited                // 429/529, retriable
    ErrSubscriptionQuotaExhausted // limit subskrypcji, conditional
    ErrOther                      // reszta, heurystyka
    ErrCacheSupport               // blad cache, retriable
)

type ModelError struct {
    Kind              ModelErrKind
    Retriable         bool
    RetryAfterSeconds int
}
```

**Klasyfikacja po message** (heurystyka string-matching):
- Context too long: 11 wariantow ("maximum context length", "too many tokens", "payload too large", ...)
- Overloaded: 6 wariantow ("model_overloaded", "server is overloaded", "resource has been exhausted", ...)
- Cache: "cache control"

**Klasyfikacja po HTTP status code**:
- 429, 529 → `ErrRateLimited` (retriable)
- 413 → `ErrContextTooLong` (nie retriable)
- 501, 505 → `ErrOther` (nie retriable)
- 5xx → `ErrOther` (retriable)
- Specjalnie: OpenRouter "provider returned error" → retriable (OR moze przelaczuc provider)

**Claude Max specjalna sciezka**: 429 + isClaudeMax → `ErrSubscriptionQuotaExhausted`

#### 2.1.3 Retry-After parsing

```go
func extractRetryAfter(h http.Header, body string) (sec int)
```

Trzy zrodla, w kolejnosci priorytetu:
1. **Header `Retry-After`**: sekundy (int) lub HTTP-date
2. **Header `X-RateLimit-Reset`**: Unix epoch
3. **Body patterns** (regex):
   - `"retry_after_ms": 1234` → JSON-style (dzielone przez 1000)
   - `retry after 12s` / `retry_after: 12` → header/text-style
   - `try again in 59 seconds` / `retry in 10s` → Azure free-form

**Kluczowe**: jesli `retryAfter > MAX_RETRY_DELAY_SECONDS (10s)` → blad staje sie **nie retriable**.

#### 2.1.4 Retry + Fallback (`withStreamingRetries`)

Generyczna funkcja `withStreamingRetries[T any]()`:

```
Petla:
1. Sprawdz ctx.Err() → return partial result jesli stream juz cos dostal
2. Wywolaj operation(numRetry, didProviderFallback, modelErr)
3. Jesli success → return
4. Jesli blad:
   a. classifyBasicError() → ModelError
   b. Jesli nie retriable:
      - ErrContextTooLong + jest LargeContextFallback → fallback
      - Inny + jest ErrorFallback → fallback
      - Brak fallbacku → return error
   c. Jesli retriable:
      - compareRetries >= maxRetries → return error
      - RetryAfterSeconds > 0 → czekaj retryAfter * 1.1
      - Inaczej → czekaj 1000 + random(200) ms
   d. ShouldIncrementRetry() — nie inkrementuj dla SubscriptionQuota i CacheSupport
```

**Stale**:
| Stala | Wartosc | Opis |
|-------|---------|------|
| `MAX_RETRIES_WITHOUT_FALLBACK` | 3 | Max retry na glownym modelu |
| `MAX_ADDITIONAL_RETRIES_WITH_FALLBACK` | 1 | Max retry po fallbacku |
| `MAX_RETRY_DELAY_SECONDS` | 10 | Jesli Retry-After > 10s → stop |
| `MAX_RETRIES_BEFORE_FALLBACK` | 1 | Ile retry zanim fallback |
| `ACTIVE_STREAM_CHUNK_TIMEOUT` | 60s | Timeout na nieaktywny stream |
| `USAGE_CHUNK_TIMEOUT` | 10s | Timeout na usage chunk po zakonczeniu |

#### 2.1.5 Fallback chain

Trzy typy fallbacku (w kolejnosci):
1. **FallbackTypeContext** — `LargeContextFallback` (np. model z wiekszym oknem)
2. **FallbackTypeError** — `ErrorFallback` (np. inny model)
3. **FallbackTypeProvider** — automatyczny, jesli brak ErrorFallback:
   - Jesli ma OpenRouter credentials → fallback na OpenRouter
   - Inaczej → drugi provider w stacku
   - Wylaczony dla Claude Max (zostan na Claude)

#### 2.1.6 Streaming

- **Streaming-first** — req.Stream = true, StreamOptions.IncludeUsage = true
- **Inactivity timeout** (60s) — jesli chunk nie przychodzi przez 60s → timeout
- **Usage chunk timeout** (10s) — po FinishReason czekaj max 10s na usage data
- **Graceful partial results** — jesli ctx cancelled i jest partial, zwroc z flagami Stopped + Error
- **OpenRouter :nitro** — automatycznie dodaje suffix dla szybszych providerow

---

### 2.2 OpenCode (TypeScript) — REFERENCJA VERCEL AI SDK

**Pliki zrodlowe**:
- `packages/opencode/src/provider/provider.ts` (~700 linii) — pelna implementacja providerow
- `packages/opencode/src/provider/error.ts` (~170 linii) — klasyfikacja bledow

#### 2.2.1 Architektura

```
Config + models.dev DB + env → Provider.state() → providers map
                                                       |
                                         Provider.getSDK(model) → @ai-sdk/* SDK
                                                       |
                                         Provider.getLanguage(model) → LanguageModelV2
```

**Kluczowe cechy**:
- **22 bundled providerow** via `BUNDLED_PROVIDERS` map — kazdy z dedykowanym `@ai-sdk/*` pakietem
- **Custom loaders** per provider — specjalna logika (auth, headers, model resolution)
- **models.dev** jako zrodlo metadanych modeli (koszt, limity, capabilities)
- **Provider merging**: database → env → auth → plugins → config (kazda warstwa nadpisuje)
- **Dynamic npm install** — jesli provider nie jest bundled, `BunProc.install(npm, 'latest')`
- **SDK caching** — klucz = xxHash32(providerID + npm + options), nie tworzy duplikatow

#### 2.2.2 Klasyfikacja bledow

OpenCode ma prostszy system niz Plandex:

```typescript
type ParsedAPICallError =
  | { type: "context_overflow", message: string }
  | { type: "api_error", message: string, statusCode?: number, isRetryable: boolean }
```

**OVERFLOW_PATTERNS** — 13 regexow pokrywajacych Anthropic, Bedrock, OpenAI, Google, xAI, Groq, OpenRouter, DeepSeek, Copilot, llama.cpp, LM Studio, MiniMax, Kimi:
```
/prompt is too long/i                           // Anthropic
/input is too long for requested model/i        // Amazon Bedrock
/exceeds the context window/i                   // OpenAI
/input token count.*exceeds the maximum/i       // Google
/maximum prompt length is \d+/i                 // xAI
/reduce the length of the messages/i            // Groq
/maximum context length is \d+ tokens/i         // OpenRouter, DeepSeek
/exceeds the limit of \d+/i                     // GitHub Copilot
/exceeds the available context size/i           // llama.cpp
/greater than the context length/i              // LM Studio
/context window exceeds limit/i                 // MiniMax
/exceeded model token limit/i                   // Kimi, Moonshot
/context[_ ]length[_ ]exceeded/i               // Generic
```

Dodatkowy pattern: `400/413 (no body)` → overflow (Cerebras, Mistral)

**Stream error parsing** — oddzielne od API errors:
- `context_length_exceeded` → context_overflow
- `insufficient_quota` → non-retryable
- `usage_not_included` → non-retryable (ChatGPT plan limitation)
- `invalid_prompt` → non-retryable

**OpenAI specjalna sciezka**: 404 traktowane jako retriable (OpenAI zwraca 404 dla dostepnych modeli)

#### 2.2.3 Fallback w OpenCode

Config-driven, nie code-driven:

```json
{
  "agents": {
    "build": {
      "model": "anthropic/claude-sonnet-4-5",
      "fallback_models": ["openai/gpt-4o", "google/gemini-2.5-pro"]
    }
  }
}
```

OMO rozszerza to o runtime_fallback:
```json
{
  "runtime_fallback": {
    "enabled": true,
    "retry_on_errors": [429, 500, 502, 503],
    "max_fallback_attempts": 3,
    "cooldown_seconds": 30,
    "timeout_seconds": 60,
    "notify_on_fallback": true
  }
}
```

**Brak centralnego retry wrappera** — fallback logika rozproszona, oparta na Vercel AI SDK `isRetryable`.

#### 2.2.4 Provider resolution

Priorytetyzacja providerow (przyklad dla small model):
1. Config (`cfg.small_model`)
2. Ostatnio uzywany (z `model.json` na dysku)
3. Priority list per provider (np. Copilot → `gpt-5-mini`, `claude-haiku-4.5`)
4. Fallback na opencode provider

---

### 2.3 LiteLLM (Python) — REFERENCJA PROXY/GATEWAY

**Zrodlo**: `analiza-litellm-ankieta.md` (pelna analiza), oficjalna dokumentacja

#### 2.3.1 Architektura routera

```python
Router(model_list=[...], routing_strategy="simple-shuffle")
```

Kazdy model alias moze miec wiele deploymentow (rozne klucze API, rozni providerzy):
```yaml
model_list:
  - model_name: gpt-4          # alias
    litellm_params:
      model: gpt-4             # faktyczny
      api_key: KEY_1
      rpm: 500
  - model_name: gpt-4          # TEN SAM alias, inny klucz
    litellm_params:
      model: azure/gpt-4       # inny provider!
      api_key: KEY_2
```

#### 2.3.2 Strategie routingu

| Strategia | Opis |
|-----------|------|
| `simple-shuffle` | Losowy z wagami RPM/TPM (domyslna) |
| `usage-based-routing-v2` | Najmniejsze zuzycie TPM/RPM |
| `cost-based-routing` | Najtanszy deployment |
| `latency-based-routing` | Najszybszy deployment |
| `least-busy` | Najmniej rownoczesnych requestow |

#### 2.3.3 Fallback i reliability

- **Model fallback**: gpt-4 fail → gpt-3.5-turbo
- **Context window fallback**: prompt za duzy → model z wiekszym oknem
- **Content policy fallback**: filtracja → inny model
- **Cooldown**: N failures w 1 min → temporary disable (circuit breaker)
- **Retries**: num_retries z exponential backoff przed fallbackiem

#### 2.3.4 Dlaczego NIE LiteLLM jako dependency

1. **Python** — DiriCode jest w TypeScript, dodanie Pythona komplikuje deployment
2. **Overengineered dla MVP** — LiteLLM obsluguje 100+ providerow, potrzebujemy 2 (Copilot + Kimi)
3. **Sidecar complexity** — zarzadzanie procesem Python, health checks, port allocation
4. **Vercel AI SDK juz pokrywa 60%** — bundled providery, model resolution, streaming
5. **Brak kontroli** — trudniej customizowac retry/fallback logike pod specyfike DiriCode

**LiteLLM = swienta referencja koncepcyjna**, ale nie dependency.

---

### 2.4 Codex CLI — BRAK ROUTERA

**Plik**: `codex-cli/bin/codex.js`

Codex CLI to cienki Node wrapper spawnujacy platformowy natywny binary (Rust). Brak:
- Multi-provider routing
- Fallback logic
- Error classification
- Retry logic

**Wniosek**: Nie ma wartosci jako referencja dla routera.

---

## 3. WZORCE DO ADOPCJI W DIRICODE

### 3.1 Centralized Error Classification (z Plandex + OpenCode)

**PRZYJMUJEMY**: Pojedynczy typ `RouterError` normalizujacy odpowiedzi z roznych providerow.

```typescript
type RouterErrorKind =
  | "rate_limited"          // 429/529
  | "context_overflow"      // prompt za duzy
  | "overloaded"            // model przeciazony
  | "quota_exhausted"       // limit subskrypcji
  | "auth_error"            // 401/403
  | "not_found"             // 404 (moze byc retriable — OpenAI quirk)
  | "other"                 // reszta

interface RouterError {
  kind: RouterErrorKind
  retriable: boolean
  retryAfterMs: number       // 0 = brak info
  originalStatus?: number
  originalMessage: string
  provider: string
}
```

**Klasyfikacja**: merge podejsc Plandex (message heuristics) + OpenCode (regex patterns):
- OpenCode ma 13 overflow regexow pokrywajacych wiecej providerow — przyjmujemy
- Plandex ma overloaded/cache patterns — dodajemy
- Dodajemy Kimi-specyficzne patterny

### 3.2 Retry-After Parsing (z Plandex)

**PRZYJMUJEMY** podejscie Plandex — parsowanie z headerow I body:

```typescript
function extractRetryAfter(headers: Headers, body: string): number {
  // 1. Header Retry-After (seconds or HTTP-date)
  // 2. Header X-RateLimit-Reset (Unix epoch)
  // 3. Body: "retry_after_ms": 1234
  // 4. Body: "retry after 12s"
  // 5. Body: "try again in 59 seconds" (Azure)
}
```

### 3.3 Retry Wrapper z Fallback (z Plandex)

**PRZYJMUJEMY** pattern `withRetries()`:

```
Petla:
1. Execute request
2. Success → return
3. Error → classify
4. Non-retriable + fallback available → switch provider, reset retry count
5. Non-retriable + no fallback → throw
6. Retriable + retries < max → wait(retryAfter * 1.1 || 1000+jitter) → retry
7. Retriable + retries >= max → throw
```

**Stale DiriCode**:
| Stala | Wartosc | Uzasadnienie |
|-------|---------|-------------|
| `MAX_RETRIES` | 3 | Jak Plandex, wystarczajace |
| `MAX_RETRIES_AFTER_FALLBACK` | 2 | Wiecej niz Plandex (1), bo mamy mniej providerow |
| `MAX_RETRY_DELAY_MS` | 15000 | Wiecej niz Plandex (10s), Kimi moze byc wolniejszy |
| `STREAM_INACTIVITY_TIMEOUT_MS` | 60000 | Jak Plandex |
| `USAGE_CHUNK_TIMEOUT_MS` | 10000 | Jak Plandex |

### 3.4 Streaming z Inactivity Timeout (z Plandex)

**PRZYJMUJEMY**: Timer resetowany przy kazdym chunku. Jesli brak chunkow przez 60s → timeout.

Dodatkowy timeout po `finish_reason` — czekaj max 10s na usage data.

### 3.5 Config-driven Fallback Chain (z OpenCode/OMO)

**PRZYJMUJEMY**: Fallback definiowany w configu per agent, nie hardcoded:

```typescript
// diricode.config.ts
{
  families: {
    coding: {
      models: [
        { provider: "copilot", model: "claude-sonnet-4", priority: 1 },
        { provider: "kimi", model: "kimi-k2", priority: 2 },
      ],
      fallback: {
        maxAttempts: 3,
        cooldownMs: 30000,
        notifyOnFallback: true,
      }
    }
  }
}
```

### 3.6 Provider SDK Caching (z OpenCode)

**PRZYJMUJEMY**: SDK instance cache z hash key (provider + options). Nie tworzymy duplikatow SDK.

---

## 4. ARCHITEKTURA ROUTERA DIRICODE

### 4.1 Modul vs Microservice

| Aspekt | Modul (in-process) | Microservice (sidecar) |
|--------|--------------------|------------------------|
| **Zlozonosc** | Niska — jeden proces | Wysoka — 2 procesy, IPC, health checks |
| **Latencja** | Zero — function call | +1-5ms per request (HTTP localhost) |
| **Jezyk** | TypeScript (natywny) | Dowolny (LiteLLM = Python) |
| **Debugging** | Proste — jeden stack trace | Trudne — 2 logi, race conditions |
| **Deployment** | npm install | npm install + Python + pip |
| **Vercel AI SDK** | Pelna integracja | Trzeba proxy-owac lub omijac |
| **MVP fit** | Idealny — 2 providery | Over-engineered |

**DECYZJA: MODUL** — TypeScript, w procesie Hono servera, oparty na Vercel AI SDK.

### 4.2 Diagram komponentow

```
┌─────────────────────────────────────────────────────┐
│                    DiriCode Router                   │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  Provider     │  │  Error       │  │  Retry     │ │
│  │  Registry     │  │  Classifier  │  │  Engine    │ │
│  │              │  │              │  │            │ │
│  │ - SDK cache  │  │ - classify() │  │ - retry()  │ │
│  │ - getSDK()   │  │ - overflow?  │  │ - fallback │ │
│  │ - getModel() │  │ - retryAfter │  │ - cooldown │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                │        │
│  ┌──────┴─────────────────┴────────────────┴──────┐ │
│  │              Stream Manager                     │ │
│  │                                                 │ │
│  │  - createStream(family, messages, tools)        │ │
│  │  - inactivity timeout (60s)                     │ │
│  │  - usage chunk timeout (10s)                    │ │
│  │  - partial result on cancel                     │ │
│  └─────────────────────────────────────────────────┘ │
│                         │                            │
│  ┌──────────────────────┴──────────────────────────┐ │
│  │              @ai-sdk/* Providers                 │ │
│  │                                                  │ │
│  │  Copilot (@ai-sdk/github-copilot)               │ │
│  │  Kimi (custom @ai-sdk/openai-compatible)        │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 4.3 Interfejs publiczny

```typescript
interface Router {
  // Glowna metoda — streaming completion z retry/fallback
  createStream(params: {
    family: string           // np. "coding", "reasoning"
    messages: Message[]
    tools?: Tool[]
    signal?: AbortSignal
    onFallback?: (from: string, to: string, error: RouterError) => void
  }): AsyncIterable<StreamChunk>

  // Informacje o dostepnych providerach
  getAvailableProviders(family: string): ProviderInfo[]

  // Health status
  getHealth(): ProviderHealth[]
}
```

### 4.4 Flow request

```
1. Agent wywoluje router.createStream({ family: "coding", ... })
2. Router resolve family → ordered provider list [Copilot, Kimi]
3. Provider Registry → getSDK("copilot") → cached @ai-sdk instance
4. Stream Manager → start stream z inactivity timer
5. Chunk przychodzi → reset timer, yield chunk
6. Error przychodzi → Error Classifier → RouterError
7. RouterError.retriable?
   TAK → Retry Engine → wait → goto 4 (same provider)
   NIE → Retry Engine → fallback → next provider → goto 3
8. Max retries → throw z pelnym kontekstem
9. Stream ends → wait for usage chunk (10s) → return result
```

---

## 5. POROWNANIE PODEJSC — TABELA ZBIORCZA

| Aspekt | Plandex | OpenCode | LiteLLM | DiriCode (propozycja) |
|--------|---------|----------|---------|----------------------|
| **Jezyk** | Go | TypeScript | Python | TypeScript |
| **Error types** | 6 kinds | 2 types (overflow + api) | N/A (proxy) | 7 kinds |
| **Retry-After** | Header + body (3 regex) | Brak wlasnego | Proxy-level | Header + body (3 regex, z Plandex) |
| **Retry wrapper** | `withStreamingRetries` generyczny | Brak centralnego | Router-level | `withRetries` generyczny |
| **Fallback types** | Context, Error, Provider | Config fallback_models | Model, Context, Content | Family-based priority + error/context |
| **Streaming** | Timer + inactivity | Delegowane do AI SDK | SSE natywnie | Timer + inactivity (jak Plandex) |
| **SDK** | go-openai + LiteLLM sidecar | @ai-sdk/* (22 bundled) | Natywne | @ai-sdk/* (2-3 bundled) |
| **Config** | PlanSettings + ModelRoleConfig | opencode.json + models.dev | YAML | diricode.config.ts (Zod) |
| **Provider count** | 5-10 | 22+ | 100+ | 2 (MVP), extensible |

---

## 6. RYZYKA I MITYGACJA

| Ryzyko | Prawdopodobienstwo | Impact | Mitygacja |
|--------|-------------------|--------|-----------|
| Copilot API zmienia error format | Srednie | Sredni | Pattern-based classification, nie hardcoded |
| Kimi nie ma Vercel AI SDK adaptera | Wysokie | Niski | `@ai-sdk/openai-compatible` wystarczy |
| Streaming timeout za krotki/dlugi | Niskie | Sredni | Konfigurowalne stale w config |
| Oba providery niedostepni naraz | Niskie | Wysoki | Graceful error + queue retry + user notification |
| Rate limit cascade (retry storm) | Srednie | Sredni | Exponential backoff + max delay cap + jitter |

---

## 7. IMPLEMENTACJA — PLAN PLIKOW

```
packages/core/src/router/
  index.ts              — export publiczny
  router.ts             — glowna klasa Router
  error-classifier.ts   — classifyError(), overflow patterns, retry-after parsing
  retry-engine.ts       — withRetries(), backoff, fallback logic
  stream-manager.ts     — createStream(), inactivity timer, usage chunk wait
  provider-registry.ts  — SDK cache, getSDK(), getModel()
  types.ts              — RouterError, RouterErrorKind, ProviderInfo, etc.
  constants.ts          — MAX_RETRIES, timeouty, etc.
```

**Szacowany rozmiar**: ~800-1200 linii kodu (bez testow)

---

## 8. WNIOSKI

1. **Plandex to najlepsza referencja** — pelny error classification, retry-after parsing, streaming timeouts, fallback chain. Kod jest czysty i dobrze ustrukturyzowany.

2. **OpenCode to najlepsza referencja Vercel AI SDK** — 22 providerow, SDK caching, models.dev integracja, overflow patterns. DiriCode powinien uzyc tego samego @ai-sdk/* podejscia.

3. **LiteLLM to referencja koncepcyjna** — strategie routingu (least_busy, cost-based) warto znac na v2, ale nie jako dependency w MVP.

4. **DiriCode laczy najlepsze z obu swiatow**: Plandex retry/fallback logic + OpenCode Vercel AI SDK + config-driven families.

5. **MVP jest prosty**: 2 providery, 1 strategia (priority-based failover), 7 error kinds. Extensible na wiecej providerow i strategi w v2.

---

> **Status**: TASK-005 KOMPLETNY
> **Nastepny krok**: Implementacja Phase 1 — Router + Fundamenty (zgodnie z plan-implementacji-diricode.md)
