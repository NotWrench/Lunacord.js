import { afterEach, beforeEach, describe, expect, it, mock, spyOn, vi } from "bun:test";
import { Lavacord } from "../core/Lavacord.ts";
import { Node } from "../core/Node.ts";
import { Track } from "../structures/Track.ts";
import type { RawTrack } from "../types.ts";

const BASE_OPTIONS = {
  nodes: [
    {
      id: "node-a",
      host: "localhost",
      port: 2333,
      password: "pass-a",
    },
    {
      id: "node-b",
      host: "localhost",
      port: 2444,
      password: "pass-b",
    },
  ],
  numShards: 1,
  userId: "user-123",
} as const;

const createReadyPayload = (sessionId: string) => ({
  op: "ready" as const,
  resumed: false,
  sessionId,
});

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

describe("Lavacord", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create nodes from config", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);

    expect(lavacord.getNodes()).toHaveLength(2);
    expect(lavacord.getNode("node-a")?.id).toBe("node-a");
    expect(lavacord.getNode("node-b")?.id).toBe("node-b");
  });

  it("should emit nodeCreate for managed nodes", async () => {
    const createdNodeIds: string[] = [];
    const lavacord = new Lavacord(BASE_OPTIONS);

    lavacord.on("nodeCreate", ({ node }) => {
      createdNodeIds.push(node.id);
    });

    await Promise.resolve();

    expect(createdNodeIds.sort()).toEqual(["node-a", "node-b"]);
  });

  it("should connect all nodes explicitly", async () => {
    const lavacord = new Lavacord(BASE_OPTIONS);

    for (const node of lavacord.getNodes()) {
      node.connect = mock(() => Promise.resolve());
    }

    await expect(lavacord.connect()).resolves.toBeUndefined();

    for (const node of lavacord.getNodes()) {
      expect(node.connect).toHaveBeenCalledTimes(1);
    }
  });

  it("should auto connect and reuse the same startup promise", async () => {
    const connectSpy = spyOn(Node.prototype, "connect").mockImplementation(function (this: Node) {
      this.sessionId = `session:${this.id}`;
      return Promise.resolve();
    });

    const lavacord = new Lavacord({
      ...BASE_OPTIONS,
      autoConnect: true,
    });

    const startupPromise = lavacord.connect();

    await expect(startupPromise).resolves.toBeUndefined();
    expect(lavacord.connect()).toBe(startupPromise);
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });

  it("should fail startup clearly when one managed node fails", async () => {
    const connectSpy = spyOn(Node.prototype, "connect").mockImplementation(function (this: Node) {
      if (this.id === "node-b") {
        return Promise.reject(new Error("boom"));
      }

      this.sessionId = `session:${this.id}`;
      return Promise.resolve();
    });

    const lavacord = new Lavacord(BASE_OPTIONS);

    await expect(lavacord.connect()).rejects.toThrow("Failed to connect node node-b: boom");
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });

  it("should choose the least-loaded node for new players", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const existing = nodeA!.createPlayer("guild-existing");
    expect(existing.guildId).toBe("guild-existing");

    const player = lavacord.createPlayer("guild-new");

    expect(player.guildId).toBe("guild-new");
    expect(nodeB!.getPlayer("guild-new")).toBe(player);
  });

  it("should reuse the same player for the same guild", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = lavacord.createPlayer("guild-123");
    const samePlayer = lavacord.createPlayer("guild-123");

    expect(samePlayer).toBe(player);
    expect(lavacord.getPlayer("guild-123")).toBe(player);
  });

  it("should remove manager bookkeeping when a player is destroyed", async () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";
    nodeA!.rest.destroyPlayer = mock(() => Promise.resolve());

    lavacord.createPlayer("guild-123");
    await lavacord.destroyPlayer("guild-123");

    expect(lavacord.getPlayer("guild-123")).toBeUndefined();
  });

  it("should re-emit node events with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const readyEvents: string[] = [];

    lavacord.on("ready", ({ node: sourceNode }) => {
      readyEvents.push(sourceNode.id);
    });

    node.emit("ready", createReadyPayload("session-a"));

    expect(readyEvents).toEqual(["node-a"]);
  });

  it("should re-emit nodeConnect with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const events: string[] = [];

    lavacord.on("nodeConnect", ({ node: sourceNode, sessionId }) => {
      events.push(`${sourceNode.id}:${sessionId}`);
    });

    node.emit("ready", createReadyPayload("session-a"));

    expect(events).toEqual(["node-a:session-a"]);
  });

  it("should re-emit node errors with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const errors: string[] = [];

    lavacord.on("error", (error) => {
      errors.push(`${error.node.id}:${error.message}`);
    });

    node.emit("error", new Error("node failed"));

    expect(errors).toEqual(["node-a:node failed"]);
  });

  it("should re-emit nodeError with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const errors: string[] = [];

    lavacord.on("nodeError", (error) => {
      errors.push(`${error.node.id}:${error.message}`);
    });

    node.emit("error", new Error("node failed"));

    expect(errors).toEqual(["node-a:node failed"]);
  });

  it("should re-emit playerDestroy with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const events: string[] = [];

    lavacord.on("playerDestroy", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:${guildId}`);
    });

    node.emit("playerDestroy", { guildId: "guild-123" });

    expect(events).toEqual(["node-a:guild-123"]);
  });

  it("should re-emit all player action events with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const track = new Track(MOCK_RAW_TRACK);
    const events: string[] = [];

    lavacord.on("playerCreate", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:create:${guildId}`);
    });
    lavacord.on("playerConnect", ({ guildId, channelId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:connect:${guildId}:${channelId}`);
    });
    lavacord.on("playerDisconnect", ({ guildId, reason, node: sourceNode }) => {
      events.push(`${sourceNode.id}:disconnect:${guildId}:${reason}`);
    });
    lavacord.on("playerPause", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:pause:${guildId}`);
    });
    lavacord.on("playerResume", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:resume:${guildId}`);
    });
    lavacord.on("playerPlay", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:play:${guildId}`);
    });
    lavacord.on("playerQueueAdd", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:queueAdd:${guildId}`);
    });
    lavacord.on("playerQueueRemove", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:queueRemove:${guildId}`);
    });
    lavacord.on("playerRepeatQueue", ({ guildId, enabled, node: sourceNode }) => {
      events.push(`${sourceNode.id}:repeatQueue:${guildId}:${enabled ? "on" : "off"}`);
    });
    lavacord.on("playerRepeatTrack", ({ guildId, enabled, node: sourceNode }) => {
      events.push(`${sourceNode.id}:repeatTrack:${guildId}:${enabled ? "on" : "off"}`);
    });
    lavacord.on("playerSkip", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:skip:${guildId}`);
    });
    lavacord.on("playerStop", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:stop:${guildId}`);
    });
    lavacord.on("playerFiltersUpdate", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:filtersUpdate:${guildId}`);
    });
    lavacord.on("playerFiltersClear", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:filtersClear:${guildId}`);
    });
    lavacord.on("playerVolumeUpdate", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:volume:${guildId}`);
    });

    node.createPlayer("guild-123");
    node.emit("playerConnect", {
      guildId: "guild-123",
      channelId: "channel-123",
      selfDeaf: true,
      selfMute: false,
    });
    node.emit("playerDisconnect", {
      guildId: "guild-123",
      reason: "manual",
    });
    node.emit("playerPause", { guildId: "guild-123" });
    node.emit("playerResume", { guildId: "guild-123" });
    node.emit("playerPlay", {
      guildId: "guild-123",
      track,
      source: "direct",
    });
    node.emit("playerQueueAdd", {
      guildId: "guild-123",
      track,
      queueSize: 1,
    });
    node.emit("playerQueueRemove", {
      guildId: "guild-123",
      track,
      index: 0,
      queueSize: 0,
    });
    node.emit("playerRepeatQueue", {
      guildId: "guild-123",
      enabled: true,
    });
    node.emit("playerRepeatTrack", {
      guildId: "guild-123",
      enabled: false,
    });
    node.emit("playerSkip", {
      guildId: "guild-123",
      skippedTrack: track,
      nextTrack: null,
    });
    node.emit("playerStop", {
      guildId: "guild-123",
      destroyPlayer: false,
      disconnectVoice: false,
    });
    node.emit("playerVolumeUpdate", {
      guildId: "guild-123",
      volume: 250,
    });
    node.emit("playerFiltersUpdate", {
      guildId: "guild-123",
      filters: {
        timescale: {
          speed: 1.1,
        },
      },
    });
    node.emit("playerFiltersClear", {
      guildId: "guild-123",
      filters: {},
    });

    expect(events).toEqual([
      "node-a:create:guild-123",
      "node-a:connect:guild-123:channel-123",
      "node-a:disconnect:guild-123:manual",
      "node-a:pause:guild-123",
      "node-a:resume:guild-123",
      "node-a:play:guild-123",
      "node-a:queueAdd:guild-123",
      "node-a:queueRemove:guild-123",
      "node-a:repeatQueue:guild-123:on",
      "node-a:repeatTrack:guild-123:off",
      "node-a:skip:guild-123",
      "node-a:stop:guild-123",
      "node-a:volume:guild-123",
      "node-a:filtersUpdate:guild-123",
      "node-a:filtersClear:guild-123",
    ]);
  });

  it("should re-emit ws with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const events: string[] = [];

    lavacord.on("ws", (event) => {
      if (event.type === "nodeReconnecting") {
        events.push(`${event.node.id}:${event.attempt}:${event.delay}`);
      }
    });

    node.emit("ws", {
      type: "nodeReconnecting",
      attempt: 1,
      delay: 1_000,
    });

    expect(events).toEqual(["node-a:1:1000"]);
  });

  it("should re-emit nodeVoiceSocketClosed with node context", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const node = lavacord.getNode("node-a")!;
    const events: string[] = [];

    lavacord.on("nodeVoiceSocketClosed", (event) => {
      events.push(`${event.node.id}:${event.guildId}:${event.code}:${event.reason}`);
    });

    node.emit("voiceSocketClosed", {
      guildId: "guild-123",
      code: 1000,
      reason: "Closed",
      byRemote: true,
    });

    expect(events).toEqual(["node-a:guild-123:1000:Closed"]);
  });

  it("should route voice packets to the owning node", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    lavacord.createPlayer("guild-123");

    nodeA!.handleVoicePacket = mock(() => {});
    nodeB!.handleVoicePacket = mock(() => {});

    lavacord.handleVoicePacket({
      t: "VOICE_STATE_UPDATE",
      d: {
        guild_id: "guild-123",
      },
    });

    expect(nodeA!.handleVoicePacket).toHaveBeenCalledTimes(1);
    expect(nodeB!.handleVoicePacket).not.toHaveBeenCalled();
  });

  it("should fan out voice packets when no guild owner exists yet", () => {
    const lavacord = new Lavacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";
    nodeA!.handleVoicePacket = mock(() => {});
    nodeB!.handleVoicePacket = mock(() => {});

    lavacord.handleVoicePacket({
      t: "VOICE_SERVER_UPDATE",
      d: {
        guild_id: "guild-999",
      },
    });

    expect(nodeA!.handleVoicePacket).toHaveBeenCalledTimes(1);
    expect(nodeB!.handleVoicePacket).toHaveBeenCalledTimes(1);
  });

  it("should call the shared voice callback for connectVoice", async () => {
    const sendGatewayPayload = mock(() => Promise.resolve());
    const lavacord = new Lavacord({
      ...BASE_OPTIONS,
      sendGatewayPayload,
    });

    await lavacord.connectVoice("guild-123", "channel-123");

    expect(sendGatewayPayload).toHaveBeenCalledWith("guild-123", {
      op: 4,
      d: {
        guild_id: "guild-123",
        channel_id: "channel-123",
        self_mute: false,
        self_deaf: true,
      },
    });
  });

  it("should connect a player to voice with connectPlayer", async () => {
    const sendGatewayPayload = mock(() => Promise.resolve());
    const lavacord = new Lavacord({
      ...BASE_OPTIONS,
      sendGatewayPayload,
    });
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = await lavacord.connectPlayer("guild-123", "channel-123");

    expect(player.guildId).toBe("guild-123");
    expect(lavacord.isPlayerConnected("guild-123")).toBe(true);
    expect(sendGatewayPayload).toHaveBeenCalledWith("guild-123", {
      op: 4,
      d: {
        guild_id: "guild-123",
        channel_id: "channel-123",
        self_mute: false,
        self_deaf: true,
      },
    });
  });

  it("should route disconnectVoice through the owning node", async () => {
    const sendGatewayPayload = mock(() => Promise.resolve());
    const lavacord = new Lavacord({
      ...BASE_OPTIONS,
      sendGatewayPayload,
    });
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    lavacord.createPlayer("guild-123");
    await lavacord.disconnectVoice("guild-123");

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
});
