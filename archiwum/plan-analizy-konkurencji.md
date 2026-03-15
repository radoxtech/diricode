# Plan Analizy Konkurencyjnego Projektu

> Instrukcja dla agenta wykonującego analizę.
> Data: 7 marca 2026
> Kontekst: Projekt **DiriCode** — lokalny CLI agent AI z architekturą dispatcher-first.

---

## 0. Cel Analizy

Zbadać wybrany projekt konkurencyjny i wyciągnąć **actionable wnioski** dla DiriCode:
- Co konkurent robi lepiej i DiriCode powinien zaadaptować?
- Co konkurent robi gorzej i DiriCode powinien unikać?
- Jakie decyzje architektoniczne konkurenta potwierdzają lub podważają założenia DiriCode (ADR-001 do ADR-015)?

**Output:** Jeden dokument `analiza-{nazwa-projektu}.md` z wypełnioną matrycą poniżej.

---

## 1. Projekty do Analizy (Shortlist)

Wybierz jeden projekt na analizę. Priorytet od najważniejszego:

| # | Projekt | Repo | Dlaczego ważny dla DiriCode |
|---|---------|------|----------------------------|
| 1 | **Aider** | `github.com/Aider-AI/aider` | Benchmark CLI + git-native. Posiada Repository Map (AST) — DiriCode opiera się na glob/grep. Trzeba zrozumieć czy to krytyczna luka. |
| 2 | **Cline** | `github.com/cline/cline` | Lider MCP i autonomii z approval. DiriCode ma "Smart Approval" (ADR-004) — trzeba porównać implementacje. |
| 3 | **OpenHands** | `github.com/All-Hands-AI/OpenHands` | Event-driven architecture, Agent SDK. Referencja dla systemu delegacji DiriCode (ADR-003). |
| 4 | **Plandex** | `github.com/plandex-ai/plandex` | Sandbox diffs, ogromny kontekst (20M tokenów). Weryfikacja czy DiriCode "brak snapshota" (ADR-008) to dobra decyzja. |

---

## 2. Matryca Analizy — Co Badać

Dla każdego analizowanego projektu wypełnij **wszystkie 8 sekcji** poniżej.

### A. Tożsamość i Pozycjonowanie

| Pytanie | Odpowiedź |
|---------|-----------|
| Nazwa, licencja, język implementacji | |
| Główny target user (solo dev / zespół / enterprise) | |
| Interfejs (CLI / IDE extension / Web / Desktop) | |
| Ile gwiazdek GitHub, ile contributorów, bus factor | |
| Model biznesowy (OSS / freemium / komercja) | |
| Jak się pozycjonują (tagline, README first paragraph) | |

### B. Architektura Agenta

| Aspekt | Jak to robi konkurent | Jak to robi DiriCode | Wniosek |
|--------|----------------------|---------------------|---------|
| Ile agentów / ról? | | Dispatcher + 10 specjalistów | |
| Czy agent główny ma dostęp do narzędzi modyfikujących? | | NIE (read-only dispatcher) | |
| Jak wygląda delegacja? (flat / nested / brak) | | Unlimited nesting + loop detector | |
| Czy jest loop detection / fail-safe? | | Tak (ADR-003: hard limit, token budget, loop detector) | |
| Jak zarządzają kontekstem agenta? (ile tokenów zużywa "overhead"?) | | Dispatcher = minimalny kontekst | |

### C. Zrozumienie Kodu (Code Intelligence)

| Aspekt | Jak to robi konkurent | Jak to robi DiriCode | Wniosek |
|--------|----------------------|---------------------|---------|
| Jak "widzi" codebase? (repo map / glob / grep / RAG / AST) | | glob + grep + AST-grep + LSP | |
| Czy parsuje strukturę kodu (klasy, metody, sygnatury)? | | AST-grep tak, ale brak "repo map" | |
| Jak wybiera pliki do kontekstu? (manualne / automatyczne / ranking) | | Agent dispatcher decyduje na podstawie opisu zadania | |
| Czy ma LSP integration? | | Tak, top-10 języków lazy install | |
| Jak radzi sobie z dużymi repozytoriami (50K+ plików)? | | Nieznane — potencjalna luka | |

### D. Routing i Obsługa Modeli

| Aspekt | Jak to robi konkurent | Jak to robi DiriCode | Wniosek |
|--------|----------------------|---------------------|---------|
| Ile providerów / modeli obsługuje? | | 22 providerów via Vercel AI SDK | |
| Czy ma failover (automatyczne przełączanie)? | | Tak (ADR-011: order-based) | |
| Czy ma race mode / parallel requests? | | Tak (ADR-011) | |
| Czy ma per-agent model assignment? | | Tak (dispatcher=fast, writer=deep, itd.) | |
| Jak radzi sobie z non-Claude modelami? (Write/Edit działa?) | | Adaptery per provider — do zweryfikowania | |
| Czy zależy od LiteLLM / zewnętrznego routera? | | NIE — własny TS Router | |

