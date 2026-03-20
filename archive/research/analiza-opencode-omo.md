# Analiza: OpenCode + Oh-My-OpenCode — Co potrafią razem?

> **Data analizy**: 21 lutego 2026
> **Wersje**: OpenCode v1.2.10 (108K ★) · Oh-My-OpenCode v3.7.4 (32.7K ★)

---

## 1. Czym jest każdy z projektów osobno?

### OpenCode — Fundament

OpenCode to **open-source'owy odpowiednik Claude Code** — terminalowy asystent AI do kodowania (TUI). Kluczowe cechy:

- **Architektura klient-serwer** — serwer utrzymuje stan sesji, klient renderuje TUI. Można podpiąć różne frontendy (terminal, desktop app, VS Code extension).
- **Provider-agnostic** — obsługuje 75+ modeli AI (Anthropic, OpenAI, Google, Groq, Fireworks, Ollama, OpenRouter, Azure, itd.). Nie jest zamknięty na jednego dostawcę.
- **System pluginów** — rozszerzalny przez hooky i pluginy. To dzięki temu OMO w ogóle istnieje.
- **2 wbudowane agenty**: `build` (domyślny, pełen dostęp do narzędzi) i `plan` (read-only, planowanie).
- **LSP** — integracja z Language Server Protocol (go-to-definition, find-references, diagnostyka).
- **Narzędzia bazowe**: edycja plików, bash, glob, grep, LSP, web fetch, MCP client.
- **Snapshot/worktree** — automatyczne snapshoty zmian z możliwością rollbacku.
- **Desktop app** — beta dla macOS/Windows/Linux.
- **Oferta komercyjna**: OpenCode Zen (zarządzany dostęp do modeli, uproszczona konfiguracja).

**Filozofia**: Minimalny, czysty fundament. Złożoność deleguj do pluginów.

### Oh-My-OpenCode — Nadbudówka inteligencji

OMO to **plugin do OpenCode**, który zamienia go z prostego asystenta w **wieloagentowy system orkiestracji**. Kluczowe cechy:

- **11 wyspecjalizowanych agentów** (zamiast 2):
  - **Sisyphus** — główny orkiestrator, deleguje do wyspecjalizowanych agentów
  - **Hephaestus** — deep worker (GPT, trudne zadania logiczne)
  - **Oracle** — konsultant architektoniczny
  - **Librarian** — wyszukiwanie dokumentacji i wiedzy (Exa, Context7, Grep.app)
  - **Explore** — szybki grep/analiza kodu
  - **Multimodal-Looker** — analiza obrazów, PDF, diagramów
  - **Prometheus** — planowanie strategiczne (ten agent, który teraz z Tobą rozmawia!)
  - **Metis** — analiza luk w planach
  - **Momus** — surowy recenzent (weryfikacja planów)
  - **Atlas** — orkiestrator TODO
  - **Sisyphus-Junior** — delegowany executor (lżejsze zadania)

