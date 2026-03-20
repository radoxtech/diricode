# DiriCode — Analiza Config Layers (TASK-006)

Data: 2026-03-10
Status: KOMPLETNY — WSZYSTKIE 8 DECYZJI ROZSTRZYGNIETE

---

## 1. Podsumowanie

Przeanalizowano systemy konfiguracji 8 frameworkow AI coding + best practices z ekosystemu (cosmiconfig, c12, env-paths, Zod).

**Kluczowe wnioski**:
- Wszystkie dojrzale narzedzia maja 3-7 warstw configu z jasnym priorytetem
- JSONC (JSON with comments) lub TOML dominuja — YAML w mniejszosci
- Walidacja schema (Zod, schemars, JSON Schema) to standard w nowszych narzediach
- Katalog `.narzedzie/` w projekcie to dominujacy wzorzec (`.opencode/`, `.codex/`, `.claude/`, `.cline/`)
- Managed/enterprise config (najwyzszy priorytet) to trend — OpenCode, Codex, Claude Code
- Env vars jako fallback dla API keys — kazdy framework to robi

**Decyzje uzytkownika (ROZSTRZYGNIETE)**:
- Format: **JSONC**
- Katalog projektowy: **`.dc/`**
- Warstwy MVP: **4** (defaults → global → project → CLI flags)
- Biblioteka: **c12 (unjs)** — best practice
- Env var prefix: **`DC_*`**
- .env loading: **Tak** (CWD)
- Config substitution: **Nie w MVP** (v2)
- Platformy: **Linux + macOS** (Windows odroczony)

---

## 2. Tabela porownawcza — 8 frameworkow

### 2.1 Warstwy configu i priorytet (od najnizszego do najwyzszego)

| Framework | Format | Warstwy (niz → wyz priorytet) | Walidacja |
|-----------|--------|-------------------------------|-----------|
| **OpenCode** | JSONC | 1. Remote `.well-known/opencode` (org defaults) → 2. Global `~/.config/opencode/opencode.json{,c}` → 3. Custom (`OPENCODE_CONFIG` env) → 4. Project `opencode.json{,c}` (findUp) → 5. `.opencode/` dir (agents/, commands/, plugins/, opencode.json{,c}) → 6. Inline (`OPENCODE_CONFIG_CONTENT` env) → 7. Managed (enterprise, najwyzszy) | **Zod** schemas (Agent, Permission, Command, Info) |
| **Codex** | TOML | 1. System `/etc/codex/config.toml` → 2. User `~/.codex/config.toml` → 3. CWD config → 4. Tree config → 5. Repo `.codex/config.toml` → 6. Runtime/CLI flags → 7. Cloud requirements → 8. Managed features (najwyzszy) | **schemars** (JSON Schema generation) + serde |
| **Aider** | YAML | 1. Home `~/.aider.conf.yml` → 2. Git root `.aider.conf.yml` → 3. CWD `.aider.conf.yml` → 4. Env vars (`AIDER_*` auto prefix) → 5. CLI flags (najwyzszy) | Brak walidacji schema (configargparse) |
| **Plandex** | JSON w DB | 1. System defaults (hardcoded) → 2. Per-plan config w bazie danych → 3. CLI `set-config` commands. Brak plikow konfiguracyjnych — wszystko server-side. | Go struct validation |
| **Cline** | JSON | 1. Global `~/.cline/data/globalState.json` → 2. Workspace `~/.cline/data/workspace/` → 3. `CLINE_DIR` env var (nadpisuje lokalizacje) → 4. `--config` flag (najwyzszy) → 5. `CLINE_COMMAND_PERMISSIONS` env (permissions override) | Brak formalnej schema |
| **OpenHands** | TOML | 1. `config.template.toml` (template/defaults) → 2. Runtime config file → 3. Web session init (nadpisuje model/api_key) → 4. Env vars | Brak formalnej schema (komentarze w template) |
| **Claude Code** | JSON | 1. Enterprise managed settings (najwyzszy! — odwrocone!) → 2. User `~/.claude/settings.json` → 3. Project `.claude/settings.json` → 4. `.claude/settings.local.json` (gitignored, per-user) → 5. Plugin-provided settings | Brak formalnej schema (przykladowe pliki) |
| **OMO** | JSONC | Rozszerza OpenCode + 1. User `~/.config/opencode/oh-my-opencode.json{,c}` → 2. Project `.opencode/oh-my-opencode.json{,c}` (nadpisuje user). Merge: spread + deepMerge na agents/categories, Set union na disabled_*. | **Zod** (OhMyOpenCodeConfigSchema, partial parsing on error) |

