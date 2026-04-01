import type { PricingTier } from "@diricode/picker-contracts";
import { z } from "zod";

export { PricingTierSchema } from "@diricode/picker-contracts";
export type { PricingTier } from "@diricode/picker-contracts";

export const TaskComplexitySchema = z.enum(["simple", "moderate", "complex", "expert"]);
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;

export const HardRuleSchema = z
  .object({
    "agent.role": z.string().min(1).optional(),
    "task.complexity": TaskComplexitySchema.optional(),
    min_pricing_tier: z.enum(["budget", "standard", "premium"]).optional(),
    max_pricing_tier: z.enum(["budget", "standard", "premium"]).optional(),
  })
  .refine((rule) => rule["agent.role"] !== undefined || rule["task.complexity"] !== undefined, {
    message: "Hard rule must declare at least one matcher",
  })
  .refine((rule) => rule.min_pricing_tier !== undefined || rule.max_pricing_tier !== undefined, {
    message: "Hard rule must declare min_pricing_tier or max_pricing_tier",
  });
export type HardRule = z.infer<typeof HardRuleSchema>;

export const HardRulesConfigSchema = z.object({
  hard_rules: z.array(HardRuleSchema),
});
export type HardRulesConfig = z.infer<typeof HardRulesConfigSchema>;

export const DEFAULT_HARD_RULES_CONFIG: HardRulesConfig = HardRulesConfigSchema.parse({
  hard_rules: [
    { "agent.role": "architect", min_pricing_tier: "standard" },
    { "agent.role": "reviewer", min_pricing_tier: "standard" },
    { "agent.role": "orchestrator", min_pricing_tier: "standard" },
    { "agent.role": "coder", min_pricing_tier: "budget" },
    { "agent.role": "researcher", min_pricing_tier: "budget" },
    { "task.complexity": "expert", min_pricing_tier: "premium" },
    { "task.complexity": "complex", min_pricing_tier: "standard" },
    { "task.complexity": "simple", max_pricing_tier: "budget" },
  ],
});

const PRICING_TIER_ORDER: readonly PricingTier[] = ["budget", "standard", "premium"];

export interface HardRuleEvaluationContext {
  readonly agentRole: string;
  readonly taskComplexity: TaskComplexity;
}

export interface HardRuleEvaluationResult {
  readonly matchedRules: readonly HardRule[];
  readonly minPricingTier?: PricingTier;
  readonly maxPricingTier?: PricingTier;
  readonly conflict: boolean;
  readonly rejectionReason?: string;
}

export function comparePricingTiers(left: PricingTier, right: PricingTier): number {
  return PRICING_TIER_ORDER.indexOf(left) - PRICING_TIER_ORDER.indexOf(right);
}

export function isPricingTierAllowed(
  pricingTier: PricingTier,
  range: Pick<HardRuleEvaluationResult, "minPricingTier" | "maxPricingTier">,
): boolean {
  if (
    range.minPricingTier !== undefined &&
    comparePricingTiers(pricingTier, range.minPricingTier) < 0
  ) {
    return false;
  }

  if (
    range.maxPricingTier !== undefined &&
    comparePricingTiers(pricingTier, range.maxPricingTier) > 0
  ) {
    return false;
  }

  return true;
}

export function getPricingTierRejectionReason(
  pricingTier: PricingTier,
  range: Pick<HardRuleEvaluationResult, "minPricingTier" | "maxPricingTier">,
): string | undefined {
  if (
    range.minPricingTier !== undefined &&
    comparePricingTiers(pricingTier, range.minPricingTier) < 0
  ) {
    return `excluded by pricing-tier hard rules: ${pricingTier} is below minimum ${range.minPricingTier}`;
  }

  if (
    range.maxPricingTier !== undefined &&
    comparePricingTiers(pricingTier, range.maxPricingTier) > 0
  ) {
    return `excluded by pricing-tier hard rules: ${pricingTier} exceeds maximum ${range.maxPricingTier}`;
  }

  return undefined;
}

export function resolveHardRuleRange(
  context: HardRuleEvaluationContext,
  config: HardRulesConfig = DEFAULT_HARD_RULES_CONFIG,
): HardRuleEvaluationResult {
  let minPricingTier: PricingTier | undefined;
  let maxPricingTier: PricingTier | undefined;
  const matchedRules: HardRule[] = [];

  for (const rule of config.hard_rules) {
    const matchesAgentRole =
      rule["agent.role"] === undefined || rule["agent.role"] === context.agentRole;
    const matchesTaskComplexity =
      rule["task.complexity"] === undefined || rule["task.complexity"] === context.taskComplexity;

    if (!matchesAgentRole || !matchesTaskComplexity) {
      continue;
    }

    matchedRules.push(rule);

    if (
      rule.min_pricing_tier !== undefined &&
      (minPricingTier === undefined ||
        comparePricingTiers(rule.min_pricing_tier, minPricingTier) > 0)
    ) {
      minPricingTier = rule.min_pricing_tier;
    }

    if (
      rule.max_pricing_tier !== undefined &&
      (maxPricingTier === undefined ||
        comparePricingTiers(rule.max_pricing_tier, maxPricingTier) < 0)
    ) {
      maxPricingTier = rule.max_pricing_tier;
    }
  }

  const conflict =
    minPricingTier !== undefined &&
    maxPricingTier !== undefined &&
    comparePricingTiers(minPricingTier, maxPricingTier) > 0;

  const rejectionReason =
    conflict && minPricingTier !== undefined && maxPricingTier !== undefined
      ? `pricing-tier hard-rule conflict: minimum ${minPricingTier} exceeds maximum ${maxPricingTier}`
      : undefined;

  return {
    matchedRules,
    minPricingTier,
    maxPricingTier,
    conflict,
    rejectionReason,
  };
}
