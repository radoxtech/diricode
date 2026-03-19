# ADR-040 — Tool-Based Agent Discovery

| Field       | Value                                          |
|-------------|------------------------------------------------|
| Status      | Draft                                          |
| Date        | 2026-03-18                                     |
| Scope       | v2                                             |
| References  | ADR-002, ADR-004, ADR-007, ADR-008             |

### Context

The dispatcher prompt currently contains over 40 hardcoded agent descriptions. Each description includes the agent's name, purpose, capabilities, and usage guidelines. This static list consumes excessive tokens on every dispatch request, increasing latency and costs. As the agent roster grows, the problem compounds.

Related concerns:
- The roster and agent definitions evolve independently of the dispatcher prompt
- SKILL.md files define additional capabilities not reflected in the dispatcher
- No mechanism exists for semantic matching of tasks to agents
- Adding a new agent requires editing the dispatcher prompt

### Decision

Replace the hardcoded agent list in the dispatcher with dynamic discovery tools:

1. **Discovery Tools**: The dispatcher gains access to `list_agents()` and `search_agents()` tools instead of a static agent catalog
2. **Local Registry**: A registry indexes agents from TypeScript definitions and SKILL.md files at startup
3. **On-Demand Queries**: The dispatcher queries the registry when routing decisions require agent knowledge

This change is additive. Hardcoded agents remain functional during the transition. The dispatcher can fall back to known agents while gradually adopting discovery-based routing.

### Consequences

- **Positive:**
  - Reduced token usage in dispatcher prompts
  - Centralized agent metadata in the registry
  - Semantic search enables better task-to-agent matching
  - New agents appear automatically without prompt edits
  - SKILL.md capabilities become searchable

- **Negative / Trade-offs:**
  - Additional tool call latency during dispatch
  - Registry must stay synchronized with file changes
  - Requires careful prompt engineering to guide tool usage

- **Migration notes:**
  - Phase 1: Implement registry and tools alongside existing dispatcher
  - Phase 2: Update dispatcher prompt to use discovery tools
  - Phase 3: Remove hardcoded agent descriptions (after validation)

### Details

#### Tool Definitions

**`list_agents(category?: string)`**

Returns agents filtered by optional category. Use when the dispatcher needs to see available agents in a specific domain.

```typescript
interface ListAgentsResult {
  agents: AgentMetadata[];
  total: number;
}
```

**`search_agents(query: string)`**

Performs semantic search across agent names, descriptions, and capabilities. Returns the most relevant agents for a given task description.

```typescript
interface SearchAgentsResult {
  agents: AgentMetadata[];
  scores: number[];  // relevance scores
}
```

#### Registry Interface

The registry indexes two sources:

| Source | Location | Content Indexed |
|--------|----------|-----------------|
| TypeScript Agents | `src/agents/**/*.ts` | Class definitions, `@Agent` decorators, capabilities |
| Skills | `skills/**/SKILL.md` | Frontmatter metadata, description, triggers |

```typescript
interface AgentRegistry {
  // Load and index all agents from disk
  load(): Promise<void>;
  
  // List agents, optionally filtered by category
  list(category?: string): AgentMetadata[];
  
  // Semantic search across all indexed agents
  search(query: string): Array<{ agent: AgentMetadata; score: number }>;
  
  // Get single agent by name
  get(name: string): AgentMetadata | undefined;
}
```

#### Agent Metadata Schema

```typescript
interface AgentMetadata {
  name: string;              // Unique identifier
  description: string;       // One-line purpose statement
  tier: 'system' | 'user';   // System agents are core infrastructure
  category: string;          // Domain grouping (e.g., 'code', 'test', 'deploy')
  capabilities: string[];    // Specific skills this agent provides
  source: 'typescript' | 'skill';  // Origin of this agent definition
  triggers?: string[];       // Keywords that indicate this agent (skills only)
}
```

#### Integration Points

- **Dispatcher**: Gains `list_agents` and `search_agents` in its tool set. Uses these to find candidates for task routing instead of reading from a static list.

- **Roster**: Continues to define agent configurations. The registry reads roster entries to build its index.

- **Agent Definitions**: TypeScript agent classes annotated with metadata. The registry scans these at load time.

- **Skill System**: SKILL.md files contain agent-like capabilities. The registry parses frontmatter and indexes these alongside code-defined agents.

#### Example Usage

```typescript
// Dispatcher decides it needs a code review agent
const candidates = await search_agents("review pull request code quality");
// Returns: [{ name: 'pr-reviewer', score: 0.94 }, { name: 'code-critic', score: 0.71 }]

// Or browse by category
const deployAgents = await list_agents("deploy");
// Returns: [{ name: 'azure-deploy', ... }, { name: 'k8s-rollout', ... }]
```
