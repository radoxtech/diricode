import { describe, expect, it } from "vitest";
import { DefaultModelTierResolver } from "../agents/model-config-resolver.js";
import type { ModelConfig } from "../agents/model-config-resolver.js";
import { DEFAULT_AGENT_MODEL_POLICY } from "../agents/model-selection-policy.js";
import type { AgentDomain, AgentMetadata, AgentTier } from "../agents/types.js";

function makeAgent(allowedTiers: readonly AgentTier[], primary: AgentDomain): AgentMetadata {
  return {
    name: `Test ${allowedTiers.join("-")} ${primary}`,
    description: "test agent",
    allowedTiers,
    capabilities: {
      primary,
      specialization: [],
      modelAttributes: [],
    },
  };
}

describe("DefaultModelTierResolver", () => {
  const resolver = new DefaultModelTierResolver();

  const TIERS: AgentTier[] = ["heavy", "medium", "light"];
  const DOMAINS: AgentDomain[] = ["coding", "planning", "review", "research", "utility", "devops"];

  describe("resolves all tier×domain combos from policy table", () => {
    for (const tier of TIERS) {
      for (const domain of DOMAINS) {
        const key = `${tier}:${domain}` as const;
        const expected = DEFAULT_AGENT_MODEL_POLICY[key];

        it(`${key} → ${expected.provider}/${expected.model}`, () => {
          const result: ModelConfig = resolver.resolve(makeAgent([tier], domain));
          expect(result.provider).toBe(expected.provider);
          expect(result.model).toBe(expected.model);
          expect(result.maxTokens).toBe(expected.maxTokens);
          expect(result.temperature).toBe(expected.temperature);
        });
      }
    }
  });

  describe("policy table sanity checks", () => {
    it("heavy tier uses premium models", () => {
      const heavy = resolver.resolve(makeAgent(["heavy"], "planning"));
      expect(heavy.model).toBe("claude-3-opus");
      expect(heavy.provider).toBe("copilot");
    });

    it("light tier uses gpt-4o-mini across all domains", () => {
      for (const domain of DOMAINS) {
        const result = resolver.resolve(makeAgent(["light"], domain));
        expect(result.model).toBe("gpt-4o-mini");
        expect(result.provider).toBe("copilot");
      }
    });

    it("all configs include provider field", () => {
      for (const tier of TIERS) {
        for (const domain of DOMAINS) {
          const result = resolver.resolve(makeAgent([tier], domain));
          expect(result.provider).toBeTruthy();
          expect(typeof result.provider).toBe("string");
        }
      }
    });

    it("temperature varies by domain purpose", () => {
      const research = resolver.resolve(makeAgent(["heavy"], "research"));
      const coding = resolver.resolve(makeAgent(["heavy"], "coding"));
      expect(research.temperature).toBeGreaterThan(coding.temperature);
    });

    it("uses requested tier when allowed", () => {
      const result = resolver.resolve(makeAgent(["light", "medium", "heavy"], "coding"), "light");
      expect(result.model).toBe("gpt-4o-mini");
    });

    it("falls back to highest allowed tier when requested tier is not allowed", () => {
      const result = resolver.resolve(makeAgent(["medium", "light"], "coding"), "heavy");
      expect(result.model).toBe("gpt-4o");
    });
  });
});
