import { z } from "zod";

export const RateLimitSchema = z.object({
  requests_per_hour: z.number().int().positive(),
  remaining: z.number().int().nonnegative(),
});
export type RateLimit = z.infer<typeof RateLimitSchema>;

export const PickerSubscriptionSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  context_window: z.number().int().positive(),
  rate_limit: RateLimitSchema,
  trusted: z.boolean(),
  available: z.boolean(),
  cost_per_1k_input: z.number().nonnegative(),
  cost_per_1k_output: z.number().nonnegative(),
});
export type PickerSubscription = z.infer<typeof PickerSubscriptionSchema>;
