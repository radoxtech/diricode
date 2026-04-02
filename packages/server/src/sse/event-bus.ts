type EventBusListener = (event: string, payload: unknown) => void;

export class EventBus {
  private readonly listeners = new Set<EventBusListener>();

  subscribe(listener: EventBusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: string, payload: unknown): void {
    for (const listener of this.listeners) {
      listener(event, payload);
    }
  }
}

export const eventBus = new EventBus();
