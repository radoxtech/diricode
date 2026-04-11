import { describe, expect, it } from "vitest";
import {
  PickerSubscriptionSchema,
  SubscriptionRegistry,
  SubscriptionNotFoundError,
  SubscriptionAlreadyRegisteredError,
  ModelCardRegistry,
} from "../index.js";
import type { ModelCard, PickerSubscription } from "../index.js";

function makeCard(model: string): ModelCard {
  return {
    model,
    family: "test",
    capabilities: {
      tool_calling: true,
      streaming: true,
      json_mode: true,
      vision: false,
      max_context: 8000,
    },
    reasoning_levels: [],
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
  };
}

function makeSub(overrides: Partial<PickerSubscription> = {}): PickerSubscription {
  return {
    id: "test-sub",
    provider: "copilot",
    model: "test-model",
    context_window: 128000,
    rate_limit: { requests_per_hour: 1000, remaining: 1000 },
    trusted: true,
    available: true,
    cost_per_1k_input: 0,
    cost_per_1k_output: 0,
    ...overrides,
  };
}

function makeRegistries(models: string[] = ["test-model"]): {
  cardReg: ModelCardRegistry;
  subReg: SubscriptionRegistry;
} {
  const cardReg = new ModelCardRegistry();
  for (const m of models) {
    cardReg.register(makeCard(m));
  }
  const subReg = new SubscriptionRegistry(cardReg);
  return { cardReg, subReg };
}

describe("PickerSubscriptionSchema", () => {
  describe("parse", () => {
    it("accepts a valid subscription", () => {
      expect(() => PickerSubscriptionSchema.parse(makeSub())).not.toThrow();
    });

    it("rejects empty id", () => {
      expect(() => PickerSubscriptionSchema.parse(makeSub({ id: "" }))).toThrow();
    });

    it("rejects empty provider", () => {
      expect(() => PickerSubscriptionSchema.parse(makeSub({ provider: "" }))).toThrow();
    });

    it("rejects empty model", () => {
      expect(() => PickerSubscriptionSchema.parse(makeSub({ model: "" }))).toThrow();
    });

    it("rejects non-positive context_window", () => {
      expect(() => PickerSubscriptionSchema.parse(makeSub({ context_window: 0 }))).toThrow();
    });

    it("rejects negative cost_per_1k_input", () => {
      expect(() => PickerSubscriptionSchema.parse(makeSub({ cost_per_1k_input: -1 }))).toThrow();
    });

    it("rejects missing required fields", () => {
      expect(() => PickerSubscriptionSchema.parse({})).toThrow();
    });
  });
});

