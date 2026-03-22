import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Returns the platform-specific global config directory for DiriCode.
 *
 * - Linux: `$XDG_CONFIG_HOME/dc/` (fallback to `~/.config/dc/`)
 * - macOS: `~/Library/Preferences/dc/`
 * - Other: throws an error (no Windows support in MVP)
 */
export function getGlobalConfigDir(): string {
  const platform = process.platform;

  if (platform === "darwin") {
    return join(homedir(), "Library", "Preferences", "dc");
  }

  if (platform === "linux") {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    const base =
      xdgConfigHome != null && xdgConfigHome !== "" ? xdgConfigHome : join(homedir(), ".config");
    return join(base, "dc");
  }

  throw new Error(
    `Unsupported platform: "${platform}". DiriCode MVP supports Linux and macOS only.`,
  );
}

/**
 * Returns the path to the project-level config file.
 *
 * Always resolves to `<cwd>/.dc/config.jsonc`.
 *
 * @param cwd - Project root directory. Defaults to `process.cwd()`.
 */
export function getProjectConfigPath(cwd?: string): string {
  const base = cwd ?? process.cwd();
  return join(base, ".dc", "config.jsonc");
}
