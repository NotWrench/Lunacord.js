import { describe, expect, it } from "bun:test";
import { Socket } from "../websocket/Socket";

const SOCKET_OPTIONS = {
  host: "localhost",
  port: 2333,
  password: "youshallnotpass",
  userId: "user-123",
  numShards: 1,
  clientName: "LunacordTest",
} as const;

const getHandleMessage = (socket: Socket): ((raw: string) => void) => {
  const handleMessage = Reflect.get(socket, "handleMessage") as (this: Socket, raw: string) => void;
  return (raw: string): void => {
    handleMessage.call(socket, raw);
  };
};

describe("Socket", () => {
  it("should throw a clear error when runtime websocket cannot accept headers", () => {
    const originalWebSocket = globalThis.WebSocket;

    class HeaderRejectingWebSocket {
      static readonly OPEN = 1;

      constructor(_url: string | URL, protocols?: string | string[]) {
        if (protocols !== undefined) {
          throw new TypeError("invalid protocols");
        }
      }

      close(): void {}
      send(): void {}
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readonly readyState = HeaderRejectingWebSocket.OPEN;
    }

    globalThis.WebSocket = HeaderRejectingWebSocket as unknown as typeof WebSocket;

    try {
      const socket = new Socket(SOCKET_OPTIONS);
      expect(() => socket.connect()).toThrow(
        "This WebSocket runtime does not support custom headers. Provide webSocketFactory in Node/Lunacord options."
      );
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("should preserve non-header constructor errors", () => {
    const originalWebSocket = globalThis.WebSocket;

    class BrokenWebSocket {
      static readonly OPEN = 1;

      constructor() {
        throw new Error("DNS lookup failed");
      }

      close(): void {}
      send(): void {}
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readonly readyState = BrokenWebSocket.OPEN;
    }

    globalThis.WebSocket = BrokenWebSocket as unknown as typeof WebSocket;

    try {
      const socket = new Socket(SOCKET_OPTIONS);
      expect(() => socket.connect()).toThrow("DNS lookup failed");
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("should wrap non-Error constructor throws in a new Error", () => {
    const originalWebSocket = globalThis.WebSocket;

    class ThrowingWebSocket {
      static readonly OPEN = 1;

      constructor() {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "unexpected string error";
      }

      close(): void {}
      send(): void {}
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readonly readyState = ThrowingWebSocket.OPEN;
    }

    globalThis.WebSocket = ThrowingWebSocket as unknown as typeof WebSocket;

    try {
      const socket = new Socket(SOCKET_OPTIONS);
      expect(() => socket.connect()).toThrow("Failed to create WebSocket");
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("should map 'invalid protocols' constructor error to friendly message", () => {
    const originalWebSocket = globalThis.WebSocket;
    const message = "invalid protocols";

    class ProtocolRejectingWebSocket {
      static readonly OPEN = 1;
      constructor() { throw new TypeError(message); }
      close(): void {}
      send(): void {}
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readonly readyState = ProtocolRejectingWebSocket.OPEN;
    }

    globalThis.WebSocket = ProtocolRejectingWebSocket as unknown as typeof WebSocket;

    try {
      const socket = new Socket(SOCKET_OPTIONS);
      expect(() => socket.connect()).toThrow(
        "This WebSocket runtime does not support custom headers. Provide webSocketFactory in Node/Lunacord options."
      );
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("should map 'unsupported headers' constructor error to friendly message", () => {
    const originalWebSocket = globalThis.WebSocket;
    const message = "unsupported headers";

    class ProtocolRejectingWebSocket {
      static readonly OPEN = 1;
      constructor() { throw new TypeError(message); }
      close(): void {}
      send(): void {}
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readonly readyState = ProtocolRejectingWebSocket.OPEN;
    }

    globalThis.WebSocket = ProtocolRejectingWebSocket as unknown as typeof WebSocket;

    try {
      const socket = new Socket(SOCKET_OPTIONS);
      expect(() => socket.connect()).toThrow(
        "This WebSocket runtime does not support custom headers. Provide webSocketFactory in Node/Lunacord options."
      );
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("should map 'subprotocol' constructor error to friendly message", () => {
    const originalWebSocket = globalThis.WebSocket;
    const message = "subprotocol error";

    class ProtocolRejectingWebSocket {
      static readonly OPEN = 1;
      constructor() { throw new TypeError(message); }
      close(): void {}
      send(): void {}
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readonly readyState = ProtocolRejectingWebSocket.OPEN;
    }

    globalThis.WebSocket = ProtocolRejectingWebSocket as unknown as typeof WebSocket;

    try {
      const socket = new Socket(SOCKET_OPTIONS);
      expect(() => socket.connect()).toThrow(
        "This WebSocket runtime does not support custom headers. Provide webSocketFactory in Node/Lunacord options."
      );
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("should map 'protocol value' constructor error to friendly message", () => {
    const originalWebSocket = globalThis.WebSocket;
    const message = "protocol value rejected";

    class ProtocolRejectingWebSocket {
      static readonly OPEN = 1;
      constructor() { throw new TypeError(message); }
      close(): void {}
      send(): void {}
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readonly readyState = ProtocolRejectingWebSocket.OPEN;
    }

    globalThis.WebSocket = ProtocolRejectingWebSocket as unknown as typeof WebSocket;

    try {
      const socket = new Socket(SOCKET_OPTIONS);
      expect(() => socket.connect()).toThrow(
        "This WebSocket runtime does not support custom headers. Provide webSocketFactory in Node/Lunacord options."
      );
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("should emit an error for invalid websocket payloads", () => {
    const socket = new Socket(SOCKET_OPTIONS);
    const errors: Error[] = [];

    socket.on("error", (error) => {
      errors.push(error);
    });

    getHandleMessage(socket)('{"op":"invalid"}');

    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("Invalid WebSocket message");
  });

  it("should emit ready, playerUpdate, stats, and event payloads", () => {
    const socket = new Socket(SOCKET_OPTIONS);
    const readyEvents: string[] = [];
    const playerUpdates: number[] = [];
    const statsEvents: number[] = [];
    const trackEvents: string[] = [];
    const handleMessage = getHandleMessage(socket);

    socket.on("ready", (payload) => {
      readyEvents.push(payload.sessionId);
    });
    socket.on("playerUpdate", (payload) => {
      playerUpdates.push(payload.state.position);
    });
    socket.on("stats", (payload) => {
      statsEvents.push(payload.players);
    });
    socket.on("event", (payload) => {
      trackEvents.push(payload.type);
    });

    handleMessage(JSON.stringify({ op: "ready", resumed: false, sessionId: "session-123" }));
    handleMessage(
      JSON.stringify({
        op: "playerUpdate",
        guildId: "guild-123",
        state: {
          time: 1,
          position: 42,
          connected: true,
          ping: 0,
        },
      })
    );
    handleMessage(
      JSON.stringify({
        op: "stats",
        players: 2,
        playingPlayers: 1,
        uptime: 1_000,
        memory: {
          free: 1,
          used: 2,
          allocated: 3,
          reservable: 4,
        },
        cpu: {
          cores: 4,
          systemLoad: 0.1,
          lavalinkLoad: 0.2,
        },
      })
    );
    handleMessage(
      JSON.stringify({
        op: "event",
        guildId: "guild-123",
        type: "TrackStartEvent",
        track: {
          encoded: "encoded-track",
          info: {
            identifier: "track-123",
            isSeekable: true,
            author: "Artist",
            length: 123_000,
            isStream: false,
            position: 0,
            title: "Track",
            uri: null,
            artworkUrl: null,
            isrc: null,
            sourceName: "youtube",
          },
        },
      })
    );

    expect(readyEvents).toEqual(["session-123"]);
    expect(playerUpdates).toEqual([42]);
    expect(statsEvents).toEqual([2]);
    expect(trackEvents).toEqual(["TrackStartEvent"]);
  });

  it("should decode binary websocket messages", () => {
    const socket = new Socket(SOCKET_OPTIONS);
    const readyEvents: string[] = [];
    const handleMessage = Reflect.get(socket, "handleMessage") as (
      this: Socket,
      raw: ArrayBuffer
    ) => void;

    socket.on("ready", (payload) => {
      readyEvents.push(payload.sessionId);
    });

    handleMessage.call(
      socket,
      new TextEncoder().encode(JSON.stringify({ op: "ready", resumed: false, sessionId: "binary" }))
        .buffer
    );

    expect(readyEvents).toEqual(["binary"]);
  });

  it("should decode sliced typed-array websocket messages", () => {
    const socket = new Socket(SOCKET_OPTIONS);
    const readyEvents: string[] = [];
    const handleMessage = Reflect.get(socket, "handleMessage") as (
      this: Socket,
      raw: Uint8Array
    ) => void;

    socket.on("ready", (payload) => {
      readyEvents.push(payload.sessionId);
    });

    const encoded = new TextEncoder().encode(
      JSON.stringify({ op: "ready", resumed: false, sessionId: "typed-view" })
    );
    const padded = new Uint8Array(encoded.length + 4);
    padded.set(encoded, 2);
    const slicedView = padded.subarray(2, 2 + encoded.length);

    handleMessage.call(socket, slicedView);

    expect(readyEvents).toEqual(["typed-view"]);
  });

  it("should decode typed-array view with non-zero byteOffset correctly and not read padding bytes", () => {
    const socket = new Socket(SOCKET_OPTIONS);
    const errors: Error[] = [];
    const readyEvents: string[] = [];
    const handleMessage = Reflect.get(socket, "handleMessage") as (
      this: Socket,
      raw: Uint8Array
    ) => void;

    socket.on("error", (err) => errors.push(err));
    socket.on("ready", (payload) => readyEvents.push(payload.sessionId));

    const payload = JSON.stringify({ op: "ready", resumed: false, sessionId: "offset-view" });
    const payloadBytes = new TextEncoder().encode(payload);

    // Create a buffer with 8 bytes of garbage before and after the payload
    const garbageBefore = 8;
    const garbageAfter = 8;
    const fullBuffer = new Uint8Array(garbageBefore + payloadBytes.length + garbageAfter);
    // Fill the whole buffer with 0xFF to ensure garbage bytes are non-null
    fullBuffer.fill(0xff);
    fullBuffer.set(payloadBytes, garbageBefore);

    // Slice exactly the payload region
    const view = fullBuffer.subarray(garbageBefore, garbageBefore + payloadBytes.length);

    handleMessage.call(socket, view);

    expect(errors).toHaveLength(0);
    expect(readyEvents).toEqual(["offset-view"]);
  });

  it("should honor reconnect configuration", () => {
    const socket = new Socket({
      ...SOCKET_OPTIONS,
      initialReconnectDelayMs: 5,
      maxReconnectAttempts: 2,
      maxReconnectDelayMs: 10,
    });
    const reconnectEvents: string[] = [];
    const attemptReconnect = Reflect.get(socket, "attemptReconnect") as (this: Socket) => void;

    socket.on("reconnecting", ({ attempt, delay }) => {
      reconnectEvents.push(`${attempt}:${delay}`);
    });

    attemptReconnect.call(socket);
    attemptReconnect.call(socket);

    expect(reconnectEvents).toEqual(["1:5", "2:10"]);
  });
});