import { describe, expect, it, vi } from "vitest";
import { AgentAlreadyRegisteredError, AgentNotFoundError, AgentRegistry } from "../index.js";
import type {
  Agent,
  AgentContext,
  AgentDomain,
  AgentResult,
  AgentTier,
  ModelAttribute,
} from "../index.js";

function makeAgent(
  name: string,
  primary: AgentDomain = "coding",
  allowedTiers: readonly AgentTier[] = ["medium"],
  modelAttributes: readonly ModelAttribute[] = ["reasoning"],
): Agent {
  return {
    metadata: {
      name,
      description: `${name} agent`,
      allowedTiers,
      capabilities: {
        primary,
        specialization: [name, "test"],
        modelAttributes,
      },
    },
    execute: (_input: string, _context: AgentContext): Promise<AgentResult> =>
      Promise.resolve({ success: true, output: `${name}:done`, toolCalls: 0, tokensUsed: 0 }),
  };
}

describe("AgentRegistry", () => {
  describe("register", () => {
    it("registers an agent and returns this for chaining", () => {
      const reg = new AgentRegistry();
      const coder = makeAgent("coder");
      const result = reg.register(coder);
      expect(result).toBe(reg);
      expect(reg.size).toBe(1);
    });

    it("allows registering multiple distinct agents", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      reg.register(makeAgent("reviewer"));
      expect(reg.size).toBe(2);
    });

    it("throws AgentAlreadyRegisteredError on duplicate name", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      expect(() => reg.register(makeAgent("coder"))).toThrow(AgentAlreadyRegisteredError);
    });

    it("AgentAlreadyRegisteredError message includes agent name", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      expect(() => reg.register(makeAgent("coder"))).toThrow(/coder/);
    });

    describe("event emission", () => {
      it("emits agent.registered on successful registration", () => {
        const emit = vi.fn();
        const reg = new AgentRegistry({ emit });
        const agent = makeAgent("test-agent", "coding", ["heavy"], ["agentic", "reasoning"]);

        reg.register(agent);

        expect(emit).toHaveBeenCalledWith("agent.registered", {
          agent: "test-agent",
          allowedTiers: ["heavy"],
          primary: "coding",
          specialization: ["test-agent", "test"],
          modelAttributes: ["agentic", "reasoning"],
        });
      });

      it("emits agent.rejected when registration fails due to duplicate", () => {
        const emit = vi.fn();
        const reg = new AgentRegistry({ emit });
        const agent = makeAgent("duplicate-agent");

        reg.register(agent);
        emit.mockClear();

        expect(() => reg.register(agent)).toThrow(AgentAlreadyRegisteredError);
        expect(emit).toHaveBeenCalledWith(
          "agent.rejected",
          expect.objectContaining({
            agent: "duplicate-agent",
            allowedTiers: ["medium"],
            reason: "already_registered",
          }),
        );
      });
    });
  });

  describe("get", () => {
    it("returns the registered agent by name", () => {
      const reg = new AgentRegistry();
      const coder = makeAgent("coder");
      reg.register(coder);
      expect(reg.get("coder")).toBe(coder);
    });

    it("throws AgentNotFoundError for unknown name", () => {
      const reg = new AgentRegistry();
      expect(() => reg.get("unknown")).toThrow(AgentNotFoundError);
    });

    it("AgentNotFoundError message includes the missing name", () => {
      const reg = new AgentRegistry();
      expect(() => reg.get("unknown")).toThrow(/unknown/);
    });
  });

  describe("getByName", () => {
    it("is an alias for get()", () => {
      const reg = new AgentRegistry();
      const coder = makeAgent("coder");
      reg.register(coder);
      expect(reg.getByName("coder")).toBe(reg.get("coder"));
    });

    it("throws AgentNotFoundError for unknown name", () => {
      const reg = new AgentRegistry();
      expect(() => reg.getByName("unknown")).toThrow(AgentNotFoundError);
    });
  });

  describe("list", () => {
    it("returns empty array when no agents registered", () => {
      const reg = new AgentRegistry();
      expect(reg.list()).toEqual([]);
    });

    it("returns metadata for all registered agents when no domain filter", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder", "coding"));
      reg.register(makeAgent("reviewer", "review"));
      expect(reg.list()).toHaveLength(2);
    });

    it("filters by domain", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder", "coding"));
      reg.register(makeAgent("reviewer", "review"));
      reg.register(makeAgent("tester", "review"));
      const review = reg.list("review");
      expect(review).toHaveLength(2);
      expect(review.every((m) => m.capabilities.primary === "review")).toBe(true);
    });

    it("returns empty array when no agents match domain", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder", "coding"));
      expect(reg.list("planning")).toEqual([]);
    });

    it("returns metadata only, not full agent objects", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      const [item] = reg.list();
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty("execute");
      expect(item).toHaveProperty("name", "coder");
    });

    it("filters by tier constraint", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("light", "coding", ["light"]));
      reg.register(makeAgent("medium", "coding", ["medium"]));
      reg.register(makeAgent("heavy", "coding", ["heavy"]));

      const maxMedium = reg.list(undefined, { type: "max", value: "medium" });
      expect(maxMedium).toHaveLength(2);
      expect(maxMedium.map((m) => m.allowedTiers[0]).sort()).toEqual(["light", "medium"]);
    });

    it("combines domain and tier filters", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("heavy-code", "coding", ["heavy"]));
      reg.register(makeAgent("medium-code", "coding", ["medium"]));
      reg.register(makeAgent("medium-review", "review", ["medium"]));

      const result = reg.list("coding", { type: "max", value: "medium" });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("medium-code");
    });

    it("uses default tier constraint when provided", () => {
      const reg = new AgentRegistry({
        defaultTierConstraint: { type: "max", value: "medium" },
      });
      reg.register(makeAgent("light", "coding", ["light"]));
      reg.register(makeAgent("medium", "coding", ["medium"]));
      reg.register(makeAgent("heavy", "coding", ["heavy"]));

      const result = reg.list();
      expect(result).toHaveLength(2);
    });
  });

  describe("listByModelAttribute", () => {
    it("returns empty array when no agents registered", () => {
      const reg = new AgentRegistry();
      expect(reg.listByModelAttribute("agentic")).toEqual([]);
    });

    it("returns agents with matching model attribute", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("agent1", "coding", ["medium"], ["agentic"]));
      reg.register(makeAgent("agent2", "coding", ["medium"], ["reasoning"]));
      reg.register(makeAgent("agent3", "coding", ["medium"], ["agentic", "quality"]));

      const agenticAgents = reg.listByModelAttribute("agentic");
      expect(agenticAgents).toHaveLength(2);
      expect(agenticAgents.map((m) => m.name).sort()).toEqual(["agent1", "agent3"]);
    });

    it("returns empty array when no agents match model attribute", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("agent1", "coding", ["medium"], ["reasoning"]));
      expect(reg.listByModelAttribute("agentic")).toEqual([]);
    });

    it("filters by tier constraint", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("light-ai", "coding", ["light"], ["agentic"]));
      reg.register(makeAgent("medium-ai", "coding", ["medium"], ["agentic"]));
      reg.register(makeAgent("heavy-ai", "coding", ["heavy"], ["agentic"]));

      const result = reg.listByModelAttribute("agentic", { type: "max", value: "medium" });
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.allowedTiers[0]).sort()).toEqual(["light", "medium"]);
    });

    it("uses default tier constraint when provided", () => {
      const reg = new AgentRegistry({
        defaultTierConstraint: { type: "exact", value: "light" },
      });
      reg.register(makeAgent("light-ai", "coding", ["light"], ["agentic"]));
      reg.register(makeAgent("medium-ai", "coding", ["medium"], ["agentic"]));

      const result = reg.listByModelAttribute("agentic");
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("light-ai");
    });
  });

  describe("listByTier", () => {
    it("returns empty array when no agents registered", () => {
      const reg = new AgentRegistry();
      expect(reg.listByTier("heavy")).toEqual([]);
    });

    it("returns agents matching exact tier", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("heavy1", "coding", ["heavy"]));
      reg.register(makeAgent("heavy2", "review", ["heavy"]));
      reg.register(makeAgent("medium1", "coding", ["medium"]));

      const heavyAgents = reg.listByTier("heavy");
      expect(heavyAgents).toHaveLength(2);
      expect(heavyAgents.every((m) => m.allowedTiers.includes("heavy"))).toBe(true);
    });

    it("returns empty array when no agents match tier", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("medium1", "coding", ["medium"]));
      expect(reg.listByTier("heavy")).toEqual([]);
    });

    it("returns metadata only, not full agent objects", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("heavy1", "coding", ["heavy"]));
      const [item] = reg.listByTier("heavy");
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty("execute");
      expect(item?.allowedTiers).toContain("heavy");
    });
  });

  describe("search", () => {
    it("returns empty array for empty query", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      expect(reg.search("")).toEqual([]);
    });

    it("returns empty array when no agents match", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      expect(reg.search("xyznonexistent")).toEqual([]);
    });

    it("returns scored results for matching query", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      const results = reg.search("coder");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("agent");
      expect(results[0]).toHaveProperty("score");
    });

    it("matches against agent name", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("code-writer"));
      reg.register(makeAgent("reviewer"));
      const results = reg.search("code-writer");
      expect(results.some((r) => r.agent.name === "code-writer")).toBe(true);
    });

    it("matches against capabilities", () => {
      const agent: Agent = {
        metadata: {
          name: "specialist",
          description: "does things",
          allowedTiers: ["light"],
          capabilities: {
            primary: "utility",
            specialization: ["formatting", "linting"],
            modelAttributes: ["speed"],
          },
        },
        execute: () => Promise.resolve({ success: true, output: "", toolCalls: 0, tokensUsed: 0 }),
      };
      const reg = new AgentRegistry();
      reg.register(agent);
      const results = reg.search("formatting");
      expect(results.some((r) => r.agent.name === "specialist")).toBe(true);
    });

    it("returns results sorted descending by score", () => {
      const reg = new AgentRegistry();
      const highMatch: Agent = {
        metadata: {
          name: "code-master",
          description: "code code code",
          allowedTiers: ["heavy"],
          capabilities: {
            primary: "coding",
            specialization: ["code", "write", "implement"],
            modelAttributes: ["reasoning", "agentic"],
          },
        },
        execute: () => Promise.resolve({ success: true, output: "", toolCalls: 0, tokensUsed: 0 }),
      };
      const lowMatch = makeAgent("other-agent", "review");
      reg.register(highMatch);
      reg.register(lowMatch);
      const results = reg.search("code write implement");
      expect(results.length).toBeGreaterThan(0);
      if (results.length > 1) {
        const first = results[0];
        const second = results[1];
        if (first && second) {
          expect(first.score).toBeGreaterThanOrEqual(second.score);
        }
      }
    });

    it("filters by tier constraint", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("heavy-code", "coding", ["heavy"]));
      reg.register(makeAgent("medium-code", "coding", ["medium"]));

      const results = reg.search("code", { type: "max", value: "medium" });
      expect(results).toHaveLength(1);
      expect(results[0]?.agent.allowedTiers).toContain("medium");
    });

    it("uses default tier constraint when provided", () => {
      const reg = new AgentRegistry({
        defaultTierConstraint: { type: "exact", value: "light" },
      });
      reg.register(makeAgent("light-code", "coding", ["light"]));
      reg.register(makeAgent("heavy-code", "coding", ["heavy"]));

      const results = reg.search("code");
      expect(results).toHaveLength(1);
      expect(results[0]?.agent.name).toBe("light-code");
    });
  });

  describe("has", () => {
    it("returns false for unregistered name", () => {
      const reg = new AgentRegistry();
      expect(reg.has("coder")).toBe(false);
    });

    it("returns true after registration", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      expect(reg.has("coder")).toBe(true);
    });
  });

  describe("size", () => {
    it("is 0 initially", () => {
      const reg = new AgentRegistry();
      expect(reg.size).toBe(0);
    });

    it("increments with each registration", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder"));
      expect(reg.size).toBe(1);
      reg.register(makeAgent("reviewer"));
      expect(reg.size).toBe(2);
    });
  });
});
