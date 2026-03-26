import type {
  Agent,
  AgentCategory,
  AgentContext,
  AgentMetadata,
  AgentResult,
  ContextInheritanceRules,
  ResultPropagationContract,
} from "@diricode/core";
import {
  AgentError,
  DEFAULT_INHERITANCE_RULES,
  DEFAULT_RESULT_CONTRACT,
  generateExecutionId,
} from "@diricode/core";
import type { AgentRegistry } from "./registry.js";
import { DelegationGraph, createHandoffEnvelope, createDelegationResult } from "./protocol.js";

export interface DispatcherConfig {
  readonly registry: AgentRegistry;
  readonly maxDelegationDepth: number;
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

export function createDispatcher(config: DispatcherConfig): Agent {
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
    ],
    tags: ["orchestration"],
  };

  const graph = new DelegationGraph();

  return {
    metadata,
    async execute(input: string, context: AgentContext): Promise<AgentResult> {
      const executionId = generateExecutionId();

      context.emit("agent.started", {
        agentId: metadata.name,
        executionId,
        parentAgentId: context.parentAgentId,
        input: input.substring(0, 200),
      });

      const intent = classifyIntent(input);
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

      context.emit("dispatcher.agent-selected", {
        agent: selected.agent.name,
        score: selected.score,
        executionId,
      });

      const agent = config.registry.get(selected.agent.name);

      const envelope = createHandoffEnvelope({
        parentExecutionId: executionId,
        parentAgentName: metadata.name,
        sessionId: context.sessionId,
        workspaceRoot: context.workspaceRoot,
        taskInput: input,
        inheritanceRules: DEFAULT_INHERITANCE_RULES,
        parentContext: context,
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
      };

      context.emit("delegation.child.started", {
        handoffId: envelope.handoffId,
        childExecutionId: envelope.childExecutionId,
        childAgent: selected.agent.name,
        executionId,
      });

      let result: AgentResult;
      try {
        result = await agent.execute(input, childContext);
        graph.completeNode(envelope.childExecutionId, result.success);

        const delegationResult = createDelegationResult(result, envelope, DEFAULT_RESULT_CONTRACT);

        context.emit("delegation.child.completed", {
          handoffId: envelope.handoffId,
          childExecutionId: envelope.childExecutionId,
          success: result.success,
          toolCalls: result.toolCalls,
          tokensUsed: result.tokensUsed,
          tokenCount: delegationResult.tokenCount,
          executionId,
        });
      } catch (error) {
        graph.completeNode(envelope.childExecutionId, false);
        context.emit("delegation.child.failed", {
          handoffId: envelope.handoffId,
          childExecutionId: envelope.childExecutionId,
          error: error instanceof Error ? error.message : String(error),
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
