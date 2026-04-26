import { Registry } from "../registry.js";
import { SubscriptionRegistry } from "../llm-picker/subscription-registry.js";
import { CascadeModelResolver } from "../llm-picker/model-resolver.js";
import { DiriRouter } from "../diri-router.js";
import type { ProviderStatus } from "../provider-discovery.js";
import type { ProviderModelAvailability } from "../contracts/provider-model-availability.js";
import { discoverAllProviders } from "../provider-registry.js";

export interface BootstrapResult {
  readonly startTime: number;
  readonly diriRouter: DiriRouter;
  readonly registry: Registry;
  readonly subscriptionRegistry: SubscriptionRegistry;
  readonly providerStatuses: readonly ProviderStatus[];
}

export async function bootstrapPlayground(): Promise<BootstrapResult> {
  const startTime = Date.now();
  const subscriptionRegistry = new SubscriptionRegistry();
  const registry = new Registry();

  const providerStatuses: ProviderStatus[] = [];
  const allAvailabilities: ProviderModelAvailability[] = [];

  const discoveries = await discoverAllProviders();

  for (const discovery of discoveries) {
    const { provider, availabilities, status, priority } = discovery;

    registry.register(provider, priority);

    for (const availability of availabilities) {
      const key = availability.id ?? availability.model_id;
      if (!subscriptionRegistry.has(key)) {
        subscriptionRegistry.register(availability);
      }
      allAvailabilities.push(availability);
    }

    providerStatuses.push(status);
  }

  const resolver = new CascadeModelResolver(undefined, {
    providerAvailabilities: allAvailabilities,
    enableClassifierComparison: true,
  });

  const diriRouter = new DiriRouter({
    registry,
    cascadeResolver: resolver,
  });

  return {
    startTime,
    diriRouter,
    registry,
    subscriptionRegistry,
    providerStatuses,
  };
}
