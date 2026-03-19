# ADR-039 — Async Subagent Execution Pattern

| Field       | Value                                                                 |
|-------------|-----------------------------------------------------------------------|
| Status      | Draft                                                                 |
| Date        | 2026-03-18                                                            |
| Scope       | v2                                                                    |
| References  | ADR-002, ADR-003, ADR-004, ADR-020, ADR-022                           |

### Context

The current dispatcher-first architecture (ADR-002) uses synchronous subagent execution. When the dispatcher delegates to a subagent, it blocks until completion. This works well for LIGHT and MEDIUM tier agents (ADR-004) that complete quickly, but becomes problematic for HEAVY tier agents running complex, long-running tasks.

Problems with sync execution for HEAVY agents:

1. **Dispatcher blocking**: The dispatcher waits minutes or hours for a HEAVY agent to complete, preventing it from handling other tasks or monitoring progress.
2. **No progress visibility**: Users see no updates until the entire task completes.
3. **Crash vulnerability**: If the dispatcher crashes, all in-progress subagent work is lost with no recovery mechanism.
4. **Resource inefficiency**: The dispatcher holds memory and connections idle while waiting.

The solution is an async execution pattern that allows HEAVY agents to run independently while the dispatcher monitors and retrieves results on demand.

### Decision

**Async execution for HEAVY tier agents only.** LIGHT and MEDIUM tiers remain synchronous.

#### 3-Tool Async Pattern

| Tool | Purpose | Returns |
|------|---------|---------|
| `start_job(agent, task, context, options)` | Initiates async subagent execution | `job_id` |
| `check_status(job_id)` | Polls job state | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `get_result(job_id)` | Retrieves final output | Result payload or error details |

#### Execution Flow

```
Dispatcher                          Job Store (SQLite)
    |                                     |
    |-- start_job(code-writer, task) -->|
    |<----------- job_id ---------------|
    |                                     |
    |-- check_status(job_id) ----------->|
    |<----------- "running" ------------|
    |      (polls periodically)           |
    |                                     |
    |-- check_status(job_id) ----------->|
    |<----------- "completed" ----------|
    |                                     |
    |-- get_result(job_id) ------------->|
    |<----------- result payload -------|
```

#### Tier Assignment

| Tier | Execution Mode | Rationale |
|------|----------------|-----------|
| HEAVY | Async | Long-running tasks (code writing, architecture, debugging) that take minutes to hours |
| MEDIUM | Sync | Fast tasks (quick edits, research, utility operations) that complete in seconds |
| LIGHT | Sync | Instant tasks (naming, summaries) that complete immediately |

HEAVY tier agents (ADR-004): `code-writer`, `code-writer-hard`, `architect`, `debugger`, `refactoring-agent`, `creative-thinker`, `frontend-specialist`, `planner-thorough`, `plan-reviewer`, `project-builder`, `code-reviewer-thorough`, `verifier`.

#### Context Inheritance

Subagents launched via `start_job` receive context at initiation. Isolated mode (ADR-020) is preferred for async execution because:

- The parent dispatcher is not maintaining active session state during execution
- Clean separation prevents context drift during long-running jobs
- Reduces memory footprint on the dispatcher

Context is serialized and stored with the job record, then passed to the subagent on execution start.

#### Persistence Model

Jobs are persisted in SQLite (ADR-022) for crash recovery and state inspection:

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | UUID | Unique identifier |
| `agent_name` | string | Agent tier and type |
| `status` | enum | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `task_payload` | JSON | Task description and parameters |
| `context_snapshot` | JSON | Serialized context at job start |
| `result_payload` | JSON | Output data (when completed) |
| `error_details` | JSON | Error info (when failed) |
| `created_at` | timestamp | Job creation time |
| `started_at` | timestamp | Execution start time |
| `completed_at` | timestamp | Execution end time |
| `worktree_path` | string | Git worktree for execution (ADR-003) |

SQLite persistence enables:
- **Crash recovery**: Restart dispatcher, query jobs, resume monitoring
- **Progress tracking**: External tools can query job status via API
- **Audit trail**: Historical record of all async operations

#### Worktree Support

Each async job executes in a dedicated git worktree (ADR-003), enabling:
- Parallel async jobs without file conflicts
- Clean isolation between long-running tasks
- Easy cleanup after job completion

