import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { normalize, resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  command: z.string().min(1),
  workdir: z.string().optional(),
  timeout: z.number().int().min(1000).max(600_000).default(120_000),
  description: z.string().optional(),
});

type BashParams = z.infer<typeof parametersSchema>;

interface BashResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string;
  truncated: boolean;
}

const MAX_OUTPUT_BYTES = 1024 * 1024;

function runSafetyCheck(_command: string): void {
  // DC-SAFE stub
}

function truncateOutput(output: string): { value: string; truncated: boolean } {
  if (Buffer.byteLength(output, "utf-8") <= MAX_OUTPUT_BYTES) {
    return { value: output, truncated: false };
  }
  const truncatedBuffer = Buffer.from(output, "utf-8").subarray(0, MAX_OUTPUT_BYTES);
  return { value: truncatedBuffer.toString("utf-8"), truncated: true };
}

export const bashTool: Tool<BashParams, BashResult> = {
  name: "bash",
  description:
    "Execute a shell command using bash. Captures stdout and stderr separately. Non-zero exit codes are returned as normal results, not errors.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  async execute(params: BashParams, context: ToolContext): Promise<ToolResult<BashResult>> {
    context.emit("tool.start", { tool: "bash", params });

    let workdir: string;
    if (params.workdir) {
      const resolvedWorkdir = resolve(context.workspaceRoot, normalize(params.workdir));
      const normalizedRoot = resolve(context.workspaceRoot);

      if (!resolvedWorkdir.startsWith(normalizedRoot + "/") && resolvedWorkdir !== normalizedRoot) {
        throw new ToolError(
          "WORKDIR_OUTSIDE_WORKSPACE",
          `workdir "${params.workdir}" resolves outside workspace root`,
        );
      }

      if (!existsSync(resolvedWorkdir)) {
        throw new ToolError("WORKDIR_NOT_FOUND", `workdir "${params.workdir}" does not exist`);
      }

      workdir = resolvedWorkdir;
    } else {
      workdir = context.workspaceRoot;
    }

    runSafetyCheck(params.command);

    const startTime = Date.now();

    const result = await new Promise<BashResult>((resolveResult, reject) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      const child = spawn("bash", ["-c", params.command], {
        cwd: workdir,
        env: { ...process.env },
      });

      const timeoutId = setTimeout(() => {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 5000);
      }, params.timeout);

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

      child.on("close", (exitCode, signal) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        const { value: stdout, truncated: stdoutTruncated } = truncateOutput(
          Buffer.concat(stdoutChunks).toString("utf-8"),
        );
        const { value: stderr, truncated: stderrTruncated } = truncateOutput(
          Buffer.concat(stderrChunks).toString("utf-8"),
        );

        const exitCodeOrDefault = exitCode ?? (signal === "SIGKILL" ? -1 : 1);

        resolveResult({
          stdout,
          stderr,
          exitCode: exitCodeOrDefault,
          duration,
          command: params.command,
          truncated: stdoutTruncated || stderrTruncated,
        });
      });

      child.on("error", (err) => {
        clearTimeout(timeoutId);
        reject(new ToolError("SPAWN_ERROR", `Failed to spawn bash: ${err.message}`));
      });
    });

    context.emit("tool.end", {
      tool: "bash",
      exitCode: result.exitCode,
      duration: result.duration,
    });

    return { success: true, data: result };
  },
};
