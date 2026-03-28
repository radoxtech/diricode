import { describe, expect, it, vi, beforeEach } from "vitest";
import { PromptCache } from "../agents/prompt-cache.js";
import { PromptBuilder } from "../agents/prompt-builder.js";
import type { AgentMetadata, Tool } from "../index.js";

function makeMetadata(overrides?: Partial<AgentMetadata>): AgentMetadata {
  return {
    name: "test-agent",
    description: "A test agent for unit testing",
    tier: "medium",
    category: "code",
    capabilities: ["file-read", "file-write"],
    tags: ["test"],
    ...overrides,
  };
}

function makeTool(name: string, description = `${name} tool`): Tool {
  return {
    name,
    description,
    parameters: { parse: (v: unknown) => v } as Tool["parameters"],
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    execute: async () => {
      await Promise.resolve();
      return { success: true, data: {} };
    },
  };
}

describe("PromptCache", () => {
  describe("constructor", () => {
    it("creates with default TTL", () => {
      const cache = new PromptCache();
      expect(cache).toBeDefined();
      expect(cache.size).toBe(0);
    });

    it("accepts custom TTL", () => {
      const cache = new PromptCache({ ttlMs: 60_000 });
      expect(cache).toBeDefined();
    });
  });

  describe("get", () => {
    it("returns undefined for cache miss", () => {
      const cache = new PromptCache();
      const result = cache.get("agent", "/workspace", "medium");
      expect(result).toBeUndefined();
    });

    it("returns cached entry for cache hit within TTL", () => {
      const cache = new PromptCache({ ttlMs: 60_000 });
      cache.set("agent", "/workspace", "medium", {
        systemPrompt: "You are an agent.",
        tokenEstimate: 10,
      });
      const result = cache.get("agent", "/workspace", "medium");
      expect(result).toBeDefined();
      expect(result?.systemPrompt).toBe("You are an agent.");
      expect(result?.tokenEstimate).toBe(10);
    });

    it("evicts and returns undefined for expired entry", () => {
      vi.useFakeTimers();
      const cache = new PromptCache({ ttlMs: 1_000 });
      cache.set("agent", "/workspace", "medium", {
        systemPrompt: "You are an agent.",
        tokenEstimate: 10,
      });
      expect(cache.size).toBe(1);

      vi.advanceTimersByTime(1_001);

      const result = cache.get("agent", "/workspace", "medium");
      expect(result).toBeUndefined();
      expect(cache.size).toBe(0);
      vi.useRealTimers();
    });
  });

  describe("set", () => {
    it("stores entry with cachedAt timestamp", () => {
      vi.useFakeTimers();
      const now = Date.now();
      const cache = new PromptCache();
      cache.set("agent", "/workspace", "medium", {
        systemPrompt: "System prompt",
        tokenEstimate: 25,
      });
      const entry = cache.get("agent", "/workspace", "medium");
      expect(entry).toBeDefined();
      expect(entry?.cachedAt).toBe(now);
      vi.useRealTimers();
    });

    it("overwrites existing entry", () => {
      const cache = new PromptCache();
      cache.set("agent", "/workspace", "medium", {
        systemPrompt: "First prompt",
        tokenEstimate: 10,
      });
      cache.set("agent", "/workspace", "medium", {
        systemPrompt: "Second prompt",
        tokenEstimate: 20,
      });
      expect(cache.size).toBe(1);
      const entry = cache.get("agent", "/workspace", "medium");
      expect(entry?.systemPrompt).toBe("Second prompt");
      expect(entry?.tokenEstimate).toBe(20);
    });
  });

  describe("invalidate", () => {
    it("removes a specific entry", () => {
      const cache = new PromptCache();
      cache.set("agent", "/workspace", "medium", { systemPrompt: "sp", tokenEstimate: 5 });
      expect(cache.size).toBe(1);
      cache.invalidate("agent", "/workspace", "medium");
      expect(cache.size).toBe(0);
      expect(cache.get("agent", "/workspace", "medium")).toBeUndefined();
    });

    it("no-ops for non-existent key", () => {
      const cache = new PromptCache();
      expect(() => {
        cache.invalidate("nobody", "/nowhere", "light");
      }).not.toThrow();
      expect(cache.size).toBe(0);
    });
  });

  describe("invalidateWorkspace", () => {
    it("removes all entries for a workspace", () => {
      const cache = new PromptCache();
      cache.set("agent-a", "/workspace", "medium", { systemPrompt: "sp-a", tokenEstimate: 5 });
      cache.set("agent-b", "/workspace", "heavy", { systemPrompt: "sp-b", tokenEstimate: 10 });
      expect(cache.size).toBe(2);
      cache.invalidateWorkspace("/workspace");
      expect(cache.size).toBe(0);
    });

    it("keeps entries for other workspaces", () => {
      const cache = new PromptCache();
      cache.set("agent", "/workspace-a", "medium", { systemPrompt: "sp-a", tokenEstimate: 5 });
      cache.set("agent", "/workspace-b", "medium", { systemPrompt: "sp-b", tokenEstimate: 5 });
      expect(cache.size).toBe(2);
      cache.invalidateWorkspace("/workspace-a");
      expect(cache.size).toBe(1);
      expect(cache.get("agent", "/workspace-b", "medium")).toBeDefined();
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      const cache = new PromptCache();
      cache.set("agent-a", "/ws", "medium", { systemPrompt: "sp", tokenEstimate: 5 });
      cache.set("agent-b", "/ws", "heavy", { systemPrompt: "sp2", tokenEstimate: 10 });
      expect(cache.size).toBe(2);
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe("size", () => {
    it("returns correct count", () => {
      const cache = new PromptCache();
      expect(cache.size).toBe(0);
      cache.set("a", "/ws", "light", { systemPrompt: "s", tokenEstimate: 1 });
      expect(cache.size).toBe(1);
      cache.set("b", "/ws", "medium", { systemPrompt: "s", tokenEstimate: 1 });
      expect(cache.size).toBe(2);
      cache.invalidate("a", "/ws", "light");
      expect(cache.size).toBe(1);
    });
  });

  describe("computeKey (via get/set roundtrip)", () => {
    it("produces consistent hash for same inputs", () => {
      const cache = new PromptCache();
      cache.set("agent", "/workspace", "heavy", { systemPrompt: "sp", tokenEstimate: 5 });
      const first = cache.get("agent", "/workspace", "heavy");
      const second = cache.get("agent", "/workspace", "heavy");
      expect(first).toEqual(second);
    });

    it("produces different hashes for different inputs", () => {
      const cache = new PromptCache();
      cache.set("agent-a", "/workspace", "medium", { systemPrompt: "sp-a", tokenEstimate: 5 });
      cache.set("agent-b", "/workspace", "medium", { systemPrompt: "sp-b", tokenEstimate: 5 });
      expect(cache.size).toBe(2);
      expect(cache.get("agent-a", "/workspace", "medium")?.systemPrompt).toBe("sp-a");
      expect(cache.get("agent-b", "/workspace", "medium")?.systemPrompt).toBe("sp-b");
    });
  });
});

describe("PromptBuilder with PromptCache", () => {
  let cache: PromptCache;

  beforeEach(() => {
    cache = new PromptCache();
  });

  it("withPromptCache returns this for chaining", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata() });
    const ret = pb.withPromptCache(cache);
    expect(ret).toBe(pb);
  });

  it("cache miss: builds and stores system prompt", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata(), workspaceRoot: "/proj" });
    pb.withPromptCache(cache);

    expect(cache.size).toBe(0);
    const result = pb.build("hello", []);
    expect(cache.size).toBe(1);
    expect(result.systemPrompt).toContain("test-agent");

    const cached = cache.get("test-agent", "/proj", "medium");
    expect(cached).toBeDefined();
    expect(cached?.systemPrompt).toBe(result.systemPrompt);
  });

  it("cache hit: returns cached system prompt without rebuilding", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata(), workspaceRoot: "/proj" });
    pb.withPromptCache(cache);

    const first = pb.build("first call", []);
    const second = pb.build("second call", []);

    expect(first.systemPrompt).toBe(second.systemPrompt);
    expect(cache.size).toBe(1);
  });

  it("dynamic context (files): bypasses cache", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata(), workspaceRoot: "/proj" });
    pb.withPromptCache(cache).injectFiles([{ path: "x.ts", content: "const x = 1;" }]);

    pb.build("hello", []);
    expect(cache.size).toBe(0);
  });

  it("dynamic context (history): bypasses cache", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata(), workspaceRoot: "/proj" });
    pb.withPromptCache(cache).injectHistory([{ role: "user", content: "prev", timestamp: 0 }]);

    pb.build("hello", []);
    expect(cache.size).toBe(0);
  });

  it("dynamic context (repoMap): bypasses cache", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata(), workspaceRoot: "/proj" });
    pb.withPromptCache(cache).injectRepoMap({ rootPath: "/proj", files: [] });

    pb.build("hello", []);
    expect(cache.size).toBe(0);
  });

  it("dynamic context (plan): bypasses cache", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata(), workspaceRoot: "/proj" });
    pb.withPromptCache(cache).injectPlan({
      tasks: [{ id: "t1", description: "do thing", status: "pending" }],
    });

    pb.build("hello", []);
    expect(cache.size).toBe(0);
  });

  it("without cache: works exactly as before", () => {
    const pb = new PromptBuilder({ metadata: makeMetadata() });
    pb.bindTools([makeTool("read")], ["read"]);
    const result = pb.build("write a function", []);
    expect(result.systemPrompt).toContain("test-agent");
    expect(result.userMessage).toBe("write a function");
    expect(result.toolsSection).toContain("read");
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });
});
