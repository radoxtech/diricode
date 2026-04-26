import { describe, expect, it } from "vitest";
import { resolveFamilyMetadata } from "../../families/catalog.js";
import { normalizeModelFamily } from "../../families/normalization.js";

describe("normalizeModelFamily", () => {
  describe("Claude", () => {
    it("maps claude-3-opus to claude-opus", () => {
      const result = normalizeModelFamily("claude-3-opus");
      expect(result.family).toBe("claude-opus");
      expect(result.canonicalFamily).toBe("claude-opus");
      expect(result.stability).toBe("stable");
    });

    it("maps claude-4-opus to claude-opus", () => {
      const result = normalizeModelFamily("claude-4-opus");
      expect(result.family).toBe("claude-opus");
      expect(result.stability).toBe("stable");
    });

    it("maps claude-3.5-sonnet to claude-sonnet", () => {
      const result = normalizeModelFamily("claude-3.5-sonnet");
      expect(result.family).toBe("claude-sonnet");
      expect(result.stability).toBe("stable");
    });

    it("maps claude-4-sonnet to claude-sonnet", () => {
      const result = normalizeModelFamily("claude-4-sonnet");
      expect(result.family).toBe("claude-sonnet");
      expect(result.stability).toBe("stable");
    });

    it("maps claude-3-haiku to claude-haiku", () => {
      const result = normalizeModelFamily("claude-3-haiku");
      expect(result.family).toBe("claude-haiku");
      expect(result.stability).toBe("stable");
    });
  });

  describe("Gemini", () => {
    it("maps gemini-2.5-pro to gemini-pro", () => {
      const result = normalizeModelFamily("gemini-2.5-pro");
      expect(result.family).toBe("gemini-pro");
      expect(result.canonicalFamily).toBe("gemini-pro");
      expect(result.stability).toBe("stable");
    });

    it("maps gemini-pro to gemini-pro", () => {
      const result = normalizeModelFamily("gemini-pro");
      expect(result.family).toBe("gemini-pro");
      expect(result.stability).toBe("stable");
    });

    it("maps gemini-2.5-flash to gemini-flash", () => {
      const result = normalizeModelFamily("gemini-2.5-flash");
      expect(result.family).toBe("gemini-flash");
      expect(result.stability).toBe("stable");
    });

    it("maps gemini-flash-lite to gemini-flash-lite", () => {
      const result = normalizeModelFamily("gemini-1.5-flash-lite");
      expect(result.family).toBe("gemini-flash-lite");
      expect(result.stability).toBe("stable");
    });
  });

  describe("GPT — reasoning", () => {
    it("maps o1 to gpt-reasoning", () => {
      const result = normalizeModelFamily("o1");
      expect(result.family).toBe("gpt-reasoning");
      expect(result.canonicalFamily).toBe("gpt-reasoning");
      expect(result.stability).toBe("stable");
    });

    it("maps o1-mini to gpt-reasoning as preview", () => {
      const result = normalizeModelFamily("o1-mini");
      expect(result.family).toBe("gpt-reasoning");
      expect(result.stability).toBe("preview");
    });

    it("maps o3-mini to gpt-reasoning as preview", () => {
      const result = normalizeModelFamily("o3-mini");
      expect(result.family).toBe("gpt-reasoning");
      expect(result.stability).toBe("preview");
    });

    it("maps gpt-o1 to gpt-reasoning", () => {
      const result = normalizeModelFamily("gpt-o1");
      expect(result.family).toBe("gpt-reasoning");
      expect(result.stability).toBe("stable");
    });
  });

  describe("GPT — standard", () => {
    it("maps gpt-4o to gpt-standard", () => {
      const result = normalizeModelFamily("gpt-4o");
      expect(result.family).toBe("gpt-standard");
      expect(result.canonicalFamily).toBe("gpt-standard");
      expect(result.stability).toBe("stable");
    });

    it("maps gpt-4o-mini to gpt-mini as stable", () => {
      const result = normalizeModelFamily("gpt-4o-mini");
      expect(result.family).toBe("gpt-mini");
      expect(result.stability).toBe("stable");
    });

    it("maps gpt-3.5-turbo to gpt-mini", () => {
      const result = normalizeModelFamily("gpt-3.5-turbo");
      expect(result.family).toBe("gpt-mini");
      expect(result.stability).toBe("stable");
    });
  });

  describe("preview detection", () => {
    it("marks o1-preview as preview", () => {
      const result = normalizeModelFamily("o1-preview");
      expect(result.family).toBe("gpt-reasoning");
      expect(result.stability).toBe("preview");
    });

    it("marks gemini-2.5-pro-preview as preview", () => {
      const result = normalizeModelFamily("gemini-2.5-pro-preview");
      expect(result.family).toBe("gemini-pro");
      expect(result.stability).toBe("preview");
    });

    it("marks beta model as preview", () => {
      const result = normalizeModelFamily("gpt-4o-beta");
      expect(result.stability).toBe("preview");
    });

    it("marks alpha model as preview", () => {
      const result = normalizeModelFamily("claude-sonnet-alpha");
      expect(result.stability).toBe("preview");
    });
  });

  describe("unknown families", () => {
    it("keeps unknown vendor model IDs neutral instead of inheriting a canonical family", () => {
      const result = normalizeModelFamily("glm-5-plus");
      expect(result.family).toBe("glm-5-plus");
      expect(result.canonicalFamily).toBeUndefined();
      expect(result.stability).toBe("stable");
    });

    it("returns no family metadata defaults for unknown families", () => {
      expect(resolveFamilyMetadata("glm-5-plus")).toBeUndefined();
    });

    it("still resolves canonical metadata for known families", () => {
      expect(resolveFamilyMetadata("claude-4-sonnet")).toMatchObject({
        family: "claude-sonnet",
        stability: "stable",
        default_attributes: ["agentic", "quality", "ui-ux"],
      });
    });
  });
});