### 2.2 Lokalizacja globalnego configu

| Framework | macOS | Linux | Env var override |
|-----------|-------|-------|------------------|
| **OpenCode** | `~/Library/Preferences/opencode/` LUB `~/.config/opencode/` | `$XDG_CONFIG_HOME/opencode/` lub `~/.config/opencode/` | `OPENCODE_CONFIG_DIR` |
| **Codex** | `~/.codex/` | `~/.codex/` | `CODEX_HOME` |
| **Aider** | `~/.aider.conf.yml` | `~/.aider.conf.yml` | `--config` flag |
| **Plandex** | Brak (server-side) | Brak (server-side) | — |
| **Cline** | `~/.cline/data/` | `~/.cline/data/` | `CLINE_DIR` |
| **OpenHands** | Plik w CWD | Plik w CWD | — |
| **Claude Code** | `~/.claude/` | `~/.claude/` | — |
| **OMO** | Dziedziczy OpenCode + `oh-my-opencode.json{,c}` | j.w. | `OPENCODE_CONFIG_DIR` |

### 2.3 Katalog projektowy

| Framework | Katalog | Zawartosc |
|-----------|---------|-----------|
| **OpenCode** | `.opencode/` | `agents/` (MD + YAML frontmatter), `commands/` (MD), `plugins/` (TS/JS), `opencode.json{,c}` |
| **Codex** | `.codex/` | `config.toml`, trust levels per project |
| **Aider** | CWD | `.aider.conf.yml`, `.aider.model.settings.yml`, `.aider.model.metadata.json`, `.env` |
| **Plandex** | Brak | Wszystko w bazie danych serwera |
| **Cline** | `.clinerules/` | MD pliki z regulami, importowane z Cursor/Windsurf |
| **OpenHands** | CWD | `config.template.toml` (template), microagents |
| **Claude Code** | `.claude/` | `settings.json`, `settings.local.json` (gitignored), `CLAUDE.md` (project instructions), `rules/*.md` |
| **OMO** | `.opencode/` | Rozszerza OpenCode + `oh-my-opencode.json{,c}` |

### 2.4 Obsluga env vars

| Framework | Pattern | .env loading | API keys |
|-----------|---------|-------------|----------|
| **OpenCode** | `{env:VAR_NAME}` substitution w configu, `OPENCODE_*` env vars | Nie laduje .env | Env vars lub config |
| **Codex** | CLI `--env` flag, config env block | Nie laduje .env | Env vars lub config |
| **Aider** | `AIDER_*` auto-prefix (kazdy CLI flag → env var), np. `AIDER_MODEL` | **Tak** — `.env` w CWD, git root, home. `--env-file` flag. | `.env` lub `~/.aider/oauth-keys.env` |
| **Plandex** | `.env` w docs | Nie laduje .env | Server env vars |
| **Cline** | `CLINE_DIR`, `CLINE_COMMAND_PERMISSIONS` | Nie laduje .env | `~/.cline/data/secrets.json` (encrypted) |
| **OpenHands** | Konfigurowalne w TOML | `.env` (frontend) | TOML config lub Web session |
| **Claude Code** | `ENABLE_CLAUDEAI_MCP_SERVERS`, inne | Nie laduje .env | OAuth / Anthropic account |
| **OMO** | Dziedziczy OpenCode + `config.env` overlay dla spawned MCP servers | Nie laduje .env | Dziedziczy OpenCode |

### 2.5 Monorepo / workspace

| Framework | Wsparcie monorepo | Mechanizm |
|-----------|-------------------|-----------|
| **OpenCode** | Czesciowe | `findUp` szuka `opencode.json{,c}` w gore drzewa katalogow |
| **Codex** | **Tak** | Layer stack: CWD → Tree → Repo. Profile per-project. Trust levels. |
| **Aider** | Czesciowe | `.aider.conf.yml` w git root (nie per-workspace) |
| **Plandex** | Nie | Per-plan w bazie |
| **Cline** | **Tak** | `--config` per worktree, `CLINE_DIR` per instancja |
| **OpenHands** | Nie | Jeden config per instancja Docker |
| **Claude Code** | **Tak** | Git worktree support — project configs i auto memory dzielone miedzy worktrees tego samego repo |
| **OMO** | Czesciowe | Dziedziczy OpenCode findUp |

