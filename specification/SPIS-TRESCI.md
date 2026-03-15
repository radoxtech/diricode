# DiriCode — Spis tresci dokumentacji

Data aktualizacji: 2026-03-10

---

## KLUCZOWE DOKUMENTY (glowny folder)

### Specyfikacja i plan (ANGIELSKI)

| Plik | Opis | Status |
|------|------|--------|
| `spec-mvp-diricode.md` | Specyfikacja MVP — 10 sekcji po angielsku, 32 ADR-y (indeks), tech stack, config (JSONC + c12 + `.dc/`), monorepo, routing, 40 agentow, 4 wymiary pracy, hooki, bezpieczenstwo, families, skills, pipeline, guardrails, context management, observability. | ZATWIERDZONY — ANGIELSKI (369 linii) |
| `docs/adr/` | 32 ADR-y po angielsku w osobnych plikach (`adr-001.md` — `adr-032.md`) + `README.md` (indeks) + `adr-template.md`. | NOWY — ANGIELSKI |

| `plan-implementacji-diricode.md` | 5-fazowy plan implementacji z Mermaid diagramem i backlogiem GitHub Issues. Router first. | ZATWIERDZONY — POLSKI (289 linii) |
| `analiza-dokumenty-english-rewrite.md` | Analiza ktore dokumenty przepisac po angielsku — 4 kategorie, rekomendacje. | NOWY — POLSKI |

### Wyniki ankiet i zadania

| Plik | Opis | Status |
|------|------|--------|
| `ankieta-wyniki.md` | Pelne wyniki ankiety decyzyjnej 1 — 14 blokow, wszystkie decyzje, zmiany vs spec, cytaty uzytkownika. | KOMPLETNY |
| `ankieta-features-ekosystem.md` | Pelne wyniki ankiety decyzyjnej 2 — 11 blokow, 60+ features, wszystkie decyzje wypelnione, podsumowanie priorytetow. | KOMPLETNY |
| `analizy-todo.md` | 13 taskow analitycznych — WSZYSTKIE ZAMKNIETE. Uwagi uzytkownika (10 zelaznych wytycznych), graf zaleznosci, kolejnosc realizacji. | ZAMKNIETY (13/13) — do archiwizacji |

### Analizy (wyniki taskow) — ZAMKNIETE, decyzje zakodowane w ADR-ach

| Plik | TASK | Opis | Odpowiadajace ADR-y |
|------|------|------|---------------------|
| `analiza-config-layers.md` | TASK-006 | Config layers — 8 decyzji uzytkownika (JSONC, `.dc/`, 4 warstwy, c12, `DC_*`, .env, brak substytucji, Linux+macOS). | ADR-009, 010, 011 |
| `analiza-agent-roster.md` | TASK-008a | Finalna lista 40 agentow — 6 kategorii, 3 tiery, mapowanie z 7 frameworkow. | ADR-004, 005 |
| `analiza-lean-mode.md` | TASK-008b | System 4 wymiarow pracy — Quality (5), Autonomy (5), Verbose (4), Creativity (5). Matryca agentow. | ADR-012 |
| `analiza-observability.md` | TASK-013 | EventStream, 3 komponenty MVP, 3 komponenty v2, integracja z 4 wymiarami. | ADR-031 |
| `analiza-router.md` | TASK-005 | Architektura routerow — LiteLLM, Plandex, OpenCode/OMO, Codex. Natywny TS, 7 typow bledow, retry+fallback. | ADR-025 |
| `analiza-context-management.md` | TASK-002+007 | 3-warstwowa architektura kontekstu, pipeline condenserow, schemat SQLite, budzety tokenow. | ADR-016, 017, 018, 019, 020, 021 |
| `analiza-hookow.md` | TASK-001 | 20 typow hookow DiriCode, roadmap MVP/v2/v3, hybrydowy model wykonania. | ADR-024 |
| `analiza-prompt-caching.md` | TASK-011 | Prompt caching u providerow, benchmarki oszczednosci, rekomendacja Phase 2. | ADR-026 |
| `analiza-web-framework.md` | TASK-004 | Frameworki webowe pod katem AI code generation + Reddit/HN research. Vite + React + shadcn/ui. | ADR-032 |
| `analiza-narzedzi-ekosystem.md` | — | Analiza 7 narzedzi ekosystemu Claude Code — jakosc kodu, architektura, licencje, wzorce do adopcji. | ADR-007, 008, 015, 030 |
| `analiza-plandex-roles.md` | TASK-012 | Mapowanie rol Plandex na agentow DiriCode — AgentConfig, Family Packs. | ADR-004, 006 |
| `analiza-licencji.md` | TASK-010 | Licencje 15 projektow — matryca co mozna kopiowac, co nie. | — |

