import type { SseConnection } from "./types.js";

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
}

export const sseRegistry = new SseRegistry();
