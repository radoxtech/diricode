# DiriCode — Work Modes & Dimensions Analysis (TASK-008, Part 2)

Date: 2026-03-10
Status: FINAL — all decisions confirmed by user
Language: English (per project convention for technical docs)

---

## 1. Overview

DiriCode replaces the concept of a single "lean mode" toggle with a **4-dimensional configuration system**. Each dimension is orthogonal — can be changed independently, per-prompt, via UI controls below the chat input field (similar to OpenCode's agent/model selectors).

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Number of dimensions | **4** | Quality, Autonomy, Verbose, Creativity — each controls a distinct aspect |
| UI location | **Below chat input** | Like OpenCode agent/model selector — user changes before each prompt |
| Change granularity | **Per-prompt** | User can switch any dimension before any message |
| Presets (e.g., "Budget Dev", "PM Quick POC") | **v2/v3** | MVP uses manual dimension selection only |
| Naming convention | **English, descriptive** | Consistent with agent roster naming (ADR-002) |

### Default Values (after installation)

| Dimension | Default | Level |
|-----------|---------|-------|
| Quality | **Standard** | 3/5 |
| Autonomy | **Auto-Edit** | 3/5 |
| Verbose | **Compact** | 2/4 |
| Creativity | **Helpful** | 2/5 |

---

## 2. Dimension 1: Quality (5 levels)

Defines **how deeply DiriCode works** — which agents are activated, which are skipped, and what model tier is used.

### Level Overview

| # | Name | Description |
|---|------|-------------|
| 1 | **Cheap** | Minimize token usage. Smallest models, minimal agent pipeline. For users on tight subscription limits. |
| 2 | **POC** | Build something fast for non-technical person. AI leads via interview. Code quality not important. |
| 3 | **Standard** | Normal development. Tests exist but basic. Quick code review. No security audit. Default for most work. |
| 4 | **Production** | Full pipeline. Thorough testing, security checks, integration verification. Code must be deployment-ready. |
| 5 | **Super** | Highest possible code quality. All QA agents active. Architecture review, edge-case testing, spec compliance. |

### Agent Activation Matrix

| Agent | Cheap | POC | Standard | Production | Super |
|-------|-------|-----|----------|------------|-------|
| **dispatcher** | ✅ LOW | ✅ MEDIUM | ✅ MEDIUM | ✅ HEAVY | ✅ HEAVY |
| **auto-continue** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **planner-thorough** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **planner-quick** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **architect** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **prompt-validator** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **plan-reviewer** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **project-roadmapper** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **project-builder** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **sprint-planner** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **todo-manager** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **code-writer** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **code-writer-hard** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **code-writer-quick** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **file-builder** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **creative-thinker** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **frontend-specialist** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **refactoring-agent** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **debugger** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **test-writer** | ❌ | ❌ | ✅ basic | ✅ coverage | ✅ edge-cases |
| **code-reviewer-thorough** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **code-reviewer-quick** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **spec-compliance-reviewer** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **verifier** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **risk-assessor** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **merge-coordinator** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **license-checker** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **integration-checker** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **code-explorer** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **web-researcher** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **browser-agent** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **codebase-mapper** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **summarizer** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **commit-writer** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **namer** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **issue-writer** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **long-task-runner** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **git-operator** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **github-operator** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **devops-operator** | ❌ | ❌ | ❌ | ✅ | ✅ |

**Agent counts per quality level:**
- Cheap: ~7 agents (minimal pipeline)
- POC: ~9 agents (interview + build)
- Standard: ~19 agents (normal dev workflow)
- Production: ~33 agents (full pipeline minus luxury)
- Super: ~37 agents (everything relevant)

Note: Dispatcher decides which agents to actually invoke based on task — the matrix above defines which agents are **available**. Not every available agent runs on every prompt.

### Model Tier Override per Quality Level

| Quality Level | HEAVY agents use | MEDIUM agents use | LOW agents use |
|---------------|-----------------|-------------------|----------------|
| Cheap | — (not activated) | — (not activated) | LOW models |
| POC | — (not activated) | MEDIUM models | LOW models |
| Standard | HEAVY models | MEDIUM models | LOW models |
| Production | HEAVY models | MEDIUM models | LOW models |
| Super | HEAVY models | HEAVY models | MEDIUM models |

Note: In "Super" quality, even MEDIUM-tier agents get upgraded to HEAVY models for maximum quality.

---

## 3. Dimension 2: Autonomy (5 levels)

Defines **who decides, who approves** — how much the AI does on its own vs asking the human.

### Level Overview

| # | Name | Description |
|---|------|-------------|
| 1 | **Ask Everything** | AI asks for confirmation before any action. Maximum human control. |
| 2 | **Suggest** | AI proposes diffs and drafts but doesn't apply. Human approves each change. |
| 3 | **Auto-Edit** | AI writes files autonomously. Asks for shell commands and merges. |
| 4 | **Auto-Execute** | AI writes files and runs safe commands in sandbox. Human approves merges. |
| 5 | **Full Auto** | AI does everything including merge (if CI green + policy). Audit log + revert available. |

### Permission Matrix

| Operation | Ask Everything | Suggest | Auto-Edit | Auto-Execute | Full Auto |
|-----------|---------------|---------|-----------|--------------|-----------|
| Read files | ask | allow | allow | allow | allow |
| Write/edit files | ask | suggest (show diff, wait for OK) | allow | allow | allow |
| Create new files | ask | suggest | allow | allow | allow |
| Delete files | ask | ask | ask | ask (sandbox) | allow (with audit) |
| Safe shell commands (lint, test, build) | ask | ask | ask | allow (sandbox) | allow |
| Risky shell commands (install, deploy) | ask | ask | ask | ask | allow (sandbox + audit) |
| Network access | ask | ask | ask | sandbox rules | allow (with audit) |
| Create git branch | ask | ask | allow | allow | allow |
| Git commit | ask | ask | allow | allow | allow |
| Git push | ask | ask | ask | allow | allow |
| Create PR | ask | ask (draft) | allow | allow | allow |
| Merge PR | ask | ask | ask | ask (auto-merge if CI green + policy) | allow (policy-gated) |
| Destructive git ops (force push, rebase) | ask | ask | ask | ask | ask (always) |

### Ecosystem References

| Framework | Equivalent Levels | Key File |
|-----------|------------------|----------|
| Codex | suggest → auto-edit → full-auto (3 levels) | codex-cli/README.md, core/models.json |
| OMO/OpenCode | Per-agent allow/deny/ask permissions | src/shared/permission-compat.ts |
| Claude Code | PermissionRequest hooks + allowlists + bypassPermissions | plugins/plugin-dev/skills/hook-development/ |
| OpenHands | confirmation_mode: bool (2 levels) | openhands/core/config/security_config.py |
| Plandex | _apply.sh execution gating + fast-apply validation | app/server/model/prompts/apply_exec.go |

---

## 4. Dimension 3: Verbose (4 levels)

Defines **how much AI explains what it's doing**.

### Level Overview

| # | Name | Description |
|---|------|-------------|
| 1 | **Silent** | Only final result — code, diff, success/failure. Zero narration. |
| 2 | **Compact** | Short summary of what was done + result. "Changed 3 files, added dark mode toggle." |
| 3 | **Explain** | Step-by-step reasoning streamed live. "Analyzing App.tsx... found theme in Context... adding provider..." |
| 4 | **Narrated** | Everything — prompts, model responses, tokens, costs, timing. For DiriCode developers/debugging. |

### Behavior Matrix

| Behavior | Silent | Compact | Explain | Narrated |
|----------|--------|---------|---------|----------|
| Final code/diff output | ✅ | ✅ | ✅ | ✅ |
| Summary of changes | ❌ | ✅ | ✅ | ✅ |
| Step-by-step reasoning | ❌ | ❌ | ✅ streamed | ✅ streamed |
| Agent delegation tree (which agent called which) | ❌ | collapsed | expanded | expanded + timing |
| Tool outputs (grep results, test output) | ❌ | errors only | truncated | full |
| Token/cost counters | ❌ | ❌ | ❌ | ✅ |
| Raw prompts/responses | ❌ | ❌ | ❌ | ✅ |
| Warnings/diagnostics | errors only | errors + warnings | all | all + debug |

### Ecosystem References

| Framework | Pattern | Key File |
|-----------|---------|----------|
| Aider | --verbose + --stream + mdstream with reasoning tags | aider/coders/base_coder.py, aider/mdstream.py |
| OMO/OpenCode | notification: "off"\|"minimal"\|"detailed" + suppressOutput hook | src/config/schema/dynamic-context-pruning.ts |
| Codex | Head-tail buffer + truncation policy + guardian (structured vs verbose) | codex-rs/core/src/head_tail_buffer.rs, truncate.rs |
| OpenHands | LOG_LEVEL env + custom DETAIL level | openhands/core/logger.py |
| Plandex | SSE streaming + message types (Reply, BuildInfo, Describing) | app/cli/stream_tui/, app/cli/api/stream.go |

---

## 5. Dimension 4: Creativity (5 levels)

Defines **how proactive and inventive the AI is** — from pure executor to idea generator.

### Level Overview

| # | Name | Description |
|---|------|-------------|
| 1 | **Reactive** | Does ONLY what you ask. Zero initiative. Follows instructions literally. |
| 2 | **Helpful** | Does what you ask + signals obvious problems. "This code has a null pointer bug." |
| 3 | **Research** | Actively searches the web for best practices, docs, OSS examples. Compares approaches before implementing. |
| 4 | **Proactive** | Like Research + proposes improvements, points out tech debt, suggests refactoring opportunities. |
| 5 | **Creative** | Like Proactive + invents new ideas, proposes features, suggests alternative architectures. |

### Behavior Matrix

| Behavior | Reactive | Helpful | Research | Proactive | Creative |
|----------|----------|---------|----------|-----------|----------|
| Execute user instructions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Flag obvious bugs/errors | ❌ | ✅ | ✅ | ✅ | ✅ |
| Warn about anti-patterns | ❌ | ❌ | ✅ | ✅ | ✅ |
| Search web for best practices | ❌ | ❌ | ✅ | ✅ | ✅ |
| Compare with OSS implementations | ❌ | ❌ | ✅ | ✅ | ✅ |
| Read official docs before implementing | ❌ | ❌ | ✅ | ✅ | ✅ |
| Suggest refactoring opportunities | ❌ | ❌ | ❌ | ✅ | ✅ |
| Point out tech debt | ❌ | ❌ | ❌ | ✅ | ✅ |
| Propose performance improvements | ❌ | ❌ | ❌ | ✅ | ✅ |
| Invent new feature ideas | ❌ | ❌ | ❌ | ❌ | ✅ |
| Propose alternative architectures | ❌ | ❌ | ❌ | ❌ | ✅ |
| Challenge user's approach with alternatives | ❌ | ❌ | ❌ | ❌ | ✅ |

### Each Level Adds to Previous

Creativity is cumulative — each level includes all behaviors from lower levels plus its own.

```
Reactive ⊂ Helpful ⊂ Research ⊂ Proactive ⊂ Creative
```

---

## 6. UI Design — Controls Below Chat

Based on OpenCode pattern (agent + model selectors below chat input).

### Controls Layout

```
┌─────────────────────────────────────────────────────┐
│  Type your message...                               │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Agent: [dispatcher ▼]  Model: [auto ▼]              │
│ Quality: [Standard ▼]  Autonomy: [Auto-Edit ▼]      │
│ Verbose: [Compact ▼]   Creativity: [Helpful ▼]      │
└─────────────────────────────────────────────────────┘
```

### Behavior Notes

- **Agent selector**: Shows only main agents (dispatcher + a few direct-use agents like code-explorer). Not all 40.
- **Model selector**: "auto" = let Quality level decide. Or user can override with specific model.
- **All selectors**: Persist across messages until changed. Saved per-project in config.
- **Per-prompt override**: Change any selector → affects only next prompt and forward (not retroactively).

---

## 7. Interaction with Agent Roster

The Quality dimension directly maps to the 40-agent roster (see `analiza-agent-roster.md`).

### How Dispatcher Uses Quality Level

1. User sends prompt with Quality = X
2. Dispatcher reads available agent pool for Quality level X (from Section 2 matrix)
3. Dispatcher analyzes the task and picks relevant agents from the pool
4. Each agent runs with model tier defined by Quality level (Section 2, Model Tier Override table)

### Agent Tier vs Quality Level

The agent's **defined tier** (HEAVY/MEDIUM/LOW from roster) determines its baseline model requirement. The Quality level can **downgrade or upgrade** this:

| Agent Tier | Cheap | POC | Standard | Production | Super |
|------------|-------|-----|----------|------------|-------|
| HEAVY | not available | not available | HEAVY model | HEAVY model | HEAVY model |
| MEDIUM | not available | MEDIUM model | MEDIUM model | MEDIUM model | HEAVY model ↑ |
| LOW | LOW model | LOW model | LOW model | LOW model | MEDIUM model ↑ |

---

## 8. Interaction with Other Systems

### Hooks (TASK-001, `analiza-hookow.md`)

Quality and Autonomy dimensions affect which hooks fire:

| Hook Category | Cheap | Standard | Production | Super |
|---------------|-------|----------|------------|-------|
| Safety hooks (pre-tool-use) | ✅ always | ✅ always | ✅ always | ✅ always |
| Quality hooks (post-code-write) | ❌ | ✅ basic | ✅ full | ✅ full |
| Review hooks (pre-commit) | ❌ | ❌ | ✅ | ✅ |
| Audit hooks (post-merge) | ❌ | ❌ | ✅ | ✅ |

Safety hooks always fire regardless of Quality level — security is non-negotiable.

### Context Management (TASK-002, `analiza-context-management.md`)

Quality level affects context budget:

| Quality | Context Strategy |
|---------|-----------------|
| Cheap | Aggressive compaction, minimal history, short context window |
| POC | Moderate compaction, recent history only |
| Standard | Normal compaction, reasonable history depth |
| Production | Conservative compaction, preserve full relevant context |
| Super | Maximum context, minimal compaction, full history |

### Prompt Caching (TASK-011, `analiza-prompt-caching.md`)

Verbose level affects caching efficiency:
- Silent/Compact: More cacheable (shorter, more structured outputs)
- Explain/Narrated: Less cacheable (longer, more variable outputs)
- System prompts and agent instructions remain highly cacheable regardless of Verbose level.

---

## 9. MVP Scope

### What's in MVP

- 4 dimensions with all levels available
- UI controls below chat input
- Dispatcher respects Quality level for agent selection
- Autonomy permission enforcement (ask/allow/deny per operation)
- Verbose output filtering
- Creativity behavior injection into agent system prompts
- Per-project config persistence

### What's in v2/v3

- **Presets** — named combinations (e.g., "Budget Dev", "PM Quick POC", "Release Candidate")
- **Per-agent dimension override** — e.g., "use Production quality but force code-writer to HEAVY model"
- **Cost tracking** — real-time token/cost display linked to Quality level
- **Adaptive suggestions** — DiriCode suggests Quality level based on task complexity
- **Custom levels** — user-defined Quality profiles

---

## 10. Ecosystem Research Summary

### Sources Analyzed

| Source | What We Learned | Key Files |
|--------|----------------|-----------|
| **Codex** | 3 approval modes (suggest/auto-edit/full-auto), sandbox-based autonomy | codex-cli/README.md, core/models.json |
| **OMO/OpenCode** | Per-agent permissions (allow/deny/ask), interview modes, agent categories, notification levels (off/minimal/detailed) | src/shared/permission-compat.ts, src/agents/hephaestus.ts, src/config/schema/dynamic-context-pruning.ts |
| **Claude Code** | Hook-based permission system, PermissionRequest hooks, allowlists/denylists, workspace trust, settings-strict/settings-lax | plugins/plugin-dev/skills/hook-development/, examples/settings/ |
| **OpenHands** | Binary confirmation_mode, AWAITING_USER_CONFIRMATION state, LOG_LEVEL with custom DETAIL level | openhands/core/config/security_config.py, openhands/core/logger.py |
| **Plandex** | 16 Model Packs (per-provider × tier), _apply.sh execution gating, SSE streaming with message types | app/shared/ai_models_packs.go, app/server/model/prompts/apply_exec.go, app/cli/stream_tui/ |
| **Aider** | --verbose + --stream flags, mdstream progressive renderer, reasoning tags, model.streaming capability check | aider/coders/base_coder.py, aider/mdstream.py, aider/args.py |

### Key Patterns Adopted

1. **Named levels over binary toggles** — Codex's 3 approval modes proved that named levels are more intuitive than on/off switches
2. **Permission matrices** — OMO's per-tool allow/deny/ask pattern scales well to our 5 autonomy levels
3. **Hook-based safety** — Claude Code's PermissionRequest hooks ensure safety is enforced even at highest autonomy
4. **Progressive streaming** — Aider's mdstream + reasoning tags map directly to our Verbose levels
5. **Config-driven detail** — OMO's notification: "off"|"minimal"|"detailed" validates our multi-level approach
6. **Model tier packs** — Plandex's Model Packs concept influenced our Quality → Model Tier Override mapping

---

## 11. Open Questions (for future sessions)

1. **Naming**: "Quality" / "Autonomy" / "Verbose" / "Creativity" are working names. Final UI labels TBD.
2. **Model Packs**: How many pre-defined model combinations per Quality level? (depends on TASK-006 config layers)
3. **Condenser strategy**: Simple auto-compaction for MVP, pipeline for v2 (per PROCESS-001: wheel → scooter)
4. **Thinking budget**: Embedded in Quality level (HEAVY agents + Super quality = max thinking). Not a separate control in MVP.
5. **Fallback chain**: 2 levels for MVP (Primary → Secondary → Tertiary → stop). Expandable in v2.

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-03-10 | Initial analysis: 4 dimensions, all levels defined. User confirmed all decisions. |
