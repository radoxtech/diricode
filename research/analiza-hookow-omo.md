# Analiza Hooków z Oh-My-OpenCode (OMO) dla DiriCode

> Poniżej znajduje się pełna lista 44 hooków z OMO.
> Przeanalizuj każdy z nich i zdecyduj, czy chcemy go w DiriCode (MVP, v2, czy odrzucamy).
> Pamiętaj, że DiriCode ma architekturę Dispatcher-First, więc wiele hooków ratujących monolitycznego agenta (Sisyphus) nie będzie nam potrzebnych.

---

## 1. Hooki Bezpieczeństwa i Ochrony (Safety & Guards)

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `write-existing-file-guard` | Blokuje użycie `write` na istniejącym pliku, wymuszając użycie `edit` (żeby agent nie skasował całego pliku). | **Wysoka.** Code-Writer może przez pomyłkę nadpisać plik. | TAK |
| `stop-continuation-guard` | Przerywa pętlę agenta, jeśli użytkownik kazał mu przestać. | **Wysoka.** Podstawowe UX (Ctrl+C / Stop). | TAK |
| `tasks-todowrite-disabler` | Zabrania agentom używania `todoWrite` w złych momentach (zapobiega pętlom TODO). | **Średnia.** W DiriCode mamy plik `todo.md` i dedykowane narzędzie do jego aktualizacji. | TAK |
| `unstable-agent-babysitter` | Resetuje agenta, jeśli ten zaczyna zwracać puste odpowiedzi lub wariować. | **Niska.** Nasi sub-agenci mają mały kontekst, więc rzadziej wariują. | TAK |
| `ralph-loop` | Zaawansowany detektor pętli (hashuje akcje). Przerywa, gdy agent robi w kółko to samo. | **Wysoka.** Agenci zawsze wpadają w pętle. Lepsze to niż prosty licznik z OpenCode. | TAK |

---

## 2. Hooki Fallbacków i Odzyskiwania (Recovery)

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `model-fallback` | Przełącza na inny model, gdy API zwróci błąd (np. 503). | **Wysoka.** Ale w DiriCode to zadanie naszego własnego TS Routera, a nie hooka agenta. | MODYFIKUJ — bogaty system multi-subscription: ten sam model z innej subskrypcji, konfigurowalne łańcuchy fallback, powiadomienie użytkownika przy zmianie modelu (szczególnie w sub-agentach, gdzie zmiana może być niewidoczna) |
| `runtime-fallback` | Przełącza na inny model przy błędach środowiska (np. padł lokalny serwer). | **Średnia.** Jak wyżej, to rola Routera. | TAK |
| `session-recovery` | Próbuje uratować sesję po crashu (np. Out of Memory). | **Niska.** W DiriCode stan jest w `todo.md`, więc po crashu po prostu wznawiamy z pliku. | TAK |
| `edit-error-recovery` | Jeśli `edit` zwróci błąd (zły tekst do podmiany), wstrzykuje podpowiedź jak to naprawić. | **Wysoka.** Bardzo pomaga agentom (szczególnie słabszym modelom) nauczyć się używać Hashline Edit. | TAK |
| `json-error-recovery` | Łapie błędy parsowania JSON (złe argumenty narzędzia) i prosi agenta o poprawę. | **Wysoka.** Oszczędza frustracji użytkownikowi. Agent sam się poprawia. | TAK (duplikat global-json-recovery — jeden hook) |
| `anthropic-context-window-limit-recovery` | Kompresuje kontekst w locie, gdy uderzymy w limit tokenów Claude. | **Średnia.** W DiriCode mamy `preemptive-compaction` (kompresję zanim uderzymy w limit). | TAK |
| `delegate-task-retry` | Automatycznie ponawia próbę, jeśli sub-agent zawiedzie. | **Wysoka.** Dispatcher powinien umieć ponowić zadanie (np. z innym modelem). | TAK |

---

## 3. Hooki Wstrzykiwania Kontekstu (Context Injectors)

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `rules-injector` | Wstrzykuje globalne zasady z `.cursorrules` lub `rules.md`. | **Wysoka.** Standard w dzisiejszych narzędziach AI. | MODYFIKUJ — inteligentne wstrzykiwanie, tylko zasady istotne dla danego agenta (nie cały ruleset) |
| `directory-agents-injector` | Wstrzykuje lokalne definicje agentów z katalogu projektu. | **Wysoka.** Zgodne z naszym ADR-012 (Hybrydowi Agenci w `.md`). | TAK |
| `directory-readme-injector` | Dokleja `README.md` do wiedzy agenta. | **Średnia.** Dispatcher może sam przeczytać README, jeśli uzna to za stosowne. | MODYFIKUJ — Dispatcher musi znać README, ale w wersji zwięzłej, żeby nie marnować kontekstu |
| `category-skill-reminder` | Przypomina o dostępnych plikach `SKILL.md` na podstawie kategorii zadania. | **Wysoka.** Pomaga agentom korzystać z wiedzy domenowej. | TAK |
| `agent-usage-reminder` | Przypomina głównemu agentowi, jakich sub-agentów ma do dyspozycji. | **Wysoka.** Kluczowe dla Dispatchera, żeby wiedział, komu delegować. | TAK |
| `auto-slash-command` | Zamienia intencje usera na komendy (np. "zbuduj to" -> `/build`). | **Niska.** Dispatcher sam powinien umieć zinterpretować intencję. | TAK |

