import { lstat, readlink, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { ToolError } from "@diricode/core";

export type FileWriteSafetyLevel = "off" | "basic" | "standard" | "strict";

export interface FileWriteSafetyConfig {
  level: FileWriteSafetyLevel;
  /** Path prefixes to block (relative to workspace root). Example: `["secrets/", ".env"]` */
  blocklist?: string[];
  /**
   * Path prefixes explicitly allowed even when default-protected.
   * CANNOT override hard-protected paths (.git).
   */
  allowlist?: string[];
}

export const DEFAULT_FILE_SAFETY_CONFIG: FileWriteSafetyConfig = { level: "standard" };

function isHardProtected(relativePath: string): boolean {
  return relativePath === ".git" || relativePath.startsWith(".git/");
}

function isDefaultProtected(relativePath: string): boolean {
  return relativePath === "node_modules" || relativePath.startsWith("node_modules/");
}

function matchesPatternList(relativePath: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (relativePath === pattern || relativePath.startsWith(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Synchronous safety check for file write paths. Validates against protected
 * paths, workspace boundary, and configurable blocklist/allowlist.
 *
 * @throws {ToolError} PROTECTED_PATH | PATH_OUTSIDE_WORKSPACE | BLOCKED_PATH
 */
export function runFileWriteSafetyCheck(
  resolvedPath: string,
  workspaceRoot: string,
  config: FileWriteSafetyConfig = DEFAULT_FILE_SAFETY_CONFIG,
): void {
  if (config.level === "off") return;

  const normalizedRoot = resolve(workspaceRoot);
  const normalizedPath = resolve(resolvedPath);
  const relativePath = relative(normalizedRoot, normalizedPath);

  if (isHardProtected(relativePath)) {
    throw new ToolError(
      "PROTECTED_PATH",
      `Write denied: "${relativePath}" is inside .git/ which is a hard-protected path`,
    );
  }

  const isExplicitlyAllowed =
    config.allowlist !== undefined &&
    config.allowlist.length > 0 &&
    matchesPatternList(relativePath, config.allowlist);

  if (isDefaultProtected(relativePath) && !isExplicitlyAllowed) {
    throw new ToolError(
      "PROTECTED_PATH",
      `Write denied: "${relativePath}" is inside node_modules/ which is protected by default. ` +
        `Add to allowlist to override.`,
    );
  }

  if (config.level === "basic") return;

  if (!normalizedPath.startsWith(normalizedRoot + "/") && normalizedPath !== normalizedRoot) {
    throw new ToolError(
      "PATH_OUTSIDE_WORKSPACE",
      `Write denied: path resolves outside workspace root "${normalizedRoot}"`,
    );
  }

  if (relativePath.startsWith("..")) {
    throw new ToolError(
      "PATH_OUTSIDE_WORKSPACE",
      `Write denied: "${relativePath}" escapes workspace root via path traversal`,
    );
  }

  if (
    config.blocklist !== undefined &&
    config.blocklist.length > 0 &&
    matchesPatternList(relativePath, config.blocklist) &&
    !isExplicitlyAllowed
  ) {
    throw new ToolError(
      "BLOCKED_PATH",
      `Write denied: "${relativePath}" matches a configured blocklist pattern`,
    );
  }
}

/**
 * Async symlink traversal protection — only active at `strict` level.
 * Checks the target and each parent directory for symlinks escaping workspace.
 *
 * @throws {ToolError} SYMLINK_TRAVERSAL
 */
export async function checkSymlinkSafety(
  resolvedPath: string,
  workspaceRoot: string,
  config: FileWriteSafetyConfig = DEFAULT_FILE_SAFETY_CONFIG,
): Promise<void> {
  if (config.level !== "strict") return;

  const normalizedRoot = resolve(workspaceRoot);

  let realRoot: string;
  try {
    realRoot = await realpath(normalizedRoot);
  } catch {
    realRoot = normalizedRoot;
  }

  function isInsideWorkspace(target: string): boolean {
    return (
      target.startsWith(normalizedRoot + "/") ||
      target === normalizedRoot ||
      target.startsWith(realRoot + "/") ||
      target === realRoot
    );
  }

  try {
    const lstats = await lstat(resolvedPath);
    if (lstats.isSymbolicLink()) {
      const linkTarget = await readlink(resolvedPath);
      const resolvedTarget = resolve(resolve(resolvedPath, ".."), linkTarget);

      if (!isInsideWorkspace(resolvedTarget)) {
        throw new ToolError(
          "SYMLINK_TRAVERSAL",
          `Write denied: symlink "${relative(normalizedRoot, resolvedPath)}" points to ` +
            `"${resolvedTarget}" which is outside workspace root`,
        );
      }
    }
  } catch (err) {
    if (err instanceof ToolError) throw err;
  }

  const pathParts = relative(normalizedRoot, resolvedPath).split("/");
  let currentPath = normalizedRoot;

  for (const part of pathParts.slice(0, -1)) {
    currentPath = resolve(currentPath, part);

    try {
      const lstats = await lstat(currentPath);
      if (lstats.isSymbolicLink()) {
        const linkTarget = await readlink(currentPath);
        const resolvedTarget = resolve(resolve(currentPath, ".."), linkTarget);

        if (!isInsideWorkspace(resolvedTarget)) {
          throw new ToolError(
            "SYMLINK_TRAVERSAL",
            `Write denied: directory component "${relative(normalizedRoot, currentPath)}" ` +
              `is a symlink pointing to "${resolvedTarget}" outside workspace root`,
          );
        }
      }
    } catch (err) {
      if (err instanceof ToolError) throw err;
      break;
    }
  }
}
