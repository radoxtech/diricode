import { defu } from "defu";
import { DiriCodeConfigSchema } from "@diricode/core";
import type { DiriCodeConfig } from "@diricode/core";
import { flagsToConfigOverlay } from "./flags.js";
import type { CLIFlags } from "./flags.js";

export async function resolveConfig(flags: CLIFlags): Promise<DiriCodeConfig> {
  const layer1 = DiriCodeConfigSchema.parse({});

  // TODO: load from ~/.config/dc/config.jsonc via c12
  const layer2: Record<string, unknown> = {};

  // TODO: load from .dc/config.jsonc via c12
  const layer3: Record<string, unknown> = {};

  const envOverlay: Record<string, unknown> = {};

  const dcProvider = process.env["DC_PROVIDER"];
  const dcModel = process.env["DC_MODEL"];
  const dcVerbose = process.env["DC_VERBOSE"];

  if (dcProvider != null && dcProvider !== "") {
    envOverlay["providers"] = { [dcProvider]: {} };
  }

  if (dcModel != null && dcModel !== "") {
    envOverlay["agents"] = { default: { model: dcModel } };
  }

  if (dcVerbose === "1" || dcVerbose === "true") {
    envOverlay["workMode"] = { verbosity: "verbose" };
  }

  const layer4 = defu(flagsToConfigOverlay(flags), envOverlay);

  const merged = defu(layer4, layer3, layer2, layer1);

  return DiriCodeConfigSchema.parse(merged);
}
