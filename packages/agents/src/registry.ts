import type { Agent, AgentCategory, AgentMetadata, AgentTier } from "@diricode/core";

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

export class TierConstraintError extends Error {
  constructor(
    public readonly tier: AgentTier,
    public readonly constraint: TierConstraint,
  ) {
    super(`Agent tier "${tier}" violates constraint: ${constraint.type}=${constraint.value}`);
    this.name = "TierConstraintError";
  }
}

export interface TierConstraint {
  readonly type: "max" | "min" | "exact";
  readonly value: AgentTier;
}

export interface AgentRegistryOptions {
  readonly emit?: (event: string, payload: unknown) => void;
  readonly defaultTierConstraint?: TierConstraint;
}

const TIER_PRIORITY: readonly AgentTier[] = ["light", "medium", "heavy"];

function compareTiers(a: AgentTier, b: AgentTier): number {
  return TIER_PRIORITY.indexOf(a) - TIER_PRIORITY.indexOf(b);
}

function satisfiesTierConstraint(tier: AgentTier, constraint: TierConstraint): boolean {
  const comparison = compareTiers(tier, constraint.value);
  switch (constraint.type) {
    case "max":
      return comparison <= 0;
    case "min":
      return comparison >= 0;
    case "exact":
      return comparison === 0;
    default:
      return true;
  }
}

export class AgentRegistry {
  readonly #entries = new Map<string, Agent>();
  readonly #emit?: (event: string, payload: unknown) => void;
  readonly #defaultTierConstraint?: TierConstraint;

  constructor(options: AgentRegistryOptions = {}) {
    this.#emit = options.emit;
    this.#defaultTierConstraint = options.defaultTierConstraint;
  }

  register(agent: Agent): this {
    const { name, tier } = agent.metadata;

    if (this.#entries.has(name)) {
      const error = new AgentAlreadyRegisteredError(name);
      this.#emit?.("agent.rejected", {
        agent: name,
        tier,
        reason: "already_registered",
        error: error.message,
      });
      throw error;
    }

    this.#entries.set(name, agent);
    this.#emit?.("agent.registered", {
      agent: name,
      tier,
      category: agent.metadata.category,
      tags: agent.metadata.tags,
    });

    return this;
  }

  getByName(name: string): Agent {
    return this.get(name);
  }

  get(name: string): Agent {
    const agent = this.#entries.get(name);
    if (agent === undefined) {
      throw new AgentNotFoundError(name);
    }
    return agent;
  }

  list(category?: AgentCategory, tierConstraint?: TierConstraint): readonly AgentMetadata[] {
    let all = Array.from(this.#entries.values()).map((a) => a.metadata);

    if (category !== undefined) {
      all = all.filter((m) => m.category === category);
    }

    const constraint = tierConstraint ?? this.#defaultTierConstraint;
    if (constraint !== undefined) {
      all = all.filter((m) => satisfiesTierConstraint(m.tier, constraint));
    }

    return all;
  }

  listByTag(tag: string, tierConstraint?: TierConstraint): readonly AgentMetadata[] {
    let matches = Array.from(this.#entries.values())
      .filter((a) => a.metadata.tags.includes(tag))
      .map((a) => a.metadata);

    const constraint = tierConstraint ?? this.#defaultTierConstraint;
    if (constraint !== undefined) {
      matches = matches.filter((m) => satisfiesTierConstraint(m.tier, constraint));
    }

    return matches;
  }

  listByTier(tier: AgentTier): readonly AgentMetadata[] {
    return Array.from(this.#entries.values())
      .filter((a) => a.metadata.tier === tier)
      .map((a) => a.metadata);
  }

  search(
    query: string,
    tierConstraint?: TierConstraint,
  ): readonly { agent: AgentMetadata; score: number }[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return [];
    }

    const results: { agent: AgentMetadata; score: number }[] = [];
    const constraint = tierConstraint ?? this.#defaultTierConstraint;

    for (const agent of this.#entries.values()) {
      const { metadata } = agent;

      if (constraint && !satisfiesTierConstraint(metadata.tier, constraint)) {
        continue;
      }

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
