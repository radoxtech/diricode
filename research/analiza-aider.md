# Analiza Konkurencyjna: Aider

> Data: 8 marca 2026
> Wersja analizowana: HEAD repozytorium (marzec 2026)
> Repo: https://github.com/Aider-AI/aider

---

## 1. Podsumowanie

Aider to open-source'owy CLI coding agent napisany w Pythonie, skoncentrowany na **git-native** workflow i **pair programming** z LLM. Jego glowna przewaga to **Repository Map** — zaawansowany system indeksowania kodu oparty na Tree-sitter AST + PageRank (networkx), ktory automatycznie buduje graf zaleznosci miedzy plikami i identyfikatorami, a nastepnie rankinguje pliki wedlug istotnosci dla biezacego zadania. Aider obsługuje 14 roznych formatow edycji (od SEARCH/REPLACE po Architect mode z dwoma modelami) i posiada rozbudowana integracje z 50+ modelami LLM przez LiteLLM. Architektura jest **monolityczna** — klasa `Coder` (2485 linii) jest god-classem zawierajacym cala logike. Brak systemu hookow, pluginow, MCP, delegacji agentowej czy approval workflow. To jednoagentowe narzedzie zoptymalizowane pod szybkosc i prostote, nie pod rozszerzalnosc.

---

## 2. Matryca Porownawcza

### A. Tozsamosc i Pozycjonowanie

| Pytanie | Aider | DiriCode |
|---------|-------|----------|
| Nazwa, licencja, jezyk implementacji | Aider, Apache-2.0, Python | DiriCode, MIT (planowane), TypeScript |
| Glowny target user | Solo dev, pair programming z AI | Solo developer |
| Interfejs | CLI (czysty terminal, brak TUI) | CLI (TUI Ink/React z vim motions) |
| GitHub stats | ~30K+ gwiazdek, wielu kontrybutorów, Paul Gauthier = jedyny core dev (bus factor = 1) | Nowy projekt |
| Model biznesowy | OSS (Apache-2.0), BYOK | OSS (MIT), BYOK |
| Pozycjonowanie | "AI pair programming in your terminal" — nacisk na git-native workflow i edit quality | Lokalny CLI agent AI z architektura dispatcher-first |

**Wniosek:** Oba projekty celuja w solo dev z BYOK, ale Aider pozycjonuje sie jako "pair programmer" (jeden agent, interaktywny), DiriCode jako "dyrygent" (orchestrator wielu agentow). Fundamentalnie rozne filozofie.

### B. Architektura Agenta

| Aspekt | Aider | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Ile agentow / rol? | **1 agent** (Coder) z 14 wariantami edit formatu. Brak wydzielonych agentow — jeden monolityczny Coder robi wszystko | Dispatcher + 10 specjalistow | Aider = single-agent monolith. DiriCode = multi-agent z separacja odpowiedzialnosci |
| Czy agent glowny ma dostep do narzedzi modyfikujacych? | Tak — Coder ma pelny dostep: edycja plikow, bash, git commit, linting. Wszystko w jednej klasie `base_coder.py` (2485 linii) | NIE (read-only dispatcher) | DiriCode bezpieczniejszy by design. Aider nie ma koncepcji read-only agenta |
| Jak wyglada delegacja? | **Brak delegacji**. Jedyny wyjątek: Architect mode — `ArchitectCoder` (48 linii, `architect_coder.py`) tworzy wewnetrzny `editor_coder` do wykonania edycji. To nie jest delegacja agentowa, a raczej two-step pipeline | Unlimited nesting + loop detector | DiriCode fundamentalnie bardziej elastyczny. Aider nie ma koncepcji sub-agentow |
| Czy jest loop detection / fail-safe? | `max_reflections=3` w `base_coder.py` — jesli LLM nie moze poprawnie zastosowac edycji, powtarza max 3 razy, potem rezygnuje. Brak wykrywania petli semantycznych | Tak (ADR-003: hard limit, token budget, loop detector) | DiriCode ma znacznie bardziej rozbudowane zabezpieczenia |
| Jak zarzadzaja kontekstem agenta? | System prompt + repo map + chat files + read-only files + chat history + lint/test output — wszystko w jednym kontekscie `ChatChunks` (`base_coder.py`). Caly kontekst leci do jednego wywolania LLM | Dispatcher = minimalny kontekst, per-agent model assignment | Aider zuzywa wiecej tokenow na wywolanie (brak separacji kontekstu). DiriCode oszczedniejszy |

**Wniosek:** Aider to **anty-teza** architektury DiriCode. Jeden god-class robi wszystko, zero delegacji, zero separacji. Dziala dobrze dla prostych zadan pair-programming, ale nie skaluje sie do zlozonych wieloetapowych workflow. Potwierdza decyzje ADR-002 (dispatcher-first) i ADR-003 (delegacja).

