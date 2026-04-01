import type {
  Agent,
  AgentCategory,
  AgentContext,
  AgentMetadata,
  AgentResult,
  ContextInheritanceRules,
  ModelConfigResolver,
  ResultPropagationContract,
  SandboxConfig,
} from "@diricode/core";
import {
  AgentError,
  DEFAULT_INHERITANCE_RULES,
  DEFAULT_MODEL_CONFIG_RESOLVER,
  DEFAULT_RESULT_CONTRACT,
  DEFAULT_SANDBOX_CONFIG,
  generateExecutionId,
  createPolicyEnforcingToolRegistry,
} from "@diricode/core";

import type { AgentRegistry } from "./registry.js";
import { DelegationGraph, createHandoffEnvelope, createDelegationResult } from "./protocol.js";
import { DISPATCHER_CONTRACT, BoundaryViolationError, enforceDispatcherBoundary } from "@diricode/core";
import { executeInSandbox } from "./sandbox.js";
import type { SandboxContext } from "./sandbox.js";

export interface DispatcherConfig {
  readonly registry: AgentRegistry;
  readonly maxDelegationDepth: number;
  readonly sandboxConfig?: SandboxConfig;
  readonly modelTierResolver?: ModelConfigResolver;
}

interface ClassifiedIntent {
  category: AgentCategory;
  query: string;
  confidence: number;
}

const KEYWORD_MAP: readonly (readonly [readonly string[], AgentCategory])[] = [
  [["write", "implement", "create", "add", "build"], "code"],
  [["review", "check", "verify", "test"], "quality"],
  [["plan", "design", "architect"], "strategy"],
  [["find", "search", "explore", "look"], "research"],
  [["commit", "deploy", "format", "lint"], "utility"],
] as const;

function classifyIntent(input: string): ClassifiedIntent {
  const lower = input.toLowerCase();
  const words = lower.split(/\s+/);

  for (const [keywords, category] of KEYWORD_MAP) {
    for (const keyword of keywords) {
      if (words.includes(keyword)) {
        return { category, query: input, confidence: 1.0 };
      }
    }
  }

  for (const [keywords, category] of KEYWORD_MAP) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return { category, query: input, confidence: 0.5 };
      }
    }
  }

  return { category: "code", query: input, confidence: 0.5 };
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

    context.emit("swarm.wave.start", {
      executionId,
      wave: ready.map((t) => t.id),
      remaining: pending.size - ready.length,
    });

    const waveResults = await Promise.allSettled(
      ready.map(async (task) => {
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
          tier: agent.metadata.tier,
          category: agent.metadata.category,
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
          ).map(t => ({
            ...t,
            execute: async (p, ctx) => {
              graph.recordToolCall(envelope.childExecutionId, t.name);
              return t.execute(p, ctx);
            }
          })),
        };

        const result = await agent.execute(task.description, childContext);
        graph.completeNode(envelope.childExecutionId, result.success);

        context.emit("swarm.task.complete", {
          executionId,
          taskId: task.id,
          success: result.success,
        });

        return { taskId: task.id, result };
      }),
    );

    for (const outcome of waveResults) {
      if (outcome.status === "fulfilled") {
        completed.add(outcome.value.taskId);
        results.set(outcome.value.taskId, outcome.value.result);
      } else {
        const taskId = ready[waveResults.indexOf(outcome)]?.id ?? "unknown";
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
  }

  return {
    completed: Array.from(completed),
    failed: Array.from(failed),
    results,
  };
}

export interface SwarmConfig {
  readonly tasks: readonly SwarmTask[];
}

export function createDispatcher(config: DispatcherConfig): Agent & {
  executeSwarm: (swarmConfig: SwarmConfig, context: AgentContext) => Promise<SwarmResult>;
} {
  const metadata: AgentMetadata = {
    name: "dispatcher",
    description: "Central coordinator: interprets user intent and delegates to specialist agents",
    tier: "heavy",
    category: "command",
    capabilities: [
      "intent-classification",
      "task-routing",
      "agent-delegation",
      "progress-monitoring",
      "parallel-swarm-execution",
      "dag-scheduling",
      "sandbox-execution",
    ],
    tags: ["orchestration"],
    toolPolicy: { allowedTools: DISPATCHER_CONTRACT.allowedTools, silentFilter: false },
  };

  const graph = new DelegationGraph();
  const sandboxConfig = config.sandboxConfig ?? DEFAULT_SANDBOX_CONFIG;
  const modelTierResolver = config.modelTierResolver ?? DEFAULT_MODEL_CONFIG_RESOLVER;

  return {
    metadata,

    async executeSwarm(swarmConfig: SwarmConfig, context: AgentContext): Promise<SwarmResult> {
      const executionId = generateExecutionId();

      context.emit("swarm.started", {
        agentId: metadata.name,
        executionId,
        taskCount: swarmConfig.tasks.length,
      });

      const swarmResult = await executeSwarm(
        swarmConfig.tasks,
        config,
        context,
        graph,
        executionId,
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
      const executionId = generateExecutionId();

      context.emit("agent.started", {
        agentId: metadata.name,
        executionId,
        parentAgentId: context.parentAgentId,
        input: input.substring(0, 200),
      });

      const safeTools = enforceDispatcherBoundary(context.tools, context.emit);
      // Ensure dispatcher itself only has access to safe tools
      const safeContext = { ...context, tools: safeTools };

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
          `No suitable agent found for intent: ${intent.category}`,
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
      const modelConfig = modelTierResolver.resolve(agent.metadata);

      context.emit("dispatcher.model-resolved", {
        agent: selected.agent.name,
        model: modelConfig.model,
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
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
        tier: agent.metadata.tier,
        category: agent.metadata.category,
      });

      const childContext: AgentContext = {
        ...context,
        parentAgentId: metadata.name,
        sessionId: envelope.parent.sessionId,
        tools: createPolicyEnforcingToolRegistry(
          context.tools,
          agent.metadata.toolPolicy ?? {},
          agent.metadata.name,
          context.emit,
        ).map(t => ({
          ...t,
          execute: async (p, ctx) => {
            graph.recordToolCall(envelope.childExecutionId, t.name);
            return t.execute(p, ctx);
          }
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
      };

      let result: AgentResult;
      let sandboxResult;
      try {
        sandboxResult = await executeInSandbox(agent, input, sandboxContext, sandboxConfig);
        result = {
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
      } catch (error) {
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
    },
  };
}
