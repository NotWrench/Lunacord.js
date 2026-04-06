import type {
  RestErrorContext,
  RestRequestContext,
  RestRequestPatch,
  RestResponseContext,
} from "../rest/Rest";
import type { SearchResult } from "../structures/SearchResult";
import type { SearchProvider } from "../types";
import { TypedEventEmitter } from "../utils/EventEmitter";
import {
  type GatewayVoiceStatePayload,
  Node,
  type NodeEvents,
  type NodeOptions,
  type VoiceConnectOptions,
} from "./Node";
import type { Player } from "./Player";

export class LunacordError extends Error {
  override readonly cause?: unknown;
  readonly node: Node;

  constructor(error: Error, node: Node) {
    super(error.message);
    this.name = error.name;
    this.node = node;
    this.cause = "cause" in error ? error.cause : undefined;
    this.stack = error.stack;
  }
}

export interface LunacordNodeOptions {
  host: string;
  id?: string;
  initialReconnectDelayMs?: number;
  maxReconnectAttempts?: number;
  maxReconnectDelayMs?: number;
  password: string;
  port: number;
  regions?: readonly string[];
  requestRetryAttempts?: number;
  requestRetryDelayMs?: number;
  requestTimeoutMs?: number;
  secure?: boolean;
}

export type LunacordNodeSelectionStrategy =
  | {
      type?: "leastLoaded";
    }
  | {
      type: "roundRobin";
    }
  | {
      cpuWeight?: number;
      memoryWeight?: number;
      playerWeight?: number;
      type: "weighted";
    }
  | {
      fallback?:
        | "leastLoaded"
        | "roundRobin"
        | "weighted"
        | {
            order: readonly string[];
            type: "failover";
          };
      type: "region";
    }
  | {
      order: readonly string[];
      type: "failover";
    };

export interface CreatePlayerOptions {
  preferredNodeIds?: readonly string[];
  region?: string;
}

export interface LunacordOptions {
  autoConnect?: boolean;
  clientName?: string;
  nodeSelection?: LunacordNodeSelectionStrategy;
  nodes: readonly LunacordNodeOptions[];
  numShards: number;
  resume?: boolean;
  sendGatewayPayload?: (guildId: string, payload: GatewayVoiceStatePayload) => void | Promise<void>;
  timeout?: number;
  userId: string;
}

type NodeBound<T> = T & { node: Node };
type NodeBoundEvents = { [K in keyof NodeEvents]: NodeBound<NodeEvents[K]> };

export interface LunacordEvents extends NodeBoundEvents {
  nodeConnect: NodeBound<NodeEvents["ready"]>;
  nodeCreate: { node: Node };
  nodeDisconnect: NodeBound<Extract<NodeEvents["ws"], { type: "nodeDisconnect" }>>;
  nodeError: NodeBound<NodeEvents["error"]>;
  nodeReconnecting: NodeBound<Extract<NodeEvents["ws"], { type: "nodeReconnecting" }>>;
  nodeStats: NodeBound<NodeEvents["stats"]>;
  nodeVoiceSocketClosed: NodeBound<NodeEvents["voiceSocketClosed"]>;
  playerConnect: NodeBound<NodeEvents["playerConnect"]>;
  playerCreate: NodeBound<NodeEvents["playerCreate"]>;
  playerDestroy: NodeBound<NodeEvents["playerDestroy"]>;
  playerDisconnect: NodeBound<NodeEvents["playerDisconnect"]>;
  playerFiltersClear: NodeBound<NodeEvents["playerFiltersClear"]>;
  playerFiltersUpdate: NodeBound<NodeEvents["playerFiltersUpdate"]>;
  playerPause: NodeBound<NodeEvents["playerPause"]>;
  playerPlay: NodeBound<NodeEvents["playerPlay"]>;
  playerQueueAdd: NodeBound<NodeEvents["playerQueueAdd"]>;
  playerQueueDedupe: NodeBound<NodeEvents["playerQueueDedupe"]>;
  playerQueueInsert: NodeBound<NodeEvents["playerQueueInsert"]>;
  playerQueueMove: NodeBound<NodeEvents["playerQueueMove"]>;
  playerQueueRemove: NodeBound<NodeEvents["playerQueueRemove"]>;
  playerQueueShuffle: NodeBound<NodeEvents["playerQueueShuffle"]>;
  playerRepeatQueue: NodeBound<NodeEvents["playerRepeatQueue"]>;
  playerRepeatTrack: NodeBound<NodeEvents["playerRepeatTrack"]>;
  playerResume: NodeBound<NodeEvents["playerResume"]>;
  playerSeek: NodeBound<NodeEvents["playerSeek"]>;
  playerSkip: NodeBound<NodeEvents["playerSkip"]>;
  playerStop: NodeBound<NodeEvents["playerStop"]>;
  playerUpdate: NodeBound<NodeEvents["playerUpdate"]>;
  playerVolumeUpdate: NodeBound<NodeEvents["playerVolumeUpdate"]>;
  ready: NodeBound<NodeEvents["ready"]>;
  trackEnd: NodeBound<NodeEvents["trackEnd"]>;
  trackException: NodeBound<NodeEvents["trackException"]>;
  trackStart: NodeBound<NodeEvents["trackStart"]>;
  trackStuck: NodeBound<NodeEvents["trackStuck"]>;
  voiceSocketClosed: NodeBound<NodeEvents["voiceSocketClosed"]>;
  ws: NodeBound<NodeEvents["ws"]>;
}