### 2.6 Merge strategy

| Framework | Jak laczy warstwy |
|-----------|-------------------|
| **OpenCode** | `mergeDeep` (remeda), arrays concatenated (plugins, instructions) |
| **Codex** | `ConfigLayerStack` — sekwencyjne nadpisywanie, `ConfigBuilder` pattern |
| **Aider** | configargparse — CLI > config file > env vars > defaults (prosta hierarchia) |
| **Plandex** | Brak merge — per-plan config w DB |
| **Cline** | Prosty override — globalState + workspace state nadpisywanie |
| **OpenHands** | Web session init nadpisuje TOML config |
| **Claude Code** | Managed > user > project > local. Plugin settings dolaczane |
| **OMO** | spread (`...base, ...override`) + `deepMerge` na agents/categories + Set union na disabled_* listach |

---

## 3. Wzorce zaobserwowane (cross-cutting patterns)

### 3.1 Uniwersalne wzorce (w 6+ frameworkach)
1. **Katalog projektowy z kropka**: `.opencode/`, `.codex/`, `.claude/`, `.cline/` — dominujacy wzorzec
2. **API keys przez env vars**: Kazdy framework obsluguje API keys przez env vars (nigdy w commited config)
3. **CLI flags = najwyzszy priorytet** (poza managed/enterprise): Aider, Codex, Cline — CLI flags nadpisuja wszystko
4. **Globalny vs projektowy config**: Kazdy framework z plikowym config ma oba poziomy

### 3.2 Nowoczesne wzorce (w 3+ frameworkach)
1. **Managed/enterprise config**: OpenCode, Codex, Claude Code — admin-controlled settings ktore uzytkownicy nie moga nadpisac
2. **Schema validation**: OpenCode (Zod), Codex (schemars), OMO (Zod) — walidacja na wejsciu
3. **Partial parsing on error**: OMO — jesli czesc configu jest bledna, reszta dalej dziala
4. **Config substitution**: OpenCode (`{env:VAR}`, `{file:path}`) — referencje w configu
5. **Agents/commands jako pliki MD**: OpenCode — agent = plik Markdown z YAML frontmatter
6. **Local settings gitignored**: Claude Code (`settings.local.json`) — per-user overrides w projekcie
7. **MCP server config**: OpenCode, Codex, Cline, OpenHands, Claude Code — wspolny pattern

### 3.3 Wzorce z ekosystemu (biblioteki config)
1. **cosmiconfig**: Standard discovery — szuka `package.json` property → `.toolrc` → `.toolrc.json` → `tool.config.js` etc. (wiele formatow)
2. **c12 (unjs)**: Smart loader — CWD config > RC file > global RC > package.json > defaults. Support: JS/TS/JSON/JSONC/YAML/TOML, .env, watchers, extends
3. **env-paths**: Cross-platform XDG — `~/Library/Preferences/` (macOS), `~/.config/` (Linux), `%APPDATA%` (Windows)
4. **defu (unjs)**: Recursive merge — leftmost wins, nullish skipped, arrays concatenated
5. **rc9 (unjs)**: RC file read/write — flat config (`.` nested keys), user config w `~/.config/`
6. **Zod**: TypeScript-first validation + type inference + JSON Schema generation

---

## 4. Analiza podejsc — co bierzemy, czego unikamy

### 4.1 Najlepsze podejscia do wzorowania

| Podejscie | Framework | Dlaczego dobre |
|-----------|-----------|---------------|
| **7-warstwowy stack z jasna hierarchia** | OpenCode | Pelne pokrycie: remote → global → custom → project → dir → inline → managed |
| **Schema validation z partial parsing** | OMO | Bledny config nie crashuje apki — laduje co moze |
| **Agents jako MD + YAML frontmatter** | OpenCode | Human-readable, version-controlled, rozszerzalne |
| **Config substitution** | OpenCode | `{env:VAR}` i `{file:path}` — elastycznosc bez komplikacji |
| **settings.local.json (gitignored)** | Claude Code | Kazdy developer moze miec swoje ustawienia bez wplywu na team |
| **ConfigBuilder pattern** | Codex | Czysta separacja zrodel i deterministyczne merge |
| **Auto env var prefix** | Aider | `AIDER_*` — kazdy flag ma automatyczny env var fallback |
| **XDG-compliant paths** | OpenCode, env-paths | Cross-platform, zgodne z konwencjami OS |
| **JSONC format** | OpenCode, OMO | JSON z komentarzami — czytelny + przyjazny maszynom |

