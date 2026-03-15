# Epic: Testing Infrastructure

> **Package**: root, test-utils
> **Iteration**: POC
> **Issues**: DC-TEST-001 — DC-TEST-004
> **Dependencies**: DC-SETUP-001 (monorepo must exist first)

## Summary
This epic establishes the minimum shared testing platform required before any implementation epics begin TDD work. It standardizes Vitest configuration across the monorepo, introduces reusable test utilities/fixtures, and provides deterministic integration-test harnesses for server and memory-layer scenarios. It also defines CI execution and caching so test signals are fast, reproducible, and aligned with Turborepo workflows.

## Issues

### DC-TEST-001: Vitest Workspace and Monorepo Test Baseline
**Iteration**: POC
**Priority**: P0

**Description**:
Set up Vitest as the default testing framework for all workspaces, with a root `vitest.config.ts` and per-package configs as needed for package-local overrides. Ensure test commands run both from package scope and monorepo scope through Turborepo, with deterministic defaults and no implicit network access in unit tests. Configure coverage with the `v8` provider and shared include/exclude policies so coverage reports are consistent across packages and CI. Add root and package-level test scripts for `test`, `test:watch`, and `test:coverage`.

**Acceptance Criteria**:
- [ ] Root `vitest.config.ts` exists and defines monorepo-wide defaults (environment, include patterns, setup hooks as needed).
- [ ] Each active package has either inherited root config or explicit `vitest.config.ts` for package-specific behavior.
- [ ] Root `package.json` provides scripts to run all tests via Turborepo (e.g., `pnpm test`, `pnpm test:coverage`).
- [ ] Package `package.json` files provide local scripts aligned with root script names.
- [ ] Coverage uses Vitest `v8` provider with normalized output location(s) for CI collection.
- [ ] `turbo.json` contains test pipeline entries and cache configuration for test tasks.
- [ ] Unit-test defaults enforce "no real network calls" via mocking policy and/or test setup guardrails.
- [ ] Test file layout aligns with cross-cutting conventions: `src/__tests__/` and `{module}.test.ts`.

**References**:
- ADR: ADR-018 (SQLite/FTS5 constraints impacting test setup), ADR-022 (memory boundary), ADR-025 (provider behavior requiring mocks), ADR-032 (web package participates in monorepo tests)

**Dependencies**: DC-SETUP-001

---

### DC-TEST-002: Shared Test Utilities, Factories, and Fixtures
**Iteration**: POC
**Priority**: P0

**Description**:
Create a shared test-utils workspace/package (or clearly scoped shared folder if package bootstrapping is not yet available) to avoid duplicated mocking logic across `core`, `server`, `providers`, `tools`, and `memory`. Provide typed mock factories for common domain objects (e.g., `Agent`, `Provider`, `EventStream` events/payloads, pipeline task metadata). Define fixture directory conventions and helpers for async flows, stream assertion, and deterministic time/data patterns. This foundation should make unit tests concise while preserving strict typing and deterministic behavior.

**Acceptance Criteria**:
- [ ] Shared `test-utils` module is importable from all testable packages through workspace aliases/exports.
- [ ] Mock factory helpers exist for at least: `Agent`, `Provider`, and `EventStream`-related test payloads.
- [ ] Fixture directory convention is documented and implemented (e.g., `packages/test-utils/src/fixtures/...` with domain subfolders).
- [ ] Async helpers cover common patterns: flush promises/microtasks, timeout-safe await wrappers, retry polling for event assertions.
- [ ] Stream-testing helpers support SSE/EventStream message collection and ordered assertions.
- [ ] Time/randomness helpers ensure deterministic tests (frozen clock or injectable time source patterns).
- [ ] Test-utils APIs are fully typed (no `any`) and follow cross-cutting TypeScript conventions.
- [ ] Basic usage examples are included so new tests in other epics can adopt utilities immediately.

