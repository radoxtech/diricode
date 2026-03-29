import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webFetchTool } from "../web-fetch.js";
import type { ToolContext } from "@diricode/core";

describe("web-fetch tool", () => {
  let context: ToolContext;

  beforeEach(() => {
    context = {
      workspaceRoot: "/test/workspace",
      emit: vi.fn(),
    } as unknown as ToolContext;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("successfully fetches markdown content", async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue("<h1>Hello World</h1>"),
      headers: new Map([["content-type", "text/html"]]),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const result = await webFetchTool.execute({ url: "https://example.com", format: "markdown", timeout: 30000 }, context);

    expect(result.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.success) {
      expect(result.data.content.trim()).toBe("Hello World\n===========");
      expect(result.data.url).toBe("https://example.com");
    }
    expect(context.emit).toHaveBeenCalledWith("tool.start", expect.any(Object));
    expect(context.emit).toHaveBeenCalledWith("tool.end", expect.any(Object));
  });

  it("handles HTTP errors", async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: "Not Found",
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    await expect(webFetchTool.execute({ url: "https://example.com/404", format: "markdown", timeout: 30000 }, context))
      .rejects.toThrow("Failed to fetch https://example.com/404: 404 Not Found");
  });

  it("throws for invalid protocols", async () => {
    await expect(webFetchTool.execute({ url: "ftp://example.com", format: "markdown", timeout: 30000 }, context))
      .rejects.toThrow("Only http and https protocols are supported");
  });

  it("handles timeouts", async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const err = new Error("Fetch timeout");
          err.name = "AbortError";
          reject(err);
        }, 100);
      });
    });

    const promise = webFetchTool.execute({ url: "https://example.com", timeout: 50, format: "markdown" }, context);
    await expect(promise).rejects.toThrow("Fetch timeout after 50ms");
  });
});
