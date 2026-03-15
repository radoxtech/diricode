# Epic: Sandbox / Containerized Execution (v3.0)

> Package: `@diricode/core` + new `@diricode/sandbox`
> Iteration: **v3.0**
> Issue IDs: **DC-SAND-001..DC-SAND-006**

## Summary

Implements Docker-based sandboxed execution for agent tool calls, fulfilling ARCH-002 (Sandbox v2/v3). Agents can optionally run shell commands, file writes, and network operations inside isolated containers — preventing unintended side effects on the host system.

Source: Wishlist 3.2 (sandboxing), ARCH-002, Iron Guideline
Ecosystem references: OpenHands (Docker sandboxing), Codex (sandbox-based autonomy levels), Claude Code (workspace trust)

## Architectural Baseline

- MVP: agents execute tools directly on host (no isolation)
- v2: Autonomy dimension controls which actions need approval (human-in-the-loop safety)
- v2: Tool annotations (readOnly/destructive/idempotent) from DC-APPR-001
- Wishlist 3.2: "Agents NIE mają domyślnego dostępu do: Credentials (.env, .ssh, .aws, .kube), plików poza workspace, sieci"

## Issues

### DC-SAND-001 — Sandbox runtime abstraction layer

**Goal**: Create an abstraction layer that allows tool execution to run on host or in a sandboxed environment, selectable per agent or per configuration.

**Scope**
- `SandboxRuntime` interface: `exec(command)`, `readFile(path)`, `writeFile(path, content)`, `networkAccess(rule)`
- Implementations:
  - `HostRuntime` — direct execution on host (current behavior, default)
  - `DockerRuntime` — execution inside Docker container
  - Future: `VMRuntime` — VM-based isolation (placeholder interface)
- Runtime selected per-agent or per-config: `"sandbox": "host" | "docker" | "vm"`
- Graceful fallback: if Docker not available → warn and fall back to host

**Acceptance criteria**
- [ ] `SandboxRuntime` interface defined with exec, readFile, writeFile, networkAccess
- [ ] `HostRuntime` preserves existing behavior (no regression)
- [ ] `DockerRuntime` implementation stubs created
- [ ] Runtime selectable per-agent in config
- [ ] Fallback to host if Docker unavailable

**References**
- ARCH-002 (sandbox v2/v3)
- Wishlist 3.2 (sandboxing requirements)
- OpenHands: Docker-based sandboxing pattern

---

### DC-SAND-002 — Docker sandbox container management

**Goal**: Manage Docker containers for sandboxed agent execution — create, reuse, cleanup.

**Scope**
- Container image: lightweight base image with common dev tools (node, python, git, etc.)
- Container lifecycle:
  - Create on agent start (or reuse pooled container)
  - Mount workspace directory as volume (read-write)
  - Destroy on agent end (or return to pool)
- Container pool: pre-warm N containers to reduce startup latency
- Resource limits: CPU, memory, disk, timeout per container
- Cleanup: automatic cleanup on session end, zombie container detection
- Configuration: image name, resource limits, pool size in config

**Acceptance criteria**
- [ ] Docker containers created for sandboxed agents
- [ ] Workspace mounted as volume
- [ ] Container pool reduces startup latency
- [ ] Resource limits enforced (CPU, memory, timeout)
- [ ] Containers cleaned up on session end
- [ ] Zombie container detection and cleanup

**References**
- OpenHands: runtime container management
- Codex: sandbox execution model

---

### DC-SAND-003 — Filesystem isolation and mount policies

**Goal**: Control what parts of the filesystem are visible inside the sandbox.

**Scope**
- Mount policies:
  - **Workspace-only**: only project directory mounted (default for most agents)
  - **Workspace + global config**: adds `~/.config/dc/` as read-only mount
  - **Workspace + specific dirs**: configurable additional mounts
  - **Full host**: escape hatch for trusted operations (equivalent to HostRuntime)
