# Wypełnij Ankiety Hooków — Decyzje TAK/NIE/v2/MODYFIKUJ

## TL;DR

> **Quick Summary**: Wypełnij kolumny "Decyzja" w dwóch ankietach hooków DiriCode zebranymi decyzjami użytkownika. Wszystkie 62 decyzje zostały zebrane podczas wywiadu.
> 
> **Deliverables**:
> - `ankieta-zelazne-zasady.md` — 17 hooków z decyzjami + 3 odpowiedzi na pytania architektoniczne
> - `analiza-hookow-omo.md` — 40 hooków z decyzjami (w tym 2 duplikaty oznaczone)
> 
> **Estimated Effort**: Quick (10-15 min, czysto mechaniczne edycje)
> **Parallel Execution**: NO — sequential (jeden plik po drugim)
> **Critical Path**: Task 1 → Task 2 → Task 3 (verify)

---

## Context

### Original Request
Użytkownik chciał wypełnić ankiety hooków DiriCode. Wszystkie decyzje zostały zebrane przez Prometheusa w trakcie szczegółowego wywiadu, gdzie każdy hook był wyjaśniony po polsku przed podjęciem decyzji.

### Interview Summary
**Key Discussions**:
- Użytkownik zdecydował TAK na zdecydowaną większość hooków (zarówno żelazne zasady jak i OMO)
- 5 hooków dostało MODYFIKUJ z konkretnymi uwagami
- 1 hook dostał v2 (auto-update-checker)
- 2 duplikaty zidentyfikowane (json-error-recovery, tool-output-truncator)
- 3 pytania architektoniczne odpowiedziane: twardy kod, hybryda kar, własne zasady TAK

**Research Findings**:
- json-error-recovery (OMO) = global-json-recovery (żelazne zasady) — identyczna funkcjonalność
- tool-output-truncator (OMO) = global-tool-output-truncator (żelazne zasady) — identyczna funkcjonalność

### Metis Review
**Identified Gaps** (addressed):
- Pytania architektoniczne nie mają pola odpowiedzi — dodajemy bloki `**Odpowiedź:**`
- MODYFIKUJ decyzje mogą być za długie na komórkę tabeli — ale 1-2 zdania mieszczą się
- Ryzyko AI slop: executor może "poprawić" istniejący tekst — twardy guardrail: TYLKO komórki Decyzja
- Duplikaty: w OMO oznaczamy cross-reference, w żelaznych zasadach zostawiamy plain TAK
- Liczba hooków w plikach: żelazne zasady = 17 (nie 18), OMO = 40 (nie 44) — liczymy po rzeczywistych wierszach

---

## Work Objectives

### Core Objective
Wypełnić puste komórki "Decyzja" w obu ankietach oraz dodać odpowiedzi na 3 pytania architektoniczne.

### Concrete Deliverables
- `ankieta-zelazne-zasady.md` z 17 wypełnionymi komórkami + 3 bloki `**Odpowiedź:**`
- `analiza-hookow-omo.md` z 40 wypełnionymi komórkami

### Definition of Done
- [ ] Zero pustych komórek Decyzja w obu plikach
- [ ] 3 bloki `**Odpowiedź:**` dodane w ankieta-zelazne-zasady.md
- [ ] Żadne inne treści nie zostały zmodyfikowane

### Must Have
- Dokładne decyzje zgodne z wywiadem
- MODYFIKUJ z pełnymi uwagami użytkownika
- Duplikaty oznaczone cross-referencją
- 3 odpowiedzi architektoniczne

### Must NOT Have (Guardrails)
- **NIE ZMIENIAJ** żadnego tekstu poza komórkami Decyzja i blokami Odpowiedź
- **NIE FORMATUJ** tabel, nie naprawiaj polszczyzny, nie zmieniaj szerokości kolumn
- **NIE DODAWAJ** komentarzy, podsumowań, nagłówków ani żadnych treści niespecyfikowanych
- **NIE ZMIENIAJ** kolejności hooków ani sekcji
- **NIE TWÓRZ** nowych plików

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**

### Test Decision
- **Infrastructure exists**: N/A (document editing only)
- **Automated tests**: None
- **Framework**: N/A

### Agent-Executed QA Scenarios (MANDATORY)