---

## 4. Hooki Zarządzania Stanem i TODO

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `todo-continuation-enforcer` | Zmusza agenta do przeczytania TODO przed kolejną akcją. | **Wysoka.** Wymusza synchronizację z naszym `todo.md`. | MODYFIKUJ — sub-agent czyta TYLKO swój pod-TODO (np. kroki 3-4), NIE całe todo.md. Nie marnować kontekstu ani nie mylić agenta nieistotnymi informacjami. |
| `task-resume-info` | Wstrzykuje podsumowanie przy wznawianiu przerwanej sesji. | **Wysoka.** Pomaga agentowi odzyskać kontekst po restarcie CLI. | TAK |
| `start-work` | Inicjalizuje strukturę TODO na początku zadania. | **Wysoka.** Planner/Dispatcher musi stworzyć początkowy plan w `todo.md`. | TAK |
| `sisyphus-junior-notepad` | Wirtualny notatnik dla sub-agenta do przekazywania notatek w górę. | **Średnia.** Sub-agent może po prostu zwrócić wynik w JSON do Dispatchera. | TAK |

---

## 5. Hooki Modyfikacji Danych (Data Modifiers)

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `hashline-read-enhancer` | Dokleja numer linii i hash do czytanych plików (`12#A1B2: kod`). | **Wysoka.** Kluczowe dla niezawodności narzędzia Hashline Edit. | TAK |
| `tool-output-truncator` | Ucina zbyt długie wyniki z terminala (np. `cat duzy_plik`). | **Bardzo Wysoka.** Chroni przed zapchaniem kontekstu i ogromnymi kosztami. | TAK (duplikat global-tool-output-truncator — jeden hook) |
| `question-label-truncator` | Usuwa zbędne etykiety z pytań agenta (czyszczenie UI). | **Niska.** Kosmetyka. | TAK |
| `comment-checker` | Sprawdza, czy agent nie usunął ważnych komentarzy z kodu. | **Średnia.** Dobre dla słabszych modeli, ale generuje narzut. | TAK |

---

## 6. Hooki Kompakcji (Zarządzanie Pamięcią)

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `context-window-monitor` | Śledzi zużycie tokenów i podnosi alarm blisko limitu. | **Wysoka.** Podstawa zarządzania budżetem. | TAK |
| `preemptive-compaction` | Kompresuje historię *zanim* uderzymy w limit. | **Wysoka.** Zgodne z naszym ADR-009 (Kompakcja przy 90-95%). | TAK |
| `compaction-context-injector` | Wstrzykuje podsumowanie usuniętych wiadomości po kompresji. | **Wysoka.** Agent musi wiedzieć, co zostało skompresowane. | TAK |
| `compaction-todo-preserver` | Chroni listę TODO przed usunięciem podczas kompresji. | **Wysoka.** Stan w `todo.md` musi przetrwać kompresję historii czatu. | TAK |

---

## 7. Hooki Powiadomień i Środowiska (UX & Env)

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `session-notification` (i pokrewne) | Dźwięki i powiadomienia systemowe (macOS/Windows). | **Średnia.** Fajny bajer (UX), ale nie krytyczny dla MVP. | TAK |
| `background-notification` | Powiadomienia dla agentów w tle. | **Średnia.** Jak wyżej. | TAK |
| `interactive-bash-session` | Pozwala na interaktywne sesje bash (np. `tmux`). | **Wysoka.** Bardzo przydatne przy debugowaniu serwerów/procesów. | TAK |
| `non-interactive-env` | Ustawia `CI=1` itp., żeby narzędzia nie czekały na input. | **Wysoka.** Zapobiega zawieszaniu się agenta na promptach (np. `npm install`). | TAK |
| `auto-update-checker` | Sprawdza aktualizacje CLI w tle. | **Niska.** Nie w MVP. | v2 |

---

## 8. Hooki Specyficzne dla Modeli/Agentów

| Hook z OMO | Opis działania w OMO | Przydatność w DiriCode | Decyzja (TAK/NIE/v2) |
|---|---|---|---|
| `think-mode` / `thinking-block-validator` | Obsługa modeli rozumujących (Claude 3.7, o1). Waliduje bloki `<think>`. | **Wysoka.** Modele reasoning to przyszłość, musimy je wspierać. | TAK |
| `claude-code-hooks` | Specyficzne poprawki dla Claude. | **Średnia.** Zależy od tego, jak bardzo Claude będzie "głupiał" w naszym systemie. | TAK |
| `no-sisyphus-gpt` | Zabrania używania GPT dla głównego agenta. | **Niska.** W DiriCode użytkownik sam przypisuje modele w `diricode.config.ts`. | TAK |
| `no-hephaestus-non-gpt` | Zabrania używania non-GPT dla Hephaestusa. | **Niska.** Jak wyżej. | TAK |
| `prometheus-md-only` | Wymusza pisanie tylko w Markdown. | **Średnia.** Można to załatwić prostym system promptem dla agenta `docs-writer`. | TAK |
