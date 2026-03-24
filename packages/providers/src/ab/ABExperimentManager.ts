export type ABExperimentStatus = "active" | "paused" | "completed";

export interface ABExperiment {
  id: string;
  name: string;
  status: ABExperimentStatus;
  taskFilter?: Record<string, unknown>;
  minMatches: number;
  costCapUsd?: number;
  currentSpendUsd: number;
  createdAt: string;
  completedAt?: string;
}

export interface TaskDescriptor {
  id: string;
  type: string;
  estimatedCostUsd?: number;
  meta?: Record<string, unknown>;
}

export interface ABBranchResult {
  kind: "branch";
  experimentId: string;
  experimentName: string;
  variantA: { label: "A"; taskId: string };
  variantB: { label: "B"; taskId: string };
}

export interface ABSkipResult {
  kind: "skip";
  reason: "no-match" | "paused" | "completed" | "cost-cap-exceeded";
  experimentId?: string;
}

export type ABEvaluationResult = ABBranchResult | ABSkipResult;

export interface ABExperimentRepository {
  findAll(): Promise<ABExperiment[]>;
  update(
    id: string,
    patch: Partial<Pick<ABExperiment, "currentSpendUsd" | "status" | "completedAt">>,
  ): Promise<void>;
}

export class ABExperimentManager {
  readonly #repo: ABExperimentRepository;

  constructor(repo: ABExperimentRepository) {
    this.#repo = repo;
  }

  /**
   * Evaluate a task against all active experiments.
   *
   * Algorithm:
   * 1. Find the first `active` experiment whose `taskFilter` matches the task.
   * 2. Check whether running both variants would exceed `costCapUsd`.
   *    - If yes: pause the experiment and return `cost-cap-exceeded` skip.
   *    - If no: accumulate spend and return a `branch` result with mock variants.
   * 3. If no experiment matches, return `no-match` skip.
   *
   * Does NOT execute variants — only decides whether to branch.
   */
  async evaluate(task: TaskDescriptor): Promise<ABEvaluationResult> {
    const experiments = await this.#repo.findAll();

    for (const experiment of experiments) {
      if (experiment.status !== "active") {
        continue;
      }

      if (!this.#matchesFilter(task, experiment.taskFilter)) {
        continue;
      }

      const estimatedCost = task.estimatedCostUsd ?? 0;
      const projectedSpend = experiment.currentSpendUsd + estimatedCost;

      if (experiment.costCapUsd !== undefined && projectedSpend > experiment.costCapUsd) {
        await this.#repo.update(experiment.id, { status: "paused" });
        return {
          kind: "skip",
          reason: "cost-cap-exceeded",
          experimentId: experiment.id,
        };
      }

      await this.#repo.update(experiment.id, {
        currentSpendUsd: experiment.currentSpendUsd + estimatedCost,
      });

      return {
        kind: "branch",
        experimentId: experiment.id,
        experimentName: experiment.name,
        variantA: { label: "A", taskId: `${task.id}::A` },
        variantB: { label: "B", taskId: `${task.id}::B` },
      };
    }

    return { kind: "skip", reason: "no-match" };
  }

  /**
   * Returns true when the task satisfies the experiment's taskFilter.
   *
   * The filter is a flat key→value map. Every key in the filter must match a
   * value in the task's combined properties (type + meta). An absent or empty
   * filter is treated as a wildcard (matches everything).
   */
  #matchesFilter(task: TaskDescriptor, filter?: Record<string, unknown>): boolean {
    if (filter === undefined || Object.keys(filter).length === 0) {
      return true;
    }

    const haystack: Record<string, unknown> = {
      type: task.type,
      id: task.id,
      ...task.meta,
    };

    for (const [key, expected] of Object.entries(filter)) {
      if (haystack[key] !== expected) {
        return false;
      }
    }

    return true;
  }
}
