import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";

const parametersSchema = z.object({
  path: z.string().optional(),
  command: z.enum(["tsc", "eslint", "biome"]).default("tsc"),
  args: z.array(z.string()).optional(),
  timeout: z.number().int().min(1000).max(300_000).default(60_000),
});

type DiagnosticsParams = z.infer<typeof parametersSchema>;

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface DiagnosticsResult {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  raw: string;
}

const TS_DIAG_REGEX = /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS(\d+):\s+(.+)$/m;
const ESLINT_DIAG_REGEX = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([\w-/@]+)\s*$/m;

function parseTscOutput(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const match = TS_DIAG_REGEX.exec(line);
    if (!match) continue;

    const [, file, lineStr, colStr, severity, code, message] = match;
    if (!file || !lineStr || !colStr || !severity || !code || !message) continue;

    diagnostics.push({
      file: file.trim(),
      line: parseInt(lineStr, 10),
      column: parseInt(colStr, 10),
      severity: severity as "error" | "warning" | "info",
      code: `TS${code}`,
      message: message.trim(),
    });
  }

  return diagnostics;
}

function parseEslintOutput(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const sections = output.split("\n\n");

  let currentFile = "";
  for (const section of sections) {
    const sectionLines = section.split("\n");
    for (const line of sectionLines) {
      if (line.trim() && !line.startsWith(" ") && !line.startsWith("\t")) {
        currentFile = line.trim();
        continue;
      }

      const match = ESLINT_DIAG_REGEX.exec(line);
      if (!match || !currentFile) continue;

      const [, lineStr, colStr, severity, message, code] = match;
      if (!lineStr || !colStr || !severity || !message || !code) continue;

      diagnostics.push({
        file: currentFile,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        severity: severity as "error" | "warning",
        code: code.trim(),
        message: message.trim(),
      });
    }
  }

  return diagnostics;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeout: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolveResult, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn(command, args, { cwd, env: { ...process.env } });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    }, timeout);

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeoutId);
      resolveResult({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: exitCode ?? (signal === "SIGKILL" ? -1 : 1),
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(new ToolError("SPAWN_ERROR", `Failed to spawn ${command}: ${err.message}`));
    });
  });
}

export const diagnosticsTool: Tool<DiagnosticsParams, DiagnosticsResult> = {
  name: "diagnostics",
  description:
    "Run TypeScript compiler (tsc), ESLint, or Biome to collect diagnostics (errors, warnings) " +
    "from source files. Returns structured diagnostic objects with file, line, column, severity, " +
    "code, and message.",
  parameters: parametersSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: DiagnosticsParams,
    context: ToolContext,
  ): Promise<ToolResult<DiagnosticsResult>> {
    context.emit("tool.start", { tool: "diagnostics", params });

    const workdir = params.path
      ? resolve(context.workspaceRoot, params.path)
      : context.workspaceRoot;

    const normalizedRoot = resolve(context.workspaceRoot);
    if (!workdir.startsWith(normalizedRoot + "/") && workdir !== normalizedRoot) {
      throw new ToolError(
        "PATH_OUTSIDE_WORKSPACE",
        `Path "${params.path ?? ""}" is outside workspace`,
      );
    }

    let command: string;
    let args: string[];

    switch (params.command) {
      case "tsc": {
        command = "npx";
        args = ["tsc", "--noEmit", "--pretty", "false", ...(params.args ?? [])];
        break;
      }
      case "eslint": {
        command = "npx";
        args = ["eslint", "--format", "stylish", ...(params.args ?? []), "."];
        break;
      }
      case "biome": {
        command = "npx";
        args = ["biome", "check", ...(params.args ?? []), "."];
        break;
      }
    }

    let output: { stdout: string; stderr: string; exitCode: number };
    try {
      output = await runCommand(command, args, workdir, params.timeout);
    } catch (err) {
      if (err instanceof ToolError) throw err;
      throw new ToolError(
        "COMMAND_FAILED",
        `Diagnostics command failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const raw = output.stdout + output.stderr;

    let diagnostics: Diagnostic[];
    switch (params.command) {
      case "tsc": {
        diagnostics = parseTscOutput(raw);
        break;
      }
      case "eslint": {
        diagnostics = parseEslintOutput(raw);
        break;
      }
      case "biome": {
        diagnostics = parseTscOutput(raw);
        break;
      }
    }

    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
    const infoCount = diagnostics.filter((d) => d.severity === "info").length;

    const result: DiagnosticsResult = {
      diagnostics,
      errorCount,
      warningCount,
      infoCount,
      raw: raw.slice(0, 10_000),
    };

    context.emit("tool.end", {
      tool: "diagnostics",
      errorCount,
      warningCount,
      infoCount,
    });

    return { success: true, data: result };
  },
};