export type LunacordPluginEvent = {
  [K in keyof LunacordEvents]: { type: K } & LunacordEvents[K];
}[keyof LunacordEvents];

export interface LunacordPlugin {
  afterRestResponse?: (
    context: RestResponseContext & { node: Node }
  ) => Promise<unknown | void> | unknown | void;
  beforeRestRequest?: (
    context: RestRequestContext & { node: Node }
  ) => Promise<RestRequestPatch | void> | RestRequestPatch | void;
  name: string;
  observe?: (event: LunacordPluginEvent) => Promise<void> | void;
  onRestError?: (context: RestErrorContext & { node: Node }) => Promise<void> | void;
  transformSearchResult?: (
    context: {
      guildId: string;
      node: Node;
      player: Player;
      provider?: SearchProvider;
      query: string;
    },
    result: SearchResult
  ) => Promise<SearchResult> | SearchResult;
}

export class Lunacord extends TypedEventEmitter<LunacordEvents> {
  private readonly nodes = new Map<string, Node>();
  private readonly options: LunacordOptions;
  private readonly plugins: LunacordPlugin[] = [];
  private readonly playerNodes = new Map<string, string>();
  private connectPromise: Promise<void> | null = null;
  private notifyingPluginError = false;
  private roundRobinIndex = 0;

