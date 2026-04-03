import type {
  Agent,
  AgentContext,
  AgentDomain,
  AgentMetadata,
  AgentResult,
  AgentTier,
  ContextInheritanceRules,
  ModelConfigResolver,
  ResultPropagationContract,
  SandboxConfig,
  SandboxExecutionResult,
  TurnStatus,
  TurnTelemetry,
} from "@diricode/core";
import {
  AgentError,
  DEFAULT_INHERITANCE_RULES,
  DEFAULT_MODEL_CONFIG_RESOLVER,
  DEFAULT_RESULT_CONTRACT,
  DEFAULT_SANDBOX_CONFIG,
  generateExecutionId,
  generateTurnId,
  createPolicyEnforcingToolRegistry,
  filterContextForHandoff,
  createFilterPolicyForDomain,
  TurnEnvelope,
} from "@diricode/core";
import type { DecisionRequest, ModelAttribute, ModelTier } from "@diricode/core/llm-picker";
import type { DiriRouter } from "@diricode/providers";

import type { AgentRegistry } from "./registry.js";
import { DelegationGraph, createHandoffEnvelope, createDelegationResult } from "./protocol.js";
import { DISPATCHER_CONTRACT, enforceDispatcherBoundary } from "@diricode/core";
import { executeInSandbox } from "./sandbox.js";
import type { SandboxContext } from "./sandbox.js";

export interface DispatcherConfig {
  readonly registry: AgentRegistry;
  readonly maxDelegationDepth: number;
  readonly sandboxConfig?: SandboxConfig;
  readonly modelTierResolver?: ModelConfigResolver;
  readonly diriRouter?: DiriRouter;
}

interface ClassifiedIntent {
  primary: AgentDomain;
  query: string;
  confidence: number;
}

const KEYWORD_MAP: readonly (readonly [readonly string[], AgentDomain])[] = [
  [["write", "implement", "create", "add", "build"], "coding"],
  [["review", "check", "verify", "test"], "review"],
  [["plan", "design", "architect"], "planning"],
  [["find", "search", "explore", "look"], "research"],
  [["commit", "deploy", "format", "lint"], "utility"],
] as const;

function selectTierForTask(input: string, allowedTiers: readonly AgentTier[]): AgentTier {
  const lower = input.toLowerCase();
  let preferred: AgentTier = "light";

  if (
    lower.includes("architect") ||
    lower.includes("refactor") ||
    lower.includes("complex") ||
    lower.includes("multi-file") ||
    lower.length > 180
  ) {
    preferred = "heavy";
  } else if (
    lower.includes("implement") ||
    lower.includes("debug") ||
    lower.includes("investigate") ||
    lower.includes("research") ||
    lower.includes("plan") ||
    lower.length > 80
  ) {
    preferred = "medium";
  }

  const fallbackOrder: Record<AgentTier, readonly AgentTier[]> = {
    heavy: ["heavy", "medium", "light"],
    medium: ["medium", "light", "heavy"],
    light: ["light", "medium", "heavy"],
  };

  return (
    fallbackOrder[preferred].find((tier) => allowedTiers.includes(tier)) ??
    allowedTiers[0] ??
    "medium"
  );
}

function classifyIntent(input: string): ClassifiedIntent {
  const lower = input.toLowerCase();
  const words = lower.split(/\s+/);

  for (const [keywords, category] of KEYWORD_MAP) {
    for (const keyword of keywords) {
      if (words.includes(keyword)) {
        return { primary: category, query: input, confidence: 1.0 };
      }
    }
  }

  for (const [keywords, category] of KEYWORD_MAP) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return { primary: category, query: input, confidence: 0.5 };
      }
    }
  }

  return { primary: "coding", query: input, confidence: 0.5 };
}

function buildDecisionRequest(
  agent: AgentMetadata,
  taskType: string,
  requestedTier: AgentTier,
): DecisionRequest {
  function toModelTier(tier: AgentTier): ModelTier {
    if (tier === "light") return "low";
    if (tier === "heavy") return "heavy";
    return "medium";
  }

  return {
    chatId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    agent: { id: agent.name, role: agent.capabilities.primary },
    task: { type: taskType },
    modelDimensions: {
      tier: toModelTier(requestedTier),
      modelAttributes: agent.capabilities.modelAttributes as ModelAttribute[],
      fallbackType: null,
    },
  };
}