### C. Zrozumienie Kodu (Code Intelligence)

| Aspekt | Aider | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Jak "widzi" codebase? | **Repository Map** (`repomap.py`) — Tree-sitter AST parsuje definicje i referencje, buduje graf `networkx.MultiDiGraph`, PageRank rankinguje waznosc plikow. Personalizacja: chat files ×50 waga, wspomniane identyfikatory ×10 | glob + grep + AST-grep + LSP | **KLUCZOWA LUKA DiriCode.** Aider ma pelny graf zaleznosci z rankingiem, DiriCode polega na heurystykach agenta |
| Czy parsuje strukture kodu? | Tak — Tree-sitter `.scm` query files dla 30+ jezykow (Python, JS/TS, Java, Go, Rust, C/C++, Ruby, PHP, Elixir, Kotlin, Swift, Scala, itd.). Wyciaga: definicje klas, funkcji, metod, referencje do identyfikatorow. Plik: `queries/tree-sitter-python-tags.scm` | AST-grep + LSP | Aider ma wiecej jezykow i automatyczne ekstrakcje. DiriCode ma LSP (lepsze per-plik), ale brak automatycznego grafu |
| Jak wybiera pliki do kontekstu? | **Automatycznie przez PageRank.** Algorytm: (1) parsuj AST wszystkich plikow, (2) zbuduj graf referencji, (3) wagi: chat files ×50, wspomniane identyfikatory ×10, (4) PageRank, (5) binary search aby zmiescic w limicie tokenow. Wynik: posortowana lista `filename: class/function signatures`. Cache: `diskcache` | Agent dispatcher decyduje na podstawie opisu zadania | Aider automatyczny i deterministyczny. DiriCode zalezy od jakosci promptu dispatchera. Aider lepszy dla duzych repo |
| Czy ma LSP integration? | **NIE.** Brak LSP. Cale code intelligence opiera sie na Tree-sitter repo map | Tak, top-10 jezykow lazy install | DiriCode ma LSP (goto-definition, find-references, rename, diagnostics), czego Aider nie ma. Ale Aider ma repo map, czego DiriCode nie ma |
| Jak radzi sobie z duzymi repozytoriami? | Dobrze — `diskcache` persistuje repo map miedzy sesjami. Binary search dopasowuje wielkosc mapy do dostepnego kontekstu. `.aiderignore` wyklucza pliki. Plik `special.py` okresla "wazne pliki" (README, setup.py, package.json) z priorytetem | Nieznane — potencjalna luka | Aider ma dojrzaly mechanizm skalowania. DiriCode musi zaadresowac duze repo w MVP lub v2 |

**Wniosek:** To jest **NAJWAZNIEJSZE odkrycie analizy.** Repository Map Aidera to killer feature — automatycznie buduje graf zaleznosci 30+ jezykow, rankinguje PageRankiem, i kompresuje do limitu tokenow. DiriCode nie ma nic porównywalnego. AST-grep + LSP DiriCode sa lepsze per-plik (semantyczne), ale brak globalnego grafu repo. **Rekomendacja: DiriCode powinien zaimplementowac wlasny Repository Map (ADR nowy)** — moze oparty na LSP symbols + graf referencji zamiast Tree-sitter queries, co byloby bardziej precyzyjne.

### D. Routing i Obsluga Modeli

| Aspekt | Aider | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Ile providerow / modeli? | 50+ skonfigurowanych modeli w `models.py` i `model-settings.yml`. Aliasy: sonnet, opus, deepseek, flash, gemini, gpt-4o, o1, o3, itd. Routing przez **LiteLLM** | 22 providerow via Vercel AI SDK | Porownywalna liczba. Aider przez LiteLLM, DiriCode przez Vercel AI SDK |
| Czy ma failover? | **NIE.** Brak automatycznego failover. Retry z exponential backoff na tym samym modelu (`sendchat.py`). Jesli model nie dziala — blad | Tak (ADR-011: order-based failover) | DiriCode znacznie lepszy — failover order-based |
| Czy ma race mode? | **NIE.** Brak parallel requests. Jeden model, jeden request na raz | Tak (ADR-011: race mode) | DiriCode lepszy |
| Per-agent model assignment? | **Czesciowe.** Architect mode: osobny model dla "planisty" i "edytora" (`architect_coder.py`). Chat summary: `weak_model` (tani model do kompakcji, `history.py`). Lint-fix: `lint_coder` (klon z osobna sesja). Ale to nie sa agenci — to instancje tego samego Codera | Tak (dispatcher=fast, writer=deep, itd.) | DiriCode ma pelnoprawne per-agent assignment. Aider ma ad-hoc model separation |
| Jak radzi sobie z non-Claude modelami? | Dobrze — `ModelSettings` w `models.py` definiuje per-model: `edit_format` (ktory format edycji dziala najlepiej), `use_repo_map`, `streaming`, `temperature`, `reasoning_tag`, `system_prompt_prefix`. Np. DeepSeek = `diff` format, Claude = `editor-diff`, GPT-4o = `diff` | Adaptery per provider — do zweryfikowania | Aider ma **dojrzala matyce kompatybilnosci modeli** — kazdy model ma optymalny edit format. DiriCode powinien zaadaptowac |
| Czy zalezy od LiteLLM? | **TAK — calkowicie.** `LazyLiteLLM` w `llm.py` leniwie importuje litellm. Cala komunikacja z LLM przechodzi przez litellm. `ModelInfoManager` uzywa litellm metadata z 24h TTL cache | NIE — wlasny TS Router (ADR-011) | DiriCode niezalezny od zewnetrznego routera. Aider w pelni zalezy od LiteLLM (Python dependency) |

