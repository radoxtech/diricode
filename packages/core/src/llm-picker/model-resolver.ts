import { randomUUID } from "node:crypto";
import type {
  DecisionRequest,
  DecisionResponse,
  ModelCandidate,
  ModelResolver,
  ModelRouter,
  RouterClassification,
} from "./types.js";
import type { ModelCard, ModelCapabilities, PickerSubscription } from "@diricode/picker-contracts";
import {
  DEFAULT_HARD_RULES_CONFIG,
  getPricingTierRejectionReason,
  resolveHardRuleRange,
  type HardRulesConfig,
  type PricingTier,
} from "./hard-rules.js";

export class Tier1HeuristicRouter implements ModelRouter {
  readonly name = "heuristic";
  readonly maxLatencyMs = 5;

  async classify(request: DecisionRequest): Promise<RouterClassification> {
    const taskType = request.task.type.toLowerCase();

    if (taskType === "simple" || taskType === "ping" || taskType === "echo") {
      return Promise.resolve({ tier: 1, confidence: 0.95, classification: "simple" });
    }

    if (taskType.includes("complex") || taskType.includes("architect")) {
      return Promise.resolve({ tier: 1, confidence: 0.8, classification: "complex" });
    }

    return Promise.resolve({ tier: 1, confidence: 0.4, classification: "moderate" });
  }
}

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

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export interface ResolverCandidate {
  readonly provider: string;
  readonly model: string;
  readonly pricingTier: PricingTier;
  readonly contextWindow?: number;
  readonly estimatedCostUsd?: number;
  readonly trusted?: boolean;
  readonly capabilities?: readonly string[];
  readonly knownForRoles?: readonly string[];
  readonly knownForComplexities?: readonly string[];
}

export function resolverCandidateFromContracts(
  modelCard: ModelCard,
  subscription: PickerSubscription,
): ResolverCandidate {
  return {
    provider: subscription.provider,
    model: subscription.model,
    pricingTier: modelCard.pricing_tier,
    contextWindow: subscription.context_window,
    estimatedCostUsd: subscription.cost_per_1k_input + subscription.cost_per_1k_output,
    trusted: subscription.trusted,
    capabilities: capabilitiesToList(modelCard.capabilities),
    knownForRoles: modelCard.known_for.roles,
    knownForComplexities: modelCard.known_for.complexities,
  };
}

function capabilitiesToList(capabilities: ModelCapabilities): string[] {
  const supported: string[] = [];

  if (capabilities.tool_calling) {
    supported.push("tool-calling");
  }
  if (capabilities.streaming) {
    supported.push("streaming");
  }
  if (capabilities.json_mode) {
    supported.push("json-mode");
  }
  if (capabilities.vision) {
    supported.push("vision");
  }

  return supported;
}

