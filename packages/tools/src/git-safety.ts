import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ToolError } from "@diricode/core";

export type GitSafetyLevel = "off" | "basic" | "standard" | "strict";

export interface GitSafetyConfig {
  level: GitSafetyLevel;
  /** Branches considered protected. Force push will be blocked to these branches. */
  protectedBranches?: string[];
  /** Whether to require confirmation for git reset --hard. */
  requireResetConfirmation?: boolean;
  /** Whether to scan commits for secrets before allowing them. */
  scanCommitsForSecrets?: boolean;
  /** Patterns to detect as secrets (in addition to defaults). */
  secretPatterns?: { pattern: RegExp; name: string }[];
}

export const DEFAULT_GIT_SAFETY_CONFIG: GitSafetyConfig = {
  level: "standard",
  protectedBranches: ["main", "master", "develop", "production", "release/*"],
  requireResetConfirmation: true,
  scanCommitsForSecrets: true,
};

// Default protected branches (can be extended via config)
const DEFAULT_PROTECTED_BRANCHES = ["main", "master", "develop", "production"];

/**
 * Check if a branch is protected based on config
 */
function isProtectedBranch(branch: string, config: GitSafetyConfig): boolean {
  const protectedBranches = config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES;

  for (const pattern of protectedBranches) {
    // Support glob patterns like "release/*"
    if (pattern.includes("*")) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
      if (regex.test(branch)) return true;
    } else if (branch === pattern) {
      return true;
    }
  }

  return false;
}

/**
 * Check if this is a force push command
 */
function isForcePush(command: string): boolean {
  // Match git push with --force or -f flags
  // Examples: git push --force, git push -f, git push origin main --force-with-lease
  const pushRegex = /git\s+push\s/;
  const forceRegex =
    /(\s--force[\s-]|\s-f\s|^git\s+push\s+-f\s|^git\s+push\s+--force[\s-]|--force$|-f$)/;

  return pushRegex.test(command) && forceRegex.test(command);
}

/**
 * Extract the target branch from a git push command
 */
function extractPushBranch(command: string): string | null {
  const match = /git\s+push\s+\w+\s+([^\s-]+)/.exec(command);
  return match?.[1] ?? null;
}

/**
 * Check if this is a hard reset command
 */
function isHardReset(command: string): boolean {
  // Match git reset --hard or git reset -hard
  const resetRegex = /git\s+reset\s+(--hard\s|-hard\s|--hard$|-hard$)/;
  return resetRegex.test(command);
}

/**
 * Extract the reset target from a git reset command
 */
function extractResetTarget(command: string): string | null {
  const match = /git\s+reset\s+(?:--hard|-hard)\s+(.+?)(?:\s|$)/.exec(command);
  return match?.[1]?.trim() ?? null;
}

/**
 * Default secret patterns for detecting credentials and sensitive data
 */
