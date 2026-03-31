# Permission Context Engine (v2 Roadmap)

> **Status**: Phase 1 accepted for MVP-2, Phase 2 planned for v2  
> **Scope**: MVP-2 (Phase 1) + v2 (Phase 2)  
> **Last updated**: 2026-03-31

---

## Overview

The Permission Context Engine extends DiriCode's safety system to support context-aware permission decisions across multiple execution modes.

## Phase 1 — Core (MVP-2)

See: [`docs/adr/adr-051-permission-context-engine-phase1.md`](../adr/adr-051-permission-context-engine-phase1.md)

**Delivers**:
- Four context handlers: `CoordinatorHandler`, `InteractiveHandler`, `SwarmWorkerHandler`, `DefaultHandler`
- Four permission levels: `always-allow`, `auto-allow`, `ask`, `never-allow`
- SQLite-backed audit logging of all permission decisions

**Issues**: DC-SAFE-006a, DC-SAFE-006b, DC-SAFE-006c  
**Epic**: `docs/mvp/epic-safety.md`

## Phase 2 — Smart Features (v2)

See: [`docs/adr/adr-052-permission-context-engine-phase2.md`](../adr/adr-052-permission-context-engine-phase2.md)

**Delivers**:
- Prefix-level and pattern blocking (block entire tool categories)
- `/permissions` management command
- Cross-session learning (detect and suggest based on past decisions)
- Semantic risk analysis (AST-grep integration for risk scoring)

**Issues**: DC-SAFE-006d, DC-SAFE-006e, DC-SAFE-006f, DC-SAFE-006g

## Context Types

| Context | Description | Default for risky ops |
|---------|------------|----------------------|
| **Interactive** | User at keyboard | Always ask |
| **Coordinator** | Orchestrating sub-agents | Ask for destructive, auto for risky |
| **SwarmWorker** | Background autonomous agent | Ask for destructive, auto for risky |
| **Default** | Fallback | Preserves DC-SAFE-005 behavior |

## Permission Levels

| Level | Behavior |
|-------|---------|
| `always-allow` | Never prompt, execute immediately |
| `auto-allow` | Prompt once per session, remember |
| `ask` | Prompt every time |
| `never-allow` | Always block, no override |

---

*Phase 1 is in active planning for MVP-2. Phase 2 is roadmap intent for v2.*
