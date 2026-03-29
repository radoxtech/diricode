import { readFile, stat, writeFile } from "node:fs/promises";
import { normalize, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";
import { type AnchorStatus, resolveAnchor } from "./hashline.js";
import {
  type FileWriteSafetyConfig,
  DEFAULT_FILE_SAFETY_CONFIG,
  runFileWriteSafetyCheck,
  checkSymlinkSafety,
} from "./file-safety.js";

const parametersSchema = z.object({
  path: z.string().min(1),
  anchor: z.string().min(1),
  newContent: z.string(),
});

type HashlineEditParams = z.infer<typeof parametersSchema>;

interface HashlineEditResult {
  path: string;
  anchorStatus: AnchorStatus;
  resolvedLine: number;
  previousContent: string;
  preview: string;
}

function isBinaryBuffer(buf: Buffer): boolean {
  const sampleSize = Math.min(buf.length, 8192);
  for (let i = 0; i < sampleSize; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function describeStatus(status: AnchorStatus): string {
  switch (status.kind) {
    case "exact":
      return "exact";
    case "drifted":
      return `drifted (line shifted by ${String(status.delta)})`;
    case "relocated":
      return `relocated to line ${String(status.foundAt)} (similarity: ${status.score.toFixed(2)})`;
    case "conflict":
      return `conflict: ${status.reason}`;
  }
}

export const hashlineEditTool: Tool<HashlineEditParams, HashlineEditResult> = {
  name: "hashline-edit",
  description:
    "Edit a file by referencing a stable hashline anchor (LINE#HH format). " +
    "If the anchor has drifted due to prior edits, it will be re-resolved using " +
    "fuzzy matching. Reports exact, drifted, relocated, or conflict status.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  async execute(
    params: HashlineEditParams,
    context: ToolContext,
  ): Promise<ToolResult<HashlineEditResult>> {
    context.emit("tool.start", { tool: "hashline-edit", params });

    const resolvedPath = resolve(context.workspaceRoot, normalize(params.path));

    const safetyConfig: FileWriteSafetyConfig =
      (context as ToolContext & { fileWriteSafety?: FileWriteSafetyConfig }).fileWriteSafety ??
      DEFAULT_FILE_SAFETY_CONFIG;

    runFileWriteSafetyCheck(resolvedPath, context.workspaceRoot, safetyConfig);
    await checkSymlinkSafety(resolvedPath, context.workspaceRoot, safetyConfig);

    let fileStat: Awaited<ReturnType<typeof stat>>;
    try {
      fileStat = await stat(resolvedPath);
    } catch {
      throw new ToolError("FILE_NOT_FOUND", `File not found: "${params.path}"`);
    }

    const rawBuffer = await readFile(resolvedPath);
    if (isBinaryBuffer(rawBuffer)) {
      throw new ToolError(
        "BINARY_FILE",
        `File "${params.path}" appears to be a binary file and cannot be edited as text`,
      );
    }

    const original = rawBuffer.toString("utf-8");
    const lines = original.split("\n");

    const result = resolveAnchor(params.anchor, original);

    if (!result.matched || result.resolvedLine === undefined) {
      throw new ToolError(
        "ANCHOR_CONFLICT",
        `Cannot resolve anchor "${params.anchor}" in "${params.path}": ${describeStatus(result.status)}`,
      );
    }

    const resolvedLine = result.resolvedLine;
    const previousContent = lines[resolvedLine - 1] ?? "";

    const newLines = [...lines];
    newLines[resolvedLine - 1] = params.newContent;
    const updated = newLines.join("\n");

    if (updated === original) {
      context.emit("tool.end", {
        tool: "hashline-edit",
        path: resolvedPath,
        anchorStatus: result.status,
        resolvedLine,
        unchanged: true,
      });

      return {
        success: true,
        data: {
          path: resolvedPath,
          anchorStatus: result.status,
          resolvedLine,
          previousContent,
          preview: "",
        },
      };
    }

    const mode = fileStat.mode & 0o777;
    await writeFile(resolvedPath, updated, { encoding: "utf-8", mode });

    const previewStart = Math.max(0, resolvedLine - 3);
    const previewEnd = Math.min(newLines.length, resolvedLine + 3);
    const preview = newLines.slice(previewStart, previewEnd).join("\n");

    context.emit("tool.end", {
      tool: "hashline-edit",
      path: resolvedPath,
      anchorStatus: result.status,
      resolvedLine,
      statusDescription: describeStatus(result.status),
    });

    return {
      success: true,
      data: {
        path: resolvedPath,
        anchorStatus: result.status,
        resolvedLine,
        previousContent,
        preview,
      },
    };
  },
};
