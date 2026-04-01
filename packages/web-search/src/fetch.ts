/**
 * Web Fetch - Extract readable content from any URL
 *
 * Uses node-html-parser to extract clean text content from web pages.
 */

import { z } from "zod";
import { parse } from "node-html-parser";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const DEFAULT_TIMEOUT_SECONDS = 30;
const DEFAULT_MAX_LENGTH = 50000;

const fetchParametersSchema = z.object({
  url: z.string().url(),
  maxLength: z
    .number()
    .int()
    .min(1000)
    .max(200000)
    .optional()
    .default(DEFAULT_MAX_LENGTH)
    .describe("Maximum content length to extract"),
  extractLinks: z.boolean().optional().default(false).describe("Extract all links from page"),
});

export type FetchParams = z.infer<typeof fetchParametersSchema>;

export interface FetchResponse {
  url: string;
  title: string;
  content: string;
  links: string[];
  tookMs: number;
}

type FetchResultData = FetchResponse;

interface ParseElement {
  text: string;
  querySelector: (
    sel: string,
  ) => { text?: string; getAttribute: (attr: string) => string | null } | null;
  querySelectorAll: (sel: string) => { getAttribute: (attr: string) => string | null }[];
}

function extractTextContent(
  element: ParseElement | { text?: string; getAttribute: (attr: string) => string | null },
): string {
  const text = (element.text ?? "").replace(/\s+/g, " ").trim();
  return text;
}

function extractTitle(element: ParseElement): string {
  const titleTag = element.querySelector("title");
  if (titleTag?.text) {
    return titleTag.text.trim();
  }

  const h1 = element.querySelector("h1");
  if (h1?.text) {
    return h1.text.trim();
  }

  const ogTitle = element.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    return ogTitle.getAttribute("content") ?? "";
  }

  return "";
}

function extractLinks(element: ParseElement): string[] {
  const links = new Set<string>();

  element.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      try {
        const parsedUrl = new URL(href);
        links.add(parsedUrl.toString());
      } catch {
        // Relative URL - skip
      }
    }
  });

  return Array.from(links).slice(0, 100);
}

function isBotChallenge(html: string): boolean {
  return /g-recaptcha|are you a human|challenge-form|cloudflare|bot detection/i.test(html);
}

async function runWebFetch(params: {
  url: string;
  maxLength?: number;
  extractLinks?: boolean;
  timeoutSeconds?: number;
}): Promise<FetchResponse> {
  const maxLength = params.maxLength ?? DEFAULT_MAX_LENGTH;
  const timeoutMs = (params.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(params.url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Agent/1.0; +https://diricode.com/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ToolError(
        "FETCH_ERROR",
        `Failed to fetch ${params.url} (${String(response.status)}): ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      throw new ToolError(
        "NOT_HTML",
        `URL does not return HTML content (${contentType}). Use web_search to find pages, then web_fetch to extract content.`,
      );
    }

    const html = await response.text();

    if (isBotChallenge(html)) {
      throw new ToolError(
        "BOT_DETECTED",
        "Page returned a bot-detection challenge. Cannot extract content.",
      );
    }

    const startedAt = Date.now();
     
    const root = parse(html) as ParseElement;

    const title = extractTitle(root);

    const body = root.querySelector("body") ?? root;

    let content = extractTextContent(body);

    if (content.length > maxLength) {
      content = content.slice(0, maxLength) + "...[truncated]";
    }

    const links = params.extractLinks ? extractLinks(root) : [];

    return {
      url: params.url,
      title,
      content,
      links,
      tookMs: Date.now() - startedAt,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ToolError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ToolError("TIMEOUT", `Fetch timed out after ${String(timeoutMs)}ms`);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new ToolError("FETCH_ERROR", `Failed to fetch ${params.url}: ${errorMessage}`);
  }
}

export const webFetchTool: Tool<FetchParams, FetchResultData> = {
  name: "web_fetch",
  description:
    "Fetch and extract readable content from a URL. " +
    "Use after web_search to get full content from a discovered page. " +
    "This is fetch step 1: try this first, then use exa_crawl for stronger extraction, then playwright_fetch for JavaScript-heavy or stubborn pages. " +
    "Returns title, text content, and optionally all links on the page.",
  parameters: fetchParametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: FetchParams, context: ToolContext): Promise<ToolResult<FetchResultData>> {
    context.emit("tool.start", { tool: "web_fetch", params: { url: params.url } });

    try {
      const result = await runWebFetch({
        url: params.url,
        maxLength: params.maxLength as number | undefined,
        extractLinks: params.extractLinks as boolean | undefined,
      });

      context.emit("tool.end", { tool: "web_fetch", tookMs: result.tookMs });

      return { success: true, data: result };
    } catch (error) {
      context.emit("tool.error", { tool: "web_fetch", error: "FETCH_FAILED" });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw error instanceof ToolError
        ? error
        : new ToolError("FETCH_ERROR", `Web fetch failed: ${errorMessage}`);
    }
  },
};

export { runWebFetch };
