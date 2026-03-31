import type { ModelCardRegistry } from "./model-card-registry.js";
import type { PickerSubscription } from "./subscription.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SubscriptionNotFoundError extends Error {
  constructor(id: string) {
    super(`PickerSubscription "${id}" is not registered`);
    this.name = "SubscriptionNotFoundError";
  }
}

export class SubscriptionAlreadyRegisteredError extends Error {
  constructor(id: string) {
    super(`PickerSubscription "${id}" is already registered`);
    this.name = "SubscriptionAlreadyRegisteredError";
  }
}

// ---------------------------------------------------------------------------
// SubscriptionRegistry
// ---------------------------------------------------------------------------

/**
 * In-memory registry for {@link PickerSubscription} instances.
 *
 * Keyed by `PickerSubscription.id`. Validates that the referenced
 * `model` exists in the provided {@link ModelCardRegistry} on registration.
 *
 * @see PickerSubscription
 * @see ModelCardRegistry
 */
export class SubscriptionRegistry {
  readonly #entries = new Map<string, PickerSubscription>();
  readonly #cardRegistry: ModelCardRegistry;

  constructor(cardRegistry: ModelCardRegistry) {
    this.#cardRegistry = cardRegistry;
  }

  register(subscription: PickerSubscription): this {
    if (this.#entries.has(subscription.id)) {
      throw new SubscriptionAlreadyRegisteredError(subscription.id);
    }
    if (!this.#cardRegistry.has(subscription.model)) {
      throw new Error(
        `Cannot register subscription "${subscription.id}": ModelCard "${subscription.model}" is not registered`,
      );
    }
    this.#entries.set(subscription.id, subscription);
    return this;
  }

  get(id: string): PickerSubscription {
    const sub = this.#entries.get(id);
    if (sub === undefined) {
      throw new SubscriptionNotFoundError(id);
    }
    return sub;
  }

  list(): readonly PickerSubscription[] {
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

  update(subscription: PickerSubscription): this {
    if (!this.#entries.has(subscription.id)) {
      throw new SubscriptionNotFoundError(subscription.id);
    }
    this.#entries.set(subscription.id, subscription);
    return this;
  }

  findByModel(model: string): PickerSubscription[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.model === model);
  }

  findByProvider(provider: string): PickerSubscription[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.provider === provider);
  }

  findTrusted(): PickerSubscription[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.trusted);
  }

  findAvailable(): PickerSubscription[] {
    return Array.from(this.#entries.values()).filter((sub) => sub.available);
  }
}
