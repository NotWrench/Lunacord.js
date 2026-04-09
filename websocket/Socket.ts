import {
  type PlayerUpdate,
  type ReadyPayload,
  type Stats,
  type TrackEvent,
  WebSocketMessageSchema,
} from "../types";
import { TypedEventEmitter } from "../utils/EventEmitter";

interface SocketEvents {
  close: { code: number; reason: string };
  error: Error;
  event: TrackEvent;
  playerUpdate: PlayerUpdate;
  ready: ReadyPayload;
  reconnectFailed: { attempts: number };
  reconnecting: { attempt: number; delay: number };
  stats: Stats;
}

interface SocketOptions {
  clientName: string;
  host: string;
  initialReconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  maxReconnectDelayMs?: number;
  numShards: number;
  password: string;
  port: number;
  secure?: boolean;
  userId: string;
  webSocketFactory?: WebSocketFactory;
}

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30_000;
const MAX_RECONNECT_ATTEMPTS = 5;

type JsonPrimitive = boolean | null | number | string;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface WebSocketCloseEvent {
  code?: number;
  reason?: string;
}

interface WebSocketMessageEvent {
  data: string | Blob | ArrayBufferLike;
}

interface WebSocketLike {
  close: (code?: number, reason?: string) => void;
  onclose: ((event: WebSocketCloseEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: WebSocketMessageEvent) => void) | null;
  onopen: ((event: unknown) => void) | null;
  readonly readyState: number;
  send: (data: string) => void;
}

export interface WebSocketFactoryContext {
  headers: Record<string, string>;
  url: string;
}

export type WebSocketFactory = (context: WebSocketFactoryContext) => WebSocketLike;

const SOCKET_READY_STATE_OPEN = 1;
const UNKNOWN_CLOSE_CODE = 1006;
const UNKNOWN_CLOSE_REASON = "WebSocket closed";

export class Socket extends TypedEventEmitter<SocketEvents> {
  private readonly options: SocketOptions;
  public sessionId: string | null = null;
  private ws: WebSocketLike | null = null;
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

  send(data: JsonValue): void {
    if (!this.ws || this.ws.readyState !== SOCKET_READY_STATE_OPEN) {
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
    const { host, port, password, userId, numShards, clientName, secure } = this.options;
    const protocol = secure ? "wss" : "ws";
    const url = `${protocol}://${host}:${port}/v4/websocket`;

    const headers: Record<string, string> = {
      Authorization: password,
      "User-Id": userId,
      "Num-Shards": String(numShards),
      "Client-Name": `${clientName}/1.0.0`,
    };

    if (this.sessionId) {
      headers["Session-Id"] = this.sessionId;
    }

    this.ws = this.createWebSocket(url, headers);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.emit("close", {
        code: event.code ?? UNKNOWN_CLOSE_CODE,
        reason: event.reason ?? UNKNOWN_CLOSE_REASON,
      });

      if (!this.intentionalClose) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = () => {
      this.emit("error", new Error("WebSocket connection error"));
    };
  }

  private createWebSocket(url: string, headers: Record<string, string>): WebSocketLike {
    if (this.options.webSocketFactory) {
      return this.options.webSocketFactory({
        url,
        headers,
      });
    }

    if (typeof globalThis.WebSocket !== "function") {
      throw new Error(
        "No global WebSocket implementation found. Provide webSocketFactory in Node options."
      );
    }

    const RuntimeWebSocket = globalThis.WebSocket as unknown as {
      new (url: string, protocols?: string | string[]): WebSocketLike;
    };

    try {
      return new RuntimeWebSocket(url, {
        headers,
      } as unknown as string[]);
    } catch {
      throw new Error(
        "This WebSocket runtime does not support custom headers. Provide webSocketFactory in Node/Lunacord options."
      );
    }
  }

  private handleMessage(raw: string | Blob | ArrayBufferLike): void {
    let parsed: unknown;

    try {
      if (typeof raw === "string") {
        parsed = JSON.parse(raw);
      } else if (raw instanceof ArrayBuffer) {
        parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(raw)));
      } else if (ArrayBuffer.isView(raw)) {
        parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(raw.buffer)));
      } else if (raw instanceof Blob) {
        void raw.text().then(
          (text) => {
            this.handleMessage(text);
          },
          () => {
            this.emit("error", new Error("Failed to read WebSocket binary message"));
          }
        );
        return;
      } else {
        this.emit("error", new Error("Unsupported WebSocket message type"));
        return;
      }
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
    const maxReconnectAttempts = this.options.maxReconnectAttempts ?? MAX_RECONNECT_ATTEMPTS;
    const initialReconnectDelay = this.options.initialReconnectDelayMs ?? INITIAL_RECONNECT_DELAY;
    const maxReconnectDelay = this.options.maxReconnectDelayMs ?? MAX_RECONNECT_DELAY;

    if (this.reconnectAttempts >= maxReconnectAttempts) {
      this.emit("reconnectFailed", {
        attempts: this.reconnectAttempts,
      });
      this.emit("error", new Error(`Failed to reconnect after ${maxReconnectAttempts} attempts`));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      initialReconnectDelay * 2 ** (this.reconnectAttempts - 1),
      maxReconnectDelay
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