### E. System Hooków i Rozszerzalność

| Aspekt | Jak to robi konkurent | Jak to robi DiriCode | Wniosek |
|--------|----------------------|---------------------|---------|
| Czy ma system hooków / pluginów / middleware? | | 12 lifecycle hooks, lazy loading | |
| Ile punktów rozszerzenia (extension points)? | | 12 hooków + MCP client + pliki .md agentów | |
| Czy użytkownik może definiować własnych agentów? | | Tak (custom agents w `.diricode/agents/`) | |
| Czy ma MCP support? | | Tak, GitHub MCP wbudowany + zewnętrzne | |
| Jak wygląda konfiguracja? (YAML / JSON / TS / GUI) | | `diricode.config.ts` (type-safe) | |

### F. Bezpieczeństwo i Approval

| Aspekt | Jak to robi konkurent | Jak to robi DiriCode | Wniosek |
|--------|----------------------|---------------------|---------|
| Czy pyta przed destrukcyjnymi akcjami? | | Tak (ADR-004: Smart — AI ocenia ryzyko) | |
| 3 kategorie: safe / risky / destructive? | | Tak, konfigurowalne | |
| Czy chroni przed wyciekiem sekretów? | | Tak (ADR-014: auto-redakcja regex/heurystyki) | |
| Czy ma sandboxing (Docker/VM)? | | NIE w MVP (→ v2) | |
| Git safety rails? (blokada `git add .`, `push --force`) | | Tak (ADR-010) | |
| Czy parsuje komendy bash bezpiecznie? | | Tak (ADR-015: Tree-sitter) | |

### G. Pamięć i Stan

| Aspekt | Jak to robi konkurent | Jak to robi DiriCode | Wniosek |
|--------|----------------------|---------------------|---------|
| Trwała pamięć między sesjami? | | GitHub Issues jako project memory (ADR-007) | |
| Jak przechowuje stan zadań (TODO/progress)? | | Pliki Markdown `.diricode/todo.md` (ADR-013) | |
| Czy ma snapshot / undo? | | NIE — git worktrees zamiast (ADR-008) | |
| Context compaction (jak radzi sobie z długimi sesjami)? | | Sliding window + summary na 90-95% (ADR-009) | |
| Jak radzi sobie z git worktrees? | | Natywnie — GitHub Issues globalne per repo | |

### H. UX i Developer Experience

| Aspekt | Jak to robi konkurent | Jak to robi DiriCode | Wniosek |
|--------|----------------------|---------------------|---------|
| Time-to-first-use (ile kroków do działającego agenta)? | | Do zbadania | |
| Vim motions? | | Od dnia 1 (TUI Ink) | |
| Streaming odpowiedzi? | | SSE (ADR-001) | |
| Lean mode / oszczędny tryb? | | Tak (ADR-006: `--lean`) | |
| Jakość dokumentacji? | | Do zbadania | |
| Onboarding experience (first run)? | | Do zbadania | |

---

## 3. Metoda Analizy — Jak Badać

### Krok 1: Przegląd README i dokumentacji (30 min)
- Przeczytaj README.md, ARCHITECTURE.md, CONTRIBUTING.md
- Przeczytaj oficjalną dokumentację (docs/)
- Zapisz: tagline, architekturę, kluczowe features

### Krok 2: Analiza kodu źródłowego (2-3h)
Skup się na tych plikach/katalogach:

| Co szukać | Gdzie szukać | Dlaczego |
|-----------|-------------|---------|
| Główna pętla agenta | `main.py`, `agent.ts`, `loop.go` — entry point | Zrozumienie flow delegacji |
| System narzędzi (tools) | katalog `tools/`, `commands/`, `actions/` | Porównanie z DiriCode 11 narzędzi core |
| Routing / model selection | `router.py`, `model.ts`, `provider/` | Czy mają failover, race mode? |
| Hookowanie / middleware | `hooks/`, `middleware/`, `plugins/` | Ile extension points? |
| Git integration | `git.py`, `git.ts`, szukaj `git add`, `git commit` | Czy mają safety rails? |
| Approval / permissions | szukaj `confirm`, `approve`, `permission`, `dangerous` | Jak chronią przed destrukcją? |
| Context management | szukaj `compact`, `summarize`, `truncate`, `window` | Jak radzą sobie z limitem kontekstu? |
| Repository map / code understanding | szukaj `map`, `index`, `ctags`, `tree-sitter`, `ast` | Kluczowe dla sekcji C matrycy |
| Secret redaction | szukaj `redact`, `mask`, `secret`, `credential` | Czy chronią sekrety? |