```
Scenario: All Decyzja cells filled in ankieta-zelazne-zasady.md
  Tool: Bash (grep)
  Preconditions: File edited
  Steps:
    1. grep -c "| $" ankieta-zelazne-zasady.md
    2. Assert: result is 0 (no empty trailing cells)
    3. grep -c "| \*\*\[TAK\]\*\*" ankieta-zelazne-zasady.md
    4. Assert: result >= 15 (most hooks are TAK)
    5. grep -c "MODYFIKUJ" ankieta-zelazne-zasady.md
    6. Assert: result is 1 (global-loop-detector)
  Expected Result: All cells filled, counts match
  Evidence: Terminal output captured

Scenario: All Decyzja cells filled in analiza-hookow-omo.md
  Tool: Bash (grep)
  Preconditions: File edited
  Steps:
    1. grep -c "| $" analiza-hookow-omo.md
    2. Assert: result is 0 (no empty trailing cells)
    3. grep -c "MODYFIKUJ" analiza-hookow-omo.md
    4. Assert: result is 4 (model-fallback, rules-injector, directory-readme-injector, todo-continuation-enforcer)
    5. grep -c "duplikat" analiza-hookow-omo.md
    6. Assert: result is 2 (json-error-recovery, tool-output-truncator)
    7. grep -c "v2" analiza-hookow-omo.md
    8. Assert: result >= 1 (auto-update-checker)
  Expected Result: All cells filled, counts match
  Evidence: Terminal output captured

Scenario: Architecture answers added
  Tool: Bash (grep)
  Preconditions: File edited
  Steps:
    1. grep -c "Odpowiedź:" ankieta-zelazne-zasady.md
    2. Assert: result is 3
    3. grep "Twardy kod" ankieta-zelazne-zasady.md
    4. Assert: contains answer about TypeScript hard-coded rules
    5. grep "Hybryda" ankieta-zelazne-zasady.md
    6. Assert: contains answer about hybrid penalty mechanism
  Expected Result: Three architecture answers present with correct content
  Evidence: Terminal output captured

Scenario: No content was deleted or modified outside decisions
  Tool: Bash (wc)
  Preconditions: Before-edit line counts captured
  Steps:
    1. wc -l ankieta-zelazne-zasady.md (expect original + 3 answer lines ≈ same count)
    2. wc -l analiza-hookow-omo.md (expect exactly same line count — in-place edits)
    3. grep "Kategorycznie blokuje narzędzia" ankieta-zelazne-zasady.md (original text preserved)
    4. grep "Blokuje użycie" analiza-hookow-omo.md (original text preserved)
  Expected Result: Line counts match expectations, original text intact
  Evidence: Terminal output captured
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Sequential — Task 1 then Task 2):
├── Task 1: Fill ankieta-zelazne-zasady.md
└── Task 2: Fill analiza-hookow-omo.md

Wave 2 (After Wave 1):
└── Task 3: Verify both files
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3 | 2 (technically yes, different files) |
| 2 | None | 3 | 1 |
| 3 | 1, 2 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | task(category="quick", load_skills=[], run_in_background=false) |
| 2 | 3 | Same agent, inline verification |

---

## TODOs

- [ ] 1. Wypełnij ankieta-zelazne-zasady.md (17 hooków + 3 pytania)

  **What to do**:
  - Użyj narzędzia `Edit` do wypełnienia każdej pustej komórki "Decyzja" w tabelach
  - Dla każdego hooka zamień `| |` (pustą komórkę na końcu wiersza) na odpowiednią decyzję
  - Po trzech pytaniach architektonicznych dodaj bloki `**Odpowiedź:**`
  - Użyj dokładnych stringów z mapy decyzji poniżej

  **Must NOT do**:
  - NIE zmieniaj żadnego tekstu poza komórkami Decyzja
  - NIE formatuj tabel, nie naprawiaj polszczyzny
  - NIE dodawaj komentarzy ani podsumowań
  - NIE zmieniaj kolejności sekcji

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Czysto mechaniczne edycje — wypełnianie komórek tabeli
  - **Skills**: `[]`
    - No special skills needed — standard Edit tool suffices

  **Parallelization**:
  - **Can Run In Parallel**: YES (z Task 2 — różne pliki)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `ankieta-zelazne-zasady.md` — cały plik, tabele z pustymi komórkami "Decyzja"

  **MAPA DECYZJI — ankieta-zelazne-zasady.md**:

  Sekcja 1 (Dispatcher):
  | Hook | Decyzja |
  |---|---|
  | `dispatcher-read-only-guard` | `**[TAK]**` |
  | `dispatcher-mandatory-delegation` | `**[TAK]**` |
  | `dispatcher-todo-sync-enforcer` | `**[TAK]**` |

  Sekcja 2 (Code-Writer):
  | Hook | Decyzja |
  |---|---|
  | `writer-no-architecture-changes` | `**[TAK]**` |
  | `writer-hashline-enforcer` | `**[TAK]**` |
  | `writer-syntax-check-guard` | `**[TAK]**` |

  Sekcja 3 (Git-Manager):
  | Hook | Decyzja |
  |---|---|
  | `git-no-blind-commit-guard` | `**[TAK]**` |
  | `git-destructive-action-blocker` | `**[TAK]**` |
  | `git-atomic-commit-enforcer` | `**[TAK]**` |

  Sekcja 4 (Planner):
  | Hook | Decyzja |
  |---|---|
  | `planner-no-code-guard` | `**[TAK]**` |
  | `planner-cost-estimation-enforcer` | `**[TAK]**` |

  Sekcja 5 (Code-Reviewer):
  | Hook | Decyzja |
  |---|---|
  | `reviewer-isolation-guard` | `**[TAK]**` |
  | `reviewer-read-only-guard` | `**[TAK]**` |

  Sekcja 6 (Globalne):
  | Hook | Decyzja |
  |---|---|
  | `global-secret-redactor` | `**[TAK]**` |
  | `global-loop-detector` | `**[MODYFIKUJ]** — po wykryciu pętli Dispatcher konsultuje się z agentem-doradcą (np. Debugger) zanim ponowi próbę, a nie powtarza ślepo` |
  | `global-tool-output-truncator` | `**[TAK]**` |
  | `global-json-recovery` | `**[TAK]**` |

  Pytania architektoniczne — dodaj blok `**Odpowiedź:**` po każdym pytaniu:

  Po pytaniu 1 ("Sposób definicji..."):
  ```
  **Odpowiedź:** Twardy kod (TypeScript). Żelazne zasady NIE są konfigurowalne przez użytkownika.
  ```

  Po pytaniu 2 ("Kary dla agentów..."):
  ```
  **Odpowiedź:** Hybryda — 1 szansa na autokorektę (hook zwraca błąd do agenta z informacją co zrobił źle), potem twardy stop + raport do Dispatchera.
  ```

  Po pytaniu 3 ("Dynamiczne zasady..."):
  ```
  **Odpowiedź:** TAK — użytkownik może dodawać własne zasady w plikach `.diricode/agents/*.md`.
  ```

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All 17 Decyzja cells filled
    Tool: Bash (grep)
    Preconditions: File edited with Edit tool
    Steps:
      1. Run: grep -P "\| $" ankieta-zelazne-zasady.md | wc -l
      2. Assert: result is 0
      3. Run: grep -c "TAK" ankieta-zelazne-zasady.md
      4. Assert: result >= 16
      5. Run: grep -c "MODYFIKUJ" ankieta-zelazne-zasady.md
      6. Assert: result is 1
    Expected Result: All cells filled correctly
    Evidence: .sisyphus/evidence/task-1-verify-zelazne.txt

  Scenario: Architecture answers present
    Tool: Bash (grep)
    Preconditions: File edited
    Steps:
      1. Run: grep -c "Odpowiedź:" ankieta-zelazne-zasady.md
      2. Assert: result is 3
      3. Run: grep "Twardy kod" ankieta-zelazne-zasady.md
      4. Assert: match found
      5. Run: grep "Hybryda" ankieta-zelazne-zasady.md
      6. Assert: match found
    Expected Result: Three answers with correct content
    Evidence: .sisyphus/evidence/task-1-verify-answers.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `docs(surveys): fill in hook decisions for żelazne zasady and OMO analysis`
  - Files: `ankieta-zelazne-zasady.md`, `analiza-hookow-omo.md`
  - Pre-commit: grep verification

---

- [ ] 2. Wypełnij analiza-hookow-omo.md (40 hooków)

  **What to do**:
  - Użyj narzędzia `Edit` do wypełnienia każdej pustej komórki "Decyzja (TAK/NIE/v2)" w tabelach
  - Dla każdego hooka zamień `| |` (pustą komórkę na końcu wiersza) na odpowiednią decyzję
  - Dla duplikatów użyj formatu: `TAK (duplikat [nazwa-oryginału] — jeden hook)`
  - Dla MODYFIKUJ użyj formatu: `MODYFIKUJ — [uwaga użytkownika]`
  - Użyj dokładnych stringów z mapy decyzji poniżej

  **Must NOT do**:
  - NIE zmieniaj żadnego tekstu poza komórkami Decyzja
  - NIE formatuj tabel, nie naprawiaj polszczyzny
  - NIE dodawaj komentarzy ani podsumowań
  - NIE zmieniaj kolejności sekcji

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Czysto mechaniczne edycje — wypełnianie komórek tabeli
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (z Task 1 — różne pliki)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `analiza-hookow-omo.md` — cały plik, tabele z pustymi komórkami "Decyzja (TAK/NIE/v2)"

  **MAPA DECYZJI — analiza-hookow-omo.md**:

  Sekcja 1 (Bezpieczeństwo):
  | Hook | Decyzja |
  |---|---|
  | `write-existing-file-guard` | `TAK` |
  | `stop-continuation-guard` | `TAK` |
  | `tasks-todowrite-disabler` | `TAK` |
  | `unstable-agent-babysitter` | `TAK` |
  | `ralph-loop` | `TAK` |

  Sekcja 2 (Fallbacki):
  | Hook | Decyzja |
  |---|---|
  | `model-fallback` | `MODYFIKUJ — bogaty system multi-subscription: ten sam model z innej subskrypcji, konfigurowalne łańcuchy fallback, powiadomienie użytkownika przy zmianie modelu (szczególnie w sub-agentach, gdzie zmiana może być niewidoczna)` |
  | `runtime-fallback` | `TAK` |
  | `session-recovery` | `TAK` |
  | `edit-error-recovery` | `TAK` |
  | `json-error-recovery` | `TAK (duplikat global-json-recovery — jeden hook)` |
  | `anthropic-context-window-limit-recovery` | `TAK` |
  | `delegate-task-retry` | `TAK` |

  Sekcja 3 (Kontekst):
  | Hook | Decyzja |
  |---|---|
  | `rules-injector` | `MODYFIKUJ — inteligentne wstrzykiwanie, tylko zasady istotne dla danego agenta (nie cały ruleset)` |
  | `directory-agents-injector` | `TAK` |
  | `directory-readme-injector` | `MODYFIKUJ — Dispatcher musi znać README, ale w wersji zwięzłej, żeby nie marnować kontekstu` |
  | `category-skill-reminder` | `TAK` |
  | `agent-usage-reminder` | `TAK` |
  | `auto-slash-command` | `TAK` |

  Sekcja 4 (Stan i TODO):
  | Hook | Decyzja |
  |---|---|
  | `todo-continuation-enforcer` | `MODYFIKUJ — sub-agent czyta TYLKO swój pod-TODO (np. kroki 3-4), NIE całe todo.md. Nie marnować kontekstu ani nie mylić agenta nieistotnymi informacjami.` |
  | `task-resume-info` | `TAK` |
  | `start-work` | `TAK` |
  | `sisyphus-junior-notepad` | `TAK` |

  Sekcja 5 (Modyfikacja danych):
  | Hook | Decyzja |
  |---|---|
  | `hashline-read-enhancer` | `TAK` |
  | `tool-output-truncator` | `TAK (duplikat global-tool-output-truncator — jeden hook)` |
  | `question-label-truncator` | `TAK` |
  | `comment-checker` | `TAK` |

  Sekcja 6 (Kompakcja):
  | Hook | Decyzja |
  |---|---|
  | `context-window-monitor` | `TAK` |
  | `preemptive-compaction` | `TAK` |
  | `compaction-context-injector` | `TAK` |
  | `compaction-todo-preserver` | `TAK` |

  Sekcja 7 (Powiadomienia):
  | Hook | Decyzja |
  |---|---|
  | `session-notification` | `TAK` |
  | `background-notification` | `TAK` |
  | `interactive-bash-session` | `TAK` |
  | `non-interactive-env` | `TAK` |
  | `auto-update-checker` | `v2` |

  Sekcja 8 (Model-specific):
  | Hook | Decyzja |
  |---|---|
  | `think-mode` / `thinking-block-validator` | `TAK` |
  | `claude-code-hooks` | `TAK` |
  | `no-sisyphus-gpt` | `TAK` |
  | `no-hephaestus-non-gpt` | `TAK` |
  | `prometheus-md-only` | `TAK` |

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All 40 Decyzja cells filled
    Tool: Bash (grep)
    Preconditions: File edited with Edit tool
    Steps:
      1. Run: grep -P "\| $" analiza-hookow-omo.md | wc -l
      2. Assert: result is 0
      3. Run: grep -c "MODYFIKUJ" analiza-hookow-omo.md
      4. Assert: result is 4
      5. Run: grep -c "duplikat" analiza-hookow-omo.md
      6. Assert: result is 2
      7. Run: grep -c "v2" analiza-hookow-omo.md
      8. Assert: result >= 1
    Expected Result: All cells filled, MODYFIKUJ/duplikat/v2 counts correct
    Evidence: .sisyphus/evidence/task-2-verify-omo.txt

  Scenario: No content modified outside Decyzja cells
    Tool: Bash (diff)
    Preconditions: Before/after comparison
    Steps:
      1. Run: wc -l analiza-hookow-omo.md
      2. Assert: same line count as original (in-place edits only)
      3. Run: grep "Blokuje użycie" analiza-hookow-omo.md
      4. Assert: original text preserved
      5. Run: grep "Przydatność w DiriCode" analiza-hookow-omo.md
      6. Assert: header preserved
    Expected Result: Only Decyzja cells changed
    Evidence: .sisyphus/evidence/task-2-verify-integrity.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `docs(surveys): fill in hook decisions for żelazne zasady and OMO analysis`
  - Files: `ankieta-zelazne-zasady.md`, `analiza-hookow-omo.md`
  - Pre-commit: grep verification

---

- [ ] 3. Weryfikacja końcowa obu plików

  **What to do**:
  - Uruchom wszystkie scenariusze QA z Task 1 i Task 2
  - Zweryfikuj integralność obu plików
  - Potwierdź że żadne treści poza Decyzja nie zostały zmienione

  **Must NOT do**:
  - NIE dodawaj podsumowań ani raportów
  - NIE twórz nowych plików (poza evidence)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Prosta weryfikacja grep/wc
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: None (final)
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `ankieta-zelazne-zasady.md` — zweryfikować
  - `analiza-hookow-omo.md` — zweryfikować

  **Acceptance Criteria**:

  ```
  Scenario: Final verification — all checks pass
    Tool: Bash
    Preconditions: Tasks 1 and 2 completed
    Steps:
      1. grep -P "\| $" ankieta-zelazne-zasady.md | wc -l → Assert: 0
      2. grep -P "\| $" analiza-hookow-omo.md | wc -l → Assert: 0
      3. grep -c "Odpowiedź:" ankieta-zelazne-zasady.md → Assert: 3
      4. grep -c "MODYFIKUJ" ankieta-zelazne-zasady.md → Assert: 1
      5. grep -c "MODYFIKUJ" analiza-hookow-omo.md → Assert: 4
      6. grep -c "duplikat" analiza-hookow-omo.md → Assert: 2
      7. grep -c "v2" analiza-hookow-omo.md → Assert: ≥1
    Expected Result: All counts match expectations
    Evidence: .sisyphus/evidence/task-3-final-verify.txt
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1+2 | `docs(surveys): fill in hook decisions for żelazne zasady and OMO analysis` | `ankieta-zelazne-zasady.md`, `analiza-hookow-omo.md` | grep counts |

---

## Success Criteria

### Verification Commands
```bash
grep -P "\| $" ankieta-zelazne-zasady.md | wc -l  # Expected: 0
grep -P "\| $" analiza-hookow-omo.md | wc -l      # Expected: 0
grep -c "Odpowiedź:" ankieta-zelazne-zasady.md     # Expected: 3
grep -c "MODYFIKUJ" ankieta-zelazne-zasady.md       # Expected: 1
grep -c "MODYFIKUJ" analiza-hookow-omo.md           # Expected: 4
grep -c "duplikat" analiza-hookow-omo.md            # Expected: 2
```

### Final Checklist
- [ ] All "Must Have" present: 17+40 decyzji + 3 odpowiedzi
- [ ] All "Must NOT Have" absent: zero zmian poza Decyzja/Odpowiedź
- [ ] All verification commands pass
