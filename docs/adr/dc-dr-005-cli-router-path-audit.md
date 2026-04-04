# DC-DR-005 — CLI → Router Path Audit & Gap Fixes

**Issue**: #524  
**Branch**: `feat/dc-dr-005-cli-router-path-verification-#524`  
**Labels**: `area:providers`, `component:diri-router`  
**Status**: Implemented

---

## Routing Path (As-Designed)

```
CLI REPL input
  → HTTP POST localhost:3001/api/v1/execute
  → packages/server: executeRouter
  → Dispatcher.execute()
  → DiriRouter.pick()          ← model selection via CascadeModelResolver
  → DiriRouter.chat()
  → ProviderRouter.generate()  ← retry + fallback chain
  → CopilotProvider.generate() ← concrete LLM call
  → GitHub Copilot API
```

---

## Gaps Found & Fixed

### GAP 1 — CLI never reached the Server

**File**: `apps/cli/src/commands/repl.ts`

`dispatchToAgent()` was a stub generator that printed `[POC] Received: "..."` and returned immediately. No HTTP call was ever made.

**Fix**: Replaced with an `async function*` that POSTs to `http://localhost:${PORT}/api/v1/execute`, reads the `ApiEnvelope` response, and yields the result text. The call site was updated from `for...of` to `for await...of`.

---

### GAP 2 — Dispatcher created without DiriRouter

**File**: `packages/server/src/routes/api/execute.ts`

`createDispatcher()` was called without `diriRouter`, leaving `DispatcherConfig.diriRouter` as `undefined`. All model selection fell back to `ModelConfigResolver` (hardcoded tier→model mapping), bypassing `DiriRouter.pick()`.

**Fix**: A `Registry` is instantiated, `CopilotProvider` is registered with `ProviderPriorities.COPILOT`, a `DiriRouter` is constructed with that registry, and `diriRouter` is passed to `createDispatcher()`.

---

### GAP 3 — Server package missing `@diricode/providers` dependency

**File**: `packages/server/package.json`

The server package did not declare `@diricode/providers` as a dependency, making the imports for GAP 2 impossible without this addition.

**Fix**: Added `"@diricode/providers": "workspace:*"` to `dependencies`.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/cli/src/commands/repl.ts` | `dispatchToAgent()` wired to HTTP `/api/v1/execute` |
| `packages/server/src/routes/api/execute.ts` | `DiriRouter` instantiated and passed to dispatcher |
| `packages/server/package.json` | Added `@diricode/providers` workspace dependency |

---

## What Was Already Working

- `DiriRouter` class — `pick()`, `chat()`, `stream()` fully implemented
- `ProviderRouter` — retry/fallback chain fully implemented
- `Registry` + all provider adapters (Copilot, Kimi, Gemini, ZAI, Minimax)
- Dispatcher — `diriRouter` support was already wired-ready (lines 406–451), just not supplied
- CLI auth commands (`login`, `logout`, `whoami`) — correctly use `@diricode/providers` auth helpers

---

## References

- `packages/providers/src/diri-router.ts` — `DiriRouter` implementation
- `packages/agents/src/dispatcher.ts` — `DispatcherConfig.diriRouter` (optional field, lines 38–53)
- `docs/adr/adr-055-diri-router-unified-package.md` — DiriRouter design ADR
