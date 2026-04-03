import type { Agent, AgentDomain, AgentMetadata, AgentTier, ModelAttribute } from "@diricode/core";

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

function metadataSatisfiesTierConstraint(
  metadata: AgentMetadata,
  constraint: TierConstraint,
): boolean {
  return metadata.allowedTiers.some((tier) => satisfiesTierConstraint(tier, constraint));
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
    const { name, allowedTiers } = agent.metadata;

    if (this.#entries.has(name)) {
      const error = new AgentAlreadyRegisteredError(name);
      this.#emit?.("agent.rejected", {
        agent: name,
        allowedTiers,
        reason: "already_registered",
        error: error.message,
      });
      throw error;
    }

    this.#entries.set(name, agent);
    this.#emit?.("agent.registered", {
      agent: name,
      allowedTiers,
      primary: agent.metadata.capabilities.primary,
      specialization: agent.metadata.capabilities.specialization,
      modelAttributes: agent.metadata.capabilities.modelAttributes,
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

  list(domain?: AgentDomain, tierConstraint?: TierConstraint): readonly AgentMetadata[] {
    let all = Array.from(this.#entries.values()).map((a) => a.metadata);

    if (domain !== undefined) {
      all = all.filter((m) => m.capabilities.primary === domain);
    }

    const constraint = tierConstraint ?? this.#defaultTierConstraint;
    if (constraint !== undefined) {
      all = all.filter((m) => metadataSatisfiesTierConstraint(m, constraint));
    }

    return all;
  }

  listByModelAttribute(
    modelAttribute: ModelAttribute,
    tierConstraint?: TierConstraint,
  ): readonly AgentMetadata[] {
    let matches = Array.from(this.#entries.values())
      .filter((a) => a.metadata.capabilities.modelAttributes.includes(modelAttribute))
      .map((a) => a.metadata);

    const constraint = tierConstraint ?? this.#defaultTierConstraint;
    if (constraint !== undefined) {
      matches = matches.filter((m) => metadataSatisfiesTierConstraint(m, constraint));
    }

    return matches;
  }

  listByTier(tier: AgentTier): readonly AgentMetadata[] {
    return Array.from(this.#entries.values())
      .filter((a) => a.metadata.allowedTiers.includes(tier))
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

      if (constraint && !metadataSatisfiesTierConstraint(metadata, constraint)) {
        continue;
      }

      const haystack = [
        metadata.name,
        metadata.description,
        metadata.capabilities.primary,
        ...metadata.capabilities.specialization,
        ...metadata.capabilities.modelAttributes,
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
