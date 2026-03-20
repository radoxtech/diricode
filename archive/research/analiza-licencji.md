# DiriCode — Analiza Licencji (TASK-010)

Data: 2026-03-09
Status: KOMPLETNY

---

## Cel

Analiza licencji open source wszystkich analizowanych frameworkow i narzedzi ekosystemu.
Okreslenie co mozemy pozyczac bezposrednio (kod), co mozemy pozyczac jako pomysly/architekture,
a czego musimy unikac i zaimplementowac po swojemu.

Zgodnie z LEGAL-001: Unikamy kopiowania kodu i bezposrednio rozwiazan ktore maja kiepska licencje OpenSource.

---

## Podsumowanie — Tabela Licencji

### Glowne frameworki (8 analizowanych)

| Projekt | Licencja | Mozna kopiowac kod? | Mozna kopiowac architekture? | Ryzyka | Uwagi |
|---------|----------|---------------------|------------------------------|--------|-------|
| **Aider** | Apache-2.0 | ⚠️ TAK, z warunkami | ✅ TAK | Trzeba zachowac headery + NOTICE | Zachowaj NOTICE file jesli kopiujesz znaczace fragmenty |
| **Cline** | Apache-2.0 | ⚠️ TAK, z warunkami | ✅ TAK | Trzeba zachowac headery + NOTICE | j.w. |
| **OpenHands** | MIT + PolyForm (mieszana) | ⚠️ Czesciowo | ✅ TAK (czesc MIT) | Enterprise/ foldery maja restrykcyjna PolyForm | Tylko czesci MIT — omijac enterprise/ |
| **Plandex** | MIT | ✅ TAK | ✅ TAK | Brak | Mozna swobodnie kopiowac kod i pomysly na agenty/role |
| **Codex CLI** | Apache-2.0 | ⚠️ TAK, z warunkami | ✅ TAK | Trzeba zachowac headery + NOTICE | j.w. |
| **Claude Code** | Commercial TOU (Anthropic) | ❌ NIE | ⚠️ Ostrożnie | Warunki uzytkowania Anthropic zabraniaja kopiowania | Mozna sie inspirowac architektura, NIE kopiowac kodu |
| **OpenCode** | MIT | ✅ TAK | ✅ TAK | Brak | Mozna swobodnie kopiowac |
| **Oh-My-OpenCode** | Mieszana / SUL-1.0 | ⚠️ Wymaga audytu per-file | ⚠️ Ostrożnie | SUL-1.0 (Source Use License) — nie jest standardowa OSS | Kazdy plik trzeba sprawdzic osobno |

### Narzedzia ekosystemu (7 analizowanych)

| Projekt | Licencja | Mozna kopiowac kod? | Uwagi |
|---------|----------|---------------------|-------|
| **Superpowers** | MIT | ✅ TAK | Skills + agents framework |
| **Claude-Mem** | AGPL-3.0 (+PolyForm vendored) | ❌ NIE | AGPL wymaga udostepnienia zrodel calego projektu przy dystrybucji |
| **GSD (Get Shit Done)** | MIT | ✅ TAK | Pipeline interview→plan→execute |
| **n8n-MCP** | MIT | ✅ TAK | 1084 node tools via MCP |
| **Obsidian Skills** | MIT | ✅ TAK | agentskills.io SKILL.md standard |
| **UI/UX Pro Max** | MIT | ✅ TAK | Data-driven skill |
| **Awesome Claude Code** | CC BY-NC-ND 4.0 | ❌ NIE | Tylko referencja, zakaz modyfikacji i uzycia komercyjnego |

---

## Szczegolowa Analiza Licencji

### MIT (Plandex, OpenCode, Superpowers, GSD, n8n-MCP, Obsidian Skills, UI/UX Pro Max)

**Co mozna:**
- Kopiowac kod bezposrednio
- Modyfikowac i dystrybuowac
- Uzywac komercyjnie
- Laczyc z innym kodem (w tym zamknietym)

**Warunki:**
- Zachowac oryginalny copyright notice
- Zachowac kopie licencji MIT

**Ryzyko: MINIMALNE**

---

### Apache-2.0 (Aider, Cline, Codex CLI)

**Co mozna:**
- Kopiowac kod
- Modyfikowac i dystrybuowac
- Uzywac komercyjnie
- Uzywac patentow autorow (patent grant)

**Warunki:**
- Zachowac oryginalne headery copyright w skopiowanych plikach
- Jesli istnieje NOTICE file — musi byc dolaczony
- Wyraznie oznaczyc zmodyfikowane pliki
- NIE mozna uzywac nazwy/znakow handlowych oryginalnego projektu

**Ryzyko: NISKIE** — ale wymaga dyscypliny (headery, NOTICE)

**Praktycznie dla DiriCode:**
- Jesli kopiujemy znaczacy fragment z Aider/Cline/Codex → zachowujemy header
- Jesli piszemy od zera inspirujac sie architektura → brak wymagan

---

### Commercial TOU — Anthropic (Claude Code)

**Co mozna:**
- Czytac kod (jesli publicznie dostepny)
- Inspirowac sie architektura i wzorcami
- Pisac wlasna implementacje tych samych koncepcji

**Czego NIE mozna:**
- Kopiowac kodu
- Uzywac fragmentow kodu w swoim projekcie
- Tworzyc pochodnych prac (derivative works) z kodu

**Ryzyko: WYSOKIE** jesli skopiujemy kod

**Praktycznie dla DiriCode:**
- 12+ hookow Claude Code → implementujemy sami od zera
- Wzorce approval/permissions → inspiracja ok, kod NIE
- Nigdy nie kopiuj-wklej z tego repo

---

### AGPL-3.0 (Claude-Mem)

