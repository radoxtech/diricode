import { describe, expect, it } from "vitest";
import {
  AgentInfoSchema,
  CascadeTierSchema,
  ClassificationTraceSchema,
  DecisionConstraintsSchema,
  DecisionRequestSchema,
  DecisionResponseSchema,
  FallbackTypeSchema,
  ModelCandidateSchema,
  ModelDimensionsSchema,
  ModelAttributeSchema,
  ModelTierSchema,
  RouterClassificationSchema,
  SelectedModelSchema,
  TaskInfoSchema,
  TierHistoryEntrySchema,
} from "../types.js";
import {
  CascadeModelResolver,
  type ResolverCandidate,
  Tier1HeuristicRouter,
  Tier2BertRouter,
  Tier3TinyLLMRouter,
} from "../model-resolver.js";
import {
  DEFAULT_HARD_RULES_CONFIG,
  comparePricingTiers,
  resolveHardRuleRange,
} from "../hard-rules.js";
import type {
  CascadeTier,
  DecisionRequest,
  FallbackType,
  ModelAttribute,
  ModelTier,
} from "../types.js";
const validRequest = (): DecisionRequest => ({
  requestId: "550e8400-e29b-41d4-a716-446655440000",
  agent: { id: "coder-agent", role: "coding" },
  task: { type: "implement-feature", description: "Add dark mode" },
  modelDimensions: {
    tier: "heavy",
    modelAttributes: ["reasoning", "agentic"],
    fallbackType: null,
  },
});

const hardRuleCandidates: ResolverCandidate[] = [
  {
    provider: "test-provider",
    model: "budget-model",
    pricingTier: "budget",
    contextWindow: 32000,
    trusted: true,
    estimatedCostUsd: 0.03,
    capabilities: ["tool-calling", "streaming", "json-mode"],
    knownForRoles: ["coder", "researcher"],
    knownForComplexities: ["simple", "moderate"],
  },
  {
    provider: "test-provider",
    model: "standard-model",
    pricingTier: "standard",
    contextWindow: 128000,
    trusted: true,
    estimatedCostUsd: 0.3,
    capabilities: ["tool-calling", "streaming", "json-mode"],
    knownForRoles: ["architect", "reviewer"],
    knownForComplexities: ["complex", "moderate"],
  },
  {
    provider: "test-provider",
    model: "premium-model",
    pricingTier: "premium",
    contextWindow: 256000,
    trusted: true,
    estimatedCostUsd: 3,
    capabilities: ["tool-calling", "streaming", "json-mode", "vision"],
    knownForRoles: ["architect", "reviewer"],
    knownForComplexities: ["expert", "complex"],
  },
];

