# Swarm Model Picker - UI Implementation Plan

> **Transport Layer:** LLM transport uses Vercel AI SDK (`@ai-sdk/*` provider packages) per ADR-054. The Picker dashboard visualizes decisions made by the LLM Picker (ADR-049), which selects models from static Model Cards (`ModelDescriptor[]`) and delegates actual LLM calls to the AI SDK transport layer. See `docs/adr/adr-054-ai-sdk-transport-layer.md`.

## Epic 1: Core Layout & Global State

**Cel:** Zbudowanie szkieletu aplikacji, nawigacji oraz globalnego zarządzania stanem pod dane realtime.

### Issue 1.1: Dashboard App Shell & Routing

**Opis:** Implementacja głównego layoutu aplikacji, zawierającego Top Bar, lewe menu nawigacyjne (Sidebar) oraz główny obszar roboczy z wydzielonym prawym panelem (Inspector).
**Acceptance Criteria:**

- [ ] Zbudowany główny grid CSS (np. Top Bar 60px, Sidebar 240px, Główny widok elastyczny, Prawy panel 350px - ukrywalny).
- [ ] Nawigacja po lewej stronie z zakładkami: Ops (Live), Logs, Errors, Policies.
- [ ] Responsywność: prawy panel można zwinąć/rozwinąć.
- [ ] Użycie frameworka (np. React + Tailwind CSS / Shadcn UI).

### Issue 1.2: Top Bar Global Stats Component

**Opis:** Pasek na górze pokazujący kluczowe metryki systemu na żywo.
**Acceptance Criteria:**

- [ ] Wyświetla wskaźnik "Decisions/s" (z opcją prostego sparkline/wykresu).
- [ ] Wyświetla % Fallbacków (zmienia kolor na żółty/czerwony po przekroczeniu progu).
- [ ] Wyświetla licznik Errors.
- [ ] Stan podłączony do globalnego contextu / store'a (na razie z mockowanymi danymi zmieniającymi się co sekundę).

---

## Epic 2: Live Routing Map (Środek - Góra)

**Cel:** Implementacja wizualnego, animowanego grafu pokazującego na żywo ścieżki decyzyjne między Agentami, Politykami a Modelami.

### Issue 2.1: Graph Component Foundation

**Opis:** Inicjalizacja biblioteki do grafów (np. React Flow) i zdefiniowanie statycznych węzłów.
**Acceptance Criteria:**

- [ ] Zdefiniowane customowe węzły: Node Agenta, Node Polityki, Node Modelu.
- [ ] Węzły mają odpowiednie ikony i statusy (np. zajętość).
- [ ] Ułożenie horyzontalne (od lewej do prawej).

### Issue 2.2: Live Data Animation (Krawędzie)

**Opis:** Wizualizacja requestów przelatujących przez system w czasie rzeczywistym.
**Acceptance Criteria:**

- [ ] Krawędzie (edges) podświetlają się i animują cząsteczki (particles), gdy przechodzi przez nie decyzja.
- [ ] Kolorowanie krawędzi: Zielony (Standard), Pomarańczowy (Fallback).
- [ ] Mechanizm czyszczenia/wygasania animacji po ustalonym czasie (np. 1-2s).

---

## Epic 3: Request Stream Log (Środek - Dół)

**Cel:** Stworzenie wydajnej, przewijanej tabeli logów decyzyjnych w czasie rzeczywistym.

### Issue 3.1: Virtualized Request Table

**Opis:** Tabela logów obsługująca duże ilości szybko napływających danych (Virtualized List).
**Acceptance Criteria:**

- [ ] Tabela renderująca tylko widoczne wiersze (np. przy użyciu `@tanstack/react-virtual` lub `react-window`).
- [ ] Kolumny: Time, Agent, Task Type, Chosen Model, Latency.
- [ ] Kolorowanie komórek (np. Latency > 50ms na pomarańczowo).

### Issue 3.2: Stream Controls (Play/Pause/Filter)

**Opis:** Mechanika kontrolowania przepływu logów, aby móc je analizować.
**Acceptance Criteria:**

