# Epic: v2 Hook Types (v2.0)

> Package: `@diricode/core`
> Iteration: **v2.0**
> Issue IDs: **DC-HOOK-006..DC-HOOK-013**

## Summary

Adds 7 new hook types to the existing MVP hook engine (DC-HOOK-001), bringing the total from 6 to 13. These hooks cover: tool-use gating, context management, rules injection, file safety, and loop detection. This is the largest single expansion of the hook system (ARCH-003 roadmap: 6 MVP → 13 v2 → 20 v3).

All 7 hooks use the existing hybrid execution model from MVP: in-process TypeScript for low-latency paths, external process option for community hooks.

Source: `analiza-hookow.md` Section 4 — v2 roadmap.

## Issues

### DC-HOOK-006 — pre-tool-use hook

**Goal**: Fire before every tool invocation, enabling validation, approval gating, argument sanitization, and logging.

**Scope**
- Trigger: before any tool is called by any agent
- Hook context: `{ agentId, toolName, toolArgs, annotations, autonomyLevel }`
- Return: `{ allow: boolean, modifiedArgs?: ToolArgs, reason?: string }`
- If `allow: false` → tool call is blocked, agent receives rejection with reason
- If `modifiedArgs` → tool receives modified arguments (sanitization use case)
- Integration with approval engine (DC-APPR-001): approval check runs as a pre-tool-use hook implementation
- Performance: <5ms overhead for in-process hooks (tool calls are frequent)

**Lean mode**: Simplified — only fires for destructive tools

**Acceptance criteria**
- [ ] Hook fires before every tool invocation in the pipeline
- [ ] Blocking a tool returns structured rejection to agent
- [ ] Argument modification propagates to actual tool call
- [ ] Multiple pre-tool-use hooks execute in DAG order
- [ ] Lean mode skips hook for readOnly tools

