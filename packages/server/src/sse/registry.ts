import type { SseConnection, SseEventType } from "./types.js";

export class SseRegistry {
  private readonly connections = new Map<string, SseConnection>();

  add(connection: SseConnection): void {
    this.connections.set(connection.id, connection);
  }

  remove(id: string): void {
    this.connections.delete(id);
  }

  get(id: string): SseConnection | undefined {
    return this.connections.get(id);
  }

  size(): number {
    return this.connections.size;
  }

  async broadcast(event: SseEventType, data: unknown): Promise<void> {
    const writes: Promise<void>[] = [];
    for (const connection of this.connections.values()) {
      writes.push(connection.write(event, data));
    }
    await Promise.allSettled(writes);
  }
}

export const sseRegistry = new SseRegistry();
