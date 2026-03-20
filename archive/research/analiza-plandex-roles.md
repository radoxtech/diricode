# Analiza Plandex Roles -> DiriCode Agents (TASK-012)

Status: KOMPLETNY
Data: 2026-03-09
Zrodlo: analiza kodu Plandex (MIT license) — app/shared/, app/server/model/

---

## 1. Lista rol Plandex (kanoniczne definicje)

Zrodlo: `app/shared/ai_models_roles.go`

| ModelRole | Opis | Odpowiednik DiriCode |
|-----------|------|---------------------|
| **planner** | "replies to prompts and makes plans" | planner-thorough / planner-quick |
| **coder** | "writes code to implement a plan" | coder |
| **architect** | "makes high level plan and decides what context to load using codebase map" | **BRAK — DO DODANIA** |
| **plan_summary** (summarizer) | "summarizes conversations exceeding max-convo-tokens" | **BRAK — DO DODANIA** |
| **builder** | "builds a plan into file diffs" | (czesciowo coder) |
| **whole-file-builder** | "builds a plan into file diffs by writing the entire file" | (czesciowo coder) |
| **names** | "names plans" | **BRAK — nisko priorytetowy** |
| **commit-messages** | "writes commit messages" | **BRAK — DO DODANIA** |
| **exec-status** (auto-continue) | "determines whether to auto-continue" | **BRAK — DO DODANIA** |

---

## 2. Architektura ModelRoleConfig w Plandex

### 2.1 Struktura konfiguracji per-rola

Zrodlo: `app/shared/ai_models_data_models.go`

```
ModelRoleConfig {
  Role:                  ModelRole          // np. "planner", "coder"
  ModelId:               string             // np. "anthropic/claude-sonnet-4"
  LargeContextFallback:  *ModelRoleConfig   // fallback gdy context za duzy
  LargeOutputFallback:   *ModelRoleConfig   // fallback gdy output za duzy
  ErrorFallback:         *ModelRoleConfig    // fallback na blad (rate limit, provider down)
  StrongModel:           *ModelRoleConfig    // eskalacja do mocniejszego modelu
  Provider:              ProviderConfig      // provider + auth vars
}
```

Kluczowe cechy:
- **Rekurencyjna struktura**: Kazdy fallback jest sam ModelRoleConfig — mozna laczyc w lancuchy
- **4 typy fallbackow**: LargeContext, LargeOutput, Error, StrongModel
- **Provider fallback**: `GetProvidersForAuthVars()` wybiera providera na podstawie dostepnych kluczy API
- JSON Schema walidacji: `app/cli/schema/json-schemas/model-role-config.schema.json`

### 2.2 Model Packs (domyslne mapowania)

Zrodlo: `app/shared/ai_models_packs.go`

Model Pack = nazwany profil mapujacy kazda role na konkretny model + fallbacki.

Przyklad struktury:
```
Pack "default" {
  planner    -> claude-sonnet-4 (fallback: gpt-4.1)
  coder      -> claude-sonnet-4 (fallback: gpt-4.1)
  architect  -> claude-sonnet-4 (fallback: gpt-4.1)
  builder    -> claude-sonnet-4 (fallback: gpt-4.1)
  summarizer -> gpt-4.1-mini   (tani model, duzo tokenow)
  namer      -> gpt-4.1-mini
  commit-msg -> gpt-4.1-mini
  exec-status-> gpt-4.1-mini
}
```

Uzytkownik moze:
- Wybrac gotowy pack
- Nadpisac model per rola
- Zdefiniowac wlasne fallbacki

### 2.3 Dynamiczny dobor modelu

Zrodlo: `app/shared/ai_models_large_context.go`

```
GetRoleForInputTokens(role, inputTokens) -> ModelRoleConfig
GetRoleForOutputTokens(role, outputTokens) -> ModelRoleConfig
```

