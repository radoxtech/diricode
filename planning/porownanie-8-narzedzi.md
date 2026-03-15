# Porownanie 8 narzedzi AI do kodowania

> **Data**: Marzec 2026
> **Zrodla**: Analiza kodu zrodlowego, oficjalna dokumentacja, artykuly techniczne, blogi, recenzje uzytkownikow
> **Cel**: Zrozumienie roznic technicznych — bez rekomendacji

---

## Spis tresci

1. [Przeglad narzedzi](#1-przeglad-narzedzi)
2. [Architektura i jezyk implementacji](#2-architektura-i-jezyk-implementacji)
3. [Glowna petla agenta](#3-glowna-petla-agenta)
4. [System agentow i ról](#4-system-agentow-i-rol)
5. [Strategie edycji plikow](#5-strategie-edycji-plikow)
6. [Zarzadzanie kontekstem](#6-zarzadzanie-kontekstem)
7. [Routing modeli i dostawcy](#7-routing-modeli-i-dostawcy)
8. [Sandbox i bezpieczenstwo](#8-sandbox-i-bezpieczenstwo)
9. [Hooki i rozszerzalnosc](#9-hooki-i-rozszerzalnosc)
10. [Benchmarki i wyniki](#10-benchmarki-i-wyniki)
11. [Koszty uzytkowania](#11-koszty-uzytkowania)
12. [Spolecznosc i zdrowie projektu](#12-spolecznosc-i-zdrowie-projektu)
13. [Unikalne mechanizmy](#13-unikalne-mechanizmy)
14. [Znane problemy i slabosci](#14-znane-problemy-i-slabosci)
15. [Tabela porownawcza](#15-tabela-porownawcza)
16. [Opinie uzytkownikow z forow i blogow](#16-opinie-uzytkownikow-z-forow-i-blogow)

---

## 1. Przeglad narzedzi

| Narzedzie | Typ | Licencja | Gwiazdki GitHub | Jezyk | Dostawca |
|-----------|-----|----------|-----------------|-------|----------|
| **Aider** | CLI | Apache 2.0 | ~25K | Python | Open-source (Paul Gauthier) |
| **Cline** | Rozszerzenie IDE | Open-source | 58.8K | TypeScript | Cline (dawniej Claude Dev) |
| **OpenHands** | Platforma webowa | MIT | ~45K | Python | All Hands AI (dawniej OpenDevin) |
| **Plandex** | CLI klient-serwer | AGPLv3 | 14K | Go | Open-source (Nathaniel Holland) |
| **Codex CLI** | CLI | Apache 2.0 | 63.8K | Rust (96%) | OpenAI |
| **Claude Code** | CLI | Proprietarny* | ~37K | TypeScript | Anthropic |
| **OpenCode** | CLI/TUI | MIT | ~108K | Go | Anomaly (thdxr) |
| **Oh-My-OpenCode** | Plugin do OpenCode | MIT | ~33K | TypeScript | code-yeongyu |

*\*Claude Code ma otwarty kod na GitHubie, ale rdzen jest proprietarny (wymaga Anthropic API)*

---

## 2. Architektura i jezyk implementacji

### Aider
- **Jezyk**: Python
- **Architektura**: Monolityczny CLI — brak serwera, brak TUI. Bezposrednia interakcja z terminalem.
- **Kluczowe komponenty**: `Coder` (bazowy), `EditBlockCoder`, `WholeFileCoder`, `UnifiedDiffCoder`, `ArchitectCoder` — kazdy obsluguje inny format edycji.
- **Repo Map**: Tree-sitter AST + algorytm PageRank do rankingu waznosci plikow. Domyslny budzet: 1024 tokeny.
- **Filozofia projektowa**: "Interactive, not agentic" — uzytkownik utrzymuje kontrole, agent nie dziala autonomicznie.

### Cline
- **Jezyk**: TypeScript
- **Architektura**: Rozszerzenie VS Code (takze Cursor, Windsurf, JetBrains, CLI).
- **Kluczowe komponenty**: Plan & Act dual-mode, Subagents (rownolegly research), Deep Planning, Checkpoints (shadow Git repo).
- **Kontrola przegladarki**: Wbudowana instancja Chrome (viewport 900x600).
- **Filozofia projektowa**: Przejrzystosc — uzytkownik widzi kazdy plik, kazda decyzje, kazdy token.

### OpenHands
- **Jezyk**: Python (backend), TypeScript/React (frontend)
- **Architektura**: Event-driven z Docker sandbox. Kazda sesja dostaje izolowany kontener.
- **Kluczowe komponenty**: `CodeActAgent` — zunifikowana przestrzen akcji (bash + Python w jednym). Event stream jako centralny mechanizm komunikacji.
- **Artykul naukowy**: arXiv:2407.16741, przyjety na ICLR 2025, 24 autorow, 188+ kontrybutorów.
- **Filozofia projektowa**: Platforma badawcza z mozliwoscia praktycznego uzycia.

### Plandex
- **Jezyk**: Go (klient i serwer)
- **Architektura**: Klient-serwer z Git sandbox per plan. Serwer utrzymuje stan, klient to CLI.
- **Kluczowe komponenty**: 9 wyspecjalizowanych rol modelowych, Build Race (3 rownolegle strategie), system failover (3 typy).
- **Wersjonowanie**: Kazda akcja tworzy nowa wersje w historii planu — pelny audit trail.
- **Filozofia projektowa**: Izolowany sandbox zmian z review przed zastosowaniem.

### Codex CLI
- **Jezyk**: Rust (96.2%), TypeScript (2.1%)
- **Architektura**: Modularne crate'y Rust: `codex-core`, `codex-tui`, `codex-cli`, `codex-exec`, `codex-linux-sandbox`, `codex-windows-sandbox-rs`, `codex-execpolicy`, `codex-network-proxy`, `codex-mcp-server`, `codex-skills`, `codex-otel`.
- **Build system**: Bazel
- **Filozofia projektowa**: Bezpieczenstwo na poziomie OS (natywny sandbox per platforma) + Guardian AI do oceny ryzyka.

### Claude Code
- **Jezyk**: TypeScript
- **Architektura**: Plaska (brak dispatchera) — komendy bezposrednio uruchamiaja agentow.
- **Kluczowe komponenty**: CLAUDE.md (pamiec), Skills, Subagents, Hooks, Plugins, MCP.
- **Petla**: Trzy fazy: zbierz kontekst → wykonaj akcje → zweryfikuj wynik.
- **Filozofia projektowa**: Agentic harness wokol modeli Claude z rozbudowanym systemem uprawnien.

### OpenCode
- **Jezyk**: Go 1.24+
- **Architektura**: Go + Bubble Tea TUI + SQLite. Caly stan w jednej bazie SQLite (sesje, wiadomosci, pliki).
- **Kluczowe komponenty**: PubSub event bus, 10 providerów (~79 modeli), pelny klient LSP (28+ metod), kompakcja przy 95% okna kontekstu.
- **SDK providerów**: Bezposrednie SDK (openai-go, anthropic-sdk-go, google genai, AWS SDK v2) — bez LiteLLM.
- **Status**: **ZARCHIWIZOWANY** — rozwoj przeniesiony do [Crush](https://github.com/charmbracelet/crush) przez zespol Charm.

### Oh-My-OpenCode (OMO)
- **Jezyk**: TypeScript (plugin do OpenCode)
- **Architektura**: 3-warstwowa orkiestracja: Planowanie (Prometheus+Metis+Momus) → Wykonanie (Atlas) → Pracownicy (agenci wyspecjalizowani).
- **Kluczowe komponenty**: 11 agentow, 44 lifecycle hooks w 5 warstwach, 26 narzedzi, 3 wbudowane MCP (Exa, Context7, Grep.app).
- **Filozofia projektowa**: "Human intervention is a failure signal" — interwencja czlowieka to sygnal bledu systemu.

---

## 3. Glowna petla agenta

### Aider — Petla interaktywna
```
1. Uzytkownik wpisuje polecenie
2. Repo Map identyfikuje relevantne pliki (tree-sitter + PageRank)
3. LLM generuje edycje w wybranym formacie (diff/whole/udiff/editor-diff)
4. Parser wyodrebnia zmiany z odpowiedzi
5. Zmiany aplikowane do plikow
6. Opcjonalnie: lint + test → jesli blad, wynik wraca do LLM
7. Opcjonalnie: auto-commit z wygenerowana wiadomoscia
```
**Kluczowa cecha**: Lint/test loop — Aider automatycznie uruchamia linter i testy po edycji, a wyniki bledow podaje z powrotem do modelu.

### Cline — Petla Plan & Act
```
Plan Mode (read-only):
1. Eksploracja kodu, wyszukiwanie, dyskusja strategii
2. NIE moze modyfikowac plikow

Act Mode (wykonanie):
1. Modyfikacja plikow, uruchamianie komend
2. Kazda akcja wymaga zatwierdzenia uzytkownika (chyba ze auto-approve)
3. Po kazdym uzyciu narzedzia → checkpoint (snapshot w shadow Git)
4. Uzytkownik moze przywrocic dowolny checkpoint
```
**Kluczowa cecha**: Deep Planning (`/deep-planning`) — 4-krokowy proces: cicha investigacja → pytania → plan w `implementation_plan.md` → utworzenie taskow.

### OpenHands — Petla event-driven
```
1. Uzytkownik wysyla zadanie
2. CodeActAgent planuje akcje
3. Wykonanie w Docker sandbox (bash lub Python)
4. Obserwacja wynikow
5. Nastepna akcja lub zakonczenie
```
**Kluczowa cecha**: Zunifikowana przestrzen akcji — bash i Python w jednym, agent sam decyduje ktorego uzyc.

### Plandex — Petla planowania z sandbox
```
1. Architect analizuje project map, wybiera kontekst (opcjonalnie)
2. Planner generuje wielokrokowy plan
3. Coder implementuje kazdy krok
4. Builder parsuje zmiany w pending updates
5. Auto-continue sprawdza czy plan jest ukonczony
6. Uzytkownik review'uje diffy → apply lub reject
7. Opcjonalnie: auto-apply + auto-debug w trybie Full
```
**Kluczowa cecha**: Build Race — 3 strategie budowania dzialaja rownolegle (fast apply + whole file rewrite + structured edits), pierwsza poprawna wygrywa.

### Codex CLI — Petla z Guardian
```
1. Uzytkownik wpisuje zadanie
2. Model planuje akcje (Responses API)
3. Tool Orchestrator sprawdza zatwierdzenie:
   a. Skip (auto-approve w sandbox)
   b. NeedsApproval → Guardian AI ocenia ryzyko (0-100)
   c. Forbidden → odrzucenie
4. Sandbox wybiera odpowiedni mechanizm OS
5. Wykonanie w sandbox
6. Wynik wraca do modelu
7. Retry z inna strategia sandbox przy bledzie
```
**Kluczowa cecha**: Guardian AI — subagent (gpt-5.4) oceniajacy ryzyko kazdej akcji w skali 0-100. Prog zatwierdzenia: <80.

### Claude Code — Petla trzyfazowa
```
1. Zbieranie kontekstu (odczyt plikow, wyszukiwanie, web)
2. Wykonanie akcji (edycja, bash, MCP)
3. Weryfikacja wyniku (testy, lint, porownanie)
4. Powtorz lub zakoncz
```
**Kluczowa cecha**: Auto-memory — Claude automatycznie zapisuje przydatny kontekst (komendy buildowania, debugowania) do CLAUDE.md bez instrukcji uzytkownika.

### OpenCode — Petla z kompakcja
```
1. Uzytkownik wpisuje polecenie
2. Agent coder uzywa narzedzi (bash, edit, view, glob, grep, LSP, fetch)
3. Wynik wraca do modelu
4. Jesli zuzycie tokenow >= 95% okna → auto-kompakcja:
   a. Summarizer streszcza sesje
   b. Nowa sesja z podsumowaniem jako pierwsza wiadomosc
   c. parent_session_id laczy sesje
5. Kontynuacja pracy
```
**Kluczowa cecha**: Kompakcja przy 95% — automatyczne streszczanie i kontynuacja w nowej sesji.

### OMO — Petla orkiestracji
```
Tryb Ultrawork:
1. IntentGate klasyfikuje intencje uzytkownika
2. Sisyphus (orkiestrator) deleguje do specjalistow
3. Agenci dzialaja rownolegle (Explore szuka, Librarian sprawdza docs)
4. Todo Enforcer wymusza ukonczenie wszystkich zadan
5. Weryfikacja wynikow (nigdy nie ufa twierdzeniom subagentow)

Tryb Prometheus:
1. Prometheus przeprowadza wywiad z uzytkownikiem
2. Metis analizuje luki w wymaganiach
3. Momus recenzuje plan
4. /start-work uruchamia wykonanie z pelna orkiestracja
```
**Kluczowa cecha**: Ralph Loop — samoreferencyjne petla pracy az do ukonczenia. Agent sam kontynuuje po kazdym kroku.

---

## 4. System agentow i rol

| Narzedzie | Liczba agentow | Role |
|-----------|----------------|------|
| **Aider** | 2 tryby | Architect (planowanie) + Editor (implementacja). Dwa modele moga wspolpracowac. |
| **Cline** | 1 + subagents | Glowny agent + subagenty do rownoleglego researchu (read-only, bez zapisu) |
| **OpenHands** | 1 (CodeActAgent) | Jeden agent z zunifikowana przestrzenia akcji |
| **Plandex** | 9 rol | Planner, Architect, Coder, Summarizer, Builder, WholeFileBuilder, Names, CommitMsg, AutoContinue |
| **Codex CLI** | 4+ | default, worker, explorer, monitor + Guardian (subagent bezpieczenstwa) |
| **Claude Code** | 1 + subagents | Glowny + Explore (Haiku, read-only), Plan, custom subagents z YAML frontmatter |
| **OpenCode** | 4 | coder (glowny), task (read-only search), title (generowanie tytulow), summarizer (kompakcja) |
| **OMO** | 11 | Sisyphus (orkiestrator), Oracle (architektura), Librarian (docs), Explore (grep), Frontend (UI/UX), Prometheus (planowanie), Metis (analiza luk), Momus (recenzent), Atlas (TODO), Sisyphus-Junior (wykonanie), Multimodal-Looker (obrazy/PDF) |

### Plandex — 9 ról w szczegolach
Plandex wyroznia sie najbardziej rozbudowanym systemem rol w pojedynczym narzedziu:
- **Planner**: Glowna rola odpowiadajaca na prompty i tworzaca plany. Ma large-context fallback.
- **Architect**: Uzywa project map do stworzenia planu wysokopoziomowego, decyduje jaki kontekst dostarczyc Plannerowi.
- **Coder**: Pisze kod implementujacy kazdy krok planu. Instruction-following jest kluczowy.
- **Builder**: Parsuje zmiany opisane przez Plannera w pending file updates (celowane edycje).
- **WholeFileBuilder**: Fallback — przepisuje caly plik jesli celowane edycje zawiodly.
- **Summarizer**: Streszcza konwersacje gdy przekroczono max-convo-tokens.
- **AutoContinue**: Okresla czy plan jest ukonczony czy kontynuowac.
- **Names**: Automatyczne nazwy dla planow i kontekstu.
- **CommitMessages**: Automatyczne wiadomosci commitow.

### OMO — 3 warstwy orkiestracji
```
Warstwa 1 — Planowanie:
  Prometheus → przeprowadza wywiad, generuje plan
  Metis → analizuje luki i dwuznacznosci
  Momus → surowa recenzja planu

Warstwa 2 — Wykonanie:
  Atlas/Sisyphus → koordynuje prace, weryfikuje wyniki

Warstwa 3 — Pracownicy:
  Oracle (GPT 5.2) → architektura, debugging, trudne decyzje
  Librarian (Claude Sonnet) → dokumentacja, open-source
  Explore (Grok Code) → szybka eksploracja kodu
  Frontend (Gemini 3 Pro) → UI/UX
  Sisyphus-Junior (Claude Sonnet) → wykonanie zadan
  Multimodal-Looker → analiza obrazow, PDF, diagramow
```

---

## 5. Strategie edycji plikow

### Aider — 6 formatow edycji
Aider ma najbardziej rozbudowany system formatow edycji:

| Format | Opis | Zastosowanie |
|--------|------|-------------|
| `whole` | Caly plik w odpowiedzi | Male pliki, proste zmiany |
| `diff` | Bloki SEARCH/REPLACE | Domyslny dla wiekszosci modeli |
| `diff-fenced` | Diff w blokach kodu | Modele ktore lepiej radza sobie z fenced code |
| `udiff` | Zunifikowany diff | Zredukowane "leniwe kodowanie" (12→4 zadania) |
| `editor-diff` | Architect+Editor z diff | Silny model planuje, slabszy implementuje |
| `editor-whole` | Architect+Editor z whole | j.w. ale caly plik |

**Kluczowe odkrycie**: LLM produkuja nizszej jakosci kod w formacie JSON niz w Markdown. Dlatego Aider uzywa formatow opartych na Markdown.

### Cline — Bezposrednia edycja + checkpointy
- Edycja plikow bezposrednio (write/apply_diff)
- **Checkpoint po kazdym uzyciu narzedzia** — shadow Git repo oddzielony od projektu
- 3 opcje przywracania: Restore Files, Restore Task Only, Restore Files & Task
- Background Edit — eksperymentalna funkcja edycji w tle

### OpenHands — Kod w sandbox
- Agent pisze kod bash lub Python w Docker sandbox
- Bezposrednia manipulacja plikami przez komendy shell
- Brak wyspecjalizowanego formatu edycji — agent uzywa standardowych narzedzi Unix

### Plandex — Build Race (3 strategie rownolegle)
```
Strategia 1: Fast Apply → szybka aplikacja zmian
Strategia 2: Whole File Rewrite → przepisanie calego pliku
Strategia 3: Structured Edits → celowane edycje

Pierwsza poprawna strategia wygrywa.
Jesli wszystkie zawioda → failover do WholeFileBuilder.
```
- 3-typowy failover: LargeContextFallback (lancuch do 10 glebokosci), ErrorFallback, StrongModelFallback (przelaczenie po 2 nieudanych probach)
- Pending changes → uzytkownik review'uje diffy → apply lub reject

### Codex CLI — Apply Patch + File Edit
- `apply_patch` — aplikacja plikow roznicowych (diff)
- `file_edit` — bezposrednia edycja plikow
- File search z BM25 scoring do wyszukiwania plikow
- Sandbox chroni przed destrukcyjnymi zmianami

### Claude Code — Write/Edit/MultiEdit
- **Write**: Zapis calego pliku
- **Edit**: Pojedyncza zamiana (old_string → new_string)
- **MultiEdit**: Wiele zamian w jednym pliku
- Confidence scoring (0-100) dla code review z progiem >=80

### OpenCode — Exact String Match
- `old_string` musi pasowac **dokladnie** (lacznie z bialymi znakami)
- Musi byc **unikalna** w pliku (brak wielu dopasowań)
- Walidacja: sprawdzenie czasu modyfikacji pliku od ostatniego odczytu
- Brak fuzzy matching — prosty `strings.Index` + `strings.LastIndex`
- Osobne narzedzie `patch` do aplikacji diffow

### OMO — Hash-anchored edits
- Unikalne LINE#ID — precyzyjne edycje odporne na przesuniecia linii
- AST-grep — wyszukiwanie i zamiana wzorcow kodu z uwzglednieniem skladni (25 jezykow)
- Delegacja do subagentow z weryfikacja wynikow

---

## 6. Zarzadzanie kontekstem

| Narzedzie | Okno kontekstu | Strategia | Szczegoly |
|-----------|----------------|-----------|-----------|
| **Aider** | Zalezy od modelu | Repo Map (tree-sitter + PageRank) | Domyslny budzet: 1024 tokeny. Mapa automatycznie dopasowuje sie do budżetu tokenow. Prompt caching dla Anthropic i DeepSeek. |
| **Cline** | Do 400K+ | Auto-Compact, /smol, /newtask | Smart context: laduje tylko relevantne pliki per krok. Memory Bank dla trwalego kontekstu. Focus Chain. |
| **OpenHands** | Zalezy od modelu | Condenser | Event-driven z Docker sandbox. Szczegoly condensera nie sa publicznie udokumentowane. |
| **Plandex** | Do 2M tokenow | Sliding context window | Smart Context: per krok implementacji laduje tylko relevantne pliki. Tree-sitter project maps dla 30+ jezykow, do 20M tokenow w mapach. ConvoSummary: inkrementalne streszczanie. |
| **Codex CLI** | Zalezy od modelu | Automatic compaction | SQLite state DB. Sesje w `~/.codex/sessions/`. Auto-Memory (2 fazy) zapamietuje wzorce z sesji. |
| **Claude Code** | Do 1M (beta) | Sliding window compaction | Automatyczna kompakcja zachowujaca obrazy. Checkpointy. Pierwsze 200 linii CLAUDE.md ladowane per sesja. /compact z fokusem. |
| **OpenCode** | Zalezy od modelu | Auto-kompakcja przy 95% | Streszczanie w nowej sesji z parent_session_id. SQLite przechowuje calą historie (sesje, wiadomosci, pliki). |
| **OMO** | Dziedziczone z OpenCode | Preemptive Compaction + delegacja | Kompresja kontekstu PRZED przekroczeniem limitu. Delegacja do subagentow z oddzielnymi oknami kontekstu. |

### Aider — Repo Map w szczegolach
```
1. Tree-sitter parsuje wszystkie pliki w repo → generuje AST
2. Ekstrakcja definicji (klasy, funkcje, metody) i referencji
3. Budowa grafu zaleznosci miedzy plikami
4. PageRank na grafie → ranking waznosci plikow
5. Kompresja do budżetu tokenow (domyslnie 1024)
6. Wynik: mapa repo pokazujaca najwazniejsze definicje
```

### Plandex — Sliding Context Window
```
1. Architect okresla ktore pliki sa relevantne per krok
2. Tylko te pliki ladowane do kontekstu podczas implementacji
3. Okno kontekstu rosnie i kurczy sie dynamicznie
4. Maks. efektywny kontekst: 2M tokenow (Gemini Pro 1.5)
5. Tree-sitter project maps: do 20M tokenow w mapach
```

### Codex CLI — Auto-Memory (2 fazy)
```
Faza 1 — Ekstrakcja:
  Model: gpt-5.1-codex-mini (tani, niski reasoning)
  Rownolegle zadania (limit: 8)
  Token limit: 150,000 per rollout
  Produkuje surowe pamieci w Markdown

Faza 2 — Konsolidacja:
  Model: gpt-5.3-codex (silniejszy reasoning)
  Globalna blokada (tylko jedna sesja jednoczesnie)
  Konsoliduje wybrane surowe pamieci
  Przechowuje w ~/.codex/memories/
```

---

## 7. Routing modeli i dostawcy

### Aider — Otwarty na wszystko
- Obslugiwa praktycznie dowolny model (OpenAI, Anthropic, Google, DeepSeek, Ollama, Azure, itd.)
- Architect/Editor mode: silny model planuje (np. o1-preview), slabszy implementuje (np. o1-mini)
- Polyglot leaderboard: gpt-5 (high) = 88.0%, o3-pro = 84.9%, Architect (o1-preview + o1-mini) = 85.0%

### Cline — 30+ providerow
- Model-agnostic: Anthropic, OpenAI, OpenRouter, Google Gemini, DeepSeek, Qwen, MiniMax, Mistral, Cerebras, Groq, xAI, AWS Bedrock
- Rozne modele dla Plan vs Act mode (np. Claude Opus dla planowania, Cerebras dla szybkosci)
- Adaptive Thinking (Claude Opus 4.6): model sam kalibruje ile reasoning zainwestowac

### OpenHands — Konfigurowalne
- Obslugiwa wiele providerow (OpenAI, Anthropic, Google, itd.)
- Ewaluowany na 15+ benchmarkach
- Brak publicznych danych o specyficznym routingu modeli

### Plandex — 16 Model Packs
```
16 gotowych pakietow modeli:
- daily-driver, reasoning, strong, cheap
- OSS, Ollama variants
- Provider-specific (OpenAI, Anthropic, Google, DeepSeek, Perplexity)
- Planner-specific

Kazdy pakiet definiuje model per rola:
  planner: openai/o3-high
  coder: anthropic/claude-sonnet-4
  builder: openai/gpt-4.1
  summarizer: openai/gpt-4.1-mini
  ... itd. dla kazdej z 9 rol
```

### Codex CLI — OpenAI-centric
- Zalecany: gpt-5.4 (flagship)
- Alternatywne: gpt-5.3-codex, gpt-5.3-codex-spark (szybkosc)
- Obsluguje dowolny model z Responses API lub Chat Completions API
- model_reasoning_effort: high/medium/low
- Guardian AI uzywa gpt-5.4 do oceny ryzyka

### Claude Code — Anthropic only
- Opus 4.6, Sonnet 4.6, Haiku
- opusplan mode: Opus planuje, Sonnet wykonuje
- Effort levels: low, medium, high (adaptive reasoning)
- Extended thinking: domyslnie wlaczone, 31,999 tokenow budzet
- "ultrathink" keyword do maksymalnego reasoning
- 1M context window (beta) dla Opus 4.6 i Sonnet 4.6
- **Vendor lock-in**: tylko Anthropic

### OpenCode — 10 providerow, ~79 modeli
```
Anthropic: 7 modeli (Claude 3-4)
OpenAI: 12 modeli (GPT 4.1-4.5, O1/O3/O4)
Copilot: 14 modeli
Azure: 11 modeli
OpenRouter: 20 modeli
Gemini: 4 modele
Groq: 5 modeli
VertexAI: 2 modele
XAI: 4 modele
Local: self-hosted
```
- Bezposrednie SDK per provider (bez LiteLLM)

### OMO — 3-krokowa rezolucja modeli
```
1. User Override: jesli uzytkownik okresli w konfiguracji → uzyj dokladnie tego
2. Provider Fallback: probuj kazdego providera w kolejnosci priorytetu
3. System Default: fallback do domyslnego modelu OpenCode

Lancuch priorytetow per agent (przyklad Sisyphus):
  anthropic → github-copilot → opencode → antigravity → google
```
- Delegacja semantyczna (category-based): `ultrabrain`, `visual-engineering`, `quick`, `deep`, `artistry`, `writing`
- Kazdy agent ma domyslny model i lancuch fallbackow

---

## 8. Sandbox i bezpieczenstwo

### Aider — Brak sandboxa
- Dziala bezposrednio w systemie uzytkownika
- Brak izolacji — edytuje pliki bezposrednio
- Bezpieczenstwo oparte na interaktywnosci: uzytkownik zatwierdza zmiany
- Auto-commit do Git jako forma rollbacku

### Cline — Shadow Git + zatwierdzanie
- **Checkpoint system**: Shadow Git repo oddzielony od projektu
- Auto-snapshot po kazdym uzyciu narzedzia
- Kazda akcja wymaga zatwierdzenia uzytkownika (domyslnie)
- Auto-approve dostepne (z mozliwoscia rollbacku do checkpointu)
- .clineignore dla wykluczenia plikow

### OpenHands — Docker sandbox
- **Pelna izolacja**: kazda sesja w oddzielnym kontenerze Docker
- Agent dziala wewnatrz kontenera z ograniczonymi uprawnieniami
- Izolacja sieciowa konfigurowana
- Najbardziej restrykcyjny model izolacji sposrod wszystkich narzedzi

### Plandex — Git sandbox per plan
- Pending changes w serwerowym Git repo
- Uzytkownik review'uje diffy → apply lub reject
- Rewind do dowolnego kroku w historii planu
- Git state musi byc czysty (clean) dla bezpiecznej operacji
- Auto-revert-on-rewind (opcjonalnie)

### Codex CLI — Natywny sandbox per OS
```
macOS: Seatbelt (sandbox-exec z profilami)
Linux: Landlock + seccomp (domyslne), Bubblewrap (eksperymentalne)
Windows: Restricted Tokens + Windows ACL + DPAPI

Chronione sciezki (wszystkie OS):
  <workspace>/.git     → tylko odczyt
  <workspace>/.codex   → tylko odczyt
  <workspace>/.agents  → tylko odczyt

3 tryby sandbox:
  read-only:        tylko odczyt
  workspace-write:  odczyt + edycja w workspace (domyslny)
  danger-full-access: bez ograniczen

3 polityki zatwierdzania:
  untrusted:   pytaj o niezaufane komendy
  on-request:  pytaj gdy przekraczanie granicy sandbox
  never:       nigdy nie pytaj

Network Proxy: codex-network-proxy z kontrola polityki
  → TYLKO zatwierdzone endpointy sa dostepne
  → seccomp blokuje bezposrednie polaczenia sieciowe
```
**Najbardziej zaawansowany system sandboxingu** sposrod wszystkich narzedzi.

### Claude Code — Permission system + sandboxing
- Tryby: default, acceptEdits, plan, dontAsk, bypassPermissions
- Operacje read-only: bez zatwierdzenia
- Bash commands: wymagaja zatwierdzenia (mozna allowlistowac)
- Edycja plikow: zatwierdzenie do konca sesji
- OS-level sandboxing (macOS, Linux, WSL 2): izolacja filesystem i sieci
- Reguły: `Tool(specifier)` — np. `Bash(git add:*)`, `WebFetch(domain:example.com)`

### OpenCode — Proste uprawnienia sesyjne
- Brak sandboxa OS-level
- Session-based permissions: sprawdza czy sesja w autoApproveSessions
- Jesli dopasowanie → auto-approve, w przeciwnym razie → prompt uzytkownika
- Brak systemu regul, brak warstw, brak last-match-wins
- Pliki wersjonowane w SQLite (nie w oddzielnym Git repo)

### OMO — Dziedziczone z OpenCode + hooki
- Korzysta z systemu uprawnien OpenCode
- 44 lifecycle hooks do kontroli na kazdym etapie
- Git-master skill moze byc destrukcyjny (znany problem)
- Brak dodatkowego sandboxingu ponad OpenCode

---

## 9. Hooki i rozszerzalnosc

| Narzedzie | Hooki | MCP | Pluginy | Inne |
|-----------|-------|-----|---------|------|
| **Aider** | Brak hookow | Brak | Brak | Lint/test commands, repo map customization |
| **Cline** | Hooks (custom) | Tak (klient) | MCP servers | Rules, Skills, Workflows, .clineignore |
| **OpenHands** | Brak | Tak | Architektura pluginow | Custom agents |
| **Plandex** | Brak | Brak | Brak | 16 model packs, 5 poziomow autonomii, custom model config |
| **Codex CLI** | Brak formalnych hookow | Tak (klient + serwer) | Skills (.codex/skills/) | ExecPolicy (Starlark), Rules, AGENTS.md, config.toml |
| **Claude Code** | 12+ typow | Tak (klient) | Tak (Skills+Hooks+MCP) | CLAUDE.md, .claude/rules/, subagents z YAML |
| **OpenCode** | Brak wlasnych | Tak (klient, stdio+SSE) | Tak (system pluginow) | LSP, custom tools, config |
| **OMO** | 44 w 5 warstwach | 3 wbudowane (Exa, Context7, Grep.app) | Kompatybilnosc z Claude Code | Ralph Loop, Ultrawork, IntentGate, AST-grep |

### Claude Code — 12+ typow hookow
```
SessionStart, UserPromptSubmit, PreToolUse, PostToolUse,
PermissionRequest, Stop, SubagentStart, SubagentStop,
InstructionsLoaded, ConfigChange, WorktreeCreate,
WorktreeRemove, PreCompact, SessionEnd

Typy: Command, HTTP, Prompt, Agent
Kody wyjscia: 0 (sukces), 2 (blad blokujacy), inne (nieblokujacy)
```

### OMO — 44 hooki w 5 warstwach
- Kontrola nad kazdym aspektem dzialania agentow
- Prompt injection, walidacja commitow, sprawdzanie komentarzy
- Kompaktowanie kontekstu, todo continuation
- Kompatybilnosc z hookami Claude Code (PreToolUse, PostToolUse, etc.)

### Codex CLI — ExecPolicy (Starlark)
```starlark
prefix_rule(
    pattern = ["gh", "pr", "view"],
    decision = "prompt",  # allow | prompt | forbidden
    justification = "Viewing PRs is allowed with approval",
    match = [["gh", "pr", "view", "123"]],
    not_match = [["gh", "pr", "merge"]]
)
```
- Python-like jezyk polityki z testowalnymi przykladami
- Osobny crate: `codex-execpolicy`

---

## 10. Benchmarki i wyniki

### Opublikowane wyniki

| Narzedzie | SWE-bench Main | SWE-bench Lite | Polyglot | Terminal Bench | Inne |
|-----------|----------------|----------------|----------|---------------|------|
| **Aider** | 18.9% (SOTA w momencie pub.) | 26.3% | 88.0% (gpt-5 high) | — | Architect (o1-preview+o1-mini): 85.0% polyglot |
| **Cline** | — | — | — | 57% (89 zadan) | 5% powyzej Claude Code w Terminal Bench |
| **OpenHands** | Ewaluowany | Ewaluowany | — | — | Testowany na 15+ benchmarkach (ICLR 2025) |
| **Plandex** | — | — | — | — | Brak publicznych benchmarkow |
| **Codex CLI** | — | — | — | — | Brak publicznych benchmarkow |
| **Claude Code** | — | — | — | — | Brak oficjalnych publicznych wynikow |
| **OpenCode** | — | — | — | — | Brak benchmarkow |
| **OMO** | — | — | — | — | Brak benchmarkow |

### Kontekst benchmarkow
- **SWE-bench**: Rzeczywiste bugi z repozytoriow Pythona na GitHubie. Agent musi zdiagnozowac i naprawic buga.
- **Polyglot**: Wielojezyczne testy kodowania (Aider's leaderboard).
- **Terminal Bench**: 89 rzeczywistych zadan kodowania (Cline's benchmark). Cline: 47% → 57% po poprawkach (timeout, weryfikacja, exit codes).

### Aider — Analiza benchmarkow
- 88% kodu Aidera napisane przez samego Aidera
- Unified diffs zredukowaly "leniwe kodowanie" z 12 do 4 zadan (3X poprawa)
- LLM produkuja nizszej jakosci kod w JSON niz Markdown — dlatego Aider unika JSON

---

## 11. Koszty uzytkowania

### Claude Code — Oficjalne dane
```
Sredni koszt: $6/dzien na developera
90% uzytkownikow ponizej $12/dzien
Zespol: ~$100-200/msc z Sonnet 4.6
Agent teams: ~7x wiecej tokenow niz standardowe sesje

Rekomendacje TPM per rozmiar zespolu:
  1-5 uzytkownikow: 200-300K TPM
  500+ uzytkownikow: 10-15K TPM
```

### Aider — Prompt caching
- Obsluga prompt caching dla Anthropic i DeepSeek
- Znaczaca redukcja kosztow przy powtarzajacych sie sesjach
- Darmowy (open-source) + koszt API modeli

### Plandex
- Darmowy (open-source) + koszt API modeli
- Plandex Cloud wygaszany — rekomendacja self-hosting
- Smart Context redukuje koszty ladujac tylko relevantne pliki per krok

### Codex CLI
- Darmowy (open-source) + koszt API OpenAI
- Guardian AI zuzywa dodatkowe tokeny (osobny model gpt-5.4)
- Auto-Memory zuzywa tokeny w 2 fazach (gpt-5.1-codex-mini + gpt-5.3-codex)

### OMO — Filozofia kosztow
- Wyzsze zuzycie tokenow akceptowalne dla znacznych zyskow produktywnosci
- Rownolegle agenci = multiplikacja kosztow
- Tansze modele (Haiku, Flash) dla prostych zadan
- Brak oficjalnych danych o srednim koszcie

### Ogolna zasada
- Narzedzia open-source sa darmowe, platisz tylko za API modeli
- Claude Code jest jedynym narzedziem z oficjalnymi danymi o kosztach
- Narzedzia z wieloma agentami (OMO, Plandex, Codex) generuja wyzsze koszty API

---

## 12. Spolecznosc i zdrowie projektu

| Narzedzie | Gwiazdki | Kontrybutorzy | Status | Uwagi |
|-----------|----------|---------------|--------|-------|
| **Aider** | ~25K | Aktywny | Stabilny | 88% kodu napisane przez Aidera. Regularne releasy. |
| **Cline** | 58.8K | Aktywny | Stabilny | 5M+ instalacji. Dawniej Claude Dev. JetBrains Early Access. |
| **OpenHands** | ~45K | 188+ | Aktywny | Artykul ICLR 2025. 24 autorow. 2100+ contributions. |
| **Plandex** | 14K | Mniejsza spolecznosc | Aktywny | Discord: 700+ czlonkow. Cloud wygaszany. |
| **Codex CLI** | 63.8K | OpenAI team | Aktywny | Release 0.111.0 (marzec 2026). Eksperymentalny status. |
| **Claude Code** | ~37K | Anthropic team | Aktywny | ~6500 otwartych issues. v2.1.71. Czeste releasy. |
| **OpenCode** | ~108K | Aktywny (ale ZARCHIWIZOWANY) | **Zarchiwizowany** | Rozwoj przeniesiony do Crush (Charm team). |
| **OMO** | ~33K | code-yeongyu + spolecznosc | Aktywny | Sisyphus Labs (komercjalizacja). Repo zmienione na oh-my-openagent. |

### Kluczowe wydarzenia
- **OpenCode**: Projekt ZARCHIWIZOWANY, przeniesiony do Crush by Charmbracelet
- **OMO**: Ostrzezenie o fałszywej stronie ohmyopencode.com (nie afiliowana z projektem)
- **OMO**: Anthropic ograniczyl OAuth third-party (styczen 2026), powolujac sie na ten projekt
- **Claude Code**: ~6500 otwartych issues — najwiecej ze wszystkich narzedzi
- **Cline**: Rebrand z Claude Dev → Cline (niezaleznosc od Anthropic)

---

## 13. Unikalne mechanizmy

### Aider
- **Repo Map (PageRank)**: Jedyny system uzywajacy algorytmu PageRank do rankingu waznosci plikow w repo
- **Architect/Editor mode**: Podwojny model — silny planuje, slabszy implementuje
- **Self-written**: 88% kodu Aidera napisane przez samego Aidera
- **6 formatow edycji**: Najbogatsza paleta strategii edycji

### Cline
- **Checkpoint system**: Shadow Git repo z 3 opcjami przywracania
- **Deep Planning**: 4-krokowy proces generujacy implementation_plan.md
- **Subagents (read-only)**: Rownolegle agenci do researchu bez zapisu
- **Browser automation**: Wbudowana kontrola Chrome z capturowaniem console logow

### OpenHands
- **CodeActAgent**: Zunifikowana przestrzen akcji (bash + Python w jednym)
- **Docker sandbox**: Pelna izolacja kontenera per sesja
- **Platforma badawcza**: Artykul ICLR 2025, 15+ benchmarkow

### Plandex
- **Build Race**: 3 strategie budowania dzialaja rownolegle — pierwsza poprawna wygrywa
- **3-typowy failover**: LargeContextFallback (lancuch do 10), ErrorFallback, StrongModelFallback
- **9 rol modelowych**: Najbardziej wyspecjalizowany pipeline w pojedynczym narzedziu
- **16 model packs**: Gotowe konfiguracje modeli per zastosowanie
- **5 poziomow autonomii**: Od None (pelna reczna kontrola) do Full (pelna automatyzacja)
- **Two-phase "Decide and Declare"**: Architect wybiera kontekst z `<PlandexFinish/>`, potem implementacja

### Codex CLI
- **Guardian AI**: Subagent gpt-5.4 oceniajacy ryzyko w skali 0-100 (prog <80)
- **Auto-Memory (2 fazy)**: Phase 1 (gpt-5.1-codex-mini, ekstrakcja) + Phase 2 (gpt-5.3-codex, konsolidacja)
- **ExecPolicy (Starlark)**: Jezyk polityki wykonywania z testowalnymi przykladami
- **Natywny sandbox per OS**: Seatbelt (macOS), Landlock+seccomp (Linux), Restricted Tokens (Windows)
- **Network Proxy**: Pelna kontrola ruchu sieciowego na poziomie proxy
- **Bidirectional MCP**: Klient + serwer MCP

### Claude Code
- **Auto-memory**: AI autonomicznie decyduje co zapamietac (bez instrukcji uzytkownika)
- **12+ typow hookow**: Najbogatsza paleta lifecycle hooks
- **Confidence scoring**: Ocena 0-100 dla code review (prog >=80)
- **CLAUDE.md hierarchy**: 4 zakresy (Managed, Project, User, Local)
- **Git worktree isolation**: --worktree flag do rownoleglych sesji
- **Extended thinking**: 3 poziomy wysilku + "ultrathink" keyword
- **1M context window** (beta): Najwyzszy pojedynczy limit kontekstu

### OpenCode
- **PubSub event bus**: Wlasny broker publish-subscribe dla wszystkich serwisow
- **SQLite-first**: Caly stan (sesje, wiadomosci, pliki) w jednej bazie SQLite
- **Pelny klient LSP**: 28+ metod, nie tylko diagnostyka
- **Kompakcja 95%**: Automatyczne streszczanie z linkowaniem sesji
- **10 providerów, ~79 modeli**: Bezposrednie SDK (bez LiteLLM)

### OMO
- **11 agentow z 3-warstwowa orkiestracja**: Najbardziej rozbudowany multi-agent system
- **Ralph Loop**: Samoreferencyjne petla pracy az do ukonczenia
- **Ultrawork Mode**: "ulw" aktywuje pelna autonomie
- **IntentGate**: Klasyfikacja intencji uzytkownika (pytanie vs polecenie)
- **Todo Continuation Enforcer**: Wymuszanie ukonczenia wszystkich zadan
- **Category-based delegation**: Semantyczne kategorie zamiast nazw modeli
- **3 wbudowane MCP**: Exa (web search), Context7 (docs), Grep.app (kod na GH)
- **Preemptive Compaction**: Kompresja kontekstu PRZED przekroczeniem limitu
- **44 lifecycle hooks**: Najbogatsza paleta hookow (5 warstw)

---

## 14. Znane problemy i slabosci

### Aider
- Brak sandboxa — dzialanie bezposrednio w systemie
- "Interactive, not agentic" — wymaga aktywnej obecnosci uzytkownika
- Brak GUI/TUI — czysty CLI
- Brak wsparcia MCP

### Cline
- Auto-approve + autonomia = ryzyko destrukcyjnych zmian
- Browser: staly viewport 900x600, jedna przegladarka jednoczesnie
- Subagents: eksperymentalne, nie moga pisac plikow
- Wysokie zuzycie tokenow przy duzych projektach

### OpenHands
- Wymaga Dockera — nie dziala bez kontenera
- Ograniczona dokumentacja specyficznych mechanizmow (condenser)
- Event-driven architektura moze byc trudna do debugowania
- Brak dedykowanego CLI (glownie web UI)

### Plandex
- Plandex Cloud wygaszany — wymaga self-hostingu
- Brak MCP support
- Brak hookow
- AGPLv3 — restrykcyjna licencja dla uzycia komercyjnego
- Rewind domyslnie NIE cofa zmian w plikach (zaskakujace zachowanie)
- Full auto mode moze byc destrukcyjny

### Codex CLI
- **Eksperymentalny status** — wiele funkcji niestabilnych
- Brak publicznych benchmarkow
- Glownie testowane z OpenAI — inne providery moga dzialac gorzej
- Zlozonosc konfiguracji (sandbox + approval + rules + features)
- Guardian AI, Memory, Multi-agents — wszystko eksperymentalne

### Claude Code
- **Vendor lock-in**: Tylko Anthropic (jedyny provider)
- ~6500 otwartych issues na GitHubie
- Kontekst szybko sie zapelnia → degradacja jakosci
- Trust-then-verify gap: produkuje wiarygodnie wygladajacy ale zepsuty kod
- Over-specified CLAUDE.md: Claude ignoruje polowe jesli za dlugie
- Sredni koszt $6/dzien moze byc wysoki dla indywidualnych developerow

### OpenCode
- **ZARCHIWIZOWANY** — brak dalszego rozwoju
- Git abuse na duzych repo (#3176): `git add .` na 45GB bez .gitignore
- Copilot premium token drain (#8030): syntetyczne wiadomosci zuzywaja premium tokeny
- Windows support: 11/23 sub-issues po 7+ miesiacach
- "Model problem" (#1357): odmowa adaptacji narzedzi do slabszych modeli — "to wina modelu"
- TUI niestabilny: zawieszanie, stuck na "generating"
- Niezmerge'owane PR-y spolecznosci (speech-to-text, vim motions)

### OMO
- **Orkiestracja zbyt agresywna** (#1081): "3/5 plans started without my acknowledgement"
- Nieskonczona petla TODO (#668): todo continuation dziala w nieskonczonosc, historia znika
- Anthropic bany (#158): uzytkownicy raportuja bany kont Claude Max po intensywnym uzyciu
- Git-master skill moze byc destrukcyjny
- Wymaga OpenCode jako bazy — nie dziala samodzielnie
- Stroma krzywa uczenia sie systemu orkiestracji
- Wyzsze zuzycie tokenow przez rownolegle agenty
- Fałszywa strona ohmyopencode.com (nie afiliowana z projektem)

---

## 15. Tabela porownawcza

### Architektura i interfejs

| Cecha | Aider | Cline | OpenHands | Plandex | Codex CLI | Claude Code | OpenCode | OMO |
|-------|-------|-------|-----------|---------|-----------|-------------|----------|-----|
| Jezyk | Python | TS | Python/TS | Go | Rust | TS | Go | TS |
| Interfejs | CLI | IDE ext. | Web UI | CLI | CLI/TUI | CLI/Desktop/Web | TUI | Plugin |
| Sandbox | Brak | Shadow Git | Docker | Git server | OS-native | Permission+OS | Brak | Dziedzicz. |
| Multi-agent | 2 tryby | Subagents | 1 agent | 9 rol | 4+ agentow | Subagents | 4 agenty | 11 agentow |
| MCP | Nie | Tak | Tak | Nie | Tak (bi-dir) | Tak | Tak | 3 wbudowane |

### Modele i providery

| Cecha | Aider | Cline | OpenHands | Plandex | Codex CLI | Claude Code | OpenCode | OMO |
|-------|-------|-------|-----------|---------|-----------|-------------|----------|-----|
| Multi-provider | Tak | 30+ | Tak | Tak | Glownie OpenAI | Tylko Anthropic | 10 providerow | Dziedzicz.+fallback |
| Routing modeli | Architect/Editor | Plan/Act mode | Konfig. | 9 rol × 16 packs | Guardian+model | opusplan | Per agent | Category-based |
| Prompt caching | Anthropic+DeepSeek | Nie | Nie | Nie | Nie (natywne) | Natywne (Anthropic) | Nie | Nie |

### Bezpieczenstwo i kontrola

| Cecha | Aider | Cline | OpenHands | Plandex | Codex CLI | Claude Code | OpenCode | OMO |
|-------|-------|-------|-----------|---------|-----------|-------------|----------|-----|
| Sandboxing | Brak | Shadow Git | Docker | Git sandbox | OS-native (3 OS) | Permission+OS | Brak | Dziedzicz. |
| Izolacja sieciowa | Brak | Brak | Docker net | Brak | Proxy+seccomp | Sandboxing | Brak | Brak |
| Hooki | Brak | Tak | Brak | Brak | ExecPolicy | 12+ typow | Brak | 44 (5 warstw) |
| Auto-approve | Tak (opcjonalnie) | Tak (z checkpoints) | Tak | 5 poziomow | 3 polityki | 5 trybow | Sesyjne | Ralph Loop |

### Zarzadzanie kontekstem

| Cecha | Aider | Cline | OpenHands | Plandex | Codex CLI | Claude Code | OpenCode | OMO |
|-------|-------|-------|-----------|---------|-----------|-------------|----------|-----|
| Maks. kontekst | Model-dependent | 400K+ | Model-dep. | 2M | Model-dep. | 1M (beta) | Model-dep. | Dziedzicz. |
| Strategia | Repo Map (PageRank) | Auto-Compact | Condenser | Sliding window | Auto-compaction | Sliding compaction | 95% kompakcja | Preemptive |
| Pamiec trwala | Brak | Memory Bank | Brak | ConvoSummary | Auto-Memory (2 fazy) | CLAUDE.md (auto) | SQLite | AGENTS.md inject |

### Benchmarki i spolecznosc

| Cecha | Aider | Cline | OpenHands | Plandex | Codex CLI | Claude Code | OpenCode | OMO |
|-------|-------|-------|-----------|---------|-----------|-------------|----------|-----|
| SWE-bench | 18.9% Main | — | Ewaluowany | — | — | — | — | — |
| Inne benchmarki | 88% Polyglot | 57% TermBench | 15+ bench. | — | — | — | — | — |
| Gwiazdki GH | ~25K | 58.8K | ~45K | 14K | 63.8K | ~37K | ~108K | ~33K |
| Licencja | Apache 2.0 | Open-source | MIT | AGPLv3 | Apache 2.0 | Proprietary | MIT | MIT |
| Status | Aktywny | Aktywny | Aktywny | Aktywny | Eksperym. | Aktywny | Zarchiwiz. | Aktywny |

---

## 16. Opinie uzytkownikow z forow i blogow

> Zrodla: Hacker News, Reddit, blogi techniczne. Cytaty z 2025-2026.

### 16.1 Porownania bezposrednie (head-to-head)

#### Aider vs Claude Code

**Zrodlo**: Blog "Claude Code vs Aider" — Andrew Keenan Richardson (mechanisticmind.substack.com, marzec 2025)

Szczegolowe porownanie obu narzedzi w praktyce:

| Aspekt | Aider | Claude Code | Zwyciezca wg autora |
|--------|-------|-------------|---------------------|
| Szybkosc odpowiedzi | Streamuje myslenie w czasie rzeczywistym | Wolniejszy, wieloetapowe wewnetrzne rozumowanie | Aider |
| Rozumienie repozytorium | Repo Map (tree-sitter), uzytkownik wybiera pliki | Autonomicznie przeszukuje grep-em, sam decyduje o plikach | Claude Code |
| Przejrzystosc | Transparentny — widac myslenie i edycje LLM | Surfacuje tresc tylko przy pytaniach/odpowiedziach/uprawnieniach | Aider |
| Elastycznosc modeli | Wiele LLM-ow | Tylko Claude (Anthropic) | Aider |

**Aktualizacja autora (kwiecien 2025)**: *"Claude Code does better with complex requests, especially in larger codebases. I now use CC for serious requests, Aider for smaller tasks."*

**Przeplyw pracy Aider**: repomap (tree-sitter) → prompt → odpowiedz LLM → Search+Replace → lint check

**Przeplyw pracy Claude Code**: agent z narzedziami (View, Edit, Replace, LS, GlobTool, GrepTool, Bash, BatchTool, dispatch_agent) → autonomiczne wieloetapowe rozumowanie

#### Plandex vs inne narzedzia

**Zrodlo**: Dyskusja HN o Plandex v2 (257 punktow, 81 komentarzy, kwiecien 2025)

Tworca Plandex (Dane/Nathaniel) o roznicach:

**Plandex vs Aider**: *"Plandex is more agentic. Changes applied to sandbox by default. Can auto-find context. Can execute commands and auto-debug. Uses enhanced version of aider's diff-style edit with validation, whole file fallback, and custom fast apply model."*

**Plandex vs Claude Code & Codex CLI**: *"All three are agentic coding tools with CLI. Plandex's edge: combines best models from multiple providers (Sonnet 3.7 for planning/coding, o3-mini for file edits). Single provider never has best models across the board."*

**Plandex vs Cursor**: *"Cursor works better for smaller, more localized changes. Plandex better for tasks involving many steps, many files. Terminal is naturally better fit for executing scripts, installing dependencies, running tests."*

#### CLI vs IDE — debata

**Uzytkownik ramesh31** (HN, watek Plandex v2): *"CLI interfaces are not where it's at for this stuff. What makes Cline the king of codegen agents IMO is how well they handle displaying the code, opening files, and scrolling the cursor as it changes."*

**Uzytkownik maxwelljoslyn** (HN, watek Plandex v2): *"I bounce back and forth between Aider, Claude Code, and Simon Willison's LLM tool. Claude Code has started to win me over for straightforward stuff."*

**Uzytkownik killerstorm** (HN, watek Plandex v2, o Plandex): *"It does not want to discuss the plan with me but just jumps to implementation."*

**Uzytkownik davidpolberger** (HN, Tell HN, luty 2026): *"The new Codex CLI works incredibly well. It offers a terminal interface that doesn't make my fans spin up or render at single-digit FPS, unlike Claude Code. It also supports other TUIs like OpenCode."*

### 16.2 Opinie o poszczegolnych narzedziach

#### Claude Code

**Uzytkownik bv_dev** (HN, "My 600 Hours with AI Coding Assistants", maj 2025):
*"Declining quality since public beta. Super expensive. Spent $500 in Feb-Mar. Recent updates significantly degraded agentic capabilities."*

Ranking tego uzytkownika (dla zlozonych zadan): Augment Code > Windsurf > Cursor > Claude Code > Cline/Aider

#### Cline

**Uzytkownik bv_dev**: *"Good terminal integration"* — ale: *"Conceptually interesting but practically limited. Struggles with maintaining context; limited understanding of project structure; frequent need to repeat instructions."*

**Uzytkownik ramesh31** (HN): Uwaza Cline za "king of codegen agents" ze wzgledu na wizualna integracje z IDE — wyswietlanie kodu, otwieranie plikow, przewijanie kursora w czasie edycji.

#### Aider

**Uzytkownik bv_dev**: *"Straightforward CLI"* — ale te same ograniczenia co Cline: problemy z utrzymaniem kontekstu, ograniczone rozumienie struktury projektu.

**Blog mechanisticmind**: Aider jest szybszy i bardziej przejrzysty, ale Claude Code lepiej radzi sobie z duzymi, zlozoymi zadaniami.

#### Plandex

**Uzytkownik killerstorm** (HN): Probowal Plandex, znalazl problemy z UX — *"it does not want to discuss the plan with me but just jumps to implementation."*

**Koszt wg tworcow**: ~$10 za dodanie feature do 200K-liniowego codebase w Go (~15 zmodyfikowanych plikow, ~10 promptow w chacie).

#### Codex CLI

**Uzytkownik davidpolberger** (HN, luty 2026): *"The new Codex CLI works incredibly well. It offers a terminal interface that doesn't make my fans spin up or render at single-digit FPS, unlike Claude Code."*

**Uzytkownik codingmoh** (HN, Show HN "Open Codex", 106 punktow): Probowal rozszerzyc Codex CLI, znalazl problemy: *"Their code has several leaky abstractions, which made it hard to override core behavior cleanly."*

#### OpenCode

**Lancz HN**: 319 punktow, 91 komentarzy (lipiec 2025) — silne zainteresowanie spolecznosci.

**Status**: Projekt zarchiwizowany — zespol Charm przeszedl na nowy projekt "Crush".

#### Oh-My-OpenCode (OMO)

**Uzytkownik soungmin114** (HN, luty 2026, "Oh-My-OpenClaw" — port OMO na platformy czatowe):

Ograniczenia OMO wg tego uzytkownika:
*"Being terminal-only kept bugging me. Can't kick off work from phone. No async workflow. Can't run multiple tasks in parallel. Sometimes comes back and it's just sitting there waiting for a clarification question."*

Potwierdzenie architektury OMO:
*"11 specialized agents, auto-orchestrated. Prometheus plans, Atlas orchestrates, Sisyphus-Junior implements, Oracle architects, Momus reviews."*

Routing modeli w OMO:
*"Simple search? Sonnet. Complex refactor? Opus. Architecture decision? GPT-5.3 Codex. Visual/UI work? Gemini 3.1 Pro."*

### 16.3 Koszty w praktyce (dane od uzytkownikow)

| Narzedzie | Koszt raportowany | Zrodlo |
|-----------|-------------------|--------|
| Claude Code | $500 w 2 miesiace (luty-marzec 2025) | bv_dev, HN "600 Hours" |
| Claude Code | ~$6/dzien (srednia z dokumentacji) | Anthropic docs |
| Plandex | ~$10 za feature w 200K-liniowym codebase | Tworca Plandex, HN |
| Codex CLI | $200/mies. (plan Codex Pro) | OpenAI pricing |
| Aider | Koszt API (brak wlasnej subskrypcji) | — |
| Cline | Koszt API (brak wlasnej subskrypcji) | — |
| OpenHands | Koszt API (brak wlasnej subskrypcji) | — |
| OMO | Koszt API (brak wlasnej subskrypcji) | — |

**Uzytkownik bv_dev o kosztach Claude Code**: *"Super expensive. Spent $500 in Feb-Mar."* — to przy intensywnym uzyciu (~600 godzin lacznie ze wszystkimi narzedziami).

### 16.4 Problemy zglaszane przez uzytkownikow

#### Orkiestracja wielu agentow jednoczesnie

**Uzytkownik parsak** (HN, 300K-liniowe monorepo): *"At any given moment I have 3-6 CLI agents (Claude Code, Codex, Aider) running simultaneously across git worktrees. The throughput is great. Managing it is not."*

**Uzytkownik denis4inet** (HN): *"I've been running an increasing number of local coding agents (Claude Code, Codex CLI, OpenCode, etc.) and I've hit a wall: orchestration and state visibility."*

Problem jest powszechny — wielu uzytkownikow uruchamia kilka agentow rownolegle w osobnych git worktrees, ale brakuje narzedzi do zarzadzania tym procesem.

#### Bezpieczenstwo i prywatnosc

**Uzytkownik slimebot80** (HN): *"How do we know what is being uploaded and accessed? Recently there's been chat about Cursor moving outside of a project directory and deleting folders."*

Obawy dotycza:
- Agenci wykonujacy komendy w terminalu maja pelny dostep do systemu plikow
- Brak pewnosci co do danych wysylanych do API
- Incydenty z Cursor wychodzacym poza katalog projektu

#### Spadek jakosci modeli

**Uzytkownik bv_dev** o Claude Code: *"Declining quality since public beta. Recent updates significantly degraded agentic capabilities."*

To czesty wzorzec — uzytkownik ma pozytywne doswiadczenie na poczatku, ale aktualizacje modelu lub produktu pogarszaja jakosc.

#### UX agentow planujacych

**Uzytkownik killerstorm** o Plandex: *"It does not want to discuss the plan with me but just jumps to implementation."*

**Uzytkownik o OMO** (GitHub #1081): *"3/5 plans started without my acknowledgement"*

Problem wspolny dla narzedziowych agentow "planujacych" — czesto pomijaja faze konsultacji z uzytkownikiem i od razu przystepuja do implementacji.

### 16.5 Wielonarzedziowe workflow-y

Wielu doswiadczonych uzytkownikow nie wybiera jednego narzedzia — laczy kilka:

**Uzytkownik maxwelljoslyn**: Aider + Claude Code + LLM (Simon Willison) — rozne narzedzia do roznych zadan.

**Uzytkownik parsak**: 3-6 agentow (Claude Code, Codex, Aider) jednoczesnie w git worktrees.

**Blog mechanisticmind**: Claude Code do zlozonych zadan w duzych codebasach, Aider do mniejszych zadan.

**Uzytkownik bv_dev**: Ranking na podstawie 600 godzin uzywania — rozne narzedzia sprawdzaja sie w roznych scenariuszach.

Wynika z tego, ze nie ma jednego "najlepszego" narzedzia — wybor zalezy od:
- Wielkosc i zlozonosc codebase
- Typ zadania (maly fix vs duzy feature)
- Preferencja CLI vs IDE
- Budzet na koszty API
- Potrzeba autonomii vs kontroli


### 16.6 Opinie z Reddit

#### Claude Code — dominujacy ale drogi

**u/thewritingwallah** (r/ClaudeCode, 57 upvotes, "Claude Code vs Competition: Why I Switched My Entire Workflow"):
*"I switched to Claude Code after switching between Copilot, Cursor and basically every AI coding tool for almost half a year. It changed how I build software now but it's expensive and has a learning curve and definitely isn't for everyone."*

*"Most people think Claude Code is just another autocomplete tool. It's not. Claude Code is like a developer living in my terminal who actually does the work while I review."*

Porownanie workflow-ow wg tego uzytkownika:
- **Copilot**: Sugeruje funkcje w trakcie pisania, reszta recznie
- **Cursor**: Agent mode — pokazuje diffy, uzytkownik akceptuje/odrzuca
- **Claude Code**: Czyta codebase, implementuje, aktualizuje middleware, pisze testy, uruchamia je, naprawia bledy, commituje — uzytkownik tylko recenzuje diff

#### Lokalne modele vs Claude Code

**u/Accomplished-Toe7014** (r/LocalLLaMA, 10 upvotes, "Local Coding Agents vs. Claude Code"):
*"I'm deep into Claude Code for real dev work (multi-file refactors, reasoning across a repo, agent loops). It's the first tool that feels reliably 'senior enough' most days."*

*"But I'm uneasy depending on a closed hosted model long-term. Prices can jump, quality can drift, access can change."*

Pytanie: *"Is the best OSS stack today (Qwen2.5-Coder / DeepSeek / Codestral + Aider/Continue/OpenHands) genuinely close to Claude Code for real repo work? Or is it still 'good demos, more friction, more babysitting'?"*

#### OpenCode z lokalnymi modelami

**u/jslominski** (r/LocalLLaMA, 1140 upvotes, "Qwen3.5-35B-A3B is a gamechanger for agentic coding"):
*"Just tested this badboy with OpenCode cause frankly I couldn't believe those benchmarks. Running it on a single RTX 3090."*

*"This is the first open weights model I was able to utilise on my home hardware to successfully complete my own 'coding test' I used for years for recruitment (mid lvl mobile dev, around 5h to complete 'pre AI'). It did it in around 10 minutes, strong pass."*

Wazne: OpenCode jest jedynym z analizowanych narzedzi CLI ktore jest czesto wymieniane w kontekscie uruchamiania z lokalnymi modelami (dzieki obsludze 10+ providerow i ~79 modeli).

#### Problem poszukiwania "lokalnego Claude Code"

**u/bookface123** (r/selfhosted, "Help me decide on a local claude code alternative"):
*"I have tried claude code with local models, opencode, open interpreter, mistral vibe, n8n and telegram with ssh, openwebui functions, etc but nothing seems to 'just work' as well as claude code."*

*"VS code and aider, void, and aiderdesk all had issues as well. I just want a local agent that can ssh into my devices and fix errors."*

Ten uzytkownik probowal wiele z analizowanych narzedzi — zaden lokalny zamiennik nie dorownuje Claude Code w latwosc uzycia.

#### Koszt na Pull Request — nowa metryka

**u/n4r735** (r/AI_Agents, "Dollar-Pull-Request Index for Coding Agents"):
*"Anyone else suffering from token anxiety? I recently learned about this terminology, just as I was exceeding the $1,000 psychological threshold on Claude Code."*

Zaproponowal metryki "Dollar-Per-Pull-Request" (DPR) — koszt agenta kodujacego na zmergowany PR. Pomysl: uzytkownik exportuje dane OpenTelemetry z agenta, laczy z danymi GitHub, i otrzymuje stosunek koszt/PR. Ciekawy kierunek standaryzacji porownywania efektywnosci narzedzi.

#### Sceptycyzm wobec agentycznego kodowania

**u/zero2g** (r/ExperiencedDevs, 667 upvotes, "What happened that suddenly people are having their come to Jesus moment with AI and Agentic Coding?"):
*"I have seen a whiplash shift of sentiment [...] Agentic Coding becoming not just accepted but actively pushed, a stark contrast compared to earlier this year where the majority conclusion was it's not going to lead you anywhere being productive."*

*"Studies published earlier this year found developers were actually less productive but think they were more productive."*

Watek podsumowuje napieice miedzy entuzjastami agentycznego kodowania (Claude Code, Codex) a sceptykami powolujacymi sie na badania naukowe.

---

## Zrodla

### Oficjalna dokumentacja
- Aider: https://aider.chat/docs/ (repo map, edit formats, leaderboards, benchmarks)
- Cline: https://docs.cline.bot/ (checkpoints, plan&act, subagents, deep planning, model selection)
- OpenHands: https://docs.openhands.dev/ + arXiv:2407.16741
- Plandex: https://docs.plandex.ai/ (plans, context, roles, autonomy, models)
- Codex CLI: https://developers.openai.com/codex (sandboxing, multi-agents, security, models)
- Claude Code: https://docs.anthropic.com/en/docs/claude-code + https://code.claude.com/docs/
- OpenCode: https://opencode.ai/docs/ + https://github.com/opencode-ai/opencode
- OMO: https://github.com/code-yeongyu/oh-my-opencode (README, docs/features, orchestration, ultrawork manifesto)

### Repozytoria kodu zrodlowego
- Aider: github.com/Aider-AI/aider
- Cline: github.com/cline/cline
- OpenHands: github.com/All-Hands-AI/OpenHands
- Plandex: github.com/plandex-ai/plandex
- Codex CLI: github.com/openai/codex
- Claude Code: github.com/anthropics/claude-code
- OpenCode: github.com/opencode-ai/opencode (zarchiwizowany)
- OMO: github.com/code-yeongyu/oh-my-opencode

### Artykuly i blogi
- Aider: aider.chat/2024/06/02/main-swe-bench.html, /2024/05/22/swe-bench-lite.html, /2024/08/14/code-in-json.html, /2023/12/21/unified-diffs.html
- Cline: cline.bot/blog/a-practical-guide-to-hill-climbing (Terminal Bench methodology)
- OpenHands: arXiv:2407.16741 (ICLR 2025)
- Codex CLI: Product Hunt reviews (5.0/5, 215 followers)

### Recenzje uzytkownikow
- Codex CLI (Product Hunt): "Lacks multi-step autonomy compared to Claude Code" — Takuji Ogawa
- OMO (Twitter/X testimonials): "Knocked out 8000 eslint warnings in a day" — Jacob Ferrari
- OMO: "Converted 45k line tauri app to SaaS overnight using Ralph Loop" — James Hargis
- Claude Code (docs/best-practices): "Trust-then-verify gap: produces plausible-looking but broken code"
- OpenCode (#1357): "Model problem — odmowa adaptacji narzedzi do slabszych modeli"
- OMO (#1081): "3/5 plans started without my acknowledgement"

---

### Zrodla forow i blogow (sekcja 16)
- Blog: mechanisticmind.substack.com/p/claude-code-vs-aider (marzec 2025)
- HN: Plandex v2 launch — news.ycombinator.com/item?id=43710576 (257 punktow, 81 komentarzy)
- HN: Codex CLI launch — news.ycombinator.com/item?id=43708025 (516 punktow, 289 komentarzy)
- HN: OpenCode launch — news.ycombinator.com/item?id=44482504 (319 punktow, 91 komentarzy)
- HN: "My 600 Hours with AI Coding Assistants" — news.ycombinator.com/item?id=43986580
- HN: Oh-My-OpenClaw — news.ycombinator.com/item?id=47161721
- Reddit: r/ClaudeCode, r/LocalLLaMA, r/ExperiencedDevs, r/AI_Agents, r/selfhosted
