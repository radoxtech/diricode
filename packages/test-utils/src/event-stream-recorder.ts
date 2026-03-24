import type { SseMessage, SseEventData, SseEventType } from "@diricode/server/sse/types";

export class EventStreamRecorder {
  private events: SseMessage[] = [];
  private connectionId: string | null = null;
  private lastEventId: string | null = null;

  record(event: SseMessage): void {
    this.events.push({ ...event });
    this.lastEventId = event.id;
  }

  recordConnected(connectionId: string, lastEventId: string | null = null): void {
    this.connectionId = connectionId;
    const priorLastId = this.lastEventId;
    this.record({
      id: crypto.randomUUID(),
      event: "connected",
      data: {
        type: "connected",
        timestamp: Date.now(),
        connectionId,
        lastEventId,
      },
    });
    this.lastEventId = lastEventId ?? priorLastId;
  }

  recordHeartbeat(): void {
    this.record({
      id: crypto.randomUUID(),
      event: "heartbeat",
      data: { type: "heartbeat", timestamp: Date.now() },
    });
  }

  recordError(code: string, message: string): void {
    this.record({
      id: crypto.randomUUID(),
      event: "error",
      data: { type: "error", timestamp: Date.now(), code, message },
    });
  }

  recordToolStart(toolName: string, params: Record<string, unknown>): void {
    this.record({
      id: crypto.randomUUID(),
      event: "tool_start",
      data: {
        type: "tool_start",
        timestamp: Date.now(),
        toolName,
        params,
      } as SseEventData & { toolName: string; params: Record<string, unknown> },
    });
  }

  recordToolEnd(toolName: string, result: unknown): void {
    this.record({
      id: crypto.randomUUID(),
      event: "tool_end",
      data: {
        type: "tool_end",
        timestamp: Date.now(),
        toolName,
        result,
      } as SseEventData & { toolName: string; result: unknown },
    });
  }

  recordMessage(content: string, role: "user" | "assistant" | "system" = "assistant"): void {
    this.record({
      id: crypto.randomUUID(),
      event: "message",
      data: {
        type: "message",
        timestamp: Date.now(),
        content,
        role,
      } as SseEventData & { content: string; role: string },
    });
  }

  getEvents(): SseMessage[] {
    return [...this.events];
  }

  getEventsByType(type: SseEventType): SseMessage[] {
    return this.events.filter((e) => e.event === type);
  }

  getLastEventId(): string | null {
    return this.lastEventId;
  }

  getConnectionId(): string | null {
    return this.connectionId;
  }

  clear(): void {
    this.events = [];
    this.connectionId = null;
    this.lastEventId = null;
  }

  replay(): SseMessage[] {
    return this.getEvents();
  }

  toSseString(): string {
    return this.events
      .map((e) => {
        const data = JSON.stringify(e.data);
        return `id: ${e.id}\nevent: ${e.event}\ndata: ${data}\n`;
      })
      .join("\n");
  }
}
