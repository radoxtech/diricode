# Agent Communication Protocols Research

## Google A2A vs Anthropic MCP and Design Patterns

**Research Date:** March 26, 2026  
**Focus:** Logic patterns, capability negotiation, state passing, and architectural differences

---

## Executive Summary

Two fundamentally different approaches to agent collaboration are emerging:

- **Google A2A (Agent-to-Agent):** A **semantic, goal-oriented** protocol where agents autonomously delegate tasks to peer agents with context negotiation and shared state.
- **Anthropic MCP (Model Context Protocol):** A **structural, capability-oriented** protocol treating servers as standardized "smart peripherals" exposing tools and data through JSON-RPC interfaces.

The key insight: **MCP is for human-centric LLM tool access; A2A is for agent-to-agent autonomy and collaboration.**

---

## 1. Google A2A Protocol Patterns

### 1.1 Capability Discovery & Negotiation

**Pattern: Service Broker with Semantic Matching**

```
Agent A (needs task)
    ↓
Query Broker: "I need agent capable of [semantic intent]"
    ↓
Broker returns: List of candidate agents with metadata
    ↓
Agent A evaluates: Capability score, cost, latency, reliability
    ↓
Agent A invokes: Selected agent with task parameters
```

**Key Characteristics:**

- Agents register with **Intent-based metadata** (not just "I can run function X")
  - Example: `{ intent: "process_structured_data", input_formats: ["pdf", "docx"], output_types: ["json", "markdown"], reliability: 0.95, latency_p95_ms: 500 }`
- Discovery is **dynamic** — agents can come online/offline
- Negotiation includes **resource constraints** (budget, token limits, time deadlines)

**Why different from RPC:**

- RPC assumes the caller knows exactly which function to call
- A2A allows agents to discover and select based on semantic intent, enabling plug-and-play delegation

---

### 1.2 Task Delegation Model

**Pattern: Goal-Oriented Delegation with Constraints**

Instead of: `result = function_call(args)`  
A2A uses:

```json
{
  "goal": "Process and analyze customer feedback from Q1 2026",
  "constraints": {
    "max_tokens": 50000,
    "deadline_ms": 30000,
    "safety_level": "high",
    "budget": 10.0
  },
  "context": {
    "user_preferences": {...},
    "previous_results": {...},
    "shared_state": {...}
  },
  "definition_of_done": "Return structured insights with confidence scores"
}
```

**Key Patterns:**

1. **Backpressure/Resource Awareness:** Sub-agent can decline if constraints can't be met

   ```json
   {
     "status": "DECLINED",
     "reason": "deadline too aggressive for data volume",
     "counter_offer": { "deadline_ms": 45000 }
   }
   ```

2. **Hierarchical Delegation:** Agent B can further delegate to Agent C if needed
   - Enables task decomposition without returning control to A
   - A2A tracks delegation chains for accountability

3. **Partial Results with Streaming:** Agent can stream intermediate results
   - Allows parent to begin processing while child continues
   - Reactive pattern: parent can send feedback/adjustments mid-task

---

### 1.3 Context & State Passing

**Pattern: Contextual Envelopes with Shared State**

```
┌─────────────────────────────────────────┐
│ Contextual Envelope (Passed Between Agents)
├─────────────────────────────────────────┤
│ 1. Conversation History              │
│    - Previous turns (conversation_id) │
│    - Relevant snippets (not full)     │
│                                       │
│ 2. User Profile / Preferences         │
│    - Language, timezone, accessibility │
│    - Past choices / style             │
│                                       │
│ 3. Common Operating Picture (COP)    │
│    - Shared mutable state             │
│    - Facts agreed upon by agents      │
│    - Versioning for consistency       │
│                                       │
│ 4. Authorization Context              │
│    - User identity, scopes, TTL       │
│    - Delegation token (if sub-agent)  │
│                                       │
│ 5. Trace/Telemetry                    │
│    - Request ID (for correlation)     │
│    - Parent agent reference           │
│    - Depth counter (prevent loops)    │
└─────────────────────────────────────────┘
```

**Why different from RPC:**

- RPC passes only parameters needed for function execution
- A2A passes rich context so agents can make intelligent decisions, understand intent, and maintain consistency across multi-agent workflows

**Example Context Passing:**

