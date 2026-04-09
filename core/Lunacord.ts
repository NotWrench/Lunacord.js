import { CacheManager } from "../cache/CacheManager";
import type { CacheOptions } from "../cache/types";
import { LyricsClient } from "../lyrics/LyricsClient";
import type {
  RestErrorContext,
  RestRequestContext,
  RestRequestPatch,
  RestResponseContext,
} from "../rest/Rest";
import type { SearchResult } from "../structures/SearchResult";
import type {
  LyricsOptions,
  LyricsRequestOptions,
  LyricsResult,
  SearchProviderInput,
} from "../types";
import { TypedEventEmitter } from "../utils/EventEmitter";
import type { WebSocketFactory } from "../websocket/Socket";
import {
  type GatewayVoiceStatePayload,
  Node,
  type NodeEvents,
  type NodeOptions,
  type VoiceConnectOptions,
  type VoiceStateSnapshot,
} from "./Node";
import type { Player, PlayerExportData, PlayerOptions } from "./Player";

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
  historyMaxSize?: number;
  onQueueEmpty?: (player: Player, reason: "manual" | "trackEnd") => Promise<void> | void;
  preferredNodeIds?: readonly string[];
  region?: string;
}

export interface LunacordLogger {
  debug?: (message: string, data?: unknown) => void;
  error?: (message: string, data?: unknown) => void;
  warn?: (message: string, data?: unknown) => void;
}

export interface AutoMigrateOptions {
  preferredNodeIds?: readonly string[];
}

export interface AggregatedNodeStats {
  connected: boolean;
  id: string;
  playerCount: number;
  stats: Node["latestStats"];
}

export interface AggregatedLunacordStats {
  connectedNodes: number;
  frameStats: {
    deficit: number;
    nulled: number;
    sent: number;
  };
  memory: {
    allocated: number;
    free: number;
    reservable: number;
    used: number;
  };
  nodes: AggregatedNodeStats[];
  players: number;
  playingPlayers: number;
  totalNodes: number;
}

export interface LunacordOptions {
  autoConnect?: boolean;
  autoMigrateOnDisconnect?: boolean | AutoMigrateOptions;
  cache?: CacheOptions;
  clientName?: string;
  logger?: LunacordLogger;
  lyrics?: LyricsOptions;
  nodeSelection?: LunacordNodeSelectionStrategy;
  nodes: readonly LunacordNodeOptions[];
  numShards: number;
  resume?: boolean;
  sendGatewayPayload?: (guildId: string, payload: GatewayVoiceStatePayload) => void | Promise<void>;
  timeout?: number;
  userId: string;
  webSocketFactory?: WebSocketFactory;
}

type NodeBound<T> = T & { node: Node };
type NodeBoundEvents = { [K in keyof NodeEvents]: NodeBound<NodeEvents[K]> };

export interface LunacordEvents extends NodeBoundEvents {
  nodeConnect: NodeBound<NodeEvents["ready"]>;
  nodeCreate: { node: Node };
  nodeDisconnect: NodeBound<Extract<NodeEvents["ws"], { type: "nodeDisconnect" }>>;
  nodeError: NodeBound<NodeEvents["error"]>;
  nodeReconnectFailed: NodeBound<Extract<NodeEvents["ws"], { type: "nodeReconnectFailed" }>>;
  nodeReconnecting: NodeBound<Extract<NodeEvents["ws"], { type: "nodeReconnecting" }>>;
  nodeRemove: { node: Node };
  nodeStats: NodeBound<NodeEvents["stats"]>;
  nodeVoiceSocketClosed: NodeBound<NodeEvents["voiceSocketClosed"]>;
  playerConnect: NodeBound<NodeEvents["playerConnect"]>;
  playerCreate: NodeBound<NodeEvents["playerCreate"]>;
  playerDestroy: NodeBound<NodeEvents["playerDestroy"]>;
  playerDisconnect: NodeBound<NodeEvents["playerDisconnect"]>;
  playerFiltersClear: NodeBound<NodeEvents["playerFiltersClear"]>;
  playerFiltersUpdate: NodeBound<NodeEvents["playerFiltersUpdate"]>;
  playerMigrate: { fromNode: Node; guildId: string; player: Player; toNode: Node };
  playerMigrationFailed: { error: Error; fromNode: Node; guildId: string; targetNode?: Node };
  playerPause: NodeBound<NodeEvents["playerPause"]>;
  playerPlay: NodeBound<NodeEvents["playerPlay"]>;
  playerQueueAdd: NodeBound<NodeEvents["playerQueueAdd"]>;
  playerQueueAddMany: NodeBound<NodeEvents["playerQueueAddMany"]>;
  playerQueueClear: NodeBound<NodeEvents["playerQueueClear"]>;
  playerQueueDedupe: NodeBound<NodeEvents["playerQueueDedupe"]>;
  playerQueueEmpty: NodeBound<NodeEvents["playerQueueEmpty"]>;
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
  pluginError: {
    error: Error;
    eventType: string;
    node?: Node;
    pluginName: string;
  };
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
      provider?: SearchProviderInput;
      query: string;
    },
    result: SearchResult
  ) => Promise<SearchResult> | SearchResult;
}