- Credential isolation: `.env`, `.ssh/`, `.aws/`, `.kube/` NEVER mounted by default
- Temp directory: container has its own `/tmp` (not shared with host)
- Read-only mounts: option to mount workspace as read-only for read-only agents (code-explorer, code-reviewer)

**Acceptance criteria**
- [ ] Workspace-only mount works as default
- [ ] Credentials never mounted by default
- [ ] Additional mount directories configurable
- [ ] Read-only mount option for read-only agents
- [ ] Full host escape hatch available via config

**References**
- Wishlist 3.2: "Agents NIE mają domyślnego dostępu do: Credentials, plików poza workspace, sieci"
- Claude Code: workspace trust model

---

### DC-SAND-004 — Network isolation and egress rules

**Goal**: Control network access from within sandboxed containers — deny by default, allow specific egress.

**Scope**
- Default: no network access (air-gapped)
- Egress rules configurable per agent:
  - `none` — no network (default)
  - `api-only` — only DiriCode server API (for tool communication)
  - `allowlist` — specific domains/IPs (e.g., npm registry, GitHub API)
  - `full` — unrestricted (for web-researcher, browser-agent)
- Network policy enforced via Docker network settings
- Logging: all network requests logged for audit
- DNS: resolve only allowed domains (DNS firewall)

**Acceptance criteria**
- [ ] Default: no network access in sandbox
- [ ] Egress rules configurable per agent
- [ ] Allowlist supports domain-based rules
- [ ] Network requests logged for audit
- [ ] Docker network settings enforce policy

**References**
- Wishlist 3.2: "sieci (chyba że jawnie dozwolone)"
- Codex: network sandboxing

---

### DC-SAND-005 — Sandbox integration with Autonomy dimension

**Goal**: Link sandbox behavior to the Autonomy dimension — higher autonomy may require sandboxing for certain operations.

**Scope**
- Autonomy × Sandbox matrix:
  - Ask Everything + Auto-Edit: sandbox optional (human approves everything)
  - Auto-Execute: sandbox RECOMMENDED for shell commands
  - Full Auto: sandbox REQUIRED for destructive operations
- Config override: user can force sandbox on/off regardless of Autonomy
- Tool annotation integration: `destructive` tools auto-sandboxed at Auto-Execute+
- Approval bypass: sandboxed operations can be auto-approved (damage is contained)
- Audit trail: sandboxed execution logged with container ID and resource usage

**Acceptance criteria**
- [ ] Auto-Execute level recommends sandbox for shell commands
- [ ] Full Auto level requires sandbox for destructive operations
- [ ] Config override forces sandbox on/off
- [ ] destructive tool annotation triggers sandbox
- [ ] Sandboxed operations log container ID in audit trail

**References**
- `analiza-lean-mode.md` Section 3 (Autonomy dimension — 5 levels)
- v2 `epic-annotation-approval.md` DC-APPR-001 (tool annotations)
- ADR-011 (4-dimension work mode system)

---

### DC-SAND-006 — Sandbox performance and resource monitoring

**Goal**: Monitor sandbox resource usage and surface it in observability components.

**Scope**
- Metrics per container: CPU%, memory MB, disk I/O, network bytes, execution time
- Surface in Detail Panel (v2 component): sandbox section showing resource usage
- Alerts: container approaching resource limit → warning in Live Activity Indicator
- Cost tracking: container CPU-seconds as part of task cost estimation
- Performance targets: container startup <2s (pooled), <5s (cold start)
- Metrics persisted in EventStream (new event type: `sandbox.metrics`)

**Acceptance criteria**
- [ ] Resource metrics collected per container
- [ ] Metrics visible in Detail Panel
- [ ] Resource limit alerts displayed
- [ ] Container startup <2s pooled, <5s cold
- [ ] `sandbox.metrics` events in EventStream

**References**
- `analiza-observability.md` Section 7 (v3: performance profiling)
- v2 `epic-observability-v2.md` DC-OBS-007 (Detail Panel)
