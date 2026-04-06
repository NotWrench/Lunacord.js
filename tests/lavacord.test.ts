import { afterEach, beforeEach, describe, expect, it, mock, spyOn, vi } from "bun:test";
import { Lavacord } from "../core/Lavacord.ts";
import { Node } from "../core/Node.ts";

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
    const setVoiceState = mock(() => Promise.resolve());
    const lavacord = new Lavacord({
      ...BASE_OPTIONS,
      setVoiceState,
    });

    await lavacord.connectVoice("guild-123", "channel-123");

    expect(setVoiceState).toHaveBeenCalledWith({
      channelId: "channel-123",
      guildId: "guild-123",
      selfDeaf: true,
      selfMute: false,
    });
  });

  it("should connect a player to voice with connectPlayer", async () => {
    const setVoiceState = mock(() => Promise.resolve());
    const lavacord = new Lavacord({
      ...BASE_OPTIONS,
      setVoiceState,
    });
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    const player = await lavacord.connectPlayer("guild-123", "channel-123");

    expect(player.guildId).toBe("guild-123");
    expect(lavacord.isPlayerConnected("guild-123")).toBe(true);
    expect(setVoiceState).toHaveBeenCalledWith({
      channelId: "channel-123",
      guildId: "guild-123",
      selfDeaf: true,
      selfMute: false,
    });
  });

  it("should route disconnectVoice through the owning node", async () => {
    const setVoiceState = mock(() => Promise.resolve());
    const lavacord = new Lavacord({
      ...BASE_OPTIONS,
      setVoiceState,
    });
    const [nodeA, nodeB] = lavacord.getNodes();

    nodeA!.sessionId = "session-a";
    nodeB!.sessionId = "session-b";

    lavacord.createPlayer("guild-123");
    await lavacord.disconnectVoice("guild-123");

    expect(setVoiceState).toHaveBeenCalledWith({
      channelId: null,
      guildId: "guild-123",
      selfDeaf: false,
      selfMute: false,
    });
  });
});
