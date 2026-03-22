import { loadConfig, type LoadConfigOptions, type LoadConfigResult } from "./loader.js";
import { ConfigValidator, type ConfigValidatorOptions } from "./validator.js";
import { ConfigWatcher, type ConfigWatcherOptions } from "./watcher.js";
import { DiriCodeConfigSchema, type DiriCodeConfig } from "./schema.js";
import type { ValidationResult } from "./validation.js";

/**
 * Options for creating a reloadable config.
 */
export interface ReloadableConfigOptions {
  /** Options for loading the config. */
  loadOptions?: LoadConfigOptions;
  /** Options for the validator. */
  validatorOptions?: ConfigValidatorOptions;
  /** Options for the file watcher. */
  watcherOptions?: ConfigWatcherOptions;
  /** Enable dev mode with file watching. */
  devMode?: boolean;
  /** Callback when config is reloaded. */
  onReload?: (result: ValidationResult) => void;
  /** Callback when reload fails. */
  onError?: (error: Error) => void;
}

/**
 * A reloadable config that can watch for changes and revalidate.
 *
 * This combines the loader, validator, and watcher into a single
 * convenient interface for dev-mode config management.
 */
export class ReloadableConfig {
  private options: ReloadableConfigOptions;
  private validator: ConfigValidator;
  private watcher?: ConfigWatcher;
  private currentConfig?: DiriCodeConfig;
  private currentResult?: LoadConfigResult;

  constructor(options: ReloadableConfigOptions = {}) {
    this.options = {
      devMode: false,
      ...options,
    };

    this.validator = new ConfigValidator(DiriCodeConfigSchema, options.validatorOptions);
  }

  /**
   * Loads and validates the config initially.
   */
  async load(): Promise<ValidationResult> {
    try {
      // Load the config
      this.currentResult = await loadConfig(this.options.loadOptions);

      // Validate with layer provenance
      const validation = this.validator.validateWithLayers(
        this.currentResult.config,
        this.currentResult.layers,
      );

      if (validation.valid) {
        this.currentConfig = validation.config as DiriCodeConfig;
      }

      // Start watching if in dev mode
      if (this.options.devMode) {
        this.startWatching();
      }

      return validation;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (this.options.onError) {
        this.options.onError(err);
      }
      return {
        valid: false,
        errors: [
          {
            path: "",
            message: err.message,
            layer: "unknown",
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Reloads and revalidates the config.
   */
  async reload(): Promise<ValidationResult> {
    const result = await this.load();

    if (this.options.onReload) {
      this.options.onReload(result);
    }

    return result;
  }

  /**
   * Returns the current validated config.
   *
   * Throws if the config hasn't been loaded or is invalid.
   */
  getConfig(): DiriCodeConfig {
    if (!this.currentConfig) {
      throw new Error("Config has not been loaded or is invalid");
    }
    return this.currentConfig;
  }

  /**
   * Returns the current config if available, or undefined.
   */
  getConfigOrUndefined(): DiriCodeConfig | undefined {
    return this.currentConfig;
  }

  /**
   * Returns true if the config has been loaded and is valid.
   */
  get isValid(): boolean {
    return this.currentConfig !== undefined;
  }

  /**
   * Returns true if the file watcher is active.
   */
  get isWatching(): boolean {
    return this.watcher?.watching ?? false;
  }

  /**
   * Stops watching for file changes.
   */
  stopWatching(): void {
    this.watcher?.stop();
    this.watcher = undefined;
  }

  /**
   * Starts watching for file changes.
   */
  private startWatching(): void {
    if (this.watcher) {
      return;
    }

    this.watcher = new ConfigWatcher({
      cwd: this.options.loadOptions?.cwd,
      configFile: ".dc/config",
      watchEnv: true,
      watchGlobal: false,
      ...this.options.watcherOptions,
    });

    this.watcher.on("change", () => {
      void this.reload();
    });

    this.watcher.on("error", (err: Error) => {
      if (this.options.onError) {
        this.options.onError(err);
      }
    });

    this.watcher.start();
  }
}

/**
 * Creates a reloadable config with the specified options.
 */
export function createReloadableConfig(options?: ReloadableConfigOptions): ReloadableConfig {
  return new ReloadableConfig(options);
}

/**
 * Loads config with validation and optional dev-mode watching.
 *
 * This is a convenience function that combines loading, validation,
 * and file watching into a single call.
 */
export async function loadValidatedConfig(options: ReloadableConfigOptions = {}): Promise<{
  config: DiriCodeConfig;
  validation: ValidationResult;
  reloadable: ReloadableConfig;
}> {
  const reloadable = createReloadableConfig(options);
  const validation = await reloadable.load();

  if (!validation.valid || !validation.config) {
    throw new Error(
      `Config validation failed:\n${validation.errors
        .map((e) => `  [${e.layer}] ${e.path}: ${e.message}`)
        .join("\n")}`,
    );
  }

  return {
    config: validation.config as DiriCodeConfig,
    validation,
    reloadable,
  };
}