### 4.2 Czego unikamy

| Podejscie | Framework | Problem |
|-----------|-----------|---------|
| Config tylko w bazie danych | Plandex | Nie mozna wersjonowac, nie mozna edytowac reczna, wymaga serwera |
| Brak schema validation | Aider, Cline, OpenHands | Bledny config = niezrozumialy error |
| Brak komentarzy w configu | czyste JSON (Cline, Claude Code) | Uzytkownik nie wie co jest co |
| Config w CWD (bez dedykowanego katalogu) | Aider, OpenHands | Zasmiecanie root katalogu projektu |
| Encrypted secrets w pliku | Cline | Falszywe poczucie bezpieczenstwa — lepiej env vars |

---

## 5. Architektura configu DiriCode (ROZSTRZYGNIETA)

### 5.1 Format: **JSONC** (JSON with Comments) ✅ DECYZJA-1

**Uzasadnienie**:
- Human-readable (komentarze!)
- Maszynowo parsowalne (std. JSON parsery z extension)
- Uzywany przez OpenCode, OMO, VS Code, TypeScript (tsconfig.json jest JSONC)
- Zod walidacja dziala z JSON
- Lekki — nie potrzeba dodatkowych parserow (jak TOML)
- c12 obsluguje JSONC natywnie

### 5.2 Warstwy MVP: **4 warstwy** (niz → wyz priorytet) ✅ DECYZJA-3

```
1. DEFAULTS (hardcoded w kodzie)
   └─ Domyslne ustawienia wbudowane w DiriCode
   └─ Sensible defaults — dziala bez zadnego configu

2. GLOBAL USER CONFIG (~/.config/dc/config.jsonc)
   └─ Preferencje uzytkownika na calym systemie
   └─ API keys, domyslny model, domyslne wymiary pracy
   └─ macOS: ~/Library/Preferences/dc/config.jsonc
   └─ Linux: $XDG_CONFIG_HOME/dc/config.jsonc (~/.config/dc/)

3. PROJECT CONFIG (.dc/config.jsonc)
   └─ Ustawienia per-projekt, commitowane do repo
   └─ Model per-projekt, agenty, MCP servers, reguly

4. CLI FLAGS (--model, --quality, --verbose, etc.)
   └─ Najwyzszy priorytet uzytkownika
   └─ Env vars (DC_*) tez tutaj — traktowane jak CLI flags
```

**Co NIE jest w MVP (odroczone)**:
- Local config (`.dc/config.local.jsonc`) → v2
- Managed/enterprise config → v3
- Remote org defaults → v3
- Profile system → v3

**Uzasadnienie 4 warstw**: Minimalistyczne, wystarczajace dla solo deva i malego teamu. Local config (gitignored per-user overrides) dodamy w v2 gdy pojawi sie potrzeba.

### 5.3 Katalog projektowy: **`.dc/`** ✅ DECYZJA-2

```
.dc/
├── config.jsonc          # Project config (commitowany do repo)
├── agents/               # Custom agent definitions (MD + YAML frontmatter)
│   ├── my-reviewer.md
│   └── domain-expert.md
├── rules/                # Project rules/instructions (MD)
│   └── coding-style.md
└── commands/             # Custom slash commands (MD) — v2
    └── deploy.md
```

**Uwagi**:
- `.dc/` — krotka, latwa do wpisania, `.dc` = DiriCode
- `config.local.jsonc` — NIE w MVP (DECYZJA-3: 4 warstwy, local config w v2)
- `plugins/` — NIE w MVP (v2)
- `.gitignore` powinien zawierac `.dc/config.local.jsonc` (przygotowane na v2)

### 5.4 Schema validation: **Zod**

- TypeScript-first — typy wynikaja ze schema (zero duplikacji)
- Partial parsing (wzorzec z OMO) — bledna sekcja nie crashuje calego configu
- JSON Schema generation (dla IDE autocomplete, `dc.schema.json`)
- Zero dependencies (2KB gzipped)
- Uzywa OpenCode i OMO — sprawdzony wzorzec

