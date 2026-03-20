# Epic: Semantic Embeddings and Vector Search (v2.1)

> Package: `@diricode/memory` + `@diricode/tools`
> Iteration: **v2.1**
> Issue IDs: **DC-EMB-001..DC-EMB-005**

## Summary

Adds semantic code search via embeddings on top of MVP's deterministic search (tree-sitter PageRank + ripgrep + FTS5). Indexes code symbols and file chunks as vector embeddings, enabling natural-language queries like "where is authentication handled?" to return relevant code even without exact keyword matches.

This was explicitly deferred from MVP per ADR-C6: "MVP bez embeddingów. Tree-sitter + PageRank + ripgrep wystarczy. Plan v2: dodać embeddingi per symbol/plik, hnswlib lub SQLite vector extension."

Source: `analiza-context-management.md` Section 3 (indexing approaches), Section 6.1 (3-layer architecture — Layer 1 structural index), ADR-C6 (embeddings deferred to v2)
Wishlist: 5.2 (semantic search / RAG as option)

## Architectural Baseline

- MVP Layer 1 (Structural Index): tree-sitter symbol extraction + PageRank ranking in SQLite
- MVP tables: `files`, `symbols`, `imports`, `file_ranks` (from `analiza-context-management.md` Section 6.2)
- MVP FTS5: `symbols_fts` virtual table for full-text search on symbol names and signatures
- MVP ripgrep: fast deterministic full-text code search
- Embedding model: use provider router to call embedding endpoint (e.g., `text-embedding-3-small`)
- Storage: SQLite vector extension (sqlite-vec) preferred over separate vector DB — keeps everything in one database

## Issues

### DC-EMB-001 — Embedding model integration via provider router

**Goal**: Add embedding endpoint support to the provider router so any provider with embedding capabilities can be used.

**Scope**
- Extend provider router to handle `embed(texts: string[]) → number[][]` calls
- Supported models: OpenAI `text-embedding-3-small` (via Copilot/OpenRouter), local models via Ollama
- Batch embedding: accept array of texts, return array of vectors
- Dimensionality: configurable (default: 1536 for OpenAI, varies by model)
- Cost tracking: embedding calls counted in token budget (input tokens × embedding price)
- Caching: identical text → cached vector (avoid re-embedding unchanged code)
- Fallback: if embedding provider unavailable, degrade gracefully to FTS5-only search

**Acceptance criteria**
- [ ] Provider router handles `embed()` calls
- [ ] Batch embedding works (up to 100 texts per call)
- [ ] Embedding dimensions configurable per model
- [ ] Token cost tracked for embedding calls
- [ ] Cache hit for identical text avoids re-embedding
- [ ] Graceful degradation to FTS5 when embedding unavailable

**References**
- MVP `epic-router.md` DC-PROV-001..003 (provider router architecture)
- `analiza-context-management.md` Section 6 (ADR-C6: embeddings in v2)
- Vercel AI SDK: embedding model support

---

### DC-EMB-002 — sqlite-vec integration and vector table schema

**Goal**: Set up sqlite-vec extension for vector storage and similarity search within the existing SQLite database.

**Scope**
- Install and load `sqlite-vec` extension for Bun SQLite
- Vector table schema:
  ```sql
  CREATE VIRTUAL TABLE embeddings USING vec0(
    id INTEGER PRIMARY KEY,
    file_id INTEGER,
    symbol_id INTEGER,
    chunk_type TEXT,        -- 'symbol', 'file_chunk', 'commit_message'
    content_hash TEXT,      -- for cache invalidation
    embedding FLOAT[1536]   -- dimension matches model
  );
  ```
- Metadata table linking vectors to source:
  ```sql
  CREATE TABLE embedding_metadata (
    id INTEGER PRIMARY KEY,
    embedding_id INTEGER REFERENCES embeddings(id),
    source_path TEXT,
    start_line INTEGER,
    end_line INTEGER,
    content_preview TEXT,   -- first 200 chars for display
    indexed_at INTEGER
  );
  ```
- Migration: add tables without touching existing MVP tables
- Dimension configurable (1536 default, adjustable for different models)

**Acceptance criteria**
- [ ] sqlite-vec extension loads successfully in Bun
- [ ] Vector table created with correct schema
- [ ] Metadata table links vectors to source locations
- [ ] Insert and query vectors work (cosine similarity)
- [ ] Migration runs without affecting existing MVP tables
- [ ] Dimension configurable per deployment

**References**
- sqlite-vec documentation: https://github.com/asg017/sqlite-vec
- MVP `epic-memory.md` DC-MEM-001 (SQLite setup and migrations)
- `analiza-context-management.md` Section 6.2 (SQLite index schema)

---

### DC-EMB-003 — Code chunking and embedding pipeline

