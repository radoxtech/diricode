import { z } from "zod";

export const ModelStabilitySchema = z.enum(["stable", "preview"]);
export type ModelStability = z.infer<typeof ModelStabilitySchema>;

export const ProviderModelAvailabilitySchema = z.object({
  provider: z.string().min(1),
  model_id: z.string().min(1),
  family: z.string().min(1),
  stability: ModelStabilitySchema,
  available: z.boolean(),
  context_window: z.number().int().positive(),
  max_output: z.number().int().positive().optional(),
  supports_tool_calling: z.boolean(),
  supports_vision: z.boolean(),
  supports_structured_output: z.boolean(),
  supports_streaming: z.boolean(),
  input_cost_per_1k: z.number().nonnegative(),
  output_cost_per_1k: z.number().nonnegative(),
  trusted: z.boolean(),
  rate_limit: z
    .object({
      requests_per_hour: z.number().int().positive(),
      remaining: z.number().int().nonnegative(),
    })
    .optional(),
  vendor_metadata: z.record(z.unknown()).optional(),
});
export type ProviderModelAvailability = z.infer<typeof ProviderModelAvailabilitySchema>;
