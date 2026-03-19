# ADR-024 — Hook Framework: 20 Types, 6 MVP, Hybrid Model

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP + v2 + v3                                 |
| References  | analiza-hookow.md (ARCH-003: 15-20 hook types) |

### Context

Hooks enable extensibility without modifying core code. Analysis identified 20 hook types across the full lifecycle. A hybrid execution model (in-process TS for speed + external processes for community extensions) balances performance and flexibility.

### Decision

**20 hook types** released in 3 phases. **Hybrid execution model.**

#### Phase 1 — MVP (6 hooks)

| Hook | Trigger | Use Case |
|------|---------|----------|
| `session-start` | New session begins | Load project context, initialize state |
| `pre-commit` | Before git commit | Lint, format, validate |
| `post-commit` | After git commit | Notify, update issues |
| `error-retry` | Error before retry | Log, modify retry strategy |
| `plan-created` | Plan generated | Review, validate plan |
| `plan-validated` | Plan approved | Trigger execution |

#### Phase 2 — v2 (+7 hooks)

| Hook | Trigger |
|------|---------|
| `pre-tool-use` | Before any tool execution |
| `post-tool-use` | After any tool execution |
| `context-monitor` | Context budget threshold reached |
| `preemptive-compaction` | Before context overflow |
| `rules-injection` | Dynamic rule loading |
| `file-guard` | Before file modification |
| `loop-detection` | Repeated pattern detected |

#### Phase 3 — v3 (+7 hooks)

| Hook | Trigger |
|------|---------|
| `session-end` | Session closes |
| `task-completed` | Task finishes |
| `worktree-create` | New worktree created |
| `worktree-remove` | Worktree removed |
| `config-change` | Configuration modified |
| `user-prompt-submit` | User sends message |
| `subagent-stop` | Sub-agent terminates |

#### Execution Model

| Type | Runtime | Use Case | Latency |
|------|---------|----------|---------|
| In-process TS | Same process | Core hooks, performance-critical | <1ms |
| External process | Spawned subprocess | Community extensions, scripts | ~50-500ms |

#### Safety Rules

- **Silent fail:** Hooks NEVER crash the main process.
- **Timeout:** 3s per hook (configurable).
- **Error handling:** Hook error → silent log + graceful degradation.
- **Automatic DAG:** Hooks declare dependencies. System resolves execution order automatically (no manual priority numbers).

### Consequences

- **Positive:** 20 extension points cover the full agent lifecycle. Phased rollout reduces MVP complexity. Hybrid model satisfies both performance and extensibility.
- **Negative:** DAG resolution adds implementation complexity. External process hooks have higher latency.

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**Interceptor/Wrapper Classification** (ADR-033)
The 20 hook types are now classified into two execution models:

**Interceptors** (Sequential, State Modification):
- session-start, post-commit, plan-created, post-tool-use, context-monitor, rules-injection
- session-end, task-completed, worktree-create, worktree-remove, config-change, subagent-stop

**Wrappers** (Nested, Control Flow):
- pre-commit, error-retry, plan-validated, pre-tool-use, preemptive-compaction
- file-guard, loop-detection, user-prompt-submit

**Execution Order Contract** (ADR-034)
- Interceptors: Registration order (FIFO)
- Wrappers: Nested, first registered = outermost
- After interceptors: Reverse order (LIFO)

**`jump_to` Mechanism**
Hooks can now redirect execution: `jump_to("end")`, `jump_to("tools")`, `jump_to("model")`.
