import { describe, expect, it } from "vitest";
import { ModelTierResolver } from "../agents/model-tier-resolver.js";
import type { AvailabilityChecker, ModelTier } from "../agents/model-tier-resolver.js";

const DEFAULT_MAPPINGS = {
  heavy: { preferred: "claude-opus-4.6", fallback: ["gpt-5.4", "gemini-3.1-pro"] },
  medium: { preferred: "sonnet-4.6", fallback: ["kimi-2.5", "qwen3-coder-next"] },
  light: { preferred: "haiku-4.5", fallback: ["deepseek-v3.2"] },
} as const;

describe("ModelTierResolver", () => {
  describe("resolve — basic selection", () => {
    it("returns preferred model when available", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("claude-opus-4.6");
      expect(result.reason).toBe("preferred");
      expect(result.isDegraded).toBe(false);
      expect(result.fallbackIndex).toBe(0);
    });

    it("returns fallback when preferred is unavailable", () => {
      const checkAvailability: AvailabilityChecker = (model) => model !== "claude-opus-4.6";
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS, { checkAvailability });
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("gpt-5.4");
      expect(result.reason).toBe("fallback");
      expect(result.isDegraded).toBe(false);
      expect(result.fallbackIndex).toBe(1);
    });

    it("returns second fallback when first fallback is also unavailable", () => {
      const checkAvailability: AvailabilityChecker = (model) =>
        model !== "claude-opus-4.6" && model !== "gpt-5.4";
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS, { checkAvailability });
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("gemini-3.1-pro");
      expect(result.reason).toBe("fallback");
      expect(result.isDegraded).toBe(false);
      expect(result.fallbackIndex).toBe(2);
    });

    it("returns preferred as degraded when nothing is available", () => {
      const checkAvailability: AvailabilityChecker = () => false;
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS, { checkAvailability });
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("claude-opus-4.6");
      expect(result.reason).toBe("degraded");
      expect(result.isDegraded).toBe(true);
      expect(result.fallbackIndex).toBe(0);
    });

    it("throws when tier has no mapping", () => {
      const mappings = { medium: { preferred: "sonnet" } } as Record<
        ModelTier,
        { preferred: string }
      >;
      const resolver = new ModelTierResolver(mappings);
      expect(() => resolver.resolve("heavy")).toThrow("No mapping configured for tier");
    });
  });

  describe("getPreferred", () => {
    it("returns preferred model without checking availability", () => {
      const checkAvailability: AvailabilityChecker = () => false;
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS, { checkAvailability });
      expect(resolver.getPreferred("heavy")).toBe("claude-opus-4.6");
      expect(resolver.getPreferred("medium")).toBe("sonnet-4.6");
      expect(resolver.getPreferred("light")).toBe("haiku-4.5");
    });
  });

  describe("getFallbackChain", () => {
    it("returns full chain including preferred", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.getFallbackChain("heavy")).toEqual([
        "claude-opus-4.6",
        "gpt-5.4",
        "gemini-3.1-pro",
      ]);
    });

    it("returns only preferred when no fallbacks configured", () => {
      const mappings = {
        heavy: { preferred: "claude-opus-4.6" },
        medium: { preferred: "sonnet" },
        light: { preferred: "haiku" },
      };
      const resolver = new ModelTierResolver(mappings);
      expect(resolver.getFallbackChain("heavy")).toEqual(["claude-opus-4.6"]);
    });
  });

  describe("isPreferred", () => {
    it("returns true for preferred model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isPreferred("heavy", "claude-opus-4.6")).toBe(true);
    });

    it("returns false for fallback model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isPreferred("heavy", "gpt-5.4")).toBe(false);
    });
  });

  describe("isInChain", () => {
    it("returns true for preferred model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isInChain("heavy", "claude-opus-4.6")).toBe(true);
    });

    it("returns true for fallback model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isInChain("heavy", "gpt-5.4")).toBe(true);
    });

    it("returns false for model not in chain", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isInChain("heavy", "unknown-model")).toBe(false);
    });
  });

  describe("updateMapping", () => {
    it("returns new resolver with updated mapping", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      const updated = resolver.updateMapping("heavy", {
        preferred: "new-preferred",
        fallback: ["new-fallback"],
      });

      expect(updated.getPreferred("heavy")).toBe("new-preferred");
      expect(updated.getFallbackChain("heavy")).toEqual(["new-preferred", "new-fallback"]);
      expect(resolver.getPreferred("heavy")).toBe("claude-opus-4.6");
    });
  });

  describe("requestedTier in resolution", () => {
    it("returns the requested tier in the result", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.resolve("heavy").requestedTier).toBe("heavy");
      expect(resolver.resolve("medium").requestedTier).toBe("medium");
      expect(resolver.resolve("light").requestedTier).toBe("light");
    });
  });
});
