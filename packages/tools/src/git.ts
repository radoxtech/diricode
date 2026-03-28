import { spawn } from "node:child_process";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "@diricode/core";
import { ToolError } from "@diricode/core";
import {
  runGitSafetyCheckAsync,
  validateGitCommand,
  type GitSafetyConfig,
  DEFAULT_GIT_SAFETY_CONFIG,
} from "./git-safety.js";

// =============================================================================
// Shared Types & Utilities
// =============================================================================

interface GitOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  truncated: boolean;
}

const MAX_OUTPUT_BYTES = 1024 * 1024;

/**
 * Execute a git command and return structured output.
 */
function executeGitCommand(
  args: string[],
  workspaceRoot: string,
  timeout = 30_000,
): Promise<GitOutput> {
  return new Promise((resolveResult) => {
    const startTime = Date.now();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn("git", args, {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

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
      const duration = Date.now() - startTime;

      const rawStdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const rawStderr = Buffer.concat(stderrChunks).toString("utf-8");

      let truncated = false;
      let stdout = rawStdout;
      const stderr = rawStderr;

      if (Buffer.byteLength(rawStdout, "utf-8") > MAX_OUTPUT_BYTES) {
        stdout = Buffer.from(rawStdout, "utf-8").subarray(0, MAX_OUTPUT_BYTES).toString("utf-8");
        truncated = true;
      }

      resolveResult({
        stdout,
        stderr,
        exitCode: exitCode ?? (signal === "SIGKILL" ? -1 : 1),
        duration,
        truncated,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      resolveResult({
        stdout: "",
        stderr: `Failed to spawn git: ${err.message}`,
        exitCode: 1,
        duration: Date.now() - startTime,
        truncated: false,
      });
    });
  });
}

function truncateOutput(output: string): { value: string; truncated: boolean } {
  if (Buffer.byteLength(output, "utf-8") <= MAX_OUTPUT_BYTES) {
    return { value: output, truncated: false };
  }
  const truncatedBuffer = Buffer.from(output, "utf-8").subarray(0, MAX_OUTPUT_BYTES);
  return { value: truncatedBuffer.toString("utf-8"), truncated: true };
}

// =============================================================================
// Git Status Tool
// =============================================================================

const gitStatusParamsSchema = z.object({
  /** Pass --porcelain for machine-readable output */
  porcelain: z.boolean().default(false),
  /** Pass --short for short format */
  short: z.boolean().default(false),
  /** Show untracked files (no/untracked/normal) */
  untrackedFiles: z.enum(["no", "untracked", "normal"]).default("normal"),
});

type GitStatusParams = z.infer<typeof gitStatusParamsSchema>;

interface GitStatusResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** True if there are changes (staged, unstaged, or untracked) */
  hasChanges: boolean;
  /** Parsed staged files if porcelain=true */
  staged: string[];
  /** Parsed unstaged files if porcelain=true */
  unstaged: string[];
  /** Parsed untracked files if porcelain=true */
  untracked: string[];
  duration: number;
  truncated: boolean;
}

export const gitStatusTool: Tool<GitStatusParams, GitStatusResult> = {
  name: "git-status",
  description:
    "Show the working tree status. Use porcelain or short format for machine-readable output. Returns parsed data about staged, unstaged, and untracked files.",
  parameters: gitStatusParamsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(
    params: GitStatusParams,
    context: ToolContext,
  ): Promise<ToolResult<GitStatusResult>> {
    context.emit("tool.start", { tool: "git-status", params });

    const args = ["status"];
    if (params.porcelain) args.push("--porcelain");
    if (params.short) args.push("--short");
    if (params.untrackedFiles !== "normal") {
      args.push(`--untracked-files=${params.untrackedFiles}`);
    }

    const result = await executeGitCommand(args, context.workspaceRoot);

    // Parse porcelain output for structured data
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    if (params.porcelain) {
      for (const line of result.stdout.split("\n")) {
        if (!line || line.length < 2) continue;
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const file = line.slice(3);

        if (indexStatus !== " " && indexStatus !== "?") staged.push(file);
        if (workTreeStatus === "M" || workTreeStatus === "D") unstaged.push(file);
        if (indexStatus === "?" && workTreeStatus === "?") untracked.push(file);
      }
    }

    const hasChanges = result.stdout.trim().length > 0;
    const { value: stdout, truncated } = truncateOutput(result.stdout);

    const output: GitStatusResult = {
      stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      hasChanges,
      staged,
      unstaged,
      untracked,
      duration: result.duration,
      truncated,
    };

    context.emit("tool.end", {
      tool: "git-status",
      exitCode: result.exitCode,
      duration: result.duration,
    });
    return { success: true, data: output };
  },
};

// =============================================================================
// Git Diff Tool
// =============================================================================

const gitDiffParamsSchema = z.object({
  /** Compare against this commit (or --staged if not provided) */
  commit: z.string().optional(),
  /** Show staged changes (default: false shows unstaged) */
  staged: z.boolean().default(false),
  /** Diff against another commit (requires commit param) */
  commit2: z.string().optional(),
  /** Pass --stat for summary only */
  stat: z.boolean().default(false),
  /** Number of context lines */
  context: z.number().int().min(0).max(10).default(3),
});

type GitDiffParams = z.infer<typeof gitDiffParamsSchema>;

interface GitDiffResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** True if there are differences */
  hasDiff: boolean;
  /** Parsed diff stats if --stat was used */
  stats?: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
  duration: number;
  truncated: boolean;
}