**Wniosek:** Aider ma **doskonale per-model tuning** (edit format, temperature, repo map usage per model) — to warto zaadaptowac. Ale brak failover/race mode to powazan slabość. DiriCode lepszy w routing, Aider lepszy w per-model optimization.

### E. System Hookow i Rozszerzalnosc

| Aspekt | Aider | DiriCode | Wniosek |
|--------|-------|----------|---------|
| System hookow/pluginow? | **BRAK.** Zero hookow, zero pluginow, zero middleware. Monolityczna architektura. Jedyny extension point: konwencje (`.aider.conf.yml`, `--map-tokens`, `--edit-format`) | 12 lifecycle hooks, lazy loading | DiriCode fundamentalnie bardziej rozszerzalny |
| Ile extension points? | **3:** (1) config file `.aider.conf.yml`, (2) `.aiderignore` file, (3) CLI flags. To wszystko — brak programowego API | 12 hookow + MCP client + pliki .md agentow | DiriCode ma ~15+ extension points vs 3 w Aider |
| Custom agenci? | **NIE.** Brak koncepcji definiowania agentow. Uzytkownik moze jedynie zmienic model i edit format | Tak — `.diricode/agents/` | DiriCode lepszy |
| MCP support? | **NIE.** Brak MCP. Aider nie rozumie MCP protocol | Tak, GitHub MCP wbudowany + zewnetrzne | DiriCode lepszy |
| Konfiguracja | `.aider.conf.yml` (YAML) + env vars + CLI flags. Brak type safety, brak auto-complete | `diricode.config.ts` (type-safe) | DiriCode lepszy — type-safe config |
| Slash commands | **35+ wbudowanych** (`commands.py`): `/add`, `/drop`, `/run`, `/test`, `/lint`, `/web` (scraping), `/voice`, `/paste` (clipboard images), `/map`, `/tokens`, `/copy-context`, `/editor`, `/undo`, `/diff`, `/git`, `/commit` itd. | Planowane | Aider ma bardzo bogaty zestaw komend. Warto zaadaptowac kluczowe |

**Wniosek:** Aider to kompletne przeciwienstwo DiriCode pod wzgledem rozszerzalnosci. Zero hookow, zero pluginow, zero MCP — ale dziala dobrze dzieki dobremu core (repo map, edit formats). DiriCode ma zdecydowanie lepsza architekture rozszerzalnosci. Z Aidera warto wziac: bogaty zestaw slash commands.

### F. Bezpieczenstwo i Approval

| Aspekt | Aider | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Approval przed destrukcja? | **MINIMALNY.** `--auto-commits` (default on) — commituje automatycznie po kazdej edycji BEZ pytania. Bash commands wykonywane po sugestii LLM — uzytkownik widzi komende i moze ja odrzucic. Brak kategorizacji ryzyka | Tak (ADR-004: Smart — AI ocenia ryzyko) | DiriCode znacznie lepszy. Aider nie ma systematycznego approval |
| 3 kategorie ryzyka? | **NIE.** Brak kategoryzacji. Wszystkie operacje edycji sa auto-approved. Bash commands: LLM sugeruje, user potwierdza | Tak — safe/risky/destructive, konfigurowalne | DiriCode lepszy |
| Ochrona przed wyciekiem sekretow? | **NIE.** Brak secret redaction. Cala zawartosc plikow (w tym `.env` jesli dodany do chatu) leci do LLM bez filtrowania | Tak (ADR-014: auto-redakcja regex+heurystyki) | DiriCode znacznie lepszy |
| Sandboxing? | **NIE.** Brak sandboxing. Bash commands wykonywane bezposrednio w shellu usera | NIE w MVP (odlozony do v2) | Oba bez sandbox — akceptowalne dla solo dev |
| Git safety rails? | **Czesciowe.** Auto-commit po kazdej edycji (atomiczne, z LLM-generowanym Conventional Commits message). `/undo` cofa ostatni commit. Ale: brak blokady `git push --force`, brak blokady `git add .`, brak blokady `reset --hard` | Tak (ADR-010: blokada `git add .`, `push --force`, `reset --hard`) | DiriCode lepszy. Aider ma auto-commit (dobry pattern), ale brak safety rails na destrukcyjnych komendach git |
| Parsowanie bash? | **NIE.** Brak parsowania. LLM sugeruje komende jako string, uzytkownik widzi ja w terminalu i decyduje. Brak analizy co komenda robi | Tree-sitter (ADR-015) | DiriCode lepszy — AST-based parsing |

