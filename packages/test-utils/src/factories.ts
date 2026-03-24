import type {
  DiriCodeConfig,
  Agent,
  AgentContext,
  AgentMetadata,
  AgentResult,
  Tool,
  ToolContext,
  ToolResult,
} from "@diricode/core";

export interface MockConfigOptions {
  providers?: Partial<DiriCodeConfig["providers"]>;
  agents?: Partial<DiriCodeConfig["agents"]>;
  memoryBackend?: DiriCodeConfig["memory"]["backend"];
  workMode?: Partial<DiriCodeConfig["workMode"]>;
  projectName?: string;
}

export function createMockConfig(options: MockConfigOptions = {}): DiriCodeConfig {
  const {
    providers = {},
    agents = {},
    memoryBackend = "in-memory",
    workMode = {},
    projectName = "test-project",
  } = options;

  return {
    providers: {
      openai: {
        apiKey: "$OPENAI_API_KEY",
        defaultModel: "gpt-4o",
        maxRetries: 3,
        timeoutMs: 30_000,
        ...providers,
      },
      anthropic: {
        apiKey: "$ANTHROPIC_API_KEY",
        defaultModel: "claude-3-5-sonnet-20241022",
        maxRetries: 3,
        timeoutMs: 30_000,
        ...providers,
      },
      ...(typeof providers === "object" && !Array.isArray(providers) ? providers : {}),
    },
    agents: {
      testAgent: {
        description: "Test agent for unit tests",
        provider: "openai",
        model: "gpt-4o",
        systemPrompt: "You are a helpful assistant.",
        tools: [],
        maxTurns: 50,
        ...agents,
      },
      ...(typeof agents === "object" && !Array.isArray(agents) ? agents : {}),
    },
    hooks: {},
    memory: {
      backend: memoryBackend,
      maxMessages: 1_000,
      ttlSeconds: 0,
      enableVectorSearch: false,
    },
    workMode: {
      autonomy: "guided",
      verbosity: "normal",
      riskTolerance: "safe",
      creativity: "balanced",
      ...workMode,
    },
    project: {
      name: projectName,
      root: "/tmp/test-project",
      include: [],
      exclude: [],
    },
  };
}

export function createMockAgent(
  overrides: Partial<AgentMetadata> & {
    executeFn?: (input: string, context: AgentContext) => Promise<AgentResult>;
  } = {},
): Agent {
  const metadata: AgentMetadata = {
    name: overrides.name ?? "test-agent",
    description: overrides.description ?? "Mock agent for testing",
    tier: overrides.tier ?? "medium",
    category: overrides.category ?? "code",
    capabilities: overrides.capabilities ?? [],
    tags: overrides.tags ?? ["test"],
  };

  return {
    metadata,
    execute: async (input: string, context: AgentContext): Promise<AgentResult> => {
      if (overrides.executeFn) {
        return overrides.executeFn(input, context);
      }
      return {
        success: true,
        output: `Mock response to: ${input}`,
        toolCalls: 0,
        tokensUsed: 10,
      };
    },
  };
}

export function createMockTool<TParams = unknown, TResult = unknown>(
  overrides: Partial<
    Pick<Tool<TParams, TResult>, "name" | "description" | "parameters" | "annotations">
  > & {
    executeFn?: (params: TParams, context: ToolContext) => Promise<ToolResult<TResult>>;
  } = {},
): Tool<TParams, TResult> {
  return {
    name: overrides.name ?? "mock-tool",
    description: overrides.description ?? "Mock tool for testing",
    parameters: overrides.parameters ?? ({} as Tool<TParams, TResult>["parameters"]),
    annotations: {
      readOnlyHint: overrides.annotations?.readOnlyHint ?? true,
      destructiveHint: overrides.annotations?.destructiveHint ?? false,
      idempotentHint: overrides.annotations?.idempotentHint ?? true,
    },
    execute: async (params: TParams, context: ToolContext): Promise<ToolResult<TResult>> => {
      if (overrides.executeFn) {
        return overrides.executeFn(params, context);
      }
      return { success: true, data: {} as TResult };
    },
  };
}

export interface MockSession {
  id: string;
  status: "created" | "active" | "completed" | "error";
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  messages: MockSessionMessage[];
}

export interface MockSessionMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface MockSessionOptions {
  id?: string;
  status?: MockSession["status"];
  metadata?: Record<string, unknown>;
  messages?: MockSessionMessage[];
}

export function createMockSession(options: MockSessionOptions = {}): MockSession {
  const now = new Date();
  return {
    id: options.id ?? crypto.randomUUID(),
    status: options.status ?? "created",
    metadata: options.metadata ?? {},
    createdAt: now,
    updatedAt: now,
    messages: options.messages ?? [],
  };
}
