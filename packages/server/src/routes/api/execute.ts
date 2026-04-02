import { Hono } from "hono";
import {
  AgentRegistry,
  createDispatcher,
  createCodeWriterAgent,
  createPlannerQuickAgent,
  createCodeExplorerAgent,
} from "@diricode/agents";
import type { AgentContext } from "@diricode/core";
import {
  bashTool,
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  astGrepTool,
  astGrepReplaceTool,
  lspSymbolsTool,
  diagnosticsTool,
} from "@diricode/tools";
import type { Tool } from "@diricode/core";
import type { ApiEnvelope } from "../../middleware/error.js";
import { createEventBusEmitBridge } from "../../sse/emit-bridge.js";

const ALL_TOOLS = [
  bashTool,
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  astGrepTool,
  astGrepReplaceTool,
  lspSymbolsTool,
  diagnosticsTool,
] as unknown as readonly Tool[];

function noopEmit(_event: string, _payload: unknown): void {}

export const executeRouter = new Hono();

const registry = new AgentRegistry();

registry.register(createCodeWriterAgent({ tools: ALL_TOOLS }));
registry.register(createPlannerQuickAgent({ tools: ALL_TOOLS }));
registry.register(createCodeExplorerAgent({ tools: ALL_TOOLS }));

const dispatcher = createDispatcher({
  registry,
  maxDelegationDepth: 3,
});

interface ExecuteBody {
  sessionId?: string;
  prompt: string;
  tools?: string[];
  workspaceRoot?: string;
}

executeRouter.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as ExecuteBody | null;

  if (!body?.prompt) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: { code: "INVALID_REQUEST", message: "Request body must include 'prompt' (string)" },
    };
    return c.json(envelope, 400);
  }

  const sessionId = body.sessionId ?? crypto.randomUUID();
  const workspaceRoot = body.workspaceRoot ?? process.cwd();
  const allowedToolNames = body.tools;

  const tools = allowedToolNames
    ? ALL_TOOLS.filter((t) => allowedToolNames.includes(t.name))
    : [...ALL_TOOLS];

  if (tools.length === 0) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: { code: "NO_TOOLS", message: "No valid tools provided" },
    };
    return c.json(envelope, 400);
  }

  const emit = noopEmit;
  const bridgeEmit = createEventBusEmitBridge(emit);

  const context: AgentContext = {
    workspaceRoot,
    sessionId,
    tools,
    emit: bridgeEmit,
  };

  try {
    const result = await dispatcher.execute(body.prompt, context);

    const envelope: ApiEnvelope<{ sessionId: string; result: unknown }> = {
      success: true,
      data: { sessionId, result },
    };
    return c.json(envelope, 200);
  } catch (error) {
    const envelope: ApiEnvelope<never> = {
      success: false,
      error: {
        code: "EXECUTION_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    };
    return c.json(envelope, 500);
  }
});
