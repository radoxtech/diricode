import { watch, type FSWatcher, type WatchOptions } from "node:fs";
import { EventEmitter } from "node:events";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

/**
 * Events emitted by the ConfigWatcher.
 */
export interface ConfigWatcherEvents {
  /** Emitted when the config file changes. */
  change: (path: string) => void;
  /** Emitted when a config error occurs (validation or load failure). */
  error: (error: Error, path?: string) => void;
  /** Emitted when the watcher is ready. */
  ready: () => void;
  /** Emitted when the watcher is closed. */
  close: () => void;
}

/**
 * Options for the ConfigWatcher.
 */
export interface ConfigWatcherOptions {
  /** Current working directory. */
  cwd?: string;
  /** Path to the config file to watch. */
  configFile?: string;
  /** Also watch global config directory. */
  watchGlobal?: boolean;
  /** Also watch .env file in cwd. */
  watchEnv?: boolean;
  /** Debounce interval in milliseconds. */
  debounceMs?: number;
  /** Ignore initial add events. */
  ignoreInitial?: boolean;
}

/**
 * Watches config files for changes and triggers reload+revalidate.
 *
 * This class monitors:
 * - Project config file (.dc/config.jsonc or similar)
 * - Global config directory (~/.config/diricode/)
 * - Local .env file
 *
 * When changes are detected, it emits events that can trigger
 * config reload and revalidation.
 */
export class ConfigWatcher extends EventEmitter {
  private options: Required<ConfigWatcherOptions>;
  private watchers: FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isReady = false;
  private isClosed = false;

  constructor(options: ConfigWatcherOptions = {}) {
    super();
    this.options = {
      cwd: process.cwd(),
      configFile: ".dc/config",
      watchGlobal: false,
      watchEnv: true,
      debounceMs: 300,
      ignoreInitial: true,
      ...options,
    };
  }

  /**
   * Starts watching config files.
   */
  async start(): Promise<void> {
    if (this.isClosed) {
      throw new Error("ConfigWatcher has been closed and cannot be restarted");
    }

    if (this.watchers.length > 0) {
      throw new Error("ConfigWatcher is already running");
    }

    const watchedPaths: string[] = [];

    // Watch project config file
    const projectConfigPath = join(this.options.cwd, this.options.configFile);
    if (existsSync(projectConfigPath)) {
      watchedPaths.push(projectConfigPath);
    }

    // Also watch the config directory if it exists
    const configDir = dirname(projectConfigPath);
    if (existsSync(configDir)) {
      watchedPaths.push(configDir);
    }

    // Watch global config if enabled
    if (this.options.watchGlobal) {
      const globalConfigDir = this.getGlobalConfigDir();
      if (globalConfigDir && existsSync(globalConfigDir)) {
        watchedPaths.push(globalConfigDir);
      }
    }

    // Watch .env file if enabled
    if (this.options.watchEnv) {
      const envPath = join(this.options.cwd, ".env");
      if (existsSync(envPath)) {
        watchedPaths.push(envPath);
      }
    }

    if (watchedPaths.length === 0) {
      this.emit("error", new Error("No config files found to watch"), undefined);
      return;
    }

    // Create watchers
    for (const watchPath of watchedPaths) {
      try {
        const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
          this.handleFileChange(eventType, filename, watchPath);
        });

        watcher.on("error", (err) => {
          this.emit("error", err, watchPath);
        });

        this.watchers.push(watcher);
      } catch (err) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)), watchPath);
      }
    }

    this.isReady = true;
    this.emit("ready");
  }

  /**
   * Stops watching and cleans up resources.
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.isClosed = true;

    this.emit("close");
  }

  /**
   * Returns true if the watcher is currently active.
   */
  get watching(): boolean {
    return this.isReady && !this.isClosed && this.watchers.length > 0;
  }

  /**
   * Returns the list of paths being watched.
   */
  get watchedPaths(): string[] {
    return this.watchers.map((w) => {
      // FSWatcher doesn't expose the path directly, but we can infer it
      // from the internal state or track it ourselves
      return "(watching)";
    });
  }

  /**
   * Handles a file change event with debouncing.
   */
  private handleFileChange(eventType: string, filename: string | null, watchPath: string): void {
    // Ignore initial events if configured
    if (this.options.ignoreInitial && !this.isReady) {
      return;
    }

    // Debounce rapid changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    const fullPath = filename ? join(watchPath, filename) : watchPath;

    this.debounceTimer = setTimeout(() => {
      this.emit("change", fullPath);
    }, this.options.debounceMs);
  }

  /**
   * Gets the global config directory path.
   */
  private getGlobalConfigDir(): string | null {
    const platform = process.platform;
    const homeDir = process.env.HOME || process.env.USERPROFILE;

    if (!homeDir) {
      return null;
    }

    if (platform === "win32") {
      return join(process.env.APPDATA || homeDir, "diricode");
    }

    if (platform === "darwin") {
      return join(homeDir, "Library", "Application Support", "diricode");
    }

    // Linux and others
    return join(process.env.XDG_CONFIG_HOME || join(homeDir, ".config"), "diricode");
  }
}

/**
 * Creates a config watcher with the specified options.
 */
export function createConfigWatcher(options?: ConfigWatcherOptions): ConfigWatcher {
  return new ConfigWatcher(options);
}
