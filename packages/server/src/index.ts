import { createApp } from "./server.js";

export type { ApiEnvelope, ErrorEnvelope, SuccessEnvelope } from "./middleware/error.js";
export type {
  SseConnection,
  SseConnectedData,
  SseData,
  SseErrorData,
  SseEventData,
  SseEventType,
  SseHeartbeatData,
  SseMessage,
} from "./sse/types.js";
export { SseRegistry, sseRegistry } from "./sse/registry.js";
export { EventBus, eventBus } from "./sse/event-bus.js";
export { createEventBusEmitBridge } from "./sse/emit-bridge.js";
export type { EmitFn } from "./sse/emit-bridge.js";
export { createApp } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = createApp();

export default {
  port: PORT,
  fetch: app.fetch,
};
