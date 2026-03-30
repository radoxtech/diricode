import { describe, expect, it } from "vitest";
import {
  ModelCardSchema,
  PickerSubscriptionSchema,
  ModelCardRegistry,
  SubscriptionRegistry,
  getSeedModelCards,
  getSeedSubscriptions,
  seedAllRegistries,
} from "../index.js";

describe("Seed data", () => {
  describe("getSeedModelCards", () => {
    it("returns at least 10 model cards", () => {
      const cards = getSeedModelCards();
      expect(cards.length).toBeGreaterThanOrEqual(10);
    });

    it("all model cards pass ModelCardSchema validation", () => {
      for (const card of getSeedModelCards()) {
        expect(() => ModelCardSchema.parse(card)).not.toThrow();
      }
    });

    it("all model cards have a pricing_tier assigned", () => {
      for (const card of getSeedModelCards()) {
        expect(["budget", "standard", "premium"]).toContain(card.pricing_tier);
      }
    });

    it("all model cards have at least one role in known_for", () => {
      for (const card of getSeedModelCards()) {
        expect(card.known_for.roles.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("all model cards have at least one complexity in known_for", () => {
      for (const card of getSeedModelCards()) {
        expect(card.known_for.complexities.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("all benchmarks start with zero feedback_count (speed)", () => {
      for (const card of getSeedModelCards()) {
        expect(card.benchmarks.speed.feedback_count).toBe(0);
      }
    });

    it("all benchmarks quality.by_complexity_role start empty", () => {
      for (const card of getSeedModelCards()) {
        expect(Object.keys(card.benchmarks.quality.by_complexity_role)).toHaveLength(0);
      }
    });

    it("all benchmarks quality.by_specialization start empty", () => {
      for (const card of getSeedModelCards()) {
        expect(Object.keys(card.benchmarks.quality.by_specialization)).toHaveLength(0);
      }
    });

    it("all cards have learned_from = 0", () => {
      for (const card of getSeedModelCards()) {
        expect(card.learned_from).toBe(0);
      }
    });

    it("includes cards from multiple families", () => {
      const families = new Set(getSeedModelCards().map((c) => c.family));
      expect(families.size).toBeGreaterThanOrEqual(3);
    });

    it("includes at least one budget, one standard, and one premium card", () => {
      const cards = getSeedModelCards();
      expect(cards.some((c) => c.pricing_tier === "budget")).toBe(true);
      expect(cards.some((c) => c.pricing_tier === "standard")).toBe(true);
      expect(cards.some((c) => c.pricing_tier === "premium")).toBe(true);
    });
  });

  describe("getSeedSubscriptions", () => {
    it("all subscriptions pass PickerSubscriptionSchema validation", () => {
      for (const sub of getSeedSubscriptions()) {
        expect(() => PickerSubscriptionSchema.parse(sub)).not.toThrow();
      }
    });

    it("all subscriptions reference existing model cards", () => {
      const cardModels = new Set(getSeedModelCards().map((c) => c.model));
      for (const sub of getSeedSubscriptions()) {
        expect(cardModels.has(sub.model)).toBe(true);
      }
    });

    it("at least one model has multiple subscriptions (two-level architecture)", () => {
      const subs = getSeedSubscriptions();
      const modelCounts = new Map<string, number>();
      for (const sub of subs) {
        modelCounts.set(sub.model, (modelCounts.get(sub.model) ?? 0) + 1);
      }
      const hasMulti = Array.from(modelCounts.values()).some((count) => count > 1);
      expect(hasMulti).toBe(true);
    });

    it("includes at least one trusted subscription", () => {
      expect(getSeedSubscriptions().some((s) => s.trusted)).toBe(true);
    });

    it("includes at least one untrusted subscription", () => {
      expect(getSeedSubscriptions().some((s) => !s.trusted)).toBe(true);
    });
  });

  describe("seedAllRegistries", () => {
    it("populates both registries without error", () => {
      const cardReg = new ModelCardRegistry();
      const subReg = new SubscriptionRegistry(cardReg);
      expect(() => seedAllRegistries(cardReg, subReg)).not.toThrow();
    });

    it("card registry has at least 10 cards after seeding", () => {
      const cardReg = new ModelCardRegistry();
      const subReg = new SubscriptionRegistry(cardReg);
      seedAllRegistries(cardReg, subReg);
      expect(cardReg.size).toBeGreaterThanOrEqual(10);
    });

    it("all seeded subscriptions are retrievable from sub registry", () => {
      const cardReg = new ModelCardRegistry();
      const subReg = new SubscriptionRegistry(cardReg);
      seedAllRegistries(cardReg, subReg);
      for (const sub of getSeedSubscriptions()) {
        expect(subReg.has(sub.id)).toBe(true);
      }
    });

    it("each seeded subscription's model exists in card registry", () => {
      const cardReg = new ModelCardRegistry();
      const subReg = new SubscriptionRegistry(cardReg);
      seedAllRegistries(cardReg, subReg);
      for (const sub of subReg.list()) {
        expect(cardReg.has(sub.model)).toBe(true);
      }
    });
  });
});