const DEFAULT_SECRET_PATTERNS: { pattern: RegExp; name: string }[] = [
  // Private keys
  { pattern: /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/, name: "private key" },
  // API keys and tokens (common formats)
  {
    pattern: /['"]?(?:api[_-]?key|apikey)['"]?\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
    name: "API key",
  },
  // AWS credentials
  { pattern: /AKIA[0-9A-Z]{16}/, name: "AWS access key ID" },
  // GitHub tokens
  { pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/, name: "GitHub token" },
  // Generic secret patterns
  {
    pattern: /['"]?(?:password|passwd|pwd)['"]?\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/i,
    name: "password",
  },
  {
    pattern: /['"]?(?:secret|token)['"]?\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i,
    name: "secret/token",
  },
  // Database connection strings with passwords
  {
    pattern: /(mongodb|mysql|postgres|postgresql):\/\/[^:]+:[^@]+@/i,
    name: "database connection string",
  },
  // Auth tokens in URLs
  { pattern: /https?:\/\/[^:\s]+:[^@\s]+@/i, name: "URL with credentials" },
];

/**
 * Check if content contains secrets
 */
function findSecrets(
  content: string,
  customPatterns?: { pattern: RegExp; name: string }[],
): { found: boolean; matches: { name: string; line: number }[] } {
  const patterns = [...DEFAULT_SECRET_PATTERNS];
  if (customPatterns) {
    patterns.push(...customPatterns);
  }

  const lines = content.split("\n");
  const matches: { name: string; line: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    for (const { pattern, name } of patterns) {
      if (pattern.test(line)) {
        matches.push({ name, line: i + 1 });
      }
    }
  }

  return { found: matches.length > 0, matches };
}

/**
 * Get staged files from git
 */
async function getStagedFiles(workspaceRoot: string): Promise<string[]> {
  return new Promise((resolveResult) => {
    const child = spawn("git", ["diff", "--cached", "--name-only"], {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf-8");
    });

    child.on("close", () => {
      const files = output
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
      resolveResult(files);
    });

    child.on("error", () => {
      resolveResult([]);
    });
  });
}

/**
 * Check if file is a .env file or similar
 */
function isEnvFile(filename: string): boolean {
  const basename = filename.split("/").pop() ?? "";
  if (
    basename.includes("example") ||
    basename.includes("template") ||
    basename.includes("sample")
  ) {
    return false;
  }
  return basename === ".env" || /^\.env\.[a-z]+$/.test(basename) || basename.endsWith(".env");
}

/**
 * Run git safety checks synchronously
 *
 * @throws {ToolError} FORCE_PUSH_BLOCKED | HARD_RESET_BLOCKED | SECRETS_DETECTED
 */
export function runGitSafetyCheck(
  command: string,
  config: GitSafetyConfig = DEFAULT_GIT_SAFETY_CONFIG,
): void {
  if (config.level === "off") return;

  // Check for force push to protected branches
  if (isForcePush(command)) {
    const branch = extractPushBranch(command);
    if (branch && isProtectedBranch(branch, config)) {
      throw new ToolError(
        "FORCE_PUSH_BLOCKED",
        `Force push to protected branch "${branch}" is not allowed. ` +
          `Protected branches: ${(config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES).join(", ")}`,
      );
    }
  }

  // Check for hard reset (always block in strict mode, warn in standard/basic)
  if (isHardReset(command)) {
    if (config.requireResetConfirmation ?? true) {
      const target = extractResetTarget(command);
      throw new ToolError(
        "HARD_RESET_BLOCKED",
        `git reset --hard is potentially destructive. ` +
          `Target: ${target ?? "current HEAD"}. ` +
          `This operation will discard all uncommitted changes.`,
      );
    }
  }
}

/**
 * Run git safety checks asynchronously (includes file scanning)
 *
 * @throws {ToolError} FORCE_PUSH_BLOCKED | HARD_RESET_BLOCKED | SECRETS_DETECTED | ENV_FILE_COMMIT_BLOCKED
 */
export async function runGitSafetyCheckAsync(
  command: string,
  config: GitSafetyConfig = DEFAULT_GIT_SAFETY_CONFIG,
  workspaceRoot?: string,
): Promise<void> {
  // Run synchronous checks first
  runGitSafetyCheck(command, config);

  if (config.level === "off") return;

  // Scan for secrets in staged files if this is a commit command
  if ((config.scanCommitsForSecrets ?? true) && workspaceRoot) {
    const isCommitCommand = /git\s+commit/.test(command);

    if (isCommitCommand) {
      const stagedFiles = await getStagedFiles(workspaceRoot);

      for (const file of stagedFiles) {
        // Block .env files from being committed
        if (isEnvFile(file)) {
          throw new ToolError(
            "ENV_FILE_COMMIT_BLOCKED",
            `Attempting to commit environment file "${file}". ` +
              `Environment files should not be committed to version control. ` +
              `Add it to .gitignore instead.`,
          );
        }

        // Scan file content for secrets
        try {
          const filePath = resolve(workspaceRoot, file);
          const content = await readFile(filePath, "utf-8");
          const secretCheck = findSecrets(content, config.secretPatterns);

          if (secretCheck.found) {
            const details = secretCheck.matches
              .slice(0, 3) // Show max 3 matches
              .map((m) => `${m.name} (line ${String(m.line)})`)
              .join(", ");

            throw new ToolError(
              "SECRETS_DETECTED",
              `Potential secrets detected in "${file}": ${details}. ` +
                `Remove sensitive data before committing.`,
            );
          }
        } catch (err) {
          // Re-throw ToolErrors, ignore other errors (file might be binary, etc.)
          if (err instanceof ToolError) throw err;
        }
      }
    }
  }
}

/**
 * Validate if a git command is safe to execute
 * Returns validation result with details
 */
export function validateGitCommand(
  command: string,
  config: GitSafetyConfig = DEFAULT_GIT_SAFETY_CONFIG,
): { safe: boolean; reason?: string; code?: string } {
  try {
    runGitSafetyCheck(command, config);
    return { safe: true };
  } catch (err) {
    if (err instanceof ToolError) {
      return { safe: false, reason: err.message, code: err.code };
    }
    return { safe: false, reason: String(err) };
  }
}

/**
 * Get list of protected branches (useful for UI display)
 */
export function getProtectedBranches(
  config: GitSafetyConfig = DEFAULT_GIT_SAFETY_CONFIG,
): string[] {
  return config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES;
}

/**
 * Add a custom protected branch pattern
 */
export function addProtectedBranch(config: GitSafetyConfig, branch: string): GitSafetyConfig {
  const branches = new Set(config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES);
  branches.add(branch);
  return { ...config, protectedBranches: [...branches] };
}

/**
 * Remove a protected branch pattern
 */
export function removeProtectedBranch(config: GitSafetyConfig, branch: string): GitSafetyConfig {
  const branches = new Set(config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES);
  branches.delete(branch);
  return { ...config, protectedBranches: [...branches] };
}
