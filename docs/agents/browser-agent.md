# Agent Spec: browser-agent

> **Agent Name**: `browser-agent`
> **Tier**: MEDIUM
> **Category**: research
> **Ships in**: MVP
> **MCP Server**: [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) v0.0.29 (Apache-2.0)
> **References**: ADR-004 (agent roster), ADR-015 (tool annotations), ADR-041 (MCP server selection)

---

## Summary

`browser-agent` is an interactive web browser specialist. It navigates websites, fills forms, clicks elements, and extracts structured data from specific web pages using a headless Chromium browser controlled via Microsoft's Playwright MCP.

It is the counterpart to `web-researcher`: where `web-researcher` handles general search and read-only content extraction, `browser-agent` handles pages that require actual interaction — navigating through multi-step flows, clicking through pagination, filling login-free forms, or scraping JavaScript-rendered SPAs.

**Key design principle**: prefer accessibility tree snapshots (`browser_snapshot`) over screenshots. The accessibility tree is token-efficient and more AI-friendly than raw screenshots for understanding page structure.

---

## Responsibility

**Core role**: Interact with and extract data from specific websites that require browser automation.

**Scope:**
- Navigate to URLs and read page content via accessibility tree
- Click links, buttons, and interactive elements
- Type into text fields and fill forms
- Extract structured data from JavaScript-rendered pages
- Handle dialogs, dropdowns, and keyboard interactions

**NOT in scope:**
- General web search (→ `web-researcher`)
- File modifications
- Persistent browser sessions (each session is isolated — no cookies/state carry-over)
- PDF generation, screenshots, browser tracing
- Advanced browser features (mobile emulation, network interception, HAR recording)

---

## System Prompt Summary

- Act as an interactive web browser specialist
- Use `browser_navigate` to go to a URL; always follow with `browser_snapshot` to understand page state
- Prefer `browser_snapshot` (accessibility tree) over any screenshot approach — it is more token-efficient and AI-readable
- Use `browser_click`, `browser_type`, `browser_press_key` for page interaction
- Use `browser_fill_form` when filling multiple fields at once (more efficient than individual `browser_type`)
- Use `browser_select_option` for dropdown menus
- Use `browser_wait_for` when content loads asynchronously
- Use `browser_evaluate` sparingly — it executes arbitrary JavaScript and is marked destructive
- Always call `browser_close` when done — never leave browser processes running
- For general web search, delegate to `web-researcher` instead

---

## Tool Access

All tools come from `playwright` MCP server (microsoft/playwright-mcp). Tool whitelist is strictly enforced to 14 core tools. `--caps core` flag further limits the server's exposed tool surface.

| Tool | Type | readOnlyHint | destructiveHint | idempotentHint |
|------|------|-------------|-----------------|----------------|
| `browser_navigate` | Navigation | false | false | false |
| `browser_navigate_back` | Navigation | false | false | false |
| `browser_click` | Interaction | false | false | false |
| `browser_type` | Interaction | false | false | false |
| `browser_press_key` | Interaction | false | false | false |
| `browser_hover` | Interaction | false | false | false |
| `browser_select_option` | Interaction | false | false | false |
| `browser_fill_form` | Interaction | false | false | false |
| `browser_handle_dialog` | Interaction | false | false | false |
| `browser_snapshot` | Observation | true | false | true |
| `browser_console_messages` | Observation | true | false | true |
| `browser_wait_for` | Wait | true | false | true |
| `browser_evaluate` | JavaScript | false | **true** | false |
| `browser_close` | Control | false | **true** | true |

**Destructive tools** (`browser_evaluate`, `browser_close`) will trigger ADR-014 smart approval. User confirmation required before execution.

**Excluded tools** (intentionally omitted — not in whitelist):
- `browser_take_screenshot` — accessibility tree is preferred; screenshots are token-expensive
- `browser_pdf` — not needed for research tasks
- `browser_save_trace`, `browser_start_trace`, `browser_stop_trace` — no tracing in MVP
- `browser_drag`, `browser_file_upload`, `browser_resize` — advanced features excluded
- `browser_run_code` — superseded by `browser_evaluate` in core capability set

---

## Inputs / Outputs

**Input**: Navigation or extraction task from dispatcher or parent agent. May include:
- A target URL and what to find ("go to https://docs.example.com/api and list all endpoints")
- An interaction flow ("navigate to the pricing page, click 'Open Source' plan, extract the feature list")
- A scraping goal ("fetch the table of contents from https://example.com/docs")

**Output**: Structured findings:
- Extracted content from the page (text, tables, lists)
- Confirmation of actions performed (navigated to X, clicked Y, typed Z)
- Accessibility tree snapshot excerpts showing page state
- Any errors encountered (navigation failure, element not found, dialog blocked)

