# ADR-041 — Native TypeScript Web Research (Supersedes MCP Approach)

| Field       | Value                                                         |
|-------------|---------------------------------------------------------------|
| Status      | Accepted                                                      |
| Date        | 2026-03-19 (updated 2026-03-28)                              |
| Scope       | MVP                                                           |
| References  | ADR-004 (agent roster 3 tiers), ADR-015 (tool annotations), ADR-033 (interceptor/wrapper split) |
| Supersedes  | Original ADR-041 which recommended `web-search-mcp` MCP server |

### Context

DiriCode requires web research capabilities for the `web-researcher` agent role: searching the web for documentation, code examples, and best practices.

Revised constraint: **zero Docker, zero API keys by default**. Docker is acceptable as an optional enhancement (SearXNG) but not required for basic functionality.

Evaluation criteria updated:

- **API-key-free default search**: Web search must work without any API key or Docker
- **TypeScript native**: Tools implemented as native TypeScript packages, not MCP servers
- **Docker optional**: SearXNG as enhancement for better results (requires Docker)
- **Multiple search sources**: Exa default plus optional SearXNG as a second search source

### Decision

**Search approach:**

| Tool | Implementation | Requirements | Role |
|------|----------------|-------------|------|
| `webSearch` | Exa public MCP server | None (free, no API key) | Default web search |
| `webFetch` | HTML parsing with node-html-parser | None | Read specific URLs |
| `searxngSearch` | SearXNG metasearch engine | Docker (SearXNG container) | Optional second search source |
| `exaSearch` | Exa public MCP server | None (free, no API key) | Direct Exa access |
| `exaCodeContext` | Code search via Exa MCP | None (free) | Code/doc search |
| `exaCrawl` | Page extraction via Exa MCP | None (free) | URL extraction |

**Package**: `@diricode/web-search` (TypeScript native implementation)

**webSearch** uses Exa's public MCP server which:
- Works without API keys in the default setup
- Provides semantic search and strong general relevance
- Serves as the primary search tool in the package

**webFetch** extracts content from known URLs:
- Static HTML parsing with `node-html-parser`
- Removes scripts, styles, and navigation elements
- Returns clean text content

**searxngSearch** adds a second search engine when SearXNG is available:
- Self-hosted metasearch engine (Docker)
- Queries multiple search engines simultaneously
- No API key required
- Requires running: `docker run -d -p 8888:8080 searxng/searxng:latest`
- Should be treated as complementary to Exa, not an automatic fallback layer

**exaSearch** via public MCP:
- Uses Exa's public MCP server at `https://mcp.exa.ai/mcp`
- AI-optimized search with semantic understanding
- No API key required - works out of the box
- Also powers the default `webSearch` surface
- Also provides: `exaCodeContext` (code search), `exaCrawl` (page extraction)

### Alternatives Considered

| Approach | Reason Rejected |
|----------|-----------------|
| **MCP server (web-search-mcp)** | Requires Playwright browser binaries (~450MB), adds complexity, no Docker-free option |
| **Tavily API** | Requires API key, not free |
| **Exa API (with key)** | Requires API key - but Exa has FREE public MCP server (no key needed) |
| **Jina Reader** | Remote service, not local execution |
| **Firecrawl** | Requires API key and account registration |
| **GPT Researcher** | Requires LLM API key (OpenAI/Anthropic) |

**Why not pure MCP?** The original MCP approach required headless Chromium via Playwright. This violates the "no Docker/API keys by default" constraint. Native TypeScript implementation provides equivalent functionality without browser automation overhead.

**Exa free tier:** Exa provides a FREE public MCP server at `https://mcp.exa.ai/mcp` that doesn't require an API key. This is how OpenCode and other tools use Exa without setup.

### Consequences

**Positive:**
- **Zero Docker by default**: Default web search works without Docker or API keys
- **Zero-cost default search**: Exa public MCP works without local setup
- **Complementary search**: SearXNG can be used alongside Exa instead of as an opaque fallback
- **TypeScript native**: Tools integrate seamlessly with the existing `@diricode/tools` package
- **All tools are read-only**: Auto-approved under ADR-014 smart approval rules

**Negative / Trade-offs:**
- **Static HTML only**: JavaScript-heavy SPAs cannot be fetched by `webFetch`
- **SearXNG requires Docker**: Optional second search source requires Docker to be running
- **Exa rate limits**: Public MCP server may have rate limits under heavy usage
