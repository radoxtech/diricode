# ADR-041 — MCP Web Research Server Selection

| Field       | Value                                                         |
|-------------|---------------------------------------------------------------|
| Status      | Accepted                                                      |
| Date        | 2026-03-19                                                    |
| Scope       | MVP                                                           |
| References  | ADR-004 (agent roster 3 tiers), ADR-015 (tool annotations), ADR-030 (MCP capabilities), ADR-033 (interceptor/wrapper split) |

### Context

DiriCode requires web research capabilities for two distinct agent roles:

1. **web-researcher** — searches the web for documentation, code examples, and best practices without browser interaction
2. **browser-agent** — performs interactive browser automation: navigation, form filling, data extraction from specific pages

Constraint: **zero API keys, zero accounts, zero paid services**. All MCP servers must run locally, be free and open-source, and work out of the box without external service registrations.

Over 15 MCP servers were evaluated across GitHub, npm, and the MCP ecosystem. The selection criteria were:

- **License**: MIT or Apache-2.0 preferred; GPL acceptable; proprietary rejected
- **API-key-free**: must work without any account or API key
- **Local execution**: stdio transport, runs as child process, no remote APIs
- **Tool count**: ≤ 15 tools per agent (to control context window token budget — Reddit reports MCP tool definitions alone can consume 75,000+ tokens)
- **Maintenance**: actively maintained, not archived
- **Browser footprint**: acceptable for a development workstation

### Decision

**Selected servers:**

| Role | MCP Server | Stars | License | Tools | Transport |
|------|-----------|-------|---------|-------|-----------|
| web-researcher | [mrkrsl/web-search-mcp](https://github.com/mrkrsl/web-search-mcp) | 649⭐ | MIT | 3 | stdio |
| browser-agent | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 29k⭐ | Apache-2.0 | ~26 (filtered to 14) | stdio |

**web-search-mcp** provides three tools covering the full search-to-extract workflow:
- `full-web-search` — multi-engine search (Bing → Brave → DuckDuckGo fallback) with full content extraction
- `get-web-search-summaries` — lightweight search results with snippets only
- `get-single-web-page-content` — extract content from a specific URL

Multi-engine fallback means no single search provider dependency. No API keys required — it uses public search endpoints via Playwright-driven headless browsers.

**Microsoft Playwright MCP** provides browser automation via the accessibility tree (preferred over screenshots — more token-efficient for AI agents). Filtered to 14 core tools via `--caps core` flag:

| Tool | Type | readOnlyHint | destructiveHint |
|------|------|-------------|-----------------|
| `browser_navigate` | Navigation | false | false |
| `browser_navigate_back` | Navigation | false | false |
| `browser_click` | Interaction | false | false |
| `browser_type` | Interaction | false | false |
| `browser_press_key` | Interaction | false | false |
| `browser_hover` | Interaction | false | false |
| `browser_select_option` | Interaction | false | false |
| `browser_fill_form` | Interaction | false | false |
| `browser_handle_dialog` | Interaction | false | false |
| `browser_snapshot` | Observation | true | false |
| `browser_console_messages` | Observation | true | false |
| `browser_wait_for` | Wait | true | false |
| `browser_evaluate` | JavaScript | false | true |
| `browser_close` | Control | false | true |

Tool annotations follow ADR-015. `browser_evaluate` and `browser_close` are marked destructive — they will trigger the ADR-014 smart approval flow.

**Configuration** (`.dc/config.jsonc` MCP section):

```jsonc
{
  "mcpServers": {
    "web-search": {
      "command": "node",
      "args": ["~/.diricode/mcp-servers/web-search-mcp/dist/index.js"],
      "env": {
        "MAX_CONTENT_LENGTH": "10000",
        "DEFAULT_TIMEOUT": "6000",
        "MAX_BROWSERS": "2",
        "BROWSER_TYPES": "chromium,firefox",
        "BROWSER_HEADLESS": "true",
        "ENABLE_RELEVANCE_CHECKING": "true",
        "RELEVANCE_THRESHOLD": "0.3"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@0.0.29", "--headless", "--isolated", "--browser", "chromium", "--caps", "core"]
    }
  }
}
```

Versions are pinned: `web-search-mcp@v0.3.2`, `@playwright/mcp@0.0.29`. No `@latest` references.

### Alternatives Considered

| Server | Reason Rejected |
|--------|----------------|
| **GPT Researcher** | Requires an LLM API key (OpenAI/Anthropic). Violates zero-API-key constraint. |
| **Firecrawl MCP** | Requires Firecrawl API key and account registration. Paid service. |
| **Kindly MCP** | Requires API key. No anonymous access. |
| **Exa MCP** | Remote Exa search API. Not local. Requires account and API key. |
| **Jina MCP** | Remote Jina Reader service. Not local execution. |
| **Tavily MCP** | Remote Tavily API. Requires API key and account. |
| **mzxrai/mcp-webresearch** | Archived (no longer maintained). GitHub repo archived 2024. |
| **idapixl/web-search-mcp** | Sparse documentation, unclear maintenance status. Superseded by mrkrsl fork. |
| **task-mcp** | General task management, not web research. Off-topic. |
| **Stagehand MCP** | Uses OpenAI API for AI-powered browser actions. API key required. |
| **Puppeteer MCP** | Less stable than Playwright for headless automation. No `--caps` filtering. Larger zombie process risk. |
| **generic web-fetch** | No search capability — only fetch of known URLs. Insufficient for research tasks. |
| **mcp-browser-automation** | Less maintained than official Microsoft Playwright MCP. Inferior tool set. |

**Why not combine into one agent?** The two use cases have fundamentally different tool sets and risk profiles. Search tools are all `readOnlyHint: true` (auto-approved). Browser interaction tools are not (require approval). Separating them allows clean approval policies per agent.

### Consequences

**Positive:**
- Zero cost, zero accounts — works out of the box on any developer machine
- Both servers use MIT / Apache-2.0 licenses — no legal risk
- Local execution — no data sent to external search APIs (web-search-mcp routes through public search engine frontends, not proprietary APIs)
- All MCP tools pass through the ADR-033 `wrap_tool_call` middleware pipeline identically to native tools — consistent retry, limits, and approval behavior
- `--caps core` + explicit tool whitelist per agent keeps token budget under control
- Multi-engine fallback in web-search-mcp avoids single-provider rate limiting

**Negative / Trade-offs:**
- **Browser footprint**: Both servers require Playwright browser binaries (chromium, ~450-700MB). One-time installation required via `scripts/setup-mcp-servers.sh`.
- **Search engine rate limiting**: web-search-mcp uses public search frontends — may be rate-limited under heavy use. No API key means no elevated rate limits.
- **Playwright zombie processes**: Known issue (#1458 in microsoft/playwright-mcp). Mitigated by `--isolated` flag and explicit `browser_close` tool calls. Force-kill after 5s timeout if cleanup fails.
- **SSRF risk**: External MCP servers accept URLs without validation. `browser_evaluate` can execute arbitrary JavaScript. Both `browser_evaluate` and `browser_close` are marked destructive — smart approval (ADR-014) provides a guardrail. Full SSRF protection layer deferred to v2.
- **Version lag**: Pinning to specific versions means manual updates when security patches or breaking API changes occur.
