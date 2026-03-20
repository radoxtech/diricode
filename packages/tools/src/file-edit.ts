import { readFile, stat, writeFile } from "node:fs/promises";
import { normalize, relative, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  path: z.string().min(1),
  oldString: z.string().min(1),
  newString: z.string(),
  replaceAll: z.boolean().default(false),
});

type FileEditParams = z.infer<typeof parametersSchema>;

interface FileEditResult {
  path: string;
  matchCount: number;
  replacements: number;
  preview: string;
}

/**
 * Detect binary files by checking for null bytes or a high proportion of
 * non-UTF-8-printable bytes in the first 8 KB of the buffer.
 */
function isBinaryBuffer(buf: Buffer): boolean {
  const sampleSize = Math.min(buf.length, 8192);
  for (let i = 0; i < sampleSize; i++) {
    if (buf[i] === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Count non-overlapping occurrences of `needle` in `haystack`.
 */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

/**
 * Replace the first occurrence of `needle` in `haystack` with `replacement`.
 */
function replaceFirst(haystack: string, needle: string, replacement: string): string {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

/**
 * Replace all occurrences of `needle` in `haystack` with `replacement`.
 * Does NOT use RegExp to avoid escaping issues.
 */
function replaceAll(haystack: string, needle: string, replacement: string): string {
  let result = "";
  let pos = 0;
  let idx: number;
  while ((idx = haystack.indexOf(needle, pos)) !== -1) {
    result += haystack.slice(pos, idx) + replacement;
    pos = idx + needle.length;
  }
  result += haystack.slice(pos);
  return result;
}

/**
 * Build a short preview of the replacement context (up to ~3 lines around
 * the first replacement site).
 */
function buildPreview(_original: string, updated: string, newString: string): string {
  const idx = updated.indexOf(newString);
  if (idx === -1) return updated.slice(0, 120);

  const start = Math.max(0, updated.lastIndexOf("\n", idx - 1) + 1);
  const endOfNewString = idx + newString.length;
  const nextNl = updated.indexOf("\n", endOfNewString);

  // Include one line of context before/after when available
  const prevNl = updated.lastIndexOf("\n", start - 2);
  const contextStart = prevNl === -1 ? 0 : prevNl + 1;
  const nextNextNl = nextNl === -1 ? -1 : updated.indexOf("\n", nextNl + 1);
  const contextEnd = nextNextNl === -1 ? updated.length : nextNextNl;

  const snippet = updated.slice(contextStart, contextEnd);
  return snippet.length > 300 ? snippet.slice(0, 297) + "..." : snippet;
}

export const fileEditTool: Tool<FileEditParams, FileEditResult> = {
  name: "file-edit",
  description:
    "Search for an exact string in a file and replace it with another string. " +
    "By default replaces only the first occurrence; set replaceAll to true to replace all.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  async execute(params: FileEditParams, context: ToolContext): Promise<ToolResult<FileEditResult>> {
    context.emit("tool.start", { tool: "file-edit", params });

    const resolvedPath = resolve(context.workspaceRoot, normalize(params.path));
    const normalizedRoot = resolve(context.workspaceRoot);

    if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
      throw new ToolError(
        "PATH_OUTSIDE_WORKSPACE",
        `Path "${params.path}" resolves outside workspace root (resolved: ${relative(normalizedRoot, resolvedPath)})`,
      );
    }

    let fileStat: Awaited<ReturnType<typeof stat>>;
    try {
      fileStat = await stat(resolvedPath);
    } catch {
      throw new ToolError("FILE_NOT_FOUND", `File not found: "${params.path}"`);
    }

    const rawBuffer = await readFile(resolvedPath);
    if (isBinaryBuffer(rawBuffer)) {
      throw new ToolError("BINARY_FILE", `File "${params.path}" appears to be a binary file and cannot be edited as text`);
    }

    const original = rawBuffer.toString("utf-8");

    if (params.oldString === params.newString) {
      const matchCount = countOccurrences(original, params.oldString);
      context.emit("tool.end", {
        tool: "file-edit",
        path: resolvedPath,
        matchCount,
        replacements: 0,
        warning: "oldString and newString are identical; no changes made",
      });
      return {
        success: true,
        data: {
          path: resolvedPath,
          matchCount,
          replacements: 0,
          preview: "",
        },
      };
    }

    const matchCount = countOccurrences(original, params.oldString);

    if (matchCount === 0) {
      throw new ToolError("NO_MATCH", `String not found in "${params.path}": ${JSON.stringify(params.oldString)}`);
    }

    if (matchCount > 1 && !params.replaceAll) {
      throw new ToolError(
        "MULTIPLE_MATCHES",
        `Found ${matchCount} occurrences of the search string in "${params.path}". ` +
          `Use replaceAll: true to replace all, or make oldString more specific.`,
      );
    }

    const updated = params.replaceAll
      ? replaceAll(original, params.oldString, params.newString)
      : replaceFirst(original, params.oldString, params.newString);

    const replacements = params.replaceAll ? matchCount : 1;

    const mode = fileStat.mode & 0o777;
    await writeFile(resolvedPath, updated, { encoding: "utf-8", mode });

    const preview = buildPreview(original, updated, params.newString);

    context.emit("tool.end", { tool: "file-edit", path: resolvedPath, matchCount, replacements });

    return {
      success: true,
      data: {
        path: resolvedPath,
        matchCount,
        replacements,
        preview,
      },
    };
  },
};
