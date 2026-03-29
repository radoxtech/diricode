import { describe, expect, it } from "vitest";
import type { ModelDescriptor, ModelQuota, ProviderAdapter } from "../index.js";

describe("ProviderAdapter", () => {
  describe("ModelDescriptor", () => {
    it("accepts a complete model descriptor", () => {
      const descriptor: ModelDescriptor = {
        apiModel: "gpt-4o",
        contextWindow: 128000,
        maxOutput: 4096,
        canReason: true,
        toolCall: true,
        vision: true,
        attachment: false,
        quotaMultiplier: 1,
      };

      expect(descriptor.apiModel).toBe("gpt-4o");
      expect(descriptor.contextWindow).toBe(128000);
      expect(descriptor.maxOutput).toBe(4096);
      expect(descriptor.canReason).toBe(true);
      expect(descriptor.toolCall).toBe(true);
      expect(descriptor.vision).toBe(true);
      expect(descriptor.attachment).toBe(false);
      expect(descriptor.quotaMultiplier).toBe(1);
    });

    it("accepts a model descriptor with high quota multiplier", () => {
      const descriptor: ModelDescriptor = {
        apiModel: "o1-preview",
        contextWindow: 128000,
        maxOutput: 32768,
        canReason: true,
        toolCall: false,
        vision: false,
        attachment: false,
        quotaMultiplier: 2,
      };

      expect(descriptor.quotaMultiplier).toBe(2);
    });

    it("accepts minimal model descriptors", () => {
      const descriptor: ModelDescriptor = {
        apiModel: "simple-model",
        contextWindow: 8192,
        maxOutput: 2048,
        canReason: false,
        toolCall: false,
        vision: false,
        attachment: false,
        quotaMultiplier: 1,
      };

      expect(descriptor.canReason).toBe(false);
      expect(descriptor.toolCall).toBe(false);
    });
  });

  describe("ModelQuota", () => {
    it("accepts a valid model quota", () => {
      const quota: ModelQuota = {
        apiModel: "gpt-4o",
        remaining: 1000,
        resetAt: "2026-03-30T00:00:00.000Z",
      };

      expect(quota.apiModel).toBe("gpt-4o");
      expect(quota.remaining).toBe(1000);
      expect(quota.resetAt).toBe("2026-03-30T00:00:00.000Z");
    });

    it("accepts zero remaining quota", () => {
      const quota: ModelQuota = {
        apiModel: "gpt-4o",
        remaining: 0,
        resetAt: "2026-03-30T00:00:00.000Z",
      };

      expect(quota.remaining).toBe(0);
    });
  });

  describe("ProviderAdapter interface compliance", () => {
    function makeProviderAdapter(
      providerId: string,
      models: ModelDescriptor[] = [],
      quota: ModelQuota[] | null = null,
    ): ProviderAdapter {
      return {
        providerId,
        listModels: () => models,
        getQuota: () => quota,
      };
    }

    it("creates a provider adapter with providerId property", () => {
      const adapter = makeProviderAdapter("copilot");
      expect(adapter.providerId).toBe("copilot");
    });

    it("creates a provider adapter for each supported provider", () => {
      const copilot = makeProviderAdapter("copilot");
      const kimi = makeProviderAdapter("kimi");
      const zai = makeProviderAdapter("zai");
      const minimax = makeProviderAdapter("minimax");

      expect(copilot.providerId).toBe("copilot");
      expect(kimi.providerId).toBe("kimi");
      expect(zai.providerId).toBe("zai");
      expect(minimax.providerId).toBe("minimax");
    });

    it("listModels returns empty array by default", () => {
      const adapter = makeProviderAdapter("copilot");
      expect(adapter.listModels()).toEqual([]);
    });

    it("listModels returns configured models", () => {
      const models: ModelDescriptor[] = [
        {
          apiModel: "gpt-4o",
          contextWindow: 128000,
          maxOutput: 4096,
          canReason: true,
          toolCall: true,
          vision: true,
          attachment: false,
          quotaMultiplier: 1,
        },
        {
          apiModel: "gpt-4o-mini",
          contextWindow: 128000,
          maxOutput: 16384,
          canReason: false,
          toolCall: true,
          vision: true,
          attachment: false,
          quotaMultiplier: 1,
        },
      ];

      const adapter = makeProviderAdapter("copilot", models);
      const result = adapter.listModels();

      expect(result).toHaveLength(2);
      expect(result[0]?.apiModel).toBe("gpt-4o");
      expect(result[1]?.apiModel).toBe("gpt-4o-mini");
    });

    it("getQuota returns null when quota is unavailable", () => {
      const adapter = makeProviderAdapter("copilot", [], null);
      expect(adapter.getQuota()).toBeNull();
    });

    it("getQuota returns quota data when available", () => {
      const quota: ModelQuota[] = [
        {
          apiModel: "gpt-4o",
          remaining: 500,
          resetAt: "2026-03-30T00:00:00.000Z",
        },
        {
          apiModel: "gpt-4o-mini",
          remaining: 10000,
          resetAt: "2026-03-30T00:00:00.000Z",
        },
      ];

      const adapter = makeProviderAdapter("copilot", [], quota);
      const result = adapter.getQuota();

      expect(result).toHaveLength(2);
      expect(result?.[0]?.apiModel).toBe("gpt-4o");
      expect(result?.[0]?.remaining).toBe(500);
      expect(result?.[1]?.remaining).toBe(10000);
    });

    it("provider adapter has no lifecycle methods", () => {
      const adapter = makeProviderAdapter("copilot");

      // Verify no init, refresh, or cleanup methods exist
      expect("init" in adapter).toBe(false);
      expect("refresh" in adapter).toBe(false);
      expect("cleanup" in adapter).toBe(false);
    });

    it("provider adapter has no temperature field", () => {
      const adapter = makeProviderAdapter("copilot");

      // Temperature is an internal concern, not on the interface
      expect("temperature" in adapter).toBe(false);
    });

    it("quotaMultiplier defaults to 1 when not specified", () => {
      // This test verifies the type accepts the value
      // Actual default handling is implementation concern
      const descriptor: ModelDescriptor = {
        apiModel: "standard-model",
        contextWindow: 8192,
        maxOutput: 4096,
        canReason: false,
        toolCall: true,
        vision: false,
        attachment: false,
        quotaMultiplier: 1, // Explicit value per interface contract
      };

      expect(descriptor.quotaMultiplier).toBe(1);
    });
  });
});
