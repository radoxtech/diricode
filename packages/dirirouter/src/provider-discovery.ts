import type { ProviderModelAvailability } from "./contracts/provider-model-availability.js";
import type { Provider } from "./types.js";

export interface ProviderStatus {
  readonly name: string;
  readonly available: boolean;
  readonly error?: string;
  readonly envVar?: string;
  readonly modelCount: number;
  readonly modelNames: readonly string[];
}

export interface ProviderDiscoveryResult {
  readonly provider: Provider;
  readonly availabilities: ProviderModelAvailability[];
  readonly status: ProviderStatus;
}

export interface DiscoverableProvider extends Provider {
  discoverAvailability(): Promise<ProviderDiscoveryResult>;
}

export function isDiscoverableProvider(provider: Provider): provider is DiscoverableProvider {
  return "discoverAvailability" in provider && typeof provider.discoverAvailability === "function";
}
