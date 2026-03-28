import { createHmac } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { normalize, relative, resolve, extname } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const DEFAULT_EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", "build", ".next"]);

function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filename));
}

function detectLanguage(filePath: string): string | null {
  const ext = extname(filePath);
  if (!SUPPORTED_EXTENSIONS.has(ext)) return null;
  if (ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts") return "typescript";
  return "javascript";
}

async function readSourceFile(filePath: string): Promise<string> {
  const buffer = Buffer.from(await readFile(filePath));
  return buffer.toString("utf-8");
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
    if (DEFAULT_EXCLUDE_DIRS.has(entry.name)) continue;
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkDirectory(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && isSupportedFile(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractTokenAtPosition(content: string, line: number, character: number): string | null {
  const lines = content.split("\n");
  const lineText = lines[line - 1];
  if (lineText === undefined) return null;

  const col = character - 1;
  if (col < 0 || col > lineText.length) return null;

  let start = col;
  while (start > 0 && /\w/.test(lineText[start - 1] ?? "")) start--;
  let end = col;
  while (end < lineText.length && /\w/.test(lineText[end] ?? "")) end++;

  const token = lineText.slice(start, end);
  return token.length > 0 ? token : null;
}

function isInsideStringOrComment(lineText: string, col: number): boolean {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (let i = 0; i < col; i++) {
    const ch = lineText[i];
    const prev = i > 0 ? lineText[i - 1] : "";

    if (prev === "\\") continue; // escaped — don't toggle quote state

    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
    } else if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
    } else if (!inSingle && !inDouble && !inTemplate && ch === "/" && lineText[i + 1] === "/") {
      return true; // line comment starts before col
    }
  }

  return inSingle || inDouble || inTemplate;
}

function findTokenOccurrences(
  content: string,
  token: string,
  excludeStringsAndComments = false,
): { line: number; character: number }[] {
  const occurrences: { line: number; character: number }[] = [];
  const lines = content.split("\n");
  const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRe = new RegExp(`(?<![\\w$])${safeToken}(?![\\w$])`, "g");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    tokenRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(line)) !== null) {
      if (excludeStringsAndComments && isInsideStringOrComment(line, match.index)) continue;
      occurrences.push({ line: i + 1, character: match.index + 1 });
    }
  }
  return occurrences;
}

