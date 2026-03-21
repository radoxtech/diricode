import { spawn } from "node:child_process";
import { createRequire } from "node:module";
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

export type BashSafetyLevel = "off" | "basic" | "standard" | "strict";

export interface BashSafetyConfig {
  level: BashSafetyLevel;
}

const DEFAULT_SAFETY_CONFIG: BashSafetyConfig = { level: "standard" };

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    // :(){:|:&};: fork bomb
    pattern: /:\s*\(\s*\)\s*\{[^}]*:\s*\|[^}]*:&[^}]*\}/,
    reason: "fork bomb detected",
  },
  {
    // rm -rf / or rm -fr ~
    pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\s+(\/\s*$|\/\s+|~\s*\/?\s*$|\*\s*$)/,
    reason: "rm -rf on root/home/glob is not allowed",
  },
  {
    pattern: /\brm\s+--no-preserve-root/,
    reason: "rm --no-preserve-root is not allowed",
  },
  {
    // dd of=/dev/sdX writes directly to a block device
    pattern: /\bdd\b.*\bof\s*=\s*\/dev\//,
    reason: "dd writing to a device is not allowed",
  },
  {
    pattern: /\bmkfs(\.\w+)?\b/,
    reason: "mkfs commands are not allowed",
  },
  {
    pattern: /\bshred\b.*\/dev\//,
    reason: "shred on block device is not allowed",
  },
  {
    pattern: /\bwipefs\b/,
    reason: "wipefs is not allowed",
  },
  {
    // sgdisk -Z wipes partition tables
    pattern: /\bsgdisk\b.*-Z/,
    reason: "partition table wipe is not allowed",
  },
  {
    // overwriting /etc/passwd, /etc/shadow, /etc/sudoers
    pattern: />\s*(\/etc\/passwd|\/etc\/shadow|\/etc\/sudoers)/,
    reason: "overwriting system auth files is not allowed",
  },
  {
    pattern: /\b(insmod|rmmod|modprobe)\b/,
    reason: "kernel module commands are not allowed",
  },
];

const PATH_ALLOWLIST_PREFIXES = [
  "/tmp/",
  "/var/tmp/",
  "/dev/null",
  "/proc/",
  "/sys/",
  "/usr/",
  "/bin/",
  "/sbin/",
  "/lib/",
  "/opt/",
  "/home/",
];

