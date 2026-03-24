import { describe, expect, it, vi } from "vitest";
import type { SkillManifest } from "../skills/types.js";
import { SkillRouter } from "../skills/router.js";
import type { SkillRouterProvider } from "../skills/router.js";

function makeSkill(id: string, tags: string[] = []): SkillManifest {
  return {
    id,
    name: id,
    description: `Skill ${id}`,
    version: "1.0.0",
    family: "reasoning",
    tags,
    tools: [],
    references: [],
    examples: [],
    scope: "workspace",
    inherits: [],
    diskPath: `/tmp/${id}`,
    skillMdPath: `/tmp/${id}/SKILL.md`,
  };
}

function makeMockProvider(response: string): SkillRouterProvider {
  return { complete: vi.fn().mockResolvedValue(response) };
}

describe("SkillRouter", () => {
  const skills = [
    makeSkill("code-review", ["review", "quality"]),
    makeSkill("web-research", ["search", "web"]),
    makeSkill("refactor", ["refactoring", "code"]),
    makeSkill("test-writer", ["testing", "quality"]),
    makeSkill("planner", ["planning"]),
  ];

  describe("route — basic selection", () => {
    it("returns an empty array when no skills are available", async () => {
      const provider = makeMockProvider("[]");
      const router = new SkillRouter(provider);
      const result = await router.route("do something", "code-write", "agent-1", []);
      expect(result).toEqual([]);
    });

    it("calls the provider with a prompt containing the task info", async () => {
      const provider = makeMockProvider('["code-review"]');
      const router = new SkillRouter(provider);

      await router.route("review this PR", "code-review", "agent-1", skills);

      expect(provider.complete).toHaveBeenCalledOnce();
      const calls = (provider.complete as ReturnType<typeof vi.fn>).mock.calls;
      const prompt = calls[0]?.[0] as string | undefined;
      expect(prompt).toBeDefined();
      expect(prompt).toContain("review this PR");
      expect(prompt).toContain("code-review");
    });

    it("returns up to 3 skills selected by the LLM", async () => {
      const provider = makeMockProvider('["code-review", "refactor", "test-writer", "planner"]');
      const router = new SkillRouter(provider);

      const result = await router.route("refactor and test", "refactoring", "agent-1", skills);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("filters out LLM-returned IDs that are not in the available skills", async () => {
      const provider = makeMockProvider('["nonexistent-skill", "code-review"]');
      const router = new SkillRouter(provider);

      const result = await router.route("review code", "code-review", "agent-1", skills);

      const ids = result.map((s) => s.id);
      expect(ids).not.toContain("nonexistent-skill");
      expect(ids).toContain("code-review");
    });

    it("returns resolved SkillManifest objects (not bare IDs)", async () => {
      const provider = makeMockProvider('["web-research"]');
      const router = new SkillRouter(provider);

      const result = await router.route("find docs", "research", "agent-1", skills);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("web-research");
      expect(result[0]!.name).toBe("web-research");
    });
  });

  describe("route — LRU caching", () => {
    it("uses the LLM on first call and caches the result", async () => {
      const provider = makeMockProvider('["code-review"]');
      const router = new SkillRouter(provider);

      await router.route("task 1", "code-write", "agent-1", skills);

      expect(provider.complete).toHaveBeenCalledTimes(1);
    });

    it("hits the cache on identical (taskType, agentId) and skips LLM", async () => {
      const provider = makeMockProvider('["code-review"]');
      const router = new SkillRouter(provider);

      const first = await router.route("task 1", "code-write", "agent-1", skills);
      const second = await router.route("different task desc", "code-write", "agent-1", skills);

      expect(provider.complete).toHaveBeenCalledTimes(1);
      expect(first.map((s) => s.id)).toEqual(second.map((s) => s.id));
    });

    it("uses different cache entries for different agentId", async () => {
      const provider = makeMockProvider('["code-review"]');
      const router = new SkillRouter(provider);

      await router.route("task", "code-write", "agent-1", skills);
      await router.route("task", "code-write", "agent-2", skills);

      expect(provider.complete).toHaveBeenCalledTimes(2);
    });

    it("uses different cache entries for different taskType", async () => {
      const provider = makeMockProvider('["code-review"]');
      const router = new SkillRouter(provider);

      await router.route("task", "code-write", "agent-1", skills);
      await router.route("task", "review", "agent-1", skills);

      expect(provider.complete).toHaveBeenCalledTimes(2);
    });

    it("evicts least-recently-used when cache capacity is exceeded", async () => {
      const provider = makeMockProvider('["code-review"]');
      const router = new SkillRouter(provider, { cacheCapacity: 2 });

      await router.route("task", "type-A", "agent-1", skills);
      await router.route("task", "type-B", "agent-1", skills);
      await router.route("task", "type-C", "agent-1", skills);
      await router.route("task", "type-A", "agent-1", skills);

      expect(provider.complete).toHaveBeenCalledTimes(4);
    });
  });

  describe("route — timeout / fallback", () => {
    it("falls back to tag-based selection when the LLM times out", async () => {
      const provider: SkillRouterProvider = {
        complete: vi.fn().mockImplementation(
          () =>
            new Promise<string>((resolve) => {
              setTimeout(() => resolve('["code-review"]'), 5_000);
            }),
        ),
      };

      const router = new SkillRouter(provider, { timeoutMs: 10 });

      const result = await router.route("review code quality", "review", "agent-1", skills);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("falls back to tag-based selection when the LLM throws", async () => {
      const provider: SkillRouterProvider = {
        complete: vi.fn().mockRejectedValue(new Error("LLM unavailable")),
      };

      const router = new SkillRouter(provider);

      const result = await router.route("plan the sprint", "planning", "agent-1", skills);

      expect(Array.isArray(result)).toBe(true);
    });

    it("falls back gracefully when LLM returns invalid JSON", async () => {
      const provider = makeMockProvider("I cannot answer that.");
      const router = new SkillRouter(provider);

      const result = await router.route("some task", "code-write", "agent-1", skills);

      expect(Array.isArray(result)).toBe(true);
    });

    it("falls back gracefully when LLM returns a JSON object instead of array", async () => {
      const provider = makeMockProvider('{"skills": ["code-review"]}');
      const router = new SkillRouter(provider);

      const result = await router.route("some task", "code-write", "agent-1", skills);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("route — maxSkills option", () => {
    it("respects a custom maxSkills limit", async () => {
      const provider = makeMockProvider(
        '["code-review", "web-research", "refactor", "test-writer", "planner"]',
      );
      const router = new SkillRouter(provider, { maxSkills: 2 });

      const result = await router.route("do everything", "all", "agent-1", skills);

      expect(result.length).toBeLessThanOrEqual(2);
    });
  });
});
