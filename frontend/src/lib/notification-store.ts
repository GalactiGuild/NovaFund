import type { Notification } from "@/types/notifications";

const MAX_HISTORY = 100;

interface StreamClient {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
}

/** In-memory store for notifications and SSE clients. Works when running a single Node process (e.g. next dev / next start). */
const store = {
  history: [] as Notification[],
  clients: new Set<StreamClient>(),

  add(notification: Omit<Notification, "id" | "createdAt">): Notification {
    const item: Notification = {
      ...notification,
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.history.push(item);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.broadcast(item);
    return item;
  },

  broadcast(notification: Notification) {
    const data = `data: ${JSON.stringify(notification)}\n\n`;
    const encoder = new TextEncoder();
    this.clients.forEach((client) => {
      try {
        client.controller.enqueue(encoder.encode(data));
      } catch {
        this.clients.delete(client);
      }
    });
  },

  subscribe(controller: ReadableStreamDefaultController<Uint8Array>) {
    const client: StreamClient = { controller, encoder: new TextEncoder() };
    this.clients.add(client);
    return () => this.clients.delete(client);
  },

  getHistory(limit = 50): Notification[] {
    return [...this.history].reverse().slice(0, limit);
  },
};

export default store;