describe("ModelTierSchema", () => {
  it("accepts all valid tiers", () => {
    const tiers: ModelTier[] = ["heavy", "medium", "low"];
    for (const t of tiers) {
      expect(ModelTierSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid tier", () => {
    expect(() => ModelTierSchema.parse("light")).toThrow();
    expect(() => ModelTierSchema.parse("")).toThrow();
    expect(() => ModelTierSchema.parse(42)).toThrow();
  });

  it("covers exhaustive union", () => {
    const allTiers = ModelTierSchema.options;
    expect(allTiers).toHaveLength(3);
    expect(allTiers).toContain("heavy");
    expect(allTiers).toContain("medium");
    expect(allTiers).toContain("low");
  });
});

describe("ModelAttributeSchema", () => {
  it("accepts all valid model attributes", () => {
    const modelAttributes: ModelAttribute[] = [
      "reasoning",
      "speed",
      "agentic",
      "creative",
      "ui-ux",
      "bulk",
      "quality",
    ];
    for (const attribute of modelAttributes) {
      expect(ModelAttributeSchema.parse(attribute)).toBe(attribute);
    }
  });

  it("rejects invalid model attribute", () => {
    expect(() => ModelAttributeSchema.parse("coding")).toThrow();
    expect(() => ModelAttributeSchema.parse("")).toThrow();
  });

  it("covers exhaustive union", () => {
    expect(ModelAttributeSchema.options).toHaveLength(7);
  });
});

describe("FallbackTypeSchema", () => {
  it("accepts all valid fallback types", () => {
    const types: FallbackType[] = ["largeContext", "largeOutput", "error", "strong"];
    for (const t of types) {
      expect(FallbackTypeSchema.parse(t)).toBe(t);
    }
  });

  it("rejects invalid fallback type", () => {
    expect(() => FallbackTypeSchema.parse("size")).toThrow();
    expect(() => FallbackTypeSchema.parse("")).toThrow();
  });

  it("covers exhaustive union of 4 types", () => {
    expect(FallbackTypeSchema.options).toHaveLength(4);
  });
});

describe("ModelDimensionsSchema", () => {
  it("parses valid dimensions", () => {
    const result = ModelDimensionsSchema.parse({
      tier: "medium",
      modelAttributes: ["reasoning"],
      fallbackType: null,
    });
    expect(result.tier).toBe("medium");
    expect(result.modelAttributes).toEqual(["reasoning"]);
    expect(result.fallbackType).toBeNull();
  });

  it("parses dimensions with fallback type", () => {
    const result = ModelDimensionsSchema.parse({
      tier: "heavy",
      modelAttributes: ["reasoning", "quality"],
      fallbackType: "largeContext",
    });
    expect(result.fallbackType).toBe("largeContext");
  });

  it("rejects missing required fields", () => {
    expect(() => ModelDimensionsSchema.parse({ tier: "heavy" })).toThrow();
    expect(() =>
      ModelDimensionsSchema.parse({ tier: "heavy", modelAttributes: ["reasoning"] }),
    ).toThrow();
  });

  it("rejects invalid tier in dimensions", () => {
    expect(() =>
      ModelDimensionsSchema.parse({
        tier: "ultra",
        modelAttributes: ["reasoning"],
        fallbackType: null,
      }),
    ).toThrow();
  });
});

describe("CascadeTierSchema", () => {
  it("accepts tiers 1, 2, 3", () => {
    const tiers: CascadeTier[] = [1, 2, 3];
    for (const t of tiers) {
      expect(CascadeTierSchema.parse(t)).toBe(t);
    }
  });

  it("rejects tier 0 and tier 4", () => {
    expect(() => CascadeTierSchema.parse(0)).toThrow();
    expect(() => CascadeTierSchema.parse(4)).toThrow();
    expect(() => CascadeTierSchema.parse("1")).toThrow();
  });
});

describe("TierHistoryEntrySchema", () => {
  it("parses a valid tier history entry", () => {
    const entry = TierHistoryEntrySchema.parse({
      tier: 1,
      confidence: 0.75,
      reached: true,
    });
    expect(entry.tier).toBe(1);
    expect(entry.confidence).toBe(0.75);
    expect(entry.reached).toBe(true);
  });

  it("rejects confidence outside [0, 1]", () => {
    expect(() =>
      TierHistoryEntrySchema.parse({ tier: 1, confidence: 1.1, reached: true }),
    ).toThrow();
    expect(() =>
      TierHistoryEntrySchema.parse({ tier: 1, confidence: -0.1, reached: false }),
    ).toThrow();
  });
});

describe("ClassificationTraceSchema", () => {
  it("parses a valid trace", () => {
    const trace = ClassificationTraceSchema.parse({
      tierUsed: 2,
      confidence: 0.8,
      classification: "moderate",
      latencyMs: 45,
      tierHistory: [
        { tier: 1, confidence: 0.4, reached: true },
        { tier: 2, confidence: 0.8, reached: true },
        { tier: 3, confidence: 0, reached: false },
      ],
    });
    expect(trace.tierUsed).toBe(2);
    expect(trace.latencyMs).toBe(45);
    expect(trace.tierHistory).toHaveLength(3);
  });

  it("rejects negative latency", () => {
    expect(() =>
      ClassificationTraceSchema.parse({
        tierUsed: 1,
        confidence: 0.9,
        classification: "simple",
        latencyMs: -1,
        tierHistory: [],
      }),
    ).toThrow();
  });
});

describe("AgentInfoSchema", () => {
  it("parses valid agent info", () => {
    const info = AgentInfoSchema.parse({ id: "agent-1", role: "coding" });
    expect(info.id).toBe("agent-1");
    expect(info.role).toBe("coding");
  });

  it("rejects empty id or role", () => {
    expect(() => AgentInfoSchema.parse({ id: "", role: "coding" })).toThrow();
    expect(() => AgentInfoSchema.parse({ id: "agent-1", role: "" })).toThrow();
  });
});

describe("TaskInfoSchema", () => {
  it("parses task with optional description", () => {
    const withDesc = TaskInfoSchema.parse({ type: "refactor", description: "cleanup" });
    expect(withDesc.description).toBe("cleanup");

    const withoutDesc = TaskInfoSchema.parse({ type: "refactor" });
    expect(withoutDesc.description).toBeUndefined();
  });

  it("rejects empty type", () => {
    expect(() => TaskInfoSchema.parse({ type: "" })).toThrow();
  });
});

describe("DecisionConstraintsSchema", () => {
  it("parses fully populated constraints", () => {
    const constraints = DecisionConstraintsSchema.parse({
      maxCostUsd: 0.05,
      maxLatencyMs: 3000,
      minContextWindow: 128000,
      requiredCapabilities: ["function-calling"],
      excludedProviders: ["cohere"],
      excludedModels: ["gpt-3.5-turbo"],
      preferredProviders: ["anthropic"],
      preferredModels: ["claude-3-5-sonnet"],
    });
    expect(constraints.maxCostUsd).toBe(0.05);
    expect(constraints.requiredCapabilities).toEqual(["function-calling"]);
  });

  it("parses empty constraints (all optional)", () => {
    const constraints = DecisionConstraintsSchema.parse({});
    expect(constraints.maxCostUsd).toBeUndefined();
  });

  it("rejects negative cost", () => {
    expect(() => DecisionConstraintsSchema.parse({ maxCostUsd: -1 })).toThrow();
  });
});

describe("DecisionRequestSchema", () => {
  it("parses a minimal valid request", () => {
    const result = DecisionRequestSchema.parse(validRequest());
    expect(result.requestId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.agent.id).toBe("coder-agent");
    expect(result.constraints).toBeUndefined();
    expect(result.policyOverride).toBeUndefined();
  });

  it("parses request with all optional fields", () => {
    const full = DecisionRequestSchema.parse({
      ...validRequest(),
      constraints: { maxCostUsd: 0.1 },
      policyOverride: "cost-optimized",
    });
    expect(full.constraints?.maxCostUsd).toBe(0.1);
    expect(full.policyOverride).toBe("cost-optimized");
  });

  it("parses request with null policyOverride", () => {
    const result = DecisionRequestSchema.parse({ ...validRequest(), policyOverride: null });
    expect(result.policyOverride).toBeNull();
  });

  it("rejects non-UUID requestId", () => {
    expect(() =>
      DecisionRequestSchema.parse({ ...validRequest(), requestId: "not-a-uuid" }),
    ).toThrow();
  });
});

describe("ModelCandidateSchema", () => {
  it("parses a valid candidate", () => {
    const candidate = ModelCandidateSchema.parse({
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      score: 87.5,
      status: "selected",
      scoresBreakdown: {
        quality: 90,
        cost: 80,
        latency: 85,
        capabilityMatch: 95,
      },
    });
    expect(candidate.score).toBe(87.5);
    expect(candidate.scoresBreakdown?.quality).toBe(90);
  });

  it("rejects score out of range", () => {
    expect(() =>
      ModelCandidateSchema.parse({
        provider: "x",
        model: "y",
        score: 101,
        status: "selected",
      }),
    ).toThrow();
    expect(() =>
      ModelCandidateSchema.parse({
        provider: "x",
        model: "y",
        score: -1,
        status: "selected",
      }),
    ).toThrow();
  });

  it("accepts all valid status values", () => {
    for (const status of ["selected", "runner_up", "excluded"] as const) {
      expect(
        ModelCandidateSchema.parse({ provider: "p", model: "m", score: 50, status }),
      ).toBeTruthy();
    }
  });
});

describe("SelectedModelSchema", () => {
  it("parses minimal selected model", () => {
    const model = SelectedModelSchema.parse({
      provider: "openai",
      model: "gpt-4o",
      score: 92,
    });
    expect(model.provider).toBe("openai");
    expect(model.modelVersion).toBeUndefined();
  });

  it("parses fully populated selected model", () => {
    const model = SelectedModelSchema.parse({
      provider: "openai",
      model: "gpt-4o",
      modelVersion: "2024-11-20",
      score: 92,
      estimatedCostUsd: 0.02,
      estimatedLatencyMs: 1200,
      contextWindow: 128000,
      capabilities: ["function-calling", "vision"],
    });
    expect(model.contextWindow).toBe(128000);
    expect(model.capabilities).toHaveLength(2);
  });
});

describe("DecisionResponseSchema", () => {
  it("parses a resolved response", () => {
    const response = DecisionResponseSchema.parse({
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      decisionId: "660e8400-e29b-41d4-a716-446655440001",
      timestamp: "2026-03-29T12:00:00.000Z",
      status: "resolved",
      selected: {
        provider: "anthropic",
        model: "claude-3-5-sonnet",
        score: 85,
      },
    });
    expect(response.status).toBe("resolved");
    expect(response.selected?.model).toBe("claude-3-5-sonnet");
  });

  it("parses no_match and error statuses", () => {
    for (const status of ["no_match", "error"] as const) {
      const result = DecisionResponseSchema.parse({
        requestId: "550e8400-e29b-41d4-a716-446655440000",
        decisionId: "660e8400-e29b-41d4-a716-446655440001",
        timestamp: "2026-03-29T12:00:00.000Z",
        status,
      });
      expect(result.status).toBe(status);
    }
  });

  it("rejects invalid timestamp format", () => {
    expect(() =>
      DecisionResponseSchema.parse({
        requestId: "550e8400-e29b-41d4-a716-446655440000",
        decisionId: "660e8400-e29b-41d4-a716-446655440001",
        timestamp: "not-a-date",
        status: "resolved",
      }),
    ).toThrow();
  });
});

describe("RouterClassificationSchema", () => {
  it("parses valid classification", () => {
    const result = RouterClassificationSchema.parse({
      tier: 1,
      confidence: 0.95,
      classification: "simple",
    });
    expect(result.tier).toBe(1);
    expect(result.reasoning).toBeUndefined();
  });

  it("parses classification with reasoning", () => {
    const result = RouterClassificationSchema.parse({
      tier: 3,
      confidence: 0.88,
      classification: "expert",
      reasoning: "multi-step architecture task",
    });
    expect(result.reasoning).toBe("multi-step architecture task");
  });

  it("rejects all invalid classification values", () => {
    expect(() =>
      RouterClassificationSchema.parse({ tier: 1, confidence: 0.9, classification: "trivial" }),
    ).toThrow();
  });
});

describe("Tier1HeuristicRouter", () => {
  const router = new Tier1HeuristicRouter();

  it("has correct name and maxLatencyMs", () => {
    expect(router.name).toBe("heuristic");
    expect(router.maxLatencyMs).toBe(5);
  });

  it("classifies simple tasks with high confidence", async () => {
    const req = { ...validRequest(), task: { type: "simple" } };
    const result = await router.classify(req);
    expect(result.classification).toBe("simple");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.tier).toBe(1);
  });

  it("classifies complex tasks accordingly", async () => {
    const req = { ...validRequest(), task: { type: "complex-refactor" } };
    const result = await router.classify(req);
    expect(result.classification).toBe("complex");
  });

  it("falls back to moderate for unknown tasks", async () => {
    const req = { ...validRequest(), task: { type: "do-something-random" } };
    const result = await router.classify(req);
    expect(result.classification).toBe("moderate");
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("returns confidence in [0, 1]", async () => {
    const result = await router.classify(validRequest());
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("Tier2BertRouter", () => {
  const router = new Tier2BertRouter();

  it("has correct name and maxLatencyMs", () => {
    expect(router.name).toBe("bert");
    expect(router.maxLatencyMs).toBe(50);
  });

  it("returns a valid classification from placeholder", async () => {
    const result = await router.classify(validRequest());
    expect(result.tier).toBe(2);
    expect(result.confidence).toBeGreaterThan(0);
    expect(["simple", "moderate", "complex", "expert"]).toContain(result.classification);
  });
});

describe("Tier3TinyLLMRouter", () => {
  const router = new Tier3TinyLLMRouter();

  it("has correct name and maxLatencyMs", () => {
    expect(router.name).toBe("tiny-llm");
    expect(router.maxLatencyMs).toBe(200);
  });

  it("returns a valid classification from placeholder", async () => {
    const result = await router.classify(validRequest());
    expect(result.tier).toBe(3);
    expect(result.confidence).toBeGreaterThan(0);
    expect(["simple", "moderate", "complex", "expert"]).toContain(result.classification);
  });
});

describe("CascadeModelResolver", () => {
  describe("hard-rule helpers", () => {
    it("orders pricing tiers from budget to premium", () => {
      expect(comparePricingTiers("budget", "standard")).toBeLessThan(0);
      expect(comparePricingTiers("premium", "standard")).toBeGreaterThan(0);
      expect(comparePricingTiers("standard", "standard")).toBe(0);
    });

    it("merges matching rules to the most restrictive range", () => {
      const result = resolveHardRuleRange({
        agentRole: "architect",
        taskComplexity: "complex",
      });

      expect(result.matchedRules).toHaveLength(2);
      expect(result.minPricingTier).toBe("standard");
      expect(result.maxPricingTier).toBeUndefined();
      expect(result.conflict).toBe(false);
    });

    it("detects conflicts when merged min exceeds merged max", () => {
      const result = resolveHardRuleRange(
        {
          agentRole: "architect",
          taskComplexity: "simple",
        },
        DEFAULT_HARD_RULES_CONFIG,
      );

      expect(result.conflict).toBe(true);
      expect(result.minPricingTier).toBe("standard");
      expect(result.maxPricingTier).toBe("budget");
      expect(result.rejectionReason).toContain("conflict");
    });
  });

  describe("resolve() — response shape", () => {
    it("returns a valid DecisionResponse for a standard request", async () => {
      const resolver = new CascadeModelResolver();
      const response = await resolver.resolve(validRequest());

      const parsed = DecisionResponseSchema.safeParse(response);
      expect(parsed.success).toBe(true);
    });

    it("echoes the requestId from the input", async () => {
      const resolver = new CascadeModelResolver();
      const response = await resolver.resolve(validRequest());
      expect(response.requestId).toBe(validRequest().requestId);
    });

    it("generates a unique decisionId (UUID)", async () => {
      const resolver = new CascadeModelResolver();
      const r1 = await resolver.resolve(validRequest());
      const r2 = await resolver.resolve(validRequest());
      expect(r1.decisionId).not.toBe(r2.decisionId);
      expect(r1.decisionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("sets status to resolved", async () => {
      const resolver = new CascadeModelResolver();
      const response = await resolver.resolve(validRequest());
      expect(response.status).toBe("resolved");
    });

    it("includes selected model", async () => {
      const resolver = new CascadeModelResolver();
      const response = await resolver.resolve(validRequest());
      expect(response.selected).toBeDefined();
      expect(response.selected?.provider).toBeDefined();
      expect(response.selected?.model).toBeDefined();
    });

    it("includes classificationTrace", async () => {
      const resolver = new CascadeModelResolver();
      const response = await resolver.resolve(validRequest());
      expect(response.classificationTrace).toBeDefined();
      expect(response.classificationTrace?.tierHistory.length).toBeGreaterThan(0);
    });

    it("uses policyOverride when provided", async () => {
      const resolver = new CascadeModelResolver();
      const req: DecisionRequest = { ...validRequest(), policyOverride: "cost-optimized" };
      const response = await resolver.resolve(req);
      expect(response.decisionMeta?.policyUsed).toBe("cost-optimized");
    });

    it("uses default policy when policyOverride is null", async () => {
      const resolver = new CascadeModelResolver(undefined, { defaultPolicy: "my-policy" });
      const req: DecisionRequest = { ...validRequest(), policyOverride: null };
      const response = await resolver.resolve(req);
      expect(response.decisionMeta?.policyUsed).toBe("my-policy");
    });

    it("timestamp is a valid ISO datetime string", async () => {
      const resolver = new CascadeModelResolver();
      const response = await resolver.resolve(validRequest());
      expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    });
  });

  describe("routers property", () => {
    it("exposes 3 default routers", () => {
      const resolver = new CascadeModelResolver();
      expect(resolver.routers).toHaveLength(3);
    });

    it("exposes custom routers when provided", () => {
      const singleRouter = new Tier1HeuristicRouter();
      const resolver = new CascadeModelResolver([singleRouter]);
      expect(resolver.routers).toHaveLength(1);
      expect(resolver.routers[0]).toBe(singleRouter);
    });

    it("routers array is readonly (frozen-like — cannot reassign)", () => {
      const resolver = new CascadeModelResolver();
      const routersRef = resolver.routers;
      expect(routersRef).toBe(resolver.routers);
    });
  });

  describe("cascade short-circuits on high confidence", () => {
    it("stops at tier 1 for simple tasks (high confidence)", async () => {
      const resolver = new CascadeModelResolver(undefined, { confidenceThreshold: 0.6 });
      const req: DecisionRequest = { ...validRequest(), task: { type: "simple" } };
      const response = await resolver.resolve(req);
      expect(response.classificationTrace?.tierUsed).toBe(1);
    });
  });

  describe("context window tier scoring", () => {
    // Use architect agent + complex task to allow premium tier (min: standard, max: premium)
    // This isolates context window scoring from pricing tier filtering.
    const baseRequest = (tier: ModelTier): DecisionRequest => ({
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      agent: { id: "test-agent", role: "architect" },
      task: { type: "complex-architecture" },
      modelDimensions: {
        tier,
        modelAttributes: ["reasoning", "agentic"],
        fallbackType: null,
      },
    });

    it("penalizes models below LOW tier minimum (200k)", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        defaultProvider: "ok",
        defaultModel: "ok-model",
        candidatePool: [
          {
            provider: "tiny",
            model: "tiny-model",
            pricingTier: "standard",
            contextWindow: 32_000,
            trusted: false,
            estimatedCostUsd: 0.01,
            knownForRoles: [],
            knownForComplexities: [],
          },
          {
            provider: "ok",
            model: "ok-model",
            pricingTier: "standard",
            contextWindow: 200_000,
            trusted: false,
            estimatedCostUsd: 0.01,
            knownForRoles: [],
            knownForComplexities: [],
          },
        ],
      });
      const response = await resolver.resolve(baseRequest("low"));
      const tinyCandidate = response.candidates?.find((c) => c.model === "tiny-model");
      const okCandidate = response.candidates?.find((c) => c.model === "ok-model");
      expect(tinyCandidate?.score ?? 0).toBeLessThan(okCandidate?.score ?? 0);
    });

    it("HEAVY tier selects model with 800k+ over model with 200k", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        defaultProvider: "huge",
        defaultModel: "huge-model",
        candidatePool: [
          {
            provider: "mid",
            model: "mid-model",
            pricingTier: "premium",
            contextWindow: 200_000,
            trusted: true,
            estimatedCostUsd: 0.3,
            knownForRoles: [],
            knownForComplexities: [],
          },
          {
            provider: "huge",
            model: "huge-model",
            pricingTier: "premium",
            contextWindow: 1_000_000,
            trusted: true,
            estimatedCostUsd: 5,
            knownForRoles: [],
            knownForComplexities: [],
          },
        ],
      });
      const response = await resolver.resolve(baseRequest("heavy"));
      // huge-model (1M) meets HEAVY min, mid-model (200k) is penalized -50
      expect(response.selected?.model).toBe("huge-model");
      const hugeCandidate = response.candidates?.find((c) => c.model === "huge-model");
      const midCandidate = response.candidates?.find((c) => c.model === "mid-model");
      expect(hugeCandidate?.score).toBeGreaterThan(midCandidate?.score ?? 0);
    });

    it("LOW tier accepts model with 200k+ context", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        defaultProvider: "mid",
        defaultModel: "mid-model",
        candidatePool: [
          {
            provider: "mid",
            model: "mid-model",
            pricingTier: "standard",
            contextWindow: 200_000,
            trusted: true,
            estimatedCostUsd: 0.3,
            knownForRoles: [],
            knownForComplexities: [],
          },
        ],
      });
      const response = await resolver.resolve(baseRequest("low"));
      expect(response.status).toBe("resolved");
      expect(response.selected?.model).toBe("mid-model");
    });

    it("model without contextWindow field is not penalized", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        defaultProvider: "unknown",
        defaultModel: "no-context-field-model",
        candidatePool: [
          {
            provider: "unknown",
            model: "no-context-field-model",
            pricingTier: "standard",
            trusted: true,
            estimatedCostUsd: 0.5,
          },
        ],
      });
      const response = await resolver.resolve(baseRequest("heavy"));
      expect(response.status).toBe("resolved");
    });
  });

  describe("CascadeModelResolverOptions", () => {
    it("uses custom defaultProvider and defaultModel", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        defaultProvider: "openai",
        defaultModel: "gpt-4o",
        candidatePool: [
          {
            provider: "openai",
            model: "gpt-4o",
            pricingTier: "standard",
          },
        ],
      });
      const response = await resolver.resolve(validRequest());
      expect(response.selected?.provider).toBe("openai");
      expect(response.selected?.model).toBe("gpt-4o");
    });

    it("returns no_match when hard rules conflict", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        hardRulesConfig: DEFAULT_HARD_RULES_CONFIG,
        candidatePool: hardRuleCandidates,
      });

      const response = await resolver.resolve({
        ...validRequest(),
        agent: { id: "architect-agent", role: "architect" },
        task: { type: "simple" },
      });

      expect(response.status).toBe("no_match");
      expect(response.selected).toBeUndefined();
      expect(response.candidates?.every((candidate) => candidate.status === "excluded")).toBe(true);
      expect(response.decisionMeta?.fallbackReason).toContain("conflict");
    });

    it("filters out premium candidates for simple tasks before selection", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        hardRulesConfig: DEFAULT_HARD_RULES_CONFIG,
        candidatePool: hardRuleCandidates,
      });

      const response = await resolver.resolve({
        ...validRequest(),
        agent: { id: "coder-agent", role: "coder" },
        task: { type: "simple" },
      });

      expect(response.status).toBe("resolved");
      expect(response.selected?.model).toBe("budget-model");
      expect(
        response.candidates?.find((candidate) => candidate.model === "standard-model")?.status,
      ).toBe("excluded");
      expect(
        response.candidates?.find((candidate) => candidate.model === "premium-model")
          ?.rejectionReason,
      ).toContain("maximum budget");
    });

    it("requires at least standard tier for complex architect tasks", async () => {
      const resolver = new CascadeModelResolver(undefined, {
        hardRulesConfig: DEFAULT_HARD_RULES_CONFIG,
        candidatePool: hardRuleCandidates,
      });

      const response = await resolver.resolve({
        ...validRequest(),
        agent: { id: "architect-agent", role: "architect" },
        task: { type: "complex-architecture" },
      });

      expect(response.status).toBe("resolved");
      expect(response.selected?.model).not.toBe("budget-model");
      expect(
        response.candidates?.find((candidate) => candidate.model === "budget-model")
          ?.rejectionReason,
      ).toContain("below minimum standard");
    });
  });
});

describe("Type inference from schemas", () => {
  it("ModelTier type is inferred correctly", () => {
    const tier: ModelTier = "heavy";
    expect(ModelTierSchema.parse(tier)).toBe("heavy");
  });

  it("ModelAttribute type is inferred correctly", () => {
    const modelAttribute: ModelAttribute = "reasoning";
    expect(ModelAttributeSchema.parse(modelAttribute)).toBe("reasoning");
  });

  it("FallbackType type is inferred correctly", () => {
    const ft: FallbackType = "largeContext";
    expect(FallbackTypeSchema.parse(ft)).toBe("largeContext");
  });

  it("CascadeTier type is inferred correctly", () => {
    const ct: CascadeTier = 2;
    expect(CascadeTierSchema.parse(ct)).toBe(2);
  });
});
