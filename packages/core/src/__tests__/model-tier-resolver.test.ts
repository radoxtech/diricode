import { describe, expect, it } from "vitest";
import { ModelTierResolver } from "../agents/model-tier-resolver.js";
import type { AvailabilityChecker, ModelTier } from "../agents/model-tier-resolver.js";

const DEFAULT_MAPPINGS = {
  heavy: { preferred: "claude-3-opus", fallback: ["o1", "gemini-2.5-pro"] },
  medium: { preferred: "claude-3.5-sonnet", fallback: ["gpt-4o", "gemini-2.5-flash"] },
  light: { preferred: "gpt-4o-mini", fallback: ["gemini-2.5-flash-lite"] },
} as const;

describe("ModelTierResolver", () => {
  describe("resolve — basic selection", () => {
    it("returns preferred model when available", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("claude-3-opus");
      expect(result.reason).toBe("preferred");
      expect(result.isDegraded).toBe(false);
      expect(result.fallbackIndex).toBe(0);
    });

    it("returns fallback when preferred is unavailable", () => {
      const checkAvailability: AvailabilityChecker = (model) => model !== "claude-3-opus";
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS, { checkAvailability });
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("o1");
      expect(result.reason).toBe("fallback");
      expect(result.isDegraded).toBe(false);
      expect(result.fallbackIndex).toBe(1);
    });

    it("returns second fallback when first fallback is also unavailable", () => {
      const checkAvailability: AvailabilityChecker = (model) =>
        model !== "claude-3-opus" && model !== "o1";
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS, { checkAvailability });
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("gemini-2.5-pro");
      expect(result.reason).toBe("fallback");
      expect(result.isDegraded).toBe(false);
      expect(result.fallbackIndex).toBe(2);
    });

    it("returns preferred as degraded when nothing is available", () => {
      const checkAvailability: AvailabilityChecker = () => false;
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS, { checkAvailability });
      const result = resolver.resolve("heavy");
      expect(result.model).toBe("claude-3-opus");
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
      expect(resolver.getPreferred("heavy")).toBe("claude-3-opus");
      expect(resolver.getPreferred("medium")).toBe("claude-3.5-sonnet");
      expect(resolver.getPreferred("light")).toBe("gpt-4o-mini");
    });
  });

  describe("getFallbackChain", () => {
    it("returns full chain including preferred", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.getFallbackChain("heavy")).toEqual(["claude-3-opus", "o1", "gemini-2.5-pro"]);
    });

    it("returns only preferred when no fallbacks configured", () => {
      const mappings = {
        heavy: { preferred: "claude-3-opus" },
        medium: { preferred: "claude-3.5-sonnet" },
        light: { preferred: "gpt-4o-mini" },
      };
      const resolver = new ModelTierResolver(mappings);
      expect(resolver.getFallbackChain("heavy")).toEqual(["claude-3-opus"]);
    });
  });

  describe("isPreferred", () => {
    it("returns true for preferred model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isPreferred("heavy", "claude-3-opus")).toBe(true);
    });

    it("returns false for fallback model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isPreferred("heavy", "o1")).toBe(false);
    });
  });

  describe("isInChain", () => {
    it("returns true for preferred model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isInChain("heavy", "claude-3-opus")).toBe(true);
    });

    it("returns true for fallback model", () => {
      const resolver = new ModelTierResolver(DEFAULT_MAPPINGS);
      expect(resolver.isInChain("heavy", "o1")).toBe(true);
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
      expect(resolver.getPreferred("heavy")).toBe("claude-3-opus");
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
