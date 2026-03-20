# DiriCode — Analiza Prompt Caching (TASK-011)

Data: 2026-03-10
Status: KOMPLETNY
Zrodla: Dokumentacja Anthropic, OpenAI, GitHub Models API, Kimi/Moonshot, Vercel AI SDK, case studies

---

## 1. Podsumowanie wykonawcze

Prompt caching to mechanizm pozwalajacy providierom AI zapamietywac prefix promptu miedzy requestami, co drastycznie redukuje latency (31-79%) i koszty (53-90%). Dla DiriCode — gdzie system prompt, definicje narzedzi i historia konwersacji powtarzaja sie w kazdym turnie — potencjal oszczednosci jest ogromny.

**Glowna rekomendacja**: Prompt caching w **MVP Phase 2** (nie Phase 1). OpenAI cachuje automatycznie (zero kodu). Anthropic wymaga jawnego `cache_control`. GitHub Models API prawdopodobnie propaguje caching providera. Kimi — brak danych.

---

## 2. Wsparcie providerow

### 2.1 Anthropic Claude — jawny cache_control

**Mechanizm**: Jawny parametr `cache_control: { type: "ephemeral" }` na blokach promptu.

**Co mozna cachowac**:
- Definicje narzedzi (caly array `tools`)
- Wiadomosci systemowe
- Wiadomosci tekstowe w konwersacji
- Obrazy i dokumenty
- Tool use i tool results

**Cennik**:

| Model | Cache Write (5m TTL) | Cache Read | Cache Write (1h TTL) |
|-------|---------------------|------------|---------------------|
| Opus 4.6 | $6.25 / MTok | $0.50 / MTok | $10 / MTok |
| Sonnet 4.6 | $3.75 / MTok | $0.30 / MTok | $6 / MTok |
| Haiku 4.5 | $1.25 / MTok | $0.10 / MTok | $2 / MTok |

**Mnozniki wzgledem ceny bazowej input**:
- 5-min cache write: 1.25x ceny bazowej
- 1-hour cache write: 2x ceny bazowej
- Cache read: 0.1x ceny bazowej (**90% rabatu na odczyty**)

**TTL**: Domyslnie 5 minut, opcjonalnie 1 godzina (2x drozsza)

**Minimalna ilosc tokenow do cachowania**:

| Model | Min tokenow |
|-------|-------------|
| Opus 4.6/4.5 | 4096 |
| Sonnet 4.6 | 2048 |
| Sonnet 4.5 i inne | 1024 |
| Haiku 4.5 | 4096 |
| Haiku 3.5 | 2048 |

**Hierarchia cache**: `tools` → `system` → `messages`. Zmiana na wyzszym poziomie invaliduje ten poziom i wszystkie ponizsze.

**Automatyczny caching**: Top-level `cache_control` automatycznie ustawia breakpoint na ostatnim cacheable bloku i przesuwa go do przodu w miarze rozmowy. Wspiera zarowno automatyczny jak i jawny (per-blok) caching.

**Max breakpointow**: 4 jawne cache breakpointy dozwolone.

### 2.2 OpenAI — w pelni automatyczny

**Mechanizm**: Automatyczny dla promptow >= 1024 tokenow. **Nie wymaga zadnych zmian w kodzie.**

**Cennik**: Brak dodatkowych oplat. Cachowane tokeny kosztuja znaczaco mniej (do 90% redukcji kosztow).

**Wspierane modele**: Wszystkie GPT-4o i nowsze.

**Retencja cache**:
- **In-memory**: 5-10 minut nieaktywnosci, max 1 godzina. Dostepne na wszystkich modelach z caching.
- **Extended (24h)**: Dostepne na gpt-5.4, gpt-5.2, gpt-5.1. Uzywa GPU-local storage.

**Kontrola (opcjonalna)**:
- `prompt_cache_key` — wplywa na routing (laczy sie z automatycznym hashem prefiksu)
- `prompt_cache_retention` — `in_memory` (domyslnie) lub `24h`

**Routing cache**: Requesty rutowane na podstawie hasha poczatkowego prefiksu (typowo pierwsze ~256 tokenow). Cache overflow przy >15 req/min dla tego samego prefiksu.

