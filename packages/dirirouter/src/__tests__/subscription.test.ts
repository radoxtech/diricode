import { describe, expect, it } from "vitest";
import {
  ProviderModelAvailabilitySchema,
  SubscriptionRegistry,
  SubscriptionNotFoundError,
  SubscriptionAlreadyRegisteredError,
} from "../index.js";
import type { ProviderModelAvailability } from "../index.js";

function makeAvail(overrides: Partial<ProviderModelAvailability> = {}): ProviderModelAvailability {
  return {
    id: "test-sub",
    provider: "copilot",
    model_id: "test-model",
    family: "claude-sonnet",
    stability: "stable",
    context_window: 128000,
    available: true,
    trusted: true,
    supports_tool_calling: true,
    supports_vision: true,
    supports_structured_output: true,
    supports_streaming: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    ...overrides,
  };
}

function makeRegistry(): SubscriptionRegistry {
  return new SubscriptionRegistry();
}

describe("ProviderModelAvailabilitySchema (ProviderModelAvailabilitySchema)", () => {
  describe("parse", () => {
    it("accepts a valid availability", () => {
      expect(() => ProviderModelAvailabilitySchema.parse(makeAvail())).not.toThrow();
    });

    it("accepts legacy input with model field (model_id alias)", () => {
      expect(() =>
        ProviderModelAvailabilitySchema.parse({
          provider: "copilot",
          model: "test-model",
          family: "claude-sonnet",
          stability: "stable",
          available: true,
          context_window: 128000,
          trusted: true,
          supports_tool_calling: true,
          supports_vision: true,
          supports_structured_output: true,
          supports_streaming: true,
          input_cost_per_1k: 0,
          output_cost_per_1k: 0,
        }),
      ).not.toThrow();
    });

    it("rejects empty id", () => {
      expect(() => ProviderModelAvailabilitySchema.parse(makeAvail({ id: "" }))).toThrow();
    });

    it("rejects empty provider", () => {
      expect(() => ProviderModelAvailabilitySchema.parse(makeAvail({ provider: "" }))).toThrow();
    });

    it("rejects empty model_id", () => {
      expect(() => ProviderModelAvailabilitySchema.parse(makeAvail({ model_id: "" }))).toThrow();
    });

    it("rejects non-positive context_window", () => {
      expect(() =>
        ProviderModelAvailabilitySchema.parse(makeAvail({ context_window: 0 })),
      ).toThrow();
    });

    it("rejects negative input_cost_per_1k", () => {
      expect(() =>
        ProviderModelAvailabilitySchema.parse(makeAvail({ input_cost_per_1k: -1 })),
      ).toThrow();
    });

    it("rejects missing required fields", () => {
      expect(() => ProviderModelAvailabilitySchema.parse({})).toThrow();
    });
  });
});

