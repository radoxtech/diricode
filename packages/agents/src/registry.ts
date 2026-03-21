import type { Agent, AgentCategory, AgentMetadata } from "@diricode/core";

export class AgentNotFoundError extends Error {
  constructor(name: string) {
    super(`Agent "${name}" is not registered`);
    this.name = "AgentNotFoundError";
  }
}

export class AgentAlreadyRegisteredError extends Error {
  constructor(name: string) {
    super(`Agent "${name}" is already registered`);
    this.name = "AgentAlreadyRegisteredError";
  }
}

export class AgentRegistry {
  readonly #entries = new Map<string, Agent>();

  register(agent: Agent): this {
    if (this.#entries.has(agent.metadata.name)) {
      throw new AgentAlreadyRegisteredError(agent.metadata.name);
    }
    this.#entries.set(agent.metadata.name, agent);
    return this;
  }

  get(name: string): Agent {
    const agent = this.#entries.get(name);
    if (agent === undefined) {
      throw new AgentNotFoundError(name);
    }
    return agent;
  }

  list(category?: AgentCategory): readonly AgentMetadata[] {
    const all = Array.from(this.#entries.values()).map((a) => a.metadata);
    if (category === undefined) {
      return all;
    }
    return all.filter((m) => m.category === category);
  }

  search(query: string): readonly { agent: AgentMetadata; score: number }[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return [];
    }

    const results: { agent: AgentMetadata; score: number }[] = [];

    for (const agent of this.#entries.values()) {
      const { metadata } = agent;
      const haystack = [
        metadata.name,
        metadata.description,
        ...metadata.capabilities,
        ...metadata.tags,
        metadata.category,
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) {
          score += 1.0;
        }
      }

      if (score > 0) {
        results.push({ agent: metadata, score: score / terms.length });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  has(name: string): boolean {
    return this.#entries.has(name);
  }

  get size(): number {
    return this.#entries.size;
  }
}
