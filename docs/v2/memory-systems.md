# Memory Systems (v2 Roadmap)

> **Status**: Research Required — Not yet designed or implemented  
> **Scope**: v2  
> **Last updated**: 2026-03-31

---

## Overview

DiriCode will ship two complementary memory systems in v2:

| System | Purpose | Status |
|--------|---------|--------|
| **ReasoningBank** | Problem-solving memory — stores how agents solved problems | Research required (DC-MEM-001) |
| **MemoryDir** | General knowledge memory — stores facts, preferences, team conventions | Research required (DC-MEM-002) |

These are separate systems with distinct storage mechanisms, retrieval strategies, and integration points. They are complementary, not competing: ReasoningBank records *how* to solve problems, MemoryDir stores *what* was learned.

## ReasoningBank

See: [`docs/adr/adr-045-reasoningbank.md`](../adr/adr-045-reasoningbank.md)

**Format**: Structured records — `{ problem, approach, outcome, confidence, agentType, tags }`  
**Storage**: SQLite + FTS5 + sqlite-vec (semantic embeddings)  
**Integration**: Hook-based (pre-agent injection, post-agent recording)  
**Retrieval**: Semantic similarity + keyword pre-filter

**Research issue**: DC-MEM-001

## MemoryDir

Inspired by Claude Code's `memdir` subsystem. General-purpose memory for facts, user preferences, project patterns, and team knowledge.

**Format**: Flexible (facts, preferences, patterns, team knowledge)  
**Storage**: TBD — file-based or SQLite (research required)  
**Integration**: Explicit API (not hook-based)  
**Retrieval**: Context-aware + keyword + recency

**Research issue**: DC-MEM-002

## Synergy

Both systems will eventually work together:
- ReasoningBank records reasoning patterns from agent problem-solving
- MemoryDir stores team conventions and project-specific facts
- Pattern Recorder (DC-TOOL-018) generates entries for both systems

## Research Plan

Both systems require deep research before design:
1. Clone and analyze reference repositories (see DC-MEM-001, DC-MEM-002 for full lists)
2. Extract patterns, storage schemas, and retrieval mechanisms
3. Design DiriCode-specific architecture
4. Create implementation ADRs

**Estimated timeline**: ~7-9 sprints each (research + design + implementation)

---

*This is a planning placeholder. Implementation details will be added after the research phase is complete.*
