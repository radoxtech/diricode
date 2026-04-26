import { beforeEach, describe, expect, it, vi } from "vitest";
import { CascadeModelResolver, type ResolverCandidate } from "../model-resolver.js";
import { classifyRoutingTags, type RoutingClassificationResult } from "../classifier-engine.js";
import type { DecisionRequest } from "../types.js";

vi.mock("../classifier-engine.js", () => ({
  classifyRoutingTags: vi.fn(),
}));

const candidatePool: ResolverCandidate[] = [
  {
    provider: "test",
    model: "backend-specialist",
    family: "backend",
    pricingTier: "standard",
    trusted: true,
    modelAttributes: ["coding", "architecture"],
    knownForRoles: ["coding"],
    knownForComplexities: ["moderate", "complex"],
  },
  {
    provider: "test",
    model: "frontend-specialist",
    family: "frontend",
    pricingTier: "standard",
    trusted: true,
    modelAttributes: ["ui-ux", "coding"],
    knownForRoles: ["coding"],
    knownForComplexities: ["moderate", "complex"],
  },
];

const baseRequest = (
  specializations: string[],
  modelAttributes: DecisionRequest["modelDimensions"]["modelAttributes"] = [
    "coding",
    "ui-ux",
    "architecture",
  ],
): DecisionRequest => ({
  chatId: "950e8400-e29b-41d4-a716-446655440000",
  requestId: "850e8400-e29b-41d4-a716-446655440000",
  agent: { id: "stack-agent", role: "coding", seniority: "senior", specializations },
  task: { type: "implement-feature", description: "Build the requested stack feature" },
  modelDimensions: {
    tier: "medium",
    modelAttributes,
    fallbackType: null,
  },
});

describe("CascadeModelResolver stack normalization", () => {
  beforeEach(() => {
    vi.mocked(classifyRoutingTags).mockReset();
  });

  it("prefers backend-capable candidates for nodejs backend specializations", async () => {
    const resolver = new CascadeModelResolver(undefined, { candidatePool });
    const response = await resolver.resolve(
      baseRequest(["nodejs", "backend", "api", "express"], ["coding", "architecture"]),
    );

    expect(response.status).toBe("resolved");
    expect(response.selected?.model).toBe("backend-specialist");

    const backendCandidate = response.candidates?.find((candidate) => candidate.model === "backend-specialist");
    const frontendCandidate = response.candidates?.find((candidate) => candidate.model === "frontend-specialist");

    expect(backendCandidate?.status).toBe("selected");
    expect(frontendCandidate?.status).toBe("runner_up");
    expect(frontendCandidate?.scoresBreakdown?.bridgeConceptsUsed?.some((hit) => hit.attribute === "ui-ux")).toBe(
      false,
    );
  });

  it("still allows frontend stack specializations to prefer ui-ux candidates", async () => {
    const resolver = new CascadeModelResolver(undefined, { candidatePool });
    const response = await resolver.resolve(
      baseRequest(["frontend", "react", "next.js", "tailwind"], ["coding", "ui-ux"]),
    );

    expect(response.status).toBe("resolved");
    expect(response.selected?.model).toBe("frontend-specialist");
  });

  it("keeps normalized stack scoring active when classifier comparison is enabled", async () => {
    const classifierResult: RoutingClassificationResult = {
      inputText: "role: coding",
      deberta: {
        modelId: "deberta-test",
        modelName: "DeBERTa test",
        isTrueZeroShot: true,
        primaryTags: [
          { tag: "ui-ux", score: 0.92, definition: "frontend work" },
          { tag: "coding", score: 0.12, definition: "coding work" },
        ],
        tagScores: [
          { tag: "ui-ux", score: 0.92, definition: "frontend work" },
          { tag: "coding", score: 0.12, definition: "coding work" },
          { tag: "architecture", score: 0.05, definition: "architecture work" },
        ],
      },
      modernBert: {
        modelId: "modernbert-test",
        modelName: "ModernBERT test",
        isTrueZeroShot: true,
        primaryTags: [
          { tag: "ui-ux", score: 0.88, definition: "frontend work" },
          { tag: "coding", score: 0.14, definition: "coding work" },
        ],
        tagScores: [
          { tag: "ui-ux", score: 0.88, definition: "frontend work" },
          { tag: "coding", score: 0.14, definition: "coding work" },
          { tag: "architecture", score: 0.07, definition: "architecture work" },
        ],
      },
      agreementTags: [],
      disagreementTags: [
        { tag: "ui-ux", debertaScore: 0.92, modernBertScore: 0.88 },
        { tag: "coding", debertaScore: 0.12, modernBertScore: 0.14 },
      ],
    };

    vi.mocked(classifyRoutingTags).mockResolvedValue(classifierResult);

    const resolver = new CascadeModelResolver(undefined, {
      candidatePool,
      enableClassifierComparison: true,
    });
    const response = await resolver.resolve(
      baseRequest(["nodejs", "backend", "api", "express"], ["coding", "architecture"]),
    );

    const backendCandidate = response.candidates?.find((candidate) => candidate.model === "backend-specialist");
    const frontendCandidate = response.candidates?.find((candidate) => candidate.model === "frontend-specialist");

    expect(response.status).toBe("resolved");
    expect(response.selected?.model).toBe("backend-specialist");
    expect(backendCandidate?.scoresBreakdown?.semanticSimilarity).toBeGreaterThan(0.9);
    expect(backendCandidate?.scoresBreakdown?.modelAttributesMatched).toBe("coding");
    expect(backendCandidate?.scoresBreakdown?.bridgeConceptsUsed?.some((hit) => hit.phrase.endsWith("backend-platform"))).toBe(
      true,
    );
    expect(backendCandidate?.scoresBreakdown?.debertaTagScores?.[0]?.tag).toBe("coding");
    expect(frontendCandidate?.status).toBe("runner_up");
  });
});
