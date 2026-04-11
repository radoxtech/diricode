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
import type {
  ModelCard,
  ModelCapabilities,
  PickerSubscription,
} from "@diricode/dirirouter/contracts";
import type { ModelCardRegistry } from "../picker/model-card-registry.js";
import type { SubscriptionRegistry } from "../picker/subscription-registry.js";
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
  readonly pricingTier: PricingTier;
  readonly contextWindow?: number;
  readonly estimatedCostUsd?: number;
  readonly trusted?: boolean;
  readonly modelAttributes?: readonly ModelAttribute[];
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
    family: modelCard.family,
    pricingTier: modelCard.pricing_tier,
    contextWindow: subscription.context_window,
    estimatedCostUsd: subscription.cost_per_1k_input + subscription.cost_per_1k_output,
    trusted: subscription.trusted,
    modelAttributes: deriveModelAttributesFromCard(modelCard),
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

function deriveModelAttributesFromCard(modelCard: ModelCard): ModelAttribute[] {
  const attributes = new Set<ModelAttribute>();
  const modelName = modelCard.model.toLowerCase();
  const roles = new Set(modelCard.known_for.roles.map((role) => role.toLowerCase()));
  const complexities = new Set(
    modelCard.known_for.complexities.map((level) => level.toLowerCase()),
  );
  const specializations = new Set(
    modelCard.known_for.specializations.map((specialization) => specialization.toLowerCase()),
  );

  if (roles.has("architect") || complexities.has("complex") || complexities.has("expert")) {
    attributes.add("reasoning");
  }

  if (roles.has("reviewer")) {
    attributes.add("quality");
  }

  if (modelCard.capabilities.tool_calling || roles.has("coder")) {
    attributes.add("agentic");
  }

  if (
    modelName.includes("flash") ||
    modelName.includes("haiku") ||
    modelName.includes("mini") ||
    modelName.includes("turbo") ||
    modelName.includes("highspeed")
  ) {
    attributes.add("speed");
  }

  if (modelCard.capabilities.vision && specializations.has("frontend")) {
    attributes.add("ui-ux");
  }

  if ((modelCard.capabilities.max_context ?? 0) >= 200_000 || modelName.includes("pro")) {
    attributes.add("bulk");
  }

  if (modelName.includes("opus")) {
    attributes.add("creative");
  }

  return [...attributes];
}

/**
 * Builds the resolver candidate pool from the ModelCardRegistry and
 * SubscriptionRegistry.  For each registered model-card that also has a
 * matching subscription, a {@link ResolverCandidate} is produced via
 * {@link resolverCandidateFromContracts}.
 *
 * Model-cards without a subscription are still included with sensible
 * defaults so that the resolver can at least consider them.
 */
function buildCandidatePoolFromRegistries(
  mcr?: ModelCardRegistry,
  sr?: SubscriptionRegistry,
): readonly ResolverCandidate[] {
  if (mcr === undefined) return [];

  const cards = mcr.list();
  const candidates: ResolverCandidate[] = [];

  for (const card of cards) {
    const subs = sr?.findByModel(card.model) ?? [];

    if (subs.length > 0) {
      for (const sub of subs) {
        candidates.push(resolverCandidateFromContracts(card, sub));
      }
    } else {
      // Model card exists but no subscription yet – include with defaults
      // so the resolver can still score it.
      candidates.push({
        provider: card.family,
        model: card.model,
        family: card.family,
        pricingTier: card.pricing_tier,
        contextWindow: card.capabilities.max_context ?? undefined,
        trusted: false,
        modelAttributes: deriveModelAttributesFromCard(card),
        capabilities: capabilitiesToList(card.capabilities),
        knownForRoles: card.known_for.roles,
        knownForComplexities: card.known_for.complexities,
      });
    }
  }

  return candidates;
}

export interface CascadeModelResolverOptions {
  readonly confidenceThreshold?: number;
  readonly defaultProvider?: string;
  readonly defaultModel?: string;
  readonly defaultPolicy?: string;
  readonly hardRulesConfig?: HardRulesConfig;
  readonly candidatePool?: readonly ResolverCandidate[];
  readonly modelCardRegistry?: ModelCardRegistry;
  readonly subscriptionRegistry?: SubscriptionRegistry;
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
    this.candidatePool =
      options.candidatePool ??
      buildCandidatePoolFromRegistries(options.modelCardRegistry, options.subscriptionRegistry);
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
    const candidates = this.candidatePool.map((candidate) => ({ ...candidate }));

    const hasDefaultCandidate = candidates.some(
      (candidate) =>
        candidate.provider === this.defaultProvider && candidate.model === this.defaultModel,
    );

    if (!hasDefaultCandidate) {
      candidates.push({
        provider: this.defaultProvider,
        model: this.defaultModel,
        family: "default",
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
