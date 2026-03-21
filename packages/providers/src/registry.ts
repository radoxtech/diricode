import type { Provider, ProviderEntry, ProviderPriority } from "./types.js";

export class ProviderNotFoundError extends Error {
  constructor(name: string) {
    super(`Provider "${name}" is not registered`);
    this.name = "ProviderNotFoundError";
  }
}

export class ProviderAlreadyRegisteredError extends Error {
  constructor(name: string) {
    super(`Provider "${name}" is already registered`);
    this.name = "ProviderAlreadyRegisteredError";
  }
}

export class Registry {
  readonly #entries = new Map<string, ProviderEntry>();

  register(provider: Provider, priority: ProviderPriority): this {
    if (this.#entries.has(provider.name)) {
      throw new ProviderAlreadyRegisteredError(provider.name);
    }
    this.#entries.set(provider.name, { provider, priority });
    return this;
  }

  get(name: string): Provider {
    const entry = this.#entries.get(name);
    if (entry === undefined) {
      throw new ProviderNotFoundError(name);
    }
    return entry.provider;
  }

  list(): ReadonlyArray<{ name: string; priority: ProviderPriority }> {
    return Array.from(this.#entries.values())
      .sort((a, b) => a.priority - b.priority)
      .map(({ provider, priority }) => ({ name: provider.name, priority }));
  }

  getDefault(): Provider {
    if (this.#entries.size === 0) {
      throw new Error("No providers are registered");
    }
    let best: ProviderEntry | undefined;
    for (const entry of this.#entries.values()) {
      if (best === undefined || entry.priority < best.priority) {
        best = entry;
      }
    }
    return (best as ProviderEntry).provider;
  }

  has(name: string): boolean {
    return this.#entries.has(name);
  }

  get size(): number {
    return this.#entries.size;
  }
}