### 5.5 Env vars: **`DC_*`** ✅ DECYZJA-5

Auto-prefix `DC_*` — kazdy config key mapuje sie na env var:
- `DC_MODEL` → config.model
- `DC_LOG_LEVEL` → config.logLevel
- `DC_QUALITY` → config.quality (wymiar pracy)
- `DC_AUTONOMY` → config.autonomy
- `DC_VERBOSE` → config.verbose
- `DC_CREATIVITY` → config.creativity
- `DC_CONFIG_DIR` → nadpisuje domyslna sciezke globalnego configu

**.env file loading**: ✅ DECYZJA-6 — ladowanie `.env` z CWD na starcie (via c12 wbudowane .env support).

**Config substitution (`{env:VAR}`)**: ❌ NIE w MVP (DECYZJA-7) — w MVP env vars uzywane bezposrednio w `DC_*` lub w `.env`. Substitution `{env:VAR}` w v2.

### 5.6 Sciezki systemowe: **Linux + macOS** ✅ DECYZJA-8

| OS | Global config | Global data | Cache |
|----|--------------|-------------|-------|
| **macOS** | `~/Library/Preferences/dc/` | `~/Library/Application Support/dc/` | `~/Library/Caches/dc/` |
| **Linux** | `$XDG_CONFIG_HOME/dc/` (`~/.config/dc/`) | `$XDG_DATA_HOME/dc/` (`~/.local/share/dc/`) | `$XDG_CACHE_HOME/dc/` (`~/.cache/dc/`) |

Override: `DC_CONFIG_DIR` env var → uzywa zamiast domyslnej sciezki.

**Windows**: Odroczony. Moze w v2/v3 jesli pojawi sie zapotrzebowanie. Upraszcza sciezki — nie trzeba obslugiwac `%APPDATA%`, `%LOCALAPPDATA%` i backslaszy.

**Implementacja sciezek**: Prosta implementacja wlasna (bez env-paths library) — skoro tylko 2 platformy, wystarczy:
```typescript
// macOS: ~/Library/Preferences/dc/
// Linux: $XDG_CONFIG_HOME/dc/ || ~/.config/dc/
const configDir = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Preferences', 'dc')
  : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'dc');
```

### 5.7 Merge strategy

- **defu** pattern — leftmost (wyzszy priorytet) wins
- Arrays: **concatenation** (plugins, instructions, rules) — nie nadpisywanie
- Disabled lists: **Set union** (wzorzec OMO) — disabled_agents, disabled_hooks
- Deep merge na obiektach zagniezdzonych (agents, mcp_servers)
- Nullish (`null`, `undefined`) wartosci sa pomijane (nie nadpisuja)

**Biblioteka**: defu (unjs) — 1.5KB, zero dependencies, dokladnie ten pattern.

### 5.8 Biblioteka config loading: **c12 (unjs)** ✅ DECYZJA-4

**Wybor: c12** — best practice w ekosystemie TypeScript/Node.

| Cecha | c12 | cosmiconfig | Wlasny loader |
|-------|-----|-------------|---------------|
| JSONC natywnie | ✅ | ❌ (plugin) | Trzeba recznie |
| .env loading | ✅ wbudowane | ❌ | Trzeba recznie |
| extends (dziedziczenie configow) | ✅ | ❌ | Trzeba recznie |
| Watchers (hot-reload) | ✅ | ❌ | Trzeba recznie |
| Environment-specific ($test, $prod) | ✅ | ❌ | Trzeba recznie |
| Wiele formatow (JS/TS/JSON/JSONC/YAML/TOML) | ✅ | ✅ | Ograniczone |
| Rozmiar | ~15KB | ~12KB | 0KB |
| Ekosystem | unjs (Nuxt, Nitro) | Eslint, Prettier, etc. | — |
| Aktywny development | ✅ | ✅ (wolniejszy) | — |

**Dlaczego c12 > cosmiconfig**:
1. Natywne .env loading — nie trzeba osobnej biblioteki (DECYZJA-6: .env w MVP)
2. JSONC natywnie — nie trzeba pluginu
3. `extends` — w v2 pozwoli na dziedziczenie configow miedzy projektami
4. Watchers — w v2 hot-reload configu
5. Environment-specific config — `$test`, `$production` overrides
6. Uzywany przez Nuxt (25k+ stars) — battle-tested

