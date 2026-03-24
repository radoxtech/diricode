## ADR-046 — Swarm Coordination

| Field       | Value                                                                           |
|-------------|---------------------------------------------------------------------------------|
| Status      | Accepted                                                                        |
| Date        | 2026-03-23                                                                      |
| Scope       | MVP                                                                             |
| References  | ADR-002 (dispatcher), ADR-003 (nesting), ADR-039 (async subagent), Survey Decision A2 |

### Context

ADR-002 establishes DiriCode's dispatcher-first architecture. The dispatcher is the orchestrating agent — it routes work to specialized sub-agents and collects results. As documented in ADR-039, HEAVY tier agents already run asynchronously: the dispatcher starts a job, polls for completion, and retrieves the result.

This is still a fundamentally sequential model: one dispatcher, one chain of agents, one task at a time per chain. For single, focused tasks that maps well. For large, multi-faceted work — rewriting a module that spans a dozen files, implementing a feature that cuts across three packages, auditing a codebase for security issues — it does not.

The problem with sequential execution at scale:

- **Throughput.** A task that touches 10 independent areas takes 10× longer to complete sequentially than in parallel. Real work has irreducible parallel structure.
- **User interruptions.** When an agent hits a genuine ambiguity, it has two options under the current model: block (interrupt the user now) or make an assumption (proceed without the user). Neither is ideal. When there are 10 agents working in parallel, each with its own question, a user could be interrupted 10 separate times in an hour. That defeats the autonomy goal.
- **Redundant discovery.** Agent A may discover that a particular import path is wrong. Agent B, working a related file, has no way to know this and may spend time on the same investigation — or make an incompatible fix.

Existing frameworks have addressed similar problems with different approaches. OpenAI's Swarm (2024) uses context variables passed between agents during handoffs — but it is stateless by design, with no persistent shared memory. CrewAI supports parallel task execution within a crew but ties coordination tightly to its own task model. Microsoft AutoGen's GroupChat and concurrent agent patterns (v0.4 GraphFlow API) enable parallel execution, but the shared state model has write-contention problems when many agents modify overlapping keys simultaneously. None of these frameworks fit DiriCode's model directly: DiriCode already has its own dispatcher, its own async execution model (ADR-039), and its own worktree isolation (ADR-003).

Swarm coordination in DiriCode is not a replacement for any of these frameworks. It is a specific extension of the existing dispatcher model to support N parallel agent sessions that share context and buffer questions for the user.

### Decision

**The dispatcher can create a swarm: a group of N parallel agent sessions working on related subtasks of the same top-level task.**

Swarms are created by the dispatcher when it determines that a task has parallel structure — multiple independent areas of work that can proceed simultaneously without requiring each other's output. The dispatcher acts as the swarm coordinator throughout execution.

#### Swarm Structure

A swarm consists of:

1. **The dispatcher** — remains the single coordinator. It creates the swarm, assigns subtasks to members, monitors progress, collects results, and determines when the swarm is complete.
2. **N agent sessions (swarm members)** — each runs an assigned subtask independently. Each member is a normal async job (ADR-039), running in its own git worktree (ADR-003).
3. **A shared context bus** — a key/value store scoped to the swarm's lifetime. Members can publish discoveries; other members can read them.
4. **An async question queue** — members buffer questions for the user instead of interrupting immediately. Questions accumulate in a shared queue. The dispatcher delivers them in a batch when a threshold is reached or a timer fires.

#### Shared Context Bus

The context bus is a lightweight append-only key/value store scoped to a single swarm:

- Members publish discoveries via `publish_context(key, value)`.
- Members read existing context via `read_context(key)` or `list_context()`.
- The dispatcher can also publish context (e.g., clarifications from the user that all members should see).
- Entries are timestamped and attributed to the publishing agent.
- The bus is stored in SQLite alongside the job records from ADR-039.

The bus is not a message-passing channel. It does not support subscriptions or push notifications — agents pull context when they need it. This keeps the implementation simple and avoids the write-contention problems that arise when many agents write to shared state simultaneously. Reads are cheap; writes are infrequent (a member publishes a discovery, not every intermediate state).

#### Async Question Queue

Agents currently have two options when they hit genuine ambiguity: interrupt the user or make an assumption. The question queue provides a third option: buffer the question.

When a swarm member needs user input but is not completely blocked:

1. The agent calls `buffer_question(question, context, can_proceed_without_answer)`.
2. The dispatcher collects the question in the swarm's question queue.
3. If `can_proceed_without_answer` is true, the agent states its best assumption and continues working.
4. If `can_proceed_without_answer` is false, the agent parks the subtask and the dispatcher assigns it other work if available.
5. The dispatcher batches questions and delivers them to the user when:
   - The queue reaches a configurable threshold (default: 3 questions), or
   - A timer fires (default: 10 minutes), or
   - All non-blocked subtasks are complete.