**Wniosek:** Bezpieczenstwo to **slaby punkt Aidera**. Brak secret redaction, brak approval categories, brak bash parsing, minimalne git safety rails. DiriCode jest znacznie bezpieczniejszy w kazdym wymiarze. Jedyny dobry pattern z Aidera: **auto-commit po kazdej edycji** z LLM-generowanym Conventional Commits message — warto zaadaptowac.

### G. Pamiec i Stan

| Aspekt | Aider | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Trwala pamiec miedzy sesjami? | **NIE.** Brak trwalej pamieci. Kazda sesja zaczyna od zera. Jedyny "stan": git history (auto-commity) i `.aider.conf.yml`. `diskcache` dla repo map — ale to cache techniczny, nie pamiec semantyczna | GitHub Issues jako project memory (ADR-007) | DiriCode lepszy — explicite project memory |
| Przechowywanie stanu zadan? | **NIE.** Brak TODO, brak progress tracking. Aider to narzedzie per-task, nie per-project | Pliki Markdown `.diricode/todo.md` (ADR-013) | DiriCode lepszy |
| Snapshot / undo? | **Tak — przez git.** Auto-commit po kazdej edycji = naturalny undo. `/undo` cofa ostatni commit (`repo.py`). Proste i skuteczne | Brak snapshota — git worktrees (ADR-008) | Oba opieraja sie na git. Aider auto-commit = lepszy UX (jeden krok undo). DiriCode git worktrees = lepsza izolacja |
| Context compaction? | `ChatSummary` w `history.py` — rekurencyjna strategia: (1) podziel historie na polowy, (2) podsumuj starsza polowe slabym modelem, (3) zachowaj nowsza polowe. max_chat_history_tokens = 1/16 context window (min 1K, max 8K). Dziala w background thread | Sliding window + summary na 90-95% (ADR-009) | Porownywalne podejscia. Aider uruchamia kompakcje wczesniej (1/16 context), DiriCode pozniej (90-95%). Aider bardziej agresywny |
| Cache warming? | **Tak.** Background thread wysyla minimalne requesty co ~5 minut aby utrzymac Anthropic prompt cache. Plik: `base_coder.py` | Brak | Interesujaca optymalizacja kosztow — warto rozwazyc |

**Wniosek:** Aider jest bezstanowy miedzy sesjami — kazda sesja to clean slate. DiriCode z GitHub Issues i TODO state jest znacznie lepszy dla dluzszych projektow. Dobry pattern z Aidera: **auto-commit = naturalny undo** i **cache warming** dla optymalizacji kosztow.

### H. UX i Developer Experience

| Aspekt | Aider | DiriCode | Wniosek |
|--------|-------|----------|---------|
| Time-to-first-use | `pip install aider-chat && aider` + API key — 2 kroki. Auto-detect kluczy API (`onboarding.py`): skanuje env vars, proponuje OpenRouter OAuth jesli brak klucza | Do zbadania — planowane `npx diricode` | Aider ma dobry onboarding z auto-detect kluczy |
| Vim motions? | **NIE.** Czysty terminal, readline. Brak TUI | Od dnia 1 (TUI Ink) | DiriCode lepszy |
| Streaming? | Tak — streaming odpowiedzi LLM w terminalu | SSE (ADR-001) | Porownywalne |
| Lean mode? | **NIE explicite.** Ale `--no-auto-commits`, `--no-stream`, `--map-tokens 0` (wylacz repo map) pozwalaja zredukowac overhead. Brak jednego "lean" flaga | `--lean` (ADR-006) | DiriCode lepszy — jeden flag zamiast N opcji |
| Jakosc dokumentacji? | Bardzo dobra — rozbudowana strona `aider.chat` z benchmarkami, tutorialami, FAQ, leaderboard modeli | Do stworzenia | Aider ma mature docs + leaderboard modeli |
| Onboarding? | Auto-detect API keys, OpenRouter OAuth flow jesli brak klucza (`onboarding.py`). `try_to_select_default_model()` — automatycznie wybiera najlepszy model z dostepnych kluczy | Do zbadania | Aider ma **doskonaly onboarding** — zero konfiguracji jesli masz env vars |
| Dodatkowe features | `/voice` (Whisper STT), `/web` (Playwright scraping → markdown), `/paste` (clipboard images), `/editor` (system editor), `# AI!` / `# AI?` komentarze w kodzie wyzwalaja Aidera automatycznie (file watcher) | Planowane | Aider ma **innowacyjne UX patterns**: AI comments w kodzie, voice input, web scraping. Warto zaadaptowac selektywnie |
| Cost tracking | Per-message real-time: tokeny (sent/received/cache hit/cache write) + koszt w USD. Widoczne po kazdej odpowiedzi | Do zaimplementowania | Aider ma **doskonaly cost tracking** z rozpoznaniem cache hitow — must-have |