export class Lunacord extends TypedEventEmitter<LunacordEvents> {
  private readonly cacheManager: CacheManager;
  private readonly lyricsClient: LyricsClient;
  private readonly nodes = new Map<string, Node>();
  private readonly options: LunacordOptions;
  private readonly plugins: LunacordPlugin[] = [];
  private readonly playerNodes = new Map<string, string>();
  private readonly drainingNodes = new Set<string>();
  private nextAutoNodeId = 1;
  private connectPromise: Promise<void> | null = null;
  private notifyingPluginError = false;
  private roundRobinIndex = 0;

  constructor(options: LunacordOptions) {
    super();
    this.options = options;
    this.cacheManager = new CacheManager({
      ...options.cache,
      logger: options.logger ?? options.cache?.logger,
    });
    this.lyricsClient = new LyricsClient(options.lyrics, {
      cache: this.cacheManager.cache("lyrics"),
    });

    for (const nodeOptions of options.nodes) {
      this.registerNode(this.instantiateNode(nodeOptions));
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

    const player = node.createPlayer(guildId, this.toPlayerOptions(options));
    this.playerNodes.set(guildId, node.id);
    return player;
  }

  async addNode(options: LunacordNodeOptions): Promise<Node> {
    const node = this.instantiateNode(options);
    this.logDebug("Adding node", {
      nodeId: node.id,
    });
    this.registerNode(node);

    if (this.connectPromise || this.getConnectedNodes().length > 0) {
      await node.connect();
    }

    return node;
  }

  async removeNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} does not exist`);
    }

    this.drainingNodes.add(nodeId);
    this.logWarn("Removing node", {
      nodeId,
      playerCount: node.playerCount,
    });

    try {
      for (const player of node.getPlayers()) {
        await this.movePlayer(player.guildId, this.selectMigrationTargetNodeId(nodeId));
      }
    } catch (error) {
      this.drainingNodes.delete(nodeId);
      throw error;
    }

    node.disconnect();
    this.nodes.delete(nodeId);
    this.drainingNodes.delete(nodeId);
    this.emitObserved("nodeRemove", { node });
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

  async getLyrics(guildId: string, options?: LyricsRequestOptions): Promise<LyricsResult> {
    const player = this.getPlayer(guildId);
    if (!player) {
      return { status: "no_track" };
    }

    return player.getLyrics(options);
  }

  isPlayerConnected(guildId: string): boolean {
    return this.getPlayer(guildId)?.isConnected ?? false;
  }

  async movePlayer(guildId: string, targetNodeId: string): Promise<Player> {
    const sourceNode = this.getNodeForGuild(guildId);
    if (!sourceNode) {
      throw new Error(`No player exists for guild ${guildId}`);
    }

    const targetNode = this.nodes.get(targetNodeId);
    if (!targetNode) {
      throw new Error(`Node ${targetNodeId} does not exist`);
    }

    if (sourceNode.id === targetNode.id) {
      return sourceNode.getPlayer(guildId)!;
    }

    const sourcePlayer = sourceNode.getPlayer(guildId);
    if (!sourcePlayer) {
      throw new Error(`No player exists for guild ${guildId}`);
    }

    const snapshot = sourcePlayer.export();
    const voiceSnapshot = sourceNode.getVoiceStateSnapshot(guildId);
    this.logDebug("Migrating player", {
      guildId,
      fromNodeId: sourceNode.id,
      toNodeId: targetNode.id,
    });
    targetNode.setVoiceStateSnapshot(guildId, voiceSnapshot);

    const targetPlayer = targetNode.createPlayer(guildId, sourcePlayer.getCreationOptions());

    try {
      await targetPlayer.import(snapshot);
      this.playerNodes.set(guildId, targetNode.id);
      await sourceNode.destroyPlayer(guildId);
      this.emitObserved("playerMigrate", {
        guildId,
        fromNode: sourceNode,
        toNode: targetNode,
        player: targetPlayer,
      });
      return targetPlayer;
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(`Failed to migrate player ${guildId}`);

      try {
        await targetNode.destroyPlayer(guildId);
      } catch (cleanupError) {
        this.logWarn("Failed to cleanup target player after migration failure", {
          guildId,
          targetNodeId: targetNode.id,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }

      targetNode.setVoiceStateSnapshot(guildId, undefined);
      this.playerNodes.set(guildId, sourceNode.id);
      this.emitObserved("playerMigrationFailed", {
        guildId,
        fromNode: sourceNode,
        targetNode,
        error: normalizedError,
      });
      throw normalizedError;
    }
  }

  getStats(): AggregatedLunacordStats {
    const nodes = this.getNodes().map((node) => ({
      id: node.id,
      connected: node.connected,
      playerCount: node.playerCount,
      stats: node.latestStats,
    }));

    return nodes.reduce<AggregatedLunacordStats>(
      (aggregate, node) => {
        aggregate.totalNodes += 1;
        if (node.connected) {
          aggregate.connectedNodes += 1;
        }

        aggregate.players += node.stats?.players ?? node.playerCount;
        aggregate.playingPlayers += node.stats?.playingPlayers ?? 0;
        aggregate.memory.free += node.stats?.memory.free ?? 0;
        aggregate.memory.used += node.stats?.memory.used ?? 0;
        aggregate.memory.allocated += node.stats?.memory.allocated ?? 0;
        aggregate.memory.reservable += node.stats?.memory.reservable ?? 0;
        aggregate.frameStats.sent += node.stats?.frameStats?.sent ?? 0;
        aggregate.frameStats.nulled += node.stats?.frameStats?.nulled ?? 0;
        aggregate.frameStats.deficit += node.stats?.frameStats?.deficit ?? 0;
        aggregate.nodes.push(node);
        return aggregate;
      },
      {
        connectedNodes: 0,
        frameStats: {
          deficit: 0,
          nulled: 0,
          sent: 0,
        },
        memory: {
          allocated: 0,
          free: 0,
          reservable: 0,
          used: 0,
        },
        nodes: [],
        players: 0,
        playingPlayers: 0,
        totalNodes: 0,
      }
    );
  }

  handleVoicePacket(packet: unknown): void {
    if (!this.isVoicePacket(packet)) {
      return;
    }

    const guildId = this.extractGuildId(packet);
    if (!guildId) {
      return;
    }

    const owner = this.getNodeForGuild(guildId);

    if (owner) {
      owner.handleVoicePacket(packet);
      return;
    }

    for (const node of this.getNodes().filter((candidate) => candidate.connected)) {
      node.handleVoicePacket(packet);
    }
  }

  private isVoicePacket(packet: unknown): boolean {
    if (typeof packet !== "object" || packet === null || !("t" in packet)) {
      return false;
    }

    const packetType = packet.t;
    return packetType === "VOICE_STATE_UPDATE" || packetType === "VOICE_SERVER_UPDATE";
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
      this.lyricsClient.markTrackInactive(payload.guildId);
      emitObserved("playerDisconnect", { ...payload, node });
    });
    node.on("playerDestroy", (payload) => {
      const { guildId } = payload;
      this.lyricsClient.markTrackInactive(guildId);
      if (this.playerNodes.get(guildId) === node.id) {
        this.playerNodes.delete(guildId);
      }
      emitObserved("playerDestroy", { ...payload, node });
    });
    node.on("playerPause", (payload) => {
      emitObserved("playerPause", { ...payload, node });
    });
    node.on("debug", (payload) => {
      this.logDebug(payload.message, {
        nodeId: node.id,
        category: payload.category,
        ...(payload.context ?? {}),
      });
      emitObserved("debug", { ...payload, node });
    });
    node.on("playerFiltersClear", (payload) => {
      emitObserved("playerFiltersClear", { ...payload, node });
    });
    node.on("playerFiltersUpdate", (payload) => {
      emitObserved("playerFiltersUpdate", { ...payload, node });
    });
    node.on("playerPlay", (payload) => {
      this.lyricsClient.markTrackActive(payload.guildId, payload.track);
      emitObserved("playerPlay", { ...payload, node });
    });
    node.on("playerQueueAdd", (payload) => {
      emitObserved("playerQueueAdd", { ...payload, node });
    });
    node.on("playerQueueAddMany", (payload) => {
      emitObserved("playerQueueAddMany", { ...payload, node });
    });
    node.on("playerQueueClear", (payload) => {
      emitObserved("playerQueueClear", { ...payload, node });
    });
    node.on("playerQueueDedupe", (payload) => {
      emitObserved("playerQueueDedupe", { ...payload, node });
    });
    node.on("playerQueueEmpty", (payload) => {
      emitObserved("playerQueueEmpty", { ...payload, node });
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
      this.lyricsClient.markTrackInactive(payload.guildId);
      emitObserved("playerStop", { ...payload, node });
    });
    node.on("ready", (payload) => {
      this.logDebug("Node ready", {
        nodeId: node.id,
        resumed: payload.resumed,
      });
      emitObserved("ready", { ...payload, node });
      emitObserved("nodeConnect", { ...payload, node });
      if (!payload.resumed) {
        void this.restoreNodePlayers(node);
      }
    });
    node.on("error", (error) => {
      const enriched = new LunacordError(error, node);
      this.logError("Node error", {
        nodeId: node.id,
        message: error.message,
      });
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
      this.lyricsClient.markTrackActive(payload.player.guildId, payload.track);
      emitObserved("trackStart", { ...payload, node });
    });
    node.on("trackEnd", (payload) => {
      this.lyricsClient.markTrackInactive(payload.player.guildId, payload.track);
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
          this.logWarn("Node disconnected", {
            nodeId: node.id,
            code: payload.code,
            reason: payload.reason,
          });
          emitObserved("nodeDisconnect", { ...payload, node });
          break;
        case "nodeReconnectFailed":
          this.logWarn("Node reconnect attempts exhausted", {
            nodeId: node.id,
            attempts: payload.attempts,
          });
          emitObserved("nodeReconnectFailed", { ...payload, node });
          if (this.options.autoMigrateOnDisconnect) {
            void this.migratePlayersFromNode(node, this.resolveAutoMigratePreferredNodeIds());
          }
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

  private instantiateNode(nodeOptions: LunacordNodeOptions): Node {
    const id = nodeOptions.id ?? this.allocateAutoNodeId();
    return new Node(this.createNodeOptions(id, nodeOptions));
  }

  private registerNode(node: Node): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node ${node.id} is already registered`);
    }

    this.nodes.set(node.id, node);
    this.syncAutoNodeIdCounter(node.id);
    this.bindNodeEvents(node);
    this.attachNodeRestLogging(node);
    this.refreshNodeSearchTransformers();

    queueMicrotask(() => {
      this.emitObserved("nodeCreate", { node });
    });
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
      webSocketFactory: this.options.webSocketFactory,
      lyricsClient: this.lyricsClient,
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
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(`Plugin ${plugin.name} failed: ${String(error)}`);
        const node = "node" in event && event.node instanceof Node ? event.node : undefined;

        this.emit("pluginError", {
          pluginName: plugin.name,
          eventType: event.type,
          error: normalizedError,
          node,
        });

        if (node) {
          await this.handlePluginError(node, normalizedError, plugin.name);
        }
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
    return this.getNodes().filter((node) => node.connected && !this.drainingNodes.has(node.id));
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
        if (player.current) {
          this.lyricsClient.markTrackActive(player.guildId, player.current);
        }
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

  private toPlayerOptions(options?: CreatePlayerOptions): PlayerOptions | undefined {
    if (!options) {
      return undefined;
    }

    return {
      historyMaxSize: options.historyMaxSize,
      onQueueEmpty: options.onQueueEmpty,
    };
  }

  private selectMigrationTargetNodeId(
    sourceNodeId: string,
    preferredNodeIds?: readonly string[]
  ): string {
    const candidates = this.getConnectedNodes().filter((node) => node.id !== sourceNodeId);
    const preferredCandidates = preferredNodeIds
      ? candidates.filter((node) => preferredNodeIds.includes(node.id))
      : candidates;
    const nextNode = this.selectLeastLoadedNode(
      preferredCandidates.length > 0 ? preferredCandidates : candidates
    );

    if (!nextNode) {
      throw new Error(`No migration target is available for node ${sourceNodeId}`);
    }

    return nextNode.id;
  }

  private resolveAutoMigratePreferredNodeIds(): readonly string[] | undefined {
    const autoMigrateOptions = this.options.autoMigrateOnDisconnect;
    if (!autoMigrateOptions || autoMigrateOptions === true) {
      return undefined;
    }

    return autoMigrateOptions.preferredNodeIds;
  }

  private async migratePlayersFromNode(
    node: Node,
    preferredNodeIds?: readonly string[]
  ): Promise<void> {
    for (const player of node.getPlayers()) {
      let targetNodeId: string;

      try {
        targetNodeId = this.selectMigrationTargetNodeId(node.id, preferredNodeIds);
      } catch (error) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(`Failed to migrate player ${player.guildId} from ${node.id}`);
        this.emitObserved("playerMigrationFailed", {
          guildId: player.guildId,
          fromNode: node,
          error: normalizedError,
        });
        continue;
      }

      try {
        await this.movePlayer(player.guildId, targetNodeId);
      } catch {
        // movePlayer already emits playerMigrationFailed for migration execution errors.
      }
    }
  }

  private attachNodeRestLogging(node: Node): void {
    if (!this.options.logger) {
      return;
    }

    node.rest.use({
      beforeRequest: (context) => {
        this.logDebug("REST request", {
          nodeId: node.id,
          method: context.method,
          path: context.path,
        });
      },
      afterResponse: (context) => {
        this.logDebug("REST response", {
          nodeId: node.id,
          path: context.request.path,
          status: context.response.status,
        });
      },
      onError: (context) => {
        this.logError("REST error", {
          nodeId: node.id,
          path: context.request.path,
          error: context.error instanceof Error ? context.error.message : String(context.error),
        });
      },
    });
  }

  private logDebug(message: string, data?: unknown): void {
    this.options.logger?.debug?.(message, data);
  }

  private logWarn(message: string, data?: unknown): void {
    this.options.logger?.warn?.(message, data);
  }

  private logError(message: string, data?: unknown): void {
    this.options.logger?.error?.(message, data);
  }

  private allocateAutoNodeId(): string {
    let candidateId = `node-${this.nextAutoNodeId}`;
    while (this.nodes.has(candidateId)) {
      this.nextAutoNodeId += 1;
      candidateId = `node-${this.nextAutoNodeId}`;
    }

    this.nextAutoNodeId += 1;
    return candidateId;
  }

  private syncAutoNodeIdCounter(nodeId: string): void {
    const match = /^node-(\d+)$/.exec(nodeId);
    if (!match) {
      return;
    }

    const numericId = Number(match[1]);
    if (!Number.isFinite(numericId) || numericId < this.nextAutoNodeId) {
      return;
    }

    this.nextAutoNodeId = numericId + 1;
  }
}
