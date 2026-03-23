export { DiriCodeConfigSchema } from "./schema.js";
export type { DiriCodeConfig } from "./schema.js";
export { loadConfig } from "./loader.js";
export type { LoadConfigOptions, LoadConfigResult } from "./loader.js";
export { getGlobalConfigDir, getProjectConfigPath } from "./paths.js";

export {
  zodErrorToValidationErrors,
  sanitizeValue,
  formatValidationErrors,
  formatWarnings,
} from "./validation.js";
export type { ConfigValidationError, ConfigWarning, ValidationResult } from "./validation.js";

export { ConfigValidator, createValidator } from "./validator.js";
export type { ConfigLayer, ConfigValidatorOptions } from "./validator.js";

export { ConfigWatcher, createConfigWatcher } from "./watcher.js";
export type { ConfigWatcherEvents, ConfigWatcherOptions } from "./watcher.js";

export { ReloadableConfig, createReloadableConfig, loadValidatedConfig } from "./reloadable.js";
export type { ReloadableConfigOptions } from "./reloadable.js";