**Wniosek:** Aider ma dojrzaly UX z innowacyjnymi featurami (AI comments, voice, web scraping, cost tracking). DiriCode ma lepszy TUI (vim motions, lean mode). Kluczowe do zaadaptowania: **auto-detect API keys**, **cost tracking z cache awareness**, **AI comments w kodzie** (opcjonalnie).

---

## 3. Co DiriCode Powinien Zaadaptowac

| # | Co | Dlaczego | Wplyw na ADR |
|---|-----|---------|-------------|
| 1 | **Repository Map (graf zaleznosci kodu)** — automatyczne indeksowanie AST + ranking plikow wedlug istotnosci. Nie kopiowac implementacji Aidera (Tree-sitter queries + PageRank), ale zbudowac wlasna wersje oparta na LSP symbols + referencje | Aider's killer feature. Pozwala automatycznie wybrac najwazniejsze pliki do kontekstu bez manualnego `/add`. Szczegolnie krytyczne dla duzych repo (50K+ plikow). DiriCode polega na heurystykach dispatchera — to nie skaluje sie. Pliki: `repomap.py`, `queries/*.scm` | **ADR NOWY** — "Repository Intelligence: LSP-based dependency graph with ranking". Moze byc lazy-built per sesja i cachowany na dysku |
| 2 | **Per-model edit format optimization** — matryca: kazdy model ma optymalny format edycji (SEARCH/REPLACE, diff, whole-file) | Aider odkryl ze rozne modele najlepiej radza sobie z roznymi formatami edycji. Np. Claude = `editor-diff`, DeepSeek = `diff`, GPT-4o = `diff`, Gemini = `diff-fenced`. Plik: `models.py`, klasa `ModelSettings` | **ADR-011** (routing) — rozszerzyc o per-model metadata: optymalny edit format, temperatura, uzycie repo map |
| 3 | **Auto-commit po kazdej edycji** z LLM-generowanym Conventional Commits message + atrybucja (git trailer) | Naturalny undo (kazda edycja = osobny commit). Ulatwia `/undo`. Conventional Commits message generowany przez LLM: `aider: feat: Add user authentication`. Git trailer: `Aider: https://aider.chat`. Pliki: `repo.py`, `prompts.py` | **ADR-010** (git safety) — dodac opcje auto-commit per edit z LLM-generated Conventional Commits message. Agent `git-manager` moze to realizowac |
| 4 | **Fuzzy edit matching** — jesli LLM wygeneruje SEARCH block ktory nie pasuje dokladnie, probuj: whitespace-flex, strip, dotdotdots, `difflib.SequenceMatcher` | Redukuje failure rate edycji. Aider probuje w kolejnosci: (1) exact match, (2) whitespace flex, (3) dotdotdots, (4) `find_similar_lines()` z `difflib.SequenceMatcher`. Plik: `editblock_coder.py` | **ADR nowy lub rozszerzenie @diricode/tools** — Hashline Edit moze implementowac fuzzy matching jako fallback |
| 5 | **LLM-driven lint-fix cycle** — po edycji automatycznie: lint → jesli bledy → nowy LLM call z linter output → fix → lint → repeat (max N razy) | Redukuje "broken code" po edycji. Aider tworzy osobny `lint_coder` (klon z minimalna historia), karmi go linter output, LLM generuje fix, auto-commit. Plik: `base_coder.py` metoda `lint_edited()`, `linter.py` | **ADR nowy** — "Auto-lint-fix cycle" jako hook `tool.execute.after` na agencie `code-writer`. Max 3 iteracje |
| 6 | **Cost tracking z cache awareness** — per-message: tokeny sent/received/cache_hit/cache_write + koszt USD | Krytyczne dla swiadomosci kosztow usera. Aider wyswietla po kazdej odpowiedzi. Rozroznia cache hit vs cache write (Anthropic prompt caching). Plik: `base_coder.py` | **ADR nowy lub P1** — dodac real-time cost tracking do TUI. Vercel AI SDK zwraca usage — wystarczy wyswietlic |
| 7 | **Auto-detect API keys przy onboardingu** — skanuj env vars, zaproponuj najlepszy model z dostepnych kluczy | Zero-config experience. Aider automatycznie wykrywa `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY` itd. i proponuje optymalny model. Plik: `onboarding.py` | **P1** — dodac do `apps/cli` auto-detect env vars i proponowanie default config |
| 8 | **Chat summarization w background thread** — kompakcja historii nie blokuje usera | Aider uruchamia `ChatSummary` w osobnym watku. Rekurencyjna strategia: podziel na polowy, podsumuj starsza, zachowaj nowsza. Plik: `history.py` | **ADR-009** (kompakcja) — rozwazyc background thread zamiast synchronicznej kompakcji |

