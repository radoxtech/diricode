/**
 * Playground-specific types and Zod validation schemas.
 *
 * These types map the playground UI form inputs to the existing
 * `DecisionRequest` and `GenerateOptions` interfaces from @diricode/dirirouter,
 * with key differences:
 * - `chatId` and `requestId` are omitted from input types (generated server-side)
 * - `PickRequest` is a user-facing subset of `DecisionRequest`
 * - `ChatRequest` is a simplified version of `ChatOptions` + `ModelConfig`
 *
 * @module playground/types
 */

import { z } from "zod";
import type {
  AgentInfo,
  TaskInfo,
  ModelDimensions,
  DecisionConstraints,
  ModelTier,
  ModelAttribute,
  FallbackType,
} from "@diricode/dirirouter/llm-picker/types.js";
import {
  ModelTierSchema,
  ModelAttributeSchema,
  FallbackTypeSchema,
  ModelDimensionsSchema,
  AgentInfoSchema,
  TaskInfoSchema,
  DecisionConstraintsSchema,
} from "@diricode/dirirouter/llm-picker/types.js";
import type { DiriRouter } from "@diricode/dirirouter/diri-router.js";
import type { Registry } from "@diricode/dirirouter/registry.js";
import type { ModelCardRegistry } from "@diricode/dirirouter/picker/model-card-registry.js";
import type { SubscriptionRegistry } from "@diricode/dirirouter/picker/subscription-registry.js";

// ---------------------------------------------------------------------------
// Provider Status
// ---------------------------------------------------------------------------

/**
 * Health status of a single provider.
 */
export interface ProviderStatus {
  /** Provider name (e.g. "gemini", "kimi"). */
  name: string;
  /** Whether the provider is available for requests. */
  available: boolean;
  /** Error message if unavailable. */
  error?: string;
  /** Environment variable name required for this provider. */
  envVar: string;
}

// ---------------------------------------------------------------------------
// Playground Configuration
// ---------------------------------------------------------------------------

/**
 * Server configuration for the playground.
 */
export interface PlaygroundConfig {
  /** Port number to listen on. */
  port: number;
  /** Host address to bind to. */
  host: string;
}

// ---------------------------------------------------------------------------
// Bootstrap Result
// ---------------------------------------------------------------------------

/**
 * Result of playground server initialization.
 */
export interface BootstrapResult {
  /** Initialized DiriRouter instance. */
  diriRouter: DiriRouter;
  /** Provider registry with registered providers. */
  registry: Registry;
  /** Model card registry with discovered models. */
  modelCardRegistry: ModelCardRegistry;
  /** Subscription registry with active subscriptions. */
  subscriptionRegistry: SubscriptionRegistry;
  /** Individual provider health statuses. */
  providerStatuses: ProviderStatus[];
}

// ---------------------------------------------------------------------------
// Pick Request — subset of DecisionRequest without auto-generated fields
// ---------------------------------------------------------------------------

/**
 * User-facing request for model picking (dry-run).
 *
 * Omits `chatId` and `requestId` from `DecisionRequest` since these
 * are auto-generated server-side.
 *
 * @see DecisionRequest from @diricode/dirirouter/llm-picker/types
 */
export interface PickRequest {
  /** Agent identity and role. */
  agent: z.input<typeof AgentInfoSchema>;
  /** Task type and description. */
  task: z.input<typeof TaskInfoSchema>;
  /** Model selection dimensions. */
  modelDimensions: z.input<typeof ModelDimensionsSchema>;
  /** Optional constraints for filtering/ranking candidates. */
  constraints?: z.input<typeof DecisionConstraintsSchema>;
}

export interface PickRequestOutput {
  /** Agent identity and role. */
  agent: AgentInfo;
  /** Task type and description. */
  task: TaskInfo;
  /** Model selection dimensions. */
  modelDimensions: ModelDimensions;
  /** Optional constraints for filtering/ranking candidates. */
  constraints?: DecisionConstraints;
}

/**
 * Zod schema for validating `PickRequest` objects.
 *
 * Validates that:
 * - `agent` matches AgentInfoSchema (role required, id optional)
 * - `task` matches TaskInfoSchema (type required, description optional)
 * - `modelDimensions` matches ModelDimensionsSchema
 * - `constraints` is optional and matches DecisionConstraintsSchema if provided
 */
export const PickRequestSchema: z.ZodType<PickRequestOutput, z.ZodTypeDef, PickRequest> = z.object({
  agent: AgentInfoSchema,
  task: TaskInfoSchema,
  modelDimensions: ModelDimensionsSchema,
  constraints: DecisionConstraintsSchema.optional(),
});

/**
 * Inferred TypeScript type from `PickRequestSchema` (output).
 */
export type PickRequestInferred = z.output<typeof PickRequestSchema>;

// Ensure schema produces the correct type
const _pickRequestTypeCheck: PickRequestOutput = {} as PickRequestInferred;
void _pickRequestTypeCheck;

// ---------------------------------------------------------------------------
// Chat Request — simplified chat options
// ---------------------------------------------------------------------------

/**
 * Simplified chat request for the playground.
 *
 * This is a user-facing subset that maps to `ChatOptions` + `ModelConfig`
 * from the DiriRouter interface, simplified for direct provider mode.
 */
export interface ChatRequest {
  /** The prompt / user message content. */
  prompt: string;
  /** Provider name for direct mode (skip picker). */
  provider?: string;
  /** Model identifier for direct mode. */
  model?: string;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Sampling temperature in [0, 2]. */
  temperature?: number;
}

/**
 * Zod schema for validating `ChatRequest` objects.
 *
 * Validates that:
 * - `prompt` is a non-empty string
 * - `provider` is an optional string
 * - `model` is an optional string
 * - `maxTokens` is a positive integer if provided
 * - `temperature` is in range [0, 2] if provided
 */
export const ChatRequestSchema: z.ZodType<ChatRequest> = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  provider: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * Inferred TypeScript type from `ChatRequestSchema`.
 */
export type ChatRequestInferred = z.infer<typeof ChatRequestSchema>;

// Ensure schema produces the correct type
const _chatRequestTypeCheck: ChatRequest = {} as ChatRequestInferred;
void _chatRequestTypeCheck;

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

/**
 * Re-export of `ModelTier` for playground consumers.
 * @see @diricode/dirirouter/llm-picker/types
 */
export type { ModelTier, ModelAttribute, FallbackType };

/**
 * Re-export of relevant Zod schemas for playground consumers.
 * @see @diricode/dirirouter/llm-picker/types
 */
export { ModelTierSchema, ModelAttributeSchema, FallbackTypeSchema, ModelDimensionsSchema };
