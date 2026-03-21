import { z } from "zod";

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * Supported LLM provider identifiers.
 */
export const ProviderIdSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "mistral",
  "cohere",
  "groq",
  "ollama",
  "azure-openai",
]);

/**
 * Configuration for a single LLM provider.
 */
export const ProviderConfigSchema = z
  .object({
    /** API key used to authenticate with the provider. May be an env var reference like `$ENV_VAR`. */
    apiKey: z.string().optional(),
    /** Base URL override (e.g. for Azure OpenAI or local proxies). */
    baseUrl: z.string().url().optional(),
    /** Default model name to use when the provider is selected. */
    defaultModel: z.string().optional(),
    /** Maximum number of retries on transient failures. */
    maxRetries: z.number().int().min(0).max(10).default(3),
    /** Request timeout in milliseconds. */
    timeoutMs: z.number().int().positive().default(30_000),
    /** Extra provider-specific options forwarded as-is. */
    options: z.record(z.unknown()).optional(),
  })
  .strict();

/**
 * Map of provider id → provider config.
 *
 * @example
 * ```ts
 * providers: {
 *   openai: { apiKey: "$OPENAI_API_KEY", defaultModel: "gpt-4o" },
 *   anthropic: { apiKey: "$ANTHROPIC_API_KEY" },
 * }
 * ```
 */
export const ProvidersConfigSchema = z
  .record(ProviderIdSchema, ProviderConfigSchema)
  .default({});

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

/**
 * Single tool reference inside an agent config.
 */
export const AgentToolRefSchema = z.union([
  /** Short form: just the tool name. */
  z.string().min(1),
  /** Long form: tool name + per-agent overrides. */
  z.object({
    name: z.string().min(1),
    /** Disable this tool for this agent only. */
    disabled: z.boolean().optional(),
    /** Override timeout for this tool in this agent. */
    timeoutMs: z.number().int().positive().optional(),
  }),
]);

/**
 * Configuration for a single DiriCode agent.
 */
export const AgentConfigSchema = z
  .object({
    /** Human-readable description of what this agent does. */
    description: z.string().optional(),
    /** Provider to use for this agent (must be a key in `providers`). */
    provider: ProviderIdSchema.optional(),
    /** Model name override for this agent. */
    model: z.string().optional(),
    /**
     * System prompt / instructions for this agent.
     * Supports multi-line strings.
     */
    systemPrompt: z.string().optional(),
    /** Tools this agent is allowed to use. */
    tools: z.array(AgentToolRefSchema).default([]),
    /** Maximum number of turns before the agent is forcibly stopped. */
    maxTurns: z.number().int().positive().default(50),
    /** Temperature for sampling (0–2). */
    temperature: z.number().min(0).max(2).optional(),
    /** Top-p nucleus sampling. */
    topP: z.number().min(0).max(1).optional(),
    /** Agent-level extra options forwarded to the provider. */
    options: z.record(z.unknown()).optional(),
  })
  .strict();

/**
 * Map of agent name → agent config.
 *
 * @example
 * ```ts
 * agents: {
 *   coder: { provider: "openai", model: "gpt-4o", maxTurns: 100 },
 *   reviewer: { provider: "anthropic", systemPrompt: "Review code carefully." },
 * }
 * ```
 */
export const AgentsConfigSchema = z.record(z.string().min(1), AgentConfigSchema).default({});

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * A single hook handler: either a shell command string or an inline config.
 */
export const HookHandlerSchema = z.union([
  /** Shell command executed as a subprocess. */
  z.string().min(1),
  z.object({
    /** Shell command to execute. */
    command: z.string().min(1),
    /** Working directory for the command (defaults to project root). */
    cwd: z.string().optional(),
    /** Environment variable overrides. */
    env: z.record(z.string()).optional(),
    /** Timeout for this hook in milliseconds. */
    timeoutMs: z.number().int().positive().default(10_000),
    /** Whether a non-zero exit code should abort the operation. */
    failOnError: z.boolean().default(true),
  }),
]);

/**
 * Lifecycle hooks configuration.
 *
 * Hooks run at specific points in the agent / task lifecycle. Each hook
 * accepts a single handler or an ordered array of handlers.
 */