**Co mozna cachowac**:
- Caly array messages
- Obrazy (musza byc identyczne, ten sam `detail`)
- Definicje narzedzi i tool use
- Schematy structured output

### 2.3 GitHub Models API / Copilot

**Status**: ❓ Brak jawnego wsparcia prompt caching wystawionego przez API.

**Hipoteza**: GitHub Models API prawdopodobnie propaguje caching providera ponizej. Poniewaz Copilot integruje Claude i OpenAI, caching najprawdopodobniej dziala automatycznie na poziomie providera, ale nie jest kontrolowalny przez API GitHub.

**Implikacja dla DiriCode**: Przy uzyciu Copilot jako priorytetowego providera (ADR-001), caching moze dzialac "za darmo" od strony OpenAI (automatyczny). Brak mozliwosci jawnego sterowania Anthropic-owym `cache_control` przez GitHub API.

### 2.4 Kimi / Moonshot AI

**Status**: ❓ Brak danych. Dokumentacja niedostepna publicznie (ograniczenia regionalne lub brak udokumentowanego wsparcia caching).

**Rekomendacja**: Skontatkowac sie z Moonshot AI lub sprawdzic ich SDK/API docs pod katem caching zanim zalozymy wsparcie.

### 2.5 Vercel AI SDK

**Status**: ✅ Pass-through — wspiera opcje specyficzne per-provider.

**Mechanizm**: Brak jawnego parametru `cacheControl` w AI SDK Core settings. Ale SDK umozliwia:
- Przekazywanie custom headers do providerow
- Opcje specyficzne per-provider przez model parameter

**Wzorzec uzycia**:
```typescript
// Anthropic — jawny cache_control
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = await generateText({
  model: anthropic('claude-opus-4-6', {
    cache_control: { type: 'ephemeral' },
  }),
  system: stableSystemPrompt,
  tools: stableTools,
  messages: [...messages],
});

// OpenAI — automatyczny, zero kodu
const result = await generateText({
  model: openai('gpt-5.1'),
  system: stableSystemPrompt,
  tools: stableTools,
  messages: [...messages],
});
```

---

## 3. Tabela porownawcza providerow

| Provider | Wsparcie caching | Kontrola | Cennik | TTL | Min tokenow |
|----------|-----------------|----------|--------|-----|-------------|
| **Anthropic Claude** | ✅ Pelne | Jawny + automatyczny | Write 1.25-2x, Read 0.1x | 5m / 1h | 1K-4K |
| **OpenAI** | ✅ Automatyczny | Brak (opcj. headers) | Wliczony, bez oplat | 5m-1h / 24h | 1024 |
| **GitHub Models API** | ❓ Propagacja | Brak | Zalezy od providera | Zalezy od providera | Zalezy od providera |
| **Kimi / Moonshot** | ❓ Brak danych | Brak danych | Brak danych | Brak danych | Brak danych |
| **Vercel AI SDK** | ✅ Pass-through | Per-provider | Per-provider | Per-provider | Per-provider |

---

## 4. Benchmarki oszczednosci (dane rzeczywiste)

### 4.1 Benchmarki Anthropic

| Przypadek uzycia | Latency (bez cache) | Latency (z cache) | Redukcja latency | Redukcja kosztow |
|-------------------|--------------------|--------------------|-----------------|-----------------|
| Chat z ksiazka (100K tokenow) | 11.5s | 2.4s | **-79%** | **-90%** |
| Many-shot prompting (10K tok.) | 1.6s | 1.1s | **-31%** | **-86%** |
| Multi-turn konwersacja (10 turnow, dlugi system) | ~10s | ~2.5s | **-75%** | **-53%** |

### 4.2 Szacowane oszczednosci dla coding agenta (DiriCode)

**Typowy profil sesji agenta:**
- System prompt: ~5K tokenow (instrukcje agenta)
- Definicje narzedzi: ~15K tokenow (20-30 narzedzi z Zod schematami)
- Przyklady / kontekst: ~5K tokenow (few-shot, struktura repo)
- **Lacznie cacheable**: ~25K tokenow (zapis raz, odczyt wielokrotnie)