The `worktree_path` is stored in the job record and created by `start_job` before execution begins.

### Consequences

**Positive:**
- Dispatcher remains responsive during long-running HEAVY agent tasks
- Users receive progress updates via status polling
- Crash recovery preserves in-flight work
- Parallel execution of independent HEAVY tasks
- Worktree isolation prevents conflicts between concurrent jobs

**Negative / Trade-offs:**
- Added complexity: 3-tool pattern vs single `call_subagent`
- Polling overhead: Status checks add latency and API calls
- State management: SQLite dependency for job persistence
- Context limitations: Isolated mode may miss recent parent session changes

**Migration notes:**
- Existing sync subagent calls for HEAVY tier should migrate to async pattern
- LIGHT and MEDIUM tiers continue using existing sync pattern
- No changes to agent definitions or prompts required

### Details

#### TypeScript Interfaces

```typescript
// Job status enum
enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Start job request
interface StartJobRequest {
  agent_name: string;           // HEAVY tier agent
  task: TaskPayload;
  context: ContextSnapshot;     // Isolated mode preferred
  options?: {
    timeout_ms?: number;
    priority?: 'low' | 'normal' | 'high';
    worktree_prefix?: string;
  };
}

// Start job response
interface StartJobResponse {
  job_id: string;
  status: JobStatus.PENDING;
  worktree_path: string;
}

// Status check response
interface CheckStatusResponse {
  job_id: string;
  status: JobStatus;
  progress?: number;            // 0-100, optional
  message?: string;             // Human-readable status
  started_at?: string;          // ISO timestamp
  estimated_completion?: string; // ISO timestamp
}

// Result retrieval response
interface GetResultResponse {
  job_id: string;
  status: JobStatus.COMPLETED | JobStatus.FAILED;
  result?: ResultPayload;       // Present if completed
  error?: ErrorDetails;         // Present if failed
  completed_at: string;
  duration_ms: number;
}

// Job record in SQLite
interface JobRecord {
  job_id: string;
  agent_name: string;
  status: JobStatus;
  task_payload: TaskPayload;
  context_snapshot: ContextSnapshot;
  result_payload?: ResultPayload;
  error_details?: ErrorDetails;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  worktree_path: string;
}

// Tool definitions for dispatcher
interface AsyncSubagentTools {
  start_job(request: StartJobRequest): Promise<StartJobResponse>;
  check_status(job_id: string): Promise<CheckStatusResponse>;
  get_result(job_id: string): Promise<GetResultResponse>;
}
```

#### Usage Example

```typescript
// Dispatcher initiates async work
const { job_id } = await tools.start_job({
  agent_name: 'code-writer',
  task: {
    description: 'Implement user authentication',
    files: ['src/auth.ts', 'src/middleware.ts']
  },
  context: {
    mode: 'isolated',
    relevant_files: ['src/types.ts'],
    requirements: ['REQ-001', 'REQ-002']
  }
});

// Dispatcher polls while handling other tasks
let status = await tools.check_status(job_id);
while (status.status === 'running' || status.status === 'pending') {
  await sleep(5000);
  status = await tools.check_status(job_id);
}

// Retrieve final result
const result = await tools.get_result(job_id);
if (result.status === 'completed') {
  // Process result.result
} else {
  // Handle result.error
}
```

#### Job State Machine

```
start_job()
    |
    v
PENDING --> RUNNING --> COMPLETED
    |           |
    |           +-----> FAILED
    |           |
    +-----------------> CANCELLED
```

Transitions:
- `PENDING` → `RUNNING`: When subagent process starts
- `RUNNING` → `COMPLETED`: On successful finish
- `RUNNING` → `FAILED`: On error or exception
- Any → `CANCELLED`: On explicit cancel request

#### Implementation Constraints

- **In-process only**: Job queue runs within the DiriCode process. No external message brokers.
- **SQLite storage**: Job state stored locally per project. No distributed state.
- **HEAVY tier only**: Async pattern rejected for LIGHT and MEDIUM tiers to avoid unnecessary complexity.
- **No LangChain**: Implementation uses native DiriCode patterns, not external orchestration frameworks.