export const gitDiffTool: Tool<GitDiffParams, GitDiffResult> = {
  name: "git-diff",
  description:
    "Show changes between commits, commit and working tree, etc. Use --staged to see staged changes. Use --stat for a summary of changes.",
  parameters: gitDiffParamsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: GitDiffParams, context: ToolContext): Promise<ToolResult<GitDiffResult>> {
    context.emit("tool.start", { tool: "git-diff", params });

    const args = ["diff"];
    if (params.staged) args.push("--staged");
    if (params.commit) args.push(params.commit);
    if (params.commit2) args.push(params.commit2);
    if (params.stat) args.push("--stat");
    args.push(`-U${String(params.context)}`);

    const result = await executeGitCommand(args, context.workspaceRoot);

    // Parse stat output
    let stats: GitDiffResult["stats"] | undefined;
    if (params.stat && result.stdout) {
      const statMatch =
        /(\d+)\s+files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?(-))?/.exec(
          result.stdout.split("\n").slice(-1)[0] ?? "",
        );
      if (statMatch) {
        stats = {
          filesChanged: parseInt(statMatch[1] ?? "0", 10),
          insertions: parseInt(statMatch[2] ?? "0", 10),
          deletions: parseInt(statMatch[3] ?? "0", 10),
        };
      }
    }

    const hasDiff = result.stdout.trim().length > 0;
    const { value: stdout, truncated } = truncateOutput(result.stdout);

    const output: GitDiffResult = {
      stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      hasDiff,
      stats,
      duration: result.duration,
      truncated,
    };

    context.emit("tool.end", {
      tool: "git-diff",
      exitCode: result.exitCode,
      duration: result.duration,
    });
    return { success: true, data: output };
  },
};

// =============================================================================
// Git Add Tool
// =============================================================================

const gitAddParamsSchema = z.object({
  /** Files to stage (use . for current directory) */
  files: z.array(z.string()).min(1),
  /** Pass --patch for interactive patch selection */
  patch: z.boolean().default(false),
  /** Pass --dry-run to preview */
  dryRun: z.boolean().default(false),
});

type GitAddParams = z.infer<typeof gitAddParamsSchema>;

interface GitAddResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  stagedFiles: string[];
  dryRun: boolean;
  duration: number;
  truncated: boolean;
}

function buildGitAddCommand(params: GitAddParams): { command: string; blocked: boolean } {
  // ADR-027: Never `git add .` without explicit review of staged files - Hard block
  const hasDotAdd = params.files.includes(".") || params.files.includes("./");

  if (hasDotAdd) {
    return {
      command: `git add ${params.files.join(" ")}`,
      blocked: true,
    };
  }

  const validatedFiles = params.files;

  return {
    command: `git add ${validatedFiles.join(" ")}`,
    blocked: false,
  };
}