function findDefinitionInContent(
  content: string,
  token: string,
): { line: number; character: number }[] {
  const definitions: { line: number; character: number }[] = [];
  const lines = content.split("\n");
  const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const defPatterns = [
    new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function\\s*\\*?\\s*)${safeToken}\\s*[(<]`),
    new RegExp(`(?:export\\s+)?(?:abstract\\s+)?(?:class|interface|type|enum)\\s+${safeToken}\\b`),
    new RegExp(`(?:export\\s+)?(?:const|let|var)\\s+${safeToken}\\s*[=:,]`),
    new RegExp(
      `(?:public|private|protected|readonly|static|abstract|override|async)(?:\\s+(?:public|private|protected|readonly|static|abstract|override|async))*\\s+${safeToken}\\s*[(<]`,
    ),
    new RegExp(`\\b${safeToken}\\s*=\\s*(?:async\\s+)?(?:\\(|\\w)`),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const pattern of defPatterns) {
      if (pattern.test(line)) {
        const tokenRe = new RegExp(`(?<![\\w$])${safeToken}(?![\\w$])`);
        const m = tokenRe.exec(line);
        if (m) {
          definitions.push({ line: i + 1, character: m.index + 1 });
          break;
        }
      }
    }
  }
  return definitions;
}

function assertWithinWorkspace(
  resolvedPath: string,
  normalizedRoot: string,
  paramPath: string,
): void {
  if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
    throw new ToolError("PATH_OUTSIDE_WORKSPACE", `Path "${paramPath}" is outside workspace`);
  }
}

interface PrepareTokenPayload {
  file: string;
  line: number;
  character: number;
  token: string;
}

function signPrepareToken(payload: PrepareTokenPayload, workspaceRoot: string): string {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", workspaceRoot).update(body).digest("hex");
  return Buffer.from(JSON.stringify({ body, sig })).toString("base64");
}

function verifyPrepareToken(raw: string, workspaceRoot: string): PrepareTokenPayload {
  let outer: { body: string; sig: string };
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    const parsed: unknown = JSON.parse(decoded);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).body !== "string" ||
      typeof (parsed as Record<string, unknown>).sig !== "string"
    ) {
      throw new Error("bad shape");
    }
    outer = parsed as { body: string; sig: string };
  } catch {
    throw new ToolError(
      "INVALID_PREPARE_TOKEN",
      "prepareToken is invalid or corrupted. Call lsp-prepare-rename first.",
    );
  }

  const expectedSig = createHmac("sha256", workspaceRoot).update(outer.body).digest("hex");
  if (expectedSig !== outer.sig) {
    throw new ToolError(
      "INVALID_PREPARE_TOKEN",
      "prepareToken signature mismatch — token was forged or belongs to a different workspace.",
    );
  }

  let payload: PrepareTokenPayload;
  try {
    const p: unknown = JSON.parse(outer.body);
    if (
      typeof p !== "object" ||
      p === null ||
      typeof (p as Record<string, unknown>).file !== "string" ||
      typeof (p as Record<string, unknown>).line !== "number" ||
      typeof (p as Record<string, unknown>).character !== "number" ||
      typeof (p as Record<string, unknown>).token !== "string"
    ) {
      throw new Error("bad payload");
    }
    payload = p as PrepareTokenPayload;
  } catch {
    throw new ToolError(
      "INVALID_PREPARE_TOKEN",
      "prepareToken payload is malformed. Call lsp-prepare-rename first.",
    );
  }

  return payload;
}

const gotoDefSchema = z.object({
  file: z.string().min(1).describe("Workspace-relative path to the source file"),
  line: z.number().int().min(1).describe("1-based line number"),
  character: z.number().int().min(1).describe("1-based column / character offset"),
});

type GotoDefParams = z.infer<typeof gotoDefSchema>;

export interface GotoDefinitionLocation {
  file: string;
  line: number;
  character: number;
}

export interface GotoDefinitionResult {
  token: string;
  definitions: GotoDefinitionLocation[];
  count: number;
}

export const lspGotoDefinitionTool: Tool<GotoDefParams, GotoDefinitionResult> = {
  name: "lsp-goto-definition",
  description:
    "Jump to the definition of the symbol at the given file position. " +
    "Returns workspace-relative file paths with 1-based line and character positions. " +
    "Throws UNSUPPORTED_LANGUAGE for files outside the supported extension set.",
  parameters: gotoDefSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: GotoDefParams,
    context: ToolContext,
  ): Promise<ToolResult<GotoDefinitionResult>> {
    context.emit("tool.start", { tool: "lsp-goto-definition", params });

    const normalizedRoot = resolve(context.workspaceRoot);
    const resolvedFile = resolve(normalizedRoot, normalize(params.file));
    assertWithinWorkspace(resolvedFile, normalizedRoot, params.file);

    const lang = detectLanguage(resolvedFile);
    if (lang === null) {
      throw new ToolError(
        "UNSUPPORTED_LANGUAGE",
        `File "${params.file}" has an unsupported extension. ` +
          `Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
      );
    }

    let content: string;
    try {
      content = await readSourceFile(resolvedFile);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new ToolError("FILE_NOT_FOUND", `File not found: "${params.file}"`);
      }
      throw err;
    }

    const token = extractTokenAtPosition(content, params.line, params.character);
    if (token === null) {
      throw new ToolError(
        "NO_SYMBOL",
        `No identifier found at line ${String(params.line)}, character ${String(params.character)} in "${params.file}"`,
      );
    }

    const allFiles = await walkDirectory(normalizedRoot);
    const definitions: GotoDefinitionLocation[] = [];

    for (const filePath of allFiles) {
      let fileContent: string;
      try {
        fileContent = await readSourceFile(filePath);
      } catch {
        continue;
      }
      const found = findDefinitionInContent(fileContent, token);
      for (const loc of found) {
        definitions.push({
          file: relative(normalizedRoot, filePath),
          line: loc.line,
          character: loc.character,
        });
      }
    }

    const result: GotoDefinitionResult = {
      token,
      definitions,
      count: definitions.length,
    };

    context.emit("tool.end", {
      tool: "lsp-goto-definition",
      token,
      count: definitions.length,
    });

    return { success: true, data: result };
  },
};

const findRefsSchema = z.object({
  file: z.string().min(1).describe("Workspace-relative path to the source file"),
  line: z.number().int().min(1).describe("1-based line number"),
  character: z.number().int().min(1).describe("1-based column / character offset"),
  includeDeclaration: z
    .boolean()
    .default(true)
    .describe("Whether to include the declaration site in results"),
});

