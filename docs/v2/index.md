# v2 — Ecosystem & Polish

> **Theme**: Expand the platform with TUI, deeper context management, annotation-driven approval, and additional agents/hooks.
> **Prerequisite**: MVP-3 complete (all 4 MVP iterations shipped)
> **Estimated iterations**: v2.0, v2.1

---

## Vision

v2 transforms DiriCode from a functional MVP into a polished developer tool. Key additions:

1. **TUI (Ink)** — terminal-native interface as alternative to Web UI
2. **Annotation-driven approval** — tool annotations (readOnly/destructive/idempotent) gate approval flows
3. **Context monitoring** — proactive context window management with thresholds and autocompaction
4. **12 additional agents** — filling out the full 40-agent roster
5. **7 additional hooks** — pre-tool-use, post-tool-use, context-monitor, preemptive-compaction, rules-injection, file-guard, loop-detection
6. **Observability v2** — Detail Panel, Pre-tool Approval inline, Timeline/Waterfall
7. **Semantic Search** — Hybrid FTS5 and vector search for project knowledge
8. **Sandbox** — Isolated execution environment for tool use

---

## v2 Iterations

### v2.0 — Core Expansion

**Exit Criterion**: TUI launches and connects to Hono server. Annotation-driven approval gates destructive tool use. Context monitor fires alerts at 35% remaining. 7 new hooks operational. Token budget calculator works.

**Epics**:
- #632 Semantic Search
- #186 Hooks v2
- #190 Observability v2
- #185 Approval System
- #252 Sandbox
- #254 Auto-Advance

### v2.1 — Refinement

**Exit Criterion**: Observability v2 components (Detail Panel, Timeline) render in Web UI. Named presets for work modes available. Semantic Search provides relevant code context for complex queries.

**Epics**:
- epic-tui.md — Ink TUI
- epic-context-v2.md — Context monitoring, thresholds, autocompaction, token budget
- epic-agents-v2.md — 12 additional agents (first wave)
- epic-config-v2.md — Config substitution, GUI, named presets

---

## Must NOT

- No GitLab/Jira backends (v3/v4)
- No session-end, task-completed, worktree-*, config-change, user-prompt-submit, subagent-stop hooks (v3)
- No multi-user support (v4)
- No Marketplace (CLOSED)

---

## Child Epics

| File | Domain | Issue ID Range | Iteration |
|------|--------|---------------|-----------|
| [epic-tui.md](epic-tui.md) | Ink TUI client | DC-TUI-001..DC-TUI-006 | v2.0 |
| [epic-annotation-approval.md](epic-annotation-approval.md) | Annotation-driven approval | DC-APPR-001..DC-APPR-005 | v2.0 |
| [epic-hooks-v2.md](epic-hooks-v2.md) | 7 new hook types + quality guardrails | DC-HOOK-006..DC-HOOK-013 | v2.0 |
| [epic-context-v2.md](epic-context-v2.md) | Context monitoring + token budget + output spill | DC-CTX-010..DC-CTX-017 | v2.0 |
| [epic-agents-v2.md](epic-agents-v2.md) | 12 additional agents | DC-AGENT-026..DC-AGENT-037 | v2.0 |
| [epic-observability-v2.md](epic-observability-v2.md) | Detail Panel + Timeline + Approval UI | DC-OBS-010..DC-OBS-012 | v2.1 |
| [epic-semantic-search.md](epic-semantic-search.md) | Semantic Search + vector search | DC-EMB-001..DC-EMB-005 | v2.1 |
| [epic-config-v2.md](epic-config-v2.md) | Config substitution + GUI + presets | DC-CFG-005..DC-CFG-009 | v2.1 |

---

## Dependencies on MVP

| v2 Epic | Depends on MVP Epic |
|---------|-------------------|
| TUI | Server (Hono SSE), EventStream, Agent Tree data model |
| Annotation Approval | Tool annotations (DC-TOOL-001), Autonomy dimension |
| Hooks v2 | Hook engine (DC-HOOK-001), Hook registry |
| Context v2 | Context manager (DC-CTX-001..009), Summarizer agent |
| Agents v2 | Agent loader (DC-CORE-005..012), Dispatcher |
| Observability v2 | EventStream (DC-OBS-001), Web UI (DC-WEB-001..007) |
| Semantic Search | Memory system (DC-MEM-001..007), tree-sitter tools |
| Config v2 | Config system (DC-CORE-001..004) |