**References**
- `analiza-hookow.md` Section 3 (#7 pre-tool-use)
- Claude Code: PreToolUse hook pattern
- DC-APPR-001 (approval engine integration)

---

### DC-HOOK-007 — post-tool-use hook

**Goal**: Fire after every tool invocation, enabling result validation, output truncation, metric capture, and comment checking.

**Scope**
- Trigger: after any tool completes (success or failure)
- Hook context: `{ agentId, toolName, toolArgs, toolResult, durationMs, status }`
- Return: `{ modifiedResult?: ToolResult, warnings?: string[] }`
- Use cases: output truncation (like OMO's tool-output-truncator), comment validation (post-tool-use → check for added comments), metric logging
- If `modifiedResult` → agent receives modified output (truncation use case)

**Lean mode**: Skipped entirely (not critical)

**Acceptance criteria**
- [ ] Hook fires after every tool completion
- [ ] Tool result modification propagates to agent context
- [ ] Duration metrics captured and available for observability
- [ ] Warning strings surfaced in agent tree UI

**References**
- `analiza-hookow.md` Section 3 (#8 post-tool-use)
- OMO: tool-output-truncator, comment-checker

---

### DC-HOOK-008 — context-monitor hook

**Goal**: Continuously monitor context window usage and fire alerts when approaching limits.

**Scope**
- Trigger: after each LLM call or tool result added to context
- Hook context: `{ agentId, tokensUsed, tokensTotal, percentUsed, modelContextWindow }`
- Thresholds (from context analysis):
  - Warning at **65% used** (35% remaining)
  - Critical at **75% used** (25% remaining)
- Return: `{ action: 'continue' | 'warn' | 'compact' | 'stop' }`
- At warning: log + surface in observability
- At critical: trigger preemptive-compaction hook (DC-HOOK-009)

**Lean mode**: Always active (critical for narrow-window models like Copilot)

**Acceptance criteria**
- [ ] Monitor fires after each context-expanding operation
- [ ] Warning threshold triggers logging + UI indicator
- [ ] Critical threshold triggers compaction
- [ ] Thresholds configurable per model/provider
- [ ] Works correctly with Copilot's <200k window

**References**
- `analiza-hookow.md` Section 3 (#9 context-monitor)
- `analiza-context-management.md` (threshold values)
- Survey feature 6.1, 6.2 (context monitoring + thresholds)
- ARCH-001 (narrow context windows are key challenge)

---

### DC-HOOK-009 — preemptive-compaction hook

**Goal**: Intelligently compress conversation context BEFORE hitting the limit — summarize older messages, remove duplicate file reads, normalize buffer.

**Scope**
- Trigger: when context-monitor signals critical threshold
- Hook context: `{ agentId, messages, tokensUsed, tokensTarget, fileReads }`
- Compaction strategies (from context analysis):
  1. **File read dedup**: remove duplicate file reads (Cline pattern — saves ~30%)
  2. **Conversation summary**: replace older messages with summary (Plandex ConvoSummary pattern)
  3. **Buffer normalization**: standardize remaining space allocation (survey 6.6)
- Return: `{ compactedMessages: Message[], tokensSaved: number }`
- Debounce: don't compact more than once per 30s (survey 6.5)
- Severity escalation: mild (dedup only) → moderate (dedup + summarize recent) → aggressive (summarize all)

**Lean mode**: Always active (critical)

**Acceptance criteria**
- [ ] File read dedup removes genuine duplicates
- [ ] Conversation summary preserves key decisions and context
- [ ] Token count after compaction is within target budget
- [ ] Debounce prevents rapid re-compaction
- [ ] Severity escalation applies progressively stricter compression

**References**
- `analiza-hookow.md` Section 3 (#10 preemptive-compaction)
- `analiza-context-management.md` Sections 2.2 (Cline dedup), 2.3 (Plandex ConvoSummary)
- Survey features 6.5, 6.6 (debounce + buffer normalization)
- Wishlist 5.2 (preemptive compaction)

---

### DC-HOOK-010 — rules-injection hook

**Goal**: Intelligently inject project rules, conventions, and agent-specific instructions into context at appropriate moments.

**Scope**
- Trigger: on session-start and on agent delegation (new agent needs rules)
- Hook context: `{ agentId, agentCategory, projectPath, existingRules }`
- Sources to scan:
  - `.dc/rules.md` (DiriCode-specific rules)
  - `.cursorrules` / `.cursorrc` (compatibility with Cursor)
  - `AGENTS.md` (if present — agent-specific rules per directory)
  - `README.md` in working directory (project conventions)
- Intelligence: select ONLY rules relevant to the agent's domain
  - Frontend agent → CSS/HTML rules, not backend conventions
  - Code-writer → coding conventions, not deployment rules
- Return: `{ injectedRules: string, tokenCost: number }`

**Lean mode**: Simplified — only critical rules injected

**Acceptance criteria**
- [ ] Rules from all supported sources are discovered
- [ ] Agent-specific filtering selects relevant rules only
- [ ] Token cost of injected rules is tracked and reported
- [ ] Rules injection happens on session-start and each delegation
- [ ] Duplicate rules are deduplicated across sources

**References**
- `analiza-hookow.md` Section 3 (#11 rules-injection)
- OMO: rules-injector, directory-agents-injector, directory-readme-injector
- Claude Code: InstructionsLoaded hook

---

### DC-HOOK-011 — file-guard hook

**Goal**: Prevent agents from overwriting files when they should use edit operations — enforce edit-over-write policy for existing files.

**Scope**
- Trigger: on file write operations (pre-tool-use for write_file tool)
- Hook context: `{ agentId, filePath, operation: 'write' | 'edit', fileExists: boolean }`
- Policy:
  - If file exists AND operation is `write` → block, suggest `edit` instead
  - If file is new (doesn't exist) AND operation is `write` → allow
  - Allowlist: files that can be fully rewritten (config files, generated files)
- Return: `{ allow: boolean, suggestion?: string }`

**Lean mode**: Always active (safety)

**Acceptance criteria**
- [ ] Blocks full-file writes to existing files
- [ ] Allows writes to new files
- [ ] Allowlist configurable in `.dc/config.jsonc`
- [ ] Blocked writes include helpful suggestion message
- [ ] Existing file detection uses filesystem check (not just context)

**References**
- `analiza-hookow.md` Section 3 (#12 file-guard)
- OMO: write-existing-file-guard hook
- Wishlist: safety rails on file operations

---

### DC-HOOK-012 — loop-detection hook

**Goal**: Detect when an agent is stuck in a repetitive loop (making same tool calls or LLM requests repeatedly) and break the cycle.

**Scope**
- Trigger: on each tool call or LLM request
- Hook context: `{ agentId, recentActions: Action[], actionHash: string }`
- Detection algorithm:
  - Hash recent N actions (tool name + args summary)
  - If same hash appears M times in last N actions → loop detected
  - Default: N=10, M=3 (3 repetitions in last 10 actions)
- Response on detection:
  - Warning: inject "you appear to be in a loop" message to agent
  - Hard stop: after 2 more repetitions after warning → terminate agent, report to parent
- Connection to analysis paralysis guard (DC-CORE from MVP): loop-detection is the v2 generalization

**Lean mode**: Always active (safety)

**Acceptance criteria**
- [ ] Loop detection fires on repeated action patterns
- [ ] Warning injection gives agent chance to self-correct
- [ ] Hard stop terminates agent after continued looping
- [ ] Configurable thresholds (N, M) in config
- [ ] Different action types (tool vs LLM) tracked separately

**References**
- `analiza-hookow.md` Section 3 (#13 loop-detection)
- OMO: ralph-loop hook
- MVP DC-CORE analysis paralysis guard (generalized here)

---

### DC-HOOK-013 — AI-slop guardrails and low-signal output detection

**Goal**: Detect low-signal / low-quality agent output before it silently degrades code or planning quality.

**Scope**
- classify generic/repetitive/low-evidence outputs as warn / block / escalate
- emit quality-warning events for observability
- keep thresholds configurable to reduce false positives

**Acceptance criteria**
- [ ] First useful set of low-signal patterns is detected.
- [ ] Quality warnings are observable.
- [ ] Strictness is configurable.
- [ ] False positives can be tuned down.

**References**
- Pattern 16 — AI Slop Guards
- Langfuse evaluation/observability references