type FindRefsParams = z.infer<typeof findRefsSchema>;

export interface ReferenceLocation {
  file: string;
  line: number;
  character: number;
}

export interface FindReferencesResult {
  token: string;
  references: ReferenceLocation[];
  count: number;
}

export const lspFindReferencesTool: Tool<FindRefsParams, FindReferencesResult> = {
  name: "lsp-find-references",
  description:
    "Find all references to the symbol at the given file position across the workspace. " +
    "Returns workspace-relative paths with 1-based line and character positions. " +
    "Set includeDeclaration: false to exclude the definition site.",
  parameters: findRefsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: FindRefsParams,
    context: ToolContext,
  ): Promise<ToolResult<FindReferencesResult>> {
    context.emit("tool.start", { tool: "lsp-find-references", params });

    const normalizedRoot = resolve(context.workspaceRoot);
    const resolvedFile = resolve(normalizedRoot, normalize(params.file));
    assertWithinWorkspace(resolvedFile, normalizedRoot, params.file);

    const lang = detectLanguage(resolvedFile);
    if (lang === null) {
      throw new ToolError(
        "UNSUPPORTED_LANGUAGE",
        `File "${params.file}" has an unsupported extension. ` +
          `Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
      );
    }

    let content: string;
    try {
      content = await readSourceFile(resolvedFile);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new ToolError("FILE_NOT_FOUND", `File not found: "${params.file}"`);
      }
      throw err;
    }

    const token = extractTokenAtPosition(content, params.line, params.character);
    if (token === null) {
      throw new ToolError(
        "NO_SYMBOL",
        `No identifier found at line ${String(params.line)}, character ${String(params.character)} in "${params.file}"`,
      );
    }

    const allFiles = await walkDirectory(normalizedRoot);
    const allRefs: ReferenceLocation[] = [];

    for (const filePath of allFiles) {
      let fileContent: string;
      try {
        fileContent = await readSourceFile(filePath);
      } catch {
        continue;
      }

      const occurrences = findTokenOccurrences(fileContent, token);
      for (const occ of occurrences) {
        allRefs.push({
          file: relative(normalizedRoot, filePath),
          line: occ.line,
          character: occ.character,
        });
      }
    }

    let references = allRefs;
    if (!params.includeDeclaration) {
      const filtered: ReferenceLocation[] = [];
      for (const ref of allRefs) {
        const refFilePath = resolve(normalizedRoot, ref.file);
        let refContent: string;
        try {
          refContent = await readSourceFile(refFilePath);
        } catch {
          filtered.push(ref);
          continue;
        }
        const defs = findDefinitionInContent(refContent, token);
        const isDefLine = defs.some((d) => d.line === ref.line);
        if (!isDefLine) {
          filtered.push(ref);
        }
      }
      references = filtered;
    }

    const result: FindReferencesResult = {
      token,
      references,
      count: references.length,
    };

    context.emit("tool.end", {
      tool: "lsp-find-references",
      token,
      count: references.length,
    });

    return { success: true, data: result };
  },
};

const prepareRenameSchema = z.object({
  file: z.string().min(1).describe("Workspace-relative path to the source file"),
  line: z.number().int().min(1).describe("1-based line number"),
  character: z.number().int().min(1).describe("1-based column / character offset"),
});

type PrepareRenameParams = z.infer<typeof prepareRenameSchema>;

export interface PrepareRenameResult {
  token: string;
  file: string;
  line: number;
  character: number;
  length: number;
  /** Opaque token the agent must pass unchanged to rename-symbol as `prepareToken`. */
  prepareToken: string;
}

export const lspPrepareRenameTool: Tool<PrepareRenameParams, PrepareRenameResult> = {
  name: "lsp-prepare-rename",
  description:
    "Pre-check whether the symbol at the given position is safe to rename. " +
    "Returns the token text, its exact range, and a `prepareToken` that MUST be passed " +
    "unchanged to lsp-rename-symbol to authorise the rename. " +
    "Throws NO_SYMBOL if no identifier is found at the position. " +
    "Throws UNSUPPORTED_LANGUAGE for unsupported file types.",
  parameters: prepareRenameSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: PrepareRenameParams,
    context: ToolContext,
  ): Promise<ToolResult<PrepareRenameResult>> {
    context.emit("tool.start", { tool: "lsp-prepare-rename", params });

    const normalizedRoot = resolve(context.workspaceRoot);
    const resolvedFile = resolve(normalizedRoot, normalize(params.file));
    assertWithinWorkspace(resolvedFile, normalizedRoot, params.file);

    const lang = detectLanguage(resolvedFile);
    if (lang === null) {
      throw new ToolError(
        "UNSUPPORTED_LANGUAGE",
        `File "${params.file}" has an unsupported extension. ` +
          `Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}`,
      );
    }

    let content: string;
    try {
      content = await readSourceFile(resolvedFile);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new ToolError("FILE_NOT_FOUND", `File not found: "${params.file}"`);
      }
      throw err;
    }

    const token = extractTokenAtPosition(content, params.line, params.character);
    if (token === null) {
      throw new ToolError(
        "NO_SYMBOL",
        `No identifier found at line ${String(params.line)}, character ${String(params.character)} in "${params.file}"`,
      );
    }

    const relFile = relative(normalizedRoot, resolvedFile);
    const prepareToken = signPrepareToken(
      { file: relFile, line: params.line, character: params.character, token },
      normalizedRoot,
    );

    const result: PrepareRenameResult = {
      token,
      file: relFile,
      line: params.line,
      character: params.character,
      length: token.length,
      prepareToken,
    };

    context.emit("tool.end", {
      tool: "lsp-prepare-rename",
      token,
      file: result.file,
      line: params.line,
    });

    return { success: true, data: result };
  },
};

const renameSymbolSchema = z.object({
  prepareToken: z
    .string()
    .min(1)
    .describe("The prepareToken returned by a prior call to lsp-prepare-rename"),
  newName: z
    .string()
    .min(1)
    .regex(/^[A-Za-z_$][\w$]*$/, "newName must be a valid identifier")
    .describe("The new identifier name"),
  broadRenameThreshold: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .optional()
    .describe(
      "Maximum number of reference sites allowed before the rename is blocked as 'broad'. " +
        "Increase deliberately when a high-impact rename is intended. Defaults to 50.",
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "When true, compute and return the rename plan without writing any files. Defaults to false.",
    ),
});

type RenameSymbolParams = z.infer<typeof renameSymbolSchema>;

export interface RenameEdit {
  file: string;
  line: number;
  character: number;
  oldName: string;
  newName: string;
}

export interface RenameSymbolResult {
  token: string;
  newName: string;
  edits: RenameEdit[];
  editCount: number;
  filesAffected: number;
  dryRun: boolean;
}

export const lspRenameSymbolTool: Tool<RenameSymbolParams, RenameSymbolResult> = {
  name: "lsp-rename-symbol",
  description:
    "Rename all occurrences of a symbol across the workspace. " +
    "MUST be preceded by lsp-prepare-rename — pass its `prepareToken` here to authorise. " +
    "The `newName` must be a valid identifier. " +
    "Throws BROAD_RENAME if the operation would touch more sites than `broadRenameThreshold`. " +
    "Set dryRun: true to preview changes without writing files.",
  parameters: renameSymbolSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  async execute(
    params: RenameSymbolParams,
    context: ToolContext,
  ): Promise<ToolResult<RenameSymbolResult>> {
    context.emit("tool.start", {
      tool: "lsp-rename-symbol",
      params: { ...params, prepareToken: "[redacted]" },
    });

    const normalizedRoot = resolve(context.workspaceRoot);

    const decoded = verifyPrepareToken(params.prepareToken, normalizedRoot);
    const { token, file: preparedFile, line: preparedLine, character: preparedChar } = decoded;

    const preparedFilePath = resolve(normalizedRoot, normalize(preparedFile));
    let preparedContent: string;
    try {
      preparedContent = await readSourceFile(preparedFilePath);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new ToolError(
          "STALE_PREPARE_TOKEN",
          `The file "${preparedFile}" recorded in the prepareToken no longer exists. ` +
            "Re-run lsp-prepare-rename before renaming.",
        );
      }
      throw err;
    }

    const currentToken = extractTokenAtPosition(preparedContent, preparedLine, preparedChar);
    if (currentToken !== token) {
      throw new ToolError(
        "STALE_PREPARE_TOKEN",
        `The symbol at ${preparedFile}:${String(preparedLine)}:${String(preparedChar)} is now ` +
          `"${currentToken ?? "(none)"}" — expected "${token}". ` +
          "Re-run lsp-prepare-rename before renaming.",
      );
    }

    const allFiles = await walkDirectory(normalizedRoot);
    const edits: RenameEdit[] = [];

    for (const filePath of allFiles) {
      let fileContent: string;
      try {
        fileContent = await readSourceFile(filePath);
      } catch {
        continue;
      }
      const occurrences = findTokenOccurrences(fileContent, token, true);
      for (const occ of occurrences) {
        edits.push({
          file: relative(normalizedRoot, filePath),
          line: occ.line,
          character: occ.character,
          oldName: token,
          newName: params.newName,
        });
      }
    }

    if (edits.length > (params.broadRenameThreshold ?? 50)) {
      throw new ToolError(
        "BROAD_RENAME",
        `Rename of "${token}" → "${params.newName}" would touch ${String(edits.length)} sites, ` +
          `exceeding broadRenameThreshold of ${String(params.broadRenameThreshold ?? 50)}. ` +
          `Inspect references with lsp-find-references first, then increase broadRenameThreshold if intentional.`,
      );
    }

    const affectedFiles = new Set(edits.map((e) => e.file));

    if (!(params.dryRun ?? false)) {
      const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const tokenRe = new RegExp(`(?<![\\w$])${safeToken}(?![\\w$])`, "g");

      const byFile = new Map<string, true>();
      for (const edit of edits) byFile.set(edit.file, true);

      for (const relPath of byFile.keys()) {
        const filePath = resolve(normalizedRoot, relPath);
        let fileContent: string;
        try {
          fileContent = await readSourceFile(filePath);
        } catch {
          continue;
        }
        const lines = fileContent.split("\n");
        const updated = lines
          .map((line) => {
            const result: string[] = [];
            let lastIndex = 0;
            tokenRe.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = tokenRe.exec(line)) !== null) {
              if (!isInsideStringOrComment(line, match.index)) {
                result.push(line.slice(lastIndex, match.index));
                result.push(params.newName);
                lastIndex = match.index + token.length;
              }
            }
            result.push(line.slice(lastIndex));
            return result.join("");
          })
          .join("\n");
        await writeFile(filePath, updated, "utf-8");
      }
    }

    const result: RenameSymbolResult = {
      token,
      newName: params.newName,
      edits,
      editCount: edits.length,
      filesAffected: affectedFiles.size,
      dryRun: params.dryRun ?? false,
    };

    context.emit("tool.end", {
      tool: "lsp-rename-symbol",
      token,
      newName: params.newName,
      editCount: edits.length,
      filesAffected: affectedFiles.size,
      dryRun: params.dryRun ?? false,
    });

    return { success: true, data: result };
  },
};

const lspDiagnosticsSchema = z.object({
  file: z.string().min(1).describe("Workspace-relative path to the source file to inspect"),
  maxDiagnostics: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Maximum number of diagnostic items to return. Defaults to 100."),
});

type LspDiagnosticsParams = z.infer<typeof lspDiagnosticsSchema>;

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface LspDiagnosticItem {
  file: string;
  line: number;
  character: number;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
}

export interface LspDiagnosticsResult {
  file: string;
  language: string;
  diagnostics: LspDiagnosticItem[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
  truncated: boolean;
}

/**
 * Lightweight static checks applied to TypeScript/JavaScript source text.
 *
 * These are best-effort heuristics — a real language server is the source of
 * truth. The goal here is to surface actionable feedback quickly without
 * requiring an external process.
 */
function runStaticChecks(
  content: string,
  relPath: string,
  maxDiagnostics: number,
): LspDiagnosticItem[] {
  const diagnostics: LspDiagnosticItem[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length && diagnostics.length < maxDiagnostics; i++) {
    const line = lines[i] ?? "";
    const lineNum = i + 1;

    // DIAG-001: console.log (hint — debug artefact)
    const consoleMatch = /\bconsole\.(log|warn|error|debug|info)\s*\(/.exec(line);
    if (consoleMatch) {
      diagnostics.push({
        file: relPath,
        line: lineNum,
        character: consoleMatch.index + 1,
        severity: "hint",
        code: "DIAG-001",
        message: `console.${consoleMatch[1] ?? "log"} call found — consider removing debug output`,
      });
    }

    // DIAG-002: TODO/FIXME comments (info)
    const todoMatch = /\/\/\s*(TODO|FIXME|HACK|XXX)\b(.*)/.exec(line);
    if (todoMatch) {
      diagnostics.push({
        file: relPath,
        line: lineNum,
        character: todoMatch.index + 1,
        severity: "info",
        code: "DIAG-002",
        message: `${todoMatch[1] ?? "TODO"}: ${todoMatch[2]?.trim() ?? ""}`,
      });
    }

    // DIAG-003: use of `any` type (warning)
    const anyMatch = /:\s*any\b/.exec(line);
    if (anyMatch) {
      diagnostics.push({
        file: relPath,
        line: lineNum,
        character: anyMatch.index + 1,
        severity: "warning",
        code: "DIAG-003",
        message: "Explicit `any` type found — prefer a more precise type annotation",
      });
    }

    // DIAG-004: non-null assertion operator usage (warning)
    const nonNullMatch = /[A-Za-z_$][\w$]*!\./.exec(line);
    if (nonNullMatch) {
      diagnostics.push({
        file: relPath,
        line: lineNum,
        character: nonNullMatch.index + 1,
        severity: "warning",
        code: "DIAG-004",
        message: "Non-null assertion operator (`!.`) detected — consider null-safe access instead",
      });
    }

    // DIAG-005: @ts-ignore / @ts-expect-error (warning)
    const tsIgnoreMatch = /@ts-(ignore|expect-error)\b/.exec(line);
    if (tsIgnoreMatch) {
      diagnostics.push({
        file: relPath,
        line: lineNum,
        character: tsIgnoreMatch.index + 1,
        severity: "warning",
        code: "DIAG-005",
        message: `${tsIgnoreMatch[0]} suppresses type errors — resolve the underlying issue instead`,
      });
    }
  }

  return diagnostics;
}

export const lspFileDiagnosticsTool: Tool<LspDiagnosticsParams, LspDiagnosticsResult> = {
  name: "lsp-file-diagnostics",
  description:
    "Run lightweight static diagnostics on a single source file and return structured " +
    "diagnostic items with file, line, character, severity, code, and message. " +
    "Covers: debug console calls (DIAG-001), TODO/FIXME annotations (DIAG-002), " +
    "explicit `any` types (DIAG-003), non-null assertions (DIAG-004), and " +
    "ts-ignore/ts-expect-error suppressions (DIAG-005). " +
    "Throws UNSUPPORTED_LANGUAGE for unsupported file types.",
  parameters: lspDiagnosticsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: LspDiagnosticsParams,
    context: ToolContext,
  ): Promise<ToolResult<LspDiagnosticsResult>> {
    context.emit("tool.start", { tool: "lsp-file-diagnostics", params });

    const normalizedRoot = resolve(context.workspaceRoot);
    const resolvedFile = resolve(normalizedRoot, normalize(params.file));
    assertWithinWorkspace(resolvedFile, normalizedRoot, params.file);

    const lang = detectLanguage(resolvedFile);
    if (lang === null) {
      throw new ToolError(
        "UNSUPPORTED_LANGUAGE",
        `File "${params.file}" has an unsupported extension. ` +
          `Supported: ${[...SUPPORTED_EXTENSIONS].join(", ")}. ` +
          `For build-level diagnostics on arbitrary files, use the diagnostics tool (tsc/eslint/biome).`,
      );
    }

    let content: string;
    try {
      content = await readSourceFile(resolvedFile);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new ToolError("FILE_NOT_FOUND", `File not found: "${params.file}"`);
      }
      throw err;
    }

    const relPath = relative(normalizedRoot, resolvedFile);
    const max = params.maxDiagnostics ?? 100;
    const allDiagnostics = runStaticChecks(content, relPath, max);

    const truncated = allDiagnostics.length >= max;
    const diagnostics = allDiagnostics.slice(0, max);

    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
    const infoCount = diagnostics.filter((d) => d.severity === "info").length;
    const hintCount = diagnostics.filter((d) => d.severity === "hint").length;

    const result: LspDiagnosticsResult = {
      file: relPath,
      language: lang,
      diagnostics,
      errorCount,
      warningCount,
      infoCount,
      hintCount,
      truncated,
    };

    context.emit("tool.end", {
      tool: "lsp-file-diagnostics",
      file: relPath,
      errorCount,
      warningCount,
      infoCount,
      hintCount,
      truncated,
    });

    return { success: true, data: result };
  },
};

export const lspNavigationTools = [
  lspGotoDefinitionTool,
  lspFindReferencesTool,
  lspPrepareRenameTool,
  lspRenameSymbolTool,
  lspFileDiagnosticsTool,
] as const;