```json
{
  "conversation_id": "conv_12345",
  "user_preferences": {
    "language": "en",
    "style": "technical_but_concise"
  },
  "cop": {
    "version": 3,
    "facts": [
      { "key": "customer_segment", "value": "enterprise", "confidence": 0.98 },
      { "key": "prior_issue_resolved", "value": true, "reference": "ticket_789" }
    ]
  },
  "auth": {
    "user_id": "user_42",
    "scopes": ["read:customer_data", "write:support_tickets"],
    "delegation_token": "dt_xyz..."
  },
  "trace": {
    "request_id": "req_987",
    "parent_agent": "orchestrator_v2",
    "depth": 2,
    "max_depth": 5
  }
}
```

---

### 1.4 Artifact Exchange Patterns

**Pattern: Reference-Based Exchange (Pointers, Not Copies)**

Instead of passing 10MB file as Base64:

```json
// WRONG: Bloats messages
{ "pdf_content": "JVBERi0x..." } // Full 10MB encoded
```

A2A uses:

```json
// RIGHT: Reference-based
{
  "artifact": {
    "type": "file",
    "uri": "gs://bucket/customer_feedback_q1_2026.pdf",
    "signed_url": "https://storage.googleapis.com/...",
    "ttl_seconds": 3600,
    "metadata": {
      "size_bytes": 10485760,
      "format": "application/pdf",
      "checksum": "sha256:abc123..."
    }
  }
}
```

**Key Patterns:**

1. **Signed URLs with TTL:** Temporary access without long-term credentials
2. **Metadata-first:** Agents can decide whether to fetch based on size/type
3. **Streaming-friendly:** Large artifacts can be streamed through standard storage APIs
4. **Multiple representations:**
   ```json
   {
     "artifact": {
       "primary": { "uri": "gs://...", "format": "pdf" },
       "converted": { "uri": "gs://...", "format": "markdown" },
       "summary": { "uri": "gs://...", "format": "json" }
     }
   }
   ```

**Why different from RPC:**

- RPC typically encodes data inline (JSON, Base64, etc.)
- A2A recognizes that agents may operate on streaming/large data and need efficient reference mechanisms

---

### 1.5 Streaming & Notification Patterns

**Pattern: Reactive Streams with Feedback Loops**

```
Agent A (delegator)
    ↓ sends goal
Agent B (worker)
    ↓ streams: START
    ├─ event: "processing_phase_1" (progress)
    ├─ event: "need_clarification" (blocking)
    ├─ event: "intermediate_result" (partial data)
    ├─ event: "completion" (final result)
    └─ event: "error_recovery" (tried 3 strategies, trying 4th)
    ↑ Agent A can send feedback/corrections mid-stream
```

**Key Patterns:**

1. **Structured Event Streaming:**

   ```json
   {
     "stream_event": {
       "type": "progress",
       "phase": "data_extraction",
       "completion_percent": 45,
       "eta_ms": 2000,
       "checkpoint": "processed 1000 of 2200 records"
     }
   }
   ```

2. **Interactive Feedback:**

   ```json
   // Agent A can interrupt and provide feedback
   {
     "feedback": {
       "type": "clarification",
       "message": "Skip records older than Q1, not the entire Q4"
     }
   }
   ```

3. **Thinking/Reasoning Transparency:**
   ```json
   {
     "stream_event": {
       "type": "thinking",
       "content": "I tried approach 1 (simple regex) - too many false positives. Now trying approach 2 (ML model)..."
     }
   }
   ```

**Why different from RPC:**

- RPC is request-response (blocking)
- A2A assumes long-running tasks need progress visibility and course-correction capability

---

## 2. Anthropic Model Context Protocol (MCP)

### 2.1 Architecture Overview

```
┌──────────────────┐
│   MCP Host       │  (e.g., Claude Desktop, IDE Plugin)
│  (has LLM)       │
└────────┬─────────┘
         │ JSON-RPC 2.0 (stdio, HTTP, SSE)
┌────────v─────────┐
│   MCP Client     │  (Router/Gateway)
└────────┬─────────┘
         │ JSON-RPC 2.0
         │
    ┌────┴────┬──────────┬─────────┐
    │          │          │         │
┌───v──┐  ┌──v──┐  ┌───v─┐  ┌──v──┐
│Server│  │Srv 2│  │Srv 3│  │Srv N│  (Multiple backends)
│      │  │     │  │     │  │     │  - Databases
│Capa: │  │Capa:│  │Capa:│  │Capa:│  - APIs
│Tools │  │Res  │  │Prpt │  │Res  │  - Local files
│      │  │     │  │     │  │     │  - Custom logic
└──────┘  └─────┘  └─────┘  └─────┘
```

