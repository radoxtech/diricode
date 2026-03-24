import { describe, expect, it } from "vitest";
import {
  ABExperimentManager,
  type ABExperiment,
  type ABExperimentRepository,
  type TaskDescriptor,
} from "../ab/ABExperimentManager.js";

function makeExperiment(overrides: Partial<ABExperiment> = {}): ABExperiment {
  return {
    id: "exp-1",
    name: "Test Experiment",
    status: "active",
    minMatches: 50,
    costCapUsd: undefined,
    currentSpendUsd: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRepo(experiments: ABExperiment[]): ABExperimentRepository {
  const store = new Map<string, ABExperiment>(experiments.map((e) => [e.id, e]));
  return {
    findAll: () => Promise.resolve(Array.from(store.values())),
    update: (id, patch) => {
      const existing = store.get(id);
      if (existing) {
        store.set(id, { ...existing, ...patch });
      }
      return Promise.resolve();
    },
  };
}

function makeTask(overrides: Partial<TaskDescriptor> = {}): TaskDescriptor {
  return {
    id: "task-1",
    type: "code-write",
    ...overrides,
  };
}

describe("ABExperimentManager", () => {
  describe("evaluate — no experiments", () => {
    it("returns no-match skip when repository is empty", async () => {
      const manager = new ABExperimentManager(makeRepo([]));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("skip");
      if (result.kind === "skip") {
        expect(result.reason).toBe("no-match");
      }
    });
  });

  describe("evaluate — experiment status gating", () => {
    it("skips paused experiments", async () => {
      const manager = new ABExperimentManager(makeRepo([makeExperiment({ status: "paused" })]));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("skip");
      if (result.kind === "skip") {
        expect(result.reason).toBe("no-match");
      }
    });

    it("skips completed experiments", async () => {
      const manager = new ABExperimentManager(makeRepo([makeExperiment({ status: "completed" })]));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("skip");
    });

    it("processes active experiments", async () => {
      const manager = new ABExperimentManager(makeRepo([makeExperiment({ status: "active" })]));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("branch");
    });
  });

  describe("evaluate — task filter matching", () => {
    it("matches when taskFilter is undefined (wildcard)", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ taskFilter: undefined })]),
      );
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("branch");
    });

    it("matches when taskFilter is empty object (wildcard)", async () => {
      const manager = new ABExperimentManager(makeRepo([makeExperiment({ taskFilter: {} })]));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("branch");
    });

    it("matches when task type aligns with filter", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ taskFilter: { type: "code-write" } })]),
      );
      const result = await manager.evaluate(makeTask({ type: "code-write" }));
      expect(result.kind).toBe("branch");
    });

    it("returns no-match when task type does not align with filter", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ taskFilter: { type: "review" } })]),
      );
      const result = await manager.evaluate(makeTask({ type: "code-write" }));
      expect(result.kind).toBe("skip");
      if (result.kind === "skip") {
        expect(result.reason).toBe("no-match");
      }
    });

    it("matches on meta fields", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ taskFilter: { tier: "heavy" } })]),
      );
      const result = await manager.evaluate(makeTask({ meta: { tier: "heavy" } }));
      expect(result.kind).toBe("branch");
    });

    it("returns no-match when meta field value does not match filter", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ taskFilter: { tier: "heavy" } })]),
      );
      const result = await manager.evaluate(makeTask({ meta: { tier: "low" } }));
      expect(result.kind).toBe("skip");
    });

    it("requires all filter keys to match", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ taskFilter: { type: "code-write", tier: "heavy" } })]),
      );
      const result = await manager.evaluate(
        makeTask({ type: "code-write", meta: { tier: "medium" } }),
      );
      expect(result.kind).toBe("skip");
    });
  });

  describe("evaluate — branch result shape", () => {
    it("returns branch result with correct experimentId", async () => {
      const manager = new ABExperimentManager(makeRepo([makeExperiment({ id: "exp-abc" })]));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("branch");
      if (result.kind === "branch") {
        expect(result.experimentId).toBe("exp-abc");
      }
    });

    it("returns branch result with correct experimentName", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ name: "My Experiment" })]),
      );
      const result = await manager.evaluate(makeTask());
      if (result.kind === "branch") {
        expect(result.experimentName).toBe("My Experiment");
      }
    });

    it("generates variant A with label A and suffixed taskId", async () => {
      const manager = new ABExperimentManager(makeRepo([makeExperiment()]));
      const result = await manager.evaluate(makeTask({ id: "task-42" }));
      if (result.kind === "branch") {
        expect(result.variantA.label).toBe("A");
        expect(result.variantA.taskId).toBe("task-42::A");
      }
    });

    it("generates variant B with label B and suffixed taskId", async () => {
      const manager = new ABExperimentManager(makeRepo([makeExperiment()]));
      const result = await manager.evaluate(makeTask({ id: "task-42" }));
      if (result.kind === "branch") {
        expect(result.variantB.label).toBe("B");
        expect(result.variantB.taskId).toBe("task-42::B");
      }
    });
  });

  describe("evaluate — cost tracking", () => {
    it("increments currentSpendUsd after a branch", async () => {
      const experiment = makeExperiment({ currentSpendUsd: 1.0 });
      const repo = makeRepo([experiment]);
      const manager = new ABExperimentManager(repo);

      await manager.evaluate(makeTask({ estimatedCostUsd: 0.5 }));

      const experiments = await repo.findAll();
      const updated = experiments[0];
      expect(updated?.currentSpendUsd).toBeCloseTo(1.5);
    });

    it("does not increment spend when task has no estimatedCostUsd (defaults to 0)", async () => {
      const experiment = makeExperiment({ currentSpendUsd: 2.0 });
      const repo = makeRepo([experiment]);
      const manager = new ABExperimentManager(repo);

      await manager.evaluate(makeTask());

      const experiments = await repo.findAll();
      const updated = experiments[0];
      expect(updated?.currentSpendUsd).toBeCloseTo(2.0);
    });
  });

  describe("evaluate — cost cap enforcement", () => {
    it("returns cost-cap-exceeded skip when spend would exceed cap", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ costCapUsd: 1.0, currentSpendUsd: 0.8 })]),
      );
      const result = await manager.evaluate(makeTask({ estimatedCostUsd: 0.5 }));
      expect(result.kind).toBe("skip");
      if (result.kind === "skip") {
        expect(result.reason).toBe("cost-cap-exceeded");
        expect(result.experimentId).toBe("exp-1");
      }
    });

    it("pauses the experiment in the repository when cap is exceeded", async () => {
      const experiment = makeExperiment({ costCapUsd: 1.0, currentSpendUsd: 0.8 });
      const repo = makeRepo([experiment]);
      const manager = new ABExperimentManager(repo);

      await manager.evaluate(makeTask({ estimatedCostUsd: 0.5 }));

      const experiments = await repo.findAll();
      const updated = experiments[0];
      expect(updated?.status).toBe("paused");
    });

    it("does NOT increment spend when cap is exceeded", async () => {
      const experiment = makeExperiment({ costCapUsd: 1.0, currentSpendUsd: 0.8 });
      const repo = makeRepo([experiment]);
      const manager = new ABExperimentManager(repo);

      await manager.evaluate(makeTask({ estimatedCostUsd: 0.5 }));

      const experiments = await repo.findAll();
      const updated = experiments[0];
      expect(updated?.currentSpendUsd).toBeCloseTo(0.8);
    });

    it("allows branching when spend exactly equals cap (strict >)", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ costCapUsd: 1.0, currentSpendUsd: 0.5 })]),
      );
      const result = await manager.evaluate(makeTask({ estimatedCostUsd: 0.5 }));
      expect(result.kind).toBe("branch");
    });

    it("branches normally when no costCapUsd is set", async () => {
      const manager = new ABExperimentManager(
        makeRepo([makeExperiment({ costCapUsd: undefined, currentSpendUsd: 999 })]),
      );
      const result = await manager.evaluate(makeTask({ estimatedCostUsd: 999 }));
      expect(result.kind).toBe("branch");
    });
  });

  describe("evaluate — multiple experiments", () => {
    it("evaluates experiments in order and returns first match", async () => {
      const experiments: ABExperiment[] = [
        makeExperiment({ id: "exp-first", name: "First" }),
        makeExperiment({ id: "exp-second", name: "Second" }),
      ];
      const manager = new ABExperimentManager(makeRepo(experiments));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("branch");
      if (result.kind === "branch") {
        expect(result.experimentId).toBe("exp-first");
      }
    });

    it("falls through paused experiments to find active one", async () => {
      const experiments: ABExperiment[] = [
        makeExperiment({ id: "exp-paused", status: "paused" }),
        makeExperiment({ id: "exp-active", status: "active" }),
      ];
      const manager = new ABExperimentManager(makeRepo(experiments));
      const result = await manager.evaluate(makeTask());
      expect(result.kind).toBe("branch");
      if (result.kind === "branch") {
        expect(result.experimentId).toBe("exp-active");
      }
    });

    it("falls through non-matching experiments to find matching one", async () => {
      const experiments: ABExperiment[] = [
        makeExperiment({ id: "exp-review", taskFilter: { type: "review" } }),
        makeExperiment({ id: "exp-code", taskFilter: { type: "code-write" } }),
      ];
      const manager = new ABExperimentManager(makeRepo(experiments));
      const result = await manager.evaluate(makeTask({ type: "code-write" }));
      expect(result.kind).toBe("branch");
      if (result.kind === "branch") {
        expect(result.experimentId).toBe("exp-code");
      }
    });

    it("returns no-match when all experiments are non-matching", async () => {
      const experiments: ABExperiment[] = [
        makeExperiment({ id: "exp-1", taskFilter: { type: "review" } }),
        makeExperiment({ id: "exp-2", taskFilter: { type: "planning" } }),
      ];
      const manager = new ABExperimentManager(makeRepo(experiments));
      const result = await manager.evaluate(makeTask({ type: "code-write" }));
      expect(result.kind).toBe("skip");
      if (result.kind === "skip") {
        expect(result.reason).toBe("no-match");
      }
    });
  });
});
