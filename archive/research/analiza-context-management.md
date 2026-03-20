# Analiza: Zarzadzanie Kontekstem i Indeksowanie Kodu

**TASK-002** (Zarzadzanie oknem kontekstowym) + **TASK-007** (Podejscia do indeksowania kodu)
**Status**: KOMPLETNY
**Data**: 2026-03-09
**Zrodla**: Aider (repomap.py, 867 linii), Cline (ContextManager.ts ~650 linii, 5 plikow kontekstu),
Plandex (tell_context.go, tell_summary.go, file_map/map.go, context_helpers_load.go — lacznie ~1560 linii),
OpenCode (provider.ts, session_compact), OpenHands (condenser_config.py, 10 strategii),
Vercel AI SDK (dokumentacja), badania best practices (librarian agent)

---

## Spis tresci

1. [Przeglad problemu](#1-przeglad-problemu)
2. [Analiza per narzedzie](#2-analiza-per-narzedzie)
   - 2.1 Aider — RepoMap + PageRank
   - 2.2 Cline — Truncation + File Dedup
   - 2.3 Plandex — Smart Context + ConvoSummary
   - 2.4 OpenCode — Hybrid + session_compact
   - 2.5 OpenHands — 10 Condenser Strategies
3. [Indeksowanie kodu (TASK-007)](#3-indeksowanie-kodu)
   - 3.1 Aider: tree-sitter + PageRank
   - 3.2 Cline: tree-sitter on-demand
   - 3.3 Plandex: tree-sitter project maps (30+ jezykow)
   - 3.4 Podsumowanie podejsc
4. [Vercel AI SDK — co daje, czego brakuje](#4-vercel-ai-sdk)
5. [Best practices z badan](#5-best-practices)
6. [Rekomendacja dla DiriCode](#6-rekomendacja-dla-diricode)
   - 6.1 Architektura kontekstu
   - 6.2 Schemat SQLite indeksowania
   - 6.3 Budzet tokenow
   - 6.4 Strategia sumaryzacji
   - 6.5 Kontekst sub-agentow
   - 6.6 Triggery odswiezania
7. [Decyzje architektoniczne (ADR candidates)](#7-adr-candidates)

---

## 1. Przeglad problemu

DiriCode musi dzialac z modelami o **bardzo roznych oknach kontekstowych**:
- **GitHub Copilot**: <200k tokenow (primary provider)
- **Kimi**: do 1M tokenow (secondary/fallback)
- **Przyszle modele**: 128k-2M tokenow

To oznacza, ze system musi byc **adaptacyjny** — nie moze zakladac duzego okna.
Glowne wyzwania:
1. **Co wlozyc do kontekstu** — repo map, aktywne pliki, konwersacja, narzedzia
2. **Kiedy przycinac** — truncation vs summarization vs eviction
3. **Jak indeksowac repo** — tree-sitter, embeddingi, graf zaleznosci
4. **Jak dziedzczyc kontekst** miedzy agentami (parent → child)

---

## 2. Analiza per narzedzie

### 2.1 Aider — RepoMap + PageRank

**Plik**: `aider/repomap.py` (867 linii) + `aider/repo.py`
**Licencja**: Apache-2.0 (mozna uzywac z zachowaniem headerow)

#### Ekstrakcja tagow (tree-sitter)
```
Tag = namedtuple("Tag", "rel_fname fname line name kind")
# kind = "def" (definicja) lub "ref" (referencja)
```
- Tree-sitter query per jezyk → captures definitions + references
- Fallback: jesli tree-sitter zwraca TYLKO defs (brak refs) → pygments lexer do backfill refs
- Specjalne pliki priorytetowane przez `filter_important_files()`

#### PageRank — ranking plikow
- **Graf**: pliki jako wezly, krawedzie wazone liczba referencji × mnozniki
- **Mnozniki**:
  - `mentioned_idents` (identyfikatory z chatu): **×10**
  - camelCase/snake_case >= 8 znakow: **×10**
  - `_private` identyfikatory: **×0.1**
  - Pliki z >5 definicjami: **×0.1**
  - `chat_files` (aktywne pliki): **×50**

#### Budzet tokenow
- Domyslny: **1024 tokenow** na repo map
- `map_mul_no_files=8` → **8192 tokenow** gdy brak plikow w chacie
- **Binary search** aby zmiescic mape w budzecie (tolerancja ±15%)
- Tryby odswiezania: `auto`, `always`, `files`, `manual`

#### Cache
- **SQLite-backed diskcache** z mtime tracking (`CACHE_VERSION=4`)
- Klucz: hash pliku → tagi z tree-sitter
- Incremental: zmienione pliki → re-parse tylko ich

#### Format wyjsciowy
```
filename.ts:
  export function handleAuth(req, res)
  class AuthMiddleware
  const TOKEN_EXPIRY
```
Truncated do 100 znakow/linia.

#### Wnioski dla DiriCode
- ✅ PageRank to sprawdzony sposob priorytetyzacji plikow
- ✅ Binary search na budzet tokenow — eleganckie rozwiazanie
- ✅ SQLite cache z mtime — szybki incremental update
- ⚠️ Apache-2.0 — mozemy adaptowac podejscie, zachowac headery przy kopii kodu

---

### 2.2 Cline — Truncation + File Dedup

**Pliki**: `ContextManager.ts` (~650 linii), `context-window-utils.ts`, `FileContextTracker.ts`,
`ModelContextTracker.ts`, `ContextTrackerTypes.ts`
**Licencja**: Apache-2.0

#### Okno kontekstowe — rozmiary uzywalne
```typescript
// getContextWindowInfo() → { contextWindow, maxAllowedSize }
64k  → buffer 27k → max  37k usable
128k → buffer 30k → max  98k usable
200k → buffer 40k → max 160k usable
Default: max(contextWindow - 40k, contextWindow × 0.8)
```

#### Strategia truncation (4-stopniowa)
1. Zachowaj pierwsza pare user-assistant (kontekst zadania)
2. Usun **polowe** srodkowych wiadomosci
3. Jesli dalej za duzo → usun **cwierc** pozostalych
4. Jesli dalej → usun **3/4** pozostalych

#### File Read Deduplication — kluczowy patent
- Tracker sledzi duplikaty `read_file`, `write_to_file`, `replace_in_file`
- Wczesniejsze odczyty zastapione: `"[NOTE: duplicate file read removed]"`
- Jesli oszczednosc **>= 30% znakow** → skip truncation (wystarczy dedup)
- Jesli oszczednosc **< 30%** → dedup + truncation

#### FileContextTracker (chokidar)
- **Chokidar file watchers** wykrywaja zewnetrzne edycje
- Oznacza pliki jako `stale` → agent wie ze kontekst moze byc nieaktualny
- `FileMetadataEntry`: path, size, mtime, isStale

#### ModelContextTracker
- Rejestruje uzycie modeli per task: provider, model, mode, timestamp
- Persistowany na dysk jako JSON
- Wspiera checkpoint restore z timestamp-based truncation

#### Wnioski dla DiriCode
- ✅ File read dedup — oszczedza ~30% kontekstu, latwe do implementacji
- ✅ Buffer sizing per model — rozsadne domyslne wartosci
- ✅ Chokidar watchers — stale detection przydatne
- ⚠️ Truncation strategy jest prosta (usun srodek) — Plandex ma lepsza (sumaryzacja)
- ⚠️ Brak repo map / brak indeksowania — Cline nie wie "co jest w repo"

---

### 2.3 Plandex — Smart Context + ConvoSummary

**Pliki**: `tell_context.go` (~350 linii), `tell_summary.go` (~310 linii),
`file_map/map.go` (528 linii), `context_helpers_load.go` (371 linii)
**Licencja**: MIT (pelna swoboda)

#### Smart Context — per-subtask
```go
// Kazdy subtask ma liste UsesFiles
type ContextPart struct {
    Name     string
    Type     int // ContextFileType, ContextMapType, ContextDirectoryTreeType, ContextImageType
    Content  string
    Tokens   int
}
```
- **Architect** decyduje jakie pliki sa potrzebne per subtask
- Tylko relevantne pliki wysylane do modelu podczas implementacji
- Auto-loading: regex `` `(.+?)` `` → backtick-mentioned files auto-loaded jesli istnieja

#### Token Budget Enforcement
```go
if maxTokens > 0 && totalTokens > maxTokens {
    // stop adding context
}
```
- Pliki pending (w kolejce) pokazuja **tylko rozmiar** (nie zawartosc) — oszczednosc tokenow
- `CacheControl: ephemeral` na ostatniej czesci kontekstu

#### ConvoSummary — inkrementalna sumaryzacja
```go
// Trigger: tokensBeforeConvo + conversationTokens > PlannerEffectiveMaxTokens
// 1. Szukaj istniejacego summary ktore zmiescilby tokeny pod limit
// 2. Jesli brak → generuj nowe summary
// 3. Summary = assistant message, konwersacja PO summary zachowana
// 4. Jesli zaden summary nie wystarczy → ERROR
```
- Summary to wiadomosc asystenta wstawiana ZAMIAST starszej konwersacji
- Konwersacja po summary → zachowana w pelni
- Szukanie istniejacego summary w petli — unikniecie zbednej re-sumaryzacji

#### 4 typy kontekstu
| Typ | Opis |
|-----|------|
| ContextFileType | Zawartosc pliku |
| ContextMapType | Tree-sitter mapa projektu |
| ContextDirectoryTreeType | Drzewo katalogow |
| ContextImageType | Obrazy (screenshoty, diagramy) |

#### Wnioski dla DiriCode
- ✅ **Smart Context per subtask — NAJLEPSZE podejscie** ze wszystkich analizowanych narzedzi
- ✅ ConvoSummary inkrementalna — elegancka alternatywa dla truncation
- ✅ Auto-loading z backtickow — drobny UX ale duzy impact
- ✅ MIT licencja — mozemy swobodnie adoptowac wzorce
- ✅ 4 typy kontekstu — DiriCode powinien miec rowniez formalna typizacje

---

### 2.4 OpenCode — Hybrid + session_compact

**Zrodlo**: Analiza bg agentow + provider.ts + plugin/codex.ts

#### Limity tokenow
```typescript
// plugin/codex.ts
context: 400_000,  // 400k calkowity kontekst
input:   272_000,  // 272k input
output:  128_000   // 128k output
```

#### Hybrid composition
- File + message composition z ripgrep scanning
- File inclusion + tool output serialization
- `session_compact` — automatyczna kompakcja gdy kontekst pelny

#### Sub-agent context
- Parent/child sessions via Session IDs
- Tool results konwertowane na user messages
- Kazdy sub-agent ma wlasny budzet kontekstowy

#### Wnioski dla DiriCode
- ✅ session_compact — przydatne dla dlugich sesji
- ✅ Sub-agent sessions via IDs — zgodne z naszym modelem agentow
- ⚠️ 400k context to duzo — Copilot ma <200k, musimy byc ostrozniejszi

---

### 2.5 OpenHands — 10 Condenser Strategies

**Plik**: `condenser_config.py`
**Licencja**: Mixed (MIT + PolyForm) — tylko non-enterprise czesci

#### 10 strategii kondensacji
| # | Strategia | Opis |
|---|-----------|------|
| 1 | `noop` | Bez zmian |
| 2 | `observation_masking` | Maskowanie obserwacji (zastapienie placeholderem) |
| 3 | `browser_output_masking` | Maskowanie outputu przegladarki |
| 4 | `recent` | Zachowaj N ostatnich wiadomosci |
| 5 | `llm` | LLM generuje summary calej konwersacji |
| 6 | `amortized` | Amortyzowana sumaryzacja (koszt rozlozony w czasie) |
| 7 | `llm_attention` | LLM-based attention — model decyduje co wazne |
| 8 | `structured` | Strukturalna kondensacja (zachowaj kluczowe elementy) |
| 9 | `pipeline` | Pipeline — lancuch condenserow |
| 10 | `conversation_window` | Okno konwersacji (sliding window) |

#### Token counting
- Via `litellm` tokenizer
- Sprawdzanie `model_info['max_input_tokens']`
- Tool serialization: `fn_call_converter.py` konwertuje tool calls ↔ text messages

#### Pipeline pattern
```python
# Lacze wiele condenserow w lancuch:
pipeline = [observation_masking, browser_output_masking, recent]
# Kazdy condenser przetwarza output poprzedniego
```

#### Wnioski dla DiriCode
- ✅ **Pipeline pattern — genialny** — mozna skladac strategie
- ✅ Observation masking — ukrywanie duzych outputow narzedzi
- ✅ Amortized summarization — koszt rozlozony w czasie
- ⚠️ Licencja mieszana — nie kopiujemy kodu, tylko adoptujemy wzorzec
- ⚠️ 10 strategii to za duzo na MVP — wybieram 4-5 najwazniejszych

---

## 3. Indeksowanie kodu (TASK-007)

### 3.1 Aider: tree-sitter + PageRank (REFERENCYJNY)

**Przeplyy**:
1. `get_tags()` → tree-sitter queries per jezyk → Tag(rel_fname, fname, line, name, kind)
2. Budowa grafu: plik → plik (waga = liczba referencji × mnozniki)
3. PageRank na grafie → ranking plikow
4. Binary search: dobor plikow do budzetu tokenow
5. Render: `filename.ts:\n  signature1\n  signature2`

**Cache**: SQLite diskcache, klucz = file hash, wartosc = lista tagow

**Wydajnosc**:
- Progress bar przy budowie mapy
- Incremental: tylko zmienione pliki (mtime check)
- Fallback: pygments lexer gdy tree-sitter nie ma refs

### 3.2 Cline: tree-sitter on-demand (PROSTY)

**Przeplyw**:
1. `listFiles(dirPath, false, 200)` → max 200 plikow
2. `separateFiles()` → filtrowanie po rozszerzeniu, cap **50 plikow**
3. `loadRequiredLanguageParsers(files)` → WASM lazy loading
4. Per plik: `parser.parse(content)` → `query.captures(tree.rootNode)`
5. Filtruj captures z "name" w nazwie → pierwsza linia definicji

**Wsparcie jezykow**: js, jsx, ts, tsx, py, rs, go, c, h, cpp, hpp, cs, rb, java, php, swift, kt

**Brak cache** — TODO w kodzie. Parsery WASM trzymane in-memory.

### 3.3 Plandex: tree-sitter project maps (30+ jezykow)

**Plik**: `syntax/file_map/map.go` (528 linii)

```go
type Definition struct {
    Type      string     // "function", "class", "method", "interface", etc.
    Signature string     // pelna sygnatura
    Line      int
    Children  []Definition  // nested: methods w klasach
}
```

**Przeplyw**:
1. Tree-sitter parse per jezyk (30+ jezykow wsparcia)
2. Ekstrakcja Definition structs z nested children
3. Wsparcie specjalnych formatow: Markdown (headings), HTML (tags), Svelte (components)
4. Output: hierarchiczna mapa projektu

**Cache control**: `CacheControl: ephemeral` na kontekscie mapy

### 3.4 Podsumowanie podejsc do indeksowania

| Aspekt | Aider | Cline | Plandex |
|--------|-------|-------|---------|
| Ekstrakcja | tree-sitter + fallback pygments | tree-sitter only | tree-sitter |
| Ranking | PageRank + mnozniki | brak (flat list) | brak (per-subtask selekcja) |
| Cache | SQLite diskcache | brak (TODO) | ephemeral |
| Jezyki | wiele (rozszerzane) | 17 | 30+ |
| Limit | token budget + binary search | 50 plikow hardcoded | token budget per subtask |
| Nested defs | nie (flat tags) | nie (top-level only) | **tak** (Definition.Children) |
| Licencja | Apache-2.0 | Apache-2.0 | MIT |

---

## 4. Vercel AI SDK — co daje, czego brakuje

### Co JEST w SDK
- `toModelOutput` — kontrola: co widzi model vs co widzi UI
  - **Kluczowe dla sub-agentow**: user widzi pelny output, model widzi summary
- 3 tryby sub-agentow:
  1. **Isolated** — swiezy kontekst (nowy agent)
  2. **With History** — pelna konwersacja przekazana
  3. **Streaming with toModelOutput** — user widzi full, model widzi streszczenie
- Memory providers: Letta, Mem0, Supermemory, Hindsight — lub custom tool

### Czego NIE MA w SDK
- ❌ Brak wbudowanego context windowing
- ❌ Brak token counting
- ❌ Brak truncation / summarization
- ❌ Brak repo map / indeksowania

**Wniosek**: Vercel AI SDK to warstwa transportowa. Cale zarzadzanie kontekstem musi byc w DiriCode.

---

## 5. Best practices z badan

Zebrane z librarian agent + analiza narzedzi:

### 5.1 Co wysylac do modelu
1. **Nie wysylaj pelnych plikow** — sygnatury + on-demand fetch
2. **Graf ranking** — priorytetyzuj huby (PageRank) nad leaf nodes
3. **Cache agresywnie** — system prompt, narzedzia, repo map (niska czestotliwosc zmian)

### 5.2 Sumaryzacja
4. **Sub-agent summarization** — niech eksploracja uzywa 100k, zwroc 1k summary
5. **Inkrementalna** sumaryzacja (Plandex pattern) > truncation (Cline pattern)

### 5.3 Budzety
6. **Adaptive budgets** — rozszerz gdy brak aktywnych plikow, zmniejsz przy edycji
7. **Alokacja budzetu dla 200k okna**:

| Segment | % budzetu | Tokeny (200k) | Tokeny (128k) |
|---------|-----------|---------------|----------------|
| System + tools + repo map | 20-40% | 40-80k | 26-51k |
| Aktywne pliki | 30-50% | 60-100k | 38-64k |
| Konwersacja | 10-20% | 20-40k | 13-26k |
| Rezerwa (output + safety) | 10-20% | 20-40k | 13-26k |

### 5.4 Hybrid retrieval
8. **Tree-sitter** dla precyzji (definicje, importy)
9. **Embeddingi** dla semantyki (opcjonalnie, v2)
10. **Ripgrep** dla full-text search (szybkie, deterministyczne)

---

## 6. Rekomendacja dla DiriCode

### 6.1 Architektura kontekstu — 3 warstwy

```
┌──────────────────────────────────────────────────┐
│ WARSTWA 3: Context Composer (per request)        │
│ - Skladanie finalnego promptu z budzet tokenow   │
│ - Binary search na repo map (Aider pattern)       │
│ - File read dedup (Cline pattern)                 │
│ - Observation masking (OpenHands pattern)          │
├──────────────────────────────────────────────────┤
│ WARSTWA 2: Context Pipeline (per sesja)          │
│ - ConvoSummary inkrementalna (Plandex pattern)    │
│ - session_compact (OpenCode pattern)              │
│ - Pipeline condenserow (OpenHands pattern)         │
│ - Stale file detection (Cline chokidar pattern)   │
├──────────────────────────────────────────────────┤
│ WARSTWA 1: Structural Index (per repo)           │
│ - Tree-sitter symbol extraction                   │
│ - PageRank file ranking (Aider pattern)           │
│ - SQLite persistent cache                         │
│ - Smart Context per subtask (Plandex pattern)     │
└──────────────────────────────────────────────────┘
```

### 6.2 Schemat SQLite indeksowania

```sql
-- Tabela plikow (metadane)
CREATE TABLE files (
    id          INTEGER PRIMARY KEY,
    path        TEXT UNIQUE NOT NULL,
    size        INTEGER NOT NULL,
    mtime       INTEGER NOT NULL,
    git_hash    TEXT,               -- git blob hash (nullable)
    language    TEXT,
    indexed_at  INTEGER NOT NULL,   -- unix timestamp
    parse_error TEXT                 -- null jesli OK
);

-- Tabela symboli (definicje z tree-sitter)
CREATE TABLE symbols (
    id          INTEGER PRIMARY KEY,
    file_id     INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,       -- function, class, method, variable, type, interface
    start_line  INTEGER NOT NULL,
    end_line    INTEGER NOT NULL,
    signature   TEXT,                -- pierwsza linia / sygnatura
    parent_id   INTEGER REFERENCES symbols(id), -- nested defs (Plandex pattern)
    UNIQUE(file_id, name, start_line)
);

-- Tabela importow/eksportow (graf zaleznosci)
CREATE TABLE imports (
    id              INTEGER PRIMARY KEY,
    from_file_id    INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    to_path         TEXT NOT NULL,        -- sciezka docelowa (resolve lazy)
    symbol_name     TEXT,                 -- importowany symbol (nullable = wildcard)
    kind            TEXT NOT NULL DEFAULT 'import'  -- import, require, include
);

-- Tabela rankingu (pre-computed PageRank)
CREATE TABLE file_ranks (
    file_id     INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    pagerank    REAL NOT NULL DEFAULT 0.0,
    ref_count   INTEGER NOT NULL DEFAULT 0,  -- ile razy referencjonowany
    def_count   INTEGER NOT NULL DEFAULT 0,  -- ile definicji
    updated_at  INTEGER NOT NULL
);

-- Indeksy dla szybkich queries
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_file ON symbols(file_id);
CREATE INDEX idx_imports_from ON imports(from_file_id);
CREATE INDEX idx_imports_to ON imports(to_path);
CREATE INDEX idx_file_ranks_pr ON file_ranks(pagerank DESC);

-- FTS5 full-text search na symbolach (opcjonalnie)
CREATE VIRTUAL TABLE symbols_fts USING fts5(name, signature, content=symbols, content_rowid=id);
```

### 6.3 Budzet tokenow — adaptive strategy

```typescript
interface ContextBudget {
    total: number;           // contextWindow modelu
    reserved: number;        // output + safety margin
    usable: number;          // total - reserved

    // Segmenty (adaptacyjne)
    system: number;          // system prompt + tools — STALE (cache)
    repoMap: number;         // repo map — SEMI-STALE (cache per sesja)
    activeFiles: number;     // pliki w edycji — DYNAMICZNE
    conversation: number;    // historia chatu — ROSNIE
}

function computeBudget(contextWindow: number, activeFileCount: number): ContextBudget {
    const reserved = Math.max(contextWindow * 0.15, 20_000);
    const usable = contextWindow - reserved;

    // Adaptive: wiecej na repo map gdy brak aktywnych plikow
    const hasActiveFiles = activeFileCount > 0;
    const repoMapRatio = hasActiveFiles ? 0.2 : 0.4;  // Aider: map_mul_no_files=8
    const activeFilesRatio = hasActiveFiles ? 0.45 : 0.1;
    const conversationRatio = hasActiveFiles ? 0.2 : 0.35;
    const systemRatio = 0.15;

    return {
        total: contextWindow,
        reserved,
        usable,
        system: Math.floor(usable * systemRatio),
        repoMap: Math.floor(usable * repoMapRatio),
        activeFiles: Math.floor(usable * activeFilesRatio),
        conversation: Math.floor(usable * conversationRatio),
    };
}

// Przyklad dla Copilot (200k):
// Z plikami:  system 25.5k, repoMap 34k, activeFiles 76.5k, convo 34k, reserved 30k
// Bez plikow: system 25.5k, repoMap 68k, activeFiles 17k, convo 59.5k, reserved 30k

// Przyklad dla Copilot (128k):
// Z plikami:  system 16.3k, repoMap 21.8k, activeFiles 48.9k, convo 21.8k, reserved 19.2k
```

### 6.4 Strategia sumaryzacji — pipeline

MVP implementuje **3 condensery** w pipeline (z 10 OpenHands):

```typescript
// Pipeline condenserow (OpenHands pattern, uproszczony)
type Condenser = (messages: Message[], budget: number) => Message[];

const defaultPipeline: Condenser[] = [
    // 1. File Read Dedup (Cline pattern)
    // Zastap duplikaty read_file placeholderem
    fileReadDedup,

    // 2. Observation Masking (OpenHands pattern)
    // Zastap duze tool outputs krotkim summary
    observationMasking,

    // 3. ConvoSummary (Plandex pattern)
    // Jesli nadal za duzo → LLM generuje summary starszej czesci konwersacji
    convoSummary,
];

// Trigger: przed kazdym requestem do modelu
// if (estimatedTokens > budget.conversation) { runPipeline(messages, budget); }
```

#### Kolejnosc jest wazna:
1. **fileReadDedup** — tani, deterministyczny, oszczedza ~30%
2. **observationMasking** — tani, ukrywa duze outputy narzedzi
3. **convoSummary** — drogi (LLM call), ale najskuteczniejszy

### 6.5 Kontekst sub-agentow

Wykorzystujac Vercel AI SDK `toModelOutput`:

```typescript
// Agent architekt eksploruje repo (duzy kontekst)
const explorationResult = await agent.run({
    messages: parentContext,
    // ... duzy kontekst, wiele plikow
});

// Sub-agent coder dostaje SUMMARY (maly kontekst)
const coderContext = {
    ...taskContext,
    parentSummary: explorationResult.toModelOutput(),  // 1k zamiast 100k
    usesFiles: architectDecision.usesFiles,  // Plandex Smart Context pattern
};
```

**3 tryby dziedziczenia kontekstu**:
| Tryb | Kiedy | Co przekazujemy |
|------|-------|-----------------|
| **Isolated** | Niezalezne zadanie | Tylko opis zadania + relevant files |
| **Summary** | Kontynuacja pracy | toModelOutput() z parent sesji |
| **Full** | Debugowanie, review | Pelna historia (tylko maly model) |

### 6.6 Triggery odswiezania indeksu

```typescript
interface IndexRefreshConfig {
    // Kiedy odswiezac
    mode: 'auto' | 'on-change' | 'manual';

    // File watcher (chokidar)
    debounceMs: 2000;           // debounce file change events

    // Limity per run
    maxFilesPerBatch: 200;      // max plikow do zaindeksowania na raz
    maxFileSizeBytes: 500_000;  // skip plikow > 500KB (generated code)

    // Wykluczone katalogi
    excludeDirs: ['node_modules', 'vendor', '.git', '.venv', 'build', 'dist',
                  '__pycache__', '.next', '.turbo', 'coverage'];

    // PageRank recompute
    pageRankRecalcInterval: 'on-demand';  // przelicz przy budowie repo map
}
```

**Przeplyw odswiezania**:
1. **Cold start** (pierwsze otwarcie repo):
   - Skan plikow → tabela `files`
   - Batch tree-sitter parse → tabela `symbols` + `imports`
   - PageRank compute → tabela `file_ranks`
   - Estymowany czas: ~5s dla 1000 plikow, ~30s dla 10000 plikow
2. **Incremental** (file change event):
   - Debounce 2s → lista zmienionych plikow
   - Re-parse TYLKO zmienione pliki (mtime check, jak Aider)
   - Update `symbols` + `imports` per plik
   - Lazy PageRank recompute (przy nastepnym uzyciu repo map)
3. **On-demand** (agent potrzebuje repo map):
   - Sprawdz czy cache swiezy (per refresh mode)
   - Jesli nie → incremental update + PageRank + binary search na budzet

---

## 7. Decyzje architektoniczne (ADR candidates)

### ADR-C1: Pipeline condenserow zamiast monolitycznej truncation
- **Decyzja**: Pipeline 3 condenserow (dedup → masking → summary) zamiast jednej strategii truncation
- **Uzasadnienie**: Kazdy condenser jest prosty i testowalny. Pipeline daje elastycznosc.
- **Inspiracja**: OpenHands (pipeline pattern), Cline (dedup), Plandex (summary)

### ADR-C2: SQLite indeks z tree-sitter i PageRank
- **Decyzja**: Persistent SQLite index z tree-sitter symbol extraction + PageRank ranking
- **Uzasadnienie**: Incrementalny, szybki, proven (Aider). SQLite juz jest w stacku DiriCode.
- **Inspiracja**: Aider (PageRank + SQLite cache), Plandex (nested definitions)

### ADR-C3: Adaptive token budgets per model
- **Decyzja**: Budzet tokenow dynamicznie dostosowany do modelu i stanu sesji
- **Uzasadnienie**: Copilot <200k vs Kimi 1M — nie mozna miec jednego budzetu
- **Inspiracja**: Cline (per-model buffer sizing), Aider (map_mul_no_files)

### ADR-C4: Smart Context per subtask (Architect decides files)
- **Decyzja**: Agent architect decyduje jakie pliki potrzebuje kazdy subtask
- **Uzasadnienie**: Najskuteczniejsze podejscie — wysylamy TYLKO to co potrzebne
- **Inspiracja**: Plandex (UsesFiles per subtask, auto-loading z backtickow)
- **Zaleznosc**: Wymaga agenta architect (patrz analiza-plandex-roles.md)

### ADR-C5: toModelOutput() dla sub-agent context inheritance
- **Decyzja**: Sub-agenty dostaja summary (nie pelny kontekst) z parent sesji
- **Uzasadnienie**: Copilot <200k — pelny kontekst sie nie zmiesci. Summary = 1k zamiast 100k.
- **Inspiracja**: Vercel AI SDK (toModelOutput), OpenCode (session_compact)

### ADR-C6: Embeddingi odlozone do v2
- **Decyzja**: MVP bez embedddingow. Tree-sitter + PageRank + ripgrep wystarczy.
- **Uzasadnienie**: Embeddingi wymagaja dodatkowej infry (vector DB), a tree-sitter pokrywa 90% use cases.
- **Plan v2**: Dodac embeddingi per symbol/plik, hnswlib lub SQLite vector extension.

---

## Appendix A: Porownanie strategii kontekstu

| Strategia | Aider | Cline | Plandex | OpenCode | OpenHands |
|-----------|-------|-------|---------|----------|-----------|
| Repo map | ✅ PageRank | ❌ | ✅ tree-sitter | ❌ (ripgrep) | ❌ |
| Token budget | ✅ binary search | ✅ per-model | ✅ per-subtask | ✅ fixed | ✅ litellm |
| Truncation | ❌ | ✅ 4-stopniowa | ❌ | ✅ compact | ✅ window |
| Summarization | ❌ | ❌ | ✅ ConvoSummary | ✅ compact | ✅ LLM condenser |
| File dedup | ❌ | ✅ 30% savings | ❌ | ❌ | ❌ |
| Smart context | ❌ | ❌ | ✅ per subtask | ❌ | ❌ |
| Stale detection | ❌ | ✅ chokidar | ❌ | ❌ | ❌ |
| Pipeline | ❌ | ❌ | ❌ | ❌ | ✅ 10 strategii |
| Sub-agent ctx | ❌ (single agent) | ❌ (single) | ✅ (architect→coder) | ✅ session ID | ✅ (delegator) |
| Cache | ✅ SQLite | ❌ (TODO) | ✅ ephemeral | ✅ | ✅ LRU |

## Appendix B: Wspierane jezyki tree-sitter

### Cline (17 jezykow)
js, jsx, ts, tsx, py, rs, go, c, h, cpp, hpp, cs, rb, java, php, swift, kt

### Plandex (30+ jezykow)
Wszystkie powyzsze + Markdown, HTML, Svelte, Elixir, Erlang, Haskell, Lua, Perl,
Scala, Clojure, Dart, Zig, Nim, OCaml, F#, TOML, YAML, JSON, SQL, Shell/Bash,
Dockerfile, Makefile, i inne

### Rekomendacja DiriCode MVP (20 jezykow)
**Tier 1** (must-have): ts, tsx, js, jsx, py, go, rs, java, cs, rb, php, swift, kt
**Tier 2** (nice-to-have): c, cpp, html, css, sql, shell, dockerfile
**Tier 3** (v2): scala, elixir, haskell, lua, dart, zig, ocaml, markdown, yaml, toml

---

*Dokument zakonczony. Wszystkie dane zebrane z kodu zrodlowego 5 narzedzi + Vercel AI SDK + best practices research.*
*Rekomendacje gotowe do wlaczenia do spec-mvp-diricode.md jako ADR-022 do ADR-027.*