### 2.2 Logical Primitives

**Three main constructs:**

#### **Tools (Functions)**

```json
{
  "type": "tool",
  "name": "query_database",
  "description": "Execute SQL query against customer database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "timeout_ms": { "type": "integer" }
    },
    "required": ["query"]
  }
}
```

#### **Resources (Data Sources)**

```json
{
  "type": "resource",
  "uri": "file:///data/customer_feedback.json",
  "name": "customer_feedback",
  "description": "Latest customer feedback from Q1 2026",
  "mimeType": "application/json"
}
```

#### **Prompts (Interaction Templates)**

```json
{
  "type": "prompt",
  "name": "analyze_sentiment",
  "description": "Template for analyzing customer sentiment",
  "arguments": [{ "name": "text_to_analyze", "description": "Customer message or review" }],
  "content": "Analyze the sentiment of the following text, considering tone and context..."
}
```

### 2.3 Capability Negotiation

**Pattern: Handshake during `initialize`**

```
Host → Client:
{
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {}
    }
  }
}

Client → Host:
{
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {},
      "logging": {}
    },
    "serverInfo": {
      "name": "my-server",
      "version": "1.0.0"
    }
  }
}
```

**Key Characteristics:**

- **Version negotiation:** Both sides agree on protocol version
- **Feature flags:** Capabilities object indicates supported features
- **One-time discovery:** Capabilities are determined at init, not dynamic
- **Schema-based:** Tools/Resources are JSON Schema (OpenAPI-like)

---

### 2.4 Request/Response Flow

```json
// Host → Client → Server
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "query_database",
    "arguments": {
      "query": "SELECT * FROM customers WHERE segment='enterprise'",
      "timeout_ms": 5000
    }
  }
}

// Server → Client → Host (response)
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "type": "text",
    "text": "[{\"id\": 1, \"name\": \"Acme Corp\", ...}]"
  }
}
```

---

## 3. Detailed Comparison Table

| Aspect                   | Google A2A                                         | Anthropic MCP                   |
| ------------------------ | -------------------------------------------------- | ------------------------------- |
| **Abstraction Level**    | Semantic (goals/intents)                           | Structural (tools/schemas)      |
| **Primary Use Case**     | Agent-to-agent autonomy                            | LLM-to-tool access              |
| **Discovery Mechanism**  | Dynamic broker/registry                            | Static handshake                |
| **State Model**          | Shared mutable state (COP)                         | Session-based (host context)    |
| **Negotiation**          | Goal feasibility, resource constraints             | Version/capability flags        |
| **Data Exchange**        | URI references (signed URLs)                       | Inline JSON or Base64           |
| **Flow Control**         | Backpressure, decline capability                   | Timeout/rate limiting           |
| **Streaming**            | Native (events, feedback loops)                    | Polling or SSE (not built-in)   |
| **Auth Model**           | IAM / delegation tokens                            | Transport layer (bearer tokens) |
| **Error Handling**       | Sub-agent tries multiple strategies                | Exception/error response        |
| **Transparency**         | Thinking process streamed                          | Implicit (not exposed)          |
| **Latency Expectations** | Multi-second (goals)                               | Sub-second (tool calls)         |
| **Artifact Handling**    | Reference-based (pointers)                         | Inline (Base64 or JSON)         |
| **Delegation Depth**     | Tracked (prevents loops)                           | Single hop (host → server)      |
| **Context Richness**     | Rich (conversation, preferences, COP, auth, trace) | Minimal (session scope only)    |

---

## 4. Key Architectural Differences from RPC/Function Calling

### 4.1 Autonomy & Decision-Making

**RPC:**

```
Caller: "Execute function X with args [a, b, c]"
Callee: Execute and return result
→ No room for negotiation or intelligent refusal
```

**A2A:**

```
Delegator: "Achieve goal G with constraints C"
Agent:
  - Evaluate if goal is achievable
  - Propose counter-offer if constraints too tight
  - May decompose into sub-goals
  - Try multiple strategies on failure
  - Stream progress and request feedback
→ Agents are decision-makers, not just executors
```