function extractPaths(command: string): string[] {
  const paths: string[] = [];
  const pathRegex = /(\/[^\s'"`;|&><(){}$\\]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(command)) !== null) {
    if (match[1] !== undefined) paths.push(match[1]);
  }
  return paths;
}

interface TreeSitterLike {
  parse(source: string): { rootNode: AstNode };
}

interface AstNode {
  type: string;
  text: string;
  children: AstNode[];
  childCount: number;
}

let treeSitterReady = false;
let treeSitterFactoryPromise: Promise<(() => TreeSitterLike) | null> | null = null;

async function getParserFactory(): Promise<(() => TreeSitterLike) | null> {
  if (treeSitterFactoryPromise) return treeSitterFactoryPromise;

  treeSitterFactoryPromise = (async () => {
    try {
      const TreeSitter = await import("web-tree-sitter");
      const _require = createRequire(import.meta.url);
      const wasmPath = _require.resolve("tree-sitter-bash/tree-sitter-bash.wasm");

      await TreeSitter.Parser.init();
      const BashLanguage = await TreeSitter.Language.load(wasmPath);

      treeSitterReady = true;
      return () => {
        const parser = new TreeSitter.Parser();
        parser.setLanguage(BashLanguage);
        return parser as unknown as TreeSitterLike;
      };
    } catch {
      return null;
    }
  })();

  return treeSitterFactoryPromise;
}

function checkAst(node: AstNode): string | null {
  if (node.type === "command") {
    const nameNode = node.children.find((c) => c.type === "command_name");
    if (nameNode) {
      const cmd = nameNode.text.trim();

      const blockedExact = new Set([
        "mkfs", "mkfs.ext4", "mkfs.ext3", "mkfs.xfs", "mkfs.vfat", "mkfs.btrfs",
        "wipefs", "insmod", "rmmod", "modprobe",
        "shred", "fdisk", "gdisk", "sgdisk", "parted",
      ]);

      if (blockedExact.has(cmd)) {
        return `command '${cmd}' is not allowed`;
      }

      if (cmd === "dd") {
        for (const child of node.children) {
          if (child.type === "word" && /\bof\s*=\s*\/dev\//.test(child.text)) {
            return "dd writing to a device is not allowed";
          }
        }
      }

      if (cmd === "rm") {
        let hasRecursive = false;
        let hasForce = false;
        let hasDangerousPath = false;

        for (const child of node.children) {
          const t = child.text;
          if (/^-[a-zA-Z]*r/.test(t) || t === "--recursive") hasRecursive = true;
          if (/^-[a-zA-Z]*f/.test(t) || t === "--force") hasForce = true;
          if (t === "/" || t === "~" || t === "*" || t === "/*") hasDangerousPath = true;
          if (t === "--no-preserve-root") return "rm --no-preserve-root is not allowed";
        }

        if (hasRecursive && hasForce && hasDangerousPath) {
          return "rm -rf on root/home/glob is not allowed";
        }
      }
    }
  }

  if (node.type === "function_definition") {
    const nameNode = node.children.find((c) => c.type === "word");
    if (nameNode?.text === ":") {
      return "fork bomb pattern detected";
    }
  }

  for (const child of node.children) {
    const result = checkAst(child);
    if (result !== null) return result;
  }

  return null;
}

export function runSafetyCheck(
  command: string,
  config: BashSafetyConfig = DEFAULT_SAFETY_CONFIG,
  workspaceRoot?: string,
): void {
  if (config.level === "off") return;

  if (/\bsudo\b/.test(command)) {
    throw new ToolError(
      "SUDO_NOT_ALLOWED",
      "sudo is not allowed",
    );
  }

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new ToolError("DANGEROUS_COMMAND", reason);
    }
  }

  if (config.level === "basic") return;

  if (workspaceRoot) {
    const resolvedRoot = resolve(workspaceRoot);
    for (const p of extractPaths(command)) {
      let resolved: string;
      try {
        resolved = resolve(p);
      } catch {
        continue;
      }

      if (
        resolved.startsWith("/") &&
        !resolved.startsWith(resolvedRoot + "/") &&
        resolved !== resolvedRoot &&
        !PATH_ALLOWLIST_PREFIXES.some((prefix) => resolved.startsWith(prefix))
      ) {
        throw new ToolError(
          "PATH_OUTSIDE_WORKSPACE",
          `command references path '${p}' outside the workspace root '${resolvedRoot}'`,
        );
      }
    }
  }
}

export async function runSafetyCheckAsync(
  command: string,
  config: BashSafetyConfig = DEFAULT_SAFETY_CONFIG,
  workspaceRoot?: string,
): Promise<void> {
  runSafetyCheck(command, config, workspaceRoot);

  if (config.level !== "strict") return;

  const parserFactory = await getParserFactory();
  if (!parserFactory) return;

  const parser = parserFactory();
  const tree = parser.parse(command);
  const violation = checkAst(tree.rootNode as unknown as AstNode);
  if (violation !== null) {
    throw new ToolError("DANGEROUS_COMMAND", `AST analysis: ${violation}`);
  }
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
  async execute(
    params: BashParams,
    context: ToolContext,
  ): Promise<ToolResult<BashResult>> {
    context.emit("tool.start", { tool: "bash", params });

    let workdir: string;
    if (params.workdir) {
      const resolvedWorkdir = resolve(context.workspaceRoot, normalize(params.workdir));
      const normalizedRoot = resolve(context.workspaceRoot);

      if (
        !resolvedWorkdir.startsWith(normalizedRoot + "/") &&
        resolvedWorkdir !== normalizedRoot
      ) {
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

    const safetyConfig: BashSafetyConfig =
      (context as ToolContext & { bashSafety?: BashSafetyConfig }).bashSafety ??
      DEFAULT_SAFETY_CONFIG;

    await runSafetyCheckAsync(params.command, safetyConfig, context.workspaceRoot);

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

      child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

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

    context.emit("tool.end", { tool: "bash", exitCode: result.exitCode, duration: result.duration });

    return { success: true, data: result };
  },
};
