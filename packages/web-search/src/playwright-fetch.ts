import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parse } from "node-html-parser";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const DEFAULT_TIMEOUT_SECONDS = 45;
const DEFAULT_MAX_LENGTH = 50000;
const require = createRequire(import.meta.url);

const playwrightFetchParametersSchema = z.object({
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
  waitMs: z.number().int().min(0).max(15000).optional().default(1500),
});

export type PlaywrightFetchParams = z.infer<typeof playwrightFetchParametersSchema>;

export interface PlaywrightFetchResponse {
  url: string;
  title: string;
  content: string;
  links: string[];
  tookMs: number;
  rendered: true;
}

type PlaywrightFetchResultData = PlaywrightFetchResponse;

interface PlaywrightPage {
  goto(
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number },
  ): Promise<unknown>;
  waitForTimeout(timeoutMs: number): Promise<void>;
  content(): Promise<string>;
  close(): Promise<void>;
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
}

interface PlaywrightBrowser {
  newContext(options?: { userAgent?: string; locale?: string }): Promise<PlaywrightContext>;
  close(): Promise<void>;
}

interface PlaywrightModule {
  chromium: {
    launch(options?: { headless?: boolean }): Promise<PlaywrightBrowser>;
  };
}

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
  return (element.text ?? "").replace(/\s+/g, " ").trim();
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
        return;
      }
    }
  });

  return Array.from(links).slice(0, 100);
}

function isBotChallenge(html: string): boolean {
  return /g-recaptcha|are you a human|challenge-form|cloudflare|bot detection/i.test(html);
}

async function resolvePlaywrightModule(): Promise<PlaywrightModule | null> {
  if (process.env.DIRICODE_DISABLE_PLAYWRIGHT === "1") {
    return null;
  }

  const candidates = [
    (() => {
      try {
        return require.resolve("playwright");
      } catch {
        return null;
      }
    })(),
    process.env.PLAYWRIGHT_PACKAGE_PATH ?? null,
    process.env.npm_config_prefix
      ? `${process.env.npm_config_prefix}/lib/node_modules/playwright/index.mjs`
      : null,
    "/opt/homebrew/lib/node_modules/playwright/index.mjs",
    "/usr/local/lib/node_modules/playwright/index.mjs",
    "/usr/lib/node_modules/playwright/index.mjs",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      const imported = (await import(pathToFileURL(candidate).href)) as PlaywrightModule;
      if ("chromium" in imported) {
        return imported;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function runPlaywrightFetch(params: {
  url: string;
  maxLength?: number;
  extractLinks?: boolean;
  waitMs?: number;
  timeoutSeconds?: number;
}): Promise<PlaywrightFetchResponse> {
  const playwright = await resolvePlaywrightModule();
  if (!playwright) {
    throw new ToolError("PLAYWRIGHT_UNAVAILABLE", "Playwright is not available on this system.");
  }

  const maxLength = params.maxLength ?? DEFAULT_MAX_LENGTH;
  const waitMs = params.waitMs ?? 1500;
  const timeoutMs = (params.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS) * 1000;

  let browser: PlaywrightBrowser | null = null;
  let context: PlaywrightContext | null = null;
  let page: PlaywrightPage | null = null;
  const startedAt = Date.now();

  try {
    browser = await playwright.chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      locale: "en-US",
    });
    page = await context.newPage();
    await page.goto(params.url, { waitUntil: "networkidle", timeout: timeoutMs });
    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    const html = await page.content();

    if (isBotChallenge(html)) {
      throw new ToolError(
        "BOT_DETECTED",
        "Page returned a bot-detection challenge after browser rendering.",
      );
    }
     
    const root = parse(html) as ParseElement;
    const title = extractTitle(root);
    const body = root.querySelector("body") ?? root;
    let content = extractTextContent(body);
    if (content.length > maxLength) {
      content = content.slice(0, maxLength) + "...[truncated]";
    }

    return {
      url: params.url,
      title,
      content,
      links: params.extractLinks ? extractLinks(root) : [],
      tookMs: Date.now() - startedAt,
      rendered: true,
    };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new ToolError(
      "FETCH_ERROR",
      `Playwright fetch failed for ${params.url}: ${errorMessage}`,
    );
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
    if (context) {
      await context.close().catch(() => undefined);
    }
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

export const playwrightFetchTool: Tool<PlaywrightFetchParams, PlaywrightFetchResultData> = {
  name: "playwright_fetch",
  description:
    "Fetch and extract rendered page content from a URL using Playwright. " +
    "Use as fetch step 3 only after web_fetch and exa_crawl are insufficient, especially for JavaScript-heavy or stubborn pages. " +
    "Closes browser resources on success and failure.",
  parameters: playwrightFetchParametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: PlaywrightFetchParams,
    context: ToolContext,
  ): Promise<ToolResult<PlaywrightFetchResultData>> {
    context.emit("tool.start", { tool: "playwright_fetch", params: { url: params.url } });

    try {
      const result = await runPlaywrightFetch({
        url: params.url,
        maxLength: params.maxLength as number | undefined,
        extractLinks: params.extractLinks as boolean | undefined,
        waitMs: params.waitMs as number | undefined,
      });

      context.emit("tool.end", { tool: "playwright_fetch", tookMs: result.tookMs });
      return { success: true, data: result };
    } catch (error) {
      context.emit("tool.error", { tool: "playwright_fetch", error: "FETCH_FAILED" });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw error instanceof ToolError
        ? error
        : new ToolError("FETCH_ERROR", `Playwright fetch failed: ${errorMessage}`);
    }
  },
};

export { runPlaywrightFetch };