export const gitAddTool: Tool<GitAddParams, GitAddResult> = {
  name: "git-add",
  description:
    "Add files to the staging area. IMPORTANT: `git add .` is blocked per ADR-027 safety rails - always use explicit file paths. Use --dry-run to preview what would be staged.",
  parameters: gitAddParamsSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: GitAddParams, context: ToolContext): Promise<ToolResult<GitAddResult>> {
    context.emit("tool.start", { tool: "git-add", params });

    // ADR-027: Hard block on `git add .`
    const { blocked } = buildGitAddCommand(params);
    if (blocked) {
      throw new ToolError(
        "GIT_ADD_BLOCKED",
        "ADR-027 safety rails: `git add .` is not allowed. " +
          "Use explicit file paths instead, or review staged files first with `git diff --cached`.",
      );
    }

    const args = ["add", ...params.files];
    if (params.patch) args.push("--patch");
    if (params.dryRun) args.push("--dry-run");

    // For dry-run, we don't actually run safety checks for secrets (nothing is being committed)
    if (!params.dryRun) {
      const safetyConfig: GitSafetyConfig =
        (context as ToolContext & { gitSafety?: GitSafetyConfig }).gitSafety ??
        DEFAULT_GIT_SAFETY_CONFIG;
      await runGitSafetyCheckAsync(
        `git add ${params.files.join(" ")}`,
        safetyConfig,
        context.workspaceRoot,
      );
    }

    const result = await executeGitCommand(args, context.workspaceRoot);

    // If dry-run, parse what would be staged
    let stagedFiles: string[] = [];
    if (params.dryRun) {
      // Parse output of dry-run (typically lists the files)
      stagedFiles = result.stdout
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    }

    const { value: stdout, truncated } = truncateOutput(result.stdout);

    const output: GitAddResult = {
      stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      stagedFiles,
      dryRun: params.dryRun,
      duration: result.duration,
      truncated,
    };

    context.emit("tool.end", {
      tool: "git-add",
      exitCode: result.exitCode,
      duration: result.duration,
    });
    return { success: true, data: output };
  },
};

// =============================================================================
// Git Commit Tool
// =============================================================================

const gitCommitParamsSchema = z.object({
  /** Commit message (required) */
  message: z.string().min(1, "Commit message cannot be empty"),
  /** Pass --amend to amend the previous commit */
  amend: z.boolean().default(false),
  /** Pass --no-edit when amending (keep the same message) */
  noEdit: z.boolean().default(false),
  /** Author in format "Name <email>" */
  author: z.string().optional(),
  /** Pass --dry-run to preview */
  dryRun: z.boolean().default(false),
  /** Sign off on the commit */
  signOff: z.boolean().default(false),
});

type GitCommitParams = z.infer<typeof gitCommitParamsSchema>;

interface GitCommitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  commitHash: string | null;
  dryRun: boolean;
  message: string;
  duration: number;
  truncated: boolean;
}

/**
 * Validate commit message format.
 * Returns an error message if invalid, null if valid.
 */
function validateCommitMessage(message: string): string | null {
  const lines = message.split("\n");
  const firstLine = lines[0];

  if (!firstLine) {
    return "Commit message cannot be empty.";
  }

  if (firstLine.length > 72) {
    return `Commit message first line exceeds 72 characters (currently ${String(firstLine.length)}). Consider rewriting for readability.`;
  }

  if (message.toLowerCase().includes("fixes:#") || message.toLowerCase().includes("fixes #")) {
    return "Note: Issue references like 'Fixes #123' should use the full URL or proper GitHub syntax.";
  }

  if (lines.length === 1 && message.length > 0 && message.length < 10) {
    return "Commit message is very short. Consider providing more context about what and why.";
  }

  return null;
}

export const gitCommitTool: Tool<GitCommitParams, GitCommitResult> = {
  name: "git-commit",
  description:
    "Record changes to the repository. Performs secret scanning and .env file checks per ADR-027. Commit message is validated for format. Use --dry-run to preview.",
  parameters: gitCommitParamsSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  async execute(
    params: GitCommitParams,
    context: ToolContext,
  ): Promise<ToolResult<GitCommitResult>> {
    context.emit("tool.start", { tool: "git-commit", params });

    // Validate commit message
    const validationError = validateCommitMessage(params.message);
    if (validationError) {
      throw new ToolError("COMMIT_MESSAGE_WARNING", validationError);
    }

    const args = ["commit"];

    if (params.dryRun) {
      args.push("--dry-run");
    }

    if (params.amend) {
      args.push("--amend");
      if (params.noEdit) {
        args.push("--no-edit");
      }
    }

    if (params.author) {
      args.push("--author", params.author);
    }

    if (params.signOff) {
      args.push("--signoff");
    }

    args.push("-m", params.message);

    // Build full command string for safety check
    const command = `git commit ${args.slice(1).join(" ")}`;

    // Run safety checks (includes secret scanning in staged files)
    const safetyConfig: GitSafetyConfig =
      (context as ToolContext & { gitSafety?: GitSafetyConfig }).gitSafety ??
      DEFAULT_GIT_SAFETY_CONFIG;

    const validation = validateGitCommand(command, safetyConfig);
    if (!validation.safe) {
      throw new ToolError(
        validation.code ?? "GIT_SAFETY_BLOCKED",
        validation.reason ?? "Command blocked by safety rails",
      );
    }

    const result = await executeGitCommand(args, context.workspaceRoot);

    // Parse commit hash from output
    let commitHash: string | null = null;
    const hashMatch = /\[([^\s]+)\s[^\]]+\]/.exec(result.stdout);
    if (hashMatch?.[1]) {
      commitHash = hashMatch[1];
    }

    const { value: stdout, truncated } = truncateOutput(result.stdout);

    const output: GitCommitResult = {
      stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      commitHash,
      dryRun: params.dryRun,
      message: params.message,
      duration: result.duration,
      truncated,
    };

    context.emit("tool.end", {
      tool: "git-commit",
      exitCode: result.exitCode,
      duration: result.duration,
    });
    return { success: true, data: output };
  },
};

