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
