/**
 * Subscription contracts — unified with ProviderModelAvailability.
 *
 * PickerSubscription is now an alias for ProviderModelAvailability.
 * The registry stores ProviderModelAvailability objects keyed by subscription id.
 */
export { RateLimitSchema } from "./provider-model-availability.js";
export type { RateLimit } from "./provider-model-availability.js";

export {
  ProviderModelAvailabilitySchema as PickerSubscriptionSchema,
  ProviderModelAvailabilitySchema,
} from "./provider-model-availability.js";
export type { ProviderModelAvailability as PickerSubscription } from "./provider-model-availability.js";
