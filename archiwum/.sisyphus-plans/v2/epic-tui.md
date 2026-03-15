# Epic: Ink TUI Client (v2.0)

> Package: `@diricode/tui`
> Iteration: **v2.0**
> Issue IDs: **DC-TUI-001..DC-TUI-006**

## Summary

DiriCode's terminal-native UI built with Ink (React for CLI). Connects to the same Hono server as Web UI via SSE. Provides chat input, agent tree, metrics bar, and live activity indicator — mirroring MVP Web UI capabilities in the terminal. TUI is the secondary interface (Web UI is primary per wishlist Section 7.3).

Key design: TUI is a **thin client** — all orchestration logic lives in the server. TUI only renders EventStream data and sends user prompts via HTTP API.

## Architectural Baseline

- **Ink v5** (React for CLI) — component model, hooks, flexbox layout
- Connects to `@diricode/server` via HTTP (prompts) + SSE (events)
- Renders same EventStream data as Web UI
- Must work in: standard terminals, tmux, JetBrains terminal (wishlist 7.3)
- Must handle long conversation history without hang (wishlist 6.1)

## Issues

### DC-TUI-001 — Ink project scaffold and server connection

**Goal**: Bootstrap `@diricode/tui` package with Ink, establish HTTP + SSE connection to Hono server.

**Scope**
- Create `packages/tui/` with Ink v5 + TypeScript config
- Implement SSE client that subscribes to server EventStream
- Implement HTTP client for sending user prompts
- Handle connection lifecycle: connect, reconnect on drop, error display
- Shared types imported from `@diricode/core` (EventStream types)

**Acceptance criteria**
- [ ] `packages/tui/` builds and runs with `bun run`
- [ ] SSE connection receives events from running Hono server
- [ ] Prompt submission via HTTP returns response
- [ ] Reconnect after server restart within 5s
- [ ] Shared types (event schema) imported from core package

**References**
- `analiza-web-framework.md` (Ink decision)
- Wishlist 7.3 (TUI as primary terminal interface)
- MVP `epic-server.md` (Hono SSE API)

---

### DC-TUI-002 — Chat view with input and message history

**Goal**: Implement the core chat experience — scrollable message history with markdown rendering and multiline input.

**Scope**
- Scrollable message list with user/assistant message distinction
- Markdown rendering in terminal (ink-markdown or custom)
- Syntax highlighting for code blocks
- Multiline input with Enter to send, Shift+Enter for newline
- Vim motions in input box (wishlist 7.1) — basic: hjkl, i/a, dd, yy, p
- Paste support — full text visible, not truncated (wishlist 7.1)
- History navigation (↑/↓ for previous prompts)

**Acceptance criteria**
- [ ] Messages render with markdown formatting and syntax highlighting
- [ ] Input supports multiline editing
- [ ] Basic vim motions work in input (i, Esc, dd, yy, p, hjkl)
- [ ] Pasted text displays fully (not truncated like `[Pasted ~N lines]`)
- [ ] Long conversation history scrolls without UI hang
- [ ] ↑/↓ navigates prompt history

**References**
- Wishlist 7.1 (vim motions, paste, multiline)
- Wishlist 6.1 (long history must not hang)

---

### DC-TUI-003 — Agent tree panel

**Goal**: Render the agent tree in TUI, showing agent status, nesting, and elapsed time — matching Web UI's Agent Tree component.

**Scope**
- Expandable/collapsible tree rendering in terminal
- Status icons: ▼ running, ✓ completed, ✗ failed, ○ pending, ⊘ cancelled
- Agent name + tier + model + elapsed time per node
- Tool calls and LLM generations as child nodes (when expanded)
- Responds to Verbose dimension: Silent=hidden, Compact=collapsed, Explain=expanded, Narrated=expanded+tokens

**Acceptance criteria**
- [ ] Agent tree renders from EventStream agent.start/agent.end/tool.*/llm.* events
- [ ] Tree expands/collapses with keyboard navigation
- [ ] Status icons match specification
- [ ] Verbose dimension controls tree detail level
- [ ] Parallel agents shown as siblings at same depth

**References**
- `analiza-observability.md` Section 3.1 (Agent Tree spec)
- MVP `epic-observability.md` (EventStream data model)

---

### DC-TUI-004 — Metrics bar and live activity indicator

**Goal**: Implement bottom metrics bar and top-line activity indicator for TUI.

**Scope**
- Bottom bar: agents done/total, tokens in/out, cost, elapsed time
- Top bar: single-line current activity ("code-writer is generating code...")
- Update frequency: metrics on each event, timer every second
- Responds to Verbose dimension per observability spec

**Acceptance criteria**
- [ ] Metrics bar shows accurate token counts and cost from EventStream
- [ ] Live indicator updates when agents start/stop
- [ ] Timer ticks every second during active turn
- [ ] Verbose=Silent hides both; Compact shows minimal; Explain shows all

**References**
- `analiza-observability.md` Sections 3.2, 3.3

---

### DC-TUI-005 — Work mode selector (4 dimensions)

**Goal**: Implement UI controls for switching Quality/Autonomy/Verbose/Creativity dimensions before each prompt.

**Scope**
- Dimension selector below input (like OpenCode's agent/model selectors)
- Keyboard shortcut to cycle each dimension (e.g., Ctrl+Q for Quality, Ctrl+A for Autonomy)
- Display current levels in status line
- Persist selection for session (resets on new session to defaults)
- Send selected dimensions with each prompt HTTP request

**Acceptance criteria**
- [ ] All 4 dimensions selectable via keyboard shortcuts
- [ ] Current dimension levels displayed in status line
- [ ] Dimension selection sent with prompt to server
- [ ] Defaults applied on session start (Standard/Auto-Edit/Compact/Helpful)

**References**
- `analiza-lean-mode.md` (4-dimension system spec)
- ADR-012 (work mode dimensions)

---

### DC-TUI-006 — Slash commands and session management

**Goal**: Implement TUI slash commands for session control, context management, and configuration.

**Scope**
- `/help` — show available commands
- `/context` — show current context window usage
- `/add <path>` / `/remove <path>` — manage context files
- `/session list` / `/session resume <id>` — session management
- `/config` — show current configuration
- `/clear` — clear chat display (not session)
- `/exit` — graceful shutdown
- Tab completion for slash commands and file paths

**Acceptance criteria**
- [ ] All listed slash commands functional
- [ ] Tab completion works for commands and file paths
- [ ] `/context` shows accurate token usage breakdown
- [ ] `/session resume` reconnects to previous session with history

**References**
- Wishlist 5.2 (/add, /remove, /context commands)
