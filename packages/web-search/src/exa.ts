import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const EXA_MCP_ENDPOINT = "https://mcp.exa.ai/mcp";
const DEFAULT_TIMEOUT_SECONDS = 30;

const searchParametersSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  numResults: z.number().int().min(1).max(100).optional().default(10),
  type: z
    .enum(["auto", "neural", "fast", "deep", "deep-reasoning", "instant"])
    .optional()
    .default("auto"),
});

const codeContextParametersSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  tokensNum: z.number().int().min(1000).max(50000).optional().default(5000),
});

const crawlParametersSchema = z.object({
  url: z.string().url("Must be a valid URL").min(1),
  prompt: z.string().optional(),
});

type SearchParams = z.infer<typeof searchParametersSchema>;
type CodeContextParams = z.infer<typeof codeContextParametersSchema>;
type CrawlParams = z.infer<typeof crawlParametersSchema>;

interface ExaSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

interface ExaSearchResponse {
  query: string;
  provider: "exa";
  count: number;
  tookMs: number;
  results: ExaSearchResult[];
}

interface ExaCodeContextResponse {
  query: string;
  provider: "exa";
  results: {
    url: string;
    text: string;
    score: number;
  }[];
}

interface ExaCrawlResponse {
  url: string;
  content: string;
  text: string;
}

interface McpRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

function parseExaTextResults(text: string): ExaSearchResult[] {
  const results: ExaSearchResult[] = [];
  const entries = text.split(/---\n/);

  for (const entry of entries) {
    const titleMatch = /Title:\s*(.+)/.exec(entry);
    const urlMatch = /URL:\s*(.+)/.exec(entry);
    const publishedMatch = /Published:\s*(.+)/.exec(entry);
    const highlightsMatch = /Highlights:\n([\s\S]*?)(?=^---|$)/m.exec(entry);

    if (titleMatch && urlMatch && titleMatch[1] && urlMatch[1]) {
      const title = titleMatch[1].trim();
      const url = urlMatch[1].trim();
      const snippet = highlightsMatch?.[1]?.trim().replace(/\n+/g, " ") ?? "";
      const published = publishedMatch?.[1]?.trim();
      results.push({
        title,
        url,
        snippet,
        publishedDate: published && published !== "N/A" ? published : undefined,
      });
    }
  }

  return results;
}

function parseExaCodeResults(text: string): { url: string; text: string; score: number }[] {
  const results: { url: string; text: string; score: number }[] = [];
  const entries = text.split(/---\n/);

  for (const entry of entries) {
    const titleMatch = /Title:\s*(.+)/.exec(entry);
    const urlMatch = /URL:\s*(.+)/.exec(entry);
    const codeMatch = /Code\/Highlights:\n([\s\S]*?)(?=^---|$)/m.exec(entry);

    if (urlMatch?.[1]) {
      const url = urlMatch[1].trim();
      const codeText = codeMatch?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? "";
      results.push({
        url,
        text: codeText,
        score: 0,
      });
    }
  }

  return results;
}

let requestId = 1;

