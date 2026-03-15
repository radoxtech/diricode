# DiriCode — Cross-Cutting Conventions

> Standards and conventions that apply across ALL packages and epics.
> Every issue implicitly inherits these rules.

---

## TypeScript Conventions

- **Strict mode**: `strict: true` in all tsconfig.json
- **ESM only**: All packages use ESM (`"type": "module"`)
- **Barrel exports**: Each package has `src/index.ts` re-exporting public API
- **No `any`**: Use `unknown` + type guards instead
- **Zod for runtime validation**: All external data (config, API responses, LLM output) validated with Zod
- **Naming**: camelCase for variables/functions, PascalCase for types/classes, kebab-case for files

## Error Handling

- **Result pattern for expected failures**: Functions return `Result<T, E>` (or throw only for truly unexpected errors)
- **Typed errors**: Each package defines its own error enum (e.g., `RouterError`, `ToolError`, `AgentError`)
- **Error context**: Every error includes `{ code, message, context, cause? }`
- **No swallowed errors**: All catch blocks either re-throw, log+return, or escalate
- **Hook errors are silent**: Hooks follow silent-fail pattern (ADR-024) — log + continue, never crash pipeline

## Logging

- **Structured JSON logs** via a shared logger (pino or similar)
- **Correlation IDs**: Every request gets a `traceId` propagated through agents and tools
- **Log levels**: error, warn, info, debug, trace
- **Agent context**: Every log entry includes `{ agentId, taskId, traceId }`
- **No `console.log`** in production code — use the logger

## EventStream Conventions

- **Event naming**: `domain.action` format (e.g., `agent.started`, `tool.executed`, `pipeline.phase-changed`)
- **Zod schema per event type**: Every event has a typed Zod schema in `@diricode/core`
- **Immutable events**: Events are append-only, never modified after emission
- **Timestamp**: ISO 8601, always present
- **Parent references**: Events include `parentSpanId` for tree reconstruction

## Package Boundary Rules

- **No circular imports**: Enforced by Turborepo build order
- **Dependency direction**: `cli → server → core → {tools, memory, providers}`
- **Core is the hub**: All packages depend on `@diricode/core` for types and interfaces
- **No direct SQLite access** from outside `@diricode/memory` — use the memory API
- **No direct GitHub API calls** from outside `@diricode/memory` — use the issues abstraction
- **Tools are stateless**: `@diricode/tools` functions are pure — no side effects beyond the file system operation

## Testing Conventions

- **Test framework**: Vitest for all packages
- **Test file location**: `src/__tests__/` mirror of source structure
- **Test naming**: `{module}.test.ts`
- **Mock providers**: Shared mock LLM responses in `packages/test-utils/`
- **No network calls in unit tests**: All provider calls mocked
- **Deterministic tests**: No randomness, no time-dependent assertions

## Git Conventions

- **Commit message format**: `type(scope): description` (conventional commits)
- **Types**: feat, fix, refactor, test, docs, chore, ci
- **Scopes**: package names (core, server, web, tools, providers, memory, cli)
- **One logical change per commit**: No "fix multiple things" commits
- **Branch naming**: `feat/DC-XXX-short-description`, `fix/DC-XXX-short-description`

## Issue ID Format

- **Global format**: `DC-{PACKAGE}-{NUMBER}` (e.g., DC-PROV-001, DC-CORE-015)
- **Packages**: PROV, CORE, TOOL, MEM, SRV, CLI, WEB, SKILL, HOOK, PIPE, CTX, OBS, SAFE, SETUP, TEST
- **Numbers are globally unique within package** — never reused
- **Cross-references**: Issues reference other issues as `depends: DC-PROV-001`