const DEFAULT_CANDIDATE_POOL: readonly ResolverCandidate[] = [
  {
    provider: "openai",
    model: "gpt-5-mini",
    pricingTier: "budget",
    contextWindow: 128000,
    estimatedCostUsd: 0.08,
    trusted: true,
    capabilities: ["tool-calling", "streaming", "json-mode"],
    knownForRoles: ["coder", "researcher"],
    knownForComplexities: ["simple", "moderate"],
  },
  {
    provider: "openai",
    model: "gpt-5.4-mini",
    pricingTier: "budget",
    contextWindow: 128000,
    estimatedCostUsd: 0.12,
    trusted: true,
    capabilities: ["tool-calling", "streaming", "json-mode"],
    knownForRoles: ["coder", "researcher"],
    knownForComplexities: ["simple", "moderate"],
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4.5",
    pricingTier: "budget",
    contextWindow: 200000,
    estimatedCostUsd: 0.15,
    trusted: true,
    capabilities: ["tool-calling", "streaming", "vision"],
    knownForRoles: ["coder", "researcher"],
    knownForComplexities: ["simple", "moderate"],
  },
  {
    provider: "google",
    model: "gemini-3-flash",
    pricingTier: "budget",
    contextWindow: 1000000,
    estimatedCostUsd: 0.1,
    trusted: false,
    capabilities: ["tool-calling", "streaming", "json-mode", "vision"],
    knownForRoles: ["coder", "researcher"],
    knownForComplexities: ["simple", "moderate"],
  },
  {
    provider: "xai",
    model: "grok-code-fast-1",
    pricingTier: "budget",
    contextWindow: 128000,
    estimatedCostUsd: 0.09,
    trusted: false,
    capabilities: ["tool-calling", "streaming"],
    knownForRoles: ["coder"],
    knownForComplexities: ["simple", "moderate"],
  },
  {
    provider: "qwen",
    model: "qwen2.5",
    pricingTier: "budget",
    contextWindow: 128000,
    estimatedCostUsd: 0.06,
    trusted: false,
    capabilities: ["tool-calling", "streaming", "json-mode"],
    knownForRoles: ["coder", "researcher"],
    knownForComplexities: ["simple", "moderate"],
  },
  {
    provider: "openai",
    model: "gpt-5.4",
    pricingTier: "standard",
    contextWindow: 128000,
    estimatedCostUsd: 0.7,
    trusted: true,
    capabilities: ["tool-calling", "streaming", "json-mode"],
    knownForRoles: ["architect", "reviewer", "orchestrator", "coder"],
    knownForComplexities: ["moderate", "complex"],
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4.6",
    pricingTier: "standard",
    contextWindow: 200000,
    estimatedCostUsd: 0.8,
    trusted: true,
    capabilities: ["tool-calling", "streaming", "json-mode", "vision"],
    knownForRoles: ["architect", "reviewer", "orchestrator", "coder"],
    knownForComplexities: ["moderate", "complex"],
  },
  {
    provider: "google",
    model: "gemini-3.1-pro",
    pricingTier: "standard",
    contextWindow: 1000000,
    estimatedCostUsd: 0.75,
    trusted: false,
    capabilities: ["tool-calling", "streaming", "json-mode", "vision"],
    knownForRoles: ["architect", "researcher", "orchestrator"],
    knownForComplexities: ["moderate", "complex"],
  },
  {
    provider: "anthropic",
    model: "claude-opus-4.6",
    pricingTier: "premium",
    contextWindow: 200000,
    estimatedCostUsd: 2.5,
    trusted: true,
    capabilities: ["tool-calling", "streaming", "json-mode", "vision"],
    knownForRoles: ["architect", "reviewer", "orchestrator"],
    knownForComplexities: ["expert", "complex"],
  },
];

export interface CascadeModelResolverOptions {
  readonly confidenceThreshold?: number;
  readonly defaultProvider?: string;
  readonly defaultModel?: string;
  readonly defaultPolicy?: string;
  readonly hardRulesConfig?: HardRulesConfig;
  readonly candidatePool?: readonly ResolverCandidate[];
}

export class CascadeModelResolver implements ModelResolver {
  readonly routers: readonly ModelRouter[];

  private readonly confidenceThreshold: number;
  private readonly defaultProvider: string;
  private readonly defaultModel: string;
  private readonly defaultPolicy: string;
  private readonly hardRulesConfig: HardRulesConfig;
  private readonly candidatePool: readonly ResolverCandidate[];

  constructor(routers?: readonly ModelRouter[], options: CascadeModelResolverOptions = {}) {
    this.routers = routers ?? [
      new Tier1HeuristicRouter(),
      new Tier2BertRouter(),
      new Tier3TinyLLMRouter(),
    ];
    this.confidenceThreshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    this.defaultProvider = options.defaultProvider ?? "anthropic";
    this.defaultModel = options.defaultModel ?? "claude-sonnet-4.6";
    this.defaultPolicy = options.defaultPolicy ?? "default";
    this.hardRulesConfig = options.hardRulesConfig ?? DEFAULT_HARD_RULES_CONFIG;
    this.candidatePool = options.candidatePool ?? DEFAULT_CANDIDATE_POOL;
  }

