import { describe, expect, it } from "vitest";
import { MinimaxProviderAdapter } from "../providers/minimax.js";

describe("MinimaxProviderAdapter", () => {
  describe("providerId", () => {
    it("returns 'minimax'", () => {
      const adapter = new MinimaxProviderAdapter();
      expect(adapter.providerId).toBe("minimax");
    });
  });

  describe("listModels", () => {
    it("returns array of MiniMax model descriptors", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it("each model has required fields", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      for (const model of models) {
        expect(model).toHaveProperty("apiModel");
        expect(model).toHaveProperty("contextWindow");
        expect(model).toHaveProperty("maxOutput");
        expect(model).toHaveProperty("canReason");
        expect(model).toHaveProperty("toolCall");
        expect(model).toHaveProperty("vision");
        expect(model).toHaveProperty("attachment");
        expect(model).toHaveProperty("quotaMultiplier");
      }
    });

    it("includes MiniMax-M2.7 model", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      const m27 = models.find((m) => m.apiModel === "MiniMax-M2.7");
      expect(m27).toBeDefined();
      expect(m27?.contextWindow).toBe(204_800);
      expect(m27?.maxOutput).toBe(16_384);
      expect(m27?.canReason).toBe(true);
    });

    it("includes highspeed variants with quotaMultiplier 2", () => {
      const adapter = new MinimaxProviderAdapter();
      const models = adapter.listModels();
      const highspeed = models.filter((m) => m.apiModel.includes("highspeed"));
      expect(highspeed.length).toBeGreaterThan(0);
      for (const model of highspeed) {
        expect(model.quotaMultiplier).toBe(2);
      }
    });
  });

  describe("getQuota", () => {
    it("returns null", () => {
      const adapter = new MinimaxProviderAdapter();
      expect(adapter.getQuota()).toBeNull();
    });
  });
});
