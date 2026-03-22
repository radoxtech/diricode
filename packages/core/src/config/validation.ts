import type { ZodError, ZodIssue } from "zod";

/**
 * Represents a single validation error with layer provenance.
 */
export interface ConfigValidationError {
  /** The path to the invalid field (e.g., "providers.openai.apiKey"). */
  path: string;
  /** Human-readable error message. */
  message: string;
  /** The config layer where this value originated. */
  layer: "defaults" | "global" | "project" | "runtime" | "unknown";
  /** The actual value that failed validation (sanitized if sensitive). */
  received?: unknown;
  /** The expected type or constraint. */
  expected?: string;
  /** Original Zod issue code for programmatic handling. */
  code?: string;
}

/**
 * Warning about unknown/extra keys in the config.
 */
export interface ConfigWarning {
  /** The path to the unknown key. */
  path: string;
  /** Warning message. */
  message: string;
  /** The layer where the unknown key was found. */
  layer: "defaults" | "global" | "project" | "runtime" | "unknown";
  /** The unknown key name. */
  key: string;
}

/**
 * Result of validating a configuration.
 */
export interface ValidationResult {
  /** Whether the config is valid. */
  valid: boolean;
  /** Validation errors, if any. */
  errors: ConfigValidationError[];
  /** Warnings about unknown keys, if any. */
  warnings: ConfigWarning[];
  /** The validated config (only present if valid). */
  config?: unknown;
}

/**
 * Maps a Zod issue path array to a dot-notation string.
 */
function pathToString(path: Array<string | number>): string {
  return path
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      if (index === 0) {
        return segment;
      }
      return `.${segment}`;
    })
    .join("");
}

/**
 * Formats a Zod issue into a human-readable error message.
 */
function formatZodIssue(issue: ZodIssue): { message: string; expected?: string } {
  switch (issue.code) {
    case "invalid_type":
      return {
        message: `Expected ${issue.expected}, received ${issue.received}`,
        expected: issue.expected,
      };
    case "invalid_literal":
      return {
        message: `Expected ${JSON.stringify(issue.expected)}, received ${JSON.stringify(issue.received)}`,
        expected: JSON.stringify(issue.expected),
      };
    case "too_small":
      if (issue.type === "string") {
        return {
          message: `String must contain at least ${issue.minimum} character(s)`,
          expected: `min ${issue.minimum} chars`,
        };
      }
      if (issue.type === "number") {
        return {
          message: `Number must be greater than or equal to ${issue.minimum}`,
          expected: `>= ${issue.minimum}`,
        };
      }
      if (issue.type === "array") {
        return {
          message: `Array must contain at least ${issue.minimum} element(s)`,
          expected: `min ${issue.minimum} items`,
        };
      }
      return {
        message: `Value must be at least ${issue.minimum}`,
        expected: `>= ${issue.minimum}`,
      };
    case "too_big":
      if (issue.type === "string") {
        return {
          message: `String must contain at most ${issue.maximum} character(s)`,
          expected: `max ${issue.maximum} chars`,
        };
      }
      if (issue.type === "number") {
        return {
          message: `Number must be less than or equal to ${issue.maximum}`,
          expected: `<= ${issue.maximum}`,
        };
      }
      if (issue.type === "array") {
        return {
          message: `Array must contain at most ${issue.maximum} element(s)`,
          expected: `max ${issue.maximum} items`,
        };
      }
      return {
        message: `Value must be at most ${issue.maximum}`,
        expected: `<= ${issue.maximum}`,
      };
    case "invalid_string":
      return {
        message: `Invalid ${issue.validation}`,
        expected: issue.validation as string,
      };
    case "invalid_enum_value":
      return {
        message: `Invalid enum value. Expected: ${issue.options.join(", ")}`,
        expected: issue.options.join(", "),
      };
    case "unrecognized_keys":
      return {
        message: `Unrecognized key(s): ${issue.keys.join(", ")}`,
        expected: "valid config keys only",
      };
    case "custom":
      return {
        message: issue.message,
      };
    default:
      return {
        message: issue.message,
      };
  }
}

/**
 * Converts a ZodError into structured validation errors with layer provenance.
 */
export function zodErrorToValidationErrors(
  error: ZodError,
  layerMap: Map<string, "defaults" | "global" | "project" | "runtime">,
): ConfigValidationError[] {
  return error.issues.map((issue) => {
    const path = pathToString(issue.path);
    const formatted = formatZodIssue(issue);
    const layer = layerMap.get(path) ?? "unknown";

    return {
      path,
      message: formatted.message,
      layer,
      received: "received" in issue ? issue.received : undefined,
      expected: formatted.expected,
      code: issue.code,
    };
  });
}

/**
 * Sanitizes sensitive values (like API keys) for error reporting.
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    // Detect API keys by common patterns
    if (/^(sk-|pk-)/i.test(value)) {
      return `${value.slice(0, 8)}...`;
    }
    if (/^Bearer\s/i.test(value)) {
      return `${value.slice(0, 16)}...`;
    }
    if (value.length > 20) {
      return `${value.slice(0, 12)}...`;
    }
  }
  return value;
}

/**
 * Formats validation errors for display.
 */
export function formatValidationErrors(errors: ConfigValidationError[]): string {
  if (errors.length === 0) {
    return "No validation errors.";
  }

  const lines: string[] = [];
  lines.push(`Config validation failed with ${errors.length} error(s):\n`);

  for (const error of errors) {
    const layerBadge = `[${error.layer}]`;
    lines.push(`  ${layerBadge} ${error.path}`);
    lines.push(`    → ${error.message}`);
    if (error.received !== undefined) {
      const sanitized = sanitizeValue(error.received);
      lines.push(`    → Received: ${JSON.stringify(sanitized)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Formats warnings for display.
 */
export function formatWarnings(warnings: ConfigWarning[]): string {
  if (warnings.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push(`Config warnings (${warnings.length}):\n`);

  for (const warning of warnings) {
    const layerBadge = `[${warning.layer}]`;
    lines.push(`  ${layerBadge} ${warning.path}`);
    lines.push(`    → ${warning.message}`);
    lines.push("");
  }

  return lines.join("\n");
}
