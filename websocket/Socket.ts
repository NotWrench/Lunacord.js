// websocket/Socket.ts

import {
  type PlayerUpdate,
  type ReadyPayload,
  type Stats,
  type TrackEvent,
  WebSocketMessageSchema,
} from "../types.ts";
import { TypedEventEmitter } from "../utils/EventEmitter.ts";

interface SocketEvents {
  close: { code: number; reason: string };
  error: Error;
  event: TrackEvent;
  playerUpdate: PlayerUpdate;
  ready: ReadyPayload;
  reconnecting: { attempt: number; delay: number };
  stats: Stats;
}

interface SocketOptions {
  clientName: string;
  host: string;
  numShards: number;
  password: string;
  port: number;
  userId: string;
}

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30_000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class Socket extends TypedEventEmitter<SocketEvents> {
  private readonly options: SocketOptions;
  public sessionId: string | null = null;
  private ws: WebSocket | null = null;
  private intentionalClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: SocketOptions) {
    super();
    this.options = options;
  }

  connect(): void {
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, "Intentional disconnect");
      this.ws = null;
    }
  }

  send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.emit("error", new Error("WebSocket is not connected"));
      return;
    }

    try {
      this.ws.send(JSON.stringify(data));
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private openConnection(): void {
    const { host, port, password, userId, numShards, clientName } = this.options;
    const url = `ws://${host}:${port}/v4/websocket`;

    const headers: Record<string, string> = {
      Authorization: password,
      "User-Id": userId,
      "Num-Shards": String(numShards),
      "Client-Name": `${clientName}/1.0.0`,
    };

    if (this.sessionId) {
      headers["Session-Id"] = this.sessionId;
    }

    this.ws = new WebSocket(url, { headers } as unknown as string[]);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.emit("close", { code: event.code, reason: event.reason });

      if (!this.intentionalClose) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = () => {
      this.emit("error", new Error("WebSocket connection error"));
    };
  }

  private handleMessage(raw: unknown): void {
    let parsed: unknown;

    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      this.emit("error", new Error("Failed to parse WebSocket message"));
      return;
    }

    const result = WebSocketMessageSchema.safeParse(parsed);

    if (!result.success) {
      this.emit("error", new Error(`Invalid WebSocket message: ${result.error.message}`));
      return;
    }

    const message = result.data;

    switch (message.op) {
      case "ready":
        this.sessionId = message.sessionId;
        this.emit("ready", message);
        break;
      case "playerUpdate":
        this.emit("playerUpdate", message);
        break;
      case "stats":
        this.emit("stats", message);
        break;
      case "event":
        this.emit("event", message);
        break;

      default:
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit("error", new Error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * 2 ** (this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );

    this.emit("reconnecting", {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, delay);
  }
}
