# Epic: Hooks v3 — 7 Advanced Hook Types (v3.0)

> Package: `@diricode/core`
> Iteration: **v3.0**
> Issue IDs: **DC-HOOK-013..DC-HOOK-019**

## Summary

Adds the final 7 hook types to complete DiriCode's 20-type hook system. These hooks cover advanced lifecycle management (session-end, task-completed), worktree workflows (create/remove), runtime configuration changes, user prompt enrichment, and sub-agent lifecycle management.

Source: `analiza-hookow.md` Section 3 (20 hook types), Section 4 (v3 roadmap — 7 hooks)
Claude Code hooks: SessionEnd→session-end, TaskCompleted→task-completed, WorktreeCreate/Remove, ConfigChange, UserPromptSubmit, SubagentStop

## Architectural Baseline

- MVP: 6 hooks — session-start, pre-commit, post-commit, error-retry, plan-created, plan-validated
- v2: 7 hooks — pre-tool-use, post-tool-use, context-monitor, preemptive-compaction, rules-injection, file-guard, loop-detection
- Hook engine: silent fail pattern, 3s timeout (in-process), 10s timeout (external), automatic DAG
- Hybrid model: in-process TS (core, fast) + external processes (community, isolated)
- Hook registry with `HookDefinition` schema (name, type, trigger, category, timeout, etc.)

## Issues

### DC-HOOK-013 — `session-end` hook

**Goal**: Fire when a DiriCode session ends — for cleanup, metrics persistence, and user notification.

**Scope**
- Trigger: session termination (user quits, timeout, explicit `/quit`)
- Category: lifecycle
- Use cases:
  - Persist final session metrics to SQLite
  - Clean up temporary files/containers
  - Send desktop notification summarizing session (total cost, agents used, tasks completed)
  - Export session transcript if auto-export configured
- Data passed to hook: session ID, duration, total tokens, total cost, agents used, tasks completed/failed
- Lean mode: always active (cleanup is critical)
- Timeout: 5s (slightly longer — must complete cleanup)
- Graceful: hook runs even on abnormal termination (signal handlers)

**Acceptance criteria**
- [ ] Hook fires on normal session end
- [ ] Hook fires on abnormal termination (SIGTERM, SIGINT)
- [ ] Session metrics passed as hook payload
- [ ] Desktop notification example hook works
- [ ] 5s timeout enforced
- [ ] Cleanup logic runs (temp files removed)