### 4.2 Context Richness & Consistency

**RPC:** Parameters only  
**A2A:** Parameters + conversation history + user preferences + shared facts + authorization + trace

This enables:

- Agents understand _why_ a task was requested
- Consistency across multi-step workflows
- Better error recovery (context helps agents understand what went wrong)

### 4.3 Streaming & Reactivity

**RPC:** Blocking request-response  
**A2A:** Streaming events with interactive feedback

Enables:

- Progress visibility for long tasks
- Course-correction mid-execution
- Real-time collaboration
- Transparency into reasoning (for explainability)

### 4.4 Resource Management

**RPC:** Caller responsible for resource limits  
**A2A:** Agents negotiate and respect constraints

- Agents know their token budgets, latency limits, financial constraints
- Can decline tasks or propose alternatives
- Prevents runaway delegation chains

---

## 5. Patterns Worth Adopting in Internal Protocols

### 5.1 Intent-Based Discovery

Rather than: "Here's a function you can call"  
Use: "Here's what I'm trying to achieve; pick the best agent for it"

**Implementation Pattern:**

```python
# Agent registers capability
agent.register_capability(
    intent="process_documents",
    input_formats=["pdf", "docx"],
    reliability=0.95,
    latency_p95_ms=500,
    cost_per_unit=0.10
)

# Delegator discovers
candidates = registry.find(
    intent="process_documents",
    input_format="pdf",
    budget=5.0
)
best_agent = max(candidates, key=lambda a: a.reliability / a.latency)
```

### 5.2 Contextual Envelopes

Always pass more than just parameters:

```python
envelope = {
    "goal": "...",
    "context": {
        "conversation_id": "...",
        "user_preferences": {...},
        "shared_state": {...},  # <-- COP pattern
        "auth": {...},
        "trace": {...}
    },
    "constraints": {
        "deadline_ms": 30000,
        "max_tokens": 50000,
        "budget": 10.0
    }
}
```

### 5.3 Reference-Based Artifact Exchange

For anything large, pass a pointer not a copy:

```python
artifact = {
    "uri": "s3://bucket/file.pdf",
    "signed_url": "https://...",  # temp access
    "ttl_seconds": 3600,
    "metadata": {
        "size_bytes": 10485760,
        "checksum": "sha256:abc..."
    },
    "alternatives": {  # Optional: pre-converted formats
        "markdown": "s3://bucket/file.md"
    }
}
```

### 5.4 Streaming with Feedback Loops

Don't block on long-running tasks:

```python
# Instead of: result = agent.process(goal)
# Use streaming:

for event in agent.stream(goal):
    if event.type == "need_clarification":
        feedback = get_user_input()
        agent.send_feedback(feedback)
    elif event.type == "intermediate_result":
        process_early(event.data)  # Start processing while agent continues
    elif event.type == "completion":
        return event.result
```

### 5.5 Negotiation & Backpressure

Allow agents to decline and counter-offer:

```python
response = agent.try_delegating(goal, constraints)

if response.status == "DECLINED":
    # Agent says "I can't do it with these constraints"
    adjusted = adjust_constraints(response.counter_offer)
    response = agent.try_delegating(goal, adjusted)
elif response.status == "ACCEPTED":
    # Proceed with streaming or polling
    ...
```

### 5.6 Shared State (Common Operating Picture)

Maintain consistency across agents:

```python
cop = {
    "version": 3,
    "facts": [
        {"key": "customer_type", "value": "enterprise", "confidence": 0.98},
        {"key": "region", "value": "US-EAST-1", "source": "agent_auth"}
    ]
}

# When agent updates shared state, increment version
agent.update_cop(key="analysis_complete", value=True, version=3)
# Other agents see cop.version = 4
```

---

## 6. Protocol Comparison Summary

### Google A2A Strengths

✅ **Autonomy:** Agents make intelligent decisions  
✅ **Scalability:** Dynamic discovery for large agent fleets  
✅ **Context-aware:** Rich state sharing enables intelligent workflows  
✅ **Efficiency:** Reference-based artifacts avoid bloat  
✅ **Transparency:** Streaming reasoning enables debugging  
✅ **Resilience:** Negotiation and backpressure prevent cascade failures

### Google A2A Weaknesses

