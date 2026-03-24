import { readdir, readFile, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { normalize, relative, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const SYMBOL_KINDS = [
  "file",
  "module",
  "namespace",
  "package",
  "class",
  "method",
  "property",
  "field",
  "constructor",
  "enum",
  "interface",
  "function",
  "variable",
  "constant",
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "key",
  "null",
  "enummember",
  "struct",
  "event",
  "operator",
  "typeparameter",
] as const;

export type SymbolKind = (typeof SYMBOL_KINDS)[number];

const parametersSchema = z.object({
  path: z.string().min(1),
  query: z.string().optional(),
  kinds: z.array(z.enum(SYMBOL_KINDS)).optional(),
});

type LspSymbolsParams = z.infer<typeof parametersSchema>;

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  line: number;
  column: number;
  containerName?: string;
}

export interface LspSymbolsResult {
  symbols: SymbolInfo[];
  count: number;
  file: string;
}

const EXTENSION_TO_LANG = new Map<string, string>([
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".mts", "typescript"],
  [".cts", "typescript"],
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".py", "python"],
  [".rs", "rust"],
  [".go", "go"],
  [".java", "java"],
]);

function getFileLanguage(filePath: string): string | undefined {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return undefined;
  const ext = filePath.slice(lastDot);
  return EXTENSION_TO_LANG.get(ext);
}

const TS_SYMBOL_PATTERNS: Array<{
  regex: RegExp;
  kind: SymbolKind;
  nameGroup: number;
  containerGroup?: number;
}> = [
  {
    regex: /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    kind: "class",
    nameGroup: 1,
  },
  {
    regex: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
    kind: "interface",
    nameGroup: 1,
  },
  {
    regex: /^\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*[(<]/,
    kind: "function",
    nameGroup: 1,
  },
  {
    regex: /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
    kind: "variable",
    nameGroup: 1,
  },
  {
    regex: /^\s*(?:export\s+)?(?:const)\s+([A-Za-z_$][\w$]*)\s*=/,
    kind: "constant",
    nameGroup: 1,
  },
  {
    regex: /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/,
    kind: "typeparameter",
    nameGroup: 1,
  },
  {
    regex: /^\s*(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/,
    kind: "enum",
    nameGroup: 1,
  },
  {
    regex:
      /^\s*(?:public|private|protected|readonly|static|abstract|override|async)(?:\s+(?:public|private|protected|readonly|static|abstract|override|async))*\s+(?:\*\s*)?([A-Za-z_$][\w$]*)\s*[(<:]/,
    kind: "method",
    nameGroup: 1,
  },
  {
    regex: /^\s*(?:constructor)\s*\(/,
    kind: "constructor",
    nameGroup: 0,
  },
];

function extractSymbolsFromContent(content: string): SymbolInfo[] {
  const lines = content.split("\n");
  const symbols: SymbolInfo[] = [];
  let currentClass: string | undefined;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx] ?? "";

    for (const { regex, kind, nameGroup } of TS_SYMBOL_PATTERNS) {
      const match = regex.exec(line);
      if (!match) continue;

      const name = nameGroup === 0 ? "constructor" : (match[nameGroup] ?? "");
      if (!name) continue;

      const column = line.search(/\S/) + 1;

      if (kind === "class" || kind === "interface" || kind === "enum") {
        currentClass = name;
      }

      symbols.push({
        name,
        kind,
        line: lineIdx + 1,
        column: Math.max(1, column),
        ...(currentClass && kind !== "class" && kind !== "interface" && kind !== "enum"
          ? { containerName: currentClass }
          : {}),
      });
      break;
    }
  }

  return symbols;
}

const DEFAULT_EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next"]);

async function walkDirectory(dir: string): Promise<string[]> {
  const results: string[] = [];

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (DEFAULT_EXCLUDE_DIRS.has(entry.name)) continue;

    const fullPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkDirectory(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && getFileLanguage(entry.name) !== undefined) {
      results.push(fullPath);
    }
  }

  return results;
}

export const lspSymbolsTool: Tool<LspSymbolsParams, LspSymbolsResult> = {
  name: "lsp-symbols",
  description:
    "Extract symbols (classes, functions, interfaces, variables, etc.) from a source file or " +
    "search for symbols by name across the workspace. Optionally filter by symbol kind.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: LspSymbolsParams,
    context: ToolContext,
  ): Promise<ToolResult<LspSymbolsResult>> {
    context.emit("tool.start", { tool: "lsp-symbols", params });

    const normalizedRoot = resolve(context.workspaceRoot);
    const resolvedPath = resolve(normalizedRoot, normalize(params.path));

    if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
      throw new ToolError("PATH_OUTSIDE_WORKSPACE", `Path "${params.path}" is outside workspace`);
    }

    let fileStat: Awaited<ReturnType<typeof stat>>;
    try {
      fileStat = await stat(resolvedPath);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new ToolError("FILE_NOT_FOUND", `Path not found: "${params.path}"`);
      }
      throw err;
    }

    let allSymbols: SymbolInfo[] = [];

    if (fileStat.isFile()) {
      const buffer = Buffer.from(await readFile(resolvedPath));
      const content = buffer.toString("utf-8");
      allSymbols = extractSymbolsFromContent(content);
    } else {
      const filePaths = await walkDirectory(resolvedPath);
      for (const filePath of filePaths) {
        try {
          const buffer = Buffer.from(await readFile(filePath));
          const content = buffer.toString("utf-8");
          const fileSymbols = extractSymbolsFromContent(content);
          allSymbols.push(...fileSymbols);
        } catch {
          continue;
        }
      }
    }

    if (params.kinds && params.kinds.length > 0) {
      const kindSet = new Set<string>(params.kinds);
      allSymbols = allSymbols.filter((s) => kindSet.has(s.kind));
    }

    if (params.query) {
      const q = params.query.toLowerCase();
      allSymbols = allSymbols.filter((s) => s.name.toLowerCase().includes(q));
    }

    const result: LspSymbolsResult = {
      symbols: allSymbols,
      count: allSymbols.length,
      file: relative(normalizedRoot, resolvedPath),
    };

    context.emit("tool.end", {
      tool: "lsp-symbols",
      path: resolvedPath,
      count: allSymbols.length,
    });

    return { success: true, data: result };
  },
};
