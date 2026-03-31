## ADR-045 — ReasoningBank System

| Field       | Value                                                                 |
|-------------|-----------------------------------------------------------------------|
| Status      | Accepted                                                              |
| Date        | 2026-03-23                                                            |
| Scope       | MVP foundations + v2 live integration                                 |
| References  | ADR-024 (hooks), ADR-018 (SQLite), Survey Decision A1                 |

### Context

DiriCode runs 40 specialized agents across many sessions. Each agent starts with no memory of prior work. When a code-writer agent encounters a tricky TypeScript type error, it reasons its way to a solution — then that reasoning vanishes. The next agent, tomorrow, in a different worktree, hits the same class of problem and reasons its way through it again. Token for token, minute for minute, the same ground is re-covered.

This is not a retrieval problem. The existing 3-layer context system (ADR-016) already handles injecting relevant *files* into agent context. ADR-021 deferred *code search embeddings* to v2. What is missing is something different: a way to capture **how agents solved problems**, not just what code they wrote.

The distinction matters. A RAG system over code tells you *what the codebase looks like*. A reasoning record tells you *what approach worked when facing a specific type of problem* — which tools to try, which false paths to avoid, how to structure the solution, and how confident the approach proved to be (did tests pass afterward?).

Contemporary agent platforms have tackled adjacent problems. Letta (MemGPT) introduces tiered memory — core (in-context), recall (conversation history), and archival (cold external storage) — so agents can persist state across sessions without bloating the context window. Devin takes a different angle: sessions can be analyzed to produce structured playbooks, and those playbooks are injected into future sessions facing similar work. Both approaches share the same observation: agents that can reference prior work outperform agents that start from scratch, not because the prior work contains the answer, but because it contains a *shaped search space* — a narrower set of approaches worth trying first.

DiriCode's agents are short-lived by design. They run to completion, then stop. There is no persistent agent loop to accumulate experience across tasks. The ReasoningBank is the mechanism that bridges those sessions: a structured store of reasoning patterns that survived contact with the codebase and produced working results.

### Decision

**Introduce ReasoningBank — a structured store of reasoning patterns — backed by the existing SQLite instance, integrated with the Hook Framework (ADR-024), and separate from RAG or document-chunk retrieval.**

**Prototype-first sequencing (clarification, 2026-03-28):**

- ReasoningBank remains an accepted strategic capability.
- MVP focus is on **storage/schema/foundation work only where it does not slow the first working runtime path**.
- Live injection and hook-driven learning remain staged behind the core runtime loop, observability, and checkpoint/resume milestones.
- In practical planning terms, ReasoningBank is an **early second-wave capability**, not part of the narrowest first prototype slice.

**What a reasoning record contains.** Each record captures a single problem-solving event:

- **Problem descriptor** — the type of problem the agent faced (e.g., "TypeScript generic constraint error", "FTS5 query returning no results", "circular import in ESM module graph"). This is a short, normalized label, not a dump of the full task.
- **Approach** — the reasoning steps the agent took: what it tried, what it ruled out, and why. This is the valuable part. Not the final code, but the path.
- **Outcome** — what happened: did the change compile? Did the tests pass? Did the agent produce a follow-up error or succeed cleanly?
- **Confidence score** — a numeric score (0.0–1.0) calculated from the outcome and updated over time. A reasoning record that led to passing tests and no follow-up errors scores high. One that triggered failures scores low and decays toward removal.
- **Agent type** — which category of agent produced this record (code-writer, debugger, test-writer, etc.), used to filter relevant records by context.
- **Tags** — normalized labels (language, framework, error class) for fast pre-filtering before semantic search.

**Storage: SQLite + FTS5 + sqlite-vec.** The ReasoningBank shares the SQLite instance already owned by `@diricode/memory` (ADR-018). It adds:

- An FTS5 virtual table over problem descriptors and approach text, enabling keyword-based pre-filtering.
- sqlite-vec embeddings on problem descriptors, enabling semantic retrieval: "find records where the problem was similar to this one."
- A `confidence` column and `last_confirmed_at` timestamp used for scoring and decay.

This is a natural extension of the ADR-048 pattern: sqlite-vec was already accepted for the issue system's semantic search; the same extension serves reasoning retrieval here.

**Integration with Hook Framework (ADR-024).** Two hooks carry the work:

- **`post-agent` hook (Phase 3, v3 timeline).** Fires after an agent completes. Inspects the agent's output and outcome signals (test results, error counts, subsequent agent invocations needed). If the agent solved a non-trivial problem, the hook extracts a reasoning record and writes it to the bank. The hook runs as a background process — it does not block the session.

- **`pre-agent` hook (Phase 2, v2 timeline).** Fires before an agent runs. Queries the ReasoningBank for records matching the current problem context (by FTS5 keyword match first, then sqlite-vec similarity for the top candidates). If high-confidence records exist, the most relevant are injected into the agent's system prompt as "prior reasoning" — brief, structured notes, not raw text dumps. Low-confidence records are excluded. The hook is a Wrapper (ADR-033): it can modify the agent's context before execution begins.