Logika:
1. Sprawdz czy inputTokens > model.maxInputTokens
2. Jesli tak -> uzyj LargeContextFallback (model z wiekszym oknem)
3. Sprawdz czy outputTokens > model.maxOutputTokens
4. Jesli tak -> uzyj LargeOutputFallback
5. Na bledzie -> uzyj ErrorFallback
6. Na zadanie eskalacji -> uzyj StrongModel

---

## 3. Delegacja miedzy rolami w Plandex

### 3.1 Przepyw planu (orkestracja)

```
                    ┌─────────────┐
                    │   Planner   │  Generuje subtaski
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Architect  │  Decyduje co zaladowac do kontekstu
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐  ┌─▼──────┐  ┌──▼──────────────┐
       │   Builder   │  │ Coder  │  │WholeFileBuilder  │
       │ (diff edits)│  │        │  │ (pelne pliki)    │
       └─────────────┘  └────────┘  └──────────────────┘
              │
     ┌────────┼─────────┐
     │        │         │
  ┌──▼──┐  ┌─▼────┐  ┌─▼──────────┐
  │Namer│  │Commit│  │ExecStatus  │
  │     │  │ Msg  │  │(kontynuuj?)│
  └─────┘  └──────┘  └────────────┘
```

### 3.2 Mechanizm delegacji

Zrodlo: `app/server/model/plan/tell_exec.go`, `tell_stream_processor.go`

1. **Nie ma osobnych procesow** — serwer orkestruje sekwencje wywolan modelu
2. Kazde wywolanie = zmiana `ModelRoleConfig` (inna rola = inny model + prompt)
3. Wyniki przekazywane przez struktury danych w pipeline'ie:
   - Planner -> subtaski (parsowane przez `model/parse/subtasks.go`)
   - Architect -> lista plikow do zaladowania (z backtickow w odpowiedzi)
   - Builder -> diff/structured edits (parsowane przez `server/syntax/`)
   - Summarizer -> streszczenie konwersacji (wstawiane jako assistant message)

### 3.3 Auto-loading kontekstu przez Architect

Zrodlo: `app/server/model/plan/tell_context.go` — `checkAutoLoadContext()`

Architect wymienia pliki w backtickach, serwer:
1. Parsuje regex: `` `(.+?)` ``
2. Sprawdza czy sciezka istnieje w projekcie (`req.ProjectPaths[trimmed]`)
3. Laduje nowe pliki automatycznie (`toAutoLoad`)
4. Aktywuje istniejace pliki (`toActivate`) — przenosi na poczatek kontekstu

---

## 4. Prompty per rola

Zrodlo: `app/server/model/prompts/`

| Plik | Rola | Zawartosc |
|------|------|-----------|
| `planning.go` | planner | System prompt, instrukcje planowania, format ### Tasks |
| `implement.go` | coder | Instrukcje implementacji, wymagania diff format |
| `architect_context.go` | architect | Instrukcje doboru kontekstu, format backtickow |
| `file_ops.go` | builder | Format operacji plikowych, expected output |
| `build_whole_file.go` | whole-file-builder | Instrukcje budowania pelnych plikow |
| `summary.go` | summarizer | Instrukcje streszczania konwersacji |

Skladanie promptow: `app/server/model/plan/tell_sys_prompt.go`
- System message = bazowy prompt roli + kontekst projektu + instrukcje stage'a
- Kazda rola dostaje inny system prompt

---

## 5. Smart Context per rola

Zrodlo: `app/server/model/plan/tell_context.go` — `formatModelContext()`

Kluczowa logika:
- **Smart Context** = w fazie implementacji, kazdy subtask ma liste `UsesFiles`
- Jesli smartContext wlaczony, do modelu ida TYLKO pliki z `UsesFiles`
- W fazie context (architect) — pliki pending pokazuja tylko rozmiar tokenow, nie tresc
- Limitowanie tokenow: `maxTokens > 0 && totalTokens > maxTokens` -> przerywa dodawanie

Typy kontekstu:
- `ContextFileType` — pelny plik zrodlowy
- `ContextMapType` — mapa projektu (tree-sitter signatures)
- `ContextDirectoryTreeType` — drzewo katalogow
- `ContextImageType` — obrazy (multimodal)

