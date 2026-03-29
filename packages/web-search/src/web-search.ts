import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";
import { exaSearchTool } from "./exa.js";
import { runSearxngSearch } from "./searxng.js";

const webSearchParametersSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  count: z.number().int().min(1).max(20).optional().default(10),
  type: z.enum(["auto", "neural", "fast", "deep", "deep-reasoning", "instant"]).optional(),
  engines: z.array(z.string()).optional(),
  categories: z.string().optional().default("general"),
  language: z.string().optional().default("auto"),
  safeSearch: z.number().int().min(0).max(2).optional().default(0),
});

export type WebSearchParams = z.infer<typeof webSearchParametersSchema>;

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
  category?: string;
  publishedDate?: string;
}

export interface WebSearchResponse {
  query: string;
  provider: "exa" | "searxng";
  count: number;
  tookMs: number;
  results: WebSearchResult[];
  searxngUrl?: string;
}

function getConfiguredSearxngUrl(): string | null {
  return process.env.DIRICODE_SEARXNG_URL ?? process.env.SEARXNG_BASE_URL ?? null;
}

export const webSearchTool: Tool<WebSearchParams, WebSearchResponse> = {
  name: "web_search",
  description:
    "Default web search. Use SearXNG when DIRICODE_SEARXNG_URL or SEARXNG_BASE_URL is configured because it often gives better factual and local results. " +
    "Otherwise use Exa. For thorough research, it is still valid to call searxng_search and exa_search separately and compare both result sets.",
  parameters: webSearchParametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: WebSearchParams, context: ToolContext): Promise<ToolResult<WebSearchResponse>> {
    context.emit("tool.start", { tool: "web_search", params });

    try {
      const searxngUrl = getConfiguredSearxngUrl();
      if (searxngUrl) {
        const result = await runSearxngSearch({
          query: params.query,
          count: params.count,
          engines: params.engines,
          categories: params.categories,
          language: params.language,
          safeSearch: params.safeSearch,
          searxngUrl,
        });

        const normalized: WebSearchResponse = {
          query: result.query,
          provider: "searxng",
          count: result.count,
          tookMs: result.tookMs,
          searxngUrl: result.searxngUrl,
          results: result.results.map((entry) => ({
            title: entry.title,
            url: entry.url,
            snippet: entry.snippet,
            engine: entry.engine,
            category: entry.category,
            publishedDate: entry.published,
          })),
        };

        context.emit("tool.end", {
          tool: "web_search",
          provider: normalized.provider,
          count: normalized.count,
          tookMs: normalized.tookMs,
        });

        return { success: true, data: normalized };
      }

      const result = await exaSearchTool.execute(
        {
          query: params.query,
          numResults: params.count,
          type: params.type ?? "auto",
        },
        { emit: () => undefined, workspaceRoot: process.cwd() },
      );

      const normalized: WebSearchResponse = {
        query: result.data.query,
        provider: "exa",
        count: result.data.count,
        tookMs: result.data.tookMs,
        results: result.data.results.map((entry) => ({
          title: entry.title,
          url: entry.url,
          snippet: entry.snippet,
          publishedDate: entry.publishedDate,
        })),
      };

      context.emit("tool.end", {
        tool: "web_search",
        provider: normalized.provider,
        count: normalized.count,
        tookMs: normalized.tookMs,
      });

      return { success: true, data: normalized };
    } catch (error) {
      context.emit("tool.error", { tool: "web_search", error: "SEARCH_FAILED" });
      throw error instanceof ToolError
        ? error
        : new ToolError("SEARCH_ERROR", `Web search failed: ${(error as Error).message}`);
    }
  },
};

export { webSearchParametersSchema };
