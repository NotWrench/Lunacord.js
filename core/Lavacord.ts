import { TypedEventEmitter } from "../utils/EventEmitter.ts";
import {
  type GatewayVoiceStatePayload,
  Node,
  type NodeEvents,
  type NodeOptions,
  type VoiceConnectOptions,
} from "./Node.ts";
import type { Player } from "./Player.ts";

export interface LavacordNodeOptions {
  host: string;
  id?: string;
  password: string;
  port: number;
}

export interface LavacordOptions {
  autoConnect?: boolean;
  clientName?: string;
  nodes: readonly LavacordNodeOptions[];
  numShards: number;
  resume?: boolean;
  sendGatewayPayload?: (guildId: string, payload: GatewayVoiceStatePayload) => void | Promise<void>;
  timeout?: number;
  userId: string;
}

type NodeBound<T> = T & { node: Node };
type NodeBoundEvents = { [K in keyof NodeEvents]: NodeBound<NodeEvents[K]> };

export interface LavacordEvents extends NodeBoundEvents {
  nodeConnect: NodeBound<NodeEvents["ready"]>;
  nodeCreate: { node: Node };
  nodeDisconnect: NodeBound<Extract<NodeEvents["ws"], { type: "nodeDisconnect" }>>;
  nodeError: NodeBound<NodeEvents["error"]>;
  nodeReconnecting: NodeBound<Extract<NodeEvents["ws"], { type: "nodeReconnecting" }>>;
  nodeVoiceSocketClosed: NodeBound<NodeEvents["voiceSocketClosed"]>;
}

export class Lavacord extends TypedEventEmitter<LavacordEvents> {
  private readonly nodes = new Map<string, Node>();
  private readonly options: LavacordOptions;
  private readonly playerNodes = new Map<string, string>();
  private connectPromise: Promise<void> | null = null;

  constructor(options: LavacordOptions) {
    super();
    this.options = options;

    for (const [index, nodeOptions] of options.nodes.entries()) {
      const id = nodeOptions.id ?? `node-${index + 1}`;
      const node = new Node(this.createNodeOptions(id, nodeOptions));

      this.nodes.set(node.id, node);
      this.bindNodeEvents(node);

      queueMicrotask(() => {
        this.emit("nodeCreate", { node });
      });
    }

    if (options.autoConnect) {
      this.connectPromise = this.connectAllNodes();
    }
  }

  connect(): Promise<void> {
    this.connectPromise ??= this.connectAllNodes();
    return this.connectPromise;
  }