---

## 6. Conversation Summarization (ConvoSummary)

Zrodlo: `app/server/model/plan/tell_summary.go`

Proces:
1. Zlicz tokeny konwersacji (`conversationTokens`)
2. Sprawdz limit: `tokensBeforeConvo + conversationTokens > PlannerEffectiveMaxTokens`
3. Jesli przekroczony -> szukaj istniejacego summary ktore redukuje tokeny ponizej limitu
4. Jesli summary nie wystarczy -> BLAD ("couldn't get under token limit")
5. Summary wstawiane jako assistant message, konwersacja po summary zachowana

Kluczowe stale:
- `GetPlannerMaxConvoTokens()` — limit na sama konwersacje
- `GetPlannerEffectiveMaxTokens()` — limit calkowity (convo + context)
- Summary generowane przez dedykowany model (rola `plan_summary`, zwykle tani model)

Incremental summarization:
- Nowe summary budowane na bazie poprzedniego summary + nowe wiadomosci
- `LatestConvoMessageId` i `LatestConvoMessageCreatedAt` trackuja punkt odciecia
- Summary przechowywane w DB — mozna wrócic do dowolnego punktu

---

## 7. Mapowanie Plandex Roles -> DiriCode Agents

### 7.1 Istniejace agenty DiriCode (ze spec)

| Agent DiriCode | Odpowiednik Plandex | Status |
|----------------|---------------------|--------|
| coder | coder + builder + whole-file-builder | ✅ OK, ale rozwazyc 2 tryby |
| planner-thorough | planner | ✅ OK |
| planner-quick | planner (tani model) | ✅ OK |
| code-reviewer-thorough | **BRAK w Plandex** | ✅ Przewaga DiriCode |
| code-reviewer-quick | **BRAK w Plandex** | ✅ Przewaga DiriCode |
| explorer | czesciowo architect | ✅ OK, ale rozszerzyc |
| project-builder | — | ✅ OK |
| verifier + runner | czesciowo exec-status | ✅ OK, ale rozszerzyc |
| dispatcher | server orchestrator | ✅ OK |
| tester (POC 2) | **BRAK w Plandex** | ✅ Przewaga DiriCode |
| doc-writer (POC 3) | **BRAK w Plandex** | ✅ Przewaga DiriCode |

### 7.2 Brakujace agenty — rekomendacje z Plandex

| Nowy agent DiriCode | Inspiracja Plandex | Priorytet | Uzasadnienie |
|---------------------|-------------------|-----------|--------------|
| **architect** | architect role | WYSOKI | Kluczowy dla smart context — decyduje co zaladowac. Explorer pokrywa szukanie, ale architect = strategiczny dobor kontekstu dla konkretnego zadania. |
| **summarizer** | plan_summary role | WYSOKI | Krytyczny dla waskich okien kontekstowych (Copilot <200k). Potrzebny od MVP. |
| **commit-writer** | commit-messages role | SREDNI | Automatyczne commit messages. Maly agent, duzy UX impact. |
| **exec-decision** | exec-status role | SREDNI | Decyzja "kontynuowac autonomicznie?" — wazne dla guardrails. |
| **namer** | names role | NISKI | Automatyczne nazwy sesji/planow. Nice-to-have. |

### 7.3 Ulepszenia istniejacych agentow

1. **coder** — dodac 2 tryby edycji:
   - `structured-edit` (diff-based, jak Plandex builder)
   - `whole-file` (pelne nadpisanie, jak Plandex whole-file-builder)
   - Tryb wybierany automatycznie na podstawie rozmiaru zmian

2. **explorer** — rozszerzyc o funkcje architect:
   - Nie tylko "szukaj", ale "zdecyduj co zaladowac do kontekstu"
   - Smart context: per-subtask lista plikow (`UsesFiles`)

3. **verifier + runner** — polaczyc z exec-decision:
   - Po weryfikacji: decyzja "kontynuowac?" (jak exec-status)
   - Wynik: continue / stop / ask-user

---