export interface DispatcherDelegationOptions {
  readonly inheritanceRules?: ContextInheritanceRules;
  readonly resultContract?: ResultPropagationContract;
}

export interface SwarmTask {
  readonly id: string;
  readonly description: string;
  readonly blockedBy: readonly string[];
}

export interface SwarmResult {
  readonly completed: string[];
  readonly failed: string[];
  readonly results: Map<string, AgentResult>;
}

async function executeSwarm(
  tasks: readonly SwarmTask[],
  config: DispatcherConfig,
  context: AgentContext,
  graph: DelegationGraph,
  executionId: string,
  sequential = false,
): Promise<SwarmResult> {
  const pending = new Map<string, SwarmTask>(tasks.map((t) => [t.id, t]));
  const completed = new Set<string>();
  const failed = new Set<string>();
  const results = new Map<string, AgentResult>();

  while (pending.size > 0) {
    const ready = Array.from(pending.values()).filter((t) =>
      t.blockedBy.every((dep) => completed.has(dep)),
    );

    if (ready.length === 0) {
      const stillBlocked = Array.from(pending.values()).filter(
        (t) => !t.blockedBy.every((dep) => completed.has(dep) || failed.has(dep)),
      );
      if (stillBlocked.length > 0) {
        context.emit("swarm.deadlock", {
          executionId,
          blockedTasks: stillBlocked.map((t) => t.id),
        });
      }
      break;
    }

    if (sequential) {
      const firstTask = ready[0];
      if (!firstTask) break;
      context.emit("swarm.wave.start", {
        executionId,
        wave: [firstTask.id],
        remaining: pending.size - 1,
      });
    } else {
      context.emit("swarm.wave.start", {
        executionId,
        wave: ready.map((t) => t.id),
        remaining: pending.size - ready.length,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- in sequential mode ready has exactly 1 task
    const taskBatch = sequential ? [ready[0]!] : ready;

    const waveResults = await Promise.allSettled(
      taskBatch.map(async (task) => {
        pending.delete(task.id);

        context.emit("swarm.task.start", { executionId, taskId: task.id });

        const intent = classifyIntent(task.description);
        const candidates = config.registry.search(intent.query);

        if (candidates.length === 0) {
          throw new AgentError("NO_AGENT_FOUND", `No suitable agent found for task: ${task.id}`);
        }

        const selected = candidates[0];
        if (!selected) {
          throw new AgentError("NO_AGENT_FOUND", "No candidates available");
        }

        const agent = config.registry.get(selected.agent.name);
        const envelope = createHandoffEnvelope({
          parentExecutionId: executionId,
          parentAgentName: "dispatcher",
          sessionId: context.sessionId,
          workspaceRoot: context.workspaceRoot,
          taskInput: task.description,
          inheritanceRules: DEFAULT_INHERITANCE_RULES,
          parentContext: context,
        });

        graph.registerNode({
          executionId: envelope.childExecutionId,
          agentName: selected.agent.name,
          parentExecutionId: executionId,
          allowedTiers: agent.metadata.allowedTiers,
          primary: agent.metadata.capabilities.primary,
        });

        const childContext: AgentContext = {
          ...context,
          parentAgentId: "dispatcher",
          sessionId: envelope.parent.sessionId,
          tools: createPolicyEnforcingToolRegistry(
            context.tools,
            agent.metadata.toolPolicy ?? {},
            agent.metadata.name,
            context.emit,
          ).map((t) => ({
            ...t,
            execute: async (p, ctx) => {
              graph.recordToolCall(envelope.childExecutionId, t.name);
              return t.execute(p, ctx);
            },
          })),
        };

        const result = await agent.execute(task.description, childContext);
        graph.completeNode(envelope.childExecutionId, result.success);

        context.emit("swarm.task.complete", {
          executionId,
          taskId: task.id,
          success: result.success,
        });

        context.emit("task.checkpoint", {
          executionId,
          taskId: task.id,
          success: result.success,
          checkpointIndex: completed.size,
          completedTasks: Array.from(completed),
          failedTasks: Array.from(failed),
        });

        return { taskId: task.id, result };
      }),
    );

    for (const outcome of waveResults) {
      if (outcome.status === "fulfilled") {
        completed.add(outcome.value.taskId);
        results.set(outcome.value.taskId, outcome.value.result);
      } else {
        const taskId = taskBatch[waveResults.indexOf(outcome)]?.id ?? "unknown";
        failed.add(taskId);
        context.emit("swarm.task.failed", {
          executionId,
          taskId,
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
      }
    }

    context.emit("swarm.wave.end", {
      executionId,
      completed: Array.from(completed),
      failed: Array.from(failed),
    });

    if (sequential && failed.size > 0) {
      break;
    }
  }

  return {
    completed: Array.from(completed),
    failed: Array.from(failed),
    results,
  };
}

export interface SwarmConfig {
  readonly tasks: readonly SwarmTask[];
  readonly sequential?: boolean;
}

export function createDispatcher(config: DispatcherConfig): Agent & {
  executeSwarm: (swarmConfig: SwarmConfig, context: AgentContext) => Promise<SwarmResult>;
} {
  const metadata: AgentMetadata = {
    name: "dispatcher",
    description: "Central coordinator: interprets user intent and delegates to specialist agents",
    allowedTiers: ["heavy"],
    capabilities: {
      primary: "coding",
      specialization: ["orchestration", "routing", "delegation"],
      modelAttributes: ["reasoning", "agentic"],
    },
    toolPolicy: { allowedTools: DISPATCHER_CONTRACT.allowedTools, silentFilter: false },
  };

  const graph = new DelegationGraph();
  const sandboxConfig = config.sandboxConfig ?? DEFAULT_SANDBOX_CONFIG;
  const modelTierResolver = config.modelTierResolver ?? DEFAULT_MODEL_CONFIG_RESOLVER;

  async function executeDispatch(
    input: string,
    context: AgentContext,
    turnEnvelope: TurnEnvelope,
    turnId: string,
  ): Promise<AgentResult> {
    const executionId = generateExecutionId();

    context.emit("agent.started", {
      agentId: metadata.name,
      executionId,
      parentAgentId: context.parentAgentId,
      input: input.substring(0, 200),
    });

    enforceDispatcherBoundary(context.tools, context.emit);

    context.emit("dispatcher.boundary.checked", {
      executionId,
      allowedTools: metadata.toolPolicy?.allowedTools,
      enforced: true,
    });

    const intent = classifyIntent(input);
    context.emit("dispatcher.intent.classified", { intent, executionId });
    context.emit("dispatcher.intent-classified", { intent, executionId });

    const candidates = config.registry.search(intent.query);
    if (candidates.length === 0) {
      throw new AgentError(
        "NO_AGENT_FOUND",
        `No suitable agent found for intent: ${intent.primary}`,
      );
    }

    context.emit("dispatcher.candidates-found", {
      candidates: candidates.map((c) => ({ name: c.agent.name, score: c.score })),
      executionId,
    });

    const selected = candidates[0];
    if (!selected) {
      throw new AgentError("NO_AGENT_FOUND", "No candidates available");
    }

    context.emit("dispatcher.agent.selected", {
      agent: selected.agent.name,
      score: selected.score,
      executionId,
    });
    context.emit("dispatcher.agent-selected", {
      agent: selected.agent.name,
      score: selected.score,
      executionId,
    });

    const agent = config.registry.get(selected.agent.name);
    const requestedTier = selectTierForTask(input, agent.metadata.allowedTiers);

    let selectedProvider: string | undefined;
    let selectedModel: string | undefined;

    if (config.diriRouter) {
      const decisionRequest = buildDecisionRequest(agent.metadata, intent.primary, requestedTier);
      const decisionResponse = await config.diriRouter.pick(decisionRequest);

      if (decisionResponse.status === "resolved" && decisionResponse.selected) {
        selectedProvider = decisionResponse.selected.provider;
        selectedModel = decisionResponse.selected.model;

        context.emit("dispatcher.model-resolved", {
          agent: selected.agent.name,
          tier: requestedTier,
          model: selectedModel,
          provider: selectedProvider,
          selectionSource: "diri-router",
          executionId,
        });
      } else {
        const modelConfig = modelTierResolver.resolve(agent.metadata, requestedTier);
        selectedProvider = modelConfig.provider;
        selectedModel = modelConfig.model;

        context.emit("dispatcher.model-resolved", {
          agent: selected.agent.name,
          tier: requestedTier,
          model: selectedModel,
          provider: selectedProvider,
          selectionSource: "model-tier-resolver",
          executionId,
        });
      }
    } else {
      const modelConfig = modelTierResolver.resolve(agent.metadata, requestedTier);
      selectedProvider = modelConfig.provider;
      selectedModel = modelConfig.model;

      context.emit("dispatcher.model-resolved", {
        agent: selected.agent.name,
        tier: requestedTier,
        model: modelConfig.model,
        provider: modelConfig.provider,
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        selectionSource: "model-tier-resolver",
        executionId,
      });
    }

    const filterPolicy = createFilterPolicyForDomain(agent.metadata.capabilities.primary);
    const { filteredContext, metadata: filterMetadata } = filterContextForHandoff(
      context,
      DEFAULT_INHERITANCE_RULES,
      filterPolicy,
      agent.metadata.capabilities.primary,
      agent.metadata.toolPolicy,
    );

    context.emit("handoff.filtered", {
      handoffId: undefined,
      childAgent: selected.agent.name,
      primary: agent.metadata.capabilities.primary,
      filteredCategories: filterMetadata.filteredCategories,
      filteredCount: filterMetadata.filteredCount,
      estimatedTokensSaved: filterMetadata.estimatedTokensSaved,
      toolScopeBoundaries: filterMetadata.toolScopeBoundaries,
      inheritanceMode: filterMetadata.inheritanceMode,
      executionId,
    });

    const envelope = createHandoffEnvelope({
      parentExecutionId: executionId,
      parentAgentName: metadata.name,
      sessionId: context.sessionId,
      workspaceRoot: context.workspaceRoot,
      taskInput: input,
      inheritanceRules: DEFAULT_INHERITANCE_RULES,
      parentContext: context,
      filteredContext,
    });

    context.emit("dispatcher.delegation.created", {
      handoffId: envelope.handoffId,
      childExecutionId: envelope.childExecutionId,
      agent: selected.agent.name,
      executionId,
    });
    context.emit("delegation.handoff-created", {
      handoffId: envelope.handoffId,
      childExecutionId: envelope.childExecutionId,
      agent: selected.agent.name,
      executionId,
    });

    graph.registerNode({
      executionId: envelope.childExecutionId,
      agentName: selected.agent.name,
      parentExecutionId: executionId,
      allowedTiers: agent.metadata.allowedTiers,
      primary: agent.metadata.capabilities.primary,
    });

    const childContext: AgentContext = {
      ...context,
      parentAgentId: metadata.name,
      sessionId: envelope.parent.sessionId,
      turnId,
      tools: createPolicyEnforcingToolRegistry(
        context.tools,
        agent.metadata.toolPolicy ?? {},
        agent.metadata.name,
        context.emit,
      ).map((t) => ({
        ...t,
        execute: async (p, ctx) => {
          graph.recordToolCall(envelope.childExecutionId, t.name);
          return t.execute(p, ctx);
        },
      })),
    };

    context.emit("delegation.child.started", {
      handoffId: envelope.handoffId,
      childExecutionId: envelope.childExecutionId,
      childAgent: selected.agent.name,
      executionId,
    });

    const sandboxContext: SandboxContext = {
      ...childContext,
      sandboxConfig: sandboxConfig,
      requestedTier,
      selectedProvider,
      selectedModel,
    };

    let sandboxResult: SandboxExecutionResult | undefined;
    const timeoutHandle = setTimeout(() => {
      const timeoutEvent = turnEnvelope.timeout();
      context.emit(timeoutEvent.type, timeoutEvent);
      turnEnvelope.capturePartial(
        selected.agent.name,
        sandboxResult?.totalToolCalls ?? 0,
        sandboxResult?.totalTokens ?? 0,
        sandboxResult?.output ?? "",
      );
    }, 300000);

    try {
      sandboxResult = await executeInSandbox(agent, input, sandboxContext, sandboxConfig);
    } catch (error) {
      clearTimeout(timeoutHandle);
      graph.completeNode(envelope.childExecutionId, false);
      context.emit("delegation.child.failed", {
        handoffId: envelope.handoffId,
        childExecutionId: envelope.childExecutionId,
        error: error instanceof Error ? error.message : String(error),
        stopReason: sandboxResult?.stopReason ?? "error",
        retries: sandboxResult?.retries ?? 0,
        executionId,
      });
      throw error;
    }
    clearTimeout(timeoutHandle);

    const result: AgentResult = {
      success: sandboxResult.success,
      output: sandboxResult.output,
      toolCalls: sandboxResult.totalToolCalls,
      tokensUsed: sandboxResult.totalTokens,
    };
    graph.completeNode(envelope.childExecutionId, result.success);

    const delegationResult = createDelegationResult(result, envelope, DEFAULT_RESULT_CONTRACT);

    context.emit("delegation.child.completed", {
      handoffId: envelope.handoffId,
      childExecutionId: envelope.childExecutionId,
      success: result.success,
      toolCalls: result.toolCalls,
      tokensUsed: result.tokensUsed,
      tokenCount: delegationResult.tokenCount,
      stopReason: sandboxResult.stopReason,
      retries: sandboxResult.retries,
      executionId,
    });

    context.emit("agent.completed", {
      agentId: metadata.name,
      executionId,
      delegatedTo: selected.agent.name,
      childExecutionId: envelope.childExecutionId,
      success: result.success,
      toolCalls: result.toolCalls,
      tokensUsed: result.tokensUsed,
    });

    return result;
  }

  return {
    metadata,

    async executeSwarm(swarmConfig: SwarmConfig, context: AgentContext): Promise<SwarmResult> {
      const executionId = generateExecutionId();
      const sequential = swarmConfig.sequential ?? false;

      context.emit("swarm.started", {
        agentId: metadata.name,
        executionId,
        taskCount: swarmConfig.tasks.length,
        sequential,
      });

      const swarmResult = await executeSwarm(
        swarmConfig.tasks,
        config,
        context,
        graph,
        executionId,
        sequential,
      );

      context.emit("swarm.completed", {
        agentId: metadata.name,
        executionId,
        completed: swarmResult.completed.length,
        failed: swarmResult.failed.length,
      });

      return swarmResult;
    },

    async execute(input: string, context: AgentContext): Promise<AgentResult> {
      const turnId = generateTurnId();
      const turnEnvelope = new TurnEnvelope(turnId, context.sessionId, input, 300000);
      const startEvent = turnEnvelope.start();
      context.emit(startEvent.type, startEvent);

      const turnContext: AgentContext = {
        ...context,
        turnId,
      };

      let result: AgentResult | undefined;
      let telemetry: TurnTelemetry = { totalTokens: 0, totalToolCalls: 0, totalCost: 0 };
      let turnEndEmitted = false;

      try {
        result = await executeDispatch(input, turnContext, turnEnvelope, turnId);

        telemetry = {
          totalTokens: result.tokensUsed,
          totalToolCalls: result.toolCalls,
          totalCost: 0,
        };

        const endEvent = turnEnvelope.end(
          "completed" satisfies TurnStatus,
          result.output.substring(0, 500),
          telemetry,
        );
        context.emit(endEvent.type, endEvent);
        turnEndEmitted = true;

        return result;
      } catch (error) {
        if (!turnEndEmitted) {
          const endEvent = turnEnvelope.end(
            "failed" satisfies TurnStatus,
            error instanceof Error ? error.message : String(error),
            telemetry,
          );
          context.emit(endEvent.type, endEvent);
        }
        throw error;
      }
    },
  };
}
