# Ankieta: Żelazne Zasady i Hooki Agentów (DiriCode)

> W DiriCode odrzucamy monolitycznego agenta (Sisyphus) na rzecz wyspecjalizowanych sub-agentów.
> Aby to zadziałało bezpiecznie, każdy agent musi mieć "Żelazne Zasady" (Ironclad Rules) egzekwowane przez Hooki.
> 
> **Instrukcja:** Przejrzyj poniższe propozycje hooków/zasad i oznacz:
> - **[TAK]** - Wdrażamy w MVP
> - **[NIE]** - Odrzucamy
> - **[MODYFIKUJ]** - Zmieniamy logikę (dopisz jak)

---

## 1. Żelazne Zasady Dispatchera (Agent Główny)

Dispatcher to mózg operacji. Jego jedynym zadaniem jest analiza problemu i delegacja.

| Hook / Zasada | Opis Działania | Decyzja |
|---|---|---|
| **`dispatcher-read-only-guard`** | Kategorycznie blokuje narzędzia modyfikujące stan (`write`, `edit`, `bash`, `git`). Jeśli Dispatcher spróbuje ich użyć, hook zwraca błąd: "Jesteś tylko dyspozytorem. Deleguj to zadanie do odpowiedniego agenta." | **[TAK]** |
| **`dispatcher-mandatory-delegation`** | Wymusza, aby Dispatcher zakończył swoją turę wywołaniem narzędzia `delegate_task`. Nie może sam odpowiedzieć użytkownikowi "Zrobiłem to", jeśli nie zlecił pracy sub-agentowi. | **[TAK]** |
| **`dispatcher-todo-sync-enforcer`** | Przed podjęciem nowej decyzji, hook wymusza na Dispatcherze odczytanie aktualnego stanu z pliku `todo.md`, aby nie zgubił kontekstu po powrocie sub-agenta. | **[TAK]** |

---

## 2. Żelazne Zasady Code-Writera (Programista)

Code-Writer to "mięśnie". Pisze i edytuje kod, ale nie powinien zajmować się architekturą ani testami.

| Hook / Zasada | Opis Działania | Decyzja |
|---|---|---|
| **`writer-no-architecture-changes`** | Blokuje modyfikację plików konfiguracyjnych (np. `package.json`, `tsconfig.json`, `docker-compose.yml`) chyba że Dispatcher wyraźnie mu na to pozwolił w parametrach zadania. | **[TAK]** |
| **`writer-hashline-enforcer`** | Wymusza użycie narzędzia `edit` z weryfikacją hashów linii (Hashline). Jeśli agent spróbuje użyć zwykłego `write` na istniejącym pliku, hook to zablokuje. | **[TAK]** |
| **`writer-syntax-check-guard`** | Po każdej edycji pliku (np. `.ts`, `.py`), hook automatycznie uruchamia szybki linter/parser (np. `tsc --noEmit` lub `ast-grep`). Jeśli kod ma błędy składniowe, hook cofa edycję i każe agentowi poprawić błąd, zanim użytkownik to zobaczy. | **[TAK]** |

---

## 3. Żelazne Zasady Git-Managera

Git-Manager odpowiada za wersjonowanie. To najbardziej niebezpieczny agent.

| Hook / Zasada | Opis Działania | Decyzja |
|---|---|---|
| **`git-no-blind-commit-guard`** | Kategorycznie blokuje komendę `git commit -am "..."` oraz `git add .`. Agent musi jawnie wskazać pliki do zacommitowania (`git add file1 file2`). | **[TAK]** |
| **`git-destructive-action-blocker`** | Blokuje komendy takie jak `git push --force`, `git reset --hard`, `git clean -fd`. Wymaga interwencji użytkownika (Smart Approval UI) nawet w trybie auto-approve. | **[TAK]** |
| **`git-atomic-commit-enforcer`** | Wymusza, aby wiadomości commitów były zgodne z konwencją (np. Conventional Commits: `feat:`, `fix:`). Jeśli agent wygeneruje zły opis, hook każe mu go przeredagować. | **[TAK]** |

---

## 4. Żelazne Zasady Plannera (Architekt)

