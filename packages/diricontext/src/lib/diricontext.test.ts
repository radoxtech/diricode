import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DiriContext } from "./diricontext.js";

describe("DiriContext", () => {
  let dbPath: string;
  let cleanup: () => void;

  beforeEach(() => {
    const tempDir = join(tmpdir(), `diricontext-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    dbPath = join(tempDir, "diricontext.db");
    cleanup = () => {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors.
      }
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("initializes with all sub-APIs", () => {
    const context = new DiriContext({ dbPath });

    expect(context.nodes).toBeDefined();
    expect(context.edges).toBeDefined();
    expect(context.namespaces).toBeDefined();
    expect(context.search).toBeDefined();

    context.close();
  });

  it("returns a meaningful empty project status", () => {
    const context = new DiriContext({ dbPath });

    const status = context.getStatus();

    expect(status.isEmpty).toBe(true);
    expect(status.totalNodes).toBe(0);
    expect(status.progress).toEqual({ done: 0, total: 0, percent: 0 });
    expect(status.namespaces.map((namespace) => namespace.id)).toEqual(["docs", "plan"]);
    expect(status._nextAction).toContain("Add docs or plan nodes");

    context.close();
  });

  it("returns the active sprint and unresolved blockers", () => {
    const context = new DiriContext({ dbPath });

    const sprint = context.nodes.createNode({
      namespace_id: "plan",
      type: "sprint",
      title: "Sprint 1",
      status: "IN_PROGRESS",
    });
    const dependency = context.nodes.createNode({
      namespace_id: "plan",
      type: "task",
      title: "Provision database",
      status: "TODO",
    });
    const task = context.nodes.createNode({
      namespace_id: "plan",
      type: "task",
      title: "Ship feature",
      status: "IN_PROGRESS",
      parentId: sprint.id,
    });

    context.edges.createEdge({
      sourceId: task.id,
      targetId: dependency.id,
      type: "depends_on",
    });

    expect(context.getCurrentSprint()?.id).toBe(sprint.id);
    expect(context.getBlockers().map((node) => node.id)).toEqual([dependency.id]);

    context.close();
  });

  it("builds a docs feature map with child nodes and dependency nodes", () => {
    const context = new DiriContext({ dbPath });

    const dependencyFeature = context.nodes.createNode({
      namespace_id: "docs",
      type: "feature",
      title: "Auth Foundation",
      status: "DONE",
    });
    const feature = context.nodes.createNode({
      namespace_id: "docs",
      type: "feature",
      title: "User Profile",
      status: "IN_PROGRESS",
    });
    const component = context.nodes.createNode({
      namespace_id: "docs",
      type: "component",
      title: "Profile Card",
      parentId: feature.id,
      status: "TODO",
    });

    context.edges.createEdge({
      sourceId: feature.id,
      targetId: dependencyFeature.id,
      type: "depends_on",
    });

    const featureMap = context.getFeatureMap();

    expect(featureMap.isEmpty).toBe(false);
    expect(featureMap.totalFeatures).toBe(2);

    const userProfileEntry = featureMap.features.find((entry) => entry.feature.id === feature.id);

    expect(userProfileEntry?.children.map((node) => node.id)).toEqual([component.id]);
    expect(userProfileEntry?.dependencyNodes.map((node) => node.id)).toEqual([
      dependencyFeature.id,
    ]);

    context.close();
  });

  it("exposes stubbed planning helpers without throwing", () => {
    const context = new DiriContext({ dbPath });

    expect(context.getNextWork()).toEqual([
      {
        strategy: "priority",
        limit: 5,
        reason:
          "getNextWork(priority) is a stub in Task #587. Full implementation lands in Task #595.",
        _nextAction:
          "Use getBlockers(), getCurrentSprint(), and getStatus() until the work recommender is implemented.",
      },
    ]);
    expect(context.getExecutionPlan()[0]?._nextAction).toContain("Task #597");
    expect(context.analyzeBlockers()._nextAction).toContain("Task #596");
    expect(context.summarize("docs")).toContain("Namespace 'docs' is empty");

    context.close();
  });

  it("closes cleanly more than once", () => {
    const context = new DiriContext({ dbPath });

    expect(() => {
      context.close();
      context.close();
    }).not.toThrow();
  });
});