**References**:
- ADR: ADR-004 (agent types), ADR-013 (pipeline phases), ADR-031 (EventStream typing), ADR-025 (provider abstraction and failover tests)

**Dependencies**: DC-SETUP-001

---

### DC-TEST-003: Integration Test Harness (SQLite + Hono + Env Isolation)
**Iteration**: POC
**Priority**: P0

**Description**:
Establish integration-test infrastructure for packages requiring runtime composition: in-memory SQLite factories for data-layer tests, Hono app/test client factory for API-level tests, and robust environment isolation between suites. The goal is to support fast and deterministic integration tests without external dependencies, while preserving package boundary rules (e.g., memory access through API abstractions). Include setup/teardown patterns that prevent state leakage across test files and workers.

**Acceptance Criteria**:
- [ ] SQLite in-memory DB factory exists for tests, with lifecycle utilities (create/reset/dispose).
- [ ] Factory supports schema bootstrapping needed for `@diricode/memory` integration tests.
- [ ] Hono test server/app factory exists for `@diricode/server` tests with simple request helpers.
- [ ] Integration tests can compose server + memory without real network or external services.
- [ ] Environment variable isolation utility is provided (save/restore `process.env` per suite/test).
- [ ] Parallel test execution does not leak DB state or env state across suites.
- [ ] Integration test naming/location conventions are defined and aligned with existing test structure rules.
- [ ] Minimal reference integration tests are added (or planned as immediate follow-up) to validate harness behavior.

**References**:
- ADR: ADR-001 (Hono HTTP/SSE), ADR-022 (SQLite memory model), ADR-024 (hook behavior requires integration scenarios), ADR-028 (secret handling can require env-sensitive tests)

**Dependencies**: DC-SETUP-001

---

### DC-TEST-004: CI Test Pipeline and Coverage Reporting
**Iteration**: POC
**Priority**: P0

**Description**:
Define CI execution for monorepo tests as a required quality gate from POC onward. Add GitHub Actions workflow steps to install dependencies, run `pnpm test`, and publish/retain coverage outputs. Integrate Turborepo caching in CI to reduce repeated runtime while ensuring cache correctness. Establish failure conditions and reporting format so regressions are visible immediately and actionable from PR context.

**Acceptance Criteria**:
- [ ] GitHub Actions workflow includes a dedicated test job that runs on PRs and main branch updates.
- [ ] Workflow executes `pnpm test` at minimum; coverage variant is also executed or produced in same pipeline.
- [ ] Coverage artifacts are generated and uploaded (and/or summarized in CI logs/check output).
- [ ] Turborepo remote/local cache configuration is enabled for test tasks in CI context.
- [ ] CI correctly invalidates cache when test-relevant files/configuration change.
- [ ] Workflow fails on test failures and on critical test command errors (no soft-pass behavior).
- [ ] Pipeline docs mention expected runtime/caching behavior and troubleshooting path.
- [ ] CI setup is compatible with Bun + pnpm workspace constraints in MVP stack.

**References**:
- ADR: ADR-025 (provider behavior often tested via mocks in CI), ADR-027 (safety rails rely on stable automated checks), ADR-031 (event-driven features need reliable regression detection)

**Dependencies**: DC-SETUP-001

## Must NOT
- Add or mandate E2E browser infrastructure in this epic (belongs to Web/UI testing scope later).
- Introduce live provider API calls in unit or integration tests.
- Couple tests to non-deterministic clocks/randomness without abstraction.
- Require external DB services (Postgres/MySQL/etc.); SQLite in-memory is the MVP standard.
- Expand into performance benchmarking framework beyond basic CI timings.
- Change package boundary rules to make tests pass (test harness must respect architecture).

## Dependencies
- **Blocked by**: DC-SETUP-001..005 (monorepo setup)
- **Blocks**: All implementation epics (core/server/tools/providers/memory/web/cli) by establishing the TDD baseline