**Dlaczego c12 > wlasny loader**:
1. DRY — c12 robi dokladnie to co potrzebujemy, zero boilerplate
2. Mniej kodu do utrzymania
3. `.env` loading za darmo
4. v2 features (extends, watchers) za darmo — tylko wlaczamy

**Licencja c12**: MIT — bezpieczne.

### 5.9 Roadmap MVP / v2 / v3

| Feature | MVP | v2 | v3 |
|---------|-----|-----|-----|
| Global user config (`~/.config/dc/`) | ✅ | | |
| Project config (`.dc/config.jsonc`) | ✅ | | |
| CLI flags override | ✅ | | |
| `DC_*` env vars | ✅ | | |
| `.env` file loading (CWD) | ✅ | | |
| Zod schema validation | ✅ | | |
| c12 config loader | ✅ | | |
| Custom agents (`.dc/agents/*.md`) | ✅ | | |
| MCP server config | ✅ | | |
| Local config (`.dc/config.local.jsonc`, gitignored) | | ✅ | |
| Config substitution (`{env:VAR}`) | | ✅ | |
| Config extends (from npm/git) | | ✅ | |
| Custom commands (`.dc/commands/*.md`) | | ✅ | |
| Plugins (`.dc/plugins/*.ts`) | | ✅ | |
| Config watchers (hot-reload) | | ✅ | |
| Windows support | | ✅ | |
| Managed/enterprise config | | | ✅ |
| Remote org defaults | | | ✅ |
| Profile system (Codex-style) | | | ✅ |

---

## 6. Przykladowy config projektowy

```jsonc
// .dc/config.jsonc
{
  // Domyslne wymiary pracy per-projekt
  "defaults": {
    "quality": "standard",    // cheap | poc | standard | production | super
    "autonomy": "auto-edit",  // ask-everything | suggest | auto-edit | auto-execute | full-auto
    "verbose": "compact",     // silent | compact | explain | narrated
    "creativity": "helpful"   // reactive | helpful | research | proactive | creative
  },

  // Model per-projekt (nadpisuje globalny)
  "model": "claude-sonnet-4",

  // MCP servers
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "."]
    }
  },

  // Custom agents
  "agents": {
    "domain-expert": {
      "enabled": true,
      "tier": "HEAVY",
      "model": "claude-opus-4"
    }
  },

  // Disabled agents/hooks per-projekt
  "disabled_agents": ["license-checker"],
  "disabled_hooks": ["pre-commit-lint"]
}
```

---

## 7. Przykladowy config globalny

```jsonc
// ~/.config/dc/config.jsonc (Linux)
// ~/Library/Preferences/dc/config.jsonc (macOS)
{
  // Domyslny model (nadpisywany przez projekt)
  "model": "claude-sonnet-4",

  // API keys — w MVP bezposrednio lub z env vars (DC_*)
  // W v2: config substitution {env:VAR}
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "openai": {
      "apiKey": "sk-..."
    },
    "github": {
      "apiKey": "ghp_..."
    }
  },

  // Globalne preferencje
  "defaults": {
    "quality": "standard",
    "autonomy": "auto-edit",
    "verbose": "compact",
    "creativity": "helpful"
  },

  // Globalne MCP servers
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-server-web-search"]
    }
  }
}
```

**Uwaga**: API keys w pliku globalnym sa akceptowalne bo plik jest w `~/` (nie w repo). Lepsza opcja: `.env` w CWD lub `DC_*` env vars w shellu. W v2 bedzie `{env:ANTHROPIC_API_KEY}` substitution.

---

## 8. Decyzje — WSZYSTKIE ROZSTRZYGNIETE

### DECYZJA-1: Format configu ✅ ROZSTRZYGNIETA
**Odpowiedz: JSONC** — JSON with Comments. IDE support (VS Code), standard w TS/Node ekosystemie, c12 obsluguje natywnie.

### DECYZJA-2: Nazwa katalogu projektowego ✅ ROZSTRZYGNIETA
**Odpowiedz: `.dc/`** — krotka, latwa do wpisania. `.dc` = DiriCode. Analogicznie jak `.ts` = TypeScript.

