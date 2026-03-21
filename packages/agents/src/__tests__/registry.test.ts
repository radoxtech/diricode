import { describe, expect, it } from "vitest";
import { AgentAlreadyRegisteredError, AgentNotFoundError, AgentRegistry } from "../index.js";
import type { Agent, AgentContext, AgentResult } from "../index.js";

function makeAgent(name: string, category: Agent["metadata"]["category"] = "code"): Agent {
  return {
    metadata: {
      name,
      description: `${name} agent`,
      tier: "medium",
      category,
      capabilities: [name, "test"],
      tags: ["test"],
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
      }
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
