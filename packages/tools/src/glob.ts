import { normalize, relative, resolve } from "node:path";
import { z } from "zod";
import { glob } from "tinyglobby";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  pattern: z.string().min(1),
  path: z.string().optional(),
  maxResults: z.number().int().min(1).max(10000).optional(),
});

type GlobParams = z.infer<typeof parametersSchema>;

interface GlobResult {
  files: string[];
  count: number;
  truncated: boolean;
  pattern: string;
}

const DEFAULT_IGNORE = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/__pycache__/**",
  "**/.DS_Store",
];

function resolveAndValidatePath(rawPath: string, workspaceRoot: string): string {
  const normalizedRoot = resolve(workspaceRoot);
  const resolvedPath = resolve(normalizedRoot, normalize(rawPath));

  if (!resolvedPath.startsWith(normalizedRoot + "/") && resolvedPath !== normalizedRoot) {
    throw new ToolError(
      "PATH_OUTSIDE_WORKSPACE",
      `Path "${rawPath}" resolves outside workspace root (resolved: ${relative(normalizedRoot, resolvedPath)})`,
    );
  }

  return resolvedPath;
}

export const globTool: Tool<GlobParams, GlobResult> = {
  name: "glob",
  description:
    "Find files matching a glob pattern within the workspace. Returns a sorted list of matching file paths relative to the workspace root.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: GlobParams, context: ToolContext): Promise<ToolResult<GlobResult>> {
    context.emit("tool.start", { tool: "glob", params });

    if (params.pattern.startsWith("/")) {
      throw new ToolError("INVALID_PATTERN", "Pattern must be relative, not absolute");
    }

    const workspaceRoot = resolve(context.workspaceRoot);

    let cwd: string;
    let pathPrefix: string | undefined;

    if (params.path !== undefined) {
      cwd = resolveAndValidatePath(params.path, workspaceRoot);
      pathPrefix = params.path;
    } else {
      cwd = workspaceRoot;
      pathPrefix = undefined;
    }

    let files: string[];
    try {
      files = await glob([params.pattern], {
        cwd,
        ignore: DEFAULT_IGNORE,
        dot: true,
        followSymbolicLinks: true,
        onlyFiles: true,
      });
    } catch (err) {
      throw new ToolError(
        "GLOB_ERROR",
        `Unexpected error during glob: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (pathPrefix !== undefined) {
      const normalizedPrefix = normalize(pathPrefix);
      files = files.map((f) => `${normalizedPrefix}/${f}`);
    }

    files.sort();

    const maxResults = params.maxResults ?? 1000;
    const truncated = files.length > maxResults;
    if (truncated) {
      files = files.slice(0, maxResults);
    }

    const result: GlobResult = {
      files,
      count: files.length,
      truncated,
      pattern: params.pattern,
    };

    context.emit("tool.end", {
      tool: "glob",
      pattern: params.pattern,
      count: files.length,
      truncated,
    });

    return { success: true, data: result };
  },
};