- **44 lifecycle hooks** w 5 warstwach — kontrola nad każdym aspektem działania agentów (prompt injection, walidacja commitów, sprawdzanie komentarzy, kompaktowanie kontekstu, itd.)
- **26 narzędzi** — w tym unikalne: hash-anchored edits (LINE#ID), delegacja zadań, zarządzanie sesjami, analiza wizualna, tmux.
- **System kategorii agentów**: visual-engineering, ultrabrain, deep, artistry, quick, writing — automatyczne dopasowanie agenta do zadania.
- **Skills z wbudowanymi MCP**: Playwright (automatyzacja przeglądarki), git-master, frontend-ui-ux.
- **3 wbudowane MCP**: Exa (web search), Context7 (dokumentacja bibliotek), Grep.app (szukanie kodu na GitHubie).
- **Ralph Loop / Ultrawork Mode** — tryby ciągłej pracy aż do ukończenia zadania.
- **IntentGate** — klasyfikacja intencji użytkownika (czy to pytanie, czy polecenie).
- **Pełna warstwa kompatybilności z Claude Code** — hooky, komendy, skills, MCPs.

**Filozofia**: „Human intervention is a failure signal" — interwencja człowieka to sygnał błędu systemu.

---

## 2. Co potrafią RAZEM? (Synergia)

Połączenie OpenCode + OMO daje system, który **nie ma odpowiednika w ekosystemie open-source**:

### 🏗️ Warstwa infrastruktury (OpenCode)
| Możliwość | Opis |
|-----------|------|
| Multi-provider AI | 75+ modeli, swobodne przełączanie |
| Klient-serwer | Stabilne sesje, odporność na rozłączenia |
| LSP | Go-to-definition, find-references, rename, diagnostyka |
| Snapshoty | Automatyczne kopie zapasowe kodu z rollbackiem |
| Desktop app | GUI alternatywa dla TUI |
| Plugin system | Fundament, na którym OMO jest zbudowane |
| MCP protocol | Standaryzowany interfejs do narzędzi zewnętrznych |

### 🧠 Warstwa inteligencji (OMO)
| Możliwość | Opis |
|-----------|------|
| 11 agentów | Wyspecjalizowane role zamiast jednego „do wszystkiego" |
| Orkiestracja | Automatyczna delegacja zadań do odpowiednich agentów |
| Planowanie | Prometheus tworzy plany, Metis je weryfikuje, Momus recenzuje |
| Web search | Exa MCP — przeszukiwanie internetu w czasie rzeczywistym |
| Dokumentacja | Context7 — aktualna dokumentacja 1000+ bibliotek |
| Kod z GitHuba | Grep.app — szukanie wzorców w milionach repozytoriów |
| Playwright | Automatyzacja przeglądarki — testy UI, scraping, weryfikacja |
| Hash-anchored edits | Precyzyjne edycje plików odporne na przesunięcia linii |
| Ralph Loop | Ciągła praca do ukończenia — agent sam kontynuuje po przerwaniu |
| Ultrawork Mode | Tryb głębokiej pracy bez pytań do użytkownika |
| Todo Enforcer | Wymuszanie realizacji wszystkich zaplanowanych zadań |
| Preemptive Compaction | Inteligentne kompresowanie kontekstu przed przekroczeniem limitu |
| AST-grep | Wyszukiwanie i zamiana wzorców kodu z uwzględnieniem składni |
| Tmux | Interakcja z TUI aplikacjami (vim, htop, debuggery) |
| Analiza wizualna | Czytanie PDF, obrazów, diagramów (multimodal) |
| Zarządzanie sesjami | Odczyt, przeszukiwanie, kontynuacja poprzednich sesji |

### 🔗 Synergia — czego NIE potrafi żaden z nich osobno

1. **OpenCode bez OMO** = prosty asystent z 2 agentami, bez web search, bez dokumentacji bibliotek, bez automatyzacji przeglądarki, bez planowania, bez orkiestracji.

2. **OMO bez OpenCode** = nie istnieje. OMO jest pluginem — nie ma własnego TUI, sesji, providerów, LSP, snapshotów.

3. **Razem** = pełny autonomiczny system programistyczny:
   - Użytkownik opisuje co chce → Prometheus planuje → Metis weryfikuje plan → Momus recenzuje → Sisyphus orkiestruje wykonanie → wyspecjalizowani agenci implementują → Playwright testuje UI → Oracle konsultuje architekturę → kod jest napisany, przetestowany i zcommitowany.

---

## 3. Porównanie z konkurencją

| Cecha | Claude Code | Cursor | OpenCode+OMO |
|-------|-------------|--------|--------------|
| Open-source | ❌ | ❌ | ✅ |
| Multi-provider | ❌ (tylko Anthropic) | Częściowo | ✅ (75+ modeli) |
| Multi-agent | ❌ (1 agent) | ❌ | ✅ (11 agentów) |
| Orkiestracja | ❌ | ❌ | ✅ (Sisyphus) |
| Planowanie strategiczne | ❌ | ❌ | ✅ (Prometheus+Metis+Momus) |
| Web search | ✅ | ✅ | ✅ (Exa MCP) |
| Browser automation | ❌ | ❌ | ✅ (Playwright) |
| LSP | ❌ | ✅ (IDE) | ✅ |
| Snapshoty/rollback | ✅ | ❌ | ✅ |
| Desktop app | ❌ | ✅ (IDE) | ✅ (beta) |
| Ciągła autonomia | ❌ | ❌ | ✅ (Ralph Loop) |
| Cena | $20+/mo | $20/mo | Darmowy* |

*\*Z wyjątkiem kosztów API modeli AI lub OpenCode Zen*

---

## 4. Największe problemy — Głęboka analiza przeczytanych issues

> Poniższa sekcja powstała po **indywidualnym przeczytaniu treści** najpopularniejszych, najdłużej otwartych i najbardziej kontrowersyjnych issue z obu projektów.

---

### OpenCode — Problemy fundamentalne

#### 🔴 KRYTYCZNE (blokują użytkowników)

**1. Git abuse — snapshoty na gigantycznych repo (#3176, OTWARTY)**
OpenCode automatycznie uruchamia `git add .` na **całym katalogu roboczym** dla mechanizmu snapshotów. Użytkownik raportuje: 45GB katalog, 54K plików, brak respektowania `.gitignore`, brak limitu rozmiaru, brak pytania o zgodę. Powoduje skoki CPU i niestabilność systemu. Użytkownik pisze: *„This is a fundamental design flaw."* Przypisany do thdxr — nadal otwarty od **14 października 2025**.

**Znaczenie**: To nie bug, to **designowa decyzja**, która szkodzi na dużych projektach. Snapshot powinien być opt-in lub respektować .gitignore.

**2. Copilot premium token drain (#8030, OTWARTY)**
Integracja z GitHub Copilot tworzy syntetyczne wiadomości „user" dla każdego załącznika narzędzia. W efekcie **WSZYSTKIE wiadomości narzędzi zużywają premium tokeny**. Jeden złożony task zużył **połowę miesięcznego limitu Copilot**. Przyczyna zidentyfikowana technicznie (funkcja `MessageV2.toModelMessage`). Workaround: zostań na OpenCode v1.1.12. PR #8721 powiązany.

**Znaczenie**: Aktywnie kosztuje pieniądze użytkowników. Bug finansowy.

**3. Claude Max broken (#7410, OTWARTY)**
Najczęściej komentowany issue. Claude Max przestał działać z błędem. Przypisany do thdxr. Prosty bug report ze screenshotem, ale otwarty od 9 stycznia 2026.

**4. Windows support (#631, 199 reakcji, 11/23 sub-issues done)**
Utworzony przez samego thdxr (założyciela) 3 lipca 2025. Super-issue trackujący wszystkie problemy z Windows. Cytat: *„our windows support isn't really there."* Po **ponad 7 miesiącach** zrobiono tylko 11 z 23 sub-issues. Przypisany do Hona.

**Znaczenie**: 199 reakcji to najpopularniejszy feature request. ~70% developerów używa Windows. OpenCode skutecznie ich odcina.

#### 🟡 DESIGN DECISIONS — Kontrowersyjne filozofie

**5. „Model problem" — odmowa adaptacji narzędzi (#1357, ZAMKNIĘTY JAKO NOT PLANNED)**
Modele inne niż Claude (GPT-4.1 mini, inne OpenAI) konsekwentnie nie potrafią wygenerować poprawnego payload dla narzędzi Write/Edit. OpenCode **zamknął issue jako „model-problem"** — twierdząc, że to wina modelu, nie narzędzia.

**Znaczenie**: To **kluczowa filozoficzna decyzja**. OpenCode odmawia adaptacji interfejsu narzędzi do słabszych modeli. W praktyce: mimo „wsparcia 75+ modeli", naprawdę dobrze działa głównie z Claude. To podważa value proposition multi-provider.

**6. Niezmerge'owane PR-y społeczności**
Kilka w pełni działających implementacji od społeczności czeka miesiącami:
- **Speech-to-text** (#4695) — kompletna implementacja: FFmpeg, Groq/OpenAI/Whisper, detekcja mikrofonu. Dwa PR: #11345, #9264. Nie zmerge'owane.
- **Vim motions** (#1764) — PR #12679 powiązany. Przypisany do thdxr.
- **Paste text expansion** (#8501) — pasted text shows `[Pasted ~1 lines]` z brakiem możliwości podglądu. Użytkownik sam napisał fix w PR #8496. Nie zmerge'owany.

**Znaczenie**: OpenCode ma problem z przyjmowaniem wkładu społeczności. Gotowe, działające funkcje nie są mergowane.

#### 🟠 STABILNOŚĆ TUI

**7. TUI problemy (wiele issues)**
- Długa historia promptów powoduje zawieszenie (#3746)
- Luki w historii czatu (#4032)
- UI stuck na „generating" (#2512, #3846)
- `opencode run` wiesza się w kontekście CI (#4506)

---

### Oh-My-OpenCode — Problemy fundamentalne

#### 🔴 KRYTYCZNE

**1. Orkiestracja zbyt agresywna/destrukcyjna (#1081, OTWARTY)**
**Najważniejszy issue OMO.** Użytkownik raportuje:
- *„3/5 plans so far have started without my acknowledgement"*
- *„I **always** want to be the final arbiter of whether the plan should ultimately be acted upon"*
- Git master skill jest *„sometimes destructive in its behaviour"*
- Stacked diffs próbowane ale niedeterministyczne
- *„Git master skill should not be automatically enabled until it's more mature"*

**Znaczenie**: To BEZPOŚREDNIO sprzeczne z filozofią OMO (*„human intervention = failure signal"*). Użytkownicy chcą kontroli. OMO daje autonomię. To fundamentalny konflikt i **nadal jest OTWARTY bez naprawy.**

**2. Nieskończona pętla TODO + znikająca historia (#668, OTWARTY)**
Krytyczny bug: pętla TODO continuation działa w nieskończoność, requesty failują z „Invalid request parameters", sesja staje się bezużyteczna, historia konwersacji **znika**. PR #1316 powiązany ale nadal otwarty.

**Znaczenie**: System, który ma zapewnić ciągłość pracy, sam ją niszczy. Ironia.

**3. Claude Max bany (#158, ZAMKNIĘTY JAKO NOT PLANNED)**
Użytkownicy raportują, że Anthropic banuje konta Claude Max po intensywnym użyciu z OMO (szczególnie Sisyphus + Opus 4.5). **Odpowiedź autora (edytowana w treść issue, CAPS LOCK)**:
> *„I HAVE NOT CREATED A SINGLE IMPLEMENTATION RELATED TO ANTHROPIC OAUTH. I HAVE 3X MAX20 - AND I HAD NO PROBLEMS. THEREFORE, PLEASE STOP ASKING ME IF USING OH MY OPENCODE WILL GET YOUR CLAUDE ACCOUNT BANNED."*

**Znaczenie**: Autor zaprzecza odpowiedzialności, ale wielu użytkowników raportuje ten problem. Brak rozwiązania.

#### 🟡 DESIGN DECISIONS

**4. Sceptycyzm wobec memory system (#74, ZAMKNIĘTY)**
Autor jest sceptyczny wobec systemów pamięci: *„it's really easy to be redundant from my experiences."* Pytał społeczność o przykłady dobrych implementacji. Referencja do projektu claude-mem.

**Znaczenie**: Brak trwałej pamięci między sesjami to znaczące ograniczenie dla długoterminowych projektów. Autor nie jest przekonany.

**5. Problemy instalacyjne**
- Bun crashes z Segmentation Fault podczas instalacji (#1072)
- Instalacja failuje z npx i bunx na wielu systemach (#1294)
- Platform binary not installed (#1161)

**Znaczenie**: Bariera wejścia. Trudno polecać narzędzie, które często nie instaluje się poprawnie.

#### 🟠 KWESTIE BIZNESOWE

**6. Token usage / koszt**
Istnieje fork **omo-slim** (alvinunreal/oh-my-opencode-slim) stworzony specjalnie by zmniejszyć zużycie tokenów. 44 hooki × 5 warstw × bogaty prompting = ogromny overhead tokenowy.

**7. SUL-1.0 licencja**
Niestandardowa licencja odstraszająca firmy. Ani MIT, ani Apache, ani GPL.

**8. Brak natywnego OpenRouter (#1637)**
Popularna platforma do zarządzania modelami nie jest natywnie wspierana.

---

### Wzorce behawioralne autorów (z lektury issues)

#### thdxr (OpenCode — założyciel):
- Przypisuje sobie wiele issues ale ich nie zamyka (Windows #631 — 7 mies., git abuse #3176 — 4 mies., Cursor #2072 — 6 mies.)
- Label „model-problem" służy do oddalania problemów z kompatybilnością narzędzi
- PR-y społeczności nie są mergowane (speech-to-text, vim motions, paste expand)
- Brak labela „wontfix" — efektywne odrzucenie przez bierność

#### code-yeongyu (OMO — jedyny autor):
- Defensywna reakcja na krytykę (CAPS LOCK w #158 o Claude banach)
- Konflikt filozoficzny z użytkownikami ws. autonomii vs. bezpieczeństwa (#1081 otwarty, brak naprawy)
- Sceptycyzm wobec funkcji, których chce społeczność (memory system #74)
- Jednoosobowy bottleneck — brak współpracowników

---

## 5. Czego autorzy NIE chcą zrobić, a powinni?

### OpenCode — odmawia/ignoruje:

| Brakująca funkcja | Dlaczego powinni | Dlaczego nie robią |
|-------------------|------------------|-------------------|
| **Natywna multi-agent orkiestracja** | To #1 zapotrzebowanie rynku. OMO istnieje tylko dlatego, że OpenCode tego nie robi. | Filozofia „minimalnego jądra" — deleguj do pluginów. |
| **Web search w core** | Issue #309 otwarty od 8 miesięcy. Każdy konkurent to ma. | Prawdopodobnie chcą to w Zen (komercja). |
| **Windows support** | 199 reakcji. Odcinają się od ~70% deweloperów. | Mały zespół, macOS/Linux priorytet. |
| **Lepszy context management** | Issue #1990 — użytkownicy chcą kontroli nad kontekstem. | Brak zasobów lub wizji. |
| **Agent Teams** | Issue #12661 — podlega pod delegację. | Celowo to oddali do pluginów. |
| **Docker sandboxing** | Issue #9132 — bezpieczeństwo. | Złożoność, nie priorytet. |

### Oh-My-OpenCode — odmawia/ignoruje:

| Brakująca funkcja | Dlaczego powinni | Dlaczego nie robią |
|-------------------|------------------|-------------------|
| **Bezpieczniejsza orkiestracja** | Issue #1081 — użytkownicy raportują destrukcyjne akcje. | Filozofia: „human intervention = failure". Autor wierzy w pełną autonomię. |
| **Standalone mode** | OMO jest bezużyteczny bez OpenCode. Lepsza adopcja jako standalone. | Strategiczny wybór — bycie pluginem daje dostęp do ekosystemu OpenCode. |
| **Redukcja token usage** | Fork omo-slim istnieje bo OMO jest za drogi w tokenach. | Bogactwo hooków i promptów jest core value proposition. |
| **Standardowa licencja** | SUL-1.0 odstrusza firmy. MIT/Apache otworzyłoby rynek. | Prawdopodobnie model biznesowy. |
| **Centralizacja modeli** | Issue #839 — hardcoded referencje utrudniają konfigurację. | Dług techniczny, nie priorytet. |

---

## 6. Podsumowanie — czy warto?

### Dla kogo OpenCode + OMO?

✅ **Świetne dla**:
- Zaawansowanych deweloperów, którzy chcą pełnej kontroli
- Zwolenników open-source, którzy nie chcą vendor lock-in
- Zespołów, które potrzebują multi-agent orchestration
- Projektów wymagających autonomicznej pracy agentów

⚠️ **Ryzykowne dla**:
- Początkujących — krzywa uczenia się jest stroma
- Firm z restrykcyjnymi politykami (niestandardowa licencja OMO)
- Użytkowników Windows (brak wsparcia)
- Osób z ograniczonym budżetem na tokeny API

❌ **Nie dla**:
- Osób szukających „it just works" — konfiguracja jest złożona
- Użytkowników, którzy potrzebują wsparcia technicznego producenta
- Projektów wymagających audytowalności — orkiestracja OMO jest czarna skrzynka

### Verdict

**OpenCode + OMO to najpotężniejsze open-source'owe narzędzie AI do kodowania na rynku w lutym 2026.** Ale „najpotężniejsze" ≠ „najlepsze dla wszystkich". Siła tego stacku leży w customizacji i autonomii — jeśli tego potrzebujesz, nie ma lepszej alternatywy. Jeśli wolisz prostotę, Claude Code albo Cursor będą lepszym wyborem.