**Goal**: Build a pipeline that chunks code into embeddable units, generates embeddings, and stores them in sqlite-vec.

**Scope**
- Chunking strategies (from coarse to fine):
  1. **Symbol-level**: each function/class/method from tree-sitter → one chunk (primary strategy)
  2. **File-chunk**: files without clear symbols (config, markdown) → sliding window (500 tokens, 100 overlap)
  3. **Signature-only**: for large files — embed only signatures from `symbols` table
- Pipeline steps:
  1. Detect changed files (mtime check, like MVP index refresh)
  2. Extract chunks from changed files
  3. Check content_hash → skip unchanged chunks
  4. Batch embed new/changed chunks
  5. Upsert vectors + metadata in sqlite-vec
- Incremental: only re-embed changed files (not full repo)
- Background: runs as background task, doesn't block user interaction
- Rate limiting: respect embedding API rate limits, queue overflow for retry
- Progress: emit EventStream events for indexing progress

**Acceptance criteria**
- [ ] Symbol-level chunking extracts one chunk per function/class/method
- [ ] File-chunk strategy handles config/markdown files
- [ ] content_hash check avoids re-embedding unchanged code
- [ ] Incremental pipeline only processes changed files
- [ ] Background execution doesn't block main thread
- [ ] Rate limiting prevents API errors
- [ ] EventStream events emitted for progress tracking

**References**
- `analiza-context-management.md` Section 3.1 (Aider: tree-sitter + PageRank), Section 6.6 (index refresh triggers)
- MVP `epic-tools.md` DC-TOOL-003 (tree-sitter integration)
- MVP `epic-context.md` DC-CTX-001 (structural index)

---

### DC-EMB-004 — Semantic search API and hybrid retrieval

**Goal**: Expose semantic search as a tool and combine it with existing deterministic search for hybrid retrieval.

**Scope**
- New tool: `semantic_search(query: string, limit: number) → SearchResult[]`
- Hybrid retrieval strategy:
  1. Embed the query text
  2. sqlite-vec KNN search → top N vector results (semantic)
  3. FTS5 search → top M text results (keyword)
  4. ripgrep → top K exact match results (literal)
  5. Merge + deduplicate + re-rank (RRF — Reciprocal Rank Fusion)
- Result format: `{ path, startLine, endLine, preview, score, source: 'semantic'|'fts5'|'ripgrep' }`
- Configurable weights: user can tune semantic vs keyword vs literal balance
- Agent usage: code-explorer and codebase-mapper agents use hybrid search
- Performance target: <500ms for hybrid query on 10k-file repo

**Acceptance criteria**
- [ ] `semantic_search` tool callable by agents
- [ ] Hybrid retrieval combines 3 search sources
- [ ] RRF re-ranking merges and deduplicates results
- [ ] Configurable weights for search source balance
- [ ] Results include source attribution (semantic/fts5/ripgrep)
- [ ] <500ms latency for hybrid query on 10k-file repo
- [ ] Fallback: if embeddings not indexed, returns FTS5 + ripgrep only

**References**
- `analiza-context-management.md` Section 5.4 (hybrid retrieval: tree-sitter + embeddings + ripgrep)
- MVP `epic-tools.md` DC-TOOL-002 (grep tool), DC-TOOL-003 (tree-sitter)
- MVP `epic-memory.md` DC-MEM-004 (FTS5 full-text search)

---

### DC-EMB-005 — Context Composer integration with embeddings

**Goal**: Enhance the Context Composer (Layer 3) to use semantic search when building prompts, selecting the most relevant code context for each agent request.

**Scope**
- Context Composer enhancement: when composing context for an agent:
  1. Extract key terms/intent from user prompt
  2. Run hybrid search (DC-EMB-004) to find relevant code
  3. Include top results in agent context (within token budget)
  4. Prioritize: active files > semantic results > PageRank repo map
- Smart Context per subtask (Plandex pattern): architect agent uses semantic search to decide which files each subtask needs
- Budget allocation: semantic results share the `repoMap` budget segment (from `analiza-context-management.md` Section 6.3)
- Verbose integration: Narrated mode shows which semantic results were included and why

**Acceptance criteria**
- [ ] Context Composer queries semantic search for each agent request
- [ ] Semantic results included within token budget
- [ ] Priority order: active files > semantic > PageRank
- [ ] Architect agent uses semantic search for subtask file selection
- [ ] Budget allocation respects existing segment ratios
- [ ] Narrated mode shows included semantic results

**References**
- `analiza-context-management.md` Section 6.1 (3-layer architecture — Layer 3 Context Composer)
- `analiza-context-management.md` Section 6.3 (token budget — adaptive strategy)
- MVP `epic-context.md` DC-CTX-006 (Context Composer)
- ADR-C4 (Smart Context per subtask)
