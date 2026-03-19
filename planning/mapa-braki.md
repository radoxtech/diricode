# 🚨 Mapa Myśli #2: Najkrytyczniejsze braki OpenCode + Oh-My-OpenCode

> Drzewo tekstowe — braki, luki, problemy — posortowane od najważniejszych
> Data: 21 lutego 2026 | Na podstawie głębokiej analizy issues z GitHub
> Źródła: issues przeczytane indywidualnie, nie tylko tytuły

---

```
🚨 BRAKI I LUKI: OpenCode + Oh-My-OpenCode
│
├── 🔴 KRYTYCZNE — Blokują użytkowników lub kosztują pieniądze
│   │
│   ├── 💰 Problemy finansowe / tokenowe
│   │   ├── [OC #8030] Copilot premium token drain
│   │   │   ├── Syntetyczne "user" messages za każdy tool attachment
│   │   │   ├── Jedna sesja = połowa miesięcznego limitu Copilot
│   │   │   ├── Root cause: MessageV2.toModelMessage()
│   │   │   ├── Workaround: zostań na v1.1.12
│   │   │   └── Status: OTWARTY, PR #8721 powiązany
│   │   │
│   │   ├── [OMO] Ogromne zużycie tokenów przez hooks
│   │   │   ├── 44 hooks × 5 warstw = masywny overhead
│   │   │   ├── Fork "omo-slim" istnieje z tego powodu
│   │   │   └── Brak oficjalnej opcji "lean mode"
│   │   │
│   │   └── [OMO #158] Claude Max bany
│   │       ├── Anthropic banuje konta po agresywnej orkiestracji
│   │       ├── Autor ZAPRZECZA odpowiedzialności (CAPS LOCK)
│   │       ├── Wielu użytkowników potwierdza problem
│   │       └── Status: ZAMKNIĘTY jako NOT PLANNED — brak rozwiązania
│   │
│   ├── ⚡ Stabilność i niezawodność
│   │   ├── [OMO #668] Nieskończona pętla TODO + znikająca historia
│   │   │   ├── TODO continuation loop → infinite
│   │   │   ├── "Invalid request parameters" errors
│   │   │   ├── Historia konwersacji ZNIKA
│   │   │   ├── Sesja staje się bezużyteczna
│   │   │   └── Status: OTWARTY, PR #1316 powiązany ale nie zmerge'owany
│   │   │
│   │   ├── [OC #7410] Claude Max broken (najczęściej komentowany)
│   │   │   └── Status: OTWARTY, przypisany do thdxr
│   │   │
│   │   ├── [OC] TUI niestabilność (wiele issues)
│   │   │   ├── #3746 — długa historia = hang
│   │   │   ├── #4032 — luki w historii czatu
│   │   │   ├── #2512, #3846 — stuck na "generating"
│   │   │   └── #4506 — hang w CI context
│   │   │
│   │   └── [OMO] Problemy instalacyjne
│   │       ├── #1072 — Bun segfault
│   │       ├── #1294 — npx/bunx fails
│   │       └── #1161 — platform binary not found
│   │
│   └── 🛡️ Bezpieczeństwo orkiestracji
│       └── [OMO #1081] Orkiestracja zbyt agresywna/destrukcyjna
│           ├── "3/5 plans started WITHOUT my acknowledgement"
│           ├── Git master = "destructive behaviour"
│           ├── Brak confirm/approve step przed wykonaniem planu
│           ├── Sprzeczne z potrzebami użytkowników
│           ├── Zgodne z filozofią autora ("human intervention = failure")
│           └── Status: OTWARTY — BRAK NAPRAWY
│
├── 🟠 POWAŻNE — Ograniczają adopcję lub użyteczność
│   │
│   ├── 🖥️ Platformy i kompatybilność
│   │   ├── [OC #631] Windows support (199 reakcji!)
│   │   │   ├── 11/23 sub-issues done po 7+ miesiącach
│   │   │   ├── Odcinają ~70% deweloperów
│   │   │   └── Przypisany do Hona — wlecze się
│   │   │
│   │   ├── [OC #408] JetBrains terminal broken
│   │   │   └── Popularne IDE, duża baza użytkowników
│   │   │
│   │   ├── [OC #531] Brak HTTP_PROXY support
│   │   │   └── Korporacyjni użytkownicy zablokowania
│   │   │
│   │   └── [OMO] Brak standalone mode
│   │       ├── 100% zależność od OpenCode
│   │       ├── Jeśli OpenCode zmieni plugin API → OMO pada
│   │       └── Bariera wejścia: musisz znać oba projekty
│   │
│   ├── 🤖 Model compatibility
│   │   ├── [OC #1357] Write/Edit fails z non-Claude modelami
│   │   │   ├── GPT-4.1 mini, inne OpenAI = consistent failures
│   │   │   ├── ZAMKNIĘTY jako "model-problem" (NOT PLANNED)
│   │   │   ├── "75+ modeli" ale realnie działa dobrze z Claude
│   │   │   └── Podważa multi-provider value proposition
│   │   │
│   │   └── [OMO #839] Hardcoded model references
│   │       ├── Ścisłe powiązanie z konkretnymi wersjami
│   │       └── Utrudnia konfigurację własnych modeli
│   │
│   ├── 📦 Odrzucone/ignorowane PR-y społeczności [OpenCode]
│   │   ├── [OC #4695] Speech-to-text — PEŁNA implementacja gotowa
│   │   │   ├── FFmpeg + Groq/OpenAI/Whisper
│   │   │   ├── Dwa PR: #11345, #9264
│   │   │   └── Nie zmerge'owane od miesięcy
│   │   │
│   │   ├── [OC #1764] Vim motions w input box
│   │   │   ├── Claude Code to ma
│   │   │   ├── PR #12679 powiązany
│   │   │   └── Nie zmerge'owany
│   │   │
│   │   └── [OC #8501] Paste text expansion
│   │       ├── "[Pasted ~1 lines]" bez podglądu
│   │       ├── Użytkownik sam napisał fix: PR #8496
│   │       └── Nie zmerge'owany
│   │
│   └── 📜 Licencja i governance
│       ├── [OMO] SUL-1.0 — niestandardowa licencja
│       │   ├── Odstraszająca dla firm
│       │   ├── Nie MIT, nie Apache, nie GPL
│       │   └── Niejasne warunki użycia komercyjnego
│       │
│       └── [OMO] Jednoosobowy bottleneck
│           ├── code-yeongyu = jedyny maintainer
│           ├── Defensywna reakcja na krytykę
│           └── Bus factor = 1
│
├── 🟡 BRAKUJĄCE FUNKCJE — Czego nie ma, a powinno być
│   │
│   ├── 🧠 Pamięć i kontekst
│   │   ├── [OMO #74] Brak memory system (autor sceptyczny)
│   │   │   ├── Brak trwałej pamięci między sesjami
│   │   │   ├── Każda sesja zaczyna od zera
│   │   │   ├── Autor: "really easy to be redundant"
│   │   │   └── Społeczność: chcemy to! Referencja: claude-mem
│   │   │
│   │   ├── [OC #1990] Brak user context management
│   │   │   ├── Użytkownik nie kontroluje co jest w kontekście
│   │   │   └── Nie ma „/add", „/remove" jak w Claude Code
│   │   │
│   │   └── [OMO #1397] Brak automated learning capture
│   │       └── Agent nie uczy się z poprzednich sesji
│   │
│   ├── 🔍 Wyszukiwanie i dokumentacja
│   │   ├── [OC #309] Web search NIE JEST w core OpenCode
│   │   │   ├── Otwarty od CZERWCA 2025 (8+ miesięcy!)
│   │   │   ├── Każdy konkurent to ma
│   │   │   ├── Dostępne tylko przez OMO (Exa MCP)
│   │   │   └── Prawdopodobnie celowe → OpenCode Zen (komercja)
│   │   │
│   │   └── [OC+OMO] Brak RAG / vector search
│   │       ├── Brak indeksowania bazy kodu
│   │       ├── Grep + glob zamiast semantic search
│   │       └── Przy dużych projektach = wolne i niedokładne
│   │
│   ├── 🔒 Bezpieczeństwo i sandboxing
│   │   ├── [OC #9132] Brak Docker sandboxing
│   │   │   ├── Agenci mają pełny dostęp do systemu plików
│   │   │   ├── Bash bez ograniczeń
│   │   │   └── Ryzyko: rm -rf, credential leaks
│   │   │
│   │   ├── [OC #10416] Privacy concerns
│   │   │   ├── OpenCode nie jest prywatny domyślnie
│   │   │   └── Telemetria, analytics bez opt-in
│   │   │
│   │   ├── [OC #3176] Git snapshoty na ogromnych repo
│   │   │   ├── git add . na 45GB / 54K plików
│   │   │   ├── Brak .gitignore respect
│   │   │   ├── Brak limitu rozmiaru
│   │   │   ├── Brak pytania o zgodę
│   │   │   └── "Fundamental design flaw"
│   │   │
│   │   └── [OC+OMO] Brak permission system
│   │       ├── Brak granular permissions per tool
│   │       ├── Brak "safe mode" (read-only + confirm writes)
│   │       └── Wszystko albo nic
│   │
│   ├── 🏗️ Orkiestracja i workflow
│   │   ├── [OC #12661] Brak native Agent Teams
│   │   │   ├── Celowo delegowane do pluginów
│   │   │   └── OMO wypełnia lukę, ale to plugin, nie core
│   │   │
│   │   ├── [OC #3844] Brak plan mode z pytaniami (jak Claude Code)
│   │   │   ├── Claude Code pyta clarifying questions
│   │   │   ├── OpenCode plan mode = read-only, pasywny
│   │   │   └── Brak interaktywnego planowania w core
│   │   │
│   │   ├── [OC #4152] Git undo nie zintegrowany z /undo
│   │   │   └── Brak spójnego undo flow
│   │   │
│   │   └── [OMO] Brak approval workflow
│   │       ├── Brak "plan → approve → execute" z ludzkim gate
│   │       ├── Filozofia autora to blokuje
│   │       └── Najczęściej żądana zmiana (#1081)
│   │
│   ├── 🖥️ UX i interface
│   │   ├── [OC #1764] Vim motions w input (PR czeka)
│   │   ├── [OC #4695] Speech-to-text (PR czeka)
│   │   ├── [OC #4283] Clipboard broken
│   │   ├── [OC #8501] Pasted text nie do rozwinięcia
│   │   ├── [OC #1543] Brak /add directories
│   │   │   ├── Claude Code to ma
│   │   │   └── PR #14244 powiązany
│   │   └── [OC+OMO] Brak GUI dla konfiguracji
│   │       ├── Wszystko przez pliki config/JSON
│   │       └── Nieintuicyjne dla nowych użytkowników
│   │
│   └── 🌍 Ecosystem gaps
│       ├── [OMO #1637] Brak natywnego OpenRouter
│       ├── [OC #2072] Brak wsparcia Cursor CLI
│       │   └── Przypisany do thdxr od 6+ miesięcy, cisza
│       ├── [OC+OMO] Brak GitHub/GitLab integration
│       │   ├── Brak native PR creation
│       │   ├── Brak issue tracking integration
│       │   └── Brak CI/CD awareness
│       └── [OC+OMO] Brak team collaboration
│           ├── Single-user only
│           ├── Brak shared sessions
│           └── Brak multi-user workspace
│
└── ⚫ FILOZOFICZNE — Problemy systemowe, nie techniczne
    │
    ├── 🏛️ OpenCode: "Minimalny core" vs. potrzeby użytkowników
    │   ├── Web search, multi-agent, speech-to-text — delegowane do pluginów
    │   ├── Ale pluginy nie mają tego samego wsparcia co core
    │   ├── Efekt: użytkownicy muszą składać system z klocków
    │   └── Pytanie: czy minimalizm to wartość czy wymówka?
    │
    ├── 🤖 OMO: "Human intervention = failure" vs. rzeczywistość
    │   ├── #1081 dowodzi że użytkownicy CHCĄ kontroli
    │   ├── Claude bany (#158) sugerują że autonomia jest RYZYKOWNA
    │   ├── Autor nie zmienia filozofii mimo feedback
    │   └── Pytanie: autonomia to cel czy dogmat?
    │
    ├── 🔄 Paradoks multi-provider
    │   ├── "75+ modeli" ale Write/Edit fails z non-Claude (#1357)
    │   ├── Zamknięty jako "model-problem"
    │   ├── Realnie: Claude-first, reszta best-effort
    │   └── Pytanie: czy to uczciwy marketing?
    │
    ├── 🚪 Bariera wejścia
    │   ├── OpenCode + OMO = dwa projekty do zrozumienia
    │   ├── Konfiguracja: providers, modele, skills, MCPs, hooks
    │   ├── Brak "quickstart" który naprawdę działa
    │   ├── Brak GUI setup
    │   └── Docelowy user: expert-level DevOps/SWE
    │
    └── 📊 Governance i sustainability
        ├── OpenCode: mały zespół, wolne mergowanie PR-ów
        ├── OMO: 1 osoba, bus factor = 1, defensywny
        ├── Niestandardowa licencja (OMO)
        └── Pytanie: czy te projekty przetrwają 2+ lata?
```