---

## 4. Czego DiriCode Powinien Unikac

| # | Co | Dlaczego to problem | Jak DiriCode to rozwiazuje |
|---|-----|--------------------|-----------------------------|
| 1 | **God-class architektura** — `base_coder.py` to 2485 linii zawierajacych: file management, LLM calls, edit parsing, git commit, linting, testing, shell commands, cost tracking, cache warming, chat summary | Niemozliwe do testowania, rozszerzenia, utrzymania. Kazda zmiana moze zepsuc cos innego. Zero separation of concerns. Nowi kontrybutorzy nie wiedza gdzie zaczac | ADR-002: Dispatcher-first. ADR-005: 12 lifecycle hooks. ADR-012: Hybrydowa definicja agentow. Architektura DiriCode jest fundamentalnie lepsza |
| 2 | **Brak jakiegokolwiek systemu approval** — auto-commit, auto-edit, auto-lint bez pytania usera. Jedyny "approval": uzytkownik widzi suggestie bash command i moze ja odrzucic | Uzytkownik traci kontrole. Przy zlozonych edycjach AI moze zrobic destrukcyjne zmiany bez wiedzy usera. Brak kategoryzacji ryzyka operacji | ADR-004: Smart Approval z 3 kategoriami (safe/risky/destructive) |
| 3 | **Brak secret redaction** — pliki dodane do chatu ida do LLM bez filtrowania. Jesli user doda `.env` lub plik z API keys — wyciekna do providera | Powazan luka bezpieczenstwa. Uzytkownik musi sam pamietac co dodaje do chatu | ADR-014: Auto-redakcja regex + heurystyki |
| 4 | **Calkowita zaleznosc od LiteLLM** — cala komunikacja z LLM przechodzi przez litellm. Jesli litellm ma bug lub breaking change — Aider nie dziala | Single point of failure. Aider nie moze dzialac bez LiteLLM. Kazdy bug w LiteLLM = bug w Aider | ADR-011: Wlasny TS Router. Brak zewnetrznej zaleznosci na routing |
| 5 | **Brak trwalej pamieci miedzy sesjami** — kazda sesja zaczyna od zera. Brak project memory, brak TODO persistence | Uzytkownik musi za kazdym razem "przypominac" Aiderowi kontekst projektu. Nie nadaje sie do dlugich, wielosesyjnych projektow | ADR-007: GitHub Issues jako project memory. ADR-013: Stan w Markdown |
| 6 | **Bus factor = 1** — Paul Gauthier jest jedynym core developerem. Cala architektura (monolityczna, god-class) utrudnia kontrybutorzy zewnetrznym zrozumienie kodu | Ryzyko dla dlugowiecznosci projektu. Jesli Gauthier przestanie pracowac nad Aiderem — projekt moze stagnowac | DiriCode jako OSS z modularną architekturą i czytelnym kodem jest bardziej przyjazny dla kontrybutorów |

---

## 5. Otwarte Pytania

1. **Czy Repository Map oparty na LSP byłby lepszy od Tree-sitter queries?** Aider uzywa Tree-sitter `.scm` query files — kazdorazowo trzeba pisac nowe queries per jezyk. DiriCode ma LSP — `lsp_symbols` i `lsp_find_references` moga zbudowac ten sam graf, ale z wieksza precyzja (LSP rozumie typy, scope, overloady). Pytanie: czy LSP jest wystarczajaco szybki dla calego repo? Czy lazy-build + cache rozwiaze problem wydajnosci?

