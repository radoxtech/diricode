# Analiza: Ktore dokumenty powinny miec szablony i zostac przepisane po angielsku

> Data: 2026-03-10
> Status: ANALIZA GOTOWA — wymaga decyzji uzytkownika

---

## Klasyfikacja dokumentow

### Kategoria A: PRZEPISAC po angielsku (dokumenty specyfikacyjne — beda uzywane podczas implementacji)

Te dokumenty sa "zywymi" referencjami — agenci i deweloperzy beda z nich korzystac podczas implementacji.

| Dokument | Obecny jezyk | Uzasadnienie | Priorytet |
|----------|-------------|--------------|-----------|
| `spec-mvp-diricode.md` | Polski | Glowna specyfikacja. Bedzie czytana przez agentow AI. ADR-y juz przepisane (adr-all-english.md). Reszta sekcji (3-10) tez powinna byc po angielsku. | P0 |
| `plan-implementacji-diricode.md` | Polski | Plan implementacji — agenci beda go czytac i wykonywac. Po angielsku bedzie bardziej jednoznaczny dla LLM-ow. | P0 |
| `SPIS-TRESCI.md` | Polski | Nawigacja po dokumentacji. Powinien byc dwujezyczny lub angielski. | P1 |

**Szablon:** Specyfikacja — standardowy szablon sekcji (Identity, ADRs, Tech Stack, Config, MVP Scope, etc.) — juz implicitly zdefiniowany w spec-mvp-diricode.md.

### Kategoria B: ZOSTAWIC po polsku (dokumenty analityczne — research zamkniety)

Te dokumenty to zamkniety research. Decyzje z nich sa juz zakodowane w ADR-ach (po angielsku). Przepisywanie ich nie dodaje wartosci.

| Dokument | Powod zostawienia |
|----------|-------------------|
| `analiza-config-layers.md` | Zamkniety. Wszystkie 8 decyzji zakodowane w ADR-009/010/011. |
| `analiza-agent-roster.md` | Zamkniety. Roster w ADR-004. |
| `analiza-lean-mode.md` | Zamkniety. 4 wymiary w ADR-012. |
| `analiza-observability.md` | Zamkniety. EventStream w ADR-031. |
| `analiza-router.md` | Zamkniety. Router w ADR-025. |
| `analiza-context-management.md` | Zamkniety. Kontekst w ADR-016/017/018/019/020/021. |
| `analiza-hookow.md` | Zamkniety. Hooki w ADR-024. |
| `analiza-prompt-caching.md` | Zamkniety. Caching w ADR-026. |
| `analiza-licencji.md` | Zamkniety. Referencja prawna — jezyk nie ma znaczenia. |
| `analiza-web-framework.md` | Zamkniety. Framework w ADR-032. |
| `analiza-narzedzi-ekosystem.md` | Zamkniety. Wyniki w ADR-007/008/015/030. |
| `analiza-plandex-roles.md` | Zamkniety. Mapowanie w ADR-004. |

### Kategoria C: ZOSTAWIC po polsku (dokumenty historyczne — input do analiz)

Te dokumenty to wejsciowe dane (ankiety, porownania, wczensne analizy). Nie beda uzywane podczas implementacji.

| Dokument | Typ |
|----------|-----|
| `ankieta-wyniki.md` | Wyniki ankiety decyzyjnej — dane wejsciowe |
| `ankieta-features-ekosystem.md` | Ankieta features — dane wejsciowe |
| `porownanie-8-narzedzi.md` | Porownanie narzedzi — badanie wstepne |
| `zyczenia-codewroc.md` | Lista zyczen — wczesny input |
| `mapa-braki.md` | Mapa brakow — wczesna analiza |
| `mapa-funkcje.md` | Mapa funkcji — wczesna analiza |
| `architektura-opencode-omo.md` | Analiza architektury referencyjnej |
| `analiza-aider.md` | Analiza narzedzia — badanie |
| `analiza-claude-code.md` | Analiza narzedzia — badanie |
| `analiza-cline.md` | Analiza narzedzia — badanie |
| `analiza-codex.md` | Analiza narzedzia — badanie |
| `analiza-openhands.md` | Analiza narzedzia — badanie |
| `analiza-plandex.md` | Analiza narzedzia — badanie |
| `analiza-opencode-omo.md` | Analiza narzedzia — badanie |
| `analiza-hookow-omo.md` | Analiza hookow OMO — badanie |
| `analiza-litellm-ankieta.md` | Analiza LiteLLM — badanie |

### Kategoria D: USUNAC lub ARCHIWIZOWAC

| Dokument | Powod |
|----------|-------|
| `analizy-todo.md` | Wszystkie 13 taskow COMPLETE. Historyczny tracker — mozna archiwizowac. |

---

## Szablony — co potrzebuje szablonu?

| Typ dokumentu | Potrzebuje szablonu? | Uzasadnienie |
|---------------|---------------------|--------------|
| ADR | TAK — juz stworzony (`adr-template.md`) | Konsystentna struktura decyzji |
| Specyfikacja MVP | NIE — jedyny dokument tego typu | Szablon implicitly zdefiniowany |
| Plan implementacji | NIE — jedyny dokument tego typu | Szablon implicitly zdefiniowany |
| Analiza (TASK-xxx) | TAK — 13 dokumentow analitycznych | Gdyby powstaly nowe analizy w przyszlosci |

### Proponowany szablon analizy (jesli potrzebny w przyszlosci):

```markdown
# Analiza: [Temat]

> Data: YYYY-MM-DD
> Status: W TOKU / GOTOWA
> TASK: TASK-XXX
> Zlecajacy: [kto zlecil]

## Cel analizy

## Zakres

## Zrodla

## Wyniki

## Decyzje / Rekomendacje

## Nastepne kroki
```

---

## Rekomendacja

1. **TERAZ**: Przepisac `spec-mvp-diricode.md` po angielsku (juz zaplanowane — ADR-y gotowe, sekcje 3-10 do aktualizacji).
2. **TERAZ**: Przepisac `plan-implementacji-diricode.md` po angielsku.
3. **POZNIEJ**: Zaktualizowac `SPIS-TRESCI.md` (dwujezyczny lub angielski).
4. **NIE RUSZAC**: Wszystkie dokumenty kategorii B i C — zamkniety research po polsku, wartosc dodana z tlumaczenia = zero.
5. **ARCHIWIZOWAC**: `analizy-todo.md` — przeniesc do folderu `archive/` lub zostawic z notatka "COMPLETED".

---

## Decyzja wymagana od uzytkownika

1. Czy `plan-implementacji-diricode.md` tez przepisac po angielsku? (rekomendacja: TAK)
2. Czy `SPIS-TRESCI.md` po angielsku, dwujezyczny, czy zostawic? (rekomendacja: angielski)
3. Czy archiwizowac `analizy-todo.md`? (rekomendacja: TAK, folder `archive/`)
