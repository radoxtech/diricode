import { randomUUID } from "node:crypto";
import type {
  DecisionRequest,
  DecisionResponse,
  ModelAttribute,
  ModelCandidate,
  ModelResolver,
  ModelRouter,
  RouterClassification,
} from "./types.js";
import { contextTierMinTokens, contextWindowToTier } from "./types.js";
import type { ProviderModelAvailability } from "@diricode/dirirouter/contracts";
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
  readonly family: string;
  readonly pricingTier?: PricingTier;
  readonly contextWindow?: number;
  readonly estimatedCostUsd?: number;
  readonly trusted?: boolean;
  readonly modelAttributes?: readonly ModelAttribute[];
  readonly capabilities?: readonly string[];
  readonly knownForRoles?: readonly string[];
  readonly knownForComplexities?: readonly string[];
}

function pricingTierFromModelName(modelName: string): PricingTier {
  const lower = modelName.toLowerCase();
  if (
    lower.includes("flash") ||
    lower.includes("haiku") ||
    lower.includes("mini") ||
    lower.includes("turbo") ||
    lower.includes("highspeed") ||
    lower.includes("nano") ||
    lower.includes("lite")
  ) {
    return "budget";
  }
  if (lower.includes("opus") || lower.endsWith("-plus")) {
    return "premium";
  }
  return "standard";
}

function deriveModelAttributesFromAvailability(avail: ProviderModelAvailability): ModelAttribute[] {
  const attributes = new Set<ModelAttribute>();
  const modelName = avail.model_id.toLowerCase();

  if (
    modelName.includes("flash") ||
    modelName.includes("haiku") ||
    modelName.includes("mini") ||
    modelName.includes("turbo") ||
    modelName.includes("highspeed")
  ) {
    attributes.add("speed");
  }

  if (modelName.includes("opus")) {
    attributes.add("creative");
  }

  if (avail.context_window >= 200_000 || modelName.includes("pro")) {
    attributes.add("bulk");
  }

  if (avail.supports_tool_calling) {
    attributes.add("agentic");
  }

  return [...attributes];
}

function capabilitiesFromAvailability(avail: ProviderModelAvailability): string[] {
  const supported: string[] = [];
  if (avail.supports_tool_calling) supported.push("tool-calling");
  if (avail.supports_streaming) supported.push("streaming");
  if (avail.supports_vision) supported.push("vision");
  if (avail.supports_structured_output) supported.push("json-mode");
  return supported;
}

/**
 * Builds resolver candidates from provider availability data.
 *
 * Each availability entry becomes a candidate. Family metadata and
 * capability heuristics are derived from the availability object.
 */
function buildCandidatePoolFromAvailabilities(
  availabilities: ProviderModelAvailability[],
): readonly ResolverCandidate[] {
  return availabilities.map((avail) => ({
    provider: avail.provider,
    model: avail.model_id,
    family: avail.family,
    pricingTier: pricingTierFromModelName(avail.model_id),
    contextWindow: avail.context_window,
    estimatedCostUsd: avail.input_cost_per_1k + avail.output_cost_per_1k,
    trusted: avail.trusted,
    modelAttributes: deriveModelAttributesFromAvailability(avail),
    capabilities: capabilitiesFromAvailability(avail),
  }));
}

export interface CascadeModelResolverOptions {
  readonly confidenceThreshold?: number;
  readonly defaultProvider?: string;
  readonly defaultModel?: string;
  readonly defaultPolicy?: string;
  readonly hardRulesConfig?: HardRulesConfig;
  readonly candidatePool?: readonly ResolverCandidate[];
  /** Direct candidate pool — takes precedence over providerAvailabilities */
  readonly providerAvailabilities?: ProviderModelAvailability[];
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
    this.defaultProvider = options.defaultProvider ?? "";
    this.defaultModel = options.defaultModel ?? "";
    this.defaultPolicy = options.defaultPolicy ?? "default";
    this.hardRulesConfig = options.hardRulesConfig ?? DEFAULT_HARD_RULES_CONFIG;
    this.candidatePool =
      options.candidatePool ??
      buildCandidatePoolFromAvailabilities(options.providerAvailabilities ?? []);
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
        (descriptor.pricingTier
          ? getPricingTierRejectionReason(descriptor.pricingTier, hardRuleRange)
          : undefined) ??
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

    const firstAllowedCandidate = allowedCandidates.at(0);
    const selectedKey =
      firstAllowedCandidate === undefined
        ? undefined
        : `${firstAllowedCandidate.descriptor.provider}:${firstAllowedCandidate.descriptor.model}`;

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

  getCandidatePool(): ResolverCandidate[] {
    return this.candidatePool.map((candidate) => ({ ...candidate }));
  }

  private getConstraintRejectionReason(
    descriptor: ResolverCandidate,
    request: DecisionRequest,
  ): string | undefined {
    if (request.constraints?.excludedProviders?.includes(descriptor.provider) === true) {
      return `excluded by constraints: provider ${descriptor.provider} is excluded`;
    }

    if (
      request.constraints?.excludedModels?.includes(descriptor.model) === true ||
      request.constraints?.excludedModels?.includes(descriptor.family) === true
    ) {
      return `excluded by constraints: model ${descriptor.model} is excluded`;
    }

    if (request.failedModels?.includes(descriptor.model) === true) {
      return `excluded by fallback: model ${descriptor.model} previously failed`;
    }

    if (request.constraints?.contextTier !== undefined && descriptor.contextWindow !== undefined) {
      const requiredMin = contextTierMinTokens(request.constraints.contextTier);
      if (descriptor.contextWindow < requiredMin) {
        return `excluded by constraints: context window ${String(descriptor.contextWindow)} is below ${request.constraints.contextTier} tier minimum ${String(requiredMin)}`;
      }
    }

    if (
      descriptor.capabilities !== undefined &&
      request.constraints?.requiredCapabilities?.some(
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

    if (request.modelDimensions.modelAttributes.length > 0) {
      const matchedAttributes = request.modelDimensions.modelAttributes.filter((attribute) =>
        descriptor.modelAttributes?.includes(attribute),
      ).length;
      score += Math.round(
        (matchedAttributes / request.modelDimensions.modelAttributes.length) * 20,
      );
    }

    if (request.constraints?.preferredProviders?.includes(descriptor.provider) === true) {
      score += 10;
    }

    if (
      request.constraints?.preferredModels?.includes(descriptor.model) === true ||
      request.constraints?.preferredModels?.includes(descriptor.family) === true
    ) {
      score += 10;
    }

    if (descriptor.trusted === true) {
      score += 5;
    }

    if (descriptor.pricingTier === "budget") {
      score += 5;
    }

    if (descriptor.contextWindow !== undefined) {
      const candidateTier = contextWindowToTier(descriptor.contextWindow);
      const requestedTierMin = contextTierMinTokens(request.constraints?.contextTier ?? "standard");
      if (descriptor.contextWindow < requestedTierMin) {
        score -= 50;
      } else {
        const tierOrder = { standard: 0, extended: 1, massive: 2 } as const;
        const requestedTierOrdinal = tierOrder[request.constraints?.contextTier ?? "standard"];
        const candidateTierOrdinal = tierOrder[candidateTier];
        score += Math.min(
          20,
          (candidateTierOrdinal - requestedTierOrdinal) * 10 +
            Math.min(10, (descriptor.contextWindow - requestedTierMin) / 100_000),
        );
      }
    }

    return Math.max(0, Math.min(100, score));
  }
}
