# Epic: CLI Entrypoint and Session UX

> **Package**: apps/cli  
> **Iteration**: POC → MVP-1  
> **Issues**: DC-CLI-001 — DC-CLI-004  
> **Dependencies**: DC-CORE-001..004 (config/runtime contracts), DC-SRV-001 (server startup), DC-MEM-001..007 (session persistence)

## Summary
This epic delivers a zero-learning-curve command-line interface (`UX-001`) that works in two core modes: interactive REPL and one-shot execution. POC provides the minimal viable entrypoint and interaction loop; MVP-1 completes non-interactive automation-friendly behavior and session lifecycle commands. The CLI remains intentionally simple in MVP (stdin/stdout REPL), while full TUI ergonomics are explicitly deferred to v2.

Configuration behavior is strict: CLI flags are layer 4 in the config hierarchy (highest precedence over defaults/global/project), consistent with ADR-011 and MVP spec.

## Issues

### DC-CLI-001: CLI binary entrypoint and flag parsing

**Iteration**: POC  
**Priority**: P0

**Description**:
Create the executable CLI entrypoint (`bunx diricode` and optional short alias `dc`) that parses runtime flags, resolves merged configuration, boots the local server runtime, and opens a session. Flag parsing must include at least `--config`, `--verbose`, `--model` and be extensible without breaking backward compatibility.

The command should “just work” from a developer shell with clear startup messaging and deterministic error exits.

**Acceptance Criteria**:
- [ ] Binary entrypoint available via `bunx diricode` (and `dc` alias if packaged).
- [ ] Flags parsed with typed schema and validation.
- [ ] Config resolution applies 4 layers; CLI flags override all lower layers.
- [ ] Starts/attaches to server runtime and creates session context.
- [ ] Startup and failure messages are concise and actionable.
- [ ] Exit code semantics documented for startup failure paths.

**References**:
- ADR-011 / `spec-mvp-diricode.md` (4-layer config hierarchy)
- `mvp/index.md` (CLI as POC epic)

**Dependencies**: DC-CORE-001, DC-SRV-001

---

### DC-CLI-002: Interactive REPL mode (basic, not TUI)

**Iteration**: POC  
**Priority**: P0

**Description**:
Implement a minimal interactive REPL over stdin/stdout where user input is sent to server pipeline and streamed output is rendered live. Handle Ctrl+C gracefully (cancel current operation or exit cleanly), flush resources on shutdown, and preserve session continuity where possible.

This is deliberately a plain REPL for MVP; TUI affordances are v2 scope.

**Acceptance Criteria**:
- [ ] REPL loop accepts user prompt and dispatches to server.
- [ ] Streaming response renders incrementally.
- [ ] Ctrl+C handling supports graceful interruption/shutdown.
- [ ] Session remains stable across multiple turns.
- [ ] Errors are shown without crashing the entire process when recoverable.
- [ ] Documentation explicitly states “REPL only, no TUI in MVP”.

**References**:
- `spec-mvp-diricode.md` (CLI secondary, Web primary)
- `mvp/index.md` Must NOT list (TUI deferred to v2)

**Dependencies**: DC-CLI-001

---

### DC-CLI-003: Non-interactive run mode (scripting + JSON)

**Iteration**: MVP-1  
**Priority**: P1

**Description**:
Add one-shot execution mode for automation and shell scripting:
- `dc run "add a login page"`
- `echo "fix bug" | dc run`

Return deterministic exit codes (`0` success, `1` error), support `--json` output for machine parsing, and ensure human-readable default output remains concise. This mode is critical for CI hooks and lightweight automation.

**Acceptance Criteria**:
- [ ] Supports direct argument prompt execution (`dc run "..."`).
- [ ] Supports stdin piping to `dc run`.
- [ ] Returns exit code `0` on success, `1` on failure.
- [ ] `--json` mode outputs structured result/error payload.
- [ ] Non-JSON mode remains user-friendly and concise.
- [ ] Works without entering REPL state.

**References**:
- `spec-mvp-diricode.md` (automation-friendly CLI posture)
- `cross-cutting.md` (typed error handling conventions)

**Dependencies**: DC-CLI-001, DC-CLI-002

---

### DC-CLI-004: Session management and config introspection commands

**Iteration**: MVP-1  
**Priority**: P1

**Description**:
Provide basic operational commands for session lifecycle and transparency:
- `dc sessions list`
- `dc sessions show <id>`
- `dc sessions resume <id>`
- `dc config show`

Session commands rely on memory persistence; config command must display fully resolved effective config with all four layers merged (including CLI overrides where applicable for the current invocation context).

**Acceptance Criteria**:
- [ ] `sessions list` returns persisted sessions with key metadata.
- [ ] `sessions show <id>` displays session details safely.
- [ ] `sessions resume <id>` restores and continues an existing session.
- [ ] `config show` outputs resolved merged config view.
- [ ] All commands return deterministic exit codes and typed errors.
- [ ] Output format supports both human-readable and JSON mode alignment.

**References**:
- ADR-022 (`spec-mvp-diricode.md`) for session/state backing
- ADR-011 (`spec-mvp-diricode.md`) for merged config layering

**Dependencies**: DC-MEM-001..007, DC-CLI-001

## Must NOT
- Do **not** implement Ink TUI or advanced terminal UI patterns in MVP CLI epic (v2 only).
- Do **not** couple CLI directly to provider internals; route through server/core contracts.
- Do **not** introduce incompatible flag semantics that violate 4-layer config override rules.
- Do **not** require users to learn complex commands for common flows (UX-001).

## Dependencies
- **Blocked by**: `epic-config.md` (layered config), `epic-server.md` (runtime endpoint), `epic-memory.md` (session persistence).
- **Blocks**: `epic-web-ui.md` parity checks for command execution behavior, `epic-observability.md` CLI-side event consumption/stream diagnostics.