- [ ] Przycisk Play/Pause - zatrzymuje dodawanie nowych wierszy do widoku (ale trzyma je w buforze).
- [ ] Input "Filter..." pozwalający filtrować widoczne requesty (np. by Agent, Model, Task Type).
- [ ] Auto-scroll do dołu, dopóki użytkownik sam nie przewinie wyżej.

---

## Epic 4: Decision Inspector (Prawy Panel)

**Cel:** Szczegółowy widok pojedynczej decyzji po kliknięciu w log.

### Issue 4.1: Inspector State & Data Fetching

**Opis:** Połączenie tabeli logów z prawym panelem.
**Acceptance Criteria:**

- [ ] Kliknięcie wiersza w tabeli Request Stream rozwija Inspector panel po prawej i podświetla wiersz.
- [ ] Wyświetla ID requestu i podstawowe metadane (Agent, Task).

### Issue 4.2: Winner & Runner-ups UI

**Opis:** Wyświetlenie szczegółów punktacji i powodów wyboru dla danego żądania.
**Acceptance Criteria:**

- [ ] Sekcja "WINNER": Pokazuje wybrany model, jego ostateczny wynik (Score) i listę spełnionych kryteriów (zielone checkmarki).
- [ ] Sekcja "RUNNER-UPS": Lista modeli, które przegrały.
- [ ] Dla każdego runner-upa pokazany powód odrzucenia (np. czerwony X z powodem "Koszt za wysoki" lub "Brak obsługi narzędzi").

### Issue 4.3: "Replay Decision" Action

**Opis:** Akcja pozwalająca zasymulować ten sam request ponownie.
**Acceptance Criteria:**

- [ ] Przycisk "Replay Decision" na dole Inspectora.
- [ ] Po kliknięciu pojawia się modal z payloadem JSON, z możliwością edycji i przyciskiem "Run Replay".
- [ ] (Mock) Po wykonaniu pojawia się wynik obok (Before vs After).

---

## Epic 5: Mock Data Engine (Do dewelopmentu)

**Cel:** Generator danych testowych symulujący żywy swarm, aby UI można było budować w izolacji.

### Issue 5.1: Swarm Data Generator

**Opis:** Skrypt / Web Worker generujący eventy w określonym tempie.
**Acceptance Criteria:**

- [ ] Funkcja generująca co X milisekund losowy decyzję (event w formacie z naszego przyszłego kontraktu).
- [ ] Obsługa włączania zniekształceń (np. nagły skok fallbacków na polecenie).
- [ ] Integracja z głównym stanem (symulacja WebSocketu).

---

---

# Contract Eventów i Payloadów

## Przegląd

Picker **nie komunikuje się z modelami docelowymi**. Komunikuje się wyłącznie z Orchestratorem.

Przepływ:

```
Orchestrator ──► Picker: "Dobierz model dla tego agenta i taska"
Picker ──► Orchestrator: "Użyj modelu X, oto dlaczego"
Orchestrator ──► Docelowy LLM API: (sam wykonuje request)
Orchestrator ──► Picker (opcjonalnie): "Oto feedback z wykonania"
```

Transport: **WebSocket** (dla live UI) + **REST** (dla replay/debug/CRUD).

---

## 1. Orchestrator → Picker: Decision Request

**Endpoint:** `WS event: picker.request` / `POST /api/v1/decisions`

```jsonc
{
  // === Identyfikacja ===
  "request_id": "pick_a8f3c", // UUID, generowany przez orchestratora
  "orchestrator_id": "orch_main", // identyfikator instancji orchestratora
  "timestamp": "2026-03-28T14:22:01.342Z", // ISO 8601

  // === Agent ===
  "agent": {
    "id": "agent_researcher_7", // unikalny ID agenta w swarmie
    "role": "researcher", // rola semantyczna
    "instance": 3, // która instancja tego agenta (swarm może mieć wiele)
  },

  // === Task ===
  "task": {
    "type": "long_context_synthesis", // kategoria taska
    "description": "Summarize 3 ADR documents and propose consolidation", // opcjonalny opis
    "estimated_input_tokens": 48000, // szacunek orchestratora
    "estimated_output_tokens": 2000, // szacunek orchestratora
    "tools_required": ["file_read", "grep"], // jakie tools agent będzie chciał użyć
    "requires_reasoning": true, // czy task wymaga głębokiego reasoning
    "priority": "normal", // low | normal | high | critical
  },

  // === Constraints (twarde limity) ===
  "constraints": {
    "max_cost_usd": 0.15, // null = brak limitu
    "max_latency_ms": 8000, // null = brak limitu
    "min_context_window": 64000, // minimalne okno kontekstowe
    "required_capabilities": ["tool_calling", "json_mode"], // must-have
    "excluded_providers": ["anthropic"], // provider blacklist (np. z powodu compliance)
    "excluded_models": [], // model blacklist
    "preferred_providers": ["openai"], // soft preference (nie hard constraint)
    "preferred_models": [], // soft preference
  },

  // === Policy override (opcjonalny) ===
  "policy_override": null, // string | null — wymuś konkretną policy (np. "cheapest_possible")
}
```

