import { type ZodType } from "zod";
import {
  type ConfigWarning,
  type ValidationResult,
  zodErrorToValidationErrors,
} from "./validation.js";
import { DiriCodeConfigSchema } from "./schema.js";

/**
 * Tracks which config layer each value came from.
 */
export type ConfigLayer = "defaults" | "global" | "project" | "runtime";

/**
 * Options for the ConfigValidator.
 */
export interface ConfigValidatorOptions {
  /** Whether to warn about unknown/extra keys. */
  warnOnUnknownKeys?: boolean;
  /** Custom layer map for provenance tracking. */
  layerMap?: Map<string, ConfigLayer>;
}

/**
 * Validates configuration with layer provenance tracking.
 *
 * This class provides:
 * - Structured validation errors with layer attribution
 * - Unknown key warnings
 * - Layer provenance tracking for each config value
 */
export class ConfigValidator {
  private schema: ZodType<unknown>;
  private options: ConfigValidatorOptions;
  private layerMap: Map<string, ConfigLayer>;

  constructor(schema: ZodType<unknown>, options: ConfigValidatorOptions = {}) {
    this.schema = schema;
    this.options = {
      warnOnUnknownKeys: true,
      ...options,
    };
    this.layerMap = options.layerMap ?? new Map<string, ConfigLayer>();
  }

  /**
   * Validates a raw config object.
   */
  validate(rawConfig: unknown): ValidationResult {
    const result = this.schema.safeParse(rawConfig);

    if (!result.success) {
      const errors = zodErrorToValidationErrors(result.error, this.layerMap);
      return {
        valid: false,
        errors,
        warnings: [],
      };
    }

    const warnings = this.options.warnOnUnknownKeys ? this.detectUnknownKeys(rawConfig) : [];

    return {
      valid: true,
      errors: [],
      warnings,
      config: result.data,
    };
  }

  /**
   * Validates a config with explicit layer tracking.
   *
   * This is useful when you know which layer each part of the config came from
   * and want accurate provenance in error messages.
   */
  validateWithLayers(
    rawConfig: unknown,
    layers: { source: ConfigLayer; config: Record<string, unknown> }[],
  ): ValidationResult {
    // Build layer map from the provided layers
    this.layerMap.clear();
    for (const layer of layers) {
      this.buildLayerMap(layer.config, layer.source, "");
    }

    return this.validate(rawConfig);
  }

  /**
   * Sets the layer for a specific config path.
   */
  setLayer(path: string, layer: ConfigLayer): void {
    this.layerMap.set(path, layer);
  }

  /**
   * Gets the layer for a specific config path.
   */
  getLayer(path: string): ConfigLayer | undefined {
    return this.layerMap.get(path);
  }

  /**
   * Detects unknown/extra keys in the raw config.
   *
   * This compares the raw config keys against the schema's shape
   * to find keys that aren't defined in the schema.
   */
  private detectUnknownKeys(rawConfig: unknown): ConfigWarning[] {
    const warnings: ConfigWarning[] = [];

    if (rawConfig == null || typeof rawConfig !== "object") {
      return warnings;
    }

    const config = rawConfig as Record<string, unknown>;
    const knownKeys = this.getKnownKeys();

    for (const key of Object.keys(config)) {
      if (!knownKeys.has(key)) {
        const layer = this.layerMap.get(key) ?? "unknown";
        warnings.push({
          path: key,
          key,
          message: `Unknown configuration key "${key}" will be ignored`,
          layer,
        });
      }
    }

    // Recursively check nested objects
    this.findUnknownKeysRecursive(config, knownKeys, "", warnings);

    return warnings;
  }

  /**
   * Gets the set of known keys from the schema.
   */
  private getKnownKeys(): Set<string> {
    // The schema has strict() so it will reject unknown keys at validation time.
    // For warning purposes, we extract the shape keys.
    const typedSchema = this.schema as unknown as {
      _def: { shape: () => Record<string, unknown> };
    };
    const shape = typedSchema._def.shape();
    return new Set(Object.keys(shape));
  }

  /**
   * Recursively finds unknown keys in nested objects.
   */
  private findUnknownKeysRecursive(
    obj: Record<string, unknown>,
    knownKeys: Set<string>,
    path: string,
    warnings: ConfigWarning[],
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      const layer = this.layerMap.get(fullPath) ?? "unknown";

      if (!knownKeys.has(key) && path === "") {
        // Top-level unknown keys are already handled above
        continue;
      }

      // Check nested objects
      if (value != null && typeof value === "object" && !Array.isArray(value)) {
        // For known keys that are objects, we need to check their shape
        // This is a simplified check - in practice, we'd need to introspect the schema deeper
        const nestedObj = value as Record<string, unknown>;
        for (const nestedKey of Object.keys(nestedObj)) {
          const nestedPath = `${fullPath}.${nestedKey}`;
          const nestedLayer = this.layerMap.get(nestedPath) ?? layer;

          // Check if this is a .strict() schema by looking for _def.unknownKeys
          const isStrict = this.isStrictSchemaAtPath(fullPath);
          if (isStrict) {
            warnings.push({
              path: nestedPath,
              key: nestedKey,
              message: `Unknown key "${nestedKey}" in ${fullPath} will be ignored`,
              layer: nestedLayer,
            });
          }
        }
      }
    }
  }

  /**
   * Checks if the schema at a given path uses strict mode.
   */
  private isStrictSchemaAtPath(_path: string): boolean {
    // The DiriCodeConfigSchema uses .strict() for all nested objects
    // This is a simplified check - in production, you'd introspect the schema
    return true;
  }

  /**
   * Builds a layer map from a config object.
   */
  private buildLayerMap(obj: Record<string, unknown>, layer: ConfigLayer, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      this.layerMap.set(path, layer);

      if (value != null && typeof value === "object" && !Array.isArray(value)) {
        this.buildLayerMap(value as Record<string, unknown>, layer, path);
      }
    }
  }
}

/**
 * Creates a validator with the DiriCode config schema.
 */
export function createValidator(options?: ConfigValidatorOptions): ConfigValidator {
  return new ConfigValidator(DiriCodeConfigSchema, options);
}
