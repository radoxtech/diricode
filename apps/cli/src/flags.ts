import { z } from "zod";
import type { DiriCodeConfig } from "@diricode/core";

export type ModePreset = "safe" | "yolo" | "auto";

export interface CLIFlags {
  session?: string;
  config?: string;
  provider?: string;
  mode?: ModePreset;
  model?: string;
  json?: boolean;
  verbose?: boolean;
}

const ModePresetSchema = z.enum(["safe", "yolo", "auto"]);

export const CLIFlagsSchema = z.object({
  session: z.string().min(1).optional(),
  config: z.string().min(1).optional(),
  provider: z
    .enum(["openai", "anthropic", "google", "mistral", "cohere", "groq", "ollama", "azure-openai"])
    .optional(),
  mode: ModePresetSchema.optional(),
  model: z.string().min(1).optional(),
  json: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

export function validateFlags(raw: Record<string, unknown>): CLIFlags {
  return CLIFlagsSchema.parse(raw);
}

type WorkModeVerbosity = DiriCodeConfig["workMode"]["verbosity"];

interface WorkModePartial {
  autonomy?: DiriCodeConfig["workMode"]["autonomy"];
  verbosity?: WorkModeVerbosity;
  riskTolerance?: DiriCodeConfig["workMode"]["riskTolerance"];
  creativity?: DiriCodeConfig["workMode"]["creativity"];
}

const MODE_PRESETS: Record<ModePreset, WorkModePartial> = {
  safe: {
    autonomy: "manual",
    verbosity: "verbose",
    riskTolerance: "safe",
    creativity: "precise",
  },
  yolo: {
    autonomy: "full-auto",
    verbosity: "concise",
    riskTolerance: "aggressive",
    creativity: "exploratory",
  },
  auto: {
    autonomy: "semi-auto",
    verbosity: "normal",
    riskTolerance: "moderate",
    creativity: "balanced",
  },
};

interface ConfigOverlay {
  providers?: Partial<DiriCodeConfig["providers"]>;
  workMode?: WorkModePartial;
  agents?: Record<string, { model?: string }>;
}

export function flagsToConfigOverlay(flags: CLIFlags): ConfigOverlay {
  const overlay: ConfigOverlay = {};

  if (flags.provider != null) {
    overlay.providers = { [flags.provider]: {} };
  }

  const workModePartial: WorkModePartial =
    flags.mode != null ? { ...MODE_PRESETS[flags.mode] } : {};

  if (flags.verbose === true) {
    workModePartial.verbosity = "verbose";
  }

  if (Object.keys(workModePartial).length > 0) {
    overlay.workMode = workModePartial;
  }

  if (flags.model != null) {
    overlay.agents = { default: { model: flags.model } };
  }

  return overlay;
}
