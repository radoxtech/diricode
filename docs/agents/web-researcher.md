# Agent Spec: web-researcher

> **Agent Name**: `web-researcher`
> **Tier**: MEDIUM
> **Category**: research
> **Ships in**: MVP
> **MCP Server**: [mrkrsl/web-search-mcp](https://github.com/mrkrsl/web-search-mcp) v0.3.2 (MIT)
> **References**: ADR-004 (agent roster), ADR-015 (tool annotations), ADR-041 (MCP server selection)

---

## Summary

`web-researcher` is a read-only external web research specialist. It searches the open web for documentation, code examples, API references, best practices, and current technical information — anything not already present in the local codebase.

It is the counterpart to `browser-agent`: where `web-researcher` focuses on broad search and content extraction from known or discovered URLs, `browser-agent` handles interactive navigation of specific websites. For general research queries, prefer `web-researcher`. For structured data extraction from a specific page that requires clicking or form interaction, use `browser-agent`.

---

## Responsibility

**Core role**: Find external information the codebase does not contain.

**Scope:**
- Search the web for technical documentation, examples, and answers
- Extract and summarize full page content from URLs
- Return structured, actionable findings to the requesting agent

**NOT in scope:**
- Interactive browser automation (→ `browser-agent`)
- File modifications
- Codebase analysis (→ `code-explorer`)
- Data caching or storage

---

## System Prompt Summary

- Act as an external web research specialist
- Prioritize authoritative sources: official docs, GitHub repos, MDN, RFC standards
- Use `get-web-search-summaries` for quick lookups (multiple results, snippets only)
- Use `full-web-search` for deep research (fewer results, full content extraction)
- Use `get-single-web-page-content` to fetch a specific known URL
- Always cite the source URL alongside any finding
- Do not invent information not found on the web
- Synthesize results into clear, concise answers — avoid raw dumps of page content
- Never modify files; this agent is read-only

---

## Tool Access

All tools come from `web-search` MCP server (mrkrsl/web-search-mcp). Tool whitelist is strictly enforced.

| Tool | Description | readOnlyHint | destructiveHint | idempotentHint |
|------|-------------|-------------|-----------------|----------------|
| `full-web-search` | Multi-engine search with full content extraction | true | false | true |
| `get-web-search-summaries` | Lightweight search returning snippets only | true | false | true |
| `get-single-web-page-content` | Extract full content from a specific URL | true | false | true |

**All 3 tools are read-only** — they will auto-approve under ADR-014 smart approval rules. No user confirmation required for search operations.

**Search engine fallback chain** (automatic, built into the MCP server):
1. Bing (primary)
2. Brave Search (fallback)
3. DuckDuckGo (final fallback)

No API keys required at any level. All search requests use public search frontends via headless Chromium.

---

## Inputs / Outputs

**Input**: Research query from dispatcher or parent agent. May include:
- A search query string ("how does the RunnableSequence middleware pattern work?")
- A specific URL to extract ("https://docs.example.com/some-library/interface")
- A research goal with constraints ("find TypeScript examples of retry with exponential backoff, exclude Python")

**Output**: Structured findings:
- Answer / summary of what was found
- Source URLs for each piece of information
- Confidence signal: was authoritative documentation found, or only blog posts/forums?
- Follow-up pointers if the query was only partially answerable

---

## Tier Justification

**MEDIUM tier** per ADR-004:
- Research and summarization tasks do not require the highest reasoning tier (HEAVY)
- Web search results are typically well-structured; synthesis requires moderate quality
- Cost-sensitive: web-researcher may be called frequently as a sub-task of heavier agents
- MEDIUM provides correct balance of quality and cost for a high-frequency research role

---

## Dispatcher Routing

**Triggers** — route to `web-researcher` when the user/agent asks:
- "search the web for ..."
- "find documentation for ..."
- "look up ..."
- "search online for ..."
- "web research ..."
- "find examples of ..."
- "what do the docs say about ..."
- "external docs for ..."
- "is there a TypeScript library for ..."

**Do NOT route here when:**
- Task requires navigating a specific website interactively → `browser-agent`
- Task requires code exploration → `code-explorer`
- Information is already in the local codebase → `code-explorer`

---

## MCP Server Configuration

Managed via `.dc/config.jsonc` (ADR-011 config hierarchy):

```jsonc
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
}
```

**Installation**: `scripts/setup-mcp-servers.sh` (one-time setup). Requires Node.js >= 18 and Playwright browser binaries (~450MB for chromium+firefox).

**Version**: web-search-mcp v0.3.2 (pinned, no `@latest`).

---

## Middleware Integration (ADR-033)

`web-researcher` tools pass through the same `wrap_tool_call` middleware pipeline as all native DiriCode tools:

- **ADR-035 ToolCallLimit**: Search calls count against the agent's tool call budget
- **ADR-036 ToolRetry**: Failed searches are retried with exponential backoff (network errors, timeouts)
- **ADR-014 Smart Approval**: All tools are `readOnlyHint: true` — auto-approved, no user interrupt
- **ADR-027 Git Safety**: N/A — web-researcher never touches files

No special MCP treatment — tools are first-class citizens in the middleware stack.

---

## Limitations

- **Rate limiting**: web-search-mcp uses public search frontends without API keys. Heavy usage may trigger rate limits from Bing, Brave, or DuckDuckGo.
- **Content currency**: Search results reflect the web's current state. Documentation may be outdated for rapidly evolving libraries.
- **Browser footprint**: Each search instance spawns a headless Chromium browser. `MAX_BROWSERS: 2` limits parallelism.
- **Content length**: `MAX_CONTENT_LENGTH: 10000` chars per page. Very long pages are truncated.
- **No JavaScript-heavy SPAs**: Some single-page applications may not render content correctly in headless mode without interaction.

---

## Related Agents

| Agent | Relationship |
|-------|-------------|
| `browser-agent` | Handles interactive web browsing; `web-researcher` handles search and read-only fetches |
| `code-explorer` | Handles local codebase search; `web-researcher` handles external web search |
| `dispatcher` | Routes tasks to `web-researcher` based on trigger phrases |