2. **Ile formatow edycji potrzebuje DiriCode?** Aider ma 14 formatow (EditBlock, WholeFile, UnifiedDiff, Patch, Architect, + warianty). Czy DiriCode z Hashline Edit potrzebuje wiecej? Czy per-model format selection jest konieczny, czy wystarczy jeden dobry format?

3. **Czy auto-commit po kazdej edycji jest pozadany w multi-agent workflow?** Aider commituje po kazdej edycji (jeden agent, proste). W DiriCode wiele agentow moze edytowac pliki rownolegle — auto-commit moze prowadzic do merge conflicts. Czy lepiej: commit per agent task (nie per edit) lub commit na koniec pipeline?

4. **Czy cache warming (background ping co 5 min) jest oplacalny?** Aider robi to dla Anthropic prompt cache. Koszt: minimalne tokeny co 5 min. Zysk: cache hit na kolejnym uzyciu (do 90% redukcji kosztow). Pytanie: czy DiriCode z wieloma providerami powinien robic cache warming dla kazdego, czy tylko dla Anthropic?

5. **Jak Aider's Architect mode porownuje sie z DiriCode's dispatcher→planner→code-writer pipeline?** Aider Architect: jeden LLM planuje, drugi LLM edytuje (48 linii kodu). DiriCode: dispatcher→planner→code-writer (3 kroki, wiecej overhead ale wiecej kontroli). Czy two-step pipeline Aidera jest wystarczajacy dla prostych zadan? Mozliwe ze DiriCode powinien miec "fast path" (Architect-like) obok pelnego pipeline.

---

## 6. Rekomendacje dla Specyfikacji DiriCode

### 6.1 Zmiany w istniejacych ADR-ach

| ADR | Obecna decyzja | Proponowana zmiana | Uzasadnienie |
|-----|---------------|-------------------|-------------|
| **ADR-009** | Kompakcja na 90-95% context | Dodac: **background thread** dla kompakcji (nie blokuj usera) + rozwazyc wczesniejszy prog (np. 75%) z agresywniejszym podsumowaniem starszych wiadomosci | Aider uruchamia `ChatSummary` w background thread z limitem 1/16 context window. Wczesniejsza kompakcja = wiecej miejsca na repo map |
| **ADR-010** | Git safety rails | Dodac: **auto-commit po kazdej edycji agenta** (opcjonalnie, default off) z LLM-generated Conventional Commits message. Wlaczane per-agent lub globalnie | Aider's auto-commit = naturalny undo. W DiriCode agent `git-manager` moze to realizowac jako hook `tool.execute.after` na narzedziu Edit |
| **ADR-011** | Wlasny TS Router | Dodac: **per-model metadata** — optymalny edit format, temperatura, max output tokens, uzycie repo map (boolean), reasoning tag format. Zaladowane z konfiguracji lub wbudowane defaults | Aider's `ModelSettings` zawiera 50+ konfiguracji per model. DiriCode potrzebuje tego samego aby optymalnie wykorzystac rozne modele |

### 6.2 Nowe elementy do specyfikacji

| Propozycja | Opis | Priorytet |
|-----------|------|----------|
| **Repository Intelligence (ADR nowy)** | System indeksowania kodu: LSP symbols + referencje → graf zaleznosci → ranking istotnosci. Lazy-build per sesja, cachowany na dysku (`diskcache` lub wlasny). Personalizacja: pliki w kontekscie agenta maja wyzsza wage. Output: posortowana lista `filename: signatures` zmieszczona w limicie tokenow | **P0** — to jest kluczowa luka DiriCode wzgledem Aidera. Bez tego DiriCode nie radzi sobie z duzymi repo |
| **Cost Tracking Dashboard** | Real-time per-message: tokeny (prompt/completion/cache_hit/cache_write) + koszt USD. Per-sesja: sumaryczny koszt. Per-agent: ile zuzyl kazdy agent. Wyswietlane w TUI | **P1** — krytyczne dla user trust i cost awareness |
| **Auto-detect API Keys (Onboarding)** | Przy pierwszym uruchomieniu: skanuj env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, itd.), zaproponuj najlepszy model z dostepnych kluczy, wygeneruj bazowy `diricode.config.ts` | **P1** — zero-config first-run experience |
| **Fuzzy Edit Fallback** | Hashline Edit: jesli exact match fail → probuj: (1) whitespace normalization, (2) line-by-line fuzzy match (`difflib.SequenceMatcher` equivalent w TS), (3) najblizszy blok w pliku. Loguj fuzzy match jako warning | **P1** — redukuje failure rate edycji LLM |
| **LLM Lint-Fix Cycle** | Hook `tool.execute.after` na Edit: (1) run linter (ESLint/tsc/AST-grep), (2) jesli bledy → nowe wywolanie LLM z linter output, (3) max 3 iteracje, (4) jesli nadal bledy → raport do usera | **P2** — quality gate. Moze byc zrealizowany jako hook, nie core feature |
| **Architect Fast Path** | Dla prostych zadan: dispatcher moze delegowac bezposrednio do `code-writer` z planem w prompcie (pomijajac `planner`). Inspirowane Aider Architect mode (plan + edit w 2 krokach zamiast 3) | **P2** — optymalizacja latencji i kosztow dla prostych taskow |