  async connectVoice(
    guildId: string,
    channelId: string,
    options?: VoiceConnectOptions
  ): Promise<void> {
    const player = this.getPlayer(guildId);
    if (player) {
      await player.connect(channelId, options);
      return;
    }

    const sendGatewayPayload = this.options.sendGatewayPayload;
    if (!sendGatewayPayload) {
      throw new Error("Lavacord was not configured with sendGatewayPayload");
    }

    await sendGatewayPayload(guildId, {
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: options?.selfMute ?? false,
        self_deaf: options?.selfDeaf ?? true,
      },
    });
  }

  async connectPlayer(
    guildId: string,
    channelId: string,
    options?: VoiceConnectOptions
  ): Promise<Player> {
    const player = this.createPlayer(guildId);
    await player.connect(channelId, options);
    return player;
  }

  async destroyPlayer(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (!node) {
      return;
    }

    await node.destroyPlayer(guildId);
    this.playerNodes.delete(guildId);
  }

  async disconnect(): Promise<void> {
    for (const node of this.nodes.values()) {
      node.disconnect();
    }

    this.playerNodes.clear();
    this.connectPromise = null;
  }

  async disconnectVoice(guildId: string): Promise<void> {
    const node = this.getNodeForGuild(guildId);
    if (!node) {
      return;
    }

    await node.disconnectVoice(guildId);
  }

  createPlayer(guildId: string): Player {
    const existing = this.getPlayer(guildId);
    if (existing) {
      return existing;
    }

    const node = this.getLeastLoadedNode();
    if (!node) {
      throw new Error("No connected Lavalink nodes are available");
    }

    const player = node.createPlayer(guildId);
    this.playerNodes.set(guildId, node.id);
    return player;
  }

  getLeastLoadedNode(): Node | undefined {
    const connectedNodes = this.getNodes().filter((node) => node.connected);
    if (connectedNodes.length === 0) {
      return undefined;
    }

    return connectedNodes.reduce((currentBest, candidate) =>
      candidate.playerCount < currentBest.playerCount ? candidate : currentBest
    );
  }

  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  getNodes(): Node[] {
    return [...this.nodes.values()];
  }

  getPlayer(guildId: string): Player | undefined {
    return this.getNodeForGuild(guildId)?.getPlayer(guildId);
  }

  isPlayerConnected(guildId: string): boolean {
    return this.getPlayer(guildId)?.isConnected ?? false;
  }

  handleVoicePacket(packet: unknown): void {
    const guildId = this.extractGuildId(packet);
    const owner = guildId ? this.getNodeForGuild(guildId) : undefined;

    if (owner) {
      owner.handleVoicePacket(packet);
      return;
    }

    for (const node of this.getNodes().filter((candidate) => candidate.connected)) {
      node.handleVoicePacket(packet);
    }
  }

  private bindNodeEvents(node: Node): void {
    node.on("playerDestroy", (payload) => {
      const { guildId } = payload;
      this.playerNodes.delete(guildId);
      this.emit("playerDestroy", { ...payload, node });
    });
    node.on("ready", (payload) => {
      this.emit("ready", { ...payload, node });
      this.emit("nodeConnect", { ...payload, node });
    });
    node.on("error", (error) => {
      this.emit("error", Object.assign(error, { node }));
      this.emit("nodeError", Object.assign(error, { node }));
    });
    node.on("playerUpdate", (payload) => {
      this.emit("playerUpdate", { ...payload, node });
    });
    node.on("stats", (payload) => {
      this.emit("stats", { ...payload, node });
    });
    node.on("trackStart", (payload) => {
      this.emit("trackStart", { ...payload, node });
    });
    node.on("trackEnd", (payload) => {
      this.emit("trackEnd", { ...payload, node });
    });
    node.on("trackException", (payload) => {
      this.emit("trackException", { ...payload, node });
    });
    node.on("trackStuck", (payload) => {
      this.emit("trackStuck", { ...payload, node });
    });
    node.on("voiceSocketClosed", (payload) => {
      this.emit("voiceSocketClosed", { ...payload, node });
      this.emit("nodeVoiceSocketClosed", { ...payload, node });
    });
    node.on("ws", (payload) => {
      this.emit("ws", { ...payload, node });

      switch (payload.type) {
        case "nodeDisconnect":
          this.emit("nodeDisconnect", { ...payload, node });
          break;
        case "nodeReconnecting":
          this.emit("nodeReconnecting", { ...payload, node });
          break;
        default:
          break;
      }
    });
  }

  private connectAllNodes(): Promise<void> {
    return Promise.all(
      this.getNodes().map((node) =>
        node.connect().catch((error) => {
          throw new Error(
            `Failed to connect node ${node.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        })
      )
    ).then(() => undefined);
  }

  private createNodeOptions(id: string, nodeOptions: LavacordNodeOptions): NodeOptions {
    return {
      clientName: this.options.clientName,
      host: nodeOptions.host,
      id,
      numShards: this.options.numShards,
      password: nodeOptions.password,
      port: nodeOptions.port,
      resume: this.options.resume,
      sendGatewayPayload: this.options.sendGatewayPayload,
      timeout: this.options.timeout,
      userId: this.options.userId,
    };
  }

  private extractGuildId(packet: unknown): string | undefined {
    if (typeof packet !== "object" || packet === null) {
      return undefined;
    }

    const data = "d" in packet ? packet.d : undefined;
    if (typeof data !== "object" || data === null) {
      return undefined;
    }

    return "guild_id" in data && typeof data.guild_id === "string" ? data.guild_id : undefined;
  }

  private getNodeForGuild(guildId: string): Node | undefined {
    const nodeId = this.playerNodes.get(guildId);
    return nodeId ? this.nodes.get(nodeId) : undefined;
  }
}
