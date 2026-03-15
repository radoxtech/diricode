# Epic: Monorepo Setup

> **Package**: root  
> **Iteration**: POC  
> **Issues**: DC-SETUP-001 — DC-SETUP-005  
> **Dependencies**: None (this is the foundation)

## Summary
This epic establishes the root monorepo foundation for DiriCode using Bun runtime, pnpm workspaces, and Turborepo orchestration so all later packages can be implemented consistently. It standardizes repository layout, TypeScript baseline, tooling, and CI contract across Linux and macOS. Without this epic, downstream epics (core/server/providers/tools/memory/web/cli) cannot be developed or validated in a predictable way.

## Issues

### DC-SETUP-001: Initialize pnpm workspace monorepo with Turborepo

**Iteration**: POC  
**Priority**: P0

**Description**:
Create the root workspace shell and task orchestration backbone. Add `pnpm-workspace.yaml`, `turbo.json`, and root `package.json` configured for Bun + pnpm + Turborepo workflow. Define standard root scripts (`build`, `test`, `lint`, `typecheck`, plus optional `dev`/`clean`) that fan out to packages/apps through Turbo pipelines. Workspace globs must include `packages/*` and `apps/*`, aligned with the architecture from `overview.md` and `spec-mvp-diricode.md`. Root package metadata should enforce ESM (`"type": "module"`) and repository-wide engine constraints to avoid runtime drift.

This issue must also codify baseline task dependency graph in `turbo.json` (e.g., `build` depends on upstream `^build`; `typecheck` depends on upstream `^typecheck`) and artifact outputs for cacheability. Keep the initial setup minimal but production-shaped; no package-specific business logic belongs here.

**Acceptance Criteria**:
- [ ] Root files exist and are valid: `pnpm-workspace.yaml`, `turbo.json`, `package.json`.
- [ ] `pnpm-workspace.yaml` includes `packages/*` and `apps/*`.
- [ ] Root scripts include at least: `build`, `test`, `lint`, `typecheck`.
- [ ] `turbo.json` defines pipeline tasks with upstream dependency notation (`^task`) and cache `outputs` where applicable.
- [ ] Root is ESM (`"type": "module"`) and toolchain is Bun + pnpm + Turbo (no npm/yarn lockfiles).
- [ ] Running `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck` from repository root resolves workspace tasks (even if many are placeholders initially).

**References**:
- ADR: `docs/adr/adr-009-jsonc-config-c12-loader.md` (config discipline mindset)  
- ADR: `docs/adr/adr-032-web-ui-vite-react-shadcn.md` (monorepo-ready frontend integration)  
- Source: `overview.md` (architecture + package index), `spec-mvp-diricode.md` (stack + monorepo)

**Dependencies**: None

---

### DC-SETUP-002: Create package scaffolding for all MVP foundation packages

**Iteration**: POC  
**Priority**: P0

**Description**:
Scaffold all foundational workspaces as empty-but-buildable TypeScript packages/apps so subsequent epics can start with predictable contracts. Required directories:
- `packages/core`
- `packages/server`
- `packages/web`
- `packages/tools`
- `packages/providers`
- `packages/memory`
- `packages/github-mcp`
- `apps/cli`

Each workspace must include minimal `package.json`, `tsconfig.json`, and `src/index.ts` barrel entry. Package naming should follow scope convention from planning docs (`@diricode/<name>`, except CLI app as executable app package). Ensure every workspace is discoverable by pnpm, has ESM module type, and exposes basic script stubs compatible with root turbo tasks (`build`, `test`, `lint`, `typecheck`).

Scaffolding should preserve dependency direction policy from cross-cutting conventions (`cli → server → core → {tools, memory, providers}`) without forcing real implementation dependencies yet.

**Acceptance Criteria**:
- [ ] All listed directories are present under `packages/` and `apps/cli`.
- [ ] Every workspace has `package.json`, `tsconfig.json`, and `src/index.ts`.
- [ ] Package names use `@diricode/*` convention (CLI app may be named `@diricode/cli`).
- [ ] Each package declares scripts compatible with Turbo task names.
- [ ] `pnpm -r list` (or equivalent workspace resolution check) recognizes all scaffolds.
- [ ] No circular dependency declarations are introduced in initial scaffolding.

**References**:
- ADR: `docs/adr/adr-002-dispatcher-first-agent-architecture.md` (core-centric architecture)  
- ADR: `docs/adr/adr-022-github-issues-sqlite-timeline.md` (memory/github-mcp separation rationale)  
- Source: `overview.md`, `mvp/index.md`, `spec-mvp-diricode.md`

**Dependencies**: DC-SETUP-001

---

### DC-SETUP-003: Establish strict TypeScript configuration and workspace import strategy

**Iteration**: POC  
**Priority**: P0

**Description**:
Define repository-wide TypeScript standards through a root base config and per-workspace extension configs. Create root `tsconfig.base.json` (or `tsconfig.json` if chosen as base) with strict settings aligned to cross-cutting rules: `strict: true`, no implicit `any`, modern ESM target/module resolution, declaration settings suitable for package builds, and interoperability settings consistent across all packages.

Each workspace `tsconfig.json` must extend the root base and only override local concerns (`rootDir`, `outDir`, include patterns). Configure path aliases for cross-package imports so internal packages can import typed APIs through stable aliases (for example, `@diricode/core`, `@diricode/tools`, etc.), with alignment between TypeScript path mapping and package names.

