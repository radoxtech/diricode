import { describe, expect, it } from "vitest";
import {
  ProviderAlreadyRegisteredError,
  ProviderNotFoundError,
  ProviderPriorities,
  Registry,
} from "../index.js";
import type { GenerateOptions, ModelConfig, Provider, StreamChunk } from "../index.js";

function makeProvider(name: string, modelId = "test-model"): Provider {
  const defaultModel: ModelConfig = { modelId };
  return {
    name,
    defaultModel,
    isAvailable: () => true,
    generate: (_options: GenerateOptions): Promise<string> =>
      Promise.resolve(`${name}:response`),
    stream: (_options: GenerateOptions): AsyncIterable<StreamChunk> => {
      async function* gen() {
        yield { delta: `${name}:chunk`, done: false };
        yield { delta: "", done: true };
      }
      return gen();
    },
  };
}

describe("Registry", () => {
  describe("register", () => {
    it("registers a provider and returns this for chaining", () => {
      const reg = new Registry();
      const copilot = makeProvider("copilot");
      const result = reg.register(copilot, ProviderPriorities.COPILOT);
      expect(result).toBe(reg);
      expect(reg.size).toBe(1);
    });

    it("allows registering multiple distinct providers", () => {
      const reg = new Registry();
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      reg.register(makeProvider("kimi"), ProviderPriorities.KIMI);
      expect(reg.size).toBe(2);
    });

    it("throws ProviderAlreadyRegisteredError on duplicate name", () => {
      const reg = new Registry();
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      expect(() =>
        reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT),
      ).toThrow(ProviderAlreadyRegisteredError);
    });

    it("ProviderAlreadyRegisteredError message includes provider name", () => {
      const reg = new Registry();
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      expect(() =>
        reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT),
      ).toThrow(/copilot/);
    });
  });

  describe("get", () => {
    it("returns the registered provider by name", () => {
      const reg = new Registry();
      const copilot = makeProvider("copilot");
      reg.register(copilot, ProviderPriorities.COPILOT);
      expect(reg.get("copilot")).toBe(copilot);
    });

    it("throws ProviderNotFoundError for unknown name", () => {
      const reg = new Registry();
      expect(() => reg.get("unknown")).toThrow(ProviderNotFoundError);
    });

    it("ProviderNotFoundError message includes the missing name", () => {
      const reg = new Registry();
      expect(() => reg.get("unknown")).toThrow(/unknown/);
    });
  });

  describe("list", () => {
    it("returns empty array when no providers registered", () => {
      const reg = new Registry();
      expect(reg.list()).toEqual([]);
    });

    it("returns entries sorted ascending by priority", () => {
      const reg = new Registry();
      reg.register(makeProvider("kimi"), ProviderPriorities.KIMI);
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      const names = reg.list().map((e) => e.name);
      expect(names).toEqual(["copilot", "kimi"]);
    });

    it("includes priority in each entry", () => {
      const reg = new Registry();
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      reg.register(makeProvider("kimi"), ProviderPriorities.KIMI);
      expect(reg.list()).toEqual([
        { name: "copilot", priority: 1 },
        { name: "kimi", priority: 2 },
      ]);
    });

    it("returns a new sorted snapshot each call", () => {
      const reg = new Registry();
      reg.register(makeProvider("kimi"), ProviderPriorities.KIMI);
      const first = reg.list();
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      const second = reg.list();
      expect(first).toHaveLength(1);
      expect(second).toHaveLength(2);
      expect(second[0]?.name).toBe("copilot");
    });
  });

  describe("getDefault", () => {
    it("throws when registry is empty", () => {
      const reg = new Registry();
      expect(() => reg.getDefault()).toThrow("No providers are registered");
    });

    it("returns the sole provider when only one is registered", () => {
      const reg = new Registry();
      const copilot = makeProvider("copilot");
      reg.register(copilot, ProviderPriorities.COPILOT);
      expect(reg.getDefault()).toBe(copilot);
    });

    it("returns the provider with the lowest priority number", () => {
      const reg = new Registry();
      const kimi = makeProvider("kimi");
      const copilot = makeProvider("copilot");
      reg.register(kimi, ProviderPriorities.KIMI);
      reg.register(copilot, ProviderPriorities.COPILOT);
      expect(reg.getDefault()).toBe(copilot);
    });

    it("returns correct default regardless of registration order", () => {
      const reg = new Registry();
      const copilot = makeProvider("copilot");
      const kimi = makeProvider("kimi");
      reg.register(copilot, ProviderPriorities.COPILOT);
      reg.register(kimi, ProviderPriorities.KIMI);
      expect(reg.getDefault()).toBe(copilot);
    });

    it("handles custom priority numbers", () => {
      const reg = new Registry();
      const high = makeProvider("high");
      const low = makeProvider("low");
      reg.register(low, 99);
      reg.register(high, 5);
      expect(reg.getDefault()).toBe(high);
    });
  });

  describe("has", () => {
    it("returns false for unregistered name", () => {
      const reg = new Registry();
      expect(reg.has("copilot")).toBe(false);
    });

    it("returns true after registration", () => {
      const reg = new Registry();
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      expect(reg.has("copilot")).toBe(true);
    });
  });

  describe("size", () => {
    it("is 0 initially", () => {
      const reg = new Registry();
      expect(reg.size).toBe(0);
    });

    it("increments with each registration", () => {
      const reg = new Registry();
      reg.register(makeProvider("copilot"), ProviderPriorities.COPILOT);
      expect(reg.size).toBe(1);
      reg.register(makeProvider("kimi"), ProviderPriorities.KIMI);
      expect(reg.size).toBe(2);
    });
  });
});
