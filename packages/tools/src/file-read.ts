import { lstat, readFile, readlink, stat } from "node:fs/promises";
import { normalize, relative, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  path: z.string().min(1),
  offset: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).optional(),
});

type FileReadParams = z.infer<typeof parametersSchema>;

interface FileReadResult {
  content: string;
  lineCount: number;
  totalLines: number;
  path: string;
  truncated: boolean;
}

/** 1 MiB — prevents unbounded output from huge files. */
const MAX_OUTPUT_BYTES = 1024 * 1024;

/**
 * Null-byte heuristic (first 8 KiB) — same approach as `git diff`.
 */
function isBinaryContent(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

async function resolveAndValidatePath(
  rawPath: string,
  workspaceRoot: string,
): Promise<string> {
  const normalizedRoot = resolve(workspaceRoot);
  const resolvedPath = resolve(normalizedRoot, normalize(rawPath));

  if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
    throw new ToolError(
      "PATH_OUTSIDE_WORKSPACE",
      `Path "${rawPath}" resolves outside workspace root (resolved: ${relative(normalizedRoot, resolvedPath)})`,
    );
  }

  try {
    const lstats = await lstat(resolvedPath);
    if (lstats.isSymbolicLink()) {
      const linkTarget = await readlink(resolvedPath);
      const resolvedTarget = resolve(resolve(resolvedPath, ".."), linkTarget);
      if (!resolvedTarget.startsWith(normalizedRoot + "/") && resolvedTarget !== normalizedRoot) {
        throw new ToolError(
          "PATH_OUTSIDE_WORKSPACE",
          `Symlink "${rawPath}" points outside workspace root`,
        );
      }
    }
  } catch (err) {
    if (err instanceof ToolError) throw err;
  }

  return resolvedPath;
}

export const fileReadTool: Tool<FileReadParams, FileReadResult> = {
  name: "file-read",
  description:
    "Read the contents of a file within the workspace. Supports optional line-range windowing via offset (1-based start line) and limit (number of lines).",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: FileReadParams, context: ToolContext): Promise<ToolResult<FileReadResult>> {
    context.emit("tool.start", { tool: "file-read", params });

    const resolvedPath = await resolveAndValidatePath(params.path, context.workspaceRoot);

    let stats;
    try {
      stats = await stat(resolvedPath);
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        throw new ToolError("FILE_NOT_FOUND", `File not found: "${params.path}"`);
      }
      if (nodeErr.code === "EACCES" || nodeErr.code === "EPERM") {
        throw new ToolError("PERMISSION_DENIED", `Permission denied reading "${params.path}"`);
      }
      throw err;
    }

    if (stats.isDirectory()) {
      throw new ToolError("FILE_NOT_FOUND", `Path "${params.path}" is a directory, not a file`);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await readFile(resolvedPath));
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "EACCES" || nodeErr.code === "EPERM") {
        throw new ToolError("PERMISSION_DENIED", `Permission denied reading "${params.path}"`);
      }
      throw err;
    }

    if (isBinaryContent(buffer)) {
      throw new ToolError("BINARY_FILE", `File "${params.path}" appears to be binary`);
    }

    const fullContent = buffer.toString("utf-8");
    const allLines = fullContent.split("\n");

    // Trailing \n produces an extra empty element in split() — not a real line.
    const hasTrailingNewline = fullContent.length > 0 && fullContent.endsWith("\n");
    const totalLines = hasTrailingNewline ? allLines.length - 1 : allLines.length;

    if (fullContent.length === 0) {
      const result: FileReadResult = {
        content: "",
        lineCount: 0,
        totalLines: 0,
        path: resolvedPath,
        truncated: false,
      };
      context.emit("tool.end", { tool: "file-read", path: resolvedPath, lineCount: 0, truncated: false });
      return { success: true, data: result };
    }

    const startLine = params.offset ? params.offset - 1 : 0;
    const endLine = params.limit ? Math.min(startLine + params.limit, totalLines) : totalLines;

    const selectedLines = allLines.slice(startLine, endLine);
    let content = selectedLines.join("\n");

    let truncated = false;
    if (Buffer.byteLength(content, "utf-8") > MAX_OUTPUT_BYTES) {
      const truncatedBuffer = Buffer.from(content, "utf-8").subarray(0, MAX_OUTPUT_BYTES);
      content = truncatedBuffer.toString("utf-8");
      truncated = true;
    }

    const lineCount = selectedLines.length;

    const result: FileReadResult = {
      content,
      lineCount,
      totalLines,
      path: resolvedPath,
      truncated,
    };

    context.emit("tool.end", { tool: "file-read", path: resolvedPath, lineCount, truncated });

    return { success: true, data: result };
  },
};