async function callMcpTool(
  toolName: string,
  arguments_: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, timeoutMs);

  const request: McpRequest = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: arguments_,
    },
  };

  try {
    const response = await fetch(EXA_MCP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new ToolError(
        "MCP_ERROR",
        `Exa MCP server error (${String(response.status)}): ${text || response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    let data: McpResponse;
    if (contentType.includes("text/event-stream")) {
      const text = await response.text();
      const lines = text.split("\n").filter((l) => l.startsWith("data: "));
      const jsonStr = lines[0]?.slice(6) ?? "{}";
      data = JSON.parse(jsonStr) as McpResponse;
    } else {
      data = (await response.json()) as McpResponse;
    }

    if (data.error) {
      throw new ToolError("MCP_ERROR", `Exa MCP error: ${data.error.message}`);
    }

    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ToolError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ToolError("TIMEOUT", `Exa search timed out after ${String(timeoutMs)}ms`);
    }

    throw new ToolError("MCP_ERROR", `Exa MCP call failed: ${(error as Error).message}`);
  }
}

export const exaSearchTool: Tool<SearchParams, ExaSearchResponse> = {
  name: "exa_search",
  description:
    "Search the web using Exa AI (free, no API key required). " +
    "Provides AI-optimized semantic search with better relevance than traditional search engines. " +
    "Use this directly when you want to force Exa or compare it against SearXNG.",
  parameters: searchParametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: SearchParams,
    context: ToolContext,
  ): Promise<ToolResult<ExaSearchResponse>> {
    context.emit("tool.start", { tool: "exa_search", params });

    const timeoutMs = DEFAULT_TIMEOUT_SECONDS * 1000;
    const startedAt = Date.now();

    try {
      const rawResult = (await callMcpTool(
        "web_search_exa",
        {
          query: params.query,
          numResults: params.numResults,
          type: params.type,
        },
        timeoutMs,
      )) as { content?: { type: string; text: string }[] } | undefined;

      const results = parseExaTextResults(rawResult?.content?.[0]?.text ?? "");

      const response: ExaSearchResponse = {
        query: params.query,
        provider: "exa",
        count: results.length,
        tookMs: Date.now() - startedAt,
        results,
      };

      context.emit("tool.end", {
        tool: "exa_search",
        count: response.count,
        tookMs: response.tookMs,
      });

      return { success: true, data: response };
    } catch (error) {
      context.emit("tool.error", { tool: "exa_search", error: "SEARCH_FAILED" });
      throw error instanceof ToolError
        ? error
        : new ToolError("SEARCH_ERROR", `Exa search failed: ${(error as Error).message}`);
    }
  },
};

export const exaCodeContextTool: Tool<CodeContextParams, ExaCodeContextResponse> = {
  name: "code_context",
  description:
    "Find code examples and documentation from GitHub, Stack Overflow using Exa AI (free, no API key). " +
    "Use when searching for code snippets, API syntax, library documentation, or debugging help.",
  parameters: codeContextParametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: CodeContextParams,
    context: ToolContext,
  ): Promise<ToolResult<ExaCodeContextResponse>> {
    context.emit("tool.start", { tool: "code_context", params });

    const timeoutMs = DEFAULT_TIMEOUT_SECONDS * 1000;

    try {
      const rawResult = (await callMcpTool(
        "get_code_context_exa",
        {
          query: params.query,
          tokensNum: params.tokensNum,
        },
        timeoutMs,
      )) as { content?: { type: string; text: string }[] } | undefined;

      const results = parseExaCodeResults(rawResult?.content?.[0]?.text ?? "");

      const response: ExaCodeContextResponse = {
        query: params.query,
        provider: "exa",
        results,
      };

      context.emit("tool.end", { tool: "code_context", count: response.results.length });

      return { success: true, data: response };
    } catch (error) {
      context.emit("tool.error", { tool: "code_context", error: "SEARCH_FAILED" });
      throw error instanceof ToolError
        ? error
        : new ToolError("SEARCH_ERROR", `Exa code search failed: ${(error as Error).message}`);
    }
  },
};

export const exaCrawlTool: Tool<CrawlParams, ExaCrawlResponse> = {
  name: "exa_crawl",
  description:
    "Get full content of a specific webpage using Exa AI (free, no API key). " +
    "Use as fetch step 2 when web_fetch returns weak or incomplete content, especially for pages that need stronger extraction but not full browser rendering.",
  parameters: crawlParametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: CrawlParams, context: ToolContext): Promise<ToolResult<ExaCrawlResponse>> {
    context.emit("tool.start", { tool: "exa_crawl", params });

    const timeoutMs = DEFAULT_TIMEOUT_SECONDS * 1000;

    try {
      const rawResult = (await callMcpTool(
        "crawling_exa",
        {
          urls: [params.url],
          ...(params.prompt && { prompt: params.prompt }),
        },
        timeoutMs,
      )) as { content?: { type: string; text: string }[] } | undefined;

      const text = rawResult?.content?.[0]?.text ?? "";

      const response: ExaCrawlResponse = {
        url: params.url,
        content: text,
        text: text,
      };

      context.emit("tool.end", { tool: "exa_crawl", url: params.url });

      return { success: true, data: response };
    } catch (error) {
      context.emit("tool.error", { tool: "exa_crawl", error: "CRAWL_FAILED" });
      throw error instanceof ToolError
        ? error
        : new ToolError("CRAWL_ERROR", `Exa crawl failed: ${(error as Error).message}`);
    }
  },
};

export type {
  SearchParams as ExaSearchParams,
  CodeContextParams as ExaCodeContextParams,
  CrawlParams as ExaCrawlParams,
};
export type { ExaSearchResult, ExaSearchResponse, ExaCodeContextResponse, ExaCrawlResponse };
export { searchParametersSchema as exaSearchParametersSchema };
