# ADR-018 — SQLite Index with Tree-sitter and PageRank

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-context-management.md                 |

### Context

Agents need fast, structured access to codebase information (symbols, imports, file relationships) without reading every file. A persistent index with ranking enables intelligent file selection.

### Decision

**Persistent SQLite index** with tree-sitter symbol extraction + PageRank file ranking.

**Schema (MVP):**

| Table | Purpose |
|-------|---------|
| `files` | File metadata (path, size, mtime, git_hash, language) |
| `symbols` | Definitions from tree-sitter (name, kind, start/end line, signature, nested parent) |
| `imports` | Dependency graph (from_file, to_path, symbol_name) |
| `file_ranks` | Pre-computed PageRank + ref/def counts |
| `symbols_fts` | FTS5 full-text search on symbols |

**Refresh strategy:**
- **Cold start:** Full scan + batch parse (~5s per 1000 files).
- **Incremental:** File change event → debounce 2s → re-parse only changed files (mtime check).
- **On-demand:** PageRank recompute when building repo map.

**Tier 1 languages (MVP):** TypeScript, TSX, JavaScript, JSX, Python, Go, Rust, Java, C#, Ruby, PHP, Swift, Kotlin.

### Consequences

- **Positive:** Sub-millisecond symbol lookup. PageRank surfaces the most important files. FTS5 enables fast fuzzy search.
- **Negative:** Initial cold start takes a few seconds. Tree-sitter grammar maintenance per language.
- **Inspiration:** Aider (PageRank + SQLite cache), Plandex (nested Definition struct).
