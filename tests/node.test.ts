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

  describe("voice packet handling", () => {
    it("should resolve a voice payload after both VOICE packets are received", async () => {
      node.handleVoicePacket({
        t: "VOICE_STATE_UPDATE",
        d: {
          guild_id: "guild-123",
          user_id: "user-123",
          session_id: "voice-session-123",
          channel_id: "channel-123",
        },
      });

      const payloadPromise = node.resolveVoicePayload("guild-123");

      node.handleVoicePacket({
        t: "VOICE_SERVER_UPDATE",
        d: {
          guild_id: "guild-123",
          token: "voice-token",
          endpoint: "us-east.discord.gg",
        },
      });

      await expect(payloadPromise).resolves.toEqual({
        channelId: "channel-123",
        endpoint: "us-east.discord.gg",
        sessionId: "voice-session-123",
        token: "voice-token",
      });
    });

    it("should sync voice state to Lavalink when both VOICE packets are available", async () => {
      node.sessionId = "session-123";
      node.rest.updatePlayer = mock(() => Promise.resolve());

      node.handleVoicePacket({
        t: "VOICE_STATE_UPDATE",
        d: {
          guild_id: "guild-456",
          user_id: "user-123",
          session_id: "voice-session-456",
          channel_id: "channel-456",
        },
      });

      node.handleVoicePacket({
        t: "VOICE_SERVER_UPDATE",
        d: {
          guild_id: "guild-456",
          token: "voice-token-456",
          endpoint: "us-west.discord.gg",
        },
      });

      await Promise.resolve();

      expect(node.rest.updatePlayer).toHaveBeenCalledWith("session-123", "guild-456", {
        voice: {
          channelId: "channel-456",
          endpoint: "us-west.discord.gg",
          sessionId: "voice-session-456",
          token: "voice-token-456",
        },
      });
    });

    it("should send a gateway disconnect when disconnectVoice is called", async () => {
      const sendGatewayPayload = mock(() => Promise.resolve());
      const nodeWithVoiceAdapter = new Node({
        ...NODE_OPTIONS,
        sendGatewayPayload,
      });

      await nodeWithVoiceAdapter.disconnectVoice("guild-123");

      expect(sendGatewayPayload).toHaveBeenCalledWith("guild-123", {
        op: 4,
        d: {
          guild_id: "guild-123",
          channel_id: null,
          self_mute: false,
          self_deaf: false,
        },
      });
    });

    it("should send a gateway voice connect when connectVoice is called", async () => {
      const sendGatewayPayload = mock(() => Promise.resolve());
      const nodeWithVoiceAdapter = new Node({
        ...NODE_OPTIONS,
        sendGatewayPayload,
      });
      const player = nodeWithVoiceAdapter.createPlayer("guild-789");

      await nodeWithVoiceAdapter.connectVoice("guild-789", "channel-789");

      expect(sendGatewayPayload).toHaveBeenCalledWith("guild-789", {
        op: 4,
        d: {
          guild_id: "guild-789",
          channel_id: "channel-789",
          self_mute: false,
          self_deaf: true,
        },
      });
      expect(player.isConnected).toBe(true);
    });
  });
});
