# Agent Spec: web-researcher

> **Agent Name**: `web-researcher`
> **Tier**: MEDIUM
> **Category**: research
> **Ships in**: MVP
> **Native Tools**: `@diricode/web-search` (web_search, web_fetch, code_context, searxng_search)
> **Default Search**: Exa Search (free, no API key required via public MCP server)
> **References**: ADR-004 (agent roster), ADR-015 (tool annotations), ADR-041 (native tool approach)

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
- Use `webSearch` for general web search through Exa
- Use `webFetch` first for a known URL, then `exaCrawl`, then `playwrightFetch` only if the page is still hard to extract
- Use `searxngSearch` as an additional metasearch tool when SearXNG is available
- Use both `webSearch` and `searxngSearch` when a thorough search benefits from multiple sources
- Always cite the source URL alongside any finding
- Do not invent information not found on the web
- Synthesize results into clear, concise answers — avoid raw dumps of page content
- Never modify files; this agent is read-only

---

## Tool Access

Native tools from `@diricode/web-search` package. Tool whitelist is strictly enforced.

| Tool | Description | Notes |
|------|-------------|-------|
| `webSearch` | Default dispatcher: SearXNG when configured, otherwise Exa | Preferred default search surface |
| `webFetch` | HTML parsing and content extraction | Fetch step 1 |
| `searxngSearch` | SearXNG metasearch (self-hosted) | Direct SearXNG access when you want to force or compare it |
| `exaSearch` | Exa AI-optimized search (free) | Direct Exa access when you want to force or compare it |
| `exaCodeContext` | Code search from GitHub/StackOverflow | Uses Exa MCP (free) |
| `exaCrawl` | Full page extraction via Exa | Fetch step 2 |
| `playwrightFetch` | Browser-rendered fetch via Playwright | Fetch step 3 for JS-heavy or stubborn pages |

**All tools are read-only** — they will auto-approve under ADR-014 smart approval rules. No user confirmation required for search operations.

**Search strategy:**
1. `webSearch` - use SearXNG by default when DIRICODE_SEARXNG_URL or SEARXNG_BASE_URL is configured; otherwise use Exa
2. `searxngSearch` - direct SearXNG search when you explicitly want that engine
3. `exaSearch` - direct Exa search when you explicitly want that engine
4. Use both `searxngSearch` and `exaSearch` when you want broader coverage or cross-checking across providers

**Fetch strategy:**
1. `webFetch` - fast default fetch
2. `exaCrawl` - stronger extraction step when the first fetch is weak
3. `playwrightFetch` - browser-rendered last resort for stubborn pages

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

## SearXNG Setup (Optional)

For an additional self-hosted search source, run SearXNG:

```bash
docker run -d -p 8888:8080 -e SEARCH_RESULTS_PER_PAGE=20 --name searxng searxng/searxng:latest
```

Configure in `.dc/config.jsonc`:

```jsonc
"searxng": {
  "baseUrl": "http://localhost:8888"
}
```

**When to use**: You want a second independent search engine alongside Exa for broader or cross-checked research.

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

- **Content currency**: Search results reflect the web's current state. Documentation may be outdated for rapidly evolving libraries.
- **No JavaScript rendering**: `webFetch` parses static HTML only. JavaScript-heavy SPAs may not render correctly.
- **Content length**: Pages are truncated at ~500KB. Very long pages are partially extracted.
- **SearXNG requires Docker**: Self-hosted alternative requires running a SearXNG container.
- **Exa public MCP limits**: Public MCP access may have provider-side limits under heavy usage.

---

## Related Agents

| Agent | Relationship |
|-------|-------------|
| `browser-agent` | Handles interactive web browsing; `web-researcher` handles search and read-only fetches |
| `code-explorer` | Handles local codebase search; `web-researcher` handles external web search |
| `dispatcher` | Routes tasks to `web-researcher` based on trigger phrases |