// =============================================================================
// Git Log Tool
// =============================================================================

const gitLogParamsSchema = z.object({
  /** Number of commits to show */
  n: z.number().int().min(1).max(100).default(10),
  /** Show commits from a specific author */
  author: z.string().optional(),
  /** Show commits since this date (ISO format) */
  since: z.string().optional(),
  /** Show commits until this date (ISO format) */
  until: z.string().optional(),
  /** Filter by commit message (grep) */
  grep: z.string().optional(),
  /** Show commits affecting this path */
  path: z.string().optional(),
  /** Use custom format string */
  format: z.string().default("%h %s (%an, %ar)"),
  /** Show diffstat */
  stat: z.boolean().default(false),
});

type GitLogParams = z.infer<typeof gitLogParamsSchema>;

interface GitLogEntry {
  hash: string;
  abbrevHash: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  relativeDate: string;
  body: string;
}

interface GitLogResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  commits: GitLogEntry[];
  duration: number;
  truncated: boolean;
}

function parseLogEntry(entry: string, _format: string): GitLogEntry | null {
  const lines = entry.split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  const firstLine = lines[0];
  if (!firstLine) return null;

  const firstLineMatch = /^([a-f0-9]+)\s+(.+)\s+\(([^)]+)\)$/.exec(firstLine);
  if (!firstLineMatch || firstLineMatch.length < 4) return null;

  const hash = firstLineMatch[1] ?? "";
  const subject = firstLineMatch[2] ?? "";
  const authorInfo = firstLineMatch[3] ?? "";

  const authorMatch = /^([^<]+)\s+<([^>]+)>,\s+(.+)$/.exec(authorInfo.trim());
  if (!authorMatch || authorMatch.length < 4) {
    return {
      hash,
      abbrevHash: hash.slice(0, 7),
      subject,
      authorName: authorInfo.trim(),
      authorEmail: "",
      authorDate: "",
      relativeDate: "",
      body: lines.slice(1).join("\n"),
    };
  }

  const authorName = authorMatch[1] ?? "";
  const authorEmail = authorMatch[2] ?? "";
  const relativeDate = authorMatch[3] ?? "";

  return {
    hash,
    abbrevHash: hash.slice(0, 7),
    subject,
    authorName: authorName.trim(),
    authorEmail,
    authorDate: "",
    relativeDate,
    body: lines.slice(1).join("\n"),
  };
}

export const gitLogTool: Tool<GitLogParams, GitLogResult> = {
  name: "git-log",
  description:
    "Show commit logs. Use --n to limit number of commits, --author to filter, --since/--until for date range, --grep for message search, and --stat for diffstat.",
  parameters: gitLogParamsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: GitLogParams, context: ToolContext): Promise<ToolResult<GitLogResult>> {
    context.emit("tool.start", { tool: "git-log", params });

    const args = ["log", `--max-count=${String(params.n)}`, `--format=${params.format}`];
    if (params.author) args.push(`--author=${params.author}`);
    if (params.since) args.push(`--since=${params.since}`);
    if (params.until) args.push(`--until=${params.until}`);
    if (params.grep) args.push(`--grep=${params.grep}`);
    if (params.path) args.push(`-- ${params.path}`);
    if (params.stat) args.push("--stat");

    const result = await executeGitCommand(args, context.workspaceRoot);

    // Parse log entries
    const commits: GitLogEntry[] = [];
    const entries = result.stdout.split("\n\n").filter((e) => e.trim().length > 0);

    for (const entry of entries) {
      const parsed = parseLogEntry(entry.trim(), params.format);
      if (parsed) commits.push(parsed);
    }

    const { value: stdout, truncated } = truncateOutput(result.stdout);

    const output: GitLogResult = {
      stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      commits,
      duration: result.duration,
      truncated,
    };

    context.emit("tool.end", {
      tool: "git-log",
      exitCode: result.exitCode,
      duration: result.duration,
    });
    return { success: true, data: output };
  },
};