❌ **Complexity:** More infrastructure (broker, shared state store)  
❌ **Latency:** Negotiation adds overhead  
❌ **Standardization:** Not yet a formal open standard  
❌ **Debugging:** Distributed workflows harder to trace

### Anthropic MCP Strengths

✅ **Simplicity:** JSON-RPC is straightforward  
✅ **Standardization:** Published spec, working implementations  
✅ **Low-latency:** Minimal overhead  
✅ **Clear contracts:** JSON Schema for tools/resources  
✅ **Tool-first:** Works great for exposing APIs/databases to LLMs  
✅ **Ready-to-use:** Claude already supports MCP

### Anthropic MCP Weaknesses

❌ **Limited autonomy:** Agents can't decline or negotiate  
❌ **Single-hop:** Can't chain MCP servers  
❌ **Stateless:** No shared context between calls  
❌ **Latency-bound:** Assumes sub-second operations  
❌ **No streaming:** Progress visibility is hard  
❌ **Not agent-centric:** Designed for human + LLM, not agent-to-agent

---

## 7. Recommendations for Internal Agent Delegation Protocol

### 7.1 Hybrid Approach: "A2A-Lite"

Combine A2A philosophy with MCP simplicity:

**For immediate implementation:**

- Adopt **intent-based capability registration** (A2A pattern)
- Use **contextual envelopes** with conversation + user context + shared state (A2A pattern)
- Support **streaming results** with progress events (A2A pattern)
- Keep **JSON-RPC schema** for simplicity (MCP pattern)
- Add **negotiation/backpressure** via response codes (A2A pattern)

**Example protocol message:**

```json
{
  "jsonrpc": "2.0",
  "id": "req_123",
  "method": "delegate_task",
  "params": {
    "goal": "Analyze customer feedback for Q1 2026",
    "constraints": {
      "deadline_ms": 30000,
      "budget": 10.0
    },
    "context": {
      "conversation_id": "conv_456",
      "user_preferences": { "style": "technical" },
      "shared_state": {
        "customer_segment": "enterprise",
        "region": "US-EAST-1"
      },
      "trace": { "request_id": "req_123", "depth": 2 }
    }
  }
}
```

### 7.2 Capability Registry Design

```python
@dataclass
class AgentCapability:
    intent: str  # "analyze_text", "process_documents", etc.
    input_types: List[str]  # ["text", "pdf", "json"]
    output_type: str  # "json", "markdown"

    # Quality metrics (for selection)
    reliability: float  # 0-1, success rate
    latency_p95_ms: int  # 95th percentile latency
    cost_per_unit: float  # $ per execution

    # Constraints
    max_input_size_bytes: int
    max_concurrent: int

    # Metadata
    version: str
    tags: List[str]  # ["beta", "experimental", etc.]
```

### 7.3 Long-Term: Consider MCP as Foundation

If you're building for external integrations:

- **Start with MCP** for simplicity and compatibility
- **Layer A2A patterns** on top (context, negotiation)
- **Extend MCP capabilities** object as needed

If you're building internal-only:

- Implement **A2A-Lite** from scratch (simpler than full A2A, more powerful than MCP)
- Focus on: discovery, context passing, streaming, negotiation

---

## 8. Additional Resources & References

- **MCP Official Docs:** https://modelcontextprotocol.io/
- **MCP Specification:** https://modelcontextprotocol.io/specification/latest
- **Google Vertex AI Agent Engine:** Uses A2A-like patterns for multi-agent orchestration
- **OpenAI Function Calling vs Agents:** See distinctions between stateless function calling and agentic workflows

---

## Conclusion

**A2A and MCP are fundamentally solving different problems:**

- **MCP:** "How do I expose tools/data to an LLM efficiently?"  
  → Answer: Standardized JSON-RPC with capability negotiation
- **A2A:** "How do autonomous agents collaborate, negotiate, and share context?"  
  → Answer: Goal-oriented delegation, semantic discovery, shared state, streaming feedback

**For your internal protocol, the winning strategy is:**

1. **Adopt A2A's philosophy** (autonomy, negotiation, context-richness, transparency)
2. **Keep MCP's simplicity** (JSON-RPC, schema-based contracts)
3. **Add streaming** (progress visibility, feedback loops)
4. **Add shared state** (Common Operating Picture pattern)
5. **Add discovery** (intent-based agent selection)

This gives you a powerful, scalable agent coordination system without the complexity of a full A2A implementation.
