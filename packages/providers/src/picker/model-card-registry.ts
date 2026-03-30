import type { ModelCard, PricingTier } from "./model-card.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ModelCardNotFoundError extends Error {
  constructor(model: string) {
    super(`ModelCard "${model}" is not registered`);
    this.name = "ModelCardNotFoundError";
  }
}

export class ModelCardAlreadyRegisteredError extends Error {
  constructor(model: string) {
    super(`ModelCard "${model}" is already registered`);
    this.name = "ModelCardAlreadyRegisteredError";
  }
}

// ---------------------------------------------------------------------------
// ModelCardRegistry
// ---------------------------------------------------------------------------

/**
 * In-memory registry for {@link ModelCard} instances.
 *
 * Keyed by `ModelCard.model` (the canonical model identifier).
 * Provides CRUD operations and filtering helpers.
 *
 * @see ModelCard
 */
export class ModelCardRegistry {
  readonly #entries = new Map<string, ModelCard>();

  register(card: ModelCard): this {
    if (this.#entries.has(card.model)) {
      throw new ModelCardAlreadyRegisteredError(card.model);
    }
    this.#entries.set(card.model, card);
    return this;
  }

  get(model: string): ModelCard {
    const card = this.#entries.get(model);
    if (card === undefined) {
      throw new ModelCardNotFoundError(model);
    }
    return card;
  }

  list(): readonly ModelCard[] {
    return Array.from(this.#entries.values());
  }

  has(model: string): boolean {
    return this.#entries.has(model);
  }

  get size(): number {
    return this.#entries.size;
  }

  remove(model: string): this {
    if (!this.#entries.has(model)) {
      throw new ModelCardNotFoundError(model);
    }
    this.#entries.delete(model);
    return this;
  }

  update(card: ModelCard): this {
    if (!this.#entries.has(card.model)) {
      throw new ModelCardNotFoundError(card.model);
    }
    this.#entries.set(card.model, card);
    return this;
  }

  findByPricingTier(tier: PricingTier): ModelCard[] {
    return Array.from(this.#entries.values()).filter((card) => card.pricing_tier === tier);
  }

  findByFamily(family: string): ModelCard[] {
    return Array.from(this.#entries.values()).filter((card) => card.family === family);
  }
}
