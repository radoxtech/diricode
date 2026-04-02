import Database from "better-sqlite3";
import { describe, it, expect, beforeEach } from "vitest";
import { migration010 } from "../db/migrations/010_issues.js";
import { initSchemaVersions } from "../db/schema/version.js";
import { IssueRepository } from "../db/repositories/IssueRepository.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initSchemaVersions(db);
  migration010.up(db);
  return db;
}

describe("IssueRepository", () => {
  let db: Database.Database;
  let repo: IssueRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new IssueRepository(db);
  });

  describe("createIssue + getIssue roundtrip", () => {
    it("creates and retrieves an issue with all fields", () => {
      const issue = repo.createIssue({
        id: "ISS-001",
        title: "Fix authentication bug",
        description: "Users cannot login with valid credentials",
        priority: "high",
        labels: ["bug", "auth"],
      });

      expect(issue.id).toBe("ISS-001");
      expect(issue.title).toBe("Fix authentication bug");
      expect(issue.description).toBe("Users cannot login with valid credentials");
      expect(issue.status).toBe("open");
      expect(issue.priority).toBe("high");
      expect(issue.labels).toEqual(["bug", "auth"]);
      expect(issue.parentId).toBeNull();
      expect(issue.createdAt).toBeDefined();
      expect(issue.updatedAt).toBeDefined();
    });

    it("creates issue with default priority when not specified", () => {
      const issue = repo.createIssue({
        id: "ISS-002",
        title: "Add dark mode",
        priority: "medium",
        labels: [],
      });

      expect(issue.priority).toBe("medium");
    });

    it("returns undefined for non-existent issue", () => {
      const issue = repo.getIssue("non-existent");
      expect(issue).toBeUndefined();
    });

    it("creates issue with null description when not provided", () => {
      const issue = repo.createIssue({
        id: "ISS-003",
        title: "No description issue",
        priority: "low",
        labels: [],
      });

      expect(issue.description).toBeNull();
    });
  });

  describe("updateIssue", () => {
    it("updates title", () => {
      repo.createIssue({ id: "ISS-001", title: "Original title", priority: "low", labels: [] });
      const updated = repo.updateIssue("ISS-001", { title: "Updated title" });

      expect(updated?.title).toBe("Updated title");
    });

    it("updates status", () => {
      repo.createIssue({ id: "ISS-001", title: "Some issue", priority: "medium", labels: [] });
      const updated = repo.updateIssue("ISS-001", { status: "in_progress" });

      expect(updated?.status).toBe("in_progress");
    });

    it("updates priority", () => {
      repo.createIssue({ id: "ISS-001", title: "Some issue", priority: "low", labels: [] });
      const updated = repo.updateIssue("ISS-001", { priority: "critical" });

      expect(updated?.priority).toBe("critical");
    });

    it("updates labels", () => {
      repo.createIssue({ id: "ISS-001", title: "Some issue", priority: "medium", labels: ["old"] });
      const updated = repo.updateIssue("ISS-001", { labels: ["new", "updated"] });

      expect(updated?.labels).toEqual(["new", "updated"]);
    });

    it("updates description to null", () => {
      repo.createIssue({
        id: "ISS-001",
        title: "Issue with desc",
        description: "original",
        priority: "medium",
        labels: [],
      });
      const updated = repo.updateIssue("ISS-001", { description: null });

      expect(updated?.description).toBeNull();
    });

    it("returns undefined for non-existent issue", () => {
      const updated = repo.updateIssue("non-existent", { title: "New title" });
      expect(updated).toBeUndefined();
    });
  });

  describe("closeIssue", () => {
    it("sets status to closed", () => {
      repo.createIssue({ id: "ISS-001", title: "Open issue", priority: "medium", labels: [] });
      const closed = repo.closeIssue("ISS-001");

      expect(closed?.status).toBe("closed");
    });

    it("returns undefined for non-existent issue", () => {
      const result = repo.closeIssue("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("deleteIssue", () => {
    it("returns true when issue is deleted", () => {
      repo.createIssue({ id: "ISS-001", title: "Delete me", priority: "low", labels: [] });
      const result = repo.deleteIssue("ISS-001");

      expect(result).toBe(true);
      expect(repo.getIssue("ISS-001")).toBeUndefined();
    });

    it("returns false when issue does not exist", () => {
      const result = repo.deleteIssue("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("listIssues", () => {
    beforeEach(() => {
      repo.createIssue({ id: "ISS-001", title: "Open bug", priority: "high", labels: ["bug"] });
      repo.createIssue({
        id: "ISS-002",
        title: "In progress task",
        priority: "medium",
        labels: ["task"],
      });
      repo.createIssue({
        id: "ISS-003",
        title: "Done feature",
        priority: "low",
        labels: ["feature", "done"],
      });
    });

    it("returns all issues without filter", () => {
      const issues = repo.listIssues();
      expect(issues).toHaveLength(3);
    });

    it("filters by status", () => {
      repo.updateIssue("ISS-002", { status: "in_progress" });
      const issues = repo.listIssues({ status: "in_progress" });

      expect(issues).toHaveLength(1);
      expect(issues[0]?.id).toBe("ISS-002");
    });

    it("filters by priority", () => {
      const issues = repo.listIssues({ priority: "high" });

      expect(issues).toHaveLength(1);
      expect(issues[0]?.id).toBe("ISS-001");
    });

    it("filters by labels — all labels must match", () => {
      const issues = repo.listIssues({ labels: ["feature", "done"] });

      expect(issues).toHaveLength(1);
      expect(issues[0]?.id).toBe("ISS-003");
    });

    it("respects limit and offset", () => {
      const first = repo.listIssues({ limit: 2, offset: 0 });
      expect(first).toHaveLength(2);

      const second = repo.listIssues({ limit: 2, offset: 2 });
      expect(second).toHaveLength(1);
    });
  });

  describe("listIssues with parentId filter", () => {
    it("filters by parentId", () => {
      repo.createIssue({ id: "EPIC-001", title: "Epic issue", priority: "high", labels: [] });
      repo.createIssue({
        id: "ISS-001",
        title: "Child one",
        priority: "medium",
        labels: [],
        parentId: "EPIC-001",
      });
      repo.createIssue({
        id: "ISS-002",
        title: "Child two",
        priority: "low",
        labels: [],
        parentId: "EPIC-001",
      });
      repo.createIssue({ id: "ISS-003", title: "Unrelated", priority: "low", labels: [] });

      const children = repo.listIssues({ parentId: "EPIC-001" });
      expect(children).toHaveLength(2);
      expect(children.every((i) => i.parentId === "EPIC-001")).toBe(true);
    });
  });

  describe("searchIssues", () => {
    beforeEach(() => {
      repo.createIssue({
        id: "ISS-001",
        title: "Fix authentication system",
        description: "Users cannot login with JWT tokens",
        priority: "high",
        labels: ["security"],
      });
      repo.createIssue({
        id: "ISS-002",
        title: "Add database indexing",
        description: "Query performance needs improvement",
        priority: "medium",
        labels: ["performance"],
      });
      repo.createIssue({
        id: "ISS-003",
        title: "Update user interface",
        description: "Redesign the authentication page",
        priority: "low",
        labels: ["ui"],
      });
    });

    it("returns relevant results for matching query", () => {
      const results = repo.searchIssues("authentication");
      expect(results.length).toBeGreaterThanOrEqual(1);
      const ids = results.map((r) => r.id);
      expect(ids).toContain("ISS-001");
    });

    it("returns empty for empty query", () => {
      const results = repo.searchIssues("");
      expect(results).toEqual([]);
    });

    it("returns empty for whitespace-only query", () => {
      const results = repo.searchIssues("   ");
      expect(results).toEqual([]);
    });

    it("searches title and description", () => {
      const results = repo.searchIssues("performance");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]?.id).toBe("ISS-002");
    });

    it("handles FTS special characters gracefully", () => {
      expect(() => repo.searchIssues('"unbalanced')).not.toThrow();
    });

    it("filters by status within search results", () => {
      repo.updateIssue("ISS-001", { status: "done" });
      const results = repo.searchIssues("authentication", { status: "open" });
      const ids = results.map((r) => r.id);
      expect(ids).not.toContain("ISS-001");
    });
  });

  describe("getChildren", () => {
    it("returns direct children only", () => {
      repo.createIssue({ id: "EPIC-001", title: "Epic", priority: "high", labels: [] });
      repo.createIssue({
        id: "ISS-001",
        title: "Child A",
        priority: "medium",
        labels: [],
        parentId: "EPIC-001",
      });
      repo.createIssue({
        id: "ISS-002",
        title: "Child B",
        priority: "low",
        labels: [],
        parentId: "EPIC-001",
      });
      repo.createIssue({
        id: "ISS-003",
        title: "Grandchild",
        priority: "low",
        labels: [],
        parentId: "ISS-001",
      });

      const children = repo.getChildren("EPIC-001");
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id)).toEqual(expect.arrayContaining(["ISS-001", "ISS-002"]));
      expect(children.map((c) => c.id)).not.toContain("ISS-003");
    });

    it("returns empty for issue with no children", () => {
      repo.createIssue({ id: "ISS-001", title: "Leaf issue", priority: "low", labels: [] });
      const children = repo.getChildren("ISS-001");
      expect(children).toEqual([]);
    });
  });

  describe("getDescendants", () => {
    it("returns full tree excluding the root itself", () => {
      repo.createIssue({ id: "EPIC-001", title: "Root epic", priority: "high", labels: [] });
      repo.createIssue({
        id: "ISS-001",
        title: "Child",
        priority: "medium",
        labels: [],
        parentId: "EPIC-001",
      });
      repo.createIssue({
        id: "ISS-002",
        title: "Grandchild",
        priority: "low",
        labels: [],
        parentId: "ISS-001",
      });
      repo.createIssue({
        id: "ISS-003",
        title: "Great-grandchild",
        priority: "low",
        labels: [],
        parentId: "ISS-002",
      });

      const descendants = repo.getDescendants("EPIC-001");
      expect(descendants).toHaveLength(3);
      expect(descendants.map((d) => d.id)).toEqual(
        expect.arrayContaining(["ISS-001", "ISS-002", "ISS-003"]),
      );
      expect(descendants.map((d) => d.id)).not.toContain("EPIC-001");
    });

    it("returns empty for issue with no descendants", () => {
      repo.createIssue({ id: "ISS-001", title: "Leaf", priority: "low", labels: [] });
      const descendants = repo.getDescendants("ISS-001");
      expect(descendants).toEqual([]);
    });

    it("returns only descendants of the specified branch", () => {
      repo.createIssue({ id: "EPIC-001", title: "Epic A", priority: "high", labels: [] });
      repo.createIssue({ id: "EPIC-002", title: "Epic B", priority: "high", labels: [] });
      repo.createIssue({
        id: "ISS-001",
        title: "Child of A",
        priority: "medium",
        labels: [],
        parentId: "EPIC-001",
      });
      repo.createIssue({
        id: "ISS-002",
        title: "Child of B",
        priority: "medium",
        labels: [],
        parentId: "EPIC-002",
      });

      const descendants = repo.getDescendants("EPIC-001");
      expect(descendants).toHaveLength(1);
      expect(descendants[0]?.id).toBe("ISS-001");
    });
  });

  describe("FTS5 trigger sync", () => {
    it("updates FTS index when issue title is updated", () => {
      repo.createIssue({
        id: "ISS-001",
        title: "original fishing content",
        priority: "medium",
        labels: [],
      });

      const before = repo.searchIssues("fishing");
      expect(before).toHaveLength(1);

      repo.updateIssue("ISS-001", { title: "updated hunting content" });

      const afterFishing = repo.searchIssues("fishing");
      expect(afterFishing).toHaveLength(0);

      const afterHunting = repo.searchIssues("hunting");
      expect(afterHunting).toHaveLength(1);
    });

    it("removes from FTS index when issue is deleted", () => {
      repo.createIssue({
        id: "ISS-001",
        title: "deletable swimming content",
        priority: "low",
        labels: [],
      });

      const before = repo.searchIssues("swimming");
      expect(before).toHaveLength(1);

      repo.deleteIssue("ISS-001");

      const after = repo.searchIssues("swimming");
      expect(after).toHaveLength(0);
    });
  });
});
