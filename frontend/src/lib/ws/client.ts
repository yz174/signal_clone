import { API_BASE } from "@/lib/api/client";

export type ServerEventType =
  | "message.created"
  | "message.deleted"
  | "message.reaction"
  | "receipt.updated"
  | "typing.updated"
  | "presence.updated"
  | "conversation.updated"
  | "member.changed";

export interface ServerEvent {
  type: ServerEventType;
  sent_at: string;
  payload: Record<string, unknown>;
}

type EventHandler = (event: ServerEvent) => void;
type OpenHandler = () => void;

const FIRST_RETRY_MS = 500;
const MAX_RETRY_MS = 15_000;
const HEARTBEAT_MS = 25_000;

function socketUrl(token: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private retryDelay = FIRST_RETRY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private closedByUs = false;

  private readonly eventHandlers = new Set<EventHandler>();
  private readonly openHandlers = new Set<OpenHandler>();

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onOpen(handler: OpenHandler): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  connect(token: string): void {
    this.token = token;
    this.closedByUs = false;
    this.open();
  }

  disconnect(): void {
    this.closedByUs = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
  }

  send(frame: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(frame));
    }
  }

  private open(): void {
    if (!this.token) return;

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.onclose = null;
      this.socket.close();
    }

    const socket = new WebSocket(socketUrl(this.token));
    this.socket = socket;

    socket.onopen = () => {
      this.retryDelay = FIRST_RETRY_MS;
      this.startHeartbeat();
      for (const handler of this.openHandlers) handler();
    };

    socket.onmessage = (message) => {
      const event = JSON.parse(message.data as string) as ServerEvent;
      for (const handler of this.eventHandlers) handler(event);
    };

    socket.onclose = () => {
      this.clearTimers();
      if (!this.closedByUs) this.scheduleReconnect();
    };

    socket.onerror = () => socket.close();
  }

  private scheduleReconnect(): void {
    const jitter = Math.random() * 250;
    this.reconnectTimer = setTimeout(() => this.open(), this.retryDelay + jitter);
    this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_MS);
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => this.send({ type: "ping" }), HEARTBEAT_MS);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.reconnectTimer = null;
    this.heartbeat = null;
  }
}

export const realtime = new RealtimeClient();
