import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SubscriptionNotFoundError extends Error {
  constructor(id: string) {
    super(`Subscription "${id}" is not registered`);
    this.name = "SubscriptionNotFoundError";
  }
}

export class SubscriptionAlreadyRegisteredError extends Error {
  constructor(id: string) {
    super(`Subscription "${id}" is already registered`);
    this.name = "SubscriptionAlreadyRegisteredError";
  }
}

// ---------------------------------------------------------------------------
// SubscriptionRegistry
// ---------------------------------------------------------------------------

/**
 * In-memory registry for {@link ProviderModelAvailability} instances.
 *
 * Keyed by `ProviderModelAvailability.id`. Validates that `id` is present
 * and non-empty on registration. Provider availability is trusted as the
 * golden source — no card-registry validation is performed.
 */
export class SubscriptionRegistry {
  readonly #entries = new Map<string, ProviderModelAvailability>();

  #normalizeId(subscription: ProviderModelAvailability): string {
    return subscription.id?.trim() ?? `${subscription.provider}-${subscription.model_id}`;
  }

  register(subscription: ProviderModelAvailability): this {
    const key = this.#normalizeId(subscription);
    if (this.#entries.has(key)) {
      throw new SubscriptionAlreadyRegisteredError(key);
    }
    this.#entries.set(key, { ...subscription, id: key });
    return this;
  }

  get(id: string): ProviderModelAvailability {
    const sub = this.#entries.get(id);
    if (sub === undefined) {
      throw new SubscriptionNotFoundError(id);
    }
    return sub;
  }

  list(): readonly ProviderModelAvailability[] {
    return Array.from(this.#entries.values());
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  get size(): number {
    return this.#entries.size;
  }

  remove(id: string): this {
    if (!this.#entries.has(id)) {
      throw new SubscriptionNotFoundError(id);
    }
    this.#entries.delete(id);
    return this;
  }

  update(subscription: ProviderModelAvailability): this {
    const key = this.#normalizeId(subscription);
    if (!this.#entries.has(key)) {
      throw new SubscriptionNotFoundError(key);
    }
    this.#entries.set(key, { ...subscription, id: key });
    return this;
  }

  findByModel(model: string): ProviderModelAvailability[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.model_id === model);
  }

  findByProvider(provider: string): ProviderModelAvailability[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.provider === provider);
  }

  findTrusted(): ProviderModelAvailability[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.trusted);
  }

  findAvailable(): ProviderModelAvailability[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.available);
  }
}