### Walidacja payloadu

| Pole                          | Wymagane | Typ           | Uwagi                                 |
| ----------------------------- | -------- | ------------- | ------------------------------------- |
| `request_id`                  | ✅       | string (UUID) | Unikalne per request                  |
| `orchestrator_id`             | ✅       | string        | Identyfikuje instancję                |
| `agent.id`                    | ✅       | string        | Unikalne w obrębie swarmu             |
| `agent.role`                  | ✅       | string        | Z predefiniowanego enuma ról          |
| `task.type`                   | ✅       | string        | Z predefiniowanego enuma task types   |
| `task.estimated_input_tokens` | ❌       | number        | Jeśli brak, picker szacuje sam        |
| `constraints`                 | ❌       | object        | Jeśli brak, używa domyślnych z policy |

---

## 2. Picker → Orchestrator: Decision Response

**Endpoint:** `WS event: picker.decision` / Response na `POST /api/v1/decisions`

```jsonc
{
  // === Identyfikacja ===
  "request_id": "pick_a8f3c", // echo z requestu
  "decision_id": "dec_7x9k2", // UUID decyzji
  "timestamp": "2026-03-28T14:22:01.384Z",

  // === Wynik ===
  "status": "resolved", // resolved | no_match | error

  // === Wybrany model ===
  "selected": {
    "provider": "openai",
    "model": "gpt-4.1",
    "model_version": "2026-03-14",
    "score": 92, // 0-100, wynik końcowy
    "estimated_cost_usd": 0.087,
    "estimated_latency_ms": 3200,
    "context_window": 128000,
    "capabilities": ["tool_calling", "json_mode", "vision"],
  },

  // === Kandydaci (do debugowania) ===
  "candidates": [
    {
      "provider": "openai",
      "model": "gpt-4.1",
      "score": 92,
      "status": "selected",
      "scores_breakdown": {
        "quality": 88,
        "cost": 75,
        "latency": 95,
        "capability_match": 100,
      },
    },
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4",
      "score": 0,
      "status": "excluded",
      "rejection_reason": "Provider excluded by constraint",
    },
    {
      "provider": "openai",
      "model": "gpt-4o",
      "score": 71,
      "status": "runner_up",
      "scores_breakdown": {
        "quality": 90,
        "cost": 40,
        "latency": 85,
        "capability_match": 100,
      },
      "rejection_reason": "Score below winner; cost too high for constraint",
    },
    {
      "provider": "meta",
      "model": "llama-3-70b",
      "score": 0,
      "status": "excluded",
      "rejection_reason": "Missing capability: json_mode",
    },
  ],

  // === Metadane decyzji ===
  "decision_meta": {
    "policy_used": "quality_first_v3",
    "selection_latency_ms": 42, // ile trwała sama decyzja
    "is_fallback": false, // czy to fallback z powodu braku idealnego matcha
    "fallback_reason": null, // jeśli is_fallback=true, dlaczego
  },
}
```

### Status codes

| `status`   | Znaczenie                           | Orchestrator powinien               |
| ---------- | ----------------------------------- | ----------------------------------- |
| `resolved` | Model wybrany pomyślnie             | Użyć `selected.model`               |
| `no_match` | Żaden model nie spełnia constraints | Rozluźnić constraints lub retry     |
| `error`    | Błąd wewnętrzny pickera             | Retry / fallback na hardcoded model |

---

