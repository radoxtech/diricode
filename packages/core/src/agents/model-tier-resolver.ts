import type { AgentTier } from "./types.js";

// ---------------------------------------------------------------------------
// Model Tier
// ---------------------------------------------------------------------------

/**
 * Computational tier for model selection.
 * Corresponds to the HEAVY/MEDIUM/LOW classification in ADR-004.
 *
 * - HEAVY:   Architecture, complex reasoning, thorough review
 * - MEDIUM:  Standard coding, quick review, debugging
 * - LOW:     Commit messages, naming, summaries
 */
export type ModelTier = AgentTier;

// ---------------------------------------------------------------------------
// Model Class
// ---------------------------------------------------------------------------

/**
 * Model class identifier.
 * Examples: "claude-opus-4.6", "gpt-5.4", "sonnet-4.6", "haiku-4.5"
 */
export type ModelClass = string;

// ---------------------------------------------------------------------------
// Resolution Reason
// ---------------------------------------------------------------------------

/**
 * Why a particular model was selected.
 * Used for observability and debugging of model selection decisions.
 */
export type ResolutionReason =
  /** This model is the preferred choice for the requested tier */
  | "preferred"
  /** The preferred model was unavailable; this is a fallback */
  | "fallback"
  /** The preferred model was unavailable and all fallbacks were degraded */
  | "degraded";

// ---------------------------------------------------------------------------
// Tier Mapping Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for a single tier's model selection.
 */
export interface TierMappingConfig {
  /**
   * The preferred model class for this tier.
   * This model is selected first when available.
   */
  readonly preferred: ModelClass;

  /**
   * Ordered list of fallback model classes.
   * Tried in order when the preferred model is unavailable.
   */
  readonly fallback?: readonly ModelClass[];
}

// ---------------------------------------------------------------------------
// Tier Resolution Result
// ---------------------------------------------------------------------------

/**
 * Result of resolving a model for a given tier.
 * Includes the selected model and metadata about why it was selected.
 */
export interface TierResolution {
  /**
   * The resolved model class.
   */
  readonly model: ModelClass;

  /**
   * Why this model was selected.
   */
  readonly reason: ResolutionReason;

  /**
   * Whether a degraded (downgraded) model was selected.
   * This is true when the preferred model AND all fallbacks were unavailable.
   */
  readonly isDegraded: boolean;

  /**
   * The tier that was requested.
   */
  readonly requestedTier: ModelTier;

  /**
   * The position in the fallback chain (0 = preferred, 1 = first fallback, etc.)
   */
  readonly fallbackIndex: number;
}

// ---------------------------------------------------------------------------
// Availability Checker
// ---------------------------------------------------------------------------

/**
 * Function that checks if a model is currently available.
 * Used by the resolver to determine if a model can be selected.
 */
export type AvailabilityChecker = (model: ModelClass) => boolean;

// ---------------------------------------------------------------------------
// Default Availability Checker (always available)
// ---------------------------------------------------------------------------

function defaultAvailabilityChecker(_model: ModelClass): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Model Tier Resolver
// ---------------------------------------------------------------------------

/**
 * Configurable tier → model class resolver with fallback support.
 *
 * ## Resolver Composition (DC-DR-006)
 *
 * `ModelTierResolver` and `CascadeModelResolver` serve different roles:
 *
 * - **`ModelTierResolver`** — Legacy tier→model mapper. Takes a `ModelTier`
 *   (heavy/medium/low) and returns which model class to use. Does NOT implement
 *   `ModelResolver`. Used as a **candidate pool source** for `CascadeModelResolver`.
 *
 * - **`CascadeModelResolver`** — Full decision engine (implements `ModelResolver`).
 *   Takes a `DecisionRequest`, applies hard rules, constraint filtering, and scoring
 *   to select from the candidate pool.
 *
 * ### Composition seam
 *
 * ```
 * ModelTierResolver.resolve(tier)
 *          ↓
 *   Returns: tier + model class
 *          ↓
 *   Maps to: candidate pool entries
 *          ↓
 * CascadeModelResolver.resolve(request)
 *          ↓
 *   Applies: hard rules + scoring
 *          ↓
 *   Returns: selected model
 * ```
 *
 * `ModelTierResolver` feeds the **preferred model per tier** into the
 * `CascadeModelResolver` candidate pool. `CascadeModelResolver` then applies
 * the full selection logic (hard rules, constraint filtering, scoring, ADR-055
 * context-window tier scoring) on top.
 *
 * @example
 * ```typescript
 * const resolver = new ModelTierResolver({
 *   heavy: { preferred: "claude-opus-4.6", fallback: ["gpt-5.4", "gemini-3.1-pro"] },
 *   medium: { preferred: "sonnet-4.6", fallback: ["kimi-2.5", "qwen3-coder-next"] },
 *   light: { preferred: "haiku-4.5", fallback: ["deepseek-v3.2"] },
 * });
 *
 * const result = resolver.resolve("heavy");
 * // → { model: "claude-opus-4.6", reason: "preferred", isDegraded: false, ... }
 * ```
 *
 * @see CascadeModelResolver
 * @see ADR-055 Addendum (Context Window Tiers)
 */
