import { randomUUID } from "node:crypto";
import { computeBestMatch } from "../utils/embeddings.js";
import type {
  DecisionRequest,
  DecisionResponse,
  ModelAttribute,
  ModelCandidate,
  ModelResolver,
  ModelRouter,
  RouterClassification,
  ScoresBreakdown,
  SelectionExplanation,
} from "./types.js";
import { contextTierMinTokens, contextWindowToTier, ModelAttributeSchema } from "./types.js";
import { resolveFamilyMetadata } from "../families/catalog.js";
import type { ModelFamily } from "../families/types.js";
import type { ProviderModelAvailability } from "@diricode/dirirouter/contracts";
import {
  DEFAULT_HARD_RULES_CONFIG,
  getPricingTierRejectionReason,
  resolveHardRuleRange,
  type HardRulesConfig,
  type PricingTier,
} from "./hard-rules.js";
import { classifyRoutingTags, type RoutingClassificationResult } from "./classifier-engine.js";

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

export class Tier2EmbeddingsRouter implements ModelRouter {
  readonly name = "embeddings";
  readonly maxLatencyMs = 50;

  async classify(request: DecisionRequest): Promise<RouterClassification> {
    void request;
    return Promise.resolve({
      tier: 2,
      confidence: 0.7,
      classification: "moderate",
      reasoning:
        "Tier 2 (AI Vector Embeddings) logic active: Evaluating how deeply the agent's specializations match the model's capabilities on a semantic level.",
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
      confidence: 0.7,
      classification: "complex",
      reasoning:
        "Tier 3 active: Escalating to a complex classification to ensure heavy-duty models are evaluated.",
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
  if (lower.includes("gemini")) {
    if (lower.includes("pro") || lower.includes("ultra")) {
      return "standard";
    }
    // Flash and Flash-Lite are budget-class models
    return "budget";
  }
  if (
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

  if (modelName.includes("gemini")) {
    if (modelName.includes("pro") || modelName.includes("ultra")) {
      attributes.add("reasoning");
      attributes.add("coding");
    }
  }

  const familyMeta = resolveFamilyMetadata(avail.model_id, avail.family as ModelFamily);
  for (const attr of familyMeta.default_attributes) {
    if (ModelAttributeSchema.options.includes(attr as ModelAttribute)) {
      attributes.add(attr as ModelAttribute);
    }
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
      new Tier2EmbeddingsRouter(),
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
      const routerTier = router.name === "heuristic" ? 1 : router.name === "embeddings" ? 2 : 3;
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
      const routerTier = router.name === "heuristic" ? 1 : router.name === "embeddings" ? 2 : 3;
      const alreadyReached = tierHistory.some((entry) => entry.tier === routerTier);
      if (!alreadyReached) {
        tierHistory.push({ tier: routerTier, confidence: 0, reached: false });
      }
    }

    const selectionLatencyMs = Date.now() - startMs;
    const classification =
      finalClassification ??
      ({ tier: 1, confidence: 0, classification: "moderate" } satisfies RouterClassification);

    const classifierComparison = await classifyRoutingTags({
      agentRole: request.agent.role,
      agentSeniority: request.agent.seniority,
      agentSpecializations: request.agent.specializations,
      taskType: request.task.type,
      taskDescription: request.task.description ?? "",
    }).catch(() => null);

    let hardRuleRange = resolveHardRuleRange(
      { agentRole: request.agent.role, taskComplexity: classification.classification },
      this.hardRulesConfig,
    );

    if (request.constraints?.allowOverkill === true && hardRuleRange.maxPricingTier !== undefined) {
      hardRuleRange = { ...hardRuleRange, maxPricingTier: undefined };
    }

    if (hardRuleRange.conflict) {
      return {
        requestId: request.requestId,
        decisionId: randomUUID(),
        timestamp: new Date().toISOString(),
        status: "no_match",
        candidates: await this.describeCandidates({
          request,
          classification,
          hardRuleRange,
          forceExcludedReason: hardRuleRange.rejectionReason,
          classifierResult: null,
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
        classifierComparison: classifierComparison
          ? {
              inputText: classifierComparison.inputText,
              debertaModelName: classifierComparison.deberta.modelName,
              debertaAllTags: classifierComparison.deberta.tagScores.slice(0, 10).map((t) => ({
                tag: t.tag,
                score: Math.round(t.score * 100) / 100,
              })),
              debertaPrimaryTags: classifierComparison.deberta.primaryTags.map((t) => ({
                tag: t.tag,
                score: Math.round(t.score * 100) / 100,
              })),
              modernBertModelName: classifierComparison.modernBert.modelName,
              modernBertAllTags: classifierComparison.modernBert.tagScores
                .slice(0, 10)
                .map((t) => ({
                  tag: t.tag,
                  score: Math.round(t.score * 100) / 100,
                })),
              modernBertPrimaryTags: classifierComparison.modernBert.primaryTags.map((t) => ({
                tag: t.tag,
                score: Math.round(t.score * 100) / 100,
              })),
              agreementTags: classifierComparison.agreementTags.map((t) => ({
                tag: t.tag,
                debertaScore: Math.round(t.debertaScore * 100) / 100,
                modernBertScore: Math.round(t.modernBertScore * 100) / 100,
              })),
              disagreementTags: classifierComparison.disagreementTags.map((t) => ({
                tag: t.tag,
                debertaScore: Math.round(t.debertaScore * 100) / 100,
                modernBertScore: Math.round(t.modernBertScore * 100) / 100,
              })),
              agreementCount: classifierComparison.agreementTags.length,
              disagreementCount: classifierComparison.disagreementTags.length,
              winningModel:
                (classifierComparison.deberta.tagScores[0]?.score ?? 0) >
                (classifierComparison.modernBert.tagScores[0]?.score ?? 0)
                  ? "deberta"
                  : "modernbert",
              routingDecisionTags: (() => {
                const allTagScores = new Map<
                  string,
                  { debe: number; mbert: number; source: string }
                >();
                for (const t of classifierComparison.deberta.tagScores.slice(0, 5)) {
                  allTagScores.set(t.tag, { debe: t.score, mbert: 0, source: "deberta" });
                }
                for (const t of classifierComparison.modernBert.tagScores.slice(0, 5)) {
                  const existing = allTagScores.get(t.tag);
                  if (existing) {
                    existing.mbert = t.score;
                  } else {
                    allTagScores.set(t.tag, { debe: 0, mbert: t.score, source: "modernbert" });
                  }
                }
                return Array.from(allTagScores.entries())
                  .sort((a, b) => Math.max(b[1].debe, b[1].mbert) - Math.max(a[1].debe, a[1].mbert))
                  .slice(0, 5)
                  .map(([tag, scores]) => ({
                    tag,
                    score: Math.round(Math.max(scores.debe, scores.mbert) * 100) / 100,
                    source: scores.debe >= scores.mbert ? "deberta" : "modernbert",
                  }));
              })(),
            }
          : undefined,
      };
    }

    const candidates = await this.describeCandidates({
      request,
      classification,
      hardRuleRange,
      classifierResult: classifierComparison,
    });
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
        classifierComparison: classifierComparison
          ? {
              inputText: classifierComparison.inputText,
              debertaModelName: classifierComparison.deberta.modelName,
              debertaAllTags: classifierComparison.deberta.tagScores.slice(0, 10).map((t) => ({
                tag: t.tag,
                score: Math.round(t.score * 100) / 100,
              })),
              debertaPrimaryTags: classifierComparison.deberta.primaryTags.map((t) => ({
                tag: t.tag,
                score: Math.round(t.score * 100) / 100,
              })),
              modernBertModelName: classifierComparison.modernBert.modelName,
              modernBertAllTags: classifierComparison.modernBert.tagScores
                .slice(0, 10)
                .map((t) => ({
                  tag: t.tag,
                  score: Math.round(t.score * 100) / 100,
                })),
              modernBertPrimaryTags: classifierComparison.modernBert.primaryTags.map((t) => ({
                tag: t.tag,
                score: Math.round(t.score * 100) / 100,
              })),
              agreementTags: classifierComparison.agreementTags.map((t) => ({
                tag: t.tag,
                debertaScore: Math.round(t.debertaScore * 100) / 100,
                modernBertScore: Math.round(t.modernBertScore * 100) / 100,
              })),
              disagreementTags: classifierComparison.disagreementTags.map((t) => ({
                tag: t.tag,
                debertaScore: Math.round(t.debertaScore * 100) / 100,
                modernBertScore: Math.round(t.modernBertScore * 100) / 100,
              })),
              agreementCount: classifierComparison.agreementTags.length,
              disagreementCount: classifierComparison.disagreementTags.length,
              winningModel:
                (classifierComparison.deberta.tagScores[0]?.score ?? 0) >
                (classifierComparison.modernBert.tagScores[0]?.score ?? 0)
                  ? "deberta"
                  : "modernbert",
              routingDecisionTags: (() => {
                const allTagScores = new Map<
                  string,
                  { debe: number; mbert: number; source: string }
                >();
                for (const t of classifierComparison.deberta.tagScores.slice(0, 5)) {
                  allTagScores.set(t.tag, { debe: t.score, mbert: 0, source: "deberta" });
                }
                for (const t of classifierComparison.modernBert.tagScores.slice(0, 5)) {
                  const existing = allTagScores.get(t.tag);
                  if (existing) {
                    existing.mbert = t.score;
                  } else {
                    allTagScores.set(t.tag, { debe: 0, mbert: t.score, source: "modernbert" });
                  }
                }
                return Array.from(allTagScores.entries())
                  .sort((a, b) => Math.max(b[1].debe, b[1].mbert) - Math.max(a[1].debe, a[1].mbert))
                  .slice(0, 5)
                  .map(([tag, scores]) => ({
                    tag,
                    score: Math.round(Math.max(scores.debe, scores.mbert) * 100) / 100,
                    source: scores.debe >= scores.mbert ? "deberta" : "modernbert",
                  }));
              })(),
            }
          : undefined,
      };
    }

    const selectionExplanation = this.buildSelectionExplanation({
      request,
      classification,
      hardRuleRange,
      candidates,
      selectedCandidate,
      tierHistory,
      tierUsed,
    });

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
      selectionExplanation,
      classifierComparison: classifierComparison
        ? {
            inputText: classifierComparison.inputText,
            debertaModelName: classifierComparison.deberta.modelName,
            debertaAllTags: classifierComparison.deberta.tagScores.slice(0, 10).map((t) => ({
              tag: t.tag,
              score: Math.round(t.score * 100) / 100,
            })),
            debertaPrimaryTags: classifierComparison.deberta.primaryTags.map((t) => ({
              tag: t.tag,
              score: Math.round(t.score * 100) / 100,
            })),
            modernBertModelName: classifierComparison.modernBert.modelName,
            modernBertAllTags: classifierComparison.modernBert.tagScores.slice(0, 10).map((t) => ({
              tag: t.tag,
              score: Math.round(t.score * 100) / 100,
            })),
            modernBertPrimaryTags: classifierComparison.modernBert.primaryTags.map((t) => ({
              tag: t.tag,
              score: Math.round(t.score * 100) / 100,
            })),
            agreementTags: classifierComparison.agreementTags.map((t) => ({
              tag: t.tag,
              debertaScore: Math.round(t.debertaScore * 100) / 100,
              modernBertScore: Math.round(t.modernBertScore * 100) / 100,
            })),
            disagreementTags: classifierComparison.disagreementTags.map((t) => ({
              tag: t.tag,
              debertaScore: Math.round(t.debertaScore * 100) / 100,
              modernBertScore: Math.round(t.modernBertScore * 100) / 100,
            })),
agreementCount: classifierComparison.agreementTags.length,
              disagreementCount: classifierComparison.disagreementTags.length,
              winningModel:
                (classifierComparison.deberta.tagScores[0]?.score ?? 0) >
                (classifierComparison.modernBert.tagScores[0]?.score ?? 0)
                  ? "deberta"
                  : "modernbert",
              routingDecisionTags: (() => {
                const allTagScores = new Map<
                string,
                { debe: number; mbert: number; source: string }
              >();
              for (const t of classifierComparison.deberta.tagScores.slice(0, 5)) {
                allTagScores.set(t.tag, { debe: t.score, mbert: 0, source: "deberta" });
              }
              for (const t of classifierComparison.modernBert.tagScores.slice(0, 5)) {
                const existing = allTagScores.get(t.tag);
                if (existing) {
                  existing.mbert = t.score;
                } else {
                  allTagScores.set(t.tag, { debe: 0, mbert: t.score, source: "modernbert" });
                }
              }
              return Array.from(allTagScores.entries())
                .sort((a, b) => Math.max(b[1].debe, b[1].mbert) - Math.max(a[1].debe, a[1].mbert))
                .slice(0, 5)
                .map(([tag, scores]) => ({
                  tag,
                  score: Math.round(Math.max(scores.debe, scores.mbert) * 100) / 100,
                  source: scores.debe >= scores.mbert ? "deberta" : "modernbert",
                }));
            })(),
          }
        : undefined,
    };
  }

  private buildSelectionExplanation({
    request,
    classification,
    hardRuleRange,
    candidates,
    selectedCandidate,
    tierHistory,
    tierUsed,
  }: {
    request: DecisionRequest;
    classification: RouterClassification;
    hardRuleRange: ReturnType<typeof resolveHardRuleRange>;
    candidates: ModelCandidate[];
    selectedCandidate: ModelCandidate;
    tierHistory: { tier: 1 | 2 | 3; confidence: number; reached: boolean }[];
    tierUsed: 1 | 2 | 3;
  }): SelectionExplanation {
    const steps: string[] = [];
    const cascadeSteps: string[] = [];

    const tierDescriptions: Record<number, string> = {
      1: "Fast & Cheap Check (Rules): If the task is simple, we stop here to save money and time.",
      2: "AI Brain Match (Embeddings): We use a secondary AI to mathematically compare what the agent needs vs what the model is best at.",
      3: "Heavy Hitters: If the task is very complex, we evaluate the smartest (but most expensive) models.",
    };
    steps.push(
      `Task classified as ${classification.classification} with ${String(Math.round(classification.confidence * 100))}% confidence`,
    );
    steps.push(
      `Router tier used: ${String(classification.tier)} — ${tierDescriptions[classification.tier] ?? "unknown tier"}`,
    );

    if (classification.tier === 2) {
      const selectedBd = selectedCandidate.scoresBreakdown;
      if (selectedBd?.semanticSimilarity !== undefined) {
        const simPct = (selectedBd.semanticSimilarity * 100).toFixed(1);
        steps.push(`🧠 Embeddings Analysis:`);
        steps.push(`   Agent skills: "${selectedBd.agentSpecializationsMatched}"`);
        steps.push(`   Best model attribute matched: "${selectedBd.modelAttributesMatched}"`);
        steps.push(
          `   Semantic similarity: ${simPct}%${selectedBd.semanticBoost ? ` (+${selectedBd.semanticBoost} pts boost)` : ""}`,
        );
      }
    }

    const sortedHistory = [...tierHistory].sort((a, b) => a.tier - b.tier);
    for (const entry of sortedHistory) {
      const desc = tierDescriptions[entry.tier] ?? `Tier ${String(entry.tier)}`;
      if (!entry.reached) {
        cascadeSteps.push(
          `Tier ${String(entry.tier)}: Skipped. We already found a good model in a previous step, so we don't need to check this.`,
        );
      } else if (entry.tier === tierUsed) {
        cascadeSteps.push(
          `Tier ${String(entry.tier)}: Success! We found a good match here. Stopping to save time and money. (${desc})`,
        );
      } else {
        cascadeSteps.push(
          `Tier ${String(entry.tier)}: Task looks too hard for this tier. Moving to the next step. (${desc})`,
        );
      }
    }

    if (hardRuleRange.minPricingTier !== undefined && hardRuleRange.maxPricingTier !== undefined) {
      steps.push(
        `Hard rules limit pricing tier to ${hardRuleRange.minPricingTier} – ${hardRuleRange.maxPricingTier}`,
      );
    } else if (hardRuleRange.minPricingTier !== undefined) {
      steps.push(`Hard rules require minimum pricing tier: ${hardRuleRange.minPricingTier}`);
    } else if (hardRuleRange.maxPricingTier !== undefined) {
      steps.push(`Hard rules cap pricing tier at: ${hardRuleRange.maxPricingTier}`);
    } else if (request.constraints?.allowOverkill === true) {
      steps.push("Overkill mode enabled — pricing tier ceiling removed");
    }

    const allowedCount = candidates.filter((c) => c.status !== "excluded").length;
    const excludedCount = candidates.length - allowedCount;
    steps.push(
      `Scored ${String(candidates.length)} candidates — ${String(allowedCount)} allowed, ${String(excludedCount)} excluded`,
    );
    steps.push(
      `Selected ${selectedCandidate.provider}/${selectedCandidate.model} with score ${String(selectedCandidate.score)}`,
    );

    const whySelectedParts: string[] = [];
    whySelectedParts.push(`The model scored ${String(selectedCandidate.score)} points overall.`);

    if (selectedCandidate.scoresBreakdown) {
      const bd = selectedCandidate.scoresBreakdown;
      whySelectedParts.push(`Breakdown:`);
      whySelectedParts.push(`• Quality Base: ${String(bd.quality)} pts`);
      whySelectedParts.push(`• Capability Match: +${String(bd.capabilityMatch)} pts`);
      whySelectedParts.push(`• Latency/Context Bonus: +${String(bd.latency)} pts`);
      whySelectedParts.push(`• Budget Base: ${String(bd.cost)} pts`);

      if (
        bd.semanticSimilarity !== undefined &&
        bd.agentSpecializationsMatched &&
        bd.modelAttributesMatched
      ) {
        const similarityPct = (bd.semanticSimilarity * 100).toFixed(1);
        const boostTxt =
          bd.semanticBoost && bd.semanticBoost > 0
            ? `+${String(bd.semanticBoost)} pts`
            : "No boost (below 40% threshold)";
        whySelectedParts.push(`• 🧠 AI Brain Match (Embeddings): ${boostTxt}`);
        whySelectedParts.push(`  └─ Agent Skills: [${bd.agentSpecializationsMatched}]`);
        whySelectedParts.push(`  └─ Best Model Strength: ${bd.modelAttributesMatched}`);
        whySelectedParts.push(`  └─ Semantic Match: ${similarityPct}%`);
      }

      if (bd.capabilityGapPenalty !== undefined && bd.capabilityGapPenalty < 0) {
        whySelectedParts.push(
          `• Penalty applied: ${String(bd.capabilityGapPenalty)} pts (budget model is too weak for this ${classification.classification} task / senior agent)`,
        );
      }

      if (bd.overkillPenalty !== undefined && bd.overkillPenalty < 0) {
        whySelectedParts.push(
          `• Penalty applied: ${String(bd.overkillPenalty)} pts (premium model is overkill for this ${classification.classification} task)`,
        );
      }
    }

    if (selectedCandidate.status === "selected") {
      whySelectedParts.push(
        "It was the highest-scoring model that passed all hard rules and constraints.",
      );
    }

    const whyExcluded: string[] = candidates
      .filter(
        (c): c is ModelCandidate & { rejectionReason: string } =>
          c.status === "excluded" && c.rejectionReason !== undefined,
      )
      .map((c) => `${c.provider}/${c.model}: ${c.rejectionReason}`);

    let costImpact = "Cost impact is neutral — no cheaper alternative information available.";
    const runnerUps = candidates.filter((c) => c.status === "runner_up");
    if (runnerUps.length > 0) {
      const bestRunnerUp = runnerUps[0];
      if (bestRunnerUp !== undefined) {
        const scoreDiff = selectedCandidate.score - bestRunnerUp.score;
        if (scoreDiff === 0) {
          costImpact = `Tied with runner-up ${bestRunnerUp.provider}/${bestRunnerUp.model} (same score ${String(selectedCandidate.score)}).`;
        } else {
          costImpact = `Chosen model wins by ${String(scoreDiff)} points over runner-up ${bestRunnerUp.provider}/${bestRunnerUp.model}.`;
        }
      }
    }

    const summary = `Selected ${selectedCandidate.provider}/${selectedCandidate.model} for a ${classification.classification} task (score ${String(selectedCandidate.score)}).`;

    return {
      summary,
      steps,
      cascadeSteps,
      whySelected: whySelectedParts.join("\n"),
      whyExcluded,
      costImpact,
      tierUsed,
    };
  }

  private async describeCandidates({
    request,
    classification,
    hardRuleRange,
    forceExcludedReason,
    classifierResult,
  }: {
    request: DecisionRequest;
    classification: RouterClassification;
    hardRuleRange: ReturnType<typeof resolveHardRuleRange>;
    forceExcludedReason?: string;
    classifierResult?: RoutingClassificationResult | null;
  }): Promise<ModelCandidate[]> {
    const descriptors = this.getCandidatePool();

    const candidateStates = await Promise.all(
      descriptors.map(async (descriptor) => {
        const rejectionReason =
          forceExcludedReason ??
          (descriptor.pricingTier
            ? getPricingTierRejectionReason(descriptor.pricingTier, hardRuleRange)
            : undefined) ??
          this.getConstraintRejectionReason(descriptor, request);

        const { score, breakdown } = await this.scoreCandidate(
          descriptor,
          request,
          classification,
          classifierResult,
        );

        return {
          descriptor,
          score,
          breakdown,
          rejectionReason,
        };
      }),
    );

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
      .map(({ descriptor, score, breakdown, rejectionReason }) => ({
        provider: descriptor.provider,
        model: descriptor.model,
        score,
        status:
          rejectionReason !== undefined
            ? "excluded"
            : `${descriptor.provider}:${descriptor.model}` === selectedKey
              ? "selected"
              : "runner_up",
        scoresBreakdown: breakdown,
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

  private async scoreCandidate(
    descriptor: ResolverCandidate,
    request: DecisionRequest,
    classification: RouterClassification,
    classifierResult?: RoutingClassificationResult | null,
  ): Promise<{ score: number; breakdown: ScoresBreakdown }> {
    let quality = Math.round(classification.confidence * 100);

    if (descriptor.provider === this.defaultProvider && descriptor.model === this.defaultModel) {
      quality += 50;
    }

    if (descriptor.knownForRoles?.includes(request.agent.role) === true) {
      quality += 15;
    }

    if (descriptor.knownForComplexities?.includes(classification.classification) === true) {
      quality += 15;
    }

    if (descriptor.trusted === true) {
      quality += 5;
    }

    const modelClassBonus =
      descriptor.pricingTier === "premium" ? 20 : descriptor.pricingTier === "standard" ? 10 : 0;
    quality += modelClassBonus;

    let capabilityMatch = 0;
    if (request.modelDimensions.modelAttributes.length > 0) {
      const matchedAttributes = request.modelDimensions.modelAttributes.filter((attribute) =>
        descriptor.modelAttributes?.includes(attribute),
      ).length;
      capabilityMatch += Math.round(
        (matchedAttributes / request.modelDimensions.modelAttributes.length) * 20,
      );
    }

    let semanticSimilarity = 0;
    let semanticBoost = 0;
    let specText = "";
    let bestAttr = "";
    let bridgeConcepts: Array<{ phrase: string; attribute: string; score: number }> = [];
    let debertaMatchedTags: Array<{ tag: string; score: number }> = [];
    if (request.agent.specializations.length > 0 && (descriptor.modelAttributes?.length ?? 0) > 0) {
      specText = request.agent.specializations.join(", ");

      if (classifierResult?.deberta.tagScores.length) {
        const debeTagMap = new Map(classifierResult.deberta.tagScores.map((t) => [t.tag, t.score]));
        const attributeScores = (descriptor.modelAttributes ?? []).map((attr) => {
          const score = debeTagMap.get(attr as never) ?? 0;
          return { attr, score };
        });
        semanticSimilarity =
          attributeScores.length > 0 ? Math.max(...attributeScores.map((a) => a.score)) : 0;
        const topMatch = attributeScores.find((a) => a.score === semanticSimilarity);
        bestAttr = topMatch?.attr ?? "";
        debertaMatchedTags = attributeScores
          .filter((a) => a.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map((a) => ({ tag: a.attr, score: Math.round(a.score * 100) / 100 }));
      } else {
        const matchResult = await computeBestMatch(specText, descriptor.modelAttributes ?? []);
        semanticSimilarity = matchResult.score;
        bestAttr = matchResult.bestAttribute;
        bridgeConcepts = matchResult.bridgeConcepts;
      }

      if (semanticSimilarity > 0.4) {
        semanticBoost = Math.round((semanticSimilarity - 0.4) * (1 / 0.6) * 30);
        capabilityMatch += semanticBoost;
      }
    }

    const matchedAttrs = request.modelDimensions.modelAttributes.filter((attribute) =>
      descriptor.modelAttributes?.includes(attribute),
    );
    const missingAttrs = request.modelDimensions.modelAttributes.filter(
      (attribute) => !descriptor.modelAttributes?.includes(attribute),
    );

    if (request.constraints?.preferredProviders?.includes(descriptor.provider) === true) {
      capabilityMatch += 10;
    }

    if (
      request.constraints?.preferredModels?.includes(descriptor.model) === true ||
      request.constraints?.preferredModels?.includes(descriptor.family) === true
    ) {
      capabilityMatch += 10;
    }

    let cost = 0;
    if (descriptor.pricingTier === "budget") {
      cost += 5;
    }

    let overkillPenalty = 0;
    if (descriptor.pricingTier === "premium" && classification.classification !== "expert") {
      overkillPenalty = -15;
      cost += overkillPenalty;
    }

    let capabilityGapPenalty = 0;
    const isDemandingTask =
      classification.classification === "moderate" ||
      classification.classification === "complex" ||
      classification.classification === "expert";
    const isSeniorAgent =
      request.agent.seniority === "senior" || request.agent.seniority === "lead";

    if (descriptor.pricingTier === "budget" && (isDemandingTask || isSeniorAgent)) {
      capabilityGapPenalty = -30;
      quality += capabilityGapPenalty;
    }

    let latency = 0;
    if (descriptor.contextWindow !== undefined) {
      const candidateTier = contextWindowToTier(descriptor.contextWindow);
      const requestedTierMin = contextTierMinTokens(request.constraints?.contextTier ?? "standard");
      if (descriptor.contextWindow < requestedTierMin) {
        latency -= 50;
      } else {
        const tierOrder = { standard: 0, extended: 1, massive: 2 } as const;
        const requestedTierOrdinal = tierOrder[request.constraints?.contextTier ?? "standard"];
        const candidateTierOrdinal = tierOrder[candidateTier];
        latency += Math.min(
          20,
          (candidateTierOrdinal - requestedTierOrdinal) * 10 +
            Math.min(10, (descriptor.contextWindow - requestedTierMin) / 100_000),
        );
      }
    }

    const rawScore = quality + capabilityMatch + cost + latency;
    const score = rawScore;

    return {
      score,
      breakdown: {
        quality,
        cost,
        latency,
        capabilityMatch,
        capabilityGapPenalty: capabilityGapPenalty !== 0 ? capabilityGapPenalty : undefined,
        overkillPenalty: overkillPenalty !== 0 ? overkillPenalty : undefined,
        modelClassBonus: modelClassBonus > 0 ? modelClassBonus : undefined,
        semanticSimilarity: semanticSimilarity > 0 ? semanticSimilarity : undefined,
        semanticBoost: semanticBoost > 0 ? semanticBoost : undefined,
        agentSpecializationsMatched: semanticSimilarity > 0 ? specText : undefined,
        modelAttributesMatched: semanticSimilarity > 0 ? bestAttr : undefined,
        matchedAttributesList: matchedAttrs.length > 0 ? matchedAttrs : undefined,
        missingAttributesList: missingAttrs.length > 0 ? missingAttrs : undefined,
        bridgeConceptsUsed: bridgeConcepts.length > 0 ? bridgeConcepts : undefined,
        debertaTagScores: debertaMatchedTags.length > 0 ? debertaMatchedTags : undefined,
      },
    };
  }
}