## 3. Orchestrator → Picker: Execution Feedback (opcjonalny)

**Endpoint:** `WS event: picker.feedback` / `POST /api/v1/decisions/{decision_id}/feedback`

Orchestrator **po wykonaniu requestu do LLM** może odesłać feedback, żeby picker uczył się.

```jsonc
{
  "decision_id": "dec_7x9k2",
  "request_id": "pick_a8f3c",
  "timestamp": "2026-03-28T14:22:06.100Z",

  // === Faktyczne metryki wykonania ===
  "execution": {
    "actual_input_tokens": 47200,
    "actual_output_tokens": 1850,
    "actual_cost_usd": 0.082,
    "actual_latency_ms": 3100,
    "ttft_ms": 420,
    "tokens_per_second": 85.2,
    "finish_reason": "stop", // stop | length | tool_calls | error
    "success": true,
    "error": null, // jeśli success=false, opis błędu
  },

  // === Orchestrator override (jeśli zmienił decyzję pickera) ===
  "override": null, // null = użył recommended model
  // LUB:
  // "override": {
  //   "actual_model": "gpt-4.1-mini",
  //   "reason": "manual_cost_cap"
  // }
}
```

---

## 4. Picker Internal Events (do UI przez WebSocket)

Te eventy NIE są częścią kontraktu z orchestratorem — to wewnętrzny event bus pickera, który zasila UI dashboard.

### 4.1 picker.stats (co 1s)

```jsonc
{
  "event": "picker.stats",
  "data": {
    "decisions_per_second": 45.2,
    "avg_selection_latency_ms": 18,
    "fallback_rate_pct": 2.1,
    "error_count_last_60s": 0,
    "active_agents": 12,
    "model_distribution": {
      "gpt-4.1": 0.42,
      "gpt-4.1-mini": 0.31,
      "claude-sonnet-4": 0.18,
      "llama-3-70b": 0.09,
    },
  },
  "ts": "2026-03-28T14:22:02.000Z",
}
```

### 4.2 picker.decision.live (per-decision, do request stream)

```jsonc
{
  "event": "picker.decision.live",
  "data": {
    "request_id": "pick_a8f3c",
    "decision_id": "dec_7x9k2",
    "agent_id": "agent_researcher_7",
    "agent_role": "researcher",
    "task_type": "long_context_synthesis",
    "chosen_model": "gpt-4.1",
    "chosen_provider": "openai",
    "score": 92,
    "selection_latency_ms": 42,
    "is_fallback": false,
    "policy_used": "quality_first_v3",
  },
  "ts": "2026-03-28T14:22:01.384Z",
}
```

### 4.3 picker.error (do error logu)

```jsonc
{
  "event": "picker.error",
  "data": {
    "request_id": "pick_b2d4e", // null jeśli błąd nie dotyczy requestu
    "error_type": "invalid_payload", // invalid_payload | policy_eval_error | stale_registry | internal
    "message": "Missing required field: agent.role",
    "severity": "warning", // info | warning | error | critical
    "stack": null, // opcjonalny stack trace
  },
  "ts": "2026-03-28T14:22:03.100Z",
}
```

### 4.4 picker.graph.edge (do animacji Live Routing Map)

```jsonc
{
  "event": "picker.graph.edge",
  "data": {
    "decision_id": "dec_7x9k2",
    "path": [
      { "node_type": "agent", "id": "agent_researcher_7" },
      { "node_type": "policy", "id": "quality_first_v3" },
      { "node_type": "model", "id": "openai/gpt-4.1" },
    ],
    "edge_type": "standard", // standard | fallback | override
  },
  "ts": "2026-03-28T14:22:01.384Z",
}
```

---

## 5. REST API Endpoints (poza WebSocket)

