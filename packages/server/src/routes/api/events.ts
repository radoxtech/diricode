import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { sseRegistry } from "../../sse/registry.js";
import { eventBus } from "../../sse/event-bus.js";
import type {
  SseConnectedData,
  SseHeartbeatData,
  SseMessage,
  SseEventType,
} from "../../sse/types.js";

const HEARTBEAT_INTERVAL_MS = 20_000;

const TOOL_EVENT_MAP: Record<string, SseEventType> = {
  "tool.start": "tool_start",
  "tool.end": "tool_end",
  "tool.progress": "tool_progress",
};

function generateId(): string {
  return crypto.randomUUID();
}

function buildMessage(event: SseMessage["event"], data: SseMessage["data"]): SseMessage {
  return { id: generateId(), event, data };
}

export const eventsRouter = new Hono();

eventsRouter.get("/", (c) => {
  const lastEventId = c.req.header("Last-Event-ID") ?? null;
  const connectionId = generateId();
  const abort = new AbortController();

  return streamSSE(
    c,
    async (stream) => {
      c.req.raw.signal.addEventListener("abort", () => {
        abort.abort();
        sseRegistry.remove(connectionId);
      });

      const write = async (event: SseEventType, data: unknown): Promise<void> => {
        if (abort.signal.aborted) return;
        await stream.writeSSE({
          id: generateId(),
          event,
          data: JSON.stringify(data),
        });
      };

      sseRegistry.add({
        id: connectionId,
        connectedAt: Date.now(),
        lastEventId,
        abort,
        write,
      });

      const connectedData: SseConnectedData = {
        type: "connected",
        timestamp: Date.now(),
        connectionId,
        lastEventId,
      };
      const connectedMsg = buildMessage("connected", connectedData);
      await stream.writeSSE({
        id: connectedMsg.id,
        event: connectedMsg.event,
        data: JSON.stringify(connectedMsg.data),
      });

      const unsubscribe = eventBus.subscribe((event, payload) => {
        const sseEvent = TOOL_EVENT_MAP[event];
        if (sseEvent) {
          void write(sseEvent, payload);
        }
      });

      while (!abort.signal.aborted) {
        await stream.sleep(HEARTBEAT_INTERVAL_MS);

        const heartbeatData: SseHeartbeatData = {
          type: "heartbeat",
          timestamp: Date.now(),
        };
        const heartbeatMsg = buildMessage("heartbeat", heartbeatData);
        await stream.writeSSE({
          id: heartbeatMsg.id,
          event: heartbeatMsg.event,
          data: JSON.stringify(heartbeatMsg.data),
        });
      }

      unsubscribe();
      sseRegistry.remove(connectionId);
    },
    async (err, stream) => {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          timestamp: Date.now(),
          code: "STREAM_ERROR",
          message: err.message,
        }),
      });
    },
  );
});