## 8. Rekomendacje architektoniczne dla DiriCode

### 8.1 AgentConfig (odpowiednik ModelRoleConfig)

```typescript
interface AgentConfig {
  agent: AgentType;           // "planner-thorough", "coder", "architect" ...
  modelId: string;            // "copilot/gpt-4.1", "kimi/moonshot-v1"
  fallbacks: {
    largeContext?: AgentConfig;   // za duzy context -> inny model
    largeOutput?: AgentConfig;    // za duzy output -> inny model
    error?: AgentConfig;          // blad providera -> fallback
    strong?: AgentConfig;         // eskalacja do mocniejszego
  };
}
```

### 8.2 Family Packs (odpowiednik Model Packs)

```typescript
interface FamilyPack {
  name: string;               // "copilot-default", "kimi-budget"
  agents: Record<AgentType, AgentConfig>;
}
```

Kazda Family = gotowy pack z domyslnymi modelami per agent.

### 8.3 Orkestracja (odpowiednik tell_exec.go)

- **Dispatcher** = odpowiednik Plandex server orchestrator
- Sekwencja: planner -> architect -> coder/builder -> verifier
- Kazdy krok = wywolanie z innym AgentConfig (inny model + prompt)
- Wyniki przekazywane przez pipeline (structured data, nie raw text)

### 8.4 Prompt per agent

Struktura katalogow:
```
src/agents/prompts/
  planner-thorough.ts
  planner-quick.ts
  coder.ts
  architect.ts
  summarizer.ts
  code-reviewer-thorough.ts
  code-reviewer-quick.ts
  ...
```

System message assembler (jak `tell_sys_prompt.go`):
```typescript
function buildSystemMessage(agent: AgentType, context: TaskContext): string {
  const basePrompt = agentPrompts[agent];
  const contextInfo = formatContext(context);
  const stageInstructions = getStageInstructions(context.stage);
  return [basePrompt, contextInfo, stageInstructions].join('\n\n');
}
```

---

## 9. Kluczowe pliki Plandex do referencji

| Plik | Zawartosc |
|------|-----------|
| `app/shared/ai_models_roles.go` | Kanoniczne definicje rol |
| `app/shared/ai_models_data_models.go` | ModelRoleConfig, fallback fields |
| `app/shared/ai_models_packs.go` | Model Pack presets |
| `app/shared/ai_models_large_context.go` | Token-aware role resolution |
| `app/shared/ai_models_errors.go` | Error-based fallback |
| `app/server/model/plan/tell_exec.go` | Orkestracja planow |
| `app/server/model/plan/tell_context.go` | Smart context, auto-loading |
| `app/server/model/plan/tell_summary.go` | ConvoSummary — incremental summarization |
| `app/server/model/plan/tell_sys_prompt.go` | Skladanie system promptow |
| `app/server/model/prompts/*.go` | Prompty per rola |
| `app/server/model/parse/subtasks.go` | Parsowanie subtaskow z planera |
| `app/server/syntax/file_map/map.go` | Tree-sitter project maps |
| `app/server/db/context_helpers_load.go` | Ladowanie kontekstu z limitami tokenow |

---

## 10. Podsumowanie decyzji

| Decyzja | Wybor | Uzasadnienie |
|---------|-------|--------------|
| Architect agent | DODAC do MVP | Krytyczny dla smart context i waskich okien |
| Summarizer agent | DODAC do MVP | Copilot ma <200k — bez summarizera sie nie obejdzie |
| Commit-writer | DODAC do MVP | Maly koszt, duzy UX impact |
| Exec-decision | POC 2 | Nie krytyczny dla MVP, ale wazny dla autonomii |
| Namer | POC 3 | Nice-to-have |
| 2 tryby edycji (coder) | MVP | Structured-edit + whole-file jak Plandex |
| AgentConfig z fallbackami | MVP | Odpowiednik ModelRoleConfig — kluczowe dla routera |
| Family Packs | MVP | Domyslne mapowania per family |
| Prompt per agent | MVP | Osobne pliki, assembler w runtime |