describe("SubscriptionRegistry", () => {
  describe("register", () => {
    it("registers an availability and returns this for chaining", () => {
      const reg = makeRegistry();
      const result = reg.register(makeAvail());
      expect(result).toBe(reg);
      expect(reg.size).toBe(1);
    });

    it("throws SubscriptionAlreadyRegisteredError on duplicate id", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "dup" }));
      expect(() => reg.register(makeAvail({ id: "dup" }))).toThrow(
        SubscriptionAlreadyRegisteredError,
      );
    });

    it("error message includes the availability id", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "my-sub" }));
      expect(() => reg.register(makeAvail({ id: "my-sub" }))).toThrow(/my-sub/);
    });

    it("auto-generates id from provider-model_id when id is missing", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: undefined, provider: "copilot", model_id: "gpt-4o" }));
      expect(reg.get("copilot-gpt-4o").model_id).toBe("gpt-4o");
    });
  });

  describe("get", () => {
    it("returns the registered availability", () => {
      const reg = makeRegistry();
      const avail = makeAvail({ id: "find-me" });
      reg.register(avail);
      expect(reg.get("find-me")).toEqual(avail);
    });

    it("throws SubscriptionNotFoundError for unknown id", () => {
      const reg = makeRegistry();
      expect(() => reg.get("nope")).toThrow(SubscriptionNotFoundError);
    });
  });

  describe("list", () => {
    it("returns empty array when no availabilities registered", () => {
      const reg = makeRegistry();
      expect(reg.list()).toEqual([]);
    });

    it("returns all registered availabilities", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "s1", model_id: "m1" }));
      reg.register(makeAvail({ id: "s2", model_id: "m2" }));
      expect(reg.list()).toHaveLength(2);
    });
  });

  describe("has", () => {
    it("returns false for unregistered id", () => {
      const reg = makeRegistry();
      expect(reg.has("nope")).toBe(false);
    });

    it("returns true after registration", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "yes" }));
      expect(reg.has("yes")).toBe(true);
    });
  });

  describe("size", () => {
    it("is 0 initially", () => {
      const reg = makeRegistry();
      expect(reg.size).toBe(0);
    });

    it("increments with each registration", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "s1", model_id: "m1" }));
      expect(reg.size).toBe(1);
      reg.register(makeAvail({ id: "s2", model_id: "m2" }));
      expect(reg.size).toBe(2);
    });
  });

  describe("remove", () => {
    it("removes a registered availability", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "rem" }));
      reg.remove("rem");
      expect(reg.has("rem")).toBe(false);
    });

    it("throws SubscriptionNotFoundError for unknown id", () => {
      const reg = makeRegistry();
      expect(() => reg.remove("ghost")).toThrow(SubscriptionNotFoundError);
    });

    it("returns this for chaining", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "ch" }));
      expect(reg.remove("ch")).toBe(reg);
    });
  });

  describe("update", () => {
    it("updates an existing availability", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "upd", available: true }));
      reg.update(makeAvail({ id: "upd", available: false }));
      expect(reg.get("upd").available).toBe(false);
    });

    it("throws SubscriptionNotFoundError for unknown id", () => {
      const reg = makeRegistry();
      expect(() => reg.update(makeAvail({ id: "phantom" }))).toThrow(SubscriptionNotFoundError);
    });
  });

  describe("findByModel", () => {
    it("returns all availabilities for a given model", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "s1", model_id: "m1" }));
      reg.register(makeAvail({ id: "s2", model_id: "m1" }));
      reg.register(makeAvail({ id: "s3", model_id: "m2" }));
      const result = reg.findByModel("m1");
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.model_id === "m1")).toBe(true);
    });

    it("returns empty array when no availabilities for model", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "s1", model_id: "m1" }));
      expect(reg.findByModel("m2")).toEqual([]);
    });
  });

  describe("findByProvider", () => {
    it("returns only availabilities from the given provider", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "cop1", model_id: "m1", provider: "copilot" }));
      reg.register(makeAvail({ id: "goo1", model_id: "m2", provider: "google" }));
      const result = reg.findByProvider("copilot");
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("cop1");
    });
  });

  describe("findTrusted", () => {
    it("returns only trusted=true availabilities", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "t1", model_id: "m1", trusted: true }));
      reg.register(makeAvail({ id: "t2", model_id: "m2", trusted: false }));
      reg.register(makeAvail({ id: "t3", model_id: "m3", trusted: true }));
      const result = reg.findTrusted();
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.trusted)).toBe(true);
    });

    it("returns empty array when no trusted availabilities", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "s1", model_id: "m1", trusted: false }));
      expect(reg.findTrusted()).toEqual([]);
    });
  });

  describe("findAvailable", () => {
    it("returns only available=true availabilities", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "a1", model_id: "m1", available: true }));
      reg.register(makeAvail({ id: "a2", model_id: "m2", available: false }));
      const result = reg.findAvailable();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("a1");
    });
  });

  describe("trusted availability filtering", () => {
    it("filters out untrusted availabilities", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "enterprise", model_id: "m1", trusted: true }));
      reg.register(makeAvail({ id: "public-api", model_id: "m2", trusted: false }));
      reg.register(makeAvail({ id: "internal", model_id: "m3", trusted: true }));

      const eligible = reg.findTrusted();

      expect(eligible).toHaveLength(2);
      expect(eligible.every((s) => s.trusted)).toBe(true);
      expect(eligible.find((s) => s.id === "public-api")).toBeUndefined();
    });

    it("returns all availabilities when no filtering applied", () => {
      const reg = makeRegistry();
      reg.register(makeAvail({ id: "ent", model_id: "m1", trusted: true }));
      reg.register(makeAvail({ id: "pub", model_id: "m2", trusted: false }));

      const eligible = reg.list();

      expect(eligible).toHaveLength(2);
    });
  });
});
