import { describe, expect, it, vi } from "vitest";
import { AgentAlreadyRegisteredError, AgentNotFoundError, AgentRegistry } from "../index.js";
import type { Agent, AgentContext, AgentResult, AgentTier } from "../index.js";

function makeAgent(
  name: string,
  category: Agent["metadata"]["category"] = "code",
  tier: AgentTier = "medium",
  tags: string[] = ["test"],
): Agent {
  return {
    metadata: {
      name,
      description: `${name} agent`,
      tier,
      category,
      capabilities: [name, "test"],
      tags,
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
        const agent = makeAgent("test-agent", "code", "heavy", ["ai", "code"]);

        reg.register(agent);

        expect(emit).toHaveBeenCalledWith("agent.registered", {
          agent: "test-agent",
          tier: "heavy",
          category: "code",
          tags: ["ai", "code"],
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
            tier: "medium",
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

    it("returns metadata for all registered agents when no category filter", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder", "code"));
      reg.register(makeAgent("reviewer", "quality"));
      expect(reg.list()).toHaveLength(2);
    });

    it("filters by category", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder", "code"));
      reg.register(makeAgent("reviewer", "quality"));
      reg.register(makeAgent("tester", "quality"));
      const quality = reg.list("quality");
      expect(quality).toHaveLength(2);
      expect(quality.every((m) => m.category === "quality")).toBe(true);
    });

    it("returns empty array when no agents match category", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("coder", "code"));
      expect(reg.list("strategy")).toEqual([]);
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
      reg.register(makeAgent("light", "code", "light"));
      reg.register(makeAgent("medium", "code", "medium"));
      reg.register(makeAgent("heavy", "code", "heavy"));

      const maxMedium = reg.list(undefined, { type: "max", value: "medium" });
      expect(maxMedium).toHaveLength(2);
      expect(maxMedium.map((m) => m.tier).sort()).toEqual(["light", "medium"]);
    });

    it("combines category and tier filters", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("heavy-code", "code", "heavy"));
      reg.register(makeAgent("medium-code", "code", "medium"));
      reg.register(makeAgent("medium-quality", "quality", "medium"));

      const result = reg.list("code", { type: "max", value: "medium" });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe("medium-code");
    });

    it("uses default tier constraint when provided", () => {
      const reg = new AgentRegistry({
        defaultTierConstraint: { type: "max", value: "medium" },
      });
      reg.register(makeAgent("light", "code", "light"));
      reg.register(makeAgent("medium", "code", "medium"));
      reg.register(makeAgent("heavy", "code", "heavy"));

      const result = reg.list();
      expect(result).toHaveLength(2);
    });
  });

  describe("listByTag", () => {
    it("returns empty array when no agents registered", () => {
      const reg = new AgentRegistry();
      expect(reg.listByTag("ai")).toEqual([]);
    });

    it("returns agents with matching tag", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("agent1", "code", "medium", ["ai", "code"]));
      reg.register(makeAgent("agent2", "code", "medium", ["code"]));
      reg.register(makeAgent("agent3", "code", "medium", ["ai", "research"]));

      const aiAgents = reg.listByTag("ai");
      expect(aiAgents).toHaveLength(2);
      expect(aiAgents.map((m) => m.name).sort()).toEqual(["agent1", "agent3"]);
    });

    it("returns empty array when no agents match tag", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("agent1", "code", "medium", ["code"]));
      expect(reg.listByTag("ai")).toEqual([]);
    });

    it("filters by tier constraint", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("light-ai", "code", "light", ["ai"]));
      reg.register(makeAgent("medium-ai", "code", "medium", ["ai"]));
      reg.register(makeAgent("heavy-ai", "code", "heavy", ["ai"]));

      const result = reg.listByTag("ai", { type: "max", value: "medium" });
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.tier).sort()).toEqual(["light", "medium"]);
    });

    it("uses default tier constraint when provided", () => {
      const reg = new AgentRegistry({
        defaultTierConstraint: { type: "exact", value: "light" },
      });
      reg.register(makeAgent("light-ai", "code", "light", ["ai"]));
      reg.register(makeAgent("medium-ai", "code", "medium", ["ai"]));

      const result = reg.listByTag("ai");
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
      reg.register(makeAgent("heavy1", "code", "heavy"));
      reg.register(makeAgent("heavy2", "quality", "heavy"));
      reg.register(makeAgent("medium1", "code", "medium"));

      const heavyAgents = reg.listByTier("heavy");
      expect(heavyAgents).toHaveLength(2);
      expect(heavyAgents.every((m) => m.tier === "heavy")).toBe(true);
    });

    it("returns empty array when no agents match tier", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("medium1", "code", "medium"));
      expect(reg.listByTier("heavy")).toEqual([]);
    });

    it("returns metadata only, not full agent objects", () => {
      const reg = new AgentRegistry();
      reg.register(makeAgent("heavy1", "code", "heavy"));
      const [item] = reg.listByTier("heavy");
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty("execute");
      expect(item).toHaveProperty("tier", "heavy");
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
          tier: "light",
          category: "utility",
          capabilities: ["formatting", "linting"],
          tags: [],
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
          tier: "heavy",
          category: "code",
          capabilities: ["code", "write", "implement"],
          tags: ["code"],
        },
        execute: () => Promise.resolve({ success: true, output: "", toolCalls: 0, tokensUsed: 0 }),
      };
      const lowMatch = makeAgent("other-agent", "quality");
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
      reg.register(makeAgent("heavy-code", "code", "heavy"));
      reg.register(makeAgent("medium-code", "code", "medium"));

      const results = reg.search("code", { type: "max", value: "medium" });
      expect(results).toHaveLength(1);
      expect(results[0]?.agent.tier).toBe("medium");
    });

    it("uses default tier constraint when provided", () => {
      const reg = new AgentRegistry({
        defaultTierConstraint: { type: "exact", value: "light" },
      });
      reg.register(makeAgent("light-code", "code", "light"));
      reg.register(makeAgent("heavy-code", "code", "heavy"));

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
