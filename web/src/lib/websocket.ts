import { useAuthStore } from "../stores/authStore";

type MessageHandler = (data: unknown) => void;

class WebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isIntentionalClose = false;

  connect() {
    const { token } = useAuthStore.getState();
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws?token=${token}`;

    this.isIntentionalClose = false;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.heartbeatInterval = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string };
        const handlers = this.listeners.get(data.type);
        handlers?.forEach((handler) => handler(data));
      } catch {
        /* intentionally empty */
      }
    };

    this.socket.onclose = () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (
        !this.isIntentionalClose &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        const delay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts),
          30000,
        );
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };

    this.socket.onerror = () => {
      /* intentionally empty - handled by onclose */
    };
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  on(eventType: string, handler: MessageHandler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: MessageHandler) {
    this.listeners.get(eventType)?.delete(handler);
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new WebSocketManager();
