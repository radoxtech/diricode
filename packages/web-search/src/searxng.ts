/**
 * SearXNG Web Search - Tier 2 (recommended for better results)
 *
 * SearXNG is a self-hosted metasearch engine that aggregates results from
 * multiple search engines. Requires Docker but provides much better results.
 *
 * Docker setup:
 *   docker run -d -p 8080:8080 --name searxng searxng/searxng
 *
 * Then enable JSON format in settings.yml:
 *   search:
 *     formats:
 *       - html
 *       - json
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const DEFAULT_TIMEOUT_SECONDS = 20;
const DEFAULT_SEARCH_COUNT = 10;
const DEFAULT_SEARXNG_URL = "http://localhost:8080";

const searchParametersSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  count: z.number().int().min(1).max(20).optional().default(10),
  engines: z
    .array(z.string())
    .optional()
    .describe("Specific engines to use (e.g., google, bing, brave)"),
  categories: z.string().optional().default("general").describe("Search category"),
  language: z.string().optional().default("auto"),
  safeSearch: z.number().int().min(0).max(2).optional().default(0),
});

export type SearchParams = z.infer<typeof searchParametersSchema>;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
  category?: string;
  published?: string;
}

export interface SearchResponse {
  query: string;
  provider: "searxng";
  count: number;
  tookMs: number;
  results: SearchResult[];
  cached?: boolean;
  searxngUrl: string;
}

type SearchResultData = SearchResponse;

interface SearxngResponse {
  results?: SearxngResult[];
}

interface SearxngResult {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  category?: string;
  publishedDate?: string;
}

const searchCache = new Map<string, { value: SearchResponse; expiresAt: number }>();

async function runSearxngSearch(params: {
  query: string;
  count?: number;
  engines?: string[];
  categories?: string;
  language?: string;
  safeSearch?: number;
  searxngUrl?: string;
  timeoutSeconds?: number;
}): Promise<SearchResponse> {
  const count = params.count ?? DEFAULT_SEARCH_COUNT;
  const searxngUrl = (params.searxngUrl ?? DEFAULT_SEARXNG_URL).replace(/\/$/, "");
  const timeoutMs = (params.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

  const cacheKey = JSON.stringify({
    provider: "searxng",
    query: params.query,
    count,
    engines: params.engines?.join(",") ?? "",
    categories: params.categories ?? "general",
    language: params.language ?? "auto",
    safeSearch: params.safeSearch ?? 0,
    searxngUrl,
  });

  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.value, cached: true };
  }

  const endpoint = new URL("search", searxngUrl + "/");
  endpoint.searchParams.set("q", params.query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("categories", params.categories ?? "general");
  endpoint.searchParams.set("language", params.language ?? "auto");
  endpoint.searchParams.set("safesearch", String(params.safeSearch ?? 0));

  if (params.engines && params.engines.length > 0) {
    endpoint.searchParams.set("engines", params.engines.join(","));
  }

  const startedAt = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => { controller.abort(); }, timeoutMs);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; AI-Agent/1.0; +https://diricode.com/bot)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await response.text();
      throw new ToolError(
        "SEARCH_ERROR",
        `SearXNG error (${String(response.status)}): ${detail || response.statusText}`,
      );
    }

    const data = (await response.json()) as SearxngResponse;
    const raw = Array.isArray(data.results) ? data.results : [];
    const trimmed = raw.slice(0, count);

    const results: SearchResult[] = trimmed.map((entry) => ({
      title: entry.title ?? "",
      url: entry.url ?? "",
      snippet: entry.content ?? "",
      engine: entry.engine,
      category: entry.category,
      published: entry.publishedDate,
    }));

    const payload: SearchResponse = {
      query: params.query,
      provider: "searxng",
      count: results.length,
      tookMs: Date.now() - startedAt,
      results,
      searxngUrl,
    };

    searchCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return payload;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ToolError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ToolError("TIMEOUT", `Search timed out after ${String(timeoutMs)}ms`);
    }

    throw new ToolError(
      "SEARCH_ERROR",
      `SearXNG search failed: ${(error as Error).message}. Make sure SearXNG is running at ${searxngUrl} with JSON format enabled.`,
    );
  }
}

export const searxngSearchTool: Tool<SearchParams, SearchResultData> = {
  name: "searxng_search",
  description:
    "Search the web using SearXNG (self-hosted metasearch engine). " +
    "Requires SearXNG Docker container running. " +
    "Use this directly when you want to force SearXNG or compare it against Exa. " +
    "When SearXNG is configured, the generic web_search tool should usually prefer it by default.",
  parameters: searchParametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: SearchParams, context: ToolContext): Promise<ToolResult<SearchResultData>> {
    context.emit("tool.start", { tool: "searxng_search", params });

    try {
      const result = await runSearxngSearch({
        query: params.query,
        count: params.count,
        engines: params.engines,
        categories: params.categories,
        language: params.language,
        safeSearch: params.safeSearch,
      });

      context.emit("tool.end", {
        tool: "searxng_search",
        count: result.count,
        tookMs: result.tookMs,
      });

      return { success: true, data: result };
    } catch (error) {
      context.emit("tool.error", { tool: "searxng_search", error: "SEARCH_FAILED" });
      throw error instanceof ToolError
        ? error
        : new ToolError("SEARCH_ERROR", `SearXNG search failed: ${(error as Error).message}`);
    }
  },
};

export { runSearxngSearch };
