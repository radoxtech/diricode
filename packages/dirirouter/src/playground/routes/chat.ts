import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { DiriRouter } from "../../diri-router.js";
import type { Registry } from "../../registry.js";
import { ChatRequestSchema } from "../types.js";
import { readPlaygroundState } from "../model-state.js";

const PROVIDER_ENV_VARS: Readonly<Record<string, string>> = {
  gemini: "GEMINI_API_KEY",
  kimi: "DC_KIMI_API_KEY",
  zai: "DC_ZAI_API_KEY",
  minimax: "DC_MINIMAX_API_KEY",
  copilot: "GITHUB_TOKEN",
};

const DEFAULT_TIMEOUT_MS = 60_000;

export function createChatRouter(
  diriRouter: DiriRouter,
  registry: Registry,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Hono {
  const router = new Hono();

  router.post("/", async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = ChatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", issues: parsed.error.issues }, 400);
    }

    const { prompt, provider, model, maxTokens, temperature } = parsed.data;

    if (provider !== undefined && !registry.has(provider)) {
      const envVar = PROVIDER_ENV_VARS[provider] ?? `${provider.toUpperCase()}_API_KEY`;
      return c.json(
        { error: `Provider '${provider}' is not available. Set ${envVar} in .env`, envVar },
        503,
      );
    }

    const abort = new AbortController();
    c.req.raw.signal.addEventListener("abort", () => {
      abort.abort();
    });
    const timeoutHandle = setTimeout(() => {
      abort.abort(new Error("Request timed out"));
    }, timeoutMs);

    return streamSSE(
      c,
      async (stream) => {
        try {
          const selected =
            provider !== undefined
              ? { provider, model: model ?? registry.get(provider).defaultModel.modelId }
              : undefined;

          const resolvedProvider = diriRouter.getProvider(selected);
          const resolvedModel =
            model ??
            (selected
              ? resolvedProvider.defaultModel.modelId
              : diriRouter.getModelConfig(undefined).modelId);

          const { disabledModels } = readPlaygroundState();
          if (disabledModels.includes(resolvedModel)) {
            await stream.writeSSE({
              event: "error",
              data: JSON.stringify({
                error: `Model '${resolvedModel}' is disabled. Enable it in the playground settings.`,
              }),
            });
            return;
          }

          await stream.writeSSE({
            id: crypto.randomUUID(),
            event: "pick",
            data: JSON.stringify({ provider: resolvedProvider.name, model: resolvedModel }),
          });

          const modelConfig =
            maxTokens !== undefined || temperature !== undefined
              ? {
                  modelId: resolvedModel,
                  ...(maxTokens !== undefined && { maxTokens }),
                  ...(temperature !== undefined && { temperature }),
                }
              : selected
                ? { modelId: resolvedModel }
                : undefined;

          for await (const chunk of diriRouter.stream({
            prompt,
            selected,
            model: modelConfig,
            signal: abort.signal,
          })) {
            if (abort.signal.aborted) break;
            await stream.writeSSE({
              id: crypto.randomUUID(),
              event: "chunk",
              data: chunk.delta,
            });
          }

          if (!abort.signal.aborted) {
            await stream.writeSSE({
              id: crypto.randomUUID(),
              event: "done",
              data: JSON.stringify({ timestamp: Date.now() }),
            });
          }
        } catch (err) {
          const isTimeout = err instanceof Error && err.message === "Request timed out";
          let message: string;
          if (isTimeout) {
            message = "Request timed out";
          } else if (err instanceof Error) {
            message = err.message;
          } else {
            message = "Unknown streaming error";
          }

          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ error: message }),
          });
        } finally {
          clearTimeout(timeoutHandle);
        }
      },
      async (err, stream) => {
        clearTimeout(timeoutHandle);
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ error: err.message }),
        });
      },
    );
  });

  return router;
}
