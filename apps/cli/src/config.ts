import { loadConfig } from "@diricode/core";
import type { DiriCodeConfig } from "@diricode/core";
import { flagsToConfigOverlay } from "./flags.js";
import type { CLIFlags } from "./flags.js";

export async function resolveConfig(flags: CLIFlags): Promise<DiriCodeConfig> {
  const cliOverlay = flagsToConfigOverlay(flags);
  const { config } = await loadConfig({
    cwd: process.cwd(),
    overrides: cliOverlay,
  });
  return config;
}