6. The user answers all questions at once. The dispatcher distributes the answers back to the relevant agents, which resume from where they parked.

This directly mirrors DiriCode's stated goal from the README: "Enough questions buffered? → asks you all at once."

#### Agent Isolation

Each swarm member runs in a dedicated git worktree (ADR-003 already supports this via the `worktree_path` field in job records). Members work on their assigned subtasks within their own worktree. They do not have direct file access to other members' worktrees.

This is intentional. File isolation prevents two members from simultaneously modifying the same file. The trade-off is that a member cannot read another member's in-progress changes — only published context bus entries. For the MVP use case (members work on different areas of the codebase), this is the right default.

#### Conflict Detection

Before the dispatcher merges swarm results, it runs a conflict check:

1. Collect the list of files modified by each member (from git status in each worktree).
2. Compute the intersection — files touched by more than one member.
3. If the intersection is non-empty, report the overlapping files and members to the user before attempting a merge.
4. The user decides: let the merge proceed, assign a reconciliation task to one of the members, or discard one of the conflicting changes.

The dispatcher does not automatically resolve content conflicts. It detects them and surfaces them to a human. Content-level merge strategies are an implementation detail deferred beyond MVP.

#### Swarm Lifecycle

```
dispatcher creates swarm
    |
    +-- assigns subtask to member A (start_job → job_id_A, worktree_A)
    +-- assigns subtask to member B (start_job → job_id_B, worktree_B)
    +-- assigns subtask to member C (start_job → job_id_C, worktree_C)
    |
    members run in parallel
    |
    +-- members publish to context bus
    +-- members buffer questions to queue
    |
    dispatcher batches questions → user answers → dispatcher distributes answers
    |
    all members complete
    |
    dispatcher runs conflict detection
    |
    +-- no conflicts → merge all worktrees → done
    +-- conflicts found → report to user → resolve → merge
```

#### Relationship to Existing ADRs

- **ADR-002** — The dispatcher remains the sole orchestrator. Swarms do not introduce peer-to-peer agent communication; members cannot spawn other swarm members.
- **ADR-003** — Unlimited nesting still applies. A swarm member can itself use the async subagent pattern (ADR-039) to delegate to further sub-agents. The loop detector still operates per-session.
- **ADR-039** — Swarm members are async jobs in the existing sense. The `start_job` / `check_status` / `get_result` interface is unchanged. The swarm adds coordination on top of individual jobs, not a replacement for the job model.

#### What This Is Not

Swarm coordination is not a general multi-agent framework. DiriCode does not adopt:

- Peer-to-peer agent messaging (agents cannot call each other directly)
- A central group chat or message broadcast channel
- LLM-mediated speaker selection (AutoGen GroupChat-style)
- Handoff chains between agents (OpenAI Swarm-style task routing)
- Shared mutable state that all agents write to concurrently

These patterns introduce coordination complexity that is not justified by DiriCode's use case. The dispatcher already knows what each member is working on. The context bus is for sharing discovered facts, not for workflow control.

### Consequences

- **Positive:**
  - Parallel execution reduces wall-clock time on tasks with independent structure.
  - The async question queue means the user handles 3-5 batched questions instead of 3-5 separate interruptions. Agent autonomy improves without sacrificing accuracy on ambiguous decisions.
  - Shared context bus prevents redundant investigation — if one member discovers a relevant fact, all members can benefit from it.
  - Conflict detection surfaces integration problems before a merge attempt, giving the user a meaningful decision point rather than a git conflict dump.
  - The swarm model is additive. The existing dispatcher, async job model, and worktree isolation all continue to work unchanged for non-swarm tasks.

- **Negative / Trade-offs:**
  - Conflict detection increases complexity of the dispatcher's result-collection phase. The dispatcher must enumerate modified files across multiple worktrees.
  - The context bus introduces a shared state surface. Poorly behaved members that publish noisy or incorrect context can affect all other members. Content validation is not enforced at the bus level.
  - Debugging a failed swarm is harder than debugging a single agent chain. A problem in member B may only manifest in member C's output.
  - The question queue requires the dispatcher to track which questions came from which agent and route answers correctly. Incorrect routing (sending an answer to the wrong agent) produces silent errors.
  - SQLite write coordination: context bus and question queue records must be written safely from parallel processes. Row-level SQLite locking is sufficient for the access pattern described (infrequent writes, many reads), but requires attention in the implementation.

- **Migration notes:**
  - No migration required for existing single-agent tasks. Swarm creation is explicit — the dispatcher must choose to create a swarm.
  - The ADR-039 job schema gains two new optional fields: `swarm_id` (links a job to a swarm) and `swarm_role` (descriptive label for the member's subtask). Existing job records with null `swarm_id` are treated as standalone jobs.
