import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";
import TurndownService from "turndown";

const parametersSchema = z.object({
  url: z.string().url().describe("The URL to fetch content from"),
  format: z.enum(["markdown", "text", "html"]).default("markdown").describe("The format to return the content in"),
  timeout: z.number().int().min(1000).max(60000).default(30000).describe("Timeout in milliseconds (max 60000)"),
});

type WebFetchParams = z.infer<typeof parametersSchema>;

interface WebFetchResult {
  content: string;
  url: string;
  format: string;
  truncated: boolean;
}

/** 2 MiB limit for web content. */
const MAX_WEB_OUTPUT_BYTES = 2 * 1024 * 1024;

export const webFetchTool: Tool<WebFetchParams, WebFetchResult> = {
  name: "web-fetch",
  description: "Fetches content from a specified URL. Supports optional markdown conversion.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: WebFetchParams, context: ToolContext): Promise<ToolResult<WebFetchResult>> {
    context.emit("tool.start", { tool: "web-fetch", params });

    const { url, timeout } = params;

    // Protocol safety check
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new ToolError("INVALID_PROTOCOL", "Only http and https protocols are supported");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "DiriCode/0.0.0 (https://github.com/radoxtech/diricode)",
          "Accept": params.format === "html" ? "text/html" : "text/html,text/plain,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        throw new ToolError(
          "HTTP_ERROR",
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`
        );
      }

      let content = "";
      const html = await response.text();

      if (params.format === "markdown") {
        const turndownService = new TurndownService();
        content = turndownService.turndown(html);
      } else if (params.format === "html") {
        content = html;
      } else {
        // Simple plain text extraction from HTML
        content = html.replace(/<[^>]*>?/gm, "").trim();
      }

      let truncated = false;
      if (Buffer.byteLength(content, "utf-8") > MAX_WEB_OUTPUT_BYTES) {
        const truncatedBuffer = Buffer.from(content, "utf-8").subarray(0, MAX_WEB_OUTPUT_BYTES);
        content = truncatedBuffer.toString("utf-8");
        truncated = true;
      }

      const result: WebFetchResult = {
        content,
        url,
        format: params.format,
        truncated,
      };

      context.emit("tool.end", { tool: "web-fetch", url, truncated });
      return { success: true, data: result };

    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new ToolError("TIMEOUT", `Fetch timeout after ${timeout}ms`);
      }
      throw new ToolError("FETCH_ERROR", `Failed to fetch ${url}: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
