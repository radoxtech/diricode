import { describe, expect, it } from "vitest";
import {
  ModelCardSchema,
  ModelCardRegistry,
  ModelCardNotFoundError,
  ModelCardAlreadyRegisteredError,
} from "../index.js";
import type { ModelCard } from "../index.js";

function makeCard(overrides: Partial<ModelCard> = {}): ModelCard {
  return {
    model: "test-model",
    family: "test",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 8000,
    },
    known_for: {
      roles: ["coder"],
      complexities: ["simple"],
      specializations: ["backend"],
    },
    benchmarks: {
      quality: { by_complexity_role: {}, by_specialization: {} },
      speed: { tokens_per_second_avg: 0, feedback_count: 0 },
    },
    pricing_tier: "standard",
    learned_from: 0,
    ...overrides,
  };
}

describe("ModelCardSchema", () => {
  describe("parse", () => {
    it("accepts a valid model card", () => {
      const card = makeCard();
      expect(() => ModelCardSchema.parse(card)).not.toThrow();
    });

    it("rejects a card with empty model string", () => {
      expect(() => ModelCardSchema.parse(makeCard({ model: "" }))).toThrow();
    });

    it("rejects a card with empty family string", () => {
      expect(() => ModelCardSchema.parse(makeCard({ family: "" }))).toThrow();
    });

    it("rejects an invalid pricing_tier", () => {
      expect(() => ModelCardSchema.parse(makeCard({ pricing_tier: "ultra" as never }))).toThrow();
    });

    it("rejects a negative learned_from", () => {
      expect(() => ModelCardSchema.parse(makeCard({ learned_from: -1 }))).toThrow();
    });

    it("accepts null max_context", () => {
      const card = makeCard({
        capabilities: { ...makeCard().capabilities, max_context: null },
      });
      expect(() => ModelCardSchema.parse(card)).not.toThrow();
    });

    it("rejects missing required fields", () => {
      expect(() => ModelCardSchema.parse({})).toThrow();
    });
  });
});

describe("ModelCardRegistry", () => {
  describe("register", () => {
    it("registers a card and returns this for chaining", () => {
      const reg = new ModelCardRegistry();
      const card = makeCard();
      const result = reg.register(card);
      expect(result).toBe(reg);
      expect(reg.size).toBe(1);
    });

    it("throws ModelCardAlreadyRegisteredError on duplicate", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard());
      expect(() => reg.register(makeCard())).toThrow(ModelCardAlreadyRegisteredError);
    });

    it("error message includes model name", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "alpha" }));
      expect(() => reg.register(makeCard({ model: "alpha" }))).toThrow(/alpha/);
    });
  });

  describe("get", () => {
    it("returns the registered card", () => {
      const reg = new ModelCardRegistry();
      const card = makeCard({ model: "my-model" });
      reg.register(card);
      expect(reg.get("my-model")).toEqual(card);
    });

    it("throws ModelCardNotFoundError for unknown model", () => {
      const reg = new ModelCardRegistry();
      expect(() => reg.get("unknown")).toThrow(ModelCardNotFoundError);
    });

    it("error message includes the missing model name", () => {
      const reg = new ModelCardRegistry();
      expect(() => reg.get("missing-model")).toThrow(/missing-model/);
    });
  });

  describe("list", () => {
    it("returns empty array when no cards registered", () => {
      const reg = new ModelCardRegistry();
      expect(reg.list()).toEqual([]);
    });

    it("returns all registered cards", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "a" }));
      reg.register(makeCard({ model: "b" }));
      expect(reg.list()).toHaveLength(2);
    });
  });

  describe("has", () => {
    it("returns false for unregistered model", () => {
      const reg = new ModelCardRegistry();
      expect(reg.has("nope")).toBe(false);
    });

    it("returns true after registration", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "yes" }));
      expect(reg.has("yes")).toBe(true);
    });
  });

  describe("size", () => {
    it("is 0 initially", () => {
      expect(new ModelCardRegistry().size).toBe(0);
    });

    it("increments with each registration", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "x" }));
      expect(reg.size).toBe(1);
      reg.register(makeCard({ model: "y" }));
      expect(reg.size).toBe(2);
    });
  });

  describe("remove", () => {
    it("removes a registered card", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "rem" }));
      reg.remove("rem");
      expect(reg.has("rem")).toBe(false);
      expect(reg.size).toBe(0);
    });

    it("throws ModelCardNotFoundError when removing unknown model", () => {
      const reg = new ModelCardRegistry();
      expect(() => reg.remove("ghost")).toThrow(ModelCardNotFoundError);
    });

    it("returns this for chaining", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "chain" }));
      expect(reg.remove("chain")).toBe(reg);
    });
  });

  describe("update", () => {
    it("updates an existing card", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "upd", pricing_tier: "budget" }));
      reg.update(makeCard({ model: "upd", pricing_tier: "premium" }));
      expect(reg.get("upd").pricing_tier).toBe("premium");
    });

    it("throws ModelCardNotFoundError for unknown model", () => {
      const reg = new ModelCardRegistry();
      expect(() => reg.update(makeCard({ model: "phantom" }))).toThrow(ModelCardNotFoundError);
    });

    it("returns this for chaining", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "ch" }));
      expect(reg.update(makeCard({ model: "ch" }))).toBe(reg);
    });
  });

  describe("findByPricingTier", () => {
    it("returns only cards with the matching pricing tier", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "b1", pricing_tier: "budget" }));
      reg.register(makeCard({ model: "s1", pricing_tier: "standard" }));
      reg.register(makeCard({ model: "p1", pricing_tier: "premium" }));
      reg.register(makeCard({ model: "b2", pricing_tier: "budget" }));

      const budget = reg.findByPricingTier("budget");
      expect(budget).toHaveLength(2);
      expect(budget.every((c) => c.pricing_tier === "budget")).toBe(true);

      const premium = reg.findByPricingTier("premium");
      expect(premium).toHaveLength(1);
      expect(premium[0]?.model).toBe("p1");
    });

    it("returns empty array when no cards match the tier", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "s1", pricing_tier: "standard" }));
      expect(reg.findByPricingTier("premium")).toEqual([]);
    });
  });

  describe("findByFamily", () => {
    it("returns only cards matching the family", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "g1", family: "gemini" }));
      reg.register(makeCard({ model: "g2", family: "gemini" }));
      reg.register(makeCard({ model: "c1", family: "claude" }));

      const gemini = reg.findByFamily("gemini");
      expect(gemini).toHaveLength(2);
      expect(gemini.every((c) => c.family === "gemini")).toBe(true);
    });

    it("returns empty array when no cards match the family", () => {
      const reg = new ModelCardRegistry();
      reg.register(makeCard({ model: "x", family: "gpt" }));
      expect(reg.findByFamily("kimi")).toEqual([]);
    });
  });
});
