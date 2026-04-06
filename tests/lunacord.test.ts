import { afterEach, beforeEach, describe, expect, it, mock, spyOn, vi } from "bun:test";
import { Lunacord } from "../core/Lunacord";
import { Node } from "../core/Node";
import { Track } from "../structures/Track";
import { type LoadResult, type RawTrack, SearchProvider } from "../types";

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

describe("Lunacord", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should create nodes from config", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);

    expect(lunacord.getNodes()).toHaveLength(2);
    expect(lunacord.getNode("node-a")?.id).toBe("node-a");
    expect(lunacord.getNode("node-b")?.id).toBe("node-b");
  });

  it("should emit nodeCreate for managed nodes", async () => {
    const createdNodeIds: string[] = [];
    const lunacord = new Lunacord(BASE_OPTIONS);

    lunacord.on("nodeCreate", ({ node }) => {
      createdNodeIds.push(node.id);
    });

    await Promise.resolve();

    expect(createdNodeIds.sort()).toEqual(["node-a", "node-b"]);
  });

  it("should connect all nodes explicitly", async () => {
    const lunacord = new Lunacord(BASE_OPTIONS);

    for (const node of lunacord.getNodes()) {
      node.connect = mock(() => Promise.resolve());
    }

    await expect(lunacord.connect()).resolves.toBeUndefined();

    for (const node of lunacord.getNodes()) {
      expect(node.connect).toHaveBeenCalledTimes(1);
    }
  });

  it("should auto connect and reuse the same startup promise", async () => {
    const connectSpy = spyOn(Node.prototype, "connect").mockImplementation(function (this: Node) {
      this.sessionId = `session:${this.id}`;
      return Promise.resolve();
    });

    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      autoConnect: true,
    });

    const startupPromise = lunacord.connect();

    await expect(startupPromise).resolves.toBeUndefined();
    expect(lunacord.connect()).toBe(startupPromise);
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

    const lunacord = new Lunacord(BASE_OPTIONS);

    await expect(lunacord.connect()).rejects.toThrow("Failed to connect node node-b: boom");
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });

  it("should choose the least-loaded node for new players", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const existing = nodeA!.createPlayer("guild-existing");
    expect(existing.guildId).toBe("guild-existing");

    const player = lunacord.createPlayer("guild-new");

    expect(player.guildId).toBe("guild-new");
    expect(nodeB!.getPlayer("guild-new")).toBe(player);
  });

  it("should choose nodes in round-robin order", () => {
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      nodeSelection: {
        type: "roundRobin",
      },
    });
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const playerA = lunacord.createPlayer("guild-1");
    const playerB = lunacord.createPlayer("guild-2");

    expect(nodeA!.getPlayer("guild-1")).toBe(playerA);
    expect(nodeB!.getPlayer("guild-2")).toBe(playerB);
  });

  it("should choose nodes using weighted strategy", () => {
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      nodeSelection: {
        type: "weighted",
      },
    });
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";
    nodeA!.latestStats = {
      op: "stats",
      players: 5,
      playingPlayers: 5,
      uptime: 1,
      memory: { free: 1, used: 9, allocated: 10, reservable: 10 },
      cpu: { cores: 4, systemLoad: 0.8, lavalinkLoad: 0.8 },
    };
    nodeB!.latestStats = {
      op: "stats",
      players: 1,
      playingPlayers: 1,
      uptime: 1,
      memory: { free: 8, used: 2, allocated: 10, reservable: 10 },
      cpu: { cores: 4, systemLoad: 0.1, lavalinkLoad: 0.1 },
    };

    const player = lunacord.createPlayer("guild-weighted");

    expect(nodeB!.getPlayer("guild-weighted")).toBe(player);
  });

  it("should choose nodes by region when requested", () => {
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      nodes: [
        {
          ...BASE_OPTIONS.nodes[0],
          regions: ["us-east"],
        },
        {
          ...BASE_OPTIONS.nodes[1],
          regions: ["eu-west"],
        },
      ],
      nodeSelection: {
        type: "region",
      },
    });
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = lunacord.createPlayer("guild-region", { region: "eu-west" });

    expect(nodeB!.getPlayer("guild-region")).toBe(player);
  });

  it("should use failover order when region fallback is configured", () => {
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      nodes: [
        {
          ...BASE_OPTIONS.nodes[0],
          regions: ["us-east"],
        },
        {
          ...BASE_OPTIONS.nodes[1],
          regions: ["us-west"],
        },
      ],
      nodeSelection: {
        type: "region",
        fallback: {
          type: "failover",
          order: ["node-b", "node-a"],
        },
      },
    });
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = lunacord.createPlayer("guild-region-fallback", { region: "eu-central" });

    expect(nodeB!.getPlayer("guild-region-fallback")).toBe(player);
  });

  it("should choose nodes by failover order", () => {
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      nodeSelection: {
        type: "failover",
        order: ["node-b", "node-a"],
      },
    });
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = lunacord.createPlayer("guild-failover");

    expect(nodeB!.getPlayer("guild-failover")).toBe(player);
  });

  it("should reuse the same player for the same guild", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = lunacord.createPlayer("guild-123");
    const samePlayer = lunacord.createPlayer("guild-123");

    expect(samePlayer).toBe(player);
    expect(lunacord.getPlayer("guild-123")).toBe(player);
  });

  it("should remove manager bookkeeping when a player is destroyed", async () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";
    nodeA!.rest.destroyPlayer = mock(() => Promise.resolve());

    lunacord.createPlayer("guild-123");
    await lunacord.destroyPlayer("guild-123");

    expect(lunacord.getPlayer("guild-123")).toBeUndefined();
  });

  it("should re-emit node events with node context", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const readyEvents: string[] = [];

    lunacord.on("ready", ({ node: sourceNode }) => {
      readyEvents.push(sourceNode.id);
    });

    node.emit("ready", createReadyPayload("session-a"));

    expect(readyEvents).toEqual(["node-a"]);
  });

  it("should re-emit nodeConnect with node context", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const events: string[] = [];

    lunacord.on("nodeConnect", ({ node: sourceNode, sessionId }) => {
      events.push(`${sourceNode.id}:${sessionId}`);
    });

    node.emit("ready", createReadyPayload("session-a"));

    expect(events).toEqual(["node-a:session-a"]);
  });

  it("should re-emit node errors with node context", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const errors: string[] = [];
    const original = new Error("node failed");

    lunacord.on("error", (error) => {
      errors.push(`${error.node.id}:${error.message}`);
    });

    node.emit("error", original);

    expect(errors).toEqual(["node-a:node failed"]);
    expect("node" in original).toBe(false);
  });

  it("should re-emit nodeError with node context", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const errors: string[] = [];

    lunacord.on("nodeError", (error) => {
      errors.push(`${error.node.id}:${error.message}`);
    });

    node.emit("error", new Error("node failed"));

    expect(errors).toEqual(["node-a:node failed"]);
  });

  it("should re-emit playerDestroy with node context", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const events: string[] = [];

    lunacord.on("playerDestroy", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:${guildId}`);
    });

    node.emit("playerDestroy", { guildId: "guild-123" });

    expect(events).toEqual(["node-a:guild-123"]);
  });

  it("should re-emit all player action events with node context", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const track = new Track(MOCK_RAW_TRACK);
    const events: string[] = [];

    lunacord.on("playerCreate", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:create:${guildId}`);
    });
    lunacord.on("playerConnect", ({ guildId, channelId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:connect:${guildId}:${channelId}`);
    });
    lunacord.on("playerDisconnect", ({ guildId, reason, node: sourceNode }) => {
      events.push(`${sourceNode.id}:disconnect:${guildId}:${reason}`);
    });
    lunacord.on("playerPause", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:pause:${guildId}`);
    });
    lunacord.on("playerResume", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:resume:${guildId}`);
    });
    lunacord.on("playerPlay", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:play:${guildId}`);
    });
    lunacord.on("playerQueueAdd", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:queueAdd:${guildId}`);
    });
    lunacord.on("playerQueueRemove", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:queueRemove:${guildId}`);
    });
    lunacord.on("playerRepeatQueue", ({ guildId, enabled, node: sourceNode }) => {
      events.push(`${sourceNode.id}:repeatQueue:${guildId}:${enabled ? "on" : "off"}`);
    });
    lunacord.on("playerRepeatTrack", ({ guildId, enabled, node: sourceNode }) => {
      events.push(`${sourceNode.id}:repeatTrack:${guildId}:${enabled ? "on" : "off"}`);
    });
    lunacord.on("playerSkip", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:skip:${guildId}`);
    });
    lunacord.on("playerStop", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:stop:${guildId}`);
    });
    lunacord.on("playerFiltersUpdate", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:filtersUpdate:${guildId}`);
    });
    lunacord.on("playerFiltersClear", ({ guildId, node: sourceNode }) => {
      events.push(`${sourceNode.id}:filtersClear:${guildId}`);
    });
    lunacord.on("playerVolumeUpdate", ({ guildId, node: sourceNode }) => {
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
      reason: "manual",
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
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const events: string[] = [];

    lunacord.on("ws", (event) => {
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
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const events: string[] = [];

    lunacord.on("nodeVoiceSocketClosed", (event) => {
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
    const lunacord = new Lunacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    lunacord.createPlayer("guild-123");

    nodeA!.handleVoicePacket = mock(() => {});
    nodeB!.handleVoicePacket = mock(() => {});

    lunacord.handleVoicePacket({
      t: "VOICE_STATE_UPDATE",
      d: {
        guild_id: "guild-123",
      },
    });

    expect(nodeA!.handleVoicePacket).toHaveBeenCalledTimes(1);
    expect(nodeB!.handleVoicePacket).not.toHaveBeenCalled();
  });

  it("should fan out voice packets when no guild owner exists yet", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";
    nodeA!.handleVoicePacket = mock(() => {});
    nodeB!.handleVoicePacket = mock(() => {});

    lunacord.handleVoicePacket({
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
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      sendGatewayPayload,
    });

    await lunacord.connectVoice("guild-123", "channel-123");

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
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      sendGatewayPayload,
    });
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = await lunacord.connectPlayer("guild-123", "channel-123");

    expect(player.guildId).toBe("guild-123");
    expect(lunacord.isPlayerConnected("guild-123")).toBe(true);
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
    const lunacord = new Lunacord({
      ...BASE_OPTIONS,
      sendGatewayPayload,
    });
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    lunacord.createPlayer("guild-123");
    await lunacord.disconnectVoice("guild-123");

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

  it("should disconnect synchronously", () => {
    const lunacord = new Lunacord(BASE_OPTIONS);

    const result = lunacord.disconnect();

    expect(result).toBeUndefined();
  });

  it("should restore managed players when a node becomes ready again", async () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    node.sessionId = "session-a";
    const player = lunacord.createPlayer("guild-restore");

    const restoreSpy = mock(() => Promise.resolve());
    node.restorePlayer = restoreSpy;

    node.emit("ready", createReadyPayload("session-a"));
    await Promise.resolve();

    expect(restoreSpy).toHaveBeenCalledWith(player);
  });

  it("should not restore managed players when Lavalink resumes the session", async () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    node.sessionId = "session-a";
    lunacord.createPlayer("guild-restore-resumed");

    const restoreSpy = mock(() => Promise.resolve());
    node.restorePlayer = restoreSpy;

    node.emit("ready", {
      op: "ready",
      resumed: true,
      sessionId: "session-a",
    });
    await Promise.resolve();

    expect(restoreSpy).not.toHaveBeenCalled();
  });

  it("should let plugins observe manager events", async () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const observed: string[] = [];

    lunacord.use({
      name: "observer",
      observe: (event) => {
        observed.push(event.type);
      },
    });

    node.emit("ready", createReadyPayload("session-a"));
    await Promise.resolve();

    expect(observed).toContain("ready");
    expect(observed).toContain("nodeConnect");
  });

  it("should let plugins transform player search results", async () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const [nodeA, nodeB] = lunacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";
    lunacord.use({
      name: "search-transform",
      transformSearchResult: (context, result) => {
        expect(context.provider).toBe(SearchProvider.YouTube);
        return {
          ...result,
          tracks: result.tracks.slice(0, 1),
        };
      },
    });

    const player = lunacord.createPlayer("guild-search");
    const ownerNode = lunacord.getNode("node-a")!.getPlayer("guild-search")
      ? lunacord.getNode("node-a")!
      : lunacord.getNode("node-b")!;
    ownerNode.rest.search = mock(
      (): Promise<LoadResult> =>
        Promise.resolve({
          loadType: "search",
          data: [
            MOCK_RAW_TRACK,
            {
              ...MOCK_RAW_TRACK,
              encoded: "second-track",
              info: {
                ...MOCK_RAW_TRACK.info,
                identifier: "second-track",
                title: "Second Track",
              },
            },
          ],
        })
    );

    const result = await player.search("rick astley", SearchProvider.YouTube);

    expect(result.tracks).toHaveLength(1);
  });

  it("should let plugins intercept REST requests for managed nodes", async () => {
    const lunacord = new Lunacord(BASE_OPTIONS);
    const node = lunacord.getNode("node-a")!;
    const requests: string[] = [];

    node.sessionId = "session-a";
    node.rest.use({
      beforeRequest: (context) => {
        requests.push(context.path);
      },
    });

    lunacord.use({
      name: "rest-observer",
      beforeRestRequest: (context) => {
        requests.push(`${context.node.id}:${context.path}`);
      },
    });

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ loadType: "empty", data: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as unknown as typeof fetch;

    await node.rest.loadTracks("ytsearch:test");

    expect(requests).toContain("/v4/loadtracks?identifier=ytsearch%3Atest");
    expect(requests).toContain("node-a:/v4/loadtracks?identifier=ytsearch%3Atest");
  });
});