export class ModelTierResolver {
  readonly #mappings: ReadonlyMap<ModelTier, TierMappingConfig>;
  readonly #checkAvailability: AvailabilityChecker;

  constructor(
    mappings: Readonly<Record<ModelTier, TierMappingConfig>>,
    options?: { checkAvailability?: AvailabilityChecker },
  ) {
    this.#mappings = new Map(Object.entries(mappings) as [ModelTier, TierMappingConfig][]);
    this.#checkAvailability = options?.checkAvailability ?? defaultAvailabilityChecker;
  }

  /**
   * Resolve a model for the given tier.
   *
   * Selection logic:
   * 1. Check if preferred model is available → select it (reason: "preferred")
   * 2. Iterate through fallbacks in order → select first available (reason: "fallback")
   * 3. If nothing available → select preferred anyway, mark as degraded (reason: "degraded")
   *
   * @param tier - The tier to resolve
   * @returns The resolution result with model and metadata
   */
  resolve(tier: ModelTier): TierResolution {
    const mapping = this.#mappings.get(tier);
    if (!mapping) {
      throw new Error(`No mapping configured for tier "${tier}"`);
    }

    const candidates = [mapping.preferred, ...(mapping.fallback ?? [])];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (candidate === undefined) break;
      if (this.#checkAvailability(candidate)) {
        return {
          model: candidate,
          reason: i === 0 ? "preferred" : "fallback",
          isDegraded: false,
          requestedTier: tier,
          fallbackIndex: i,
        };
      }
    }

    // Nothing available — return preferred as degraded
    return {
      model: mapping.preferred,
      reason: "degraded",
      isDegraded: true,
      requestedTier: tier,
      fallbackIndex: 0,
    };
  }

  /**
   * Get the preferred model for a tier without checking availability.
   */
  getPreferred(tier: ModelTier): ModelClass {
    const mapping = this.#mappings.get(tier);
    if (!mapping) {
      throw new Error(`No mapping configured for tier "${tier}"`);
    }
    return mapping.preferred;
  }

  /**
   * Get the full fallback chain for a tier (preferred + fallbacks).
   */
  getFallbackChain(tier: ModelTier): readonly ModelClass[] {
    const mapping = this.#mappings.get(tier);
    if (!mapping) {
      throw new Error(`No mapping configured for tier "${tier}"`);
    }
    return [mapping.preferred, ...(mapping.fallback ?? [])];
  }

  /**
   * Check if a model is the preferred choice for a tier.
   */
  isPreferred(tier: ModelTier, model: ModelClass): boolean {
    return this.getPreferred(tier) === model;
  }

  /**
   * Check if a model is in the fallback chain for a tier.
   */
  isInChain(tier: ModelTier, model: ModelClass): boolean {
    return this.getFallbackChain(tier).includes(model);
  }

  updateMapping(tier: ModelTier, config: TierMappingConfig): ModelTierResolver {
    const newMappings = new Map(this.#mappings);
    newMappings.set(tier, config);
    return new ModelTierResolver(
      Object.fromEntries(newMappings) as Record<ModelTier, TierMappingConfig>,
      { checkAvailability: this.#checkAvailability },
    );
  }
}