### Krok 3: Analiza Issues i Discussions (1h)
- Przejrzyj **top 20 issues** (posortowane po reakcjach/komentarzach)
- Szukaj: najczęstsze skargi, prośby o features, znane bugi
- Zapisz: co użytkownicy kochają, co nienawidzą

### Krok 4: Test praktyczny (opcjonalnie, 1h)
- Zainstaluj narzędzie
- Spróbuj: prosty refactor, multi-file edit, git commit
- Oceń: czas setup, intuicyjność, jakość output

---

## 4. Format Outputu

Stwórz plik `analiza-{nazwa-projektu}.md` z następującą strukturą:

```markdown
# Analiza Konkurencyjna: {Nazwa Projektu}

> Data: {data}
> Wersja analizowana: {wersja/commit}
> Repo: {URL}

## 1. Podsumowanie (3-5 zdań)
{Czym jest projekt, do kogo jest skierowany, jaka jest jego główna przewaga}

## 2. Matryca Porównawcza
{Wypełniona matryca z sekcji 2 powyżej — wszystkie 8 tabel A-H}

## 3. Co DiriCode Powinien Zaadaptować
{Lista konkretnych rzeczy do "ukradzenia" z uzasadnieniem}

| Co | Dlaczego | Wpływ na ADR |
|----|---------|-------------|
| {feature/pattern} | {uzasadnienie} | {który ADR wymaga zmiany} |

## 4. Czego DiriCode Powinien Unikać
{Anty-wzorce i błędy konkurenta}

| Co | Dlaczego to problem | Jak DiriCode to rozwiązuje |
|----|--------------------|-----------------------------|
| {anty-wzorzec} | {opis problemu} | {referencja do ADR} |

## 5. Otwarte Pytania
{Rzeczy które wymagają dalszej analizy lub decyzji architektonicznych}

## 6. Rekomendacje dla Specyfikacji DiriCode
{Konkretne propozycje zmian/uzupełnień do spec-mvp-diricode.md}
```

---

## 5. Kontekst DiriCode — Klucz do Analizy

Agent wykonujący analizę **musi znać** te dokumenty przed rozpoczęciem:

| Dokument | Ścieżka | Co zawiera |
|----------|---------|-----------|
| Specyfikacja MVP | `spec-mvp-diricode.md` | 15 ADR-ów, tech stack, scope MVP, lekcje z OpenCode/OMO |
| Plan implementacji | `plan-implementacji-diricode.md` | Fazy, backlog, schemat architektury |
| Mapa funkcji OC+OMO | `mapa-funkcje.md` | 26 narzędzi, 44 hooki, 11 agentów — co mamy w bazie |
| Mapa braków OC+OMO | `mapa-braki.md` | 43 braki/bugi — czego unikamy |

### Kluczowe ADR-y do weryfikacji podczas analizy:

| ADR | Decyzja DiriCode | Ryzyko do zbadania |
|-----|-------------------|-------------------|
| ADR-002 | Dispatcher-First (zero hooków na agencie głównym) | Czy inni mają "chudy" agent główny? Czy to faktycznie oszczędza tokeny? |
| ADR-004 | Smart Approval (AI ocenia ryzyko) | Jak inni rozwiązują balans autonomia vs. kontrola? |
| ADR-007 | GitHub Issues jako pamięć projektu | Czy ktoś inny tak robi? Alternatywy? |
| ADR-008 | Brak snapshot systemu (git worktrees) | Czy Plandex "sandbox diffs" to must-have? |
| ADR-011 | Własny TS Router (bez LiteLLM) | Czy to realne? Ile pracy? Jak inni routują? |
| ADR-013 | Stan w Markdown (nie SQLite) | Czy to skaluje się przy złożonych projektach? |

---

## 6. Kryteria Jakości Analizy

Analiza jest **kompletna** gdy:
- [ ] Wszystkie 8 sekcji matrycy (A-H) są wypełnione
- [ ] Każda odpowiedź w matrycy zawiera konkretne referencje (plik, linia, commit lub link do docs)
- [ ] Sekcja "Co zaadaptować" ma minimum 3 pozycje z odniesieniem do ADR
- [ ] Sekcja "Czego unikać" ma minimum 2 pozycje
- [ ] Sekcja "Rekomendacje" zawiera konkretne propozycje zmian do spec-mvp
- [ ] Dokument nie zawiera spekulacji — tylko fakty z kodu/docs/issues