| Method | Endpoint                         | Opis                                                                                            |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/decisions`              | Synchroniczny decision request (alternatywa dla WS)                                             |
| `GET`  | `/api/v1/decisions`              | Lista decyzji (paginacja, filtry)                                                               |
| `GET`  | `/api/v1/decisions/:id`          | Szczegóły jednej decyzji                                                                        |
| `POST` | `/api/v1/decisions/:id/replay`   | Replay decyzji z opcjonalnie zmienionym payloadem                                               |
| `POST` | `/api/v1/decisions/:id/feedback` | Feedback po wykonaniu                                                                           |
| `GET`  | `/api/v1/models`                 | Registry modeli (capabilities, pricing, availability)                                           |
| `GET`  | `/api/v1/models/:id`             | Szczegóły modelu                                                                                |
| `GET`  | `/api/v1/policies`               | Lista polityk routingu                                                                          |
| `GET`  | `/api/v1/policies/:id`           | Szczegóły polityki                                                                              |
| `PUT`  | `/api/v1/policies/:id`           | Aktualizacja polityki                                                                           |
| `GET`  | `/api/v1/agents`                 | Lista znanych agentów                                                                           |
| `GET`  | `/api/v1/agents/:id/stats`       | Statystyki agenta                                                                               |
| `GET`  | `/api/v1/errors`                 | Lista błędów (paginacja, filtry)                                                                |
| `GET`  | `/api/v1/stats`                  | Agregowane metryki                                                                              |
| `GET`  | `/api/v1/stats/timeseries`       | Metryki w czasie (do wykresów)                                                                  |
| `WS`   | `/ws`                            | WebSocket do live eventów (picker.stats, picker.decision.live, picker.error, picker.graph.edge) |

---

---

# Model Danych Backendu

## Przegląd

Backend pickera to **decision engine + telemetry store**. Nie trzyma konwersacji, nie zarządza agentami — tylko rejestruje decyzje, przechowuje registry modeli i polityki.

Storage: **SQLite** (spójne z architekturą DiriCode — local-first).

---

## Tabele

### 1. `models` — Registry modeli

```sql
CREATE TABLE models (
  id            TEXT PRIMARY KEY,          -- "openai/gpt-4.1"
  provider      TEXT NOT NULL,             -- "openai"
  model_name    TEXT NOT NULL,             -- "gpt-4.1"
  model_version TEXT,                      -- "2026-03-14"
  display_name  TEXT NOT NULL,             -- "GPT-4.1"

  -- Capabilities (jako JSON array)
  capabilities  TEXT NOT NULL DEFAULT '[]', -- '["tool_calling","json_mode","vision"]'

  -- Limity
  context_window     INTEGER NOT NULL,     -- 128000
  max_output_tokens  INTEGER,              -- 16384

  -- Pricing (per 1M tokens, USD)
  input_price_per_m   REAL NOT NULL,       -- 2.00
  output_price_per_m  REAL NOT NULL,       -- 8.00
  cached_input_price_per_m REAL,           -- 0.50 (null jeśli brak cache)

  -- Quality heuristics
  quality_score       INTEGER DEFAULT 50,  -- 0-100, ręcznie/automatycznie kalibrowany
  speed_score         INTEGER DEFAULT 50,  -- 0-100
  reasoning_score     INTEGER DEFAULT 50,  -- 0-100

  -- Status
  is_available  INTEGER NOT NULL DEFAULT 1, -- 0/1
  deprecated_at TEXT,                       -- ISO timestamp, null jeśli aktywny

  -- Metadata
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_available ON models(is_available);
```

### 2. `policies` — Polityki routingu

```sql
CREATE TABLE policies (
  id          TEXT PRIMARY KEY,            -- "quality_first_v3"
  name        TEXT NOT NULL,               -- "Quality First v3"
  description TEXT,                        -- "Prioritizes model quality score..."
  version     INTEGER NOT NULL DEFAULT 1,  -- wersjonowanie zmian

  -- Reguły jako JSON
  rules       TEXT NOT NULL,               -- JSON: scoring weights, filters, thresholds
  -- Przykład rules:
  -- {
  --   "weights": { "quality": 0.4, "cost": 0.2, "latency": 0.2, "capability_match": 0.2 },
  --   "hard_filters": ["min_context_window", "required_capabilities"],
  --   "fallback_policy_id": "cheapest_available",
  --   "thresholds": { "min_score": 30 }
  -- }

  -- Scope (do jakich agentów/tasków pasuje)
  applies_to_roles  TEXT DEFAULT '["*"]',  -- JSON array of agent roles, "*" = all
  applies_to_tasks  TEXT DEFAULT '["*"]',  -- JSON array of task types, "*" = all

  is_default  INTEGER NOT NULL DEFAULT 0,  -- 0/1
  is_active   INTEGER NOT NULL DEFAULT 1,  -- 0/1

  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_policies_active ON policies(is_active);
```

### 3. `decisions` — Log decyzji

```sql
CREATE TABLE decisions (
  id              TEXT PRIMARY KEY,        -- "dec_7x9k2"
  request_id      TEXT NOT NULL UNIQUE,    -- "pick_a8f3c" (z orchestratora)
  orchestrator_id TEXT NOT NULL,

  -- Agent
  agent_id        TEXT NOT NULL,
  agent_role      TEXT NOT NULL,
  agent_instance  INTEGER,

  -- Task
  task_type        TEXT NOT NULL,
  task_description TEXT,
  task_priority    TEXT NOT NULL DEFAULT 'normal',

  -- Input constraints (snapshot)
  constraints_json TEXT NOT NULL,           -- pełny JSON constraints z requestu

  -- Wynik
  status           TEXT NOT NULL,           -- "resolved" | "no_match" | "error"
  selected_model   TEXT,                    -- FK → models.id, null jeśli no_match/error
  selected_score   INTEGER,
  policy_used      TEXT,                    -- FK → policies.id

  -- Candidates snapshot (pełny ranking do replay/debug)
  candidates_json  TEXT NOT NULL DEFAULT '[]',

  -- Performance
  selection_latency_ms INTEGER NOT NULL,
  is_fallback          INTEGER NOT NULL DEFAULT 0,
  fallback_reason      TEXT,

  -- Reasoning summary (dla UI)
  reason_summary_json  TEXT DEFAULT '[]',   -- '["high reasoning depth required", ...]'

  -- Timestamps
  requested_at TEXT NOT NULL,               -- timestamp z requestu orchestratora
  decided_at   TEXT NOT NULL,               -- timestamp decyzji pickera
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_decisions_agent ON decisions(agent_id);
CREATE INDEX idx_decisions_agent_role ON decisions(agent_role);
CREATE INDEX idx_decisions_model ON decisions(selected_model);
CREATE INDEX idx_decisions_policy ON decisions(policy_used);
CREATE INDEX idx_decisions_status ON decisions(status);
CREATE INDEX idx_decisions_task_type ON decisions(task_type);
CREATE INDEX idx_decisions_requested_at ON decisions(requested_at);
CREATE INDEX idx_decisions_fallback ON decisions(is_fallback) WHERE is_fallback = 1;
```

### 4. `execution_feedback` — Feedback z orchestratora po wykonaniu

```sql
CREATE TABLE execution_feedback (
  id              TEXT PRIMARY KEY,        -- UUID
  decision_id     TEXT NOT NULL,           -- FK → decisions.id
  request_id      TEXT NOT NULL,           -- FK → decisions.request_id

  -- Faktyczne metryki
  actual_input_tokens   INTEGER,
  actual_output_tokens  INTEGER,
  actual_cost_usd       REAL,
  actual_latency_ms     INTEGER,
  ttft_ms               INTEGER,
  tokens_per_second     REAL,
  finish_reason         TEXT,              -- "stop" | "length" | "tool_calls" | "error"
  success               INTEGER NOT NULL,  -- 0/1

  -- Override (jeśli orchestrator zmienił decyzję pickera)
  was_overridden        INTEGER NOT NULL DEFAULT 0,
  override_model        TEXT,              -- jaki model faktycznie użyto
  override_reason       TEXT,

  -- Error detail
  error_message         TEXT,

  -- Timestamps
  executed_at TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_feedback_decision ON execution_feedback(decision_id);
CREATE INDEX idx_feedback_override ON execution_feedback(was_overridden) WHERE was_overridden = 1;
CREATE INDEX idx_feedback_success ON execution_feedback(success);
```

### 5. `picker_errors` — Log błędów pickera

```sql
CREATE TABLE picker_errors (
  id          TEXT PRIMARY KEY,            -- UUID
  request_id  TEXT,                        -- null jeśli błąd nie dotyczy requestu
  error_type  TEXT NOT NULL,               -- "invalid_payload" | "policy_eval_error" | "stale_registry" | "internal"
  severity    TEXT NOT NULL DEFAULT 'warning', -- "info" | "warning" | "error" | "critical"
  message     TEXT NOT NULL,
  stack_trace TEXT,
  context_json TEXT,                       -- dodatkowy kontekst (np. payload który spowodował błąd)

  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_errors_type ON picker_errors(error_type);
CREATE INDEX idx_errors_severity ON picker_errors(severity);
CREATE INDEX idx_errors_created ON picker_errors(created_at);
```

### 6. `agents_registry` — Znane agenty (budowane dynamicznie)

```sql
CREATE TABLE agents_registry (
  id              TEXT PRIMARY KEY,        -- "agent_researcher_7"
  role            TEXT NOT NULL,           -- "researcher"

  -- Statystyki (aktualizowane inkrementalnie)
  total_decisions      INTEGER NOT NULL DEFAULT 0,
  total_fallbacks      INTEGER NOT NULL DEFAULT 0,
  total_overrides      INTEGER NOT NULL DEFAULT 0,
  avg_selection_latency_ms REAL DEFAULT 0,

  -- Preferencje modeli (JSON, budowane z historii)
  model_distribution_json TEXT DEFAULT '{}', -- '{"openai/gpt-4.1": 0.42, ...}'

  first_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_agents_role ON agents_registry(role);
```

---

## Relacje

```
models ◄──── decisions.selected_model
policies ◄── decisions.policy_used
decisions ◄── execution_feedback.decision_id
decisions ──► picker_errors (via request_id, loosely coupled)
agents_registry ◄── decisions.agent_id (aggregated stats)
```

---

## Widoki / Materialized Queries (dla UI)

### Stats agregowane (dla Top Bar)

```sql
-- Decisions per second (ostatnia minuta)
SELECT COUNT(*) / 60.0 AS decisions_per_second
FROM decisions
WHERE decided_at > datetime('now', '-60 seconds');

-- Fallback rate
SELECT
  ROUND(100.0 * SUM(is_fallback) / COUNT(*), 1) AS fallback_rate_pct
FROM decisions
WHERE decided_at > datetime('now', '-300 seconds');

-- Error count
SELECT COUNT(*) AS error_count
FROM picker_errors
WHERE created_at > datetime('now', '-60 seconds');
```

### Model distribution (dla Live Graph)

```sql
SELECT
  selected_model,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS pct
FROM decisions
WHERE decided_at > datetime('now', '-300 seconds')
  AND status = 'resolved'
GROUP BY selected_model
ORDER BY count DESC;
```

### Agent activity (dla Swarm Overview)

```sql
SELECT
  agent_role,
  COUNT(DISTINCT agent_id) AS instances,
  COUNT(*) AS total_decisions,
  ROUND(AVG(selection_latency_ms), 1) AS avg_latency,
  ROUND(100.0 * SUM(is_fallback) / COUNT(*), 1) AS fallback_pct
FROM decisions
WHERE decided_at > datetime('now', '-300 seconds')
GROUP BY agent_role
ORDER BY total_decisions DESC;
```

### Override tracking (dla Audit)

```sql
SELECT
  d.decision_id,
  d.agent_role,
  d.selected_model AS picker_suggested,
  f.override_model AS actually_used,
  f.override_reason,
  f.executed_at
FROM execution_feedback f
JOIN decisions d ON d.id = f.decision_id
WHERE f.was_overridden = 1
ORDER BY f.executed_at DESC
LIMIT 50;
```

---

## Retencja danych

| Tabela               | Retencja                 | Powód                                   |
| -------------------- | ------------------------ | --------------------------------------- |
| `decisions`          | 7 dni (hot) → archive    | Główny log, potrzebny do replay i debug |
| `execution_feedback` | 7 dni (hot) → archive    | Feedback loop, korelacja z decisions    |
| `picker_errors`      | 30 dni                   | Debugging, rzadsza rotacja              |
| `models`             | Permanent                | Registry, rzadko zmieniane              |
| `policies`           | Permanent (wersjonowane) | Audyt zmian                             |
| `agents_registry`    | Permanent                | Lekkie, rosnące inkrementalnie          |

Archive = osobna tabela `decisions_archive` z tym samym schematem, przenoszone cronem.