export const HooksConfigSchema = z
  .object({
    /** Runs before a task starts. */
    beforeTask: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
    /** Runs after a task completes successfully. */
    afterTask: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
    /** Runs when a task fails. */
    onTaskError: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
    /** Runs before a tool is invoked. */
    beforeTool: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
    /** Runs after a tool returns. */
    afterTool: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
    /** Runs when a tool call raises an error. */
    onToolError: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
    /** Runs when the session starts. */
    onSessionStart: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
    /** Runs when the session ends (success or failure). */
    onSessionEnd: z.union([HookHandlerSchema, z.array(HookHandlerSchema)]).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Memory / Storage
// ---------------------------------------------------------------------------

/** Supported memory backend types. */
export const MemoryBackendSchema = z.enum(["in-memory", "sqlite", "postgres", "redis", "custom"]);

/**
 * Memory / storage configuration.
 */
export const MemoryConfigSchema = z
  .object({
    /** Backend storage engine. Defaults to `in-memory`. */
    backend: MemoryBackendSchema.default("in-memory"),
    /**
     * Connection string or file path (required for `sqlite`, `postgres`,
     * `redis` backends).
     */
    connectionString: z.string().optional(),
    /**
     * Maximum number of messages retained in the conversation window.
     * Older messages are evicted when the limit is reached.
     */
    maxMessages: z.number().int().positive().default(1_000),
    /**
     * TTL for stored items in seconds.
     * `0` means no expiry.
     */
    ttlSeconds: z.number().int().min(0).default(0),
    /** Whether to enable semantic / vector search on stored memories. */
    enableVectorSearch: z.boolean().default(false),
    /** Dimensions of the embedding vectors (required when `enableVectorSearch` is true). */
    vectorDimensions: z.number().int().positive().optional(),
    /** Additional backend-specific options. */
    options: z.record(z.unknown()).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Work Mode (4 dimensions)
// ---------------------------------------------------------------------------

/**
 * The four work-mode dimensions that control agent behaviour and autonomy.
 *
 * | Dimension      | Controls                                        |
 * |----------------|-------------------------------------------------|
 * | `autonomy`     | How much the agent acts without user approval   |
 * | `verbosity`    | How detailed the agent's output is              |
 * | `riskTolerance`| Willingness to apply potentially destructive ops|
 * | `creativity`   | How exploratory / creative the reasoning is     |
 */
export const WorkModeConfigSchema = z
  .object({
    /**
     * Autonomy level — controls how often the agent asks for confirmation.
     *
     * - `"manual"`: Every action requires explicit approval.
     * - `"guided"`: Agent suggests, user approves.
     * - `"semi-auto"`: Agent acts autonomously except for destructive ops.
     * - `"full-auto"`: Agent acts without asking (use with caution).
     */
    autonomy: z.enum(["manual", "guided", "semi-auto", "full-auto"]).default("guided"),
    /**
     * Verbosity level for agent responses and logs.
     *
     * - `"silent"`: Minimal output, only results.
     * - `"concise"`: Short summaries.
     * - `"normal"`: Balanced detail.
     * - `"verbose"`: Full reasoning chain visible.
     */
    verbosity: z.enum(["silent", "concise", "normal", "verbose"]).default("normal"),
    /**
     * Risk tolerance — determines which operations are gated behind approval.
     *
     * - `"safe"`: Only read-only operations auto-approved.
     * - `"moderate"`: Reversible writes auto-approved.
     * - `"aggressive"`: Most operations auto-approved, only destructive/irreversible gated.
     */
    riskTolerance: z.enum(["safe", "moderate", "aggressive"]).default("safe"),
    /**
     * Creativity / exploration level.
     *
     * - `"precise"`: Stick closely to the user's instructions.
     * - `"balanced"`: Mix of instruction-following and exploration.
     * - `"exploratory"`: Agent may try unconventional approaches.
     */
    creativity: z.enum(["precise", "balanced", "exploratory"]).default("balanced"),
  })
  .strict();

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

/**
 * Project-specific settings.
 */
export const ProjectConfigSchema = z
  .object({
    /** Human-readable project name displayed in UI and logs. */
    name: z.string().min(1).optional(),
    /** Short description of the project. */
    description: z.string().optional(),
    /**
     * Project root directory.
     * Defaults to the directory containing the config file.
     */
    root: z.string().optional(),
    /**
     * Glob patterns for files the agent is **allowed** to read/modify.
     * An empty array means all files are accessible.
     */
    include: z.array(z.string()).default([]),
    /**
     * Glob patterns for files the agent must **never** read or modify.
     * Takes precedence over `include`.
     */
    exclude: z.array(z.string()).default([]),
    /**
     * Path to a file whose content is prepended to every agent context
     * (e.g. `.cursorrules`, `AGENTS.md`).
     */
    contextFile: z.string().optional(),
    /** Arbitrary key-value metadata attached to the project. */
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Root DiriCode Config
// ---------------------------------------------------------------------------

/**
 * Root DiriCode configuration schema.
 *
 * Typically loaded from `diricode.config.ts` (or `.json` / `.yaml`).
 *
 * @example
 * ```ts
 * import { DiriCodeConfigSchema } from "@diricode/core/config";
 *
 * const config = DiriCodeConfigSchema.parse({
 *   providers: { openai: { apiKey: "$OPENAI_API_KEY" } },
 *   agents: { coder: { provider: "openai", model: "gpt-4o" } },
 * });
 * ```
 */
export const DiriCodeConfigSchema = z
  .object({
    /**
     * LLM provider configurations.
     * Keys are provider ids (e.g. `"openai"`, `"anthropic"`).
     */
    providers: ProvidersConfigSchema,
    /**
     * Named agent configurations.
     * Keys are arbitrary agent identifiers referenced elsewhere in the config.
     */
    agents: AgentsConfigSchema,
    /**
     * Lifecycle hook handlers invoked at specific points during execution.
     */
    hooks: HooksConfigSchema.default({}),
    /**
     * Memory / storage backend configuration for persisting conversation
     * history and long-term memories.
     */
    memory: MemoryConfigSchema.default({}),
    /**
     * Four-dimensional work mode controlling agent autonomy, verbosity,
     * risk tolerance, and creativity.
     */
    workMode: WorkModeConfigSchema.default({}),
    /**
     * Project-specific settings such as name, root directory, and file
     * access patterns.
     */
    project: ProjectConfigSchema.default({}),
  })
  .strict();

/**
 * Inferred TypeScript type for a fully-parsed DiriCode configuration.
 *
 * Use this type for function parameters / return values that deal with a
 * parsed (i.e. already validated and defaults-filled) config object.
 */
export type DiriCodeConfig = z.infer<typeof DiriCodeConfigSchema>;
