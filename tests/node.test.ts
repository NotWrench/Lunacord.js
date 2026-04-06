import { afterEach, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { Node } from "../core/Node";
import { Track } from "../structures/Track";
import type { RawTrack } from "../types";

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

    it("should use secure protocols when configured", async () => {
      const originalWebSocket = globalThis.WebSocket;
      const webSocketUrls: string[] = [];
      const fetchUrls: string[] = [];

      class MockWebSocket {
        static readonly OPEN = 1;
        readonly readyState = MockWebSocket.OPEN;
        onclose: ((event: CloseEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onopen: (() => void) | null = null;

        constructor(url: string | URL) {
          webSocketUrls.push(String(url));
          queueMicrotask(() => {
            this.onopen?.();
            this.onmessage?.({
              data: JSON.stringify(createReadyPayload()),
            } as MessageEvent);
          });
        }

        close(): void {}
        send(): void {}
      }

      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock((url: string | URL) => {
        fetchUrls.push(String(url));
        return Promise.resolve(
          new Response(JSON.stringify({ loadType: "empty", data: {} }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }) as unknown as typeof fetch;

      const secureNode = new Node({
        ...NODE_OPTIONS,
        secure: true,
      });

      await secureNode.connect();
      await secureNode.rest.loadTracks("ytsearch:test");

      expect(webSocketUrls).toEqual(["wss://localhost:2333/v4/websocket"]);
      expect(fetchUrls).toEqual([
        "https://localhost:2333/v4/loadtracks?identifier=ytsearch%3Atest",
      ]);

      globalThis.fetch = originalFetch;
      globalThis.WebSocket = originalWebSocket;
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

    it("should replay the same track when repeatTrack is enabled", async () => {
      node.sessionId = "session-123";
      node.rest.updatePlayer = mock(() => Promise.resolve());

      const player = node.createPlayer("guild-repeat-track");
      const queuedTrack = new Track({
        ...MOCK_RAW_TRACK,
        encoded: "QAABJAMACk5ldmVyIEdvbm5hX3F1ZXVl...",
      });
      player.add(queuedTrack);
      player.repeatTrack(true);

      node.socket.emit("event", {
        op: "event",
        guildId: "guild-repeat-track",
        type: "TrackEndEvent",
        track: MOCK_RAW_TRACK,
        reason: "finished",
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(player.current?.encoded).toBe(MOCK_RAW_TRACK.encoded);
      expect(player.queue.size).toBe(1);
      expect(player.queue.peek()?.encoded).toBe(queuedTrack.encoded);
    });

    it("should rotate queue when repeatQueue is enabled", async () => {
      node.sessionId = "session-123";
      node.rest.updatePlayer = mock(() => Promise.resolve());

      const player = node.createPlayer("guild-repeat-queue");
      const queuedTrack = new Track({
        ...MOCK_RAW_TRACK,
        encoded: "QAABJAMACk5ldmVyIEdvbm5hX3F1ZXVlX25leHQ...",
      });
      player.add(queuedTrack);
      player.repeatQueue(true);

      node.socket.emit("event", {
        op: "event",
        guildId: "guild-repeat-queue",
        type: "TrackEndEvent",
        track: MOCK_RAW_TRACK,
        reason: "finished",
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(player.current?.encoded).toBe(queuedTrack.encoded);
      expect(player.queue.size).toBe(1);
      expect(player.queue.peek()?.encoded).toBe(MOCK_RAW_TRACK.encoded);
    });
  });

  describe("voice packet handling", () => {
    it("should emit playerCreate when creating a new player", () => {
      const events: string[] = [];

      node.on("playerCreate", ({ guildId }) => {
        events.push(guildId);
      });

      node.createPlayer("guild-create");
      expect(events).toEqual(["guild-create"]);
    });

    it("should expose a cached voice payload after both VOICE packets are received", () => {
      node.handleVoicePacket({
        t: "VOICE_STATE_UPDATE",
        d: {
          guild_id: "guild-123",
          user_id: "user-123",
          session_id: "voice-session-123",
          channel_id: "channel-123",
        },
      });

      node.handleVoicePacket({
        t: "VOICE_SERVER_UPDATE",
        d: {
          guild_id: "guild-123",
          token: "voice-token",
          endpoint: "us-east.discord.gg",
        },
      });

      expect(node.getVoicePayload("guild-123")).toEqual({
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
      const events: string[] = [];

      nodeWithVoiceAdapter.on("playerConnect", ({ guildId, channelId }) => {
        events.push(`${guildId}:${channelId}`);
      });

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
      expect(events).toEqual(["guild-789:channel-789"]);
    });

    it("should no-op connectVoice when already connected to the same channel", async () => {
      const sendGatewayPayload = mock(() => Promise.resolve());
      const nodeWithVoiceAdapter = new Node({
        ...NODE_OPTIONS,
        sendGatewayPayload,
      });
      const player = nodeWithVoiceAdapter.createPlayer("guild-900");

      nodeWithVoiceAdapter.handleVoicePacket({
        t: "VOICE_STATE_UPDATE",
        d: {
          guild_id: "guild-900",
          user_id: "user-123",
          session_id: "voice-session-900",
          channel_id: "channel-900",
        },
      });
      nodeWithVoiceAdapter.handleVoicePacket({
        t: "VOICE_SERVER_UPDATE",
        d: {
          guild_id: "guild-900",
          token: "voice-token-900",
          endpoint: "us-east.discord.gg",
        },
      });

      sendGatewayPayload.mockClear();
      await nodeWithVoiceAdapter.connectVoice("guild-900", "channel-900");

      expect(sendGatewayPayload).not.toHaveBeenCalled();
      expect(player.isConnected).toBe(true);
    });

    it("should emit voiceSocketClosed events and not emit error for WebSocketClosedEvent", () => {
      const player = node.createPlayer("guild-123");
      player.connected = true;
      const voiceEvents: string[] = [];
      const wsEvents: string[] = [];
      const errors: Error[] = [];

      node.on("voiceSocketClosed", (event) => {
        voiceEvents.push(
          `${event.guildId}:${event.code}:${event.reason}:${event.byRemote ? "remote" : "local"}`
        );
      });
      node.on("ws", (event) => {
        wsEvents.push(event.type);
      });
      node.on("error", (error) => {
        errors.push(error);
      });

      node.socket.emit("event", {
        op: "event",
        guildId: "guild-123",
        type: "WebSocketClosedEvent",
        code: 4014,
        reason: "Disconnected",
        byRemote: true,
      });

      node.socket.emit("event", {
        op: "event",
        guildId: "guild-999",
        type: "WebSocketClosedEvent",
        code: 1000,
        reason: "No player",
        byRemote: false,
      });

      expect(player.isConnected).toBe(false);
      expect(voiceEvents).toEqual([
        "guild-123:4014:Disconnected:remote",
        "guild-999:1000:No player:local",
      ]);
      expect(wsEvents).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });

    it("should emit nodeDisconnect ws events when socket closes", () => {
      const wsEvents: string[] = [];
      const errors: Error[] = [];

      node.on("ws", (event) => {
        if (event.type === "nodeDisconnect") {
          wsEvents.push(`${event.code}:${event.reason}`);
        }
      });
      node.on("error", (error) => {
        errors.push(error);
      });

      node.socket.emit("close", { code: 1006, reason: "Connection lost" });

      expect(wsEvents).toEqual(["1006:Connection lost"]);
      expect(errors).toHaveLength(0);
    });

    it("should emit playerDisconnect events for manual disconnect", async () => {
      const sendGatewayPayload = mock(() => Promise.resolve());
      const nodeWithVoiceAdapter = new Node({
        ...NODE_OPTIONS,
        sendGatewayPayload,
      });
      const events: string[] = [];

      nodeWithVoiceAdapter.on("playerDisconnect", ({ guildId, reason }) => {
        events.push(`${guildId}:${reason}`);
      });

      await nodeWithVoiceAdapter.disconnectVoice("guild-123");

      expect(events).toEqual(["guild-123:manual"]);
    });

    it("should emit nodeReconnecting ws events when socket reconnects", () => {
      const wsEvents: string[] = [];

      node.on("ws", (event) => {
        if (event.type === "nodeReconnecting") {
          wsEvents.push(`${event.attempt}:${event.delay}`);
        }
      });

      node.socket.emit("reconnecting", { attempt: 2, delay: 2_000 });

      expect(wsEvents).toEqual(["2:2000"]);
    });
  });

  describe("player action events", () => {
    it("should surface play/pause/resume/volume/stop/queue/skip events", async () => {
      node.sessionId = "session-123";
      node.rest.updatePlayer = mock(() => Promise.resolve());

      const player = node.createPlayer("guild-events");
      const events: string[] = [];

      node.on("playerPlay", () => events.push("playerPlay"));
      node.on("playerPause", () => events.push("playerPause"));
      node.on("playerResume", () => events.push("playerResume"));
      node.on("playerVolumeUpdate", () => events.push("playerVolumeUpdate"));
      node.on("playerStop", () => events.push("playerStop"));
      node.on("playerQueueAdd", () => events.push("playerQueueAdd"));
      node.on("playerQueueRemove", () => events.push("playerQueueRemove"));
      node.on("playerSkip", () => events.push("playerSkip"));

      const track = new Track(MOCK_RAW_TRACK);
      const nextTrack = new Track({
        ...MOCK_RAW_TRACK,
        encoded: "QAABJAMACk5ldmVyIEdvbm5hX25leHQ...",
      });

      player.add(track);
      player.remove(0);

      await player.play(track);
      await player.pause(true);
      await player.pause(false);
      await player.setVolume(250);
      await player.stop(false, false);

      player.current = track;
      player.add(nextTrack);
      await player.skip();

      expect(events).toEqual([
        "playerQueueAdd",
        "playerQueueRemove",
        "playerPlay",
        "playerPause",
        "playerResume",
        "playerVolumeUpdate",
        "playerStop",
        "playerQueueAdd",
        "playerStop",
        "playerPlay",
        "playerSkip",
      ]);
    });
  });

  describe("player state sync", () => {
    it("should update player state from playerUpdate payloads", () => {
      const player = node.createPlayer("guild-sync");
      player.current = new Track(MOCK_RAW_TRACK);

      node.socket.emit("playerUpdate", {
        op: "playerUpdate",
        guildId: "guild-sync",
        state: {
          time: 1_000,
          position: 5_000,
          connected: true,
          ping: 77,
        },
      });

      expect(player.position).toBe(5_000);
      expect(player.isConnected).toBe(true);
      expect(player.ping).toBe(77);
    });
  });

  describe("restore", () => {
    it("should restore managed player state after reconnect", async () => {
      node.sessionId = "session-123";
      node.rest.updatePlayer = mock(() => Promise.resolve());

      const player = node.createPlayer("guild-restore");
      player.current = new Track(MOCK_RAW_TRACK);
      player.volume = 250;
      player.paused = true;
      player.filters = {
        timescale: {
          speed: 1.1,
        },
      };
      player.position = 12_000;

      node.handleVoicePacket({
        t: "VOICE_STATE_UPDATE",
        d: {
          guild_id: "guild-restore",
          user_id: "user-123",
          session_id: "voice-session-restore",
          channel_id: "channel-restore",
        },
      });
      node.handleVoicePacket({
        t: "VOICE_SERVER_UPDATE",
        d: {
          guild_id: "guild-restore",
          token: "voice-token-restore",
          endpoint: "us-east.discord.gg",
        },
      });

      await node.restorePlayer(player);

      expect(node.rest.updatePlayer).toHaveBeenCalledWith("session-123", "guild-restore", {
        track: {
          encoded: MOCK_RAW_TRACK.encoded,
        },
        position: 12_000,
        volume: 250,
        paused: true,
        filters: {
          timescale: {
            speed: 1.1,
          },
        },
        voice: {
          endpoint: "us-east.discord.gg",
          sessionId: "voice-session-restore",
          token: "voice-token-restore",
        },
      });
    });
  });

  describe("stats", () => {
    it("should cache the latest stats payload", () => {
      expect(node.latestStats).toBeNull();

      node.socket.emit("stats", {
        op: "stats",
        players: 1,
        playingPlayers: 1,
        uptime: 10,
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
      });

      expect(node.latestStats?.players).toBe(1);
    });
  });
});
