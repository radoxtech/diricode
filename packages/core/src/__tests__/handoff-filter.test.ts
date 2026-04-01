import { describe, expect, test, vi } from "vitest";
import type { AgentContext, ContextInheritanceRules } from "@diricode/core";
import {
  DEFAULT_FILTER_POLICIES,
  createFilterPolicyForCategory,
  filterContextForHandoff,
  mergeFilterPolicies,
} from "@diricode/core";
import type { ContextFilterPolicy } from "@diricode/core";

const mockEmit = vi.fn();

const mockContext: AgentContext = {
  workspaceRoot: "/test/workspace",
  sessionId: "session-123",
  tools: [],
  emit: mockEmit,
};

const mockRules: ContextInheritanceRules = {
  mode: "summary",
  includeHistory: true,
};

describe("DC-CORE-016: Handoff Input Filtering", () => {
  describe("Default Filter Policies", () => {
    test("research agents receive conversation history and decisions", () => {
      const policy = DEFAULT_FILTER_POLICIES.research;

      expect(policy.includeCategories).toContain("conversation-history");
      expect(policy.includeCategories).toContain("decisions");
      expect(policy.excludeCategories).toHaveLength(0);
    });

    test("utility agents receive minimal context", () => {
      const policy = DEFAULT_FILTER_POLICIES.utility;

      expect(policy.includeCategories).toContain("constraints");
      expect(policy.excludeCategories).toContain("tool-results");
      expect(policy.excludeCategories).toContain("conversation-history");
      expect(policy.excludeCategories).toContain("decisions");
    });

    test("code agents receive file state and artifacts", () => {
      const policy = DEFAULT_FILTER_POLICIES.code;

      expect(policy.includeCategories).toContain("file-state");
      expect(policy.includeCategories).toContain("artifacts");
      expect(policy.includeCategories).toContain("constraints");
      expect(policy.excludeCategories).toContain("memory-state");
    });

    test("quality agents receive tool results and file state", () => {
      const policy = DEFAULT_FILTER_POLICIES.quality;

      expect(policy.includeCategories).toContain("tool-results");
      expect(policy.includeCategories).toContain("file-state");
      expect(policy.includeCategories).toContain("decisions");
    });
  });

  describe("createFilterPolicyForCategory", () => {
    test("returns correct policy for known category", () => {
      const policy = createFilterPolicyForCategory("research");

      expect(policy).toEqual(DEFAULT_FILTER_POLICIES.research);
    });

    test("applies overrides correctly", () => {
      const policy = createFilterPolicyForCategory("code", {
        includeWorkspaceState: false,
      });

      expect(policy.includeWorkspaceState).toBe(false);
      expect(policy.includeCategories).toEqual(DEFAULT_FILTER_POLICIES.code.includeCategories);
    });
  });

  describe("filterContextForHandoff", () => {
    test("isolated mode removes all optional context", () => {
      const policy = createFilterPolicyForCategory("research");
      const isolatedRules: ContextInheritanceRules = { mode: "isolated" };

      const result = filterContextForHandoff(mockContext, isolatedRules, policy, "research");

      expect(result.filteredContext.summary).toContain("session-123");
      expect(result.metadata.filteredCategories.length).toBeGreaterThan(0);
    });

    test("summary mode preserves basic context", () => {
      const policy = createFilterPolicyForCategory("code");
      const rulesWithFiles: ContextInheritanceRules = {
        ...mockRules,
        includeFiles: ["/test/file.ts"],
      };

      const result = filterContextForHandoff(mockContext, rulesWithFiles, policy, "code");

      expect(result.filteredContext.summary).toBeDefined();
      expect(result.metadata.filteredCategories).toBeDefined();
      expect(result.metadata.filteredCount).toBeGreaterThanOrEqual(0);
    });

    test("returns filter metadata for observability", () => {
      const policy = createFilterPolicyForCategory("research");
      const result = filterContextForHandoff(mockContext, mockRules, policy, "research");

      expect(result.metadata).toHaveProperty("filteredCategories");
      expect(result.metadata).toHaveProperty("filteredCount");
      expect(result.metadata).toHaveProperty("estimatedTokensSaved");
      expect(result.metadata).toHaveProperty("timestamp");
    });

    test("research category preserves tool results and history", () => {
      const policy = DEFAULT_FILTER_POLICIES.research;

      const result = filterContextForHandoff(mockContext, mockRules, policy, "research");

      // Research should NOT filter out tool-results or conversation-history
      expect(result.metadata.filteredCategories).not.toContain("tool-results");
      expect(result.metadata.filteredCategories).not.toContain("conversation-history");
    });

    test("utility category filters out most context", () => {
      const policy = DEFAULT_FILTER_POLICIES.utility;

      const result = filterContextForHandoff(mockContext, mockRules, policy, "utility");

      // Utility should filter out most things
      expect(result.metadata.filteredCategories.length).toBeGreaterThan(0);
    });
  });

  describe("mergeFilterPolicies", () => {
    test("merges base and override policies", () => {
      const base: ContextFilterPolicy = {
        includeCategories: ["constraints", "decisions"],
        excludeCategories: ["tool-results"],
        includeWorkspaceState: true,
        includeToolHistory: false,
      };

      const merged = mergeFilterPolicies(base, {
        includeWorkspaceState: false,
        includeCategories: ["constraints", "artifacts"],
      });

      expect(merged.includeWorkspaceState).toBe(false);
      expect(merged.includeCategories).toEqual(["constraints", "artifacts"]);
      expect(merged.excludeCategories).toEqual(["tool-results"]);
    });

    test("uses base values when override is undefined", () => {
      const base: ContextFilterPolicy = {
        includeCategories: ["constraints"],
        excludeCategories: ["tool-results"],
        includeWorkspaceState: true,
        includeToolHistory: false,
      };

      const merged = mergeFilterPolicies(base, {});

      expect(merged.includeCategories).toEqual(["constraints"]);
      expect(merged.excludeCategories).toEqual(["tool-results"]);
      expect(merged.includeWorkspaceState).toBe(true);
    });
  });
});
