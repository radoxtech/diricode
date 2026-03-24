import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { normalize, relative, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  pattern: z.string().min(1),
  language: z
    .enum(["typescript", "javascript", "tsx", "jsx", "python", "rust", "go", "java", "css", "html"])
    .default("typescript"),
  path: z.string().optional(),
  maxResults: z.number().int().min(1).max(1000).default(100),
});

type AstGrepParams = z.infer<typeof parametersSchema>;

export interface AstGrepMatch {
  file: string;
  line: number;
  column: number;
  matchedText: string;
  context: string;
}

export interface AstGrepResult {
  matches: AstGrepMatch[];
  count: number;
  truncated: boolean;
  filesSearched: number;
}

const LANG_EXTENSIONS: Record<string, string[]> = {
  typescript: [".ts", ".mts", ".cts"],
  javascript: [".js", ".mjs", ".cjs"],
  tsx: [".tsx"],
  jsx: [".jsx"],
  python: [".py"],
  rust: [".rs"],
  go: [".go"],
  java: [".java"],
  css: [".css", ".scss", ".less"],
  html: [".html", ".htm"],
};

const DEFAULT_EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next"]);

function getExtensionsForLang(language: string): string[] {
  return LANG_EXTENSIONS[language] ?? [];
}

function isBinaryContent(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

async function walkDirectory(dir: string, extensions: string[]): Promise<string[]> {
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
      const nested = await walkDirectory(fullPath, extensions);
      results.push(...nested);
    } else if (entry.isFile()) {
      const hasMatchingExt = extensions.some((ext) => entry.name.endsWith(ext));
      if (hasMatchingExt) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Escape a string for use in a RegExp without special-char meaning.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convert an AST-grep-style pattern to a regular expression.
 *
 * Meta-variables:
 *   $VAR  — matches a single identifier or literal token
 *   $$$   — matches any sequence of tokens (including newlines)
 *
 * This is a best-effort structural approximation using regex. True AST
 * matching requires a full language parser; we intentionally avoid that
 * dependency here and trade precision for zero native deps.
 */
function buildPatternRegex(pattern: string): RegExp {
  // Split on meta-variable markers, preserving the delimiters
  const parts = pattern.split(/(\$\$\$|\$[A-Z_][A-Z0-9_]*)/g);

  let regexSource = "";
  for (const part of parts) {
    if (part === "$$$") {
      // $$$ matches any sequence of characters (non-greedy, across lines)
      regexSource += "[\\s\\S]*?";
    } else if (/^\$[A-Z_][A-Z0-9_]*$/.test(part)) {
      // $VAR matches a single identifier, number, or quoted string token
      regexSource += "[\\w\"'`]+";
    } else {
      // Literal text — escape and allow flexible whitespace between tokens
      const escaped = escapeRegex(part);
      // Allow arbitrary whitespace where whitespace already exists in the pattern
      regexSource += escaped.replace(/\\ /g, "\\s+");
    }
  }

  try {
    return new RegExp(regexSource, "s");
  } catch {
    // Fallback: treat the whole pattern as a literal substring search
    return new RegExp(escapeRegex(pattern), "s");
  }
}

export const astGrepTool: Tool<AstGrepParams, AstGrepResult> = {
  name: "ast-grep",
  description:
    "Search for structural code patterns across source files using AST-grep-style meta-variables. " +
    "Supports $VAR (single token) and $$$ (any sequence) wildcards. " +
    "Filters files by language extension.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: AstGrepParams, context: ToolContext): Promise<ToolResult<AstGrepResult>> {
    context.emit("tool.start", { tool: "ast-grep", params });

    const extensions = getExtensionsForLang(params.language);
    if (extensions.length === 0) {
      throw new ToolError("UNSUPPORTED_LANGUAGE", `Language "${params.language}" is not supported`);
    }

    const normalizedRoot = resolve(context.workspaceRoot);
    let searchRoot: string;

    if (params.path) {
      const resolvedPath = resolve(normalizedRoot, normalize(params.path));
      if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
        throw new ToolError(
          "PATH_OUTSIDE_WORKSPACE",
          `Path "${params.path}" resolves outside workspace root`,
        );
      }
      searchRoot = resolvedPath;
    } else {
      searchRoot = normalizedRoot;
    }

    const patternRegex = buildPatternRegex(params.pattern);

    let filePaths: string[];
    try {
      const searchStat = await stat(searchRoot);
      if (searchStat.isFile()) {
        filePaths = [searchRoot];
      } else {
        filePaths = await walkDirectory(searchRoot, extensions);
      }
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        const result: AstGrepResult = {
          matches: [],
          count: 0,
          truncated: false,
          filesSearched: 0,
        };
        context.emit("tool.end", {
          tool: "ast-grep",
          count: 0,
          truncated: false,
          filesSearched: 0,
        });
        return { success: true, data: result };
      }
      throw err;
    }

    const matches: AstGrepMatch[] = [];
    let truncated = false;
    let filesSearched = 0;

    for (const filePath of filePaths) {
      if (matches.length >= params.maxResults) {
        truncated = true;
        break;
      }

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
      const content = buffer.toString("utf-8");
      const lines = content.split("\n");

      // Scan line by line for single-line patterns; for multi-line patterns
      // (containing $$$) we scan a sliding window of up to 10 lines.
      const isMultiLine = params.pattern.includes("$$$");

      if (isMultiLine) {
        const windowSize = 10;
        for (let startLine = 0; startLine < lines.length; startLine++) {
          if (matches.length >= params.maxResults) {
            truncated = true;
            break;
          }
          const endLine = Math.min(startLine + windowSize, lines.length);
          const window = lines.slice(startLine, endLine).join("\n");

          patternRegex.lastIndex = 0;
          const match = patternRegex.exec(window);
          if (match) {
            matches.push({
              file: relative(normalizedRoot, filePath),
              line: startLine + 1,
              column: match.index + 1,
              matchedText: match[0].slice(0, 200),
              context: lines[startLine] ?? "",
            });
            // Skip ahead past the match to avoid overlapping windows
            startLine += match[0].split("\n").length - 1;
          }
        }
      } else {
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (matches.length >= params.maxResults) {
            truncated = true;
            break;
          }
          const line = lines[lineIdx] ?? "";
          patternRegex.lastIndex = 0;
          const match = patternRegex.exec(line);
          if (match) {
            matches.push({
              file: relative(normalizedRoot, filePath),
              line: lineIdx + 1,
              column: match.index + 1,
              matchedText: match[0],
              context: line,
            });
          }
        }
      }
    }

    const result: AstGrepResult = {
      matches,
      count: matches.length,
      truncated,
      filesSearched,
    };

    context.emit("tool.end", {
      tool: "ast-grep",
      count: matches.length,
      truncated,
      filesSearched,
    });

    return { success: true, data: result };
  },
};
