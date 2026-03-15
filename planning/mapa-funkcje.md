# 🗺️ Mapa Myśli #1: Funkcje OpenCode + Oh-My-OpenCode (Połączone)

> Drzewo tekstowe — pełna mapa funkcji obu narzędzi działających razem
> Data: 21 lutego 2026 | OpenCode v1.2.10 + OMO v3.7.4

---

```
🏠 OpenCode + Oh-My-OpenCode
│
├── 🔌 WARSTWA INFRASTRUKTURY [OpenCode]
│   │
│   ├── 🤖 Multi-Provider AI
│   │   ├── Anthropic (Claude 3.5/4/Opus/Sonnet/Haiku)
│   │   ├── OpenAI (GPT-4o/4.1/o1/o3)
│   │   ├── Google (Gemini 2.0/2.5 Pro/Flash)
│   │   ├── Groq (Llama, Mixtral — szybkie)
│   │   ├── Fireworks AI
│   │   ├── Ollama (modele lokalne)
│   │   ├── OpenRouter (agregator)
│   │   ├── Azure OpenAI
│   │   ├── AWS Bedrock
│   │   ├── GitHub Copilot (⚠️ bug: premium token drain #8030)
│   │   └── OpenCode Zen (managed access — komercyjny)
│   │
│   ├── 🏗️ Architektura Klient-Serwer
│   │   ├── Serwer utrzymuje stan sesji
│   │   ├── Odporność na rozłączenia (reconnect)
│   │   ├── Wielokrotne frontendy (TUI, Desktop, VS Code)
│   │   └── Leniwa inicjalizacja (lazy loading)
│   │
│   ├── 🖥️ Interfejsy użytkownika
│   │   ├── TUI (Terminal UI — główny)
│   │   │   ├── Bubble Tea framework
│   │   │   ├── Markdown rendering (glamour)
│   │   │   ├── Compact/verbose mode
│   │   │   └── ⚠️ Problemy stabilności (hang, stuck, gaps)
│   │   ├── Desktop App (beta)
│   │   │   ├── macOS
│   │   │   ├── Linux
│   │   │   └── Windows (⚠️ bardzo wczesne)
│   │   └── VS Code Extension SDK
│   │
│   ├── 🧰 Narzędzia bazowe (8 wbudowanych)
│   │   ├── Read — odczyt plików/katalogów
│   │   ├── Write — zapis plików (overwrite)
│   │   ├── Edit — podmiana stringów w plikach
│   │   ├── Bash — wykonywanie komend shell
│   │   ├── Glob — wyszukiwanie plików po wzorcu
│   │   ├── Grep — przeszukiwanie treści plików
│   │   ├── WebFetch — pobieranie treści z URL
│   │   └── LS — listowanie katalogów
│   │
│   ├── 🔬 LSP (Language Server Protocol)
│   │   ├── lsp_goto_definition — skocz do definicji
│   │   ├── lsp_find_references — znajdź wszystkie użycia
│   │   ├── lsp_rename — rename w całym workspace
│   │   ├── lsp_prepare_rename — walidacja przed rename
│   │   ├── lsp_symbols — symbole w pliku/workspace
│   │   └── lsp_diagnostics — błędy/ostrzeżenia
│   │
│   ├── 📸 Snapshot/Worktree
│   │   ├── Automatyczne snapshoty przed zmianami
│   │   ├── Rollback do poprzedniego stanu
│   │   └── ⚠️ Git abuse na dużych repo (#3176)
│   │
│   ├── 🔌 System rozszerzeń
│   │   ├── Plugin system (JS/TS)
│   │   ├── Hooks (lifecycle events)
│   │   └── MCP Protocol Client
│   │
│   └── 🤝 Agenci bazowi (2)
│       ├── build — pełen dostęp do narzędzi, domyślny
│       └── plan — read-only, planowanie
│
├── 🧠 WARSTWA INTELIGENCJI [Oh-My-OpenCode]
│   │
│   ├── 🎭 System Agentów (11 wyspecjalizowanych)
│   │   │
│   │   ├── 👑 Sisyphus (Główny orkiestrator)
│   │   │   ├── Delegacja zadań do wyspecjalizowanych agentów
│   │   │   ├── Ralph Loop — ciągła praca do ukończenia
│   │   │   ├── Ultrawork Mode — deep focus bez pytań
│   │   │   ├── Boulder tracking — śledzenie postępu dużych zadań
│   │   │   └── ⚠️ Zbyt agresywna orkiestracja (#1081)
│   │   │
│   │   ├── 🔨 Hephaestus (Deep Worker)
│   │   │   ├── Trudne zadania logiczne
│   │   │   ├── GPT-powered (inny model niż główny)
│   │   │   └── Długie, złożone implementacje
│   │   │
│   │   ├── 🏛️ Oracle (Konsultant architektoniczny)
│   │   │   ├── Przegląd architektury
│   │   │   ├── Analiza trade-offs
│   │   │   └── Rekomendacje strategiczne
│   │   │
│   │   ├── 📚 Librarian (Wyszukiwanie wiedzy)
│   │   │   ├── Exa web search
│   │   │   ├── Context7 (docs 1000+ bibliotek)
│   │   │   ├── Grep.app (kod z GitHuba)
│   │   │   └── Synteza i raportowanie
│   │   │
│   │   ├── 🔍 Explore (Szybka analiza kodu)
│   │   │   ├── Grep codebase
│   │   │   ├── LSP queries
│   │   │   └── Szybkie mapowanie zależności
│   │   │
│   │   ├── 👁️ Multimodal-Looker (Wizja)
│   │   │   ├── Analiza obrazów
│   │   │   ├── Czytanie PDF
│   │   │   └── Interpretacja diagramów
│   │   │
│   │   ├── 🔮 Prometheus (Planista strategiczny)
│   │   │   ├── Wywiady z użytkownikiem
│   │   │   ├── Tworzenie work plans
│   │   │   ├── Intent classification
│   │   │   └── Research-backed rekomendacje
│   │   │
│   │   ├── 🎯 Metis (Analiza luk)
│   │   │   ├── Gap analysis planów
│   │   │   ├── Identyfikacja brakujących wymagań
│   │   │   └── Guardrail suggestions
│   │   │
│   │   ├── 😤 Momus (Surowy recenzent)
│   │   │   ├── Weryfikacja 100% referencji do plików
│   │   │   ├── ≥80% zadań z jasnymi źródłami
│   │   │   ├── ≥90% zadań z konkretnymi acceptance criteria
│   │   │   └── Verdict: OKAY / REJECT (pętla do OKAY)
│   │   │
│   │   ├── 📋 Atlas (Orkiestrator TODO)
│   │   │   ├── Zarządzanie listami zadań
│   │   │   ├── Śledzenie postępu
│   │   │   └── ⚠️ Infinite loop bug (#668)
│   │   │
│   │   └── 🏃 Sisyphus-Junior (Executor lekkich zadań)
│   │       ├── quick / unspecified-low zadania
│   │       ├── Delegowany przez Sisyphusa
│   │       └── Szybsze, tańsze wykonanie
│   │
│   ├── 🪝 Hooks & Lifecycle (44 hooki w 5 warstwach)
│   │   ├── Tier 1: System Foundation
│   │   │   ├── IntentGate — klasyfikacja intencji
│   │   │   ├── Preemptive Compaction — kompresja kontekstu
│   │   │   └── Session bootstrap
│   │   ├── Tier 2: Tool Augmentation
│   │   │   ├── Hash-anchored edits (LINE#ID)
│   │   │   ├── Edit retry logic
│   │   │   └── File operation safety
│   │   ├── Tier 3: Quality Gates
│   │   │   ├── Todo Enforcer
│   │   │   ├── Comment Checker
│   │   │   └── Commit validation
│   │   ├── Tier 4: Agent Behavior
│   │   │   ├── Prompt injection per agent
│   │   │   ├── Tool restriction per category
│   │   │   └── Response formatting
│   │   └── Tier 5: Integration
│   │       ├── MCP lifecycle management
│   │       ├── Skill activation
│   │       └── Cross-session continuity
│   │
│   ├── 🛠️ Rozszerzone narzędzia (26 łącznie)
│   │   ├── Bazowe OpenCode (8) — patrz wyżej
│   │   ├── Hash-anchored Edit (LINE#ID — resilient)
│   │   ├── AST-grep Search (wzorce składniowe)
│   │   ├── AST-grep Replace (refactoring AST)
│   │   ├── Task delegation (spawn agentów)
│   │   ├── Background task management
│   │   ├── Session read/search/list/info
│   │   ├── TodoWrite (listy zadań)
│   │   ├── Look_at (analiza mediów)
│   │   ├── Interactive Bash (tmux — TUI apps)
│   │   ├── Skill MCP invoke
│   │   ├── Slash commands (/init-deep, /refactor, itd.)
│   │   └── Question tool (structured UI input)
│   │
│   ├── 🎓 Skills (z wbudowanymi MCP)
│   │   ├── 🎭 Playwright — automatyzacja przeglądarki
│   │   │   ├── Nawigacja, klikanie, wypełnianie formularzy
│   │   │   ├── Screenshoty i asercje DOM
│   │   │   ├── Testowanie UI end-to-end
│   │   │   └── Web scraping
│   │   ├── 🔀 Git-Master — zaawansowane git
│   │   │   ├── Atomic commits
│   │   │   ├── Rebase/squash
│   │   │   ├── History search (blame, bisect, log -S)
│   │   │   └── ⚠️ „Destructive behaviour" (#1081)
│   │   └── 🎨 Frontend-UI-UX — design + implementation
│   │       ├── UI/UX design bez mockupów
│   │       ├── Styling i animacje
│   │       └── Responsive layout
│   │
│   ├── 🌐 Wbudowane MCP (3)
│   │   ├── 🔎 Exa (Web search)
│   │   │   ├── Przeszukiwanie internetu
│   │   │   ├── Clean content extraction
│   │   │   └── News, facts, current info
│   │   ├── 📖 Context7 (Dokumentacja bibliotek)
│   │   │   ├── 1000+ bibliotek
│   │   │   ├── Aktualna dokumentacja + code snippets
│   │   │   ├── resolve-library-id → query-docs
│   │   │   └── Wersjonowane (np. /vercel/next.js/v14.3.0)
│   │   └── 💻 Grep.app (Kod z GitHuba)
│   │       ├── Miliony publicznych repozytoriów
│   │       ├── Literal code patterns + regex
│   │       ├── Filtrowanie po języku, repo, ścieżce
│   │       └── Real-world usage examples
│   │
│   ├── 📂 System kategorii agentów
│   │   ├── visual-engineering — Frontend, UI/UX, design
│   │   ├── ultrabrain — Ciężkie problemy logiczne
│   │   ├── deep — Głęboka analiza, autonomia
│   │   ├── artistry — Kreatywne rozwiązania
│   │   ├── quick — Trivial, single file
│   │   ├── unspecified-low — Lekkie, niekategoryzowane
│   │   ├── unspecified-high — Ciężkie, niekategoryzowane
│   │   └── writing — Dokumentacja, proza
│   │
│   ├── 🔄 Tryby pracy
│   │   ├── Ralph Loop — ciągła praca do ukończenia
│   │   │   ├── Auto-kontynuacja po przerwaniu
│   │   │   ├── Boulder tracking
│   │   │   └── Session persistence
│   │   ├── Ultrawork Loop — deep focus mode
│   │   │   ├── Bez pytań do użytkownika
│   │   │   └── Pełna autonomia
│   │   ├── /start-work — wykonanie z planu Prometheus
│   │   ├── /refactor — inteligentny refactoring z LSP + AST
│   │   ├── /init-deep — inicjalizacja bazy wiedzy AGENTS.md
│   │   └── /handoff — przekazanie kontekstu do nowej sesji
│   │
│   └── 🛡️ Mechanizmy jakości
│       ├── Todo Enforcer — wymuszanie realizacji TODO
│       ├── Comment Checker — walidacja komentarzy w kodzie
│       ├── Preemptive Compaction — kompresja przed limitem
│       ├── Hash-anchored edits — odporność na przesunięcia linii
│       ├── Evidence capture — screenshoty/logi jako dowody QA
│       └── Multi-stage review — Metis → Momus → Oracle pipeline
│
└── 🔗 WARSTWA INTEGRACJI [Razem]
    │
    ├── Pełny pipeline programistyczny
    │   ├── 1. Użytkownik → opis celu
    │   ├── 2. Prometheus → plan strategiczny
    │   ├── 3. Metis → analiza luk w planie
    │   ├── 4. Momus → surowa recenzja (pętla do OKAY)
    │   ├── 5. Sisyphus → orkiestracja wykonania
    │   ├── 6. Wyspecjalizowani agenci → implementacja
    │   ├── 7. Playwright → testy UI
    │   ├── 8. Oracle → konsultacja architektoniczna
    │   └── 9. Git-Master → commit, rebase, cleanup
    │
    ├── Kompatybilność z Claude Code
    │   ├── CLAUDE.md / AGENTS.md support
    │   ├── Commands, hooks, skills
    │   ├── MCP protocol
    │   └── Migration path
    │
    └── Ekosystem rozszerzeń
        ├── Custom plugins (JS/TS)
        ├── Custom MCPs
        ├── Custom skills
        ├── Custom hooks
        └── Custom agents (via category system)
```

---

## Legenda

| Symbol | Znaczenie |
|--------|-----------|
| 🏠 | Korzeń systemu |
| 🔌 | Infrastruktura (OpenCode) |
| 🧠 | Inteligencja (OMO) |
| 🔗 | Integracja (synergicznie) |
| ⚠️ | Znany problem / bug |
| 🔴 | Krytyczny |
| 🟡 | Kontrowersyjny |
| 🟠 | Niestabilny |

## Statystyki

| Metryka | Wartość |
|---------|---------|
| Providerzy AI | 10+ (75+ modeli) |
| Agenci | 11 wyspecjalizowanych |
| Narzędzia | 26 |
| Hooks | 44 w 5 warstwach |
| Skills | 3 (z embedded MCP) |
| MCP wbudowane | 3 |
| Komendy | 7 |
| Kategorie agentów | 8 |
| Tryby pracy | 6 |
