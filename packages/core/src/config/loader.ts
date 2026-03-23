import { readFileSync, existsSync } from "node:fs";
import { loadConfig as c12LoadConfig } from "c12";
import { parseJSONC } from "confbox/jsonc";
import { defu } from "defu";
import { DiriCodeConfigSchema } from "./schema.js";
import type { DiriCodeConfig } from "./schema.js";
import { getGlobalConfigDir } from "./paths.js";
import type { ConfigLayer } from "./validator.js";
import { join } from "node:path";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface LoadConfigOptions {
  cwd?: string;
  overrides?: DeepPartial<DiriCodeConfig>;
}

export interface LoadConfigResult {
  config: DiriCodeConfig;
  configFile?: string;
  layers: { source: ConfigLayer; config: Record<string, unknown> }[];
}

function mapDcEnvVars(): Record<string, unknown> {
  const overlay: Record<string, unknown> = {};

  const dcProvider = process.env.DC_PROVIDER;
  if (dcProvider != null && dcProvider !== "") {
    overlay.providers = { [dcProvider]: {} };
  }

  const dcModel = process.env.DC_MODEL;
  if (dcModel != null && dcModel !== "") {
    overlay.agents = { default: { model: dcModel } };
  }

  const dcVerbose = process.env.DC_VERBOSE;
  if (dcVerbose === "1" || dcVerbose === "true") {
    overlay.workMode = { verbosity: "verbose" };
  }

  return overlay;
}

function loadGlobalJsonc(): Record<string, unknown> {
  let globalDir: string;
  try {
    globalDir = getGlobalConfigDir();
  } catch {
    return {};
  }

  const globalConfigPath = join(globalDir, "config.jsonc");
  let content: string;
  try {
    content = readFileSync(globalConfigPath, "utf-8");
  } catch {
    return {};
  }

  const parsed: unknown = parseJSONC(content);
  if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return {};
}

export async function loadConfig(options?: LoadConfigOptions): Promise<LoadConfigResult> {
  const cwd = options?.cwd ?? process.cwd();
  const layers: { source: ConfigLayer; config: Record<string, unknown> }[] = [];

  const zodDefaults = DiriCodeConfigSchema.parse({});
  layers.push({ source: "defaults", config: zodDefaults as unknown as Record<string, unknown> });

  const globalConfig = loadGlobalJsonc();
  if (Object.keys(globalConfig).length > 0) {
    layers.push({ source: "global", config: globalConfig });
  }

  const c12Result = await c12LoadConfig<Record<string, unknown>>({
    cwd,
    configFile: ".dc/config",
    dotenv: true,
    globalRc: false,
    rcFile: false,
  });

  const projectConfig = c12Result.config;

  const rawConfigFile = c12Result.configFile ?? undefined;
  const projectConfigFile =
    rawConfigFile != null && existsSync(rawConfigFile) ? rawConfigFile : undefined;

  if (Object.keys(projectConfig).length > 0) {
    layers.push({ source: "project", config: projectConfig });
  }

  const envOverlay = mapDcEnvVars();
  const cliOverlay = (options?.overrides ?? {}) as Record<string, unknown>;
  const runtimeOverrides = defu(cliOverlay, envOverlay);

  if (Object.keys(runtimeOverrides).length > 0) {
    layers.push({ source: "runtime", config: runtimeOverrides });
  }

  const merged = defu(runtimeOverrides, projectConfig, globalConfig, zodDefaults);
  const validated = DiriCodeConfigSchema.parse(merged);

  return {
    config: validated,
    configFile: projectConfigFile,
    layers,
  };
}