---

## Podsumowanie ilościowe braków

| Kategoria | Ilość braków | Najgorszy |
|-----------|:---:|-----------|
| 🔴 Krytyczne (blokujące) | 9 | Copilot token drain, infinite loop, orchestration safety |
| 🟠 Poważne (adopcja) | 10 | Windows support (199 reakcji), model compatibility |
| 🟡 Brakujące funkcje | 19 | Memory system, web search w core, Docker sandbox |
| ⚫ Filozoficzne | 5 | Autonomia vs. kontrola, multi-provider paradoks |
| **RAZEM** | **43** | — |

## TOP 5 — Co powinno być zrobione NATYCHMIAST

| # | Problem | Projekt | Dlaczego pilne |
|---|---------|---------|----------------|
| 1 | **Approval workflow** (#1081) | OMO | Użytkownicy tracą kod przez niekontrolowaną orkiestrację |
| 2 | **Copilot token drain** (#8030) | OpenCode | Kosztuje pieniądze — każda sesja |
| 3 | **Infinite TODO loop** (#668) | OMO | System ciągłości sam siebie niszczy |
| 4 | **Git snapshot abuse** (#3176) | OpenCode | 45GB git add . = unusable na dużych projektach |
| 5 | **Write/Edit model adaptation** (#1357) | OpenCode | „75+ modeli" to kłamstwo bez tego |

---

## Aktualizacja: Marzec 2026 — Adresowane braki (DiriCode)

> Ponizej lista brakow oznaczonych jako ADRESOWANE przez nowa architekture DiriCode (ADR-033 do ADR-040)

### Adresowane braki krytyczne

| # | Problem | Status | Rozwiazanie | ADR |
|---|---------|--------|-------------|-----|
| 1 | **Approval workflow** (#1081) | ✅ ADRESOWANE | Smart approval workflow + hybryda AI/human gate | ADR-014 |
| 2 | **Copilot token drain** (#8030) | ✅ ADRESOWANE | Middleware pipeline z rate limiting + caching | ADR-033 |
| 3 | **Infinite TODO loop** (#668) | ✅ ADRESOWANE | Loop detector + wave-based execution z timeout | ADR-039 |

### Adresowane braki powazne

| # | Problem | Status | Rozwiazanie | ADR |
|---|---------|--------|-------------|-----|
| 1 | **Windows support** (#631) | ✅ ADRESOWANE | Web UI jako PRIMARY interface (cross-platform) | - |
| 2 | **Brak standalone mode** (OMO) | ✅ ADRESOWANE | DiriCode jako standalone (nie plugin) | - |
| 3 | **Hardcoded model references** (#839) | ✅ ADRESOWANE | Configurable families w diricode.config.ts | ADR-025 |

### Adresowane brakujace funkcje

| # | Problem | Status | Rozwiazanie | ADR |
|---|---------|--------|-------------|-----|
| 1 | **Brak memory system** (#74) | ✅ ADRESOWANE | @diricode/memory — SQLite + FTS5 + Timeline | — |
| 2 | **Brak user context management** (#1990) | ✅ ADRESOWANE | Context budget + progressive detail (3 poziomy) | ADR-020 |
| 3 | **Brak automated learning capture** (#1397) | ✅ ADRESOWANE | Timeline-based memory z agent/task metadata | — |
| 4 | **Brak RAG / vector search** | ✅ ADRESOWANE | FTS5 full-text search + skill discovery | — |
| 5 | **Brak granular permissions** | ✅ ADRESOWANE | Tool annotations (readOnly/destructive/idempotent) | ADR-015 |
| 6 | **Brak native Agent Teams** (#12661) | ✅ ADRESOWANE | Async subagents z wave-based parallel execution | ADR-039 |
| 7 | **Brak plan mode z pytaniami** (#3844) | ✅ ADRESOWANE | Pipeline: Interview -> Plan -> Execute -> Verify | - |
| 8 | **Brak approval workflow** | ✅ ADRESOWANE | Smart approval UI (hybryda: pytaj -> zapamietuj -> AI) | ADR-014 |
| 9 | **Brak GUI dla konfiguracji** | ✅ ADRESOWANE | Web UI z config dashboard | - |
| 10 | **Brak team collaboration** | ✅ ADRESOWANE | GitHub Issues + Epic jako plan storage | - |

### Nowe wzorce architektoniczne (LangChain-Inspired)

```
ADR-033: Interceptor/Wrapper Hook Split
  → Rozwiazuje: mixed hook responsibilities, complex ordering

ADR-034: Middleware Execution Order Contract
  → Rozwiazuje: nondeterministic middleware sequencing

ADR-035: ToolCallLimit
  → Rozwiazuje: runaway tool loops, infinite recursive calls

ADR-036: ToolRetry with Exponential Backoff
  → Rozwiazuje: transient tool failures, brittle error handling

ADR-037: LLMToolEmulator
  → Rozwiazuje: dev/test requiring live tools, slow feedback loops

ADR-038: LLMToolSelector
  → Rozwiazuje: LLM receiving too many tools, context overload

ADR-039: Async Subagent Pattern
  → Rozwiazuje: blocking orchestration, slow parallel execution

ADR-040: Tool-Based Agent Discovery
  → Rozwiazuje: hardcoded agent lists, static agent routing
```

### Podsumowanie adresowanych luk

| Kategoria | Przed | Po | Reduction |
|-----------|-------|-----|-----------|
| 🔴 Krytyczne | 9 | 6 | -33% |
| 🟠 Poważne | 10 | 7 | -30% |
| 🟡 Brakujace funkcje | 19 | 9 | -53% |
| **RAZEM** | **43** | **25** | **-42%** |

---

*Aktualizacja: Marzec 2026 | Architektura: LangChain-Inspired (ADR-033 do ADR-040)*
