import { describe, it, expect } from "vitest";
import { z, type ZodType } from "zod";
import {
  zodErrorToValidationErrors,
  sanitizeValue,
  formatValidationErrors,
  formatWarnings,
} from "../validation.js";
import { ConfigValidator } from "../validator.js";
import { DiriCodeConfigSchema } from "../schema.js";

function createTestValidator(options?: { warnOnUnknownKeys?: boolean }): ConfigValidator {
  return new ConfigValidator(DiriCodeConfigSchema, options);
}

describe("validation", () => {
  describe("zodErrorToValidationErrors", () => {
    it("should convert ZodError to validation errors with layer info", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0),
      });

      const layerMap = new Map([
        ["name", "project" as const],
        ["age", "global" as const],
      ]);

      const result = schema.safeParse({ name: 123, age: -5 });
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = zodErrorToValidationErrors(result.error, layerMap);

        expect(errors).toHaveLength(2);
        expect(errors[0]).toMatchObject({
          path: "name",
          layer: "project",
          code: "invalid_type",
        });
        expect(errors[1]).toMatchObject({
          path: "age",
          layer: "global",
          code: "too_small",
        });
      }
    });

    it("should use 'unknown' layer when path not in layer map", () => {
      const schema = z.object({ name: z.string() });
      const layerMap = new Map<string, "project" | "defaults" | "global" | "runtime">();

      const result = schema.safeParse({ name: 123 });
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = zodErrorToValidationErrors(result.error, layerMap);
        expect(errors[0]?.layer).toBe("unknown");
      }
    });
  });

  describe("sanitizeValue", () => {
    it("should redact API keys", () => {
      expect(sanitizeValue("sk-abc123xyz789")).toBe("sk-abc12...");
      expect(sanitizeValue("pk-live-1234567890")).toBe("pk-live-...");
    });

    it("should redact Bearer tokens", () => {
      expect(sanitizeValue("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")).toBe(
        "Bearer eyJhbGciO...",
      );
    });

    it("should pass through normal strings", () => {
      expect(sanitizeValue("hello world")).toBe("hello world");
      expect(sanitizeValue("short")).toBe("short");
    });

    it("should pass through non-string values", () => {
      expect(sanitizeValue(42)).toBe(42);
      expect(sanitizeValue(true)).toBe(true);
      expect(sanitizeValue(null)).toBe(null);
      expect(sanitizeValue({ key: "value" })).toEqual({ key: "value" });
    });
  });

  describe("formatValidationErrors", () => {
    it("should format validation errors for display", () => {
      const errors = [
        {
          path: "providers.openai.apiKey",
          message: "Expected string, received number",
          layer: "project" as const,
          received: 123,
          code: "invalid_type",
        },
        {
          path: "workMode.autonomy",
          message: "Invalid enum value",
          layer: "global" as const,
          code: "invalid_enum_value",
        },
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain("Config validation failed with 2 error(s)");
      expect(formatted).toContain("[project] providers.openai.apiKey");
      expect(formatted).toContain("[global] workMode.autonomy");
      expect(formatted).toContain("Received: 123");
    });

    it("should handle empty errors", () => {
      expect(formatValidationErrors([])).toBe("No validation errors.");
    });
  });

  describe("formatWarnings", () => {
    it("should format warnings for display", () => {
      const warnings = [
        {
          path: "unknownKey",
          key: "unknownKey",
          message: 'Unknown configuration key "unknownKey" will be ignored',
          layer: "project" as const,
        },
      ];

      const formatted = formatWarnings(warnings);

      expect(formatted).toContain("Config warnings (1)");
      expect(formatted).toContain("[project] unknownKey");
    });

    it("should return empty string for no warnings", () => {
      expect(formatWarnings([])).toBe("");
    });
  });
});

describe("ConfigValidator", () => {
  it("should validate a valid config", () => {
    const validator = createTestValidator();

    const result = validator.validate({
      providers: {
        openai: { apiKey: "$OPENAI_API_KEY" },
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.config).toBeDefined();
  });

  it("should return errors for invalid config", () => {
    const validator = createTestValidator();

    const result = validator.validate({
      providers: {
        invalid_provider: { apiKey: "test" },
      },
    } as Record<string, unknown>);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should track layer provenance", () => {
    const validator = createTestValidator();

    validator.setLayer("providers.openai.apiKey", "project");
    validator.setLayer("workMode.verbosity", "global");

    expect(validator.getLayer("providers.openai.apiKey")).toBe("project");
    expect(validator.getLayer("workMode.verbosity")).toBe("global");
    expect(validator.getLayer("unknown.path")).toBeUndefined();
  });

  it("should validate with explicit layers", () => {
    const validator = createTestValidator();

    const result = validator.validateWithLayers({ providers: {} }, [
      { source: "defaults", config: { providers: {} } },
      { source: "project", config: { providers: {} } },
    ]);

    expect(result.valid).toBe(true);
  });

  it("should warn about unknown keys when enabled", () => {
    const simpleSchema = z.object({
      knownKey: z.string().optional(),
    });

    const validator = new ConfigValidator(simpleSchema as unknown as ZodType<unknown>, {
      warnOnUnknownKeys: true,
    });

    const result = validator.validate({
      unknownKey: "value",
      knownKey: "valid",
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]?.key).toBe("unknownKey");
  });

  it("should not warn about unknown keys when disabled", () => {
    const validator = createTestValidator({ warnOnUnknownKeys: false });

    const result = validator.validate({
      unknownKey: "value",
      providers: {},
    });

    expect(result.warnings).toHaveLength(0);
  });
});
