import { randomUUID } from "node:crypto";
import type {
  DecisionRequest,
  DecisionResponse,
  ModelResolver,
  ModelRouter,
  RouterClassification,
} from "./types.js";

// ---------------------------------------------------------------------------
// Tier 1 — Heuristic Router (keyword/rule-based, <5ms)
// ---------------------------------------------------------------------------

export class Tier1HeuristicRouter implements ModelRouter {
  readonly name = "heuristic";
  readonly maxLatencyMs = 5;

  async classify(request: DecisionRequest): Promise<RouterClassification> {
    const taskType = request.task.type.toLowerCase();

    if (taskType === "simple" || taskType === "ping" || taskType === "echo") {
      return Promise.resolve({
        tier: 1,
        confidence: 0.95,
        classification: "simple",
      });
    }

    if (taskType.includes("complex") || taskType.includes("architect")) {
      return Promise.resolve({
        tier: 1,
        confidence: 0.8,
        classification: "complex",
      });
    }

    return Promise.resolve({
      tier: 1,
      confidence: 0.4,
      classification: "moderate",
    });
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — BERT Router (embedding-based, <50ms)
// DC-LLP-016: Full ONNX/BERT implementation coming in a later phase
// ---------------------------------------------------------------------------

export class Tier2BertRouter implements ModelRouter {
  readonly name = "bert";
  readonly maxLatencyMs = 50;

  async classify(request: DecisionRequest): Promise<RouterClassification> {
    void request;
    return Promise.resolve({
      tier: 2,
      confidence: 0.7,
      classification: "moderate",
      reasoning: "BERT router: placeholder — full ONNX implementation in DC-LLP-016",
    });
  }
}

// ---------------------------------------------------------------------------
// Tier 3 — TinyLLM Router (LLM-based, <200ms)
// DC-LLP-017/018: Full TinyLLM implementation coming in a later phase
// ---------------------------------------------------------------------------

export class Tier3TinyLLMRouter implements ModelRouter {
  readonly name = "tiny-llm";
  readonly maxLatencyMs = 200;

  async classify(request: DecisionRequest): Promise<RouterClassification> {
    void request;
    return Promise.resolve({
      tier: 3,
      confidence: 0.85,
      classification: "complex",
      reasoning: "TinyLLM router: placeholder — full implementation in DC-LLP-017/018",
    });
  }
}

// ---------------------------------------------------------------------------
// CascadeModelResolver
// ---------------------------------------------------------------------------

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export interface CascadeModelResolverOptions {
  readonly confidenceThreshold?: number;
  readonly defaultProvider?: string;
  readonly defaultModel?: string;
  readonly defaultPolicy?: string;
}

export class CascadeModelResolver implements ModelResolver {
  readonly routers: readonly ModelRouter[];

  private readonly confidenceThreshold: number;
  private readonly defaultProvider: string;
  private readonly defaultModel: string;
  private readonly defaultPolicy: string;

  constructor(
    routers?: readonly ModelRouter[],
    options: CascadeModelResolverOptions = {},
  ) {
    this.routers = routers ?? [
      new Tier1HeuristicRouter(),
      new Tier2BertRouter(),
      new Tier3TinyLLMRouter(),
    ];
    this.confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    this.defaultProvider = options.defaultProvider ?? "anthropic";
    this.defaultModel = options.defaultModel ?? "claude-3-5-sonnet";
    this.defaultPolicy = options.defaultPolicy ?? "default";
  }

  async resolve(request: DecisionRequest): Promise<DecisionResponse> {
    const startMs = Date.now();

    let finalClassification: RouterClassification | null = null;
    let tierUsed: 1 | 2 | 3 = 1;
    const tierHistory: { tier: 1 | 2 | 3; confidence: number; reached: boolean }[] = [];

    for (const router of this.routers) {
      const routerTier = router.name === "heuristic" ? 1 : router.name === "bert" ? 2 : 3;
      const classification = await router.classify(request);

      tierHistory.push({
        tier: routerTier,
        confidence: classification.confidence,
        reached: true,
      });

      if (classification.confidence >= this.confidenceThreshold) {
        finalClassification = classification;
        tierUsed = routerTier;
        break;
      }

      finalClassification = classification;
      tierUsed = routerTier;
    }

    for (const router of this.routers) {
      const routerTier = router.name === "heuristic" ? 1 : router.name === "bert" ? 2 : 3;
      const alreadyReached = tierHistory.some((h) => h.tier === routerTier);
      if (!alreadyReached) {
        tierHistory.push({ tier: routerTier, confidence: 0, reached: false });
      }
    }

    const selectionLatencyMs = Date.now() - startMs;
    const classification = finalClassification ?? {
      tier: 1 as const,
      confidence: 0,
      classification: "moderate" as const,
    };

    const response: DecisionResponse = {
      requestId: request.requestId,
      decisionId: randomUUID(),
      timestamp: new Date().toISOString(),
      status: "resolved",
      selected: {
        provider: this.defaultProvider,
        model: this.defaultModel,
        score: Math.round(classification.confidence * 100),
      },
      candidates: [
        {
          provider: this.defaultProvider,
          model: this.defaultModel,
          score: Math.round(classification.confidence * 100),
          status: "selected",
        },
      ],
      decisionMeta: {
        policyUsed: request.policyOverride ?? this.defaultPolicy,
        selectionLatencyMs,
        isFallback: false,
        fallbackReason: null,
      },
      classificationTrace: {
        tierUsed,
        confidence: classification.confidence,
        classification: classification.classification,
        latencyMs: selectionLatencyMs,
        tierHistory,
      },
    };

    return response;
  }
}
