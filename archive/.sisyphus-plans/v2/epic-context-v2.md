# Epic: Context Management v2 — Monitoring, Token Budget, Autocompaction (v2.0)

> Package: `@diricode/core`
> Iteration: **v2.0**
> Issue IDs: **DC-CTX-010..DC-CTX-016**

## Summary

Extends MVP context management with proactive monitoring, token budget enforcement, and smart autocompaction. MVP established the 3-layer context architecture (static/dynamic/ephemeral) and section-based rendering. v2 adds the intelligence layer: knowing WHEN context is getting full, HOW MUCH each operation costs, and WHAT to compress.

Critical for Copilot's narrow <200k window (ARCH-001). Without v2 context management, agents in long sessions will silently lose context or hit hard limits.

Survey references: 3.8 (token budget calculator), 6.1-6.6 (context monitoring suite)

## Issues

### DC-CTX-010 — Token budget calculator

**Goal**: Real-time token counting and budget enforcement per agent and per task.

**Scope**
- Count tokens accurately per model (use provider's tokenizer or tiktoken approximation)
- Budget tracking: `{ agentId, tokensUsed, budgetLimit, budgetRemaining }`
- Budget sources:
  - Per-task budget (set by planner/dispatcher)
  - Per-agent budget (from config, defaults per tier: HEAVY=100k, MEDIUM=50k, LOW=20k)
  - Global session budget (user-configurable)
- Budget enforcement: warn at 80%, soft-stop at 95%, hard-stop at 100%
- Integration with Metrics Bar (token counts feed into observability)
- Cost estimation: tokens × model pricing → estimated cost

**Acceptance criteria**
- [ ] Token counting within 5% accuracy of actual model token count
- [ ] Budget warnings trigger at 80% threshold
- [ ] Soft-stop at 95% allows current operation to finish, blocks new ones
- [ ] Hard-stop at 100% terminates agent with budget-exceeded error
- [ ] Cost estimation displayed in Metrics Bar
- [ ] Per-task budget configurable in plan

**References**
- Survey feature 3.8 (token budget calculator)
- Wishlist 4.2 (token budget per task, real-time counter)
- `analiza-context-management.md` Section 6.3 (budget specification)
- PERF-001 (token cost efficiency)

---

### DC-CTX-011 — Context window threshold monitoring

**Goal**: Implement thresholds that trigger warnings and compaction based on context window fill level.

**Scope**
- Monitor context fill after each: LLM response, tool output, file read, delegation result
- Thresholds (from analysis):
  - **Info**: 50% used — log only
  - **Warning**: 65% used (35% remaining) — surface in UI, log
  - **Critical**: 75% used (25% remaining) — trigger compaction
  - **Emergency**: 90% used — aggressive compaction, notify user
- Per-model context windows: Copilot ~200k, Kimi ~1M, custom models configurable
- Threshold events emitted to EventStream for observability

**Acceptance criteria**
- [ ] All 4 threshold levels trigger correctly
- [ ] Thresholds adjust per model's context window size
- [ ] EventStream events emitted at each threshold crossing
- [ ] UI indicator changes color: green → yellow → orange → red
- [ ] Configurable threshold percentages in config

**References**
- Survey features 6.1, 6.2 (context monitoring + thresholds 35%/25%)
- DC-HOOK-008 (context-monitor hook integration)
- `analiza-context-management.md` Section 6.3

---

### DC-CTX-012 — File read deduplication

**Goal**: Detect and remove duplicate file reads from context to save tokens (Cline pattern — ~30% savings).

**Scope**
- Track all file_read operations per agent conversation
- When same file is read multiple times → keep only the most recent read
- Replace older reads with `[Duplicate file read removed: {path}]`
- Track savings: `{ duplicatesRemoved: number, tokensSaved: number }`
- Trigger: runs as part of compaction strategy but also available on-demand
- Handles partial reads (offset/limit): only dedup exact same range reads

**Acceptance criteria**
- [ ] Duplicate file reads detected and replaced with placeholder
- [ ] Most recent read preserved (not oldest)
- [ ] Partial read (different ranges) NOT treated as duplicate
- [ ] Token savings reported to observability
- [ ] Savings consistently ~30% on read-heavy sessions

**References**
- `analiza-context-management.md` Section 2.2 (Cline FileContextTracker)
- DC-HOOK-009 (preemptive-compaction integration)

---

### DC-CTX-013 — Conversation summarization engine

**Goal**: Replace older conversation messages with intelligent summaries to free context space (Plandex ConvoSummary pattern).

**Scope**
- Summarizer agent (from MVP roster) generates summaries
- Summary replaces N oldest messages, keeping:
  - First user message (original task context)
  - Last K messages (recent working context)
  - All messages after the most recent summary
- Summary format: structured markdown with key decisions, file changes, current state
- Incremental: new summary builds on previous summary (not full re-summarization)
- Token target: summary should be 10-20% of original messages' token count

**Acceptance criteria**
- [ ] Summarization preserves key decisions and file change records
- [ ] First user message always preserved
- [ ] Recent K messages always preserved
- [ ] Summary token count is 10-20% of replaced messages
- [ ] Incremental summarization works (builds on previous summary)
- [ ] Agent can still function correctly after summarization

**References**
- `analiza-context-management.md` Section 2.3 (Plandex ConvoSummary)
- Summarizer agent (MVP roster)
- DC-HOOK-009 (preemptive-compaction integration)

---

### DC-CTX-014 — Severity-based compaction orchestrator

**Goal**: Orchestrate compaction strategies with escalating severity levels.

**Scope**
- Severity levels:
  1. **Mild** (Warning threshold): file read dedup only
  2. **Moderate** (Critical threshold): dedup + summarize messages older than 10 turns
  3. **Aggressive** (Emergency threshold): dedup + summarize all but last 3 turns + reduce tool outputs
- Debounce: no more than 1 compaction per 30 seconds (survey 6.5)
- Compaction metrics: tokens before, tokens after, time taken, strategy used
- Integration: orchestrator calls DC-CTX-012, DC-CTX-013 as sub-operations

**Acceptance criteria**
- [ ] Severity escalation follows threshold levels
- [ ] Debounce prevents rapid successive compactions
- [ ] Compaction metrics emitted to EventStream
- [ ] Each severity level applies correct strategy combination
- [ ] No data loss on critical/aggressive — summaries preserve essentials

**References**
- Survey features 6.5, 6.6 (debounce + severity escalation)
- DC-HOOK-009 (preemptive-compaction hook)

---

### DC-CTX-015 — Per-agent context templates

**Goal**: Define per-agent context templates that specify what context sections each agent type needs.

**Scope**
- Template definition per agent: `{ requiredSections, optionalSections, maxTokenBudget }`
- Section types: system_prompt, project_rules, repo_map, conversation_history, tool_outputs, delegated_results
- Dispatcher template: minimal (system + project_rules + recent conversation)
- Code-writer template: full (system + rules + repo_map + conversation + tool outputs)
- Summarizer template: only conversation history (to summarize)
- Templates configurable per agent in `SKILL.md` or config

**Acceptance criteria**
- [ ] Each agent receives only its template-defined sections
- [ ] Templates reduce unnecessary context loading (measurable token savings)
- [ ] Custom templates definable in SKILL.md
- [ ] Dispatcher's lean template verified to stay under 20% window
- [ ] Template violations logged (section exceeds budget)

**References**
- Survey feature 9.3 (per-agent templates)
- `analiza-context-management.md` Section 6.5 (sub-agent context)
- Wishlist 1.4 (isolated context per agent)

---

### DC-CTX-016 — External file change detection

**Goal**: Detect when files in context have been modified outside DiriCode (by user's editor, git operations, etc.) and mark them as stale.

**Scope**
- File watcher (chokidar or Bun's built-in fs.watch) on files currently in context
- When external change detected: mark file as stale in context
- Agent notification: "File {path} was modified externally since last read"
- Option: auto-refresh (re-read file) or notify-only (let agent decide)
- Performance: watch only files currently in active agent contexts (not entire repo)

**Acceptance criteria**
- [ ] External file modifications detected within 2 seconds
- [ ] Stale marker visible in agent context
- [ ] Auto-refresh mode re-reads file and updates context
- [ ] File watcher limited to active context files (not entire repo)
- [ ] Watcher cleanup when agent session ends

**References**
- `analiza-context-management.md` Section 2.2 (Cline FileContextTracker with chokidar)