The intent is to prevent drift, enforce type-safety from day one, and make future refactors feasible across the monorepo.

**Acceptance Criteria**:
- [ ] Root TS base config exists and sets `strict: true`.
- [ ] Every workspace `tsconfig.json` extends the root base config.
- [ ] Cross-package path aliases are defined and resolve correctly in typecheck.
- [ ] ESM-compatible TypeScript settings are consistent across all workspaces.
- [ ] Root `pnpm typecheck` succeeds with scaffold packages.
- [ ] No workspace uses `any`-enabling relaxations that violate cross-cutting conventions.

**References**:
- ADR: `docs/adr/adr-009-jsonc-config-c12-loader.md` (strict config governance pattern)  
- ADR: `docs/adr/adr-011-4-layer-config-hierarchy.md` (single source of truth mindset for shared config)  
- Source: `cross-cutting.md` (TS conventions), `spec-mvp-diricode.md` (ESM + Bun)

**Dependencies**: DC-SETUP-002

---

### DC-SETUP-004: Configure baseline development tooling (ESLint, Prettier, Bun, repo hygiene)

**Iteration**: POC  
**Priority**: P0

**Description**:
Set up linting/formatting and repository hygiene standards so all future implementation work follows one quality baseline. Add root ESLint + Prettier configs aligned with cross-cutting rules (TypeScript strictness, no production `console.log`, naming/style consistency where enforceable). Integrate lint scripts at root and workspace levels via Turbo tasks.

Adopt Bun as the runtime/tool executor for local development and scripts, while retaining pnpm as workspace/package manager. Define `.gitignore` for Bun/pnpm/Turbo build artifacts and local environment files; include `.editorconfig` for cross-editor consistency (UTF-8, LF, final newline, indentation policy).

This issue should produce a low-friction default developer experience and reduce formatting/lint churn in subsequent epics.

**Acceptance Criteria**:
- [ ] ESLint and Prettier configs exist at root and are executable from root scripts.
- [ ] Linting covers all workspaces (`packages/*`, `apps/*`) with TypeScript support.
- [ ] Prettier formatting rules are documented and runnable (e.g., `format`/`format:check` scripts if defined).
- [ ] Bun runtime usage is documented in root scripts/README notes (no Windows assumptions).
- [ ] `.gitignore` includes Bun, pnpm, Turbo, build outputs, and `.env` patterns.
- [ ] `.editorconfig` exists and applies repository-wide conventions.

**References**:
- ADR: `docs/adr/adr-028-secret-redaction.md` (supports strict handling of env/secrets via ignore patterns)  
- ADR: `docs/adr/adr-027-git-safety-rails.md` (quality/safety posture from first commit onward)  
- Source: `cross-cutting.md`, `spec-mvp-diricode.md` (Bun runtime; Linux/macOS support)

**Dependencies**: DC-SETUP-003

---

### DC-SETUP-005: Create CI/CD skeleton with Turborepo caching

**Iteration**: POC  
**Priority**: P0

**Description**:
Implement minimal GitHub Actions CI workflow that validates monorepo health on pull requests and main branch pushes. Workflow must run on Linux and macOS runners only (no Windows matrix), install Bun + pnpm, restore/install dependencies, and execute root quality gates in order: `typecheck`, `lint`, `test` (optionally `build` if needed as a non-blocking or blocking step per policy).

Enable Turborepo cache in CI using GitHub Actions cache integration to speed up repeated jobs while keeping deterministic behavior. Include clear cache key strategy bound to lockfile + turbo config + ts/eslint configs. Keep workflow skeleton extensible for future package-specific jobs but avoid premature complexity (no deployment stage in this epic).

**Acceptance Criteria**:
- [ ] Workflow file exists in `.github/workflows/` (e.g., `ci.yml`).
- [ ] CI triggers on PRs and pushes to main development branch.
- [ ] Runner matrix includes Linux and macOS only.
- [ ] CI installs Bun + pnpm and executes root `typecheck`, `lint`, `test` tasks successfully.
- [ ] Turborepo cache is configured and operational in CI logs.
- [ ] Workflow is documented as skeleton-only (quality gates, no release/deploy yet).

**References**:
- ADR: `docs/adr/adr-031-observability-eventstream-agent-tree.md` (measurement mindset; CI visibility baseline)  
- ADR: `docs/adr/adr-027-git-safety-rails.md` (automated safeguards before integration)  
- Source: `mvp/index.md` (POC gating), `spec-mvp-diricode.md` (platform constraints)

**Dependencies**: DC-SETUP-004

## Must NOT
- Do **not** implement package business logic (agents, router, hooks, memory internals, UI features) in this epic.
- Do **not** add v2/v3/v4 scope items (TUI production flow, embeddings, sandboxing, GitLab/Jira backends, multi-user).
- Do **not** introduce Windows-specific scripts, CI runners, or path assumptions.
- Do **not** add provider credentials or secrets to repository files.
- Do **not** optimize for deployment/release automation yet (CI quality gates only).
- Do **not** create architecture deviations from immutable pillars (dispatcher-first, HTTP+SSE, git safety rails, secret redaction baseline).

## Dependencies
- **Blocked by**: Nothing (this is the first epic)
- **Blocks**: All other epics
