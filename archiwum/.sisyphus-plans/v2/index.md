# v2 — Ecosystem & Polish

> **Theme**: Expand the platform with TUI, deeper context management, annotation-driven approval, skill marketplace, and additional agents/hooks.
> **Prerequisite**: MVP-3 complete (all 4 MVP iterations shipped)
> **Estimated iterations**: v2.0, v2.1

---

## Vision

v2 transforms DiriCode from a functional MVP into a polished developer tool. Key additions:

1. **TUI (Ink)** — terminal-native interface as alternative to Web UI
2. **Annotation-driven approval** — tool annotations (readOnly/destructive/idempotent) gate approval flows
3. **Context monitoring** — proactive context window management with thresholds and autocompaction
4. **Skill marketplace** — discover, install, and manage skills from a catalog
5. **12 additional agents** — filling out the full 40-agent roster
6. **7 additional hooks** — pre-tool-use, post-tool-use, context-monitor, preemptive-compaction, rules-injection, file-guard, loop-detection
7. **Observability v2** — Detail Panel, Pre-tool Approval inline, Timeline/Waterfall

---

## v2 Iterations

### v2.0 — Core Expansion

**Exit Criterion**: TUI launches and connects to Hono server. Annotation-driven approval gates destructive tool use. Context monitor fires alerts at 35% remaining. 7 new hooks operational. Token budget calculator works.

**Epics**:
- epic-tui.md — Ink TUI
- epic-annotation-approval.md — Annotation-driven approval system
- epic-hooks-v2.md — 7 new hook types
- epic-context-v2.md — Context monitoring, thresholds, autocompaction, token budget
- epic-agents-v2.md — 12 additional agents (first wave)

### v2.1 — Ecosystem & Refinement

**Exit Criterion**: User can browse skill catalog, install a skill with one command, and have it auto-discovered. Observability v2 components (Detail Panel, Timeline) render in Web UI. Named presets for work modes available.

**Epics**:
- epic-marketplace.md — Skill/plugin catalog and discovery
- epic-observability-v2.md — Detail Panel, Pre-tool Approval, Timeline/Waterfall
- epic-embeddings.md — Semantic embeddings for code search
- epic-config-v2.md — Config substitution, GUI, named presets

---

## Must NOT

- No sandbox/containerization (v3)
- No GitLab/Jira backends (v3/v4)
- No auto-advance / full-auto mode beyond what MVP already supports (v3)
- No session-end, task-completed, worktree-*, config-change, user-prompt-submit, subagent-stop hooks (v3)
- No multi-user support (v4)

---

## Child Epics

| File | Domain | Issue ID Range | Iteration |
|------|--------|---------------|-----------|
| [epic-tui.md](epic-tui.md) | Ink TUI client | DC-TUI-001..DC-TUI-006 | v2.0 |
| [epic-annotation-approval.md](epic-annotation-approval.md) | Annotation-driven approval | DC-APPR-001..DC-APPR-005 | v2.0 |
| [epic-hooks-v2.md](epic-hooks-v2.md) | 7 new hook types | DC-HOOK-006..DC-HOOK-012 | v2.0 |
| [epic-context-v2.md](epic-context-v2.md) | Context monitoring + token budget | DC-CTX-010..DC-CTX-016 | v2.0 |
| [epic-agents-v2.md](epic-agents-v2.md) | 12 additional agents | DC-AGENT-026..DC-AGENT-037 | v2.0 |
| [epic-marketplace.md](epic-marketplace.md) | Skill catalog + discovery | DC-MKT-001..DC-MKT-006 | v2.1 |
| [epic-observability-v2.md](epic-observability-v2.md) | Detail Panel + Timeline + Approval UI | DC-OBS-007..DC-OBS-012 | v2.1 |
| [epic-embeddings.md](epic-embeddings.md) | Semantic embeddings + vector search | DC-EMB-001..DC-EMB-005 | v2.1 |
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
| Marketplace | Skills system (DC-SKILL-001..006) |
| Observability v2 | EventStream (DC-OBS-001), Web UI (DC-WEB-001..007) |
| Embeddings | Memory system (DC-MEM-001..007), tree-sitter tools |
| Config v2 | Config system (DC-CORE-001..004) |
