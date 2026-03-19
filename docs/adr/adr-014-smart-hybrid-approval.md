# ADR-014 — Smart Hybrid Approval

| Field       | Value                                         |
|-------------|-----------------------------------------------|
| Status      | Accepted                                      |
| Date        | 2026-03-09                                    |
| Scope       | MVP                                           |
| References  | —                                             |

### Context

Users need control over what agents can do autonomously. A binary "approve everything" / "approve nothing" is too coarse. The approval level also interacts with the Autonomy dimension (ADR-012).

### Decision

**Hybrid approval workflow:** categorize actions by risk, remember user decisions for similar actions.

**Risk categories (MVP):**

| Category | Examples | Behavior |
|----------|----------|----------|
| Safe (auto-approve) | read, search, fetch, list | No confirmation needed |
| Risky (approve) | write, edit, bash, git commit | Ask once, remember for session |
| Destructive (always explicit) | force push, reset --hard, rm -rf, destructive DB ops | Always ask, never remember |

MVP uses a **policy map** (not annotation-driven). Annotation-driven approval (using tool hints from ADR-015) is deferred to v2.

### Consequences

- **Positive:** Safe by default. Users build trust gradually. "Remember" reduces prompt fatigue.
- **Negative:** Policy map must be maintained manually in MVP. v2 annotation-driven approach will be more scalable.

### Addendum — LangChain-Inspired Patterns (2026-03-18)

**wrap_tool_call Integration** (ADR-033)
The approval system is now implemented as a `wrap_tool_call` wrapper, enabling natural composition with other middleware:
```typescript
const safeTool = wrap_tool_call([
  toolCallLimitWrapper,
  toolRetryWrapper,
  approvalWrapper,  // This ADR
  actualTool
]);
```

**Interrupt/Resume Pattern**
When approval is required, the wrapper interrupts execution, persists the pending decision to SQLite (ADR-022), and resumes after the user responds. This formalizes the existing approval flow with explicit state management.

**Composition Example**
The approval wrapper composes naturally with safety wrappers (ADR-027 git safety).
