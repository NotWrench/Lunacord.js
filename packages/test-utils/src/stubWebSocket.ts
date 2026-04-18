import type { WebSocketFactory, WebSocketFactoryContext } from "@lunacord/core";

/**
 * Stub `WebSocket` that conforms to Lunacord's `WebSocketLike` contract so tests can
 * drive the socket lifecycle programmatically. Push messages with `.pushServerMessage()`.
 */
export interface StubWebSocket {
  readonly headers: Record<string, string>;
  pushServerMessage(payload: unknown): void;
  readonly sentMessages: string[];
  // biome-ignore lint/suspicious/noExplicitAny: opaque stub shape, matches Lunacord WebSocketLike structurally
  readonly socket: any;
  triggerClose(code: number, reason: string): void;
  triggerError(): void;
  triggerOpen(): void;
  readonly url: string;
}

const READY_STATE_CONNECTING = 0;
const READY_STATE_OPEN = 1;
const READY_STATE_CLOSED = 3;

export const createStubWebSocketFactory = (): {
  factory: WebSocketFactory;
  instances: StubWebSocket[];
} => {
  const instances: StubWebSocket[] = [];

  const factory: WebSocketFactory = (context: WebSocketFactoryContext) => {
    let readyState = READY_STATE_CONNECTING;
    const sentMessages: string[] = [];
    let onopen: ((e: unknown) => void) | null = null;
    let onclose: ((e: { code?: number; reason?: string }) => void) | null = null;
    let onerror: ((e: unknown) => void) | null = null;
    let onmessage: ((e: { data: string | Blob | ArrayBufferLike }) => void) | null = null;

    const socket = {
      get readyState(): number {
        return readyState;
      },
      close(code = 1000, reason = "intentional"): void {
        readyState = READY_STATE_CLOSED;
        onclose?.({ code, reason });
      },
      send(data: string): void {
        sentMessages.push(data);
      },
      get onopen(): ((e: unknown) => void) | null {
        return onopen;
      },
      set onopen(value: ((e: unknown) => void) | null) {
        onopen = value;
      },
      get onclose(): ((e: { code?: number; reason?: string }) => void) | null {
        return onclose;
      },
      set onclose(value: ((e: { code?: number; reason?: string }) => void) | null) {
        onclose = value;
      },
      get onerror(): ((e: unknown) => void) | null {
        return onerror;
      },
      set onerror(value: ((e: unknown) => void) | null) {
        onerror = value;
      },
      get onmessage(): ((e: { data: string | Blob | ArrayBufferLike }) => void) | null {
        return onmessage;
      },
      set onmessage(value: ((e: { data: string | Blob | ArrayBufferLike }) => void) | null) {
        onmessage = value;
      },
    };

    const instance: StubWebSocket = {
      url: context.url,
      headers: context.headers,
      sentMessages,
      socket,
      triggerOpen() {
        readyState = READY_STATE_OPEN;
        onopen?.({});
      },
      triggerClose(code, reason) {
        readyState = READY_STATE_CLOSED;
        onclose?.({ code, reason });
      },
      triggerError() {
        onerror?.({});
      },
      pushServerMessage(payload) {
        onmessage?.({ data: JSON.stringify(payload) });
      },
    };

    instances.push(instance);
    return socket;
  };

  return { factory, instances };
};
