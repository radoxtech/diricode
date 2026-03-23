# ADR-018 — SQLite Index with Tree-sitter and PageRank

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | analiza-context-management.md, Survey Decision B2, ADR-045, ADR-048 |

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

### Addendum — sqlite-vec for Vector Similarity (Survey Decision B2, 2026-03-23)

The SQLite index is extended with `sqlite-vec` (asg017/sqlite-vec, Mozilla Builders 2024) for vector similarity search alongside the existing FTS5 keyword search.

**New table:**

| Table | Purpose |
|-------|---------|
| `embeddings` | Vector embeddings (file_id, chunk_text, embedding BLOB, model_id) |

**Hybrid search pattern:**
1. FTS5 keyword search returns candidate set (fast, high recall)
2. sqlite-vec cosine similarity re-ranks candidates (semantic relevance)
3. Combined score: `0.3 * fts5_rank + 0.7 * cosine_similarity`

**MVP scope:** Issue and reasoning embeddings only (ADR-048, ADR-045). Code-level embeddings deferred to v2 (ADR-021). Embedding model: local inference via `@xenova/transformers` (e.g., `all-MiniLM-L6-v2`, 384 dimensions).
