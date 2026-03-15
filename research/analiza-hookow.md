# Analiza: Hooki — OMO + Claude Code → DiriCode Roadmap

**TASK-001**: Hooki — analiza OMO + Claude Code (zmniejszony zakres)
**Status**: KOMPLETNY
**Data**: 2026-03-10
**Zrodla**: Oh-My-OpenCode (44 hooki, analiza-hookow-omo.md), Claude Code (12 typow hookow, analiza-claude-code.md),
spec-mvp-diricode.md (ADR-005, 6 hookow MVP)

---

## Spis tresci

1. [Stan obecny — 6 hookow MVP (ADR-005)](#1-stan-obecny)
2. [Zrodla hookow](#2-zrodla-hookow)
   - 2.1 Oh-My-OpenCode — 44 hooki (8 kategorii)
   - 2.2 Claude Code — 12 typow hookow
3. [Kategoryzacja zbiorcza — 20 rodzajow hookow DiriCode](#3-kategoryzacja-zbiorcza)
4. [Roadmap: MVP → v2 → v3](#4-roadmap)
5. [Wplyw na lean mode](#5-lean-mode)
6. [Wplyw na dispatcher (read-only)](#6-dispatcher)
7. [Nowe hooki (luki do uzupelnienia)](#7-nowe-hooki)
8. [Rekomendacja architektonicznna](#8-rekomendacja)

---

## 1. Stan obecny — 6 hookow MVP (ADR-005)

Decyzja zatwierdzona w spec:

| # | Hook | Trigger | Kategoria |
|---|------|---------|-----------|
| 1 | `session-start` | Start nowej sesji | lifecycle |
| 2 | `pre-commit` | Przed git commit | safety |
| 3 | `post-commit` | Po git commit | lifecycle |
| 4 | `error` (retry only) | Blad API/narzedzia | recovery |
| 5 | `plan-created` | Planner wygeneruje plan | quality |
| 6 | `plan-validated` | Verifier zatwierdzil plan | quality |

**Framework MVP**: silent fail, timeout 3s, automatyczny DAG, deklaratywne zaleznosci.

---

## 2. Zrodla hookow

### 2.1 Oh-My-OpenCode — 44 hooki (8 kategorii)

Pelna analiza: `analiza-hookow-omo.md`

| Kategoria | Ilosc | Przyklady |
|-----------|-------|-----------|
| Bezpieczenstwo i ochrona | 5 | write-existing-file-guard, ralph-loop, stop-continuation-guard |
| Fallback i odzyskiwanie | 7 | model-fallback, edit-error-recovery, json-error-recovery, delegate-task-retry |
| Wstrzykiwanie kontekstu | 6 | rules-injector, category-skill-reminder, agent-usage-reminder |
| Zarzadzanie stanem / TODO | 4 | todo-continuation-enforcer, task-resume-info, start-work |
| Modyfikacja danych | 4 | hashline-read-enhancer, tool-output-truncator |
| Kompakcja | 4 | context-window-monitor, preemptive-compaction |
| Powiadomienia i srodowisko | 5 | session-notification, non-interactive-env, interactive-bash-session |
| Specyficzne dla modeli | 5 | think-mode, thinking-block-validator |
| **LACZNIE** | **44** | |

### 2.2 Claude Code — 12 typow hookow

Zrodlo: `analiza-claude-code.md`, sekcja E

| # | Typ hooka | Trigger | Odpowiednik OMO |
|---|-----------|---------|-----------------|
| 1 | `PreToolUse` | Przed kazdym uzyciem narzedzia | write-existing-file-guard (czesciowo) |
| 2 | `PostToolUse` | Po kazdym uzyciu narzedzia | comment-checker (czesciowo) |
| 3 | `SessionStart` | Start sesji | rules-injector + directory-readme-injector |
| 4 | `Stop` | Agent chce zakonczyc | stop-continuation-guard |
| 5 | `UserPromptSubmit` | User wysyla prompt | auto-slash-command |
| 6 | `InstructionsLoaded` | Zaladowanie instrukcji | rules-injector |
| 7 | `ConfigChange` | Zmiana konfiguracji | BRAK w OMO |
| 8 | `WorktreeCreate` | Utworzenie worktree | BRAK w OMO |
| 9 | `WorktreeRemove` | Usuniecie worktree | BRAK w OMO |
| 10 | `TeammateIdle` | Sub-agent bezczynny | BRAK w OMO |
| 11 | `TaskCompleted` | Zakonczenie zadania | BRAK w OMO |
| 12 | `SubagentStop` | Zatrzymanie sub-agenta | delegate-task-retry (czesciowo) |

**Kluczowa roznica architektury**:
- Claude Code: hooki = **zewnetrzne procesy** (Python/bash, stdin JSON → stdout JSON)
- OMO: hooki = **in-process TypeScript** hooks w tym samym procesie
- DiriCode: **hybrydowy** — in-process TS (core, szybkie) + opcjonalnie zewnetrzne procesy (community)

---

## 3. Kategoryzacja zbiorcza — 20 rodzajow hookow DiriCode

Polaczenie OMO (44) + Claude Code (12) + DiriCode-specyficzne (nowe) = **20 rodzajow hookow**.
ARCH-003 wymaga 15-20 rodzajow — cel spelniany.

| # | Hook DiriCode | Kategoria | Zrodlo | MVP/v2/v3 | Opis |
|---|---------------|-----------|--------|-----------|------|
| 1 | `session-start` | lifecycle | OMO + CC | **MVP** | Inicjalizacja sesji, wstrzykiwanie kontekstu poczatkowego |
| 2 | `pre-commit` | safety | OMO | **MVP** | Walidacja przed git commit (secret scan, staged files review) |
| 3 | `post-commit` | lifecycle | OMO | **MVP** | Akcje po commicie (powiadomienia, aktualizacja Issues) |
| 4 | `error-retry` | recovery | OMO + CC | **MVP** | Retry z backoff, wstrzykniecie podpowiedzi naprawy |
| 5 | `plan-created` | quality | OMO | **MVP** | Walidacja planu (kompletnosc, realnosc) |
| 6 | `plan-validated` | quality | OMO | **MVP** | Plan zatwierdzony, mozna rozpoczac execute |
| 7 | `pre-tool-use` | safety | CC | **v2** | Walidacja argumentow narzedzia PRZED wykonaniem |
| 8 | `post-tool-use` | quality | CC | **v2** | Weryfikacja wyniku narzedzia PO wykonaniu |
| 9 | `context-monitor` | context | OMO | **v2** | Sledzenie zuzycia tokenow, alarm przy limicie |
| 10 | `preemptive-compaction` | context | OMO | **v2** | Kompakcja konwersacji PRZED osiagnieciem limitu |
| 11 | `rules-injection` | context | OMO + CC | **v2** | Wstrzykiwanie regul (.cursorrules, AGENTS.md) — inteligentne per-agent |
| 12 | `file-guard` | safety | OMO | **v2** | Blokowanie nadpisania pliku write'em (wymuszenie edit) |
| 13 | `loop-detection` | safety | OMO | **v2** | Hashowanie akcji, detekcja powtarzalnych petli |
| 14 | `session-end` | lifecycle | CC | **v3** | Cleanup, zapis metryki, powiadomienie |
| 15 | `task-completed` | lifecycle | CC | **v3** | Post-task actions (metryki, GitHub Issue update) |
| 16 | `worktree-create` | lifecycle | CC | **v3** | Setup nowego worktree (inicjalizacja kontekstu) |
| 17 | `worktree-remove` | lifecycle | CC | **v3** | Cleanup po usunieciu worktree |
| 18 | `config-change` | lifecycle | CC | **v3** | Reakcja na zmiane konfiguracji w runtime |
| 19 | `user-prompt-submit` | context | CC | **v3** | Przetworzenie promptu usera (auto-slash, enrichment) |
| 20 | `subagent-stop` | lifecycle | CC | **v3** | Reakcja na zatrzymanie sub-agenta (retry? eskalacja?) |

---

## 4. Roadmap: MVP → v2 → v3

### MVP (6 hookow) — ZATWIERDZONE

```
session-start, pre-commit, post-commit, error-retry, plan-created, plan-validated
```

Pokrywaja: podstawowy lifecycle + safety + quality.

### v2 (6 hookow) — PRIORYTETOWE

```
pre-tool-use, post-tool-use, context-monitor, preemptive-compaction, rules-injection, file-guard, loop-detection
```

**Uzasadnienie v2:**
- `pre-tool-use` + `post-tool-use` — fundament annotation-driven approval (ADR-019 v2)
- `context-monitor` + `preemptive-compaction` — krytyczne dla waskich okien (ADR-022)
- `rules-injection` — standard w branzy (dotfiles, .cursorrules)
- `file-guard` + `loop-detection` — bezpieczenstwo production-grade

### v3 (7 hookow) — NICE-TO-HAVE

```
session-end, task-completed, worktree-create, worktree-remove,
config-change, user-prompt-submit, subagent-stop
```

**Uzasadnienie v3:**
- Lifecycle hooks (session-end, task-completed) — metryki i UX
- Worktree hooks — potrzebne dopiero przy multi-worktree workflows
- config-change — runtime hot-reload
- user-prompt-submit — enrichment, nie krytyczne
- subagent-stop — advanced orchestration

---

## 5. Wplyw na lean mode

| Hook | Lean mode zachowanie |
|------|---------------------|
| session-start | ✅ Zawsze aktywny (uproszczone wstrzykiwanie) |
| pre-commit | ✅ Zawsze aktywny (bezpieczenstwo) |
| post-commit | ⚡ Pomijany (nie krytyczny) |
| error-retry | ✅ Zawsze aktywny (zmniejszona liczba retries: max 1) |
| plan-created | ⚡ Pomijany (plan nie jest walidowany w lean mode) |
| plan-validated | ⚡ Pomijany (jw.) |
| pre-tool-use (v2) | ⚡ Uproszczony (tylko destrukcyjne narzedzia) |
| post-tool-use (v2) | ⚡ Pomijany |
| context-monitor (v2) | ✅ Zawsze aktywny (krytyczny) |
| preemptive-compaction (v2) | ✅ Zawsze aktywny (krytyczny) |
| rules-injection (v2) | ⚡ Uproszczony (tylko krytyczne reguly) |
| file-guard (v2) | ✅ Zawsze aktywny (bezpieczenstwo) |
| loop-detection (v2) | ✅ Zawsze aktywny (bezpieczenstwo) |

**Lean mode summary**: Pomija hooki quality (plan validation, post-tool-use), upraszcza context injection, zachowuje WSZYSTKIE hooki safety i context-monitoring.

---

## 6. Wplyw na dispatcher (read-only)

Dispatcher jest agentem orkiestrujacym — nie pisze kodu, nie commituje.
Ktore hooki sa istotne?

| Hook | Istotny dla dispatcher? | Dlaczego |
|------|------------------------|----------|
| session-start | ✅ TAK | Inicjalizuje kontekst dispatchera |
| pre-commit | ❌ NIE | Dispatcher nie commituje |
| post-commit | ❌ NIE | jw. |
| error-retry | ✅ TAK | Dispatcher musi zarzadzac bledami sub-agentow |
| plan-created | ✅ TAK | Dispatcher waliduje plan |
| plan-validated | ✅ TAK | Dispatcher kontynuuje po walidacji |
| pre-tool-use (v2) | ✅ TAK | Dispatcher moze uzywac narzedzi (read, search) |
| context-monitor (v2) | ✅ TAK | Dispatcher tez ma budzet kontekstu |
| rules-injection (v2) | ✅ TAK | Dispatcher potrzebuje regul projektu |
| loop-detection (v2) | ✅ TAK | Dispatcher moze wpasc w petle delegacji |

---

## 7. Nowe hooki (luki do uzupelnienia)

Porownanie z ARCH-003 (15-20 hookow) — aktualnie mamy 20. Opcjonalnie mozna dodac:

| Hook kandydat | Kategoria | Zrodlo inspiracji | Priorytet |
|---------------|-----------|-------------------|-----------|
| `approval-request` | approval | Claude Code (enterprise permissions) | v3/v4 |
| `message-pre-send` | context | Cline (message transform) | v3 |
| `message-post-receive` | context | Cline (response transform) | v3 |
| `notification` | UX | OMO (session-notification) | v2 |
| `auto-continue-decision` | lifecycle | Plandex (exec-status) | v2 |

Z tymi kandydatami: **25 rodzajow hookow** — znaczaco wiecej niz Claude Code (12).

---

## 8. Rekomendacja architektonicznna

### 8.1 Hybrydowy model hookow (potwierdzona rekomendacja)

```
┌──────────────────────────────────────────────────┐
│ In-process TS hooks (core, szybkie, <3ms)        │
│ - session-start, error-retry, context-monitor    │
│ - pre-tool-use, file-guard, loop-detection       │
│ - Timeout: 3s (ADR-005)                          │
│ - Silent fail pattern                            │
├──────────────────────────────────────────────────┤
│ External process hooks (community, izolowane)    │
│ - Python/bash/any language                       │
│ - stdin JSON → stdout JSON (Claude Code pattern) │
│ - Timeout: 10s (dluzszy niz in-process)          │
│ - Sandbox per hook (v3)                          │
└──────────────────────────────────────────────────┘
```

### 8.2 Hook registry

```typescript
interface HookDefinition {
    name: string;
    type: 'in-process' | 'external';
    trigger: HookTrigger;
    category: 'lifecycle' | 'safety' | 'quality' | 'context' | 'recovery' | 'approval' | 'UX';
    dependsOn?: string[];     // DAG dependencies
    timeout: number;          // ms
    silentFail: boolean;
    leanModeAction: 'always' | 'simplified' | 'skip';
    dispatcherRelevant: boolean;
}
```

### 8.3 OMO hooki → DiriCode mapping (key 44 → 20)

Wiele z 44 hookow OMO to **implementacje** (np. hashline-read-enhancer, tool-output-truncator)
a nie **typy hookow**. W DiriCode:

- `hashline-read-enhancer` → wbudowane w tool implementation (nie hook)
- `tool-output-truncator` → `post-tool-use` hook (v2)
- `model-fallback` → Router (ADR-011), nie hook
- `runtime-fallback` → Router (ADR-011), nie hook
- `think-mode` → wbudowane w provider adapter
- `non-interactive-env` → wbudowane w Bash tool (ADR-015)
- `json-error-recovery` → `error-retry` hook (MVP)
- `edit-error-recovery` → `error-retry` hook (MVP)

**Wniosek**: 44 hookow OMO to zbior implementacji. DiriCode rozroznia **typy hookow** (20)
od **implementacji** (ktore moga zyc jako in-process logic, nie jako hooki).

---

## Appendix A: Mapowanie pelne OMO 44 → DiriCode 20

| OMO Hook | DiriCode Hook (typ) | Status |
|----------|---------------------|--------|
| write-existing-file-guard | file-guard | v2 |
| stop-continuation-guard | subagent-stop | v3 |
| tasks-todowrite-disabler | (wbudowane w tool policy) | — |
| unstable-agent-babysitter | error-retry | MVP |
| ralph-loop | loop-detection | v2 |
| model-fallback | (Router ADR-011) | — |
| runtime-fallback | (Router ADR-011) | — |
| session-recovery | session-start (resume) | MVP |
| edit-error-recovery | error-retry | MVP |
| json-error-recovery | error-retry | MVP |
| anthropic-context-window-limit-recovery | preemptive-compaction | v2 |
| delegate-task-retry | error-retry | MVP |
| rules-injector | rules-injection | v2 |
| directory-agents-injector | session-start | MVP |
| directory-readme-injector | rules-injection | v2 |
| category-skill-reminder | rules-injection | v2 |
| agent-usage-reminder | session-start | MVP |
| auto-slash-command | user-prompt-submit | v3 |
| todo-continuation-enforcer | (wbudowane w agent flow) | — |
| task-resume-info | session-start (resume) | MVP |
| start-work | session-start | MVP |
| sisyphus-junior-notepad | (sub-agent return policy) | — |
| hashline-read-enhancer | (wbudowane w tool) | — |
| tool-output-truncator | post-tool-use | v2 |
| question-label-truncator | (UI formatting) | — |
| comment-checker | post-tool-use | v2 |
| context-window-monitor | context-monitor | v2 |
| preemptive-compaction | preemptive-compaction | v2 |
| compaction-context-injector | preemptive-compaction | v2 |
| compaction-todo-preserver | preemptive-compaction | v2 |
| session-notification | notification | v2 |
| background-notification | notification | v2 |
| interactive-bash-session | (wbudowane w Bash tool) | — |
| non-interactive-env | (wbudowane w Bash tool) | — |
| auto-update-checker | (CLI feature) | v3 |
| think-mode | (wbudowane w provider adapter) | — |
| thinking-block-validator | (wbudowane w provider adapter) | — |
| claude-code-hooks | (provider-specific) | — |
| no-sisyphus-gpt | (config: agent→model mapping) | — |
| no-hephaestus-non-gpt | (config: agent→model mapping) | — |
| prometheus-md-only | (agent system prompt) | — |

**Wynik**: Z 44 hookow OMO, **20 mapuje sie na typy hookow DiriCode**, reszta to wbudowana logika (tools, router, config, UI).

---

## Appendix B: Mapowanie Claude Code 12 → DiriCode 20

| Claude Code Hook | DiriCode Hook (typ) | Status |
|------------------|---------------------|--------|
| PreToolUse | pre-tool-use | v2 |
| PostToolUse | post-tool-use | v2 |
| SessionStart | session-start | MVP |
| Stop | subagent-stop | v3 |
| UserPromptSubmit | user-prompt-submit | v3 |
| InstructionsLoaded | rules-injection | v2 |
| ConfigChange | config-change | v3 |
| WorktreeCreate | worktree-create | v3 |
| WorktreeRemove | worktree-remove | v3 |
| TeammateIdle | (auto-continue-decision kandydat) | v3 |
| TaskCompleted | task-completed | v3 |
| SubagentStop | subagent-stop | v3 |

---

*Dokument zakonczony. ARCH-003 spelniany: 20 rodzajow hookow (z opcja rozszerzenia do 25).*
*6 MVP hookow bez zmian (ADR-005). Roadmap: +7 w v2, +7 w v3.*