// =============================================================================
// Git Blame Tool
// =============================================================================

const gitBlameParamsSchema = z.object({
  /** File to blame */
  file: z.string().min(1),
  /** Start blaming from this line */
  startLine: z.number().int().min(1).optional(),
  /** Stop blaming at this line */
  endLine: z.number().int().min(1).optional(),
  /** Show only modified lines from the last revision */
  lastRevision: z.boolean().default(false),
  /** Use custom format (forporcelain mode) */
  porcelain: z.boolean().default(false),
});

type GitBlameParams = z.infer<typeof gitBlameParamsSchema>;

interface GitBlameEntry {
  commit: string;
  author: string;
  date: string;
  lineNumber: number;
  content: string;
}

interface GitBlameResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  entries: GitBlameEntry[];
  duration: number;
  truncated: boolean;
}

function parseBlamePorcelain(output: string): GitBlameEntry[] {
  const entries: GitBlameEntry[] = [];
  const lines = output.split("\n");
  let currentCommit = "";
  let currentAuthor = "";
  let currentDate = "";
  let currentLineNum = 0;
  let currentContent = "";

  for (const line of lines) {
    if (line.startsWith("@")) {
      // New blame record starting
      if (currentCommit && currentContent) {
        entries.push({
          commit: currentCommit,
          author: currentAuthor,
          date: currentDate,
          lineNumber: currentLineNum,
          content: currentContent,
        });
      }
      currentContent = "";
      continue;
    }

    if (line.startsWith("author ")) {
      currentAuthor = line.slice(7);
    } else if (line.startsWith("author-time ")) {
      const timestamp = parseInt(line.slice(12), 10);
      if (!isNaN(timestamp)) {
        currentDate = new Date(timestamp * 1000).toISOString();
      }
    } else if (line.startsWith("commits ")) {
      currentCommit = line.slice(8);
    } else if (/^\d+$/.test(line)) {
      currentLineNum = parseInt(line, 10);
    } else if (line.startsWith("\t")) {
      currentContent = line.slice(1);
      entries.push({
        commit: currentCommit,
        author: currentAuthor,
        date: currentDate,
        lineNumber: currentLineNum,
        content: currentContent,
      });
    }
  }

  return entries;
}

export const gitBlameTool: Tool<GitBlameParams, GitBlameResult> = {
  name: "git-blame",
  description:
    "Show what revision and author last modified each line of a file. Use --start-line and --end-line to limit to a range. Use porcelain mode for machine-readable output.",
  parameters: gitBlameParamsSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(params: GitBlameParams, context: ToolContext): Promise<ToolResult<GitBlameResult>> {
    context.emit("tool.start", { tool: "git-blame", params });

    const args = ["blame"];
    if (params.porcelain) args.push("--porcelain");
    if (params.lastRevision) args.push("-M");
    if (params.startLine)
      args.push(
        `-L ${String(params.startLine)},${params.endLine != null ? String(params.endLine) : "$"}`,
      );

    args.push("--", params.file);

    const result = await executeGitCommand(args, context.workspaceRoot);

    let entries: GitBlameEntry[] = [];
    if (params.porcelain) {
      entries = parseBlamePorcelain(result.stdout);
    }

    const { value: stdout, truncated } = truncateOutput(result.stdout);

    const output: GitBlameResult = {
      stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      entries,
      duration: result.duration,
      truncated,
    };

    context.emit("tool.end", {
      tool: "git-blame",
      exitCode: result.exitCode,
      duration: result.duration,
    });
    return { success: true, data: output };
  },
};

// =============================================================================
// Exports
// =============================================================================

export const gitTools = {
  gitStatusTool,
  gitDiffTool,
  gitAddTool,
  gitCommitTool,
  gitLogTool,
  gitBlameTool,
};

export type {
  GitStatusParams,
  GitStatusResult,
  GitDiffParams,
  GitDiffResult,
  GitAddParams,
  GitAddResult,
  GitCommitParams,
  GitCommitResult,
  GitLogParams,
  GitLogResult,
  GitBlameParams,
  GitBlameResult,
};
