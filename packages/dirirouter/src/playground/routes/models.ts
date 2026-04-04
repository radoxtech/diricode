import type { Context } from "hono";
import { getBootstrap } from "./status.js";

export function getModels(c: Context): Response {
  const bootstrap = getBootstrap(c);

  const providerMap = new Map(bootstrap.providerStatuses.map((ps) => [ps.name, ps]));
  const providers = bootstrap.registry.list().map((entry) => {
    const ps = providerMap.get(entry.name);
    return {
      name: entry.name,
      priority: entry.priority,
      available: ps?.available ?? false,
    };
  });

  return c.json({
    modelCards: bootstrap.modelCardRegistry.list(),
    subscriptions: bootstrap.subscriptionRegistry.list(),
    candidatePool: bootstrap.diriRouter.resolver.getCandidatePool(),
    providers,
  });
}
