import { z } from "zod";

export const ModelStabilitySchema = z.enum(["stable", "preview"]);
export type ModelStability = z.infer<typeof ModelStabilitySchema>;

export const RateLimitSchema = z.object({
  requests_per_hour: z.number().int().positive(),
  remaining: z.number().int().nonnegative(),
});
export type RateLimit = z.infer<typeof RateLimitSchema>;

const rawSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1).optional(),
  model_id: z.string().min(1).optional(),
  family: z.string().min(1),
  stability: ModelStabilitySchema,
  available: z.boolean(),
  context_window: z.number().int().positive(),
  max_output: z.number().int().positive().optional(),
  supports_tool_calling: z.boolean(),
  supports_vision: z.boolean(),
  supports_structured_output: z.boolean(),
  supports_streaming: z.boolean(),
  input_cost_per_1k: z.number().nonnegative().optional(),
  output_cost_per_1k: z.number().nonnegative().optional(),
  cost_per_1k_input: z.number().nonnegative().optional(),
  cost_per_1k_output: z.number().nonnegative().optional(),
  trusted: z.boolean(),
  rate_limit: RateLimitSchema.optional(),
  vendor_metadata: z.record(z.unknown()).optional(),
  id: z.string().min(1).optional(),
});

const transformSchema = rawSchema.transform(
  (
    val,
  ): {
    provider: string;
    model_id: string;
    family: string;
    stability: "stable" | "preview";
    available: boolean;
    context_window: number;
    max_output?: number;
    supports_tool_calling: boolean;
    supports_vision: boolean;
    supports_structured_output: boolean;
    supports_streaming: boolean;
    input_cost_per_1k: number;
    output_cost_per_1k: number;
    trusted: boolean;
    rate_limit?: { requests_per_hour: number; remaining: number };
    vendor_metadata?: Record<string, unknown>;
    id?: string;
  } => ({
    provider: val.provider,
    model_id: val.model_id ?? val.model ?? "",
    family: val.family,
    stability: val.stability,
    available: val.available,
    context_window: val.context_window,
    max_output: val.max_output,
    supports_tool_calling: val.supports_tool_calling,
    supports_vision: val.supports_vision,
    supports_structured_output: val.supports_structured_output,
    supports_streaming: val.supports_streaming,
    input_cost_per_1k: val.input_cost_per_1k ?? val.cost_per_1k_input ?? 0,
    output_cost_per_1k: val.output_cost_per_1k ?? val.cost_per_1k_output ?? 0,
    trusted: val.trusted,
    rate_limit: val.rate_limit,
    vendor_metadata: val.vendor_metadata,
    id: val.id ?? `${val.provider}-${val.model_id}`,
  }),
);

export const ProviderModelAvailabilitySchema = transformSchema;
export type ProviderModelAvailability = z.infer<typeof transformSchema>;
