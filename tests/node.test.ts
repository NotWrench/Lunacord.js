import { afterEach, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { Node } from "../core/Node.ts";
import { Track } from "../structures/Track.ts";
import type { RawTrack } from "../types.ts";

const NODE_OPTIONS = {
  host: "localhost",
  port: 2333,
  password: "youshallnotpass",
  numShards: 1,
  userId: "user-123",
  clientName: "LunacordTest",
} as const;

const MOCK_RAW_TRACK: RawTrack = {
  encoded: "QAABJAMACk5ldmVyIEdvbm5h...",
  info: {
    identifier: "dQw4w9WgXcQ",
    isSeekable: true,
    author: "Rick Astley",
    length: 212_000,
    isStream: false,
    position: 0,
    title: "Never Gonna Give You Up",
    uri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const createReadyPayload = () => ({
  op: "ready" as const,
  resumed: false,
  sessionId: "session-123",
});

describe("Node", () => {
  let node: Node;

  beforeEach(() => {
    node = new Node(NODE_OPTIONS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("connect", () => {
    it("should resolve once the node is ready", async () => {
      node.socket.connect = mock(() => {
        queueMicrotask(() => {
          node.socket.emit("ready", createReadyPayload());
        });
      });

      await expect(node.connect()).resolves.toBeUndefined();
      expect(node.socket.connect).toHaveBeenCalledTimes(1);
    });

    it("should reject when the initial connection errors", async () => {
      node.socket.connect = mock(() => {
        queueMicrotask(() => {
          node.socket.emit("error", new Error("Initial connection failed"));
        });
      });

      expect(node.connect()).rejects.toThrow("Initial connection failed");
    });

    it("should reject when the initial connection times out", async () => {
      vi.useFakeTimers();
      node.socket.connect = mock(() => {});

      const connectPromise = node.connect();
      vi.advanceTimersByTime(10_000);

      await expect(connectPromise).rejects.toThrow("Timed out connecting to Lavalink");
    });
  });

  describe("track end handling", () => {
    it("should auto-advance the queue for finished tracks", async () => {
      const player = node.createPlayer("guild-123");
      const nextTrack = new Track(MOCK_RAW_TRACK);
      player.add(nextTrack);
      player.play = mock(() => Promise.resolve());

      node.socket.emit("event", {
        op: "event",
        guildId: "guild-123",
        type: "TrackEndEvent",
        track: MOCK_RAW_TRACK,
        reason: "finished",
      });

      await Promise.resolve();

      expect(player.play).toHaveBeenCalledTimes(1);
    });

    it("should surface auto-advance failures through the error event", async () => {
      const player = node.createPlayer("guild-123");
      const nextTrack = new Track(MOCK_RAW_TRACK);
      const errors: Error[] = [];
      player.add(nextTrack);
      player.play = mock(() => Promise.reject(new Error("Queue advance failed")));
      node.on("error", (error) => {
        errors.push(error);
      });

      node.socket.emit("event", {
        op: "event",
        guildId: "guild-123",
        type: "TrackEndEvent",
        track: MOCK_RAW_TRACK,
        reason: "finished",
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toBe("Queue advance failed");
    });
  });
});