**References**
- `analiza-hookow.md` Section 3 (#14: session-end)
- Claude Code: SessionEnd hook type
- MVP `epic-hooks.md` DC-HOOK-001 (hook engine)

---

### DC-HOOK-014 — `task-completed` hook

**Goal**: Fire when an individual task (agent delegation) completes — for metrics, local issue status updates, and notification.

**Scope**
- Trigger: agent returns result to dispatcher (success or failure)
- Category: lifecycle
- Use cases:
  - Update local SQLite issue status with task summary/status
  - Push status update to configured sync adapter (GitHub/GitLab) if enabled (ADR-048)
  - Track per-task token cost and duration
  - Trigger dependent task scheduling
  - Feed reasoning data to ReasoningBank for future agent guidance (ADR-045)
  - Send progress notification (e.g., "3/7 tasks completed")
- Data: task ID, agent name, status (success/failed), duration, tokens, cost, summary, files changed
- Lean mode: simplified (skip sync adapter push, keep local metrics and ReasoningBank feed)
- Timeout: 3s

**Acceptance criteria**
- [ ] Hook fires on task success and failure
- [ ] Local SQLite issue status updated with summary
- [ ] Sync adapter update example hook works (if configured)
- [ ] Per-task metrics recorded
- [ ] Progress notification ("N/M tasks done") works
- [ ] ReasoningBank fed with post-agent data (ADR-045)
- [ ] 3s timeout enforced

**References**
- `analiza-hookow.md` Section 3 (#15: task-completed)
- Claude Code: TaskCompleted hook type
- Survey 2.3, 3.5 (task tracking in local issue system, optional sync to external platforms)
- ADR-048: SQLite as source of truth for runtime state
- ADR-045: ReasoningBank (hook-based learning from agent outcomes)

---

### DC-HOOK-015 — `worktree-create` hook

**Goal**: Fire when a new git worktree is created — for initializing context and configuration in the new worktree.

**Scope**
- Trigger: `git worktree add` detected (via file watcher or explicit command)
- Category: lifecycle
- Use cases:
  - Copy relevant session context to new worktree
  - Initialize worktree-specific config
  - Set up worktree-specific MCP servers
  - Share project memory between worktrees (same repo)
- Data: worktree path, branch name, parent repo path
- Lean mode: always active (setup is critical)
- Timeout: 5s (may involve file operations)

**Acceptance criteria**
- [ ] Hook fires when new worktree created
- [ ] Worktree path and branch passed to hook
- [ ] Context initialization example hook works
- [ ] Project memory shared between worktrees

**References**
- `analiza-hookow.md` Section 3 (#16: worktree-create)
- Claude Code: WorktreeCreate hook (worktree support)

---

### DC-HOOK-016 — `worktree-remove` hook

**Goal**: Fire when a git worktree is removed — for cleanup of worktree-specific resources.

**Scope**
- Trigger: `git worktree remove` or worktree directory deleted
- Category: lifecycle
- Use cases:
  - Clean up worktree-specific temp files
  - Remove worktree-specific MCP server registrations
  - Archive worktree session data
- Data: worktree path, branch name
- Lean mode: always active (cleanup is critical)
- Timeout: 3s

**Acceptance criteria**
- [ ] Hook fires when worktree removed
- [ ] Cleanup of worktree-specific resources
- [ ] MCP server deregistration on worktree removal
- [ ] Session data archived (not lost)

**References**
- `analiza-hookow.md` Section 3 (#17: worktree-remove)
- Claude Code: WorktreeRemove hook

---

### DC-HOOK-017 — `config-change` hook

**Goal**: Fire when DiriCode configuration changes at runtime — for adapting system behavior to new settings.

**Scope**
- Trigger: config file watcher detects change (from DC-CFG-008 hot-reload)
- Category: lifecycle
- Use cases:
  - Reload agent activation matrix when Quality level changes
  - Restart MCP servers when MCP config changes
  - Update hook registry when hooks enabled/disabled
  - Log config change for audit trail
- Data: changed layer (global/project/local), changed keys (diff), old values, new values
- Lean mode: always active (config changes are structural)
- Timeout: 3s
- Note: this hook fires AFTER validation — only for valid config changes

**Acceptance criteria**
- [ ] Hook fires on valid config change
- [ ] Changed keys and old/new values passed to hook
- [ ] Agent activation matrix re-evaluated
- [ ] MCP servers restarted if MCP config changed
- [ ] Invalid config changes do NOT trigger hook

**References**
- `analiza-hookow.md` Section 3 (#18: config-change)
- v2 `epic-config-v2.md` DC-CFG-008 (config hot-reload)
- Claude Code: ConfigChange hook

---

### DC-HOOK-018 — `user-prompt-submit` hook

**Goal**: Fire when user submits a prompt — for enrichment, transformation, and auto-routing before the dispatcher processes it.

**Scope**
- Trigger: user sends a message (before dispatcher receives it)
- Category: context
- Use cases:
  - Auto-detect slash commands (e.g., auto-expand `fix #123` to full issue context)
  - Prompt enrichment: auto-inject relevant file context based on prompt keywords
  - Prompt validation: reject empty or obviously malformed prompts
  - Language detection: auto-translate if configured
  - Template expansion: expand prompt templates/macros
- Data: raw user prompt text, session context summary
- Return: transformed prompt text (or unchanged)
- Lean mode: simplified (only auto-slash-command detection)
- Timeout: 3s (runs before main processing — must be fast)

**Acceptance criteria**
- [ ] Hook fires before dispatcher processes prompt
- [ ] Hook can modify prompt text (transform)
- [ ] Auto-slash-command detection example works
- [ ] Prompt enrichment example works
- [ ] Original prompt preserved in audit log
- [ ] 3s timeout enforced

**References**
- `analiza-hookow.md` Section 3 (#19: user-prompt-submit)
- Claude Code: UserPromptSubmit hook
- OMO: auto-slash-command hook (mapped to this)

---

### DC-HOOK-019 — `subagent-stop` hook

**Goal**: Fire when a sub-agent stops (success, failure, or cancellation) — for retry decisions, escalation, and resource cleanup.

**Scope**
- Trigger: sub-agent execution completes or is cancelled
- Category: lifecycle
- Use cases:
  - Retry logic: if sub-agent failed with transient error → retry with same or different model
  - Escalation: if sub-agent failed → escalate to parent agent or human
  - Resource cleanup: release any resources held by sub-agent
  - Metrics: track sub-agent execution stats
- Data: agent ID, parent agent ID, status (success/failed/cancelled), error message, duration, retry count
- Lean mode: simplified (skip metrics, keep retry/escalation)
- Timeout: 3s
- Note: distinct from error-retry (which fires on API/tool errors within an agent). This fires when the entire sub-agent delegation ends.

**Acceptance criteria**
- [ ] Hook fires on sub-agent completion (all statuses)
- [ ] Retry logic example hook works
- [ ] Escalation to parent/human example works
- [ ] Sub-agent metrics tracked
- [ ] Distinct from error-retry hook (different trigger scope)

**References**
- `analiza-hookow.md` Section 3 (#20: subagent-stop)
- Claude Code: SubagentStop hook
- OMO: delegate-task-retry (partial mapping)