### DECYZJA-3: Ile warstw w MVP? ✅ ROZSTRZYGNIETA
**Odpowiedz: 4 warstwy** — defaults → global → project → CLI flags. Local config (gitignored per-user overrides) odroczony do v2. Prostota na start.

### DECYZJA-4: Biblioteka config loading ✅ ROZSTRZYGNIETA
**Odpowiedz: c12 (unjs)** — best practice w ekosystemie TS/Node. Natywny JSONC, wbudowane .env loading, extends i watchers gotowe na v2. MIT licencja. Uzywany przez Nuxt (25k+ stars).

### DECYZJA-5: Env var prefix ✅ ROZSTRZYGNIETA
**Odpowiedz: `DC_*`** — krotki prefix. `DC_MODEL`, `DC_QUALITY`, `DC_CONFIG_DIR`. Analogicznie jak `.dc/`.

### DECYZJA-6: .env file loading w MVP? ✅ ROZSTRZYGNIETA
**Odpowiedz: Tak** — ladowanie `.env` z CWD na starcie. c12 ma wbudowane .env loading — zero dodatkowej pracy.

### DECYZJA-7: Config substitution w MVP? ✅ ROZSTRZYGNIETA
**Odpowiedz: Nie w MVP** — za mala wartosc vs zlozonosc. W MVP env vars uzywane bezposrednio (`DC_*` prefix lub `.env`). Substitution `{env:VAR}` i `{file:path}` w v2.

### DECYZJA-8: Platformy ✅ ROZSTRZYGNIETA
**Odpowiedz: Linux + macOS** — Windows odroczony. Upraszcza sciezki (XDG + macOS native, bez `%APPDATA%`). Nie trzeba env-paths library — prosta wlasna implementacja (5 linii). Windows moze w v2/v3 jesli pojawi sie zapotrzebowanie.

---

## 9. Zrodla

### Bezposrednio przeczytany kod
- `example-repos/opencode/packages/opencode/src/config/config.ts` — pelny 7-layer config system
- `example-repos/codex/codex-rs/core/src/config/mod.rs` — ConfigLayerStack, profiles, trust
- `example-repos/codex/codex-rs/core/src/config_loader/mod.rs` — config loading layers
- `example-repos/aider/aider/args.py` — configargparse, YAML, auto env prefix
- `example-repos/aider/aider/main.py` — .env search order
- `example-repos/plandex/app/shared/plan_config.go` — PlanConfig, AutoMode presets
- `example-repos/cline/cli/src/utils/path.ts` — CLINE_DATA_DIR, CLINE_LOG_DIR
- `example-repos/cline/cli/src/index.ts` — --config flag, CLI options
- `example-repos/cline/docs/cline-cli/configuration.mdx` — pelna dokumentacja config
- `example-repos/OpenHands/config.template.toml` — pelny config template
- `example-repos/claude-code/examples/settings/settings-*.json` — 3 przykladowe settings
- `example-repos/claude-code/CHANGELOG.md` — managed settings, worktree support
- `example-repos/oh-my-opencode/src/plugin-config.ts` — loadConfigFromPath, mergeConfigs, loadPluginConfig
- `example-repos/oh-my-opencode/src/shared/opencode-config-dir.ts` — getOpenCodeConfigDir, XDG, Tauri
- `example-repos/oh-my-opencode/src/config/schema.ts` — per-feature config schemas

### Badane biblioteki
- cosmiconfig — https://github.com/cosmiconfig/cosmiconfig
- c12 (unjs) — https://github.com/unjs/c12
- defu (unjs) — https://github.com/unjs/defu
- rc9 (unjs) — https://github.com/unjs/rc9
- env-paths (sindresorhus) — https://github.com/sindresorhus/env-paths
- conf (sindresorhus) — https://github.com/sindresorhus/conf
- Zod — https://zod.dev
- AJV — https://ajv.js.org

---

## 10. Powiazane dokumenty

- `spec-mvp-diricode.md` — ADR-009 (Config layers), ADR-010 (Config format)
- `analiza-lean-mode.md` — 4 wymiary pracy (Quality, Autonomy, Verbose, Creativity)
- `analiza-agent-roster.md` — 40 agentow (config per-agent)
- `analiza-observability.md` — EventStream (config wplywa na verbose level)
- `analiza-hookow.md` — 20 typow hookow (config disabled_hooks)
