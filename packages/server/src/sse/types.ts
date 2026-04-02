/** Union of all typed SSE event types emitted by the server. */
export type SseEventType =
  | "connected"
  | "heartbeat"
  | "error"
  | "tool_start"
  | "tool_end"
  | "tool_progress"
  | "message";

/** Base structure for every SSE event's data payload. */
export interface SseEventData {
  type: SseEventType;
  timestamp: number;
}

/** Sent immediately after a client connects (or reconnects). */
export interface SseConnectedData extends SseEventData {
  type: "connected";
  connectionId: string;
  lastEventId: string | null;
}

/** Periodic heartbeat to keep the connection alive. */
export interface SseHeartbeatData extends SseEventData {
  type: "heartbeat";
}

/** Generic error notification. */
export interface SseErrorData extends SseEventData {
  type: "error";
  code: string;
  message: string;
}

/** Discriminated union of all concrete event data shapes. */
export type SseData = SseConnectedData | SseHeartbeatData | SseErrorData | SseEventData;

/** A fully-formed SSE message ready for serialisation. */
export interface SseMessage {
  id: string;
  event: SseEventType;
  data: SseData;
}

/** Metadata stored in the connection registry for one live SSE client. */
export interface SseConnection {
  id: string;
  connectedAt: number;
  lastEventId: string | null;
  abort: AbortController;
  write: (event: SseEventType, data: unknown) => Promise<void>;
}
