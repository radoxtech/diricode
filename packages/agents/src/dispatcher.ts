import type {
  Agent,
  AgentCategory,
  AgentContext,
  AgentMetadata,
  AgentResult,
} from "@diricode/core";
import { AgentError, PromptBuilder } from "@diricode/core";
import type { AgentRegistry } from "./registry.js";

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

  return {
    metadata,
    async execute(input: string, context: AgentContext): Promise<AgentResult> {
      context.emit("agent.started", {
        agentId: metadata.name,
        parentAgentId: context.parentAgentId,
        input: input.substring(0, 200),
      });

      const intent = classifyIntent(input);
      context.emit("dispatcher.intent-classified", { intent });

      const candidates = config.registry.search(intent.query);
      if (candidates.length === 0) {
        throw new AgentError(
          "NO_AGENT_FOUND",
          `No suitable agent found for intent: ${intent.category}`,
        );
      }

      context.emit("dispatcher.candidates-found", {
        candidates: candidates.map((c) => ({ name: c.agent.name, score: c.score })),
      });

      const selected = candidates[0];
      if (!selected) {
        throw new AgentError("NO_AGENT_FOUND", "No candidates available");
      }

      context.emit("dispatcher.agent-selected", {
        agent: selected.agent.name,
        score: selected.score,
      });

      const agent = config.registry.get(selected.agent.name);
      const agentPromptBuilder = new PromptBuilder({
        metadata: agent.metadata,
        workspaceRoot: context.workspaceRoot,
      });
      const childContext: AgentContext = {
        ...context,
        parentAgentId: metadata.name,
        promptBuilder: agentPromptBuilder,
      };

      context.emit("dispatcher.prompt-built", {
        agent: selected.agent.name,
        systemPromptPreview: agentPromptBuilder.build(input, []).systemPrompt.substring(0, 100),
      });

      const result = await agent.execute(input, childContext);

      context.emit("agent.completed", {
        agentId: metadata.name,
        delegatedTo: selected.agent.name,
        success: result.success,
        toolCalls: result.toolCalls,
        tokensUsed: result.tokensUsed,
      });

      return result;
    },
  };
}
