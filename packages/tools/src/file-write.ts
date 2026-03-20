import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, normalize, relative, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  createParents: z.boolean().default(true),
});

type FileWriteParams = z.infer<typeof parametersSchema>;

interface FileWriteResult {
  path: string;
  bytesWritten: number;
  created: boolean;
}

function runSafetyCheck(_resolvedPath: string, _content: string): void {
  // DC-SAFE safety check placeholder — not yet implemented
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export const fileWriteTool: Tool<FileWriteParams, FileWriteResult> = {
  name: "file-write",
  description: "Write content to a file within the workspace, optionally creating parent directories.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
  },
  async execute(params: FileWriteParams, context: ToolContext): Promise<ToolResult<FileWriteResult>> {
    context.emit("tool.start", { tool: "file-write", params });

    const resolvedPath = resolve(context.workspaceRoot, normalize(params.path));
    const normalizedRoot = resolve(context.workspaceRoot);

    if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
      throw new ToolError(
        "PATH_OUTSIDE_WORKSPACE",
        `Path "${params.path}" resolves outside workspace root (resolved: ${relative(normalizedRoot, resolvedPath)})`,
      );
    }

    runSafetyCheck(resolvedPath, params.content);

    const parentDir = dirname(resolvedPath);

    if (params.createParents) {
      await mkdir(parentDir, { recursive: true });
    } else {
      const parentExists = await fileExists(parentDir);
      if (!parentExists) {
        throw new ToolError(
          "DIR_NOT_FOUND",
          `Parent directory "${parentDir}" does not exist and createParents is false`,
        );
      }
    }

    const created = !(await fileExists(resolvedPath));

    try {
      await writeFile(resolvedPath, params.content, { encoding: "utf-8" });
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "EACCES" || nodeErr.code === "EPERM") {
        throw new ToolError("PERMISSION_DENIED", `Permission denied writing to "${resolvedPath}"`);
      }
      throw err;
    }

    const bytesWritten = Buffer.byteLength(params.content, "utf-8");

    context.emit("tool.end", { tool: "file-write", path: resolvedPath, bytesWritten, created });

    return {
      success: true,
      data: {
        path: resolvedPath,
        bytesWritten,
        created,
      },
    };
  },
};