**Problem:** AGPL wymaga ze jesli uzywasz kodu w serwisie sieciowym (a DiriCode ma Hono server + Web UI),
musisz udostepnic zrodla CALEGO projektu pod AGPL.

**Co mozna:**
- Czytac i inspirowac sie architektura
- Pisac wlasna implementacje tych samych koncepcji

**Czego NIE mozna:**
- Kopiowac kodu do projektu MIT
- Uzywac jako biblioteki/dependency bez zmiany licencji calego DiriCode na AGPL

**Ryzyko: KRYTYCZNE** — nawet male fragmenty moga "zarazic" caly projekt

**Praktycznie dla DiriCode:**
- Timeline-based memory z Claude-Mem → implementujemy od zera
- NIE kopiujemy nawet malych fragmentow
- Wzorce architektoniczne (np. timeline approach) → ok jako inspiracja

---

### CC BY-NC-ND 4.0 (Awesome Claude Code)

**Ograniczenia:**
- NC (NonCommercial) — nie mozna uzywac komercyjnie
- ND (NoDerivatives) — nie mozna modyfikowac i dystrybuowac zmodyfikowanej wersji

**Praktycznie:** Tylko jako lista referencji. Nie kopiujemy tresci.

---

### Mieszana / SUL-1.0 (Oh-My-OpenCode)

**Problem:** SUL-1.0 (Source Use License) NIE jest standardowa licencja open source.
Kazdy plik moze miec inna licencje. Wymaga audytu per-file.

**Praktycznie dla DiriCode:**
- Traktujemy jak restrykcyjna licencje
- Inspirujemy sie architektura (opublikowane wzorce)
- NIE kopiujemy kodu bez sprawdzenia licencji konkretnego pliku
- Jesli plik ma wyraznie MIT header → mozna kopiowac
- W razie watpliwosci → piszemy od zera

---

### PolyForm (vendored w Claude-Mem, czesci OpenHands)

PolyForm to rodzina licencji z roznymi ograniczeniami:
- **PolyForm Noncommercial** — zakaz uzycia komercyjnego
- **PolyForm Small Business** — darmowe dla malych firm
- **PolyForm Shield** — zakaz konkurowania

**Praktycznie:** Traktujemy jak restrykcyjna. Nie kopiujemy.

---

## Matryca Decyzyjna — Co Skad Mozemy Brac

| Zrodlo | Kopiowac kod | Kopiowac architekture | Inspirowac sie koncepcjami |
|--------|-------------|----------------------|---------------------------|
| Plandex (MIT) | ✅ | ✅ | ✅ |
| OpenCode (MIT) | ✅ | ✅ | ✅ |
| GSD (MIT) | ✅ | ✅ | ✅ |
| Obsidian Skills (MIT) | ✅ | ✅ | ✅ |
| Superpowers (MIT) | ✅ | ✅ | ✅ |
| n8n-MCP (MIT) | ✅ | ✅ | ✅ |
| UI/UX Pro Max (MIT) | ✅ | ✅ | ✅ |
| Aider (Apache-2.0) | ⚠️ z headerami | ✅ | ✅ |
| Cline (Apache-2.0) | ⚠️ z headerami | ✅ | ✅ |
| Codex (Apache-2.0) | ⚠️ z headerami | ✅ | ✅ |
| OpenHands (MIT+PolyForm) | ⚠️ tylko MIT czesci | ✅ | ✅ |
| OMO (SUL-1.0) | ⚠️ per-file audit | ⚠️ | ✅ |
| Claude Code (Commercial) | ❌ | ⚠️ | ✅ |
| Claude-Mem (AGPL) | ❌ | ⚠️ | ✅ |
| Awesome Claude Code (CC) | ❌ | ❌ | ✅ (referencja) |

---

## Konkretne Rekomendacje dla DiriCode

### Bezpieczne zrodla kodu (priorytet):
1. **Plandex** (MIT) — roles/agenty, plan-based workflow, context management
2. **OpenCode** (MIT) — Vercel AI SDK integracja, konfiguracja providerow, hashline edit
3. **GSD** (MIT) — pipeline interview→plan→execute
4. **Obsidian Skills** (MIT) — agentskills.io SKILL.md parser i format

### Bezpieczne z uwagami (Apache-2.0):
5. **Aider** — repo-map, edit formats (zachowaj headery jesli kopiujesz)
6. **Cline** — tree-sitter, diff strategy (zachowaj headery)
7. **Codex** — sandbox patterns (zachowaj headery)

### Tylko inspiracja (zakaz kopiowania kodu):
8. **Claude Code** — hooki, permissions, approval flow → piszemy od zera
9. **Claude-Mem** — timeline memory, FTS5 → piszemy od zera
10. **OMO** — architektura hookow → audyt per-file lub piszemy od zera

### Nie uzywac:
11. **Awesome Claude Code** — tylko jako lista referencji

---

## Wplyw na Inne Taski

| Task | Wplyw licencji |
|------|---------------|
| TASK-012 (Plandex roles) | ✅ Plandex = MIT, mozna kopiowac role/agenty swobodnie |
| TASK-001 (Hooki) | ⚠️ Claude Code = Commercial, OMO = SUL → piszemy od zera |
| TASK-002 (Context) | ✅ Aider/Cline/OpenCode dostepne z uwagami Apache/MIT |
| TASK-005 (Router) | ✅ LiteLLM = MIT, Plandex = MIT, Codex = Apache |
| TASK-007 (Indexing) | ✅ Aider repo-map = Apache (z headerami), Cline = Apache |

---

Dokument przygotowany na podstawie analizy licencji przeprowadzonej 2026-03-09.
Kazda decyzja o kopiowaniu kodu powinna byc weryfikowana z aktualna wersja licencji w repozytorium zrodlowym.