The hook integration means ReasoningBank is an opt-in layer on top of the existing agent system. Agents that don't benefit from prior reasoning (e.g., `commit-writer`, `namer`) simply receive no injected records. The hooks only activate when the agent type and problem context match stored patterns.

**Not RAG.** The ReasoningBank does not store document chunks. It does not embed file contents or index the codebase. That is ADR-018's domain. ReasoningBank stores structured reasoning events — problem → approach → outcome — which are inherently higher signal per token than raw code chunks. An agent injected with "last time this type of problem appeared, the successful approach was X, confidence 0.87" is getting a prior probability over approaches, not a retrieved code snippet to copy.

**Confidence scoring and decay.** Every record carries a numeric confidence score. The score starts at the outcome signal (1.0 for clean test pass, lower for partial success). Over time:

- Records confirmed by subsequent agents (same approach works again) increase in confidence.
- Records that correlate with test failures or follow-on debugging sessions lose confidence.
- Records that have not been accessed or confirmed in a long time decay via a configurable half-life. Stale reasoning is more dangerous than no reasoning.
- Records below a minimum confidence threshold are archived (not deleted — the history is preserved), and are not injected into new agents.

### Consequences

- **Positive:**
  - Agents learn from each other across sessions. A debugger that cracked a tricky ESM resolution issue leaves a record that helps the next debugger avoid the same false starts.
  - Token waste decreases. Agents that spend 15 tool calls exploring a dead end before finding the right approach can instead start closer to the solution. The exact reduction depends on retrieval quality, but even a 10% reduction in tool calls per problem class compounds across sprint execution.
  - Consistency improves. When multiple agents tackle the same class of problem in the same codebase, high-confidence reasoning records act as an informal convention layer — agents converge on the same approach rather than each reinventing a solution style.
  - No external service required. SQLite + FTS5 + sqlite-vec means the entire system runs locally, offline, with sub-millisecond read latency. Consistent with the offline-first principle established in ADR-048.
  - The hook integration is low-risk. Hooks fail silently (ADR-024 safety rules). If the ReasoningBank is unavailable or produces no results, the agent runs exactly as it would without the bank.

- **Negative:**
  - Storage grows with agent activity. A busy session that runs hundreds of agents will accumulate many records. Without decay and archival, the bank becomes a liability. Tuning the decay half-life and minimum confidence threshold requires empirical observation of real agent behaviour — these values cannot be determined from first principles.
  - Relevance matching is hard to get right. FTS5 keyword matching over problem descriptors is fast but brittle — a slightly different phrasing for the same class of problem may not match. Semantic search over sqlite-vec embeddings covers this, but similarity thresholds require calibration. Injecting an irrelevant reasoning record is worse than injecting nothing, because it consumes tokens and may steer the agent in the wrong direction.
  - Extraction quality depends on the `post-agent` hook. The hook must produce a normalized, useful problem descriptor from what can be noisy agent output. Poor extraction produces low-signal records that pass confidence thresholds but don't help future agents. This is a quality problem that will surface only during real usage.
  - The `pre-agent` and `post-agent` hooks are Phase 2/3 in ADR-024's timeline. ReasoningBank's full integration cannot ship until those hook types are available. The storage layer and schema can be built in MVP; the live injection pipeline is a v2 deliverable.

### Addendum — Delivery Staging Clarification (2026-03-28)

This ADR is **not** being reversed. Instead, its delivery order is clarified:

- **Do early:** preserve ReasoningBank in architecture, schema planning, and memory-roadmap decisions.
- **Do after core runtime:** live retrieval/injection, confidence-driven reuse, and hook-powered learning loops.
- **Do not let it delay:** the first believable prototype centered on controlled execution, streaming visibility, semantic navigation, and checkpoint/resume.

### Addendum — MemoryDir Relationship (2026-03-31)

ReasoningBank and MemoryDir are **two separate, complementary systems**.

| Dimension | ReasoningBank | MemoryDir |
|-----------|--------------|-----------|
| **Purpose** | Problem-solving memory | General knowledge memory |
| **Format** | Structured (problem → approach → outcome) | Flexible (facts, preferences, patterns, team knowledge) |
| **Storage** | SQLite + sqlite-vec | File-based or SQLite (TBD via research) |
| **Retrieval** | Semantic (embeddings) + keyword (FTS5) | Context-aware + keyword + recency |
| **Integration** | Hook-based (pre-agent/post-agent) | Explicit API |

**Synergy**: ReasoningBank records *how* agents solved problems. MemoryDir stores *what* they learned (facts, preferences, team conventions). Both systems will be integrated to provide full memory coverage, but are implemented independently.

**Status**: Both systems require deep research and reference implementation analysis before implementation. See:
- DC-MEM-001: ReasoningBank Deep Research & Design
- DC-MEM-002: MemoryDir Deep Research & Design

