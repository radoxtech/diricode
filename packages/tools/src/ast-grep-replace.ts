import { readFile, stat, writeFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { normalize, relative, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";
import {
  type FileWriteSafetyConfig,
  DEFAULT_FILE_SAFETY_CONFIG,
  runFileWriteSafetyCheck,
  checkSymlinkSafety,
} from "./file-safety.js";

const parametersSchema = z.object({
  pattern: z.string().min(1),
  replacement: z.string().min(1),
  language: z
    .enum(["typescript", "javascript", "tsx", "jsx", "python", "rust", "go", "java", "css", "html"])
    .default("typescript"),
  path: z.string().optional(),
  dryRun: z.boolean().default(true),
  maxResults: z.number().int().min(1).max(1000).default(100),
});

type AstGrepReplaceParams = z.infer<typeof parametersSchema>;

export interface AstGrepReplaceChange {
  file: string;
  line: number;
  column: number;
  matchedText: string;
  replacement: string;
  applied: boolean;
}

export interface AstGrepReplaceResult {
  changes: AstGrepReplaceChange[];
  count: number;
  filesSearched: number;
  filesModified: number;
  applied: boolean;
  truncated: boolean;
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildReplacementRegex(pattern: string): { regex: RegExp; varNames: string[] } {
  const parts = pattern.split(/(\$\$\$|\$[A-Z_][A-Z0-9_]*)/g);
  const varNames: string[] = [];

  let regexSource = "";
  for (const part of parts) {
    if (part === "$$$") {
      regexSource += "([\\s\\S]*?)";
      varNames.push("$$$");
    } else if (/^\$[A-Z_][A-Z0-9_]*$/.test(part)) {
      regexSource += "([\\w\"'`]+)";
      varNames.push(part);
    } else {
      const escaped = escapeRegex(part);
      regexSource += escaped.replace(/\\ /g, "\\s+");
    }
  }

  let regex: RegExp;
  try {
    regex = new RegExp(regexSource, "s");
  } catch {
    regex = new RegExp(escapeRegex(pattern), "s");
  }

  return { regex, varNames };
}

function applyReplacementTemplate(
  replacementTemplate: string,
  match: RegExpExecArray,
  varNames: string[],
): string {
  let result = replacementTemplate;
  for (let i = 0; i < varNames.length; i++) {
    const varName = varNames[i];
    if (varName !== undefined && varName !== "$$$") {
      const captured = match[i + 1] ?? "";
      result = result.split(varName).join(captured);
    }
  }
  return result;
}

export const astGrepReplaceTool: Tool<AstGrepReplaceParams, AstGrepReplaceResult> = {
  name: "ast-grep-replace",
  description:
    "Search for structural code patterns across source files using AST-grep-style meta-variables " +
    "and replace them with a replacement template. Supports $VAR (single token) and $$$ (any sequence) " +
    "wildcards. By default operates in dry-run mode (no files modified). Set dryRun: false to apply changes.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  async execute(
    params: AstGrepReplaceParams,
    context: ToolContext,
  ): Promise<ToolResult<AstGrepReplaceResult>> {
    context.emit("tool.start", { tool: "ast-grep-replace", params });

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

    const { regex: patternRegex, varNames } = buildReplacementRegex(params.pattern);
    const isMultiLine = params.pattern.includes("$$$");

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
        const result: AstGrepReplaceResult = {
          changes: [],
          count: 0,
          filesSearched: 0,
          filesModified: 0,
          applied: false,
          truncated: false,
        };
        context.emit("tool.end", {
          tool: "ast-grep-replace",
          count: 0,
          truncated: false,
          filesSearched: 0,
          filesModified: 0,
          applied: false,
        });
        return { success: true, data: result };
      }
      throw err;
    }

    interface FileMatch {
      filePath: string;
      content: string;
      fileMode: number;
      changes: Array<{
        line: number;
        column: number;
        matchedText: string;
        replacement: string;
        startOffset: number;
        endOffset: number;
      }>;
    }

    const fileMatches: FileMatch[] = [];
    let truncated = false;
    let totalChanges = 0;
    let filesSearched = 0;

    outer: for (const filePath of filePaths) {
      if (totalChanges >= params.maxResults) {
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

      const fileChangeList: FileMatch["changes"] = [];

      if (isMultiLine) {
        const windowSize = 10;
        for (let startLine = 0; startLine < lines.length; startLine++) {
          if (totalChanges + fileChangeList.length >= params.maxResults) {
            truncated = true;
            break outer;
          }
          const endLine = Math.min(startLine + windowSize, lines.length);
          const window = lines.slice(startLine, endLine).join("\n");

          patternRegex.lastIndex = 0;
          const match = patternRegex.exec(window);
          if (match) {
            let windowStartOffset = 0;
            for (let i = 0; i < startLine; i++) {
              windowStartOffset += (lines[i]?.length ?? 0) + 1;
            }

            const matchStart = windowStartOffset + match.index;
            const matchEnd = matchStart + match[0].length;
            const computedReplacement = applyReplacementTemplate(
              params.replacement,
              match,
              varNames,
            );

            fileChangeList.push({
              line: startLine + 1,
              column: match.index + 1,
              matchedText: match[0].slice(0, 200),
              replacement: computedReplacement,
              startOffset: matchStart,
              endOffset: matchEnd,
            });
            startLine += match[0].split("\n").length - 1;
          }
        }
      } else {
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (totalChanges + fileChangeList.length >= params.maxResults) {
            truncated = true;
            break outer;
          }
          const line = lines[lineIdx] ?? "";
          patternRegex.lastIndex = 0;
          const match = patternRegex.exec(line);
          if (match) {
            let lineStartOffset = 0;
            for (let i = 0; i < lineIdx; i++) {
              lineStartOffset += (lines[i]?.length ?? 0) + 1;
            }

            const matchStart = lineStartOffset + match.index;
            const matchEnd = matchStart + match[0].length;
            const computedReplacement = applyReplacementTemplate(
              params.replacement,
              match,
              varNames,
            );

            fileChangeList.push({
              line: lineIdx + 1,
              column: match.index + 1,
              matchedText: match[0],
              replacement: computedReplacement,
              startOffset: matchStart,
              endOffset: matchEnd,
            });
          }
        }
      }

      if (fileChangeList.length > 0) {
        let fileMode: number;
        try {
          const fileStat = await stat(filePath);
          fileMode = Number(fileStat.mode) & 0o777;
        } catch {
          continue;
        }
        fileMatches.push({ filePath, content, fileMode, changes: fileChangeList });
        totalChanges += fileChangeList.length;
      }
    }

    if (totalChanges === 0) {
      const result: AstGrepReplaceResult = {
        changes: [],
        count: 0,
        filesSearched,
        filesModified: 0,
        applied: false,
        truncated,
      };
      context.emit("tool.end", {
        tool: "ast-grep-replace",
        count: 0,
        truncated,
        filesSearched,
        filesModified: 0,
        applied: false,
      });
      return { success: true, data: result };
    }

    if (params.dryRun) {
      const changes: AstGrepReplaceChange[] = [];
      for (const fm of fileMatches) {
        for (const c of fm.changes) {
          changes.push({
            file: relative(normalizedRoot, fm.filePath),
            line: c.line,
            column: c.column,
            matchedText: c.matchedText,
            replacement: c.replacement,
            applied: false,
          });
        }
      }

      const result: AstGrepReplaceResult = {
        changes,
        count: changes.length,
        filesSearched,
        filesModified: 0,
        applied: false,
        truncated,
      };
      context.emit("tool.end", {
        tool: "ast-grep-replace",
        count: changes.length,
        truncated,
        filesSearched,
        filesModified: 0,
        applied: false,
      });
      return { success: true, data: result };
    }

    const safetyConfig: FileWriteSafetyConfig =
      (context as ToolContext & { fileWriteSafety?: FileWriteSafetyConfig }).fileWriteSafety ??
      DEFAULT_FILE_SAFETY_CONFIG;

    for (const fm of fileMatches) {
      runFileWriteSafetyCheck(fm.filePath, context.workspaceRoot, safetyConfig);
      await checkSymlinkSafety(fm.filePath, context.workspaceRoot, safetyConfig);
    }

    const changes: AstGrepReplaceChange[] = [];
    let filesModified = 0;

    for (const fm of fileMatches) {
      const sortedChanges = [...fm.changes].sort((a, b) => b.startOffset - a.startOffset);

      let updatedContent = fm.content;
      for (const c of sortedChanges) {
        updatedContent =
          updatedContent.slice(0, c.startOffset) +
          c.replacement +
          updatedContent.slice(c.endOffset);
      }

      const mode = fm.fileMode;
      await writeFile(fm.filePath, updatedContent, { encoding: "utf-8", mode });
      filesModified++;

      for (const c of fm.changes) {
        changes.push({
          file: relative(normalizedRoot, fm.filePath),
          line: c.line,
          column: c.column,
          matchedText: c.matchedText,
          replacement: c.replacement,
          applied: true,
        });
      }
    }

    const result: AstGrepReplaceResult = {
      changes,
      count: changes.length,
      filesSearched,
      filesModified,
      applied: true,
      truncated,
    };

    context.emit("tool.end", {
      tool: "ast-grep-replace",
      count: changes.length,
      truncated,
      filesSearched,
      filesModified,
      applied: true,
    });

    return { success: true, data: result };
  },
};
