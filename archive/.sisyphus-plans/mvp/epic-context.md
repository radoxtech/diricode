# Epic: Context Management (MVP-1 → MVP-3)

> Package: `@diricode/core`  
> Iteration: **MVP-1 (basic) → MVP-2 (pipeline) → MVP-3 (composer full)**  
> Issue IDs: **DC-CTX-001..DC-CTX-009**

## Summary

This epic implements DiriCode’s 3-layer context architecture from `analiza-context-management.md` and ADR-016/017/018/019/020, optimized for narrow provider windows (especially Copilot <200k). The design prioritizes **inherited context** (ARCH-005), deterministic budgeting, and incremental indexing so agents receive maximal task-relevant signal with minimal token waste.

The architecture is delivered in three layers:
1. **Layer 1 — Structural Index**: tree-sitter + SQLite + PageRank-backed repository map primitives.
2. **Layer 2 — Context Pipeline**: deterministic compression chain (`fileReadDedup → observationMasking → convoSummary`).
3. **Layer 3 — Context Composer**: adaptive token allocation + binary-search fitting for final prompt assembly.

MVP progression:
- **MVP-1**: index + ranking + repo map
- **MVP-2**: condenser pipeline and conversation compaction
- **MVP-3**: production-grade composer with adaptive budget fitting, active-file priority, symbol FTS lookup

## Architecture Baseline (from primary analysis)

### 3-layer architecture

- **Layer 1: Structural Index**
  - Parse project files with tree-sitter
  - Extract symbols/import edges
  - Persist in SQLite
  - Compute file centrality (PageRank)
- **Layer 2: Context Pipeline**
  - `fileReadDedup`
  - `observationMasking`
  - `convoSummary`
- **Layer 3: Context Composer**
  - Adaptive budget allocation per request
  - Binary-search fit to hard token budget
  - Priority-aware selection (system > active files > conversation > repo map > observations)

### SQLite schema baseline

- `files(path, hash, size, language, last_indexed)`
- `symbols(file_id, name, kind, start_line, end_line, signature)`
- `imports(source_file_id, target_file_id, specifiers)`
- `file_ranks(file_id, rank)`
- `symbols_fts` (FTS5 virtual table over symbols)

### Adaptive budget baseline

- `system`: 15%
- `repoMap`: 20–40%
- `activeFiles`: 10–45%
- `conversation`: 20–35%
- `reserved`: 15%

This adaptive split is mandatory to support both “active editing” and “exploration/no-active-file” states from the same architecture.

## Issues

### DC-CTX-001 — Structural index with tree-sitter (MVP-1)

**Goal**: Build persistent, incremental structural code index for context retrieval.

**Scope**
- Parse source files with tree-sitter (MVP language set aligned with spec)
- Extract:
  - symbols (functions/classes/exports/interfaces/types)
  - import edges (source → target)
- Persist to SQLite tables:
  - `files`, `symbols`, `imports`
- Incremental re-indexing:
  - detect changed files by hash/mtime
  - re-parse only changed files
  - remove stale symbol/import rows for replaced files
- Error tolerance:
  - parse failures logged as non-fatal; pipeline continues

**Technical risk**
- Bun + tree-sitter compatibility/performance in real repositories.

**Acceptance criteria**
- [ ] Initial index builds for a medium repository without crashing.
- [ ] Changed-file run updates only touched files.
- [ ] Symbols/imports are queryable and mapped to file paths deterministically.
- [ ] Parse failures are captured with trace context and do not block session flow.

**References**
- `analiza-context-management.md` (Layer 1, SQLite recommendation)
- ADR-018 (SQLite + tree-sitter + PageRank)

---

### DC-CTX-002 — File rank scoring (PageRank) (MVP-1)

**Goal**: Rank files by structural importance to improve context selection quality.

**Scope**
- Build directed import/reference graph from indexed files
- Compute PageRank scores per file
- Store scores in `file_ranks`
- Recompute strategy:
  - full recompute on first index
  - incremental/lazy recompute after index updates
- Expose ranking API for repo map and composer

**Acceptance criteria**
- [ ] Every indexed file has a rank entry.
- [ ] Ranking is stable across runs with unchanged graph.
- [ ] Rank API returns top-N files in deterministic order.
- [ ] Measured overhead remains acceptable for MVP repo sizes.

**References**
- `analiza-context-management.md` (Aider-inspired PageRank)
- ADR-018

---

### DC-CTX-003 — Repo map generator (MVP-1)

**Goal**: Generate concise, ranked repository map suitable for constrained context windows.

**Scope**
- Format: `file path -> exported symbols` (one line/file)
- Source: `symbols` + `file_ranks`
- Ordering: descending PageRank
- Budget aware output:
  - target repoMap budget segment (20–40%)
  - truncate safely when exceeding segment
- Keep output deterministic for cacheability and diffability

**Acceptance criteria**
- [ ] Repo map generated from index without scanning raw files.
- [ ] Higher-ranked files consistently appear earlier.
- [ ] Output remains within configured repoMap token segment.
- [ ] Format remains compact and stable across equivalent runs.

**References**
- `analiza-context-management.md` (repo map + budgeting)
- ADR-016/018

---

### DC-CTX-004 — Context pipeline: `fileReadDedup` (MVP-2)

**Goal**: Remove duplicate file-read payload bloat from conversation history.

**Scope**
- Detect repeated reads of same file in conversation/tool history
- Keep only latest effective content snapshot per file
- Replace earlier duplicates with compact markers/metadata
- Maintain semantic continuity (agent still “knows” reads occurred)

**Acceptance criteria**
- [ ] Duplicate reads are collapsed deterministically.
- [ ] Latest file snapshot remains present in context.
- [ ] Dedup runs before expensive summarization stage.
- [ ] Compression savings are observable in context metrics.