### 6.3 Potwierdzone decyzje

Analiza Aidera **potwierdza** poprawnosc nastepujacych decyzji DiriCode:

| ADR | Decyzja | Potwierdzenie z Aidera |
|-----|---------|----------------------|
| **ADR-002** | Dispatcher-first (zero hookow na agencie glownym) | Aider's god-class (`base_coder.py`, 2485 linii) to anty-wzorzec. Brak separacji odpowiedzialnosci utrudnia rozwoj i testowanie. DiriCode's dispatcher-first to zdecydowanie lepsza architektura |
| **ADR-004** | Smart Approval (AI ocenia ryzyko) | Aider nie ma zadnego systemu approval — auto-edit, auto-commit bez pytania. To slabość, nie feature |
| **ADR-005** | 12 lifecycle hooks | Aider ma ZERO hookow. Nie mozna rozszerzyc zachowania bez forkowania kodu. DiriCode's 12 hookow to prawidlowa decyzja |
| **ADR-008** | Git worktrees zamiast snapshot | Aider uzywa auto-commit + `/undo` — inny mechanizm, ale tez oparty na git. Potwierdza ze git jest wystarczajacy jako "undo system" |
| **ADR-011** | Wlasny TS Router (bez LiteLLM) | Aider jest calkowicie zalezny od LiteLLM. Kazdy bug w litellm = bug w Aider. DiriCode's wlasny router eliminuje te zaleznosc |
| **ADR-013** | Stan w Markdown | Aider nie ma trwalego stanu (kazda sesja od zera). DiriCode z Markdown state jest lepszy dla dlugich projektow |
| **ADR-014** | Auto-redakcja sekretow | Aider NIE MA secret redaction. Potwierdzenie ze ADR-014 jest krytyczny |
| **ADR-015** | Tree-sitter bash parsing | Aider nie parsuje bash commands. DiriCode bezpieczniejszy |

---

## Appendix: Kluczowe Pliki Zrodlowe Aidera

| Plik | Linii | Co zawiera | Znaczenie |
|------|-------|-----------|----------|
| `coders/base_coder.py` | 2485 | God-class: cala logika agenta | Kluczowy — zrozumienie calej architektury |
| `repomap.py` | ~800 | Repository Map: Tree-sitter + PageRank + diskcache | **Najwazniejszy** — killer feature Aidera |
| `models.py` | ~700 | ModelSettings, aliasy, per-model config (50+ modeli) | Wazny — per-model optimization |
| `commands.py` | ~1200 | 35+ slash commands | Referencja dla DiriCode commands |
| `coders/architect_coder.py` | 48 | Architect mode (plan→edit z 2 modelami) | Inspiracja dla fast path |
| `coders/editblock_coder.py` | ~450 | SEARCH/REPLACE format + fuzzy matching | Inspiracja dla fuzzy edit |
| `history.py` | ~130 | ChatSummary: rekurencyjna kompakcja w background thread | Inspiracja dla ADR-009 |
| `linter.py` | ~200 | Tree-sitter basic_lint + flake8 + compile check | Inspiracja dla lint-fix cycle |
| `watch.py` | ~150 | File watcher: `# AI!` / `# AI?` comments detection | Innowacyjny UX pattern |
| `repo.py` | ~400 | Git integration: auto-commit, undo, .aiderignore | Referencja dla ADR-010 |
| `onboarding.py` | ~150 | Auto-detect API keys, OpenRouter OAuth | Inspiracja dla onboarding DiriCode |
| `voice.py` | ~100 | Whisper STT via litellm.transcription | Referencja na przyszlosc (v2) |
| `scrape.py` | ~150 | Playwright→httpx fallback, HTML→Markdown | Referencja dla web fetch |
| `llm.py` | ~50 | LazyLiteLLM wrapper (lazy import) | Anty-wzorzec — calkowita zaleznosc |
| `analytics.py` | ~100 | PostHog + Mixpanel telemetry (opt-in) | Referencja jesli DiriCode doda telemetrie |
| `queries/*.scm` | 30+ plikow | Tree-sitter query files per jezyk | Referencja dla Repository Intelligence |

---

*Dokument wygenerowany na podstawie analizy kodu zrodlowego repozytorium `Aider-AI/aider` — wylacznie fakty z kodu. Brak spekulacji.*