---

## Tier Justification

**MEDIUM tier** per ADR-004:
- Browser navigation and data extraction does not require highest reasoning tier (HEAVY)
- Interaction steps are relatively deterministic given a good system prompt
- Cost-sensitive: browser sessions take time; MEDIUM tier balances cost vs quality adequately
- Same tier as `web-researcher` — both are research-category, read-focused agents

---

## Dispatcher Routing

**Triggers** — route to `browser-agent` when the user/agent asks:
- "browse website ..."
- "open page ..."
- "navigate to ..."
- "scrape ..."
- "extract from page ..."
- "fill form at ..."
- "click button on ..."
- "interact with website ..."
- "browser automation ..."

**Do NOT route here when:**
- Task is general web search → `web-researcher`
- Task is codebase exploration → `code-explorer`
- Simple URL fetch without interaction → `web-researcher` (`get-single-web-page-content`)

**Routing guidance**: If the task involves a specific URL AND requires clicking, typing, or navigating multi-step flows → `browser-agent`. If the task is "find information about X on the web" without a specific URL → `web-researcher`.

---

## MCP Server Configuration

Managed via `.dc/config.jsonc` (ADR-011 config hierarchy):

```jsonc
"playwright": {
  "command": "npx",
  "args": [
    "@playwright/mcp@0.0.29",
    "--headless",
    "--isolated",
    "--browser", "chromium",
    "--caps", "core"
  ]
}
```

**Flags explained:**
- `--headless`: No visible browser window — runs in background
- `--isolated`: Each session starts with a fresh browser context — no persistent cookies, storage, or state
- `--browser chromium`: Use Chromium only (Firefox and WebKit excluded to reduce footprint)
- `--caps core`: Expose only core automation tools — limits tool surface from ~26 to manageable subset

**Version**: `@playwright/mcp@0.0.29` (pinned, no `@latest`).

---

## Middleware Integration (ADR-033)

`browser-agent` tools pass through the same `wrap_tool_call` middleware pipeline as all native DiriCode tools:

- **ADR-035 ToolCallLimit**: Each browser action counts against the agent's tool call budget
- **ADR-036 ToolRetry**: Network-level failures retry with backoff; interaction errors do NOT auto-retry (could duplicate form submissions)
- **ADR-014 Smart Approval**: Interaction tools are NOT `readOnlyHint` — smart approval decides based on context. `browser_evaluate` and `browser_close` are additionally marked destructive — always require approval.
- **ADR-027 Git Safety**: N/A — browser-agent never touches files

---

## Process Lifecycle

Playwright MCP runs as a child process via stdio transport. DiriCode spawns and manages it per agent session.

**Normal lifecycle:**
1. DiriCode spawns `npx @playwright/mcp@0.0.29 ...` as a child process
2. MCP initialize handshake establishes the session
3. Agent invokes browser tools as needed
4. Agent calls `browser_close` when done
5. DiriCode terminates the child process after session ends

**Zombie process mitigation** (known issue #1458 in microsoft/playwright-mcp):
- `--isolated` flag ensures no persistent browser state that could prevent clean shutdown
- Explicit `browser_close` in system prompt guidance
- DiriCode sends SIGTERM to child process on session end
- Force-kill (SIGKILL) after 5s timeout if process doesn't terminate gracefully
- Verify cleanup: `pgrep -f "chromium.*playwright"` should return empty after session

---

## Limitations

- **Browser footprint**: Chromium binary ~450MB one-time download via `scripts/setup-mcp-servers.sh`
- **Session isolation**: Each session starts fresh — no login state, no cookies. Cannot maintain authenticated sessions across calls.
- **Headless SPA rendering**: Some heavily JavaScript-driven SPAs may not render all content in headless mode.
- **Rate limiting**: Websites may block or rate-limit automated browser traffic (user-agent detection, CAPTCHA).
- **Zombie processes**: Known risk — mitigated by `--isolated` + explicit `browser_close` + force-kill timeout (see above).
- **`browser_evaluate` risk**: Arbitrary JavaScript execution is powerful but can break page state. Use sparingly; always marked as requiring approval.
- **No persistent sessions**: Cannot maintain login state between agent invocations.

---

## Related Agents

| Agent | Relationship |
|-------|-------------|
| `web-researcher` | Handles search and read-only URL fetches; `browser-agent` handles interactive navigation |
| `code-explorer` | Handles local codebase search; `browser-agent` handles external web pages |
| `dispatcher` | Routes tasks to `browser-agent` based on trigger phrases |