**References**
- `analiza-context-management.md` (Cline-style dedup)
- ADR-017 (condenser pipeline)

---

### DC-CTX-005 — Context pipeline: `observationMasking` (MVP-2)

**Goal**: Compress stale/low-value tool observations while preserving recent actionable context.

**Scope**
- Keep recent observations in full detail
- Convert older low-relevance observations to short masked summaries
- Apply policy by age + relevance class (tool type / action category)
- Preserve failure/error observations with higher priority retention

**Acceptance criteria**
- [ ] Older observations are masked into compact summaries.
- [ ] Recent critical observations remain intact.
- [ ] Pipeline remains loss-tolerant (no malformed context artifacts).
- [ ] Token footprint decreases measurably before convoSummary.

**References**
- `analiza-context-management.md` (OpenHands-inspired masking)
- ADR-017

---

### DC-CTX-006 — Context pipeline: `convoSummary` (MVP-2)

**Goal**: Summarize older conversation turns while preserving short-term working memory.

**Scope**
- Keep recent N turns unchanged
- Summarize older turns into 1–2 sentence artifacts
- Integrate summarizer agent (`DC-AGENT-005`) for summary generation
- Reuse existing summaries when still valid to avoid repeated summary cost

**Acceptance criteria**
- [ ] Recent turn window is preserved exactly.
- [ ] Older turns are replaced by concise summary blocks.
- [ ] Summary generation is incremental and budget-triggered.
- [ ] Failures degrade gracefully (no pipeline crash, fallback to less-compressed history).

**References**
- `analiza-context-management.md` (Plandex-style incremental summary)
- ADR-017/020

---

### DC-CTX-007 — Context composer with budget fitting (MVP-3)

**Goal**: Compose final model context under hard token limit using adaptive budgeting and binary search fitting.

**Scope**
- Implement adaptive segment allocator:
  - system, repoMap, activeFiles, conversation, reserved
- Implement binary-search fitting loop to satisfy model token cap
- Priority ordering (strict):
  1. system prompts/tools
  2. active files
  3. conversation
  4. repo map
  5. observations
- Provider-aware behavior for narrow windows (Copilot-centric)

**Acceptance criteria**
- [ ] Final prompt never exceeds configured model budget.
- [ ] Binary search converges predictably within bounded iterations.
- [ ] Priority rules are enforced under pressure.
- [ ] Budget allocations adjust correctly between active-edit and exploration modes.

**References**
- `analiza-context-management.md` (binary search + adaptive budget)
- ADR-016/017/020
- ARCH-005 (inherited context for narrow windows)

---

### DC-CTX-008 — Symbols FTS5 search (MVP-3)

**Goal**: Enable fast symbol lookup for code-explorer and planning workflows.

**Scope**
- Implement `symbols_fts` virtual table over symbol corpus
- Support query dimensions:
  - symbol name
  - file path
  - symbol kind
- Integrate search API consumed by code-explorer agent
- Benchmark and tune query/index strategy

**Performance target**
- Typical lookup response: **<100ms**

**Acceptance criteria**
- [ ] FTS table is populated and synchronized with symbol index updates.
- [ ] Query API supports name/path/kind searches.
- [ ] Median lookup meets performance target in representative repos.
- [ ] Search failures are non-fatal and observable.

**References**
- `analiza-context-management.md` (SQLite FTS recommendation)
- ADR-018

---

### DC-CTX-009 — Active file tracking (MVP-3)

**Goal**: Prioritize recently relevant files in context composition via activity scoring and decay.

**Scope**
- Track file activity from tool events (read/write/edit)
- Maintain recency-weighted activity score with time decay
- Surface active-file set to composer budget allocator
- Integrate with inherited parent→child task context (ARCH-005)

**Acceptance criteria**
- [ ] File read/write events update activity state.
- [ ] Activity score decays over time without manual cleanup.
- [ ] Composer prioritizes active files under constrained budgets.
- [ ] Active-file state improves continuity across delegated subtasks.

**References**
- `analiza-context-management.md` (active context emphasis)
- ADR-019/020
- ARCH-005

## Must NOT (scope guardrails)

- Must NOT add embeddings/vector DB in this epic (deferred by ADR-021 to v2).
- Must NOT bypass adaptive budgeting with static fixed slices only.
- Must NOT allow condenser failures to crash main pipeline.
- Must NOT include full-repo raw content in prompt composition by default.
- Must NOT break inherited context guarantees across sub-agents (ARCH-005).

## Dependencies

### Upstream
- `DC-CORE-*` config foundation (budget knobs, feature flags)
- `DC-AGENT-005` summarizer agent (for convoSummary)
- Event/telemetry contracts for context metrics

### Cross-epic
- `epic-pipeline` (invocation points and phase boundaries)
- `epic-agents-core` (sub-agent context inheritance contracts)
- `epic-observability` (context usage and compression telemetry)
- `epic-tools` (tool-event stream for active file tracking)

### ADR/analysis anchors
- ADR-016, ADR-017, ADR-018, ADR-019, ADR-020, ADR-021
- `analiza-context-management.md` (primary)
- ARCH-005 (narrow-window inherited context)

## Delivery sequencing

### MVP-1
- DC-CTX-001, DC-CTX-002, DC-CTX-003

### MVP-2
- DC-CTX-004, DC-CTX-005, DC-CTX-006

### MVP-3
- DC-CTX-007, DC-CTX-008, DC-CTX-009

This sequence follows PROCESS-001 (Wheel→Scooter→Bicycle→Car): start with structural signal, then compression, then budget-optimal composition.