Planner rozbija duże zadania na mniejsze kroki.

| Hook / Zasada | Opis Działania | Decyzja |
|---|---|---|
| **`planner-no-code-guard`** | Planner nie ma dostępu do narzędzi edycji kodu. Jego jedynym wyjściem jest aktualizacja pliku `todo.md` lub zwrócenie planu w formacie JSON do Dispatchera. | **[TAK]** |
| **`planner-cost-estimation-enforcer`** | Wymusza, aby każdy wygenerowany plan zawierał szacunkowy koszt w tokenach/dolarach oraz listę agentów, którzy będą potrzebni do jego wykonania. | **[TAK]** |

---

## 5. Żelazne Zasady Code-Reviewera

Reviewer ocenia kod napisany przez Code-Writera.

| Hook / Zasada | Opis Działania | Decyzja |
|---|---|---|
| **`reviewer-isolation-guard`** | Reviewer nie widzi historii konwersacji Code-Writera (izolacja kontekstu). Widzi tylko diff (zmiany w kodzie) i oryginalne wymagania. Hook czyści kontekst przed uruchomieniem tego agenta. | **[TAK]** |
| **`reviewer-read-only-guard`** | Reviewer może tylko czytać kod i dodawać komentarze (np. przez narzędzie `add_review_comment`). Nie może sam poprawiać kodu. | **[TAK]** |

---

## 6. Hooki Globalne (Dla wszystkich agentów)

Zasady, które obowiązują każdego agenta w systemie.

| Hook / Zasada | Opis Działania | Decyzja |
|---|---|---|
| **`global-secret-redactor`** | (Zgodnie z ADR-014) Skanuje każdy wychodzący prompt i maskuje klucze API (`sk-...`) na `[REDACTED]`. | **[TAK]** |
| **`global-loop-detector`** | (Zgodnie z ADR-003) Jeśli agent wywołuje to samo narzędzie z tymi samymi argumentami 3 razy z rzędu i dostaje ten sam błąd, hook przerywa jego działanie i zwraca kontrolę do Dispatchera. | **[MODYFIKUJ]** — po wykryciu pętli Dispatcher konsultuje się z agentem-doradcą (np. Debugger) zanim ponowi próbę, a nie powtarza ślepo |
| **`global-tool-output-truncator`** | Jeśli narzędzie (np. `cat`, `curl`) zwróci więcej niż N linii (np. 500), hook ucina wynik i dodaje informację: `[Output truncated. Use grep or read specific lines]`. Chroni przed zapchaniem kontekstu. | **[TAK]** |
| **`global-json-recovery`** | Jeśli agent wygeneruje uszkodzony JSON przy wywoływaniu narzędzia, hook automatycznie prosi go o poprawę składni (bez pokazywania błędu użytkownikowi). | **[TAK]** |

---

## Pytania Otwarte do Architektury Hooków:

1. **Sposób definicji:** Czy te "Żelazne Zasady" powinny być zaimplementowane jako twardy kod w TypeScript (niezmienialne przez usera), czy jako konfigurowalne reguły w `diricode.config.ts`?
**Odpowiedź:** Twardy kod (TypeScript). Żelazne zasady NIE są konfigurowalne przez użytkownika.

2. **Kary dla agentów:** Co powinien zrobić hook, gdy agent złamie żelazną zasadę? 
   - Opcja A: Zwrócić błąd do agenta ("Nie wolno Ci tego robić, spróbuj inaczej").
   - Opcja B: Natychmiast przerwać działanie agenta i zwrócić błąd do Dispatchera ("Twój sub-agent zwariował").
**Odpowiedź:** Hybryda — 1 szansa na autokorektę (hook zwraca błąd do agenta z informacją co zrobił źle), potem twardy stop + raport do Dispatchera.

3. **Dynamiczne zasady:** Czy użytkownik w pliku `.diricode/agents/writer.md` powinien móc dodawać własne żelazne zasady (np. "Nigdy nie używaj biblioteki X")?
**Odpowiedź:** TAK — użytkownik może dodawać własne zasady w plikach `.diricode/agents/*.md`.