  constructor(options: LunacordOptions) {
    super();
    this.options = options;

    for (const [index, nodeOptions] of options.nodes.entries()) {
      const id = nodeOptions.id ?? `node-${index + 1}`;
      const node = new Node(this.createNodeOptions(id, nodeOptions));

      this.nodes.set(node.id, node);
      this.bindNodeEvents(node);
      this.refreshNodeSearchTransformers();

      queueMicrotask(() => {
        this.emitObserved("nodeCreate", { node });
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
      throw new Error("Lunacord was not configured with sendGatewayPayload");
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
    options?: VoiceConnectOptions,
    playerOptions?: CreatePlayerOptions
  ): Promise<Player> {
    const player = this.createPlayer(guildId, playerOptions);
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

  disconnect(): void {
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

  createPlayer(guildId: string, options?: CreatePlayerOptions): Player {
    const existing = this.getPlayer(guildId);
    if (existing) {
      return existing;
    }

    const node = this.selectNode(guildId, options);
    if (!node) {
      throw new Error("No connected Lavalink nodes are available");
    }

    const player = node.createPlayer(guildId);
    this.playerNodes.set(guildId, node.id);
    return player;
  }

  getLeastLoadedNode(): Node | undefined {
    const connectedNodes = this.getConnectedNodes();
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

  use(plugin: LunacordPlugin): this {
    this.plugins.push(plugin);

    for (const node of this.getNodes()) {
      node.rest.use({
        beforeRequest: plugin.beforeRestRequest
          ? (context) => plugin.beforeRestRequest?.({ ...context, node })
          : undefined,
        afterResponse: plugin.afterRestResponse
          ? (context) => plugin.afterRestResponse?.({ ...context, node })
          : undefined,
        onError: plugin.onRestError
          ? (context) => plugin.onRestError?.({ ...context, node })
          : undefined,
      });
    }

    this.refreshNodeSearchTransformers();
    return this;
  }

  private bindNodeEvents(node: Node): void {
    const emitObserved = <K extends keyof LunacordEvents>(
      type: K,
      payload: LunacordEvents[K]
    ): void => {
      this.emitObserved(type, payload);
    };

    node.on("playerCreate", (payload) => {
      this.playerNodes.set(payload.guildId, node.id);
      emitObserved("playerCreate", { ...payload, node });
    });
    node.on("playerConnect", (payload) => {
      emitObserved("playerConnect", { ...payload, node });
    });
    node.on("playerDisconnect", (payload) => {
      emitObserved("playerDisconnect", { ...payload, node });
    });
    node.on("playerDestroy", (payload) => {
      const { guildId } = payload;
      this.playerNodes.delete(guildId);
      emitObserved("playerDestroy", { ...payload, node });
    });
    node.on("playerPause", (payload) => {
      emitObserved("playerPause", { ...payload, node });
    });
    node.on("playerFiltersClear", (payload) => {
      emitObserved("playerFiltersClear", { ...payload, node });
    });
    node.on("playerFiltersUpdate", (payload) => {
      emitObserved("playerFiltersUpdate", { ...payload, node });
    });
    node.on("playerPlay", (payload) => {
      emitObserved("playerPlay", { ...payload, node });
    });
    node.on("playerQueueAdd", (payload) => {
      emitObserved("playerQueueAdd", { ...payload, node });
    });
    node.on("playerQueueDedupe", (payload) => {
      emitObserved("playerQueueDedupe", { ...payload, node });
    });
    node.on("playerQueueInsert", (payload) => {
      emitObserved("playerQueueInsert", { ...payload, node });
    });
    node.on("playerQueueMove", (payload) => {
      emitObserved("playerQueueMove", { ...payload, node });
    });
    node.on("playerQueueRemove", (payload) => {
      emitObserved("playerQueueRemove", { ...payload, node });
    });
    node.on("playerQueueShuffle", (payload) => {
      emitObserved("playerQueueShuffle", { ...payload, node });
    });
    node.on("playerResume", (payload) => {
      emitObserved("playerResume", { ...payload, node });
    });
    node.on("playerRepeatQueue", (payload) => {
      emitObserved("playerRepeatQueue", { ...payload, node });
    });
    node.on("playerRepeatTrack", (payload) => {
      emitObserved("playerRepeatTrack", { ...payload, node });
    });
    node.on("playerSeek", (payload) => {
      emitObserved("playerSeek", { ...payload, node });
    });
    node.on("playerSkip", (payload) => {
      emitObserved("playerSkip", { ...payload, node });
    });
    node.on("playerStop", (payload) => {
      emitObserved("playerStop", { ...payload, node });
    });
    node.on("ready", (payload) => {
      emitObserved("ready", { ...payload, node });
      emitObserved("nodeConnect", { ...payload, node });
      if (!payload.resumed) {
        void this.restoreNodePlayers(node);
      }
    });
    node.on("error", (error) => {
      const enriched = new LunacordError(error, node);
      emitObserved("error", enriched);
      emitObserved("nodeError", enriched);
    });
    node.on("playerUpdate", (payload) => {
      emitObserved("playerUpdate", { ...payload, node });
    });
    node.on("stats", (payload) => {
      emitObserved("stats", { ...payload, node });
      emitObserved("nodeStats", { ...payload, node });
    });
    node.on("playerVolumeUpdate", (payload) => {
      emitObserved("playerVolumeUpdate", { ...payload, node });
    });
    node.on("trackStart", (payload) => {
      emitObserved("trackStart", { ...payload, node });
    });
    node.on("trackEnd", (payload) => {
      emitObserved("trackEnd", { ...payload, node });
    });
    node.on("trackException", (payload) => {
      emitObserved("trackException", { ...payload, node });
    });
    node.on("trackStuck", (payload) => {
      emitObserved("trackStuck", { ...payload, node });
    });
    node.on("voiceSocketClosed", (payload) => {
      emitObserved("voiceSocketClosed", { ...payload, node });
      emitObserved("nodeVoiceSocketClosed", { ...payload, node });
    });
    node.on("ws", (payload) => {
      emitObserved("ws", { ...payload, node });

      switch (payload.type) {
        case "nodeDisconnect":
          emitObserved("nodeDisconnect", { ...payload, node });
          break;
        case "nodeReconnecting":
          emitObserved("nodeReconnecting", { ...payload, node });
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

  private createNodeOptions(id: string, nodeOptions: LunacordNodeOptions): NodeOptions {
    return {
      clientName: this.options.clientName,
      host: nodeOptions.host,
      id,
      initialReconnectDelayMs: nodeOptions.initialReconnectDelayMs,
      maxReconnectAttempts: nodeOptions.maxReconnectAttempts,
      maxReconnectDelayMs: nodeOptions.maxReconnectDelayMs,
      numShards: this.options.numShards,
      password: nodeOptions.password,
      port: nodeOptions.port,
      regions: nodeOptions.regions,
      requestRetryAttempts: nodeOptions.requestRetryAttempts,
      requestRetryDelayMs: nodeOptions.requestRetryDelayMs,
      requestTimeoutMs: nodeOptions.requestTimeoutMs,
      resume: this.options.resume,
      secure: nodeOptions.secure,
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

  private emitObserved<K extends keyof LunacordEvents>(type: K, payload: LunacordEvents[K]): void {
    this.emit(type, payload);
    void this.notifyPlugins({ type, ...payload } as LunacordPluginEvent);
  }

  private async notifyPlugins(event: LunacordPluginEvent): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.observe?.(event);
      } catch (error) {
        if (!("node" in event) || !(event.node instanceof Node)) {
          continue;
        }

        await this.handlePluginError(event.node, error, plugin.name);
      }
    }
  }

  private async handlePluginError(node: Node, error: unknown, pluginName: string): Promise<void> {
    if (this.notifyingPluginError) {
      return;
    }

    this.notifyingPluginError = true;
    try {
      const normalizedError =
        error instanceof Error ? error : new Error(`Plugin ${pluginName} failed: ${String(error)}`);
      const enriched = new LunacordError(
        normalizedError instanceof Error
          ? normalizedError
          : new Error(`Plugin ${pluginName} failed`),
        node
      );

      this.emit("error", enriched);
      this.emit("nodeError", enriched);
    } finally {
      this.notifyingPluginError = false;
    }
  }

  private refreshNodeSearchTransformers(): void {
    for (const node of this.getNodes()) {
      node.setSearchResultTransformer(async (context, result) => {
        let nextResult = result;

        for (const plugin of this.plugins) {
          const transformed = await plugin.transformSearchResult?.(
            {
              ...context,
              node,
            },
            nextResult
          );

          if (transformed) {
            nextResult = transformed;
          }
        }

        return nextResult;
      });
    }
  }

  private getConnectedNodes(): Node[] {
    return this.getNodes().filter((node) => node.connected);
  }

  private selectNode(guildId: string, options?: CreatePlayerOptions): Node | undefined {
    const connectedNodes = this.getConnectedNodes();
    if (connectedNodes.length === 0) {
      return undefined;
    }

    const preferredNodes = options?.preferredNodeIds
      ? connectedNodes.filter((node) => options.preferredNodeIds?.includes(node.id))
      : connectedNodes;
    const candidateNodes = preferredNodes.length > 0 ? preferredNodes : connectedNodes;
    const strategy = this.options.nodeSelection ?? { type: "leastLoaded" as const };

    switch (strategy.type) {
      case "roundRobin":
        return this.selectRoundRobinNode(candidateNodes);
      case "weighted":
        return this.selectWeightedNode(candidateNodes, strategy);
      case "region":
        return this.selectRegionNode(guildId, options?.region, candidateNodes, strategy.fallback);
      case "failover":
        return this.selectFailoverNode(candidateNodes, strategy.order);
      case "leastLoaded":
      default:
        return this.selectLeastLoadedNode(candidateNodes);
    }
  }

  private selectLeastLoadedNode(nodes: readonly Node[]): Node | undefined {
    if (nodes.length === 0) {
      return undefined;
    }

    return nodes.reduce((currentBest, candidate) =>
      candidate.playerCount < currentBest.playerCount ? candidate : currentBest
    );
  }

  private selectRoundRobinNode(nodes: readonly Node[]): Node | undefined {
    if (nodes.length === 0) {
      return undefined;
    }

    const node = nodes[this.roundRobinIndex % nodes.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % Number.MAX_SAFE_INTEGER;
    return node;
  }

  private selectWeightedNode(
    nodes: readonly Node[],
    strategy: Extract<LunacordNodeSelectionStrategy, { type: "weighted" }>
  ): Node | undefined {
    if (nodes.length === 0) {
      return undefined;
    }

    const playerWeight = strategy.playerWeight ?? 1;
    const cpuWeight = strategy.cpuWeight ?? 100;
    const memoryWeight = strategy.memoryWeight ?? 25;

    return nodes.reduce((bestNode, candidate) => {
      const bestScore = this.getWeightedNodeScore(bestNode, playerWeight, cpuWeight, memoryWeight);
      const candidateScore = this.getWeightedNodeScore(
        candidate,
        playerWeight,
        cpuWeight,
        memoryWeight
      );
      return candidateScore < bestScore ? candidate : bestNode;
    });
  }

  private getWeightedNodeScore(
    node: Node,
    playerWeight: number,
    cpuWeight: number,
    memoryWeight: number
  ): number {
    const stats = node.latestStats;
    if (!stats) {
      return node.playerCount * playerWeight;
    }

    const memoryRatio = stats.memory.allocated > 0 ? stats.memory.used / stats.memory.allocated : 0;

    return (
      node.playerCount * playerWeight +
      stats.cpu.lavalinkLoad * cpuWeight +
      memoryRatio * memoryWeight
    );
  }

  private selectRegionNode(
    _guildId: string,
    region: string | undefined,
    nodes: readonly Node[],
    fallback:
      | "leastLoaded"
      | "roundRobin"
      | "weighted"
      | {
          order: readonly string[];
          type: "failover";
        }
      | undefined
  ): Node | undefined {
    const regionNodes = region
      ? nodes.filter((node) => node.regions.some((candidate) => candidate === region))
      : [];

    if (regionNodes.length > 0) {
      return this.selectLeastLoadedNode(regionNodes);
    }

    switch (fallback) {
      case "roundRobin":
        return this.selectRoundRobinNode(nodes);
      case "weighted":
        return this.selectWeightedNode(nodes, { type: "weighted" });
      case undefined:
      case "leastLoaded":
      default:
        if (typeof fallback === "object" && fallback.type === "failover") {
          return this.selectFailoverNode(nodes, fallback.order);
        }
        return this.selectLeastLoadedNode(nodes);
    }
  }

  private selectFailoverNode(nodes: readonly Node[], order: readonly string[]): Node | undefined {
    for (const nodeId of order) {
      const match = nodes.find((node) => node.id === nodeId);
      if (match) {
        return match;
      }
    }

    return this.selectLeastLoadedNode(nodes);
  }

  private async restoreNodePlayers(node: Node): Promise<void> {
    for (const player of node.getPlayers()) {
      try {
        await node.restorePlayer(player);
      } catch (error) {
        await this.handlePluginError(
          node,
          error instanceof Error
            ? error
            : new Error(`Failed to restore player ${player.guildId}: ${String(error)}`),
          "reconnect-recovery"
        );
      }
    }
  }
}
