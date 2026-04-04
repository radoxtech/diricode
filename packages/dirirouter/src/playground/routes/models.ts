import type { Context } from "hono";
import { getBootstrap } from "./status.js";
import { readPlaygroundState, toggleModel } from "../model-state.js";

export function getModels(c: Context): Response {
  const bootstrap = getBootstrap(c);
  const { disabledModels } = readPlaygroundState();

  const providerMap = new Map(bootstrap.providerStatuses.map((ps) => [ps.name, ps]));
  const providers = bootstrap.registry.list().map((entry) => {
    const ps = providerMap.get(entry.name);
    return {
      name: entry.name,
      priority: entry.priority,
      available: ps?.available ?? false,
    };
  });

  const modelCards = bootstrap.modelCardRegistry.list().map((card) => {
    const subs = bootstrap.subscriptionRegistry.findByModel(card.model);
    const provider = subs.length > 0 ? (subs[0]?.provider ?? "unknown") : "unknown";
    return {
      ...card,
      id: card.model,
      provider: provider,
      enabled: !disabledModels.includes(card.model),
    };
  });

  return c.json({
    modelCards,
    disabledModels,
    subscriptions: bootstrap.subscriptionRegistry.list(),
    candidatePool: bootstrap.diriRouter.resolver.getCandidatePool(),
    providers,
  });
}

export async function patchModelToggle(c: Context): Promise<Response> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("modelId" in body) ||
    typeof (body as Record<string, unknown>).modelId !== "string"
  ) {
    return c.json({ error: "Missing or invalid field: modelId (string)" }, 400);
  }

  const modelId = (body as Record<string, unknown>).modelId as string;

  // Validate modelId exists
  const bootstrap = getBootstrap(c);
  if (!bootstrap.modelCardRegistry.has(modelId)) {
    return c.json({ error: `Model '${modelId}' not found in registry` }, 404);
  }

  const updatedState = toggleModel(modelId);
  return c.json({
    modelId,
    enabled: !updatedState.disabledModels.includes(modelId),
    disabledModels: updatedState.disabledModels,
  });
}
