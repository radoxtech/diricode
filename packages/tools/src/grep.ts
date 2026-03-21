import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { normalize, relative, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  pattern: z.string().min(1),
  path: z.string().optional(),
  include: z.string().optional(),
  caseSensitive: z.boolean().default(true),
  maxResults: z.number().int().min(1).max(5000).default(500),
  contextLines: z.number().int().min(0).max(10).default(0),
});

type GrepParams = z.infer<typeof parametersSchema>;

interface GrepMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  context: {
    before: string[];
    after: string[];
  };
}

interface GrepResult {
  matches: GrepMatch[];
  count: number;
  truncated: boolean;
  filesSearched: number;
}

const DEFAULT_EXCLUDE_DIRS = new Set([".git", "node_modules", "dist"]);

function isBinaryContent(buffer: Buffer): boolean {
  // Null-byte heuristic (first 8 KiB) — same approach as `git diff`
  const checkLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

function matchesInclude(filename: string, include: string): boolean {
  if (include.startsWith("*.")) {
    const ext = include.slice(1);
    return filename.endsWith(ext);
  }

  const braceRegex = /^\*\.\{(.+)\}$/;
  const braceMatch = braceRegex.exec(include);
  if (braceMatch?.[1]) {
    const exts = braceMatch[1].split(",").map((e) => `.${e.trim()}`);
    return exts.some((ext) => filename.endsWith(ext));
  }

  return filename === include;
}

async function walkDirectory(dir: string): Promise<string[]> {
  const results: string[] = [];

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (DEFAULT_EXCLUDE_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkDirectory(fullPath);
      results.push(...nested);
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

export const grepTool: Tool<GrepParams, GrepResult> = {
  name: "grep",
  description:
    "Search for a regex pattern across files in the workspace. " +
    "Supports optional path scoping, glob file filtering, case sensitivity, " +
    "result limits, and context lines around matches.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: GrepParams, context: ToolContext): Promise<ToolResult<GrepResult>> {
    context.emit("tool.start", { tool: "grep", params });

    let regex: RegExp;
    try {
      regex = new RegExp(params.pattern, params.caseSensitive ? "" : "i");
    } catch (err) {
      throw new ToolError(
        "INVALID_REGEX",
        `Invalid regular expression: "${params.pattern}" — ${(err as Error).message}`,
      );
    }

    const normalizedRoot = resolve(context.workspaceRoot);
    let searchRoot: string;

    if (params.path) {
      const resolvedPath = resolve(normalizedRoot, normalize(params.path));
      if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
        throw new ToolError(
          "PATH_OUTSIDE_WORKSPACE",
          `Path "${params.path}" resolves outside workspace root (resolved: ${relative(normalizedRoot, resolvedPath)})`,
        );
      }
      searchRoot = resolvedPath;
    } else {
      searchRoot = normalizedRoot;
    }

    let filePaths: string[];
    try {
      const searchStat = await stat(searchRoot);
      filePaths = searchStat.isFile() ? [searchRoot] : await walkDirectory(searchRoot);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        const result: GrepResult = { matches: [], count: 0, truncated: false, filesSearched: 0 };
        context.emit("tool.end", { tool: "grep", count: 0, truncated: false, filesSearched: 0 });
        return { success: true, data: result };
      }
      throw err;
    }

    if (params.include) {
      filePaths = filePaths.filter((fp) => {
        const basename = fp.split("/").pop() ?? fp;
        return matchesInclude(basename, params.include);
      });
    }

    const matches: GrepMatch[] = [];
    let truncated = false;
    let filesSearched = 0;

    outer: for (const filePath of filePaths) {
      let buffer: Buffer;
      try {
        buffer = Buffer.from(await readFile(filePath));
      } catch {
        continue;
      }

      if (isBinaryContent(buffer)) {
        continue;
      }

      filesSearched++;

      const lines = buffer.toString("utf-8").split("\n");

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx] ?? "";

        // Reset lastIndex is required for stateful regexes with the `g` or `y` flag
        regex.lastIndex = 0;
        const match = regex.exec(line);
        if (!match) continue;

        const beforeStart = Math.max(0, lineIdx - params.contextLines);
        const afterEnd = Math.min(lines.length - 1, lineIdx + params.contextLines);

        matches.push({
          file: relative(normalizedRoot, filePath),
          line: lineIdx + 1,
          column: match.index + 1,
          content: line,
          context: {
            before: lines.slice(beforeStart, lineIdx),
            after: lines.slice(lineIdx + 1, afterEnd + 1),
          },
        });

        if (matches.length >= params.maxResults) {
          let hasMore = false;

          for (let k = lineIdx + 1; k < lines.length; k++) {
            regex.lastIndex = 0;
            if (regex.test(lines[k] ?? "")) {
              hasMore = true;
              break;
            }
          }

          if (!hasMore) {
            const remainingFiles = filePaths.slice(filePaths.indexOf(filePath) + 1);
            hasMore = remainingFiles.length > 0;
          }

          truncated = hasMore;
          break outer;
        }
      }
    }

    const result: GrepResult = {
      matches,
      count: matches.length,
      truncated,
      filesSearched,
    };

    context.emit("tool.end", { tool: "grep", count: matches.length, truncated, filesSearched });

    return { success: true, data: result };
  },
};