describe("SubscriptionRegistry", () => {
  describe("register", () => {
    it("registers a subscription and returns this for chaining", () => {
      const { subReg } = makeRegistries();
      const result = subReg.register(makeSub());
      expect(result).toBe(subReg);
      expect(subReg.size).toBe(1);
    });

    it("throws SubscriptionAlreadyRegisteredError on duplicate id", () => {
      const { subReg } = makeRegistries();
      subReg.register(makeSub({ id: "dup" }));
      expect(() => subReg.register(makeSub({ id: "dup" }))).toThrow(
        SubscriptionAlreadyRegisteredError,
      );
    });

    it("error message includes the subscription id", () => {
      const { subReg } = makeRegistries();
      subReg.register(makeSub({ id: "my-sub" }));
      expect(() => subReg.register(makeSub({ id: "my-sub" }))).toThrow(/my-sub/);
    });

    it("throws when referenced model is not in ModelCardRegistry", () => {
      const { subReg } = makeRegistries(["test-model"]);
      expect(() => subReg.register(makeSub({ id: "bad", model: "nonexistent-model" }))).toThrow(
        /nonexistent-model/,
      );
    });
  });

  describe("get", () => {
    it("returns the registered subscription", () => {
      const { subReg } = makeRegistries();
      const sub = makeSub({ id: "find-me" });
      subReg.register(sub);
      expect(subReg.get("find-me")).toEqual(sub);
    });

    it("throws SubscriptionNotFoundError for unknown id", () => {
      const { subReg } = makeRegistries();
      expect(() => subReg.get("nope")).toThrow(SubscriptionNotFoundError);
    });
  });

  describe("list", () => {
    it("returns empty array when no subscriptions registered", () => {
      const { subReg } = makeRegistries();
      expect(subReg.list()).toEqual([]);
    });

    it("returns all registered subscriptions", () => {
      const { subReg } = makeRegistries(["m1", "m2"]);
      subReg.register(makeSub({ id: "s1", model: "m1" }));
      subReg.register(makeSub({ id: "s2", model: "m2" }));
      expect(subReg.list()).toHaveLength(2);
    });
  });

  describe("has", () => {
    it("returns false for unregistered id", () => {
      const { subReg } = makeRegistries();
      expect(subReg.has("nope")).toBe(false);
    });

    it("returns true after registration", () => {
      const { subReg } = makeRegistries();
      subReg.register(makeSub({ id: "yes" }));
      expect(subReg.has("yes")).toBe(true);
    });
  });

  describe("size", () => {
    it("is 0 initially", () => {
      const { subReg } = makeRegistries();
      expect(subReg.size).toBe(0);
    });

    it("increments with each registration", () => {
      const { subReg } = makeRegistries(["m1", "m2"]);
      subReg.register(makeSub({ id: "s1", model: "m1" }));
      expect(subReg.size).toBe(1);
      subReg.register(makeSub({ id: "s2", model: "m2" }));
      expect(subReg.size).toBe(2);
    });
  });

  describe("remove", () => {
    it("removes a registered subscription", () => {
      const { subReg } = makeRegistries();
      subReg.register(makeSub({ id: "rem" }));
      subReg.remove("rem");
      expect(subReg.has("rem")).toBe(false);
    });

    it("throws SubscriptionNotFoundError for unknown id", () => {
      const { subReg } = makeRegistries();
      expect(() => subReg.remove("ghost")).toThrow(SubscriptionNotFoundError);
    });

    it("returns this for chaining", () => {
      const { subReg } = makeRegistries();
      subReg.register(makeSub({ id: "ch" }));
      expect(subReg.remove("ch")).toBe(subReg);
    });
  });

  describe("update", () => {
    it("updates an existing subscription", () => {
      const { subReg } = makeRegistries();
      subReg.register(makeSub({ id: "upd", available: true }));
      subReg.update(makeSub({ id: "upd", available: false }));
      expect(subReg.get("upd").available).toBe(false);
    });

    it("throws SubscriptionNotFoundError for unknown id", () => {
      const { subReg } = makeRegistries();
      expect(() => subReg.update(makeSub({ id: "phantom" }))).toThrow(SubscriptionNotFoundError);
    });
  });

  describe("findByModel", () => {
    it("returns all subscriptions for a given model", () => {
      const { subReg } = makeRegistries(["m1", "m2"]);
      subReg.register(makeSub({ id: "s1", model: "m1" }));
      subReg.register(makeSub({ id: "s2", model: "m1" }));
      subReg.register(makeSub({ id: "s3", model: "m2" }));
      const result = subReg.findByModel("m1");
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.model === "m1")).toBe(true);
    });

    it("returns empty array when no subscriptions for model", () => {
      const { subReg } = makeRegistries(["m1"]);
      subReg.register(makeSub({ id: "s1", model: "m1" }));
      expect(subReg.findByModel("m2")).toEqual([]);
    });
  });

  describe("findByProvider", () => {
    it("returns only subscriptions from the given provider", () => {
      const { subReg } = makeRegistries(["m1", "m2"]);
      subReg.register(makeSub({ id: "cop1", model: "m1", provider: "copilot" }));
      subReg.register(makeSub({ id: "goo1", model: "m2", provider: "google" }));
      const result = subReg.findByProvider("copilot");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("cop1");
    });
  });

  describe("findTrusted", () => {
    it("returns only trusted=true subscriptions", () => {
      const { subReg } = makeRegistries(["m1", "m2", "m3"]);
      subReg.register(makeSub({ id: "t1", model: "m1", trusted: true }));
      subReg.register(makeSub({ id: "t2", model: "m2", trusted: false }));
      subReg.register(makeSub({ id: "t3", model: "m3", trusted: true }));
      const result = subReg.findTrusted();
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.trusted)).toBe(true);
    });

    it("returns empty array when no trusted subscriptions", () => {
      const { subReg } = makeRegistries(["m1"]);
      subReg.register(makeSub({ id: "s1", model: "m1", trusted: false }));
      expect(subReg.findTrusted()).toEqual([]);
    });
  });

  describe("findAvailable", () => {
    it("returns only available=true subscriptions", () => {
      const { subReg } = makeRegistries(["m1", "m2"]);
      subReg.register(makeSub({ id: "a1", model: "m1", available: true }));
      subReg.register(makeSub({ id: "a2", model: "m2", available: false }));
      const result = subReg.findAvailable();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("a1");
    });
  });

  describe("confidential code access filtering", () => {
    it("filters out untrusted subscriptions for confidential code", () => {
      const { subReg } = makeRegistries(["m1", "m2", "m3"]);
      subReg.register(makeSub({ id: "enterprise", model: "m1", trusted: true }));
      subReg.register(makeSub({ id: "public-api", model: "m2", trusted: false }));
      subReg.register(makeSub({ id: "internal", model: "m3", trusted: true }));

      const eligible = subReg.findTrusted();

      expect(eligible).toHaveLength(2);
      expect(eligible.every((s) => s.trusted)).toBe(true);
      expect(eligible.find((s) => s.id === "public-api")).toBeUndefined();
    });

    it("returns all subscriptions when confidential code access is not restricted", () => {
      const { subReg } = makeRegistries(["m1", "m2"]);
      subReg.register(makeSub({ id: "ent", model: "m1", trusted: true }));
      subReg.register(makeSub({ id: "pub", model: "m2", trusted: false }));

      const eligible = subReg.list();

      expect(eligible).toHaveLength(2);
    });
  });
});