  async resolve(request: DecisionRequest): Promise<DecisionResponse> {
    const startMs = Date.now();

    let finalClassification: RouterClassification | null = null;
    let tierUsed: 1 | 2 | 3 = 1;
    const tierHistory: { tier: 1 | 2 | 3; confidence: number; reached: boolean }[] = [];

    for (const router of this.routers) {
      const routerTier = router.name === "heuristic" ? 1 : router.name === "bert" ? 2 : 3;
      const classification = await router.classify(request);

      tierHistory.push({ tier: routerTier, confidence: classification.confidence, reached: true });

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
      const alreadyReached = tierHistory.some((entry) => entry.tier === routerTier);
      if (!alreadyReached) {
        tierHistory.push({ tier: routerTier, confidence: 0, reached: false });
      }
    }

    const selectionLatencyMs = Date.now() - startMs;
    const classification =
      finalClassification ??
      ({ tier: 1, confidence: 0, classification: "moderate" } satisfies RouterClassification);

    const hardRuleRange = resolveHardRuleRange(
      { agentRole: request.agent.role, taskComplexity: classification.classification },
      this.hardRulesConfig,
    );

    if (hardRuleRange.conflict) {
      return {
        requestId: request.requestId,
        decisionId: randomUUID(),
        timestamp: new Date().toISOString(),
        status: "no_match",
        candidates: this.describeCandidates({
          request,
          classification,
          hardRuleRange,
          forceExcludedReason: hardRuleRange.rejectionReason,
        }),
        decisionMeta: {
          policyUsed: request.policyOverride ?? this.defaultPolicy,
          selectionLatencyMs,
          isFallback: false,
          fallbackReason: hardRuleRange.rejectionReason,
        },
        classificationTrace: {
          tierUsed,
          confidence: classification.confidence,
          classification: classification.classification,
          latencyMs: selectionLatencyMs,
          tierHistory,
        },
      };
    }

    const candidates = this.describeCandidates({ request, classification, hardRuleRange });
    const selectedCandidate = candidates.find((candidate) => candidate.status === "selected");

    if (selectedCandidate === undefined) {
      return {
        requestId: request.requestId,
        decisionId: randomUUID(),
        timestamp: new Date().toISOString(),
        status: "no_match",
        candidates,
        decisionMeta: {
          policyUsed: request.policyOverride ?? this.defaultPolicy,
          selectionLatencyMs,
          isFallback: false,
          fallbackReason: "no candidates matched pricing-tier hard rules",
        },
        classificationTrace: {
          tierUsed,
          confidence: classification.confidence,
          classification: classification.classification,
          latencyMs: selectionLatencyMs,
          tierHistory,
        },
      };
    }

    return {
      requestId: request.requestId,
      decisionId: randomUUID(),
      timestamp: new Date().toISOString(),
      status: "resolved",
      selected: {
        provider: selectedCandidate.provider,
        model: selectedCandidate.model,
        score: selectedCandidate.score,
      },
      candidates,
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
  }

  private describeCandidates({
    request,
    classification,
    hardRuleRange,
    forceExcludedReason,
  }: {
    request: DecisionRequest;
    classification: RouterClassification;
    hardRuleRange: ReturnType<typeof resolveHardRuleRange>;
    forceExcludedReason?: string;
  }): ModelCandidate[] {
    const descriptors = this.getCandidatePool();

    const candidateStates = descriptors.map((descriptor) => {
      const rejectionReason =
        forceExcludedReason ??
        getPricingTierRejectionReason(descriptor.pricingTier, hardRuleRange) ??
        this.getConstraintRejectionReason(descriptor, request);

      return {
        descriptor,
        score: this.scoreCandidate(descriptor, request, classification),
        rejectionReason,
      };
    });

    const allowedCandidates = candidateStates
      .filter((candidate) => candidate.rejectionReason === undefined)
      .sort((left, right) => right.score - left.score);

    const selectedKey =
      allowedCandidates.length === 0
        ? undefined
        : `${allowedCandidates[0]!.descriptor.provider}:${allowedCandidates[0]!.descriptor.model}`;

    return candidateStates
      .sort((left, right) => {
        if (left.rejectionReason === undefined && right.rejectionReason !== undefined) {
          return -1;
        }
        if (left.rejectionReason !== undefined && right.rejectionReason === undefined) {
          return 1;
        }
        return right.score - left.score;
      })
      .map(({ descriptor, score, rejectionReason }) => ({
        provider: descriptor.provider,
        model: descriptor.model,
        score,
        status:
          rejectionReason !== undefined
            ? "excluded"
            : `${descriptor.provider}:${descriptor.model}` === selectedKey
              ? "selected"
              : "runner_up",
        rejectionReason,
      }));
  }

  private getCandidatePool(): ResolverCandidate[] {
    const candidates = this.candidatePool.map((candidate) => ({ ...candidate }));

    const hasDefaultCandidate = candidates.some(
      (candidate) =>
        candidate.provider === this.defaultProvider && candidate.model === this.defaultModel,
    );

    if (!hasDefaultCandidate) {
      candidates.push({
        provider: this.defaultProvider,
        model: this.defaultModel,
        pricingTier: "standard",
      });
    }

    return candidates;
  }

  private getConstraintRejectionReason(
    descriptor: ResolverCandidate,
    request: DecisionRequest,
  ): string | undefined {
    if (request.constraints?.excludedProviders?.includes(descriptor.provider) === true) {
      return `excluded by constraints: provider ${descriptor.provider} is excluded`;
    }

    if (request.constraints?.excludedModels?.includes(descriptor.model) === true) {
      return `excluded by constraints: model ${descriptor.model} is excluded`;
    }

    if (
      request.constraints?.maxCostUsd !== undefined &&
      descriptor.estimatedCostUsd !== undefined &&
      descriptor.estimatedCostUsd > request.constraints.maxCostUsd
    ) {
      return `excluded by constraints: estimated cost ${descriptor.estimatedCostUsd} exceeds maxCostUsd ${request.constraints.maxCostUsd}`;
    }

    if (
      request.constraints?.minContextWindow !== undefined &&
      descriptor.contextWindow !== undefined &&
      descriptor.contextWindow < request.constraints.minContextWindow
    ) {
      return `excluded by constraints: context window ${descriptor.contextWindow} is below minimum ${request.constraints.minContextWindow}`;
    }

    if (
      descriptor.capabilities !== undefined &&
      request.constraints?.requiredCapabilities !== undefined &&
      request.constraints.requiredCapabilities.some(
        (capability) => !this.hasRequiredCapability(descriptor, capability),
      )
    ) {
      return "excluded by constraints: required capabilities not satisfied";
    }

    return undefined;
  }

  private hasRequiredCapability(descriptor: ResolverCandidate, capability: string): boolean {
    const supported = descriptor.capabilities ?? [];

    if (capability === "function-calling") {
      return supported.includes("tool-calling") || supported.includes("function-calling");
    }

    if (capability === "json_mode") {
      return supported.includes("json-mode") || supported.includes("json_mode");
    }

    return supported.includes(capability);
  }

  private scoreCandidate(
    descriptor: ResolverCandidate,
    request: DecisionRequest,
    classification: RouterClassification,
  ): number {
    let score = Math.round(classification.confidence * 100);

    if (descriptor.provider === this.defaultProvider && descriptor.model === this.defaultModel) {
      score += 50;
    }

    if (descriptor.knownForRoles?.includes(request.agent.role) === true) {
      score += 15;
    }

    if (descriptor.knownForComplexities?.includes(classification.classification) === true) {
      score += 15;
    }

    if (request.constraints?.preferredProviders?.includes(descriptor.provider) === true) {
      score += 10;
    }

    if (request.constraints?.preferredModels?.includes(descriptor.model) === true) {
      score += 10;
    }

    if (descriptor.trusted === true) {
      score += 5;
    }

    if (descriptor.pricingTier === "budget") {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}