### Wymagania i wizja

| Plik | Opis | Status |
|------|------|--------|
| `zyczenia-codewroc.md` | Wymagania i zyczenia uzytkownika — 10 sekcji. Zrodlo prawdy o wizji projektu. | KOMPLETNY |

### Analizy frameworkow (zrodla do taskow)

| Plik | Rozmiar | Opis |
|------|---------|------|
| `porownanie-8-narzedzi.md` | 55 KB | Porownanie 8 frameworkow — glowne zrodlo referencyjne. |
| `analiza-aider.md` | 31 KB | Aider — repo-map, context management, edit formats. |
| `analiza-cline.md` | 44 KB | Cline — tree-sitter, diff strategy, context. |
| `analiza-openhands.md` | 43 KB | OpenHands — Docker sandbox, event stream, state. |
| `analiza-plandex.md` | 42 KB | Plandex — roles, plan-based workflow, context. |
| `analiza-codex.md` | 34 KB | Codex CLI — sandbox, routing, context. |
| `analiza-claude-code.md` | 23 KB | Claude Code — hooki, permissions, tools. |
| `analiza-opencode-omo.md` | 17 KB | OpenCode + OMO — architektura, agenty, hooki. |
| `analiza-hookow-omo.md` | 9 KB | Szczegolowa analiza 12 hookow OMO. |
| `analiza-litellm-ankieta.md` | 13 KB | Analiza LiteLLM — architektura proxy, routing. |
| `architektura-opencode-omo.md` | 45 KB | Architektura OpenCode + OMO — szczegolowy raport. |

### Mapy (kontekst projektowy)

| Plik | Opis | Status |
|------|------|--------|
| `mapa-funkcje.md` | Mapa funkcji OpenCode + OMO — mind map feature'ow. | KOMPLETNY |
| `mapa-braki.md` | 43 zidentyfikowane luki i problemy w OC + OMO. | KOMPLETNY |

---

## FOLDERY

### `example-repos/` — Kody zrodlowe analizowanych frameworkow

| Repozytorium | Framework |
|-------------|-----------|
| `aider/` | Aider |
| `cline/` | Cline |
| `OpenHands/` | OpenHands |
| `plandex/` | Plandex |
| `codex/` | Codex CLI |
| `claude-code/` | Claude Code |
| `opencode/` | OpenCode |
| `oh-my-opencode/` | Oh-My-OpenCode |
| `litellm/` | LiteLLM |

### `example-repos/tools/` — Narzedzia ekosystemu Claude Code

| Repozytorium | Narzedzie | Licencja |
|-------------|-----------|----------|
| `superpowers/` | Superpowers (skills + agents) | MIT |
| `claude-mem/` | Claude-Mem (pamiec projektowa) | AGPL-3.0 ⚠️ |
| `get-shit-done/` | GSD (interview→plan→execute) | MIT |
| `n8n-mcp/` | n8n-MCP (1084 node tools) | MIT |
| `obsidian-skills/` | Obsidian Skills (SKILL.md standard) | MIT |
| `ui-ux-pro-max-skill/` | UI/UX Pro Max (data-driven skill) | MIT |
| `awesome-claude-code/` | Awesome Claude Code (curated list) | CC BY-NC-ND 4.0 |

### `archiwum/` — Nieaktualne dokumenty

Dokumenty zastapione nowszymi wersjami. Zachowane dla historii.

---

## STATUS PROJEKTU

- ✅ Faza analizy: ZAKONCZONA (13/13 taskow)
- ✅ ADR-y: PRZEPISANE po angielsku (32 ADR-y, 1357 linii)
- ✅ Specyfikacja: ZAKTUALIZOWANA po angielsku (369 linii)
- ⬜ Nastepny krok: Implementacja Phase 1 (Router first)
