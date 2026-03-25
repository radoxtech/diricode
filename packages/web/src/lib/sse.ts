export type SSEClientOptions = {
  url: string;
  maxAttempts?: number;
  baseDelay?: number;
};

export class SSEClient {
  private url: string;
  private es: EventSource | null = null;
  private listeners: Record<string, ((event: MessageEvent) => void)[]> = {};
  private reconnectAttempts = 0;
  private maxAttempts: number;
  private baseDelay: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private shouldConnect = false;

  constructor(options: SSEClientOptions) {
    this.url = options.url;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.baseDelay = options.baseDelay ?? 1000;
  }

  public connect() {
    this.shouldConnect = true;
    if (this.isConnected || this.es) {
      this.disconnectInternal();
    }

    this.es = new EventSource(this.url);

    this.es.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
    };

    this.es.onerror = () => {
      this.isConnected = false;
      this.disconnectInternal();
      this.reconnect();
    };

    for (const [event, fns] of Object.entries(this.listeners)) {
      for (const fn of fns) {
        this.es.addEventListener(event, fn);
      }
    }
  }

  private reconnect() {
    if (!this.shouldConnect) return;
    if (this.reconnectAttempts >= this.maxAttempts) {
      console.error(`[SSEClient] Max reconnect attempts (${this.maxAttempts}) reached.`);
      return;
    }

    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.shouldConnect) {
        this.connect();
      }
    }, delay);
  }

  public on(event: string, fn: (event: MessageEvent) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(fn);
    if (this.es) {
      this.es.addEventListener(event, fn);
    }
  }

  public off(event: string, fn: (event: MessageEvent) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((l) => l !== fn);
    if (this.es) {
      this.es.removeEventListener(event, fn);
    }
  }

  private disconnectInternal() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.es) {
      this.es.close();
      this.es = null;
    }
    this.isConnected = false;
  }

  public disconnect() {
    this.shouldConnect = false;
    this.disconnectInternal();
  }
}