**Profil sesji (20 turnow):**
- Turn 1: Write 25K (cache) + 2K dynamiczny = 27K
- Turny 2-20: Read 25K (cached) + 2K dynamiczny = 27K kazdy
- **Bez caching**: 27K x 20 = 540K tokenow input
- **Z caching**: 27K x 1 (write) + 27K x 19 (read ze znizka) = znacznie mniej

**Porownanie kosztow (Claude Sonnet 4.6 @ $3/MTok input):**

| Scenariusz | Koszt input | Oszczednosc |
|------------|-------------|-------------|
| Bez caching | $1.62 | — |
| Claude caching | $0.20 | **58%** |
| OpenAI caching (szac. 80% cached) | $0.32 | **53%** |

**Latency**: 31-79% szybszy time-to-first-token wg benchmarkow Anthropic.

---

## 5. Wplyw na architekture DiriCode

### 5.1 Wymagana kolejnosc konstrukcji promptu

**KRYTYCZNE**: Statyczna tresc na poczatku — prefix matching wymaga stalego prefiksu.

```
PRAWIDLOWA KOLEJNOSC:
1. Tools (definicje) ← najbardziej statyczne
2. System prompt ← wzglednie statyczne
3. Messages ← najbardziej dynamiczne
   a. Wczesniejsze wiadomosci (bardziej statyczne)
   b. Najnowsza wiadomosc uzytkownika (najbardziej dynamiczna)
```

**Anthropic**: Zmiana na wyzszym poziomie (np. tools) invaliduje cache na tym i wszystkich nizszych poziomach (system, messages).

**OpenAI**: Automatyczny prefix matching — nie wymaga specjalnej kolejnosci, ale statyczna tresc na poczatku pomaga.

### 5.2 Konflikty z dynamiczna injekcja kontekstu

| Konflikt | Opis | Mitigacja |
|----------|------|-----------|
| Injected code snippets w system prompt | Zmiana snippetu invaliduje cache | Trzymac dynamiczna tresc **po** cache breakpointcie |
| Przelaczanie narzedzi | Wlaczanie/wylaczanie narzedzi invaliduje cache na poziomie tools | Partycjonowac: stale narzedzia (cached) + warunkowe (po breakpointcie) |
| Feature flags | Zmiana flag w system prompt invaliduje cache | Uzywac stalego system prompt + osobnej wiadomosci z flagami |
| Kontekst per-user | Wstawiony przed cached content lamie prefix matching | Zawsze dodawac user context po granicy cache |

### 5.3 Kompatybilnosc z ADR-ami DiriCode

| ADR | Wplyw prompt caching | Uwagi |
|-----|---------------------|-------|
| ADR-022 (Pipeline Condenserow) | ✅ Pozytywny — skondensowany kontekst jest stabilniejszy = lepsze cache hity | ConvoSummary produkuje stale bloki |
| ADR-023 (SQLite Indeks) | ✅ Neutralny — repo map generowany z indeksu jest stabilny | Repo map cacheable |
| ADR-024 (Smart Context per Subtask) | ⚠️ Potencjalny problem — rozne subtaski maja rozne usesFiles | Kazdy subtask invaliduje messages cache |
| ADR-025 (Sub-Agent Context Inheritance) | ⚠️ Zalezy od trybu — Isolated/Summary generuje nowy kontekst | Full mode zachowuje prefix |
| ADR-026 (AgentConfig z 4 Fallbackami) | ✅ Neutralny — fallback zmienia model, nie prompt | Cache na poziomie providera |
| ADR-027 (Embeddingi Odlozone) | ✅ Neutralny — brak embedddingow nie wplywa na caching | — |

### 5.4 Wymagania architektoniczne na Phase 2

1. **Warstwa abstrakcji providera**: Wsparcie opcji per-provider (Anthropic `cache_control`, OpenAI `prompt_cache_key`)
2. **System kolejnosci promptu**: Wymuszenie tools → system → messages z dynamiczna trescia na koncu
3. **Umieszczanie cache breakpointow**: Dla Anthropic — wsparcie automatycznego caching + opcjonalnych jawnych breakpointow
4. **Sledzenie zuzycia**: Przechwytywanie `cache_read_input_tokens`, `cache_creation_input_tokens` (Anthropic) lub `prompt_tokens_details.cached_tokens` (OpenAI) dla analityki
5. **Konfigurowalny TTL cache**: Wsparcie 5m vs 1h dla Anthropic
6. **Strategia injekcji user context**: Zdefiniowac policy — dynamiczna tresc zawsze po granicy cache

