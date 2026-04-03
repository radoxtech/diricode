# DiriCode — Architecture Decision Records

> All ADRs in English. Consistent with all 13 analysis documents and user decisions.
> Last updated: 2026-04-03

## Index

| ADR | Title | Scope | Group |
|-----|-------|-------|-------|
| [001](adr-001-http-rest-sse-communication.md) | HTTP REST + SSE Communication | MVP | Architecture |
| [002](adr-002-dispatcher-first-agent-architecture.md) | Dispatcher-First Agent Architecture | MVP | Architecture |
| [003](adr-003-unlimited-nesting-loop-detector.md) | Unlimited Nesting with Loop Detector | MVP | Architecture |
| [004](adr-004-agent-roster-3-tiers.md) | 40-Agent Roster with 3 Tiers | MVP | Agent System |
| [005](adr-005-families-model-agent-skill-grouping.md) | Unified Capability Taxonomy (supersedes family grouping) | MVP | Agent System |
| [006](adr-006-agent-config-4-fallback-types.md) | AgentConfig with 4 Fallback Types | MVP | Agent System |
| [007](adr-007-hybrid-agent-definition-agentskills.md) | Hybrid Agent Definition + agentskills.io | MVP | Agent System |
| [008](adr-008-skill-system-agentskills-io.md) | Skill System (agentskills.io SKILL.md) | MVP | Agent System |
| [009](adr-009-jsonc-config-c12-loader.md) | JSONC Config Format with c12 Loader | MVP | Configuration |
| [010](adr-010-dc-project-directory.md) | `.dc/` Project Directory | MVP | Configuration |
| [011](adr-011-4-layer-config-hierarchy.md) | 4-Layer Config Hierarchy | MVP | Configuration |
| [012](adr-012-4-dimension-work-mode-system.md) | 4-Dimension Work Mode System | MVP | Work Modes |
| [013](adr-013-project-pipeline.md) | Project Pipeline: Interview→Plan→Execute→Verify | MVP | Pipeline |
| [014](adr-014-smart-hybrid-approval.md) | Smart Hybrid Approval | MVP | Pipeline |
| [015](adr-015-tool-annotations.md) | Tool Annotations | MVP | Pipeline |
| [016](adr-016-3-layer-context-management.md) | 3-Layer Context Management Architecture | MVP | Context |
| [017](adr-017-condenser-pipeline.md) | Condenser Pipeline (Context Compression) | MVP | Context |
| [018](adr-018-sqlite-index-treesitter-pagerank.md) | SQLite Index with Tree-sitter and PageRank | MVP | Context |
| [019](adr-019-smart-context-per-subtask.md) | Smart Context per Subtask (Architect Agent) | MVP | Context |
| [020](adr-020-sub-agent-context-inheritance.md) | Sub-Agent Context Inheritance (toModelOutput) | MVP | Context |
| [021](adr-021-embeddings-deferred-to-v2.md) | Embeddings Deferred to v2 | v2 | Context |
| [022](adr-022-github-issues-sqlite-timeline.md) | ~~Project Memory: GitHub Issues + SQLite Timeline~~ (Superseded by 048) | MVP | State |
| [023](adr-023-no-snapshot-git-recovery.md) | No Snapshot System (Git-Based Recovery) | MVP | State |
| [024](adr-024-hook-framework-20-types.md) | Hook Framework: 20 Types, 6 MVP, Hybrid Model | MVP+v2+v3 | Hooks |
| [025](adr-025-native-ts-router-fallback-chain.md) | ~~Native TS Router with Fallback Chain~~ (Superseded by 055) | MVP | Router |
| [026](adr-026-prompt-caching-phase-2.md) | Prompt Caching in MVP Phase 2 | MVP Phase 2 | Router |
| [027](adr-027-git-safety-rails.md) | Git Safety Rails | MVP | Safety |
| [028](adr-028-secret-redaction.md) | Automatic Secret Redaction | MVP | Safety |
| [029](adr-029-treesitter-bash-parsing.md) | Tree-sitter Bash Parsing for Safety | MVP | Safety |
| [030](adr-030-mcp-capabilities.md) | MCP Capabilities in MVP | MVP | Tools |
| [031](adr-031-observability-eventstream-agent-tree.md) | Observability: EventStream + Agent Tree UI | MVP+v2 | UI |
| [032](adr-032-web-ui-vite-react-shadcn.md) | Web UI Framework: Vite + React + shadcn/ui | MVP | UI |
| [033](adr-033-interceptor-wrapper-hook-split.md) | Interceptor/Wrapper Hook Split | Draft | MVP |
| [034](adr-034-middleware-execution-order.md) | Middleware Execution Order | Draft | MVP |
| [035](adr-035-tool-call-limit.md) | ToolCallLimit | Draft | MVP |
| [036](adr-036-tool-retry-backoff.md) | ToolRetry | Draft | MVP |
| [037](adr-037-llm-tool-emulator.md) | LLMToolEmulator | Draft | v2 |
| [038](adr-038-llm-tool-selector.md) | LLMToolSelector | Draft | v2 |
| [039](adr-039-async-subagent-pattern.md) | Async Subagent Pattern | Draft | v2 |
| [040](adr-040-tool-based-agent-discovery.md) | Tool-Based Agent Discovery | Draft | v2 |
| [041](adr-041-mcp-web-research-servers.md) | MCP Web Research Server Selection | Accepted | MVP |
| [042](adr-042-multi-subscription-management.md) | Multi-Subscription Model Management | MVP-2+v2+v3 | Router |
| [043](adr-043-llm-skills-loader.md) | LLM-Based Skill Loader and Router | Accepted | MVP |
| [044](adr-044-elo-scoring-ab-testing.md) | Elo Scoring and A/B Testing | v2+v3 | Router |
| [045](adr-045-reasoningbank.md) | ReasoningBank System | MVP | Context |
| [046](adr-046-swarm-coordination.md) | Swarm Coordination | MVP | Architecture |
| [047](adr-047-governance-policy-engine.md) | Governance & Policy Engine | MVP | Pipeline |
| [048](adr-048-sqlite-issue-system.md) | SQLite Issue System (supersedes ADR-022) | MVP | State |
| [049](adr-049-llm-picker.md) | ~~LLM Picker~~ (Superseded by 055) | MVP-2+v2+v3 | Router |
| [051](adr-051-permission-context-engine-phase1.md) | Permission Context Engine: Phase 1 (Core) | MVP-2 | Safety |
| [052](adr-052-permission-context-engine-phase2.md) | Permission Context Engine: Phase 2 (Smart) | v2 | Safety |
| [053](adr-053-router-cost-tracking.md) | Router-Centric Cost Tracking | MVP-2+v2 | Router |
| [054](adr-054-ai-sdk-transport-layer.md) | Vercel AI SDK as Transport Layer | MVP-1 | Router |
| [055](adr-055-diri-router-unified-package.md) | diri-router Unified Package | MVP-1+MVP-2 | Router |

## Template

See [adr-template.md](adr-template.md) for the standard ADR format.