---

## 6. Rekomendacja: ktory MVP?

### Rekomendacja: **MVP Phase 2** (nie Phase 1)

#### Dlaczego NIE w Phase 1:
1. **Zlozonosc budowy**: Cache-aware prompt construction dodaje zlozonosc do architektury DiriCode
2. **Ograniczone poczatkowe sesje**: Wczesni uzytkownicy maja krotsze sesje — benefit caching minimalny
3. **OpenAI automatyczny caching**: GitHub Models API (przez OpenAI) juz cachuje automatycznie za darmo
4. **Fokus na core agent**: Phase 1 powinna walidowac ze agent w ogole dziala niezawodnie

#### Dlaczego w Phase 2:
1. **58% oszczednosci kosztow**: Znaczacy wplyw finansowy gdy uzytkownicy skaluja
2. **Przewaga konkurencyjna**: Wiekszosc agentow nie optymalizuje pod caching
3. **Claude prawdopodobny**: Wsparcie Kimi niepewne; jawny caching Claude daje przewidywalne oszczednosci
4. **Warstwa abstrakcji providera**: Phase 2 powinna budowac wlasciwa abstrakcje providera z `cache_control` pass-through

#### Dlaczego NIE pozniej niz Phase 2:
1. **PERF-001** (zelazna wytyczna uzytkownika): "Jesli prompt caching oszczedza mocno tokeny, musi byc w ktoryrms z MVP"
2. **58% oszczednosci** = "oszczedza mocno" ✅
3. **Architektura wplywana**: Im pozniej, tym trudniej przebudowac kolejnosc promptow

---

## 7. Strategia wdrozenia (Phase 2)

### Krok 1: Audit promptu
- Zidentyfikowac wszystkie statyczne vs dynamiczne czesci promptu
- Zmierzyc ile tokenow jest cacheable

### Krok 2: Refaktor kolejnosci
- Wymusic tools → system → messages → dynamic context
- Dodac interfejs `PromptBuilder` z jawna segregacja statyczna/dynamiczna

### Krok 3: Provider adaptery
- Anthropic adapter: dodac `cache_control: { type: "ephemeral" }` do statycznych blokow
- OpenAI adapter: brak zmian (automatyczny caching)
- GitHub Models: testowac czy propaguje caching

### Krok 4: Metryki
- Dodac sledzenie cache hit/miss per request
- Dashboard: cache_read_tokens / total_input_tokens = cache hit ratio
- Alert jezeli ratio < 50% (cos invaliduje cache)

### Krok 5: Optymalizacja
- Testowac 5m vs 1h TTL (Anthropic) — koszt vs hit ratio
- Profil sesji: mierzyc typowe interakcje i optymalizowac breakpointy

---

## 8. Podsumowanie decyzji

| Pytanie | Odpowiedz |
|---------|-----------|
| Ktory provider wspiera caching? | Anthropic (jawny), OpenAI (automatyczny), GitHub (prawdopodobnie propaguje) |
| Ile mozna zaoszczedzic? | 53-90% kosztow, 31-79% latency |
| W ktorym MVP? | **Phase 2** (spelnia PERF-001 "musi byc w MVP") |
| Co wymaga zmian architektonicznych? | Kolejnosc promptu, warstwa abstrakcji providera, metryki |
| Czy Kimi wspiera? | Brak danych — nie zakladamy wsparcia |
| Czy wplywa na kontekst dziedziczony? | Tak — ADR-024 (Smart Context) moze invalidowac cache czesciej |

---

## Zrodla

- Anthropic Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Anthropic Pricing: https://www.anthropic.com/pricing#api
- Anthropic Blog: https://claude.com/blog/prompt-caching
- OpenAI Prompt Caching: https://platform.openai.com/docs/guides/prompt-caching
- GitHub Copilot: https://github.com/features/copilot
- GitHub Changelog: https://github.blog/changelog/
- Vercel AI SDK Settings: https://sdk.vercel.ai/docs/ai-sdk-core/settings
