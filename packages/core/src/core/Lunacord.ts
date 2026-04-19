import { LunacordBuilder } from "../builders/LunacordBuilder";
import { NodeBuilder, type NodeBuilderStart } from "../builders/NodeBuilder";
import { PlayerBuilder, type PlayerBuilderStart } from "../builders/PlayerBuilder";
import { PluginBuilder } from "../builders/PluginBuilder";
import { CacheManager } from "../cache/CacheManager";
import type { CacheOptions } from "../cache/types";
import {
  LavalinkConnectionError,
  LunacordBaseError,
  NodeUnavailableError,
} from "../errors/LunacordError";
import type { PersistenceAdapter } from "../persistence/PersistenceAdapter";
import { PluginManager } from "../plugins/runtime/PluginManager";
import type {
  LunacordPlugin,
  LunacordPluginEvent,
  PluginErrorEvent,
  PluginMetadata,
} from "../plugins/types";
import type { WebSocketFactory } from "../transports/websocket/Socket";
import type { DebugEvent } from "../types/events";
import type { LyricsProvider, LyricsRequestOptions, LyricsResult } from "../types/lyrics";
import { TypedEventEmitter } from "../utils/EventEmitter";
import {
  type GatewayVoiceStatePayload,
  Node,
  type NodeEvents,
  type NodeOptions,
  type VoiceConnectOptions,
} from "./Node";
import type { Player, PlayerOptions } from "./Player";

const AUTO_NODE_ID_REGEX = /^node-(\d+)$/;

export class LunacordError extends LunacordBaseError<"NODE_ERROR", { nodeId: string }> {
  readonly node: Node;

  constructor(error: Error, node: Node) {
    super({
      code: "NODE_ERROR",
      message: error.message,
      context: {
        nodeId: node.id,
      },
      cause: "cause" in error ? error.cause : undefined,
    });
    this.name = error.name;
    this.node = node;
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
  queueEndDestroyDelayMs?: number;
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
  /** Lyrics provider. Install via `new Lunacord({ lyrics })` or `Lunacord.prototype.lyrics(provider)`. */
  lyrics?: LyricsProvider;
  nodeSelection?: LunacordNodeSelectionStrategy;
  nodes?: readonly LunacordNodeOptions[];
  /**
   * Total Discord gateway shards. Optional — adapters like `@lunacord/discordjs` MusicKit bind
   * it after the Discord client becomes ready via {@link Lunacord.bindIdentity}.
   */
  numShards?: number;
  /** Optional persistence adapter used to snapshot players for post-restart rehydration. */
  persistence?: PersistenceAdapter;
  resume?: boolean;
  sendGatewayPayload?: (guildId: string, payload: GatewayVoiceStatePayload) => void | Promise<void>;
  timeout?: number;
  /**
   * Discord bot user id. Optional — adapters like `@lunacord/discordjs` MusicKit bind it after
   * the Discord client becomes ready via {@link Lunacord.bindIdentity}.
   */
  userId?: string;
  webSocketFactory?: WebSocketFactory;
}

type NodeBound<T> = T & { node: Node };
type NodeBoundEvents = { [K in Exclude<keyof NodeEvents, "debug">]: NodeBound<NodeEvents[K]> };

export interface LunacordEvents extends NodeBoundEvents {
  /**
   * Unified debug stream covering nodes, WS, REST, plugins, and players. Subscribe to this
   * and forward to your logger to get a single firehose instead of many individual handlers.
   */
  debug: DebugEvent;
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
  pluginError: PluginErrorEvent;
  ready: NodeBound<NodeEvents["ready"]>;
  trackEnd: NodeBound<NodeEvents["trackEnd"]>;
  trackException: NodeBound<NodeEvents["trackException"]>;
  trackStart: NodeBound<NodeEvents["trackStart"]>;
  trackStuck: NodeBound<NodeEvents["trackStuck"]>;
  voiceSocketClosed: NodeBound<NodeEvents["voiceSocketClosed"]>;
  ws: NodeBound<NodeEvents["ws"]>;
}

export type { LunacordPlugin, LunacordPluginEvent, PluginErrorEvent } from "../plugins/types";

export class Lunacord extends TypedEventEmitter<LunacordEvents> {
  /**
   * Fluent, builder-first entrypoint. Prefer this over `new Lunacord({...})` for new code.
   *
   * ```ts
   * const lunacord = Lunacord.create()
   *   .userId(client.user!.id)
   *   .shards(1)
   *   .node({ id: "main", host: "localhost", port: 2333, password: "..." })
   *   .nodeSelection.leastLoaded()
   *   .build();
   * ```
   */
  static create(): LunacordBuilder {
    return new LunacordBuilder();
  }

  readonly players = {
    create: (): PlayerBuilderStart => new PlayerBuilder(this),
  };
  private readonly cacheManager: CacheManager;
  private lyricsProvider: LyricsProvider | undefined;
  private persistenceAdapter: PersistenceAdapter | undefined;
  private readonly nodes = new Map<string, Node>();
  private readonly options: LunacordOptions;
  private readonly pluginManager: PluginManager;
  private readonly playerNodes = new Map<string, string>();
  private readonly drainingNodes = new Set<string>();
  private nextAutoNodeId = 1;
  private connectPromise: Promise<void> | null = null;
  private roundRobinIndex = 0;
  private boundUserId: string | undefined;
  private boundNumShards: number | undefined;

  constructor(options: LunacordOptions) {
    super();
    this.options = options;
    this.boundUserId = options.userId;
    this.boundNumShards = options.numShards;
    this.lyricsProvider = options.lyrics;
    this.persistenceAdapter = options.persistence;
    this.cacheManager = new CacheManager({
      ...options.cache,
      logger: options.logger ?? options.cache?.logger,
    });
    this.pluginManager = new PluginManager({
      cacheNamespace: (namespace) => this.cacheManager.cache(namespace),
      events: this,
      getNodes: () => this.getNodes(),
      getPlayer: (guildId) => this.getPlayer(guildId),
      logger: options.logger,
      onPluginError: (event) => {
        this.emit("pluginError", event);
      },
    });

    for (const nodeOptions of options.nodes ?? []) {
      this.registerNode(this.instantiateNode(nodeOptions));
    }

    if (options.autoConnect) {
      this.connectPromise = this.connectAllNodes();
    }
  }

  /**
   * Bind the Discord bot identity. Adapters (for example `@lunacord/discordjs` MusicKit)
   * call this after the Discord client becomes ready, so callers don't need to pass
   * `userId` / `numShards` to the constructor.
   */
  bindIdentity(identity: { numShards?: number; userId?: string }): this {
    if (identity.userId !== undefined) {
      this.boundUserId = identity.userId;
    }
    if (identity.numShards !== undefined) {
      this.boundNumShards = identity.numShards;
    }
    return this;
  }

  /** Install (or replace) the lyrics provider. Pass `undefined` to detach. */
  lyrics(provider: LyricsProvider | undefined): this {
    this.lyricsProvider = provider;
    return this;
  }

  /** Install (or replace) the persistence adapter. */
  persistence(adapter: PersistenceAdapter | undefined): this {
    this.persistenceAdapter = adapter;
    return this;
  }

  /**
   * Rehydrate players from the configured persistence adapter. Typically invoked after
   * `await lunacord.connect()` on bot startup.
   */
  async rehydrate(): Promise<void> {
    const adapter = this.persistenceAdapter;
    if (!adapter) {
      return;
    }
    const guildIds = await adapter.list();
    for (const guildId of guildIds) {
      try {
        const snapshot = await adapter.load(guildId);
        if (!snapshot) {
          continue;
        }
        const node =
          (snapshot.nodeId ? this.nodes.get(snapshot.nodeId) : undefined) ??
          this.selectNode(guildId);
        if (!node) {
          this.emitDebug("manager", "Skipping rehydrate; no available node", { guildId });
          continue;
        }
        const player = node.createPlayer(guildId);
        this.playerNodes.set(guildId, node.id);
        await player.import(snapshot as never);
      } catch (error) {
        this.emitDebug("manager", "Rehydrate failed", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
      throw new LavalinkConnectionError({
        code: "GATEWAY_FORWARDER_MISSING",
        message: "Lunacord was not configured with sendGatewayPayload",
        context: {
          channelId,
          guildId,
        },
      });
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

  async disconnect(): Promise<void> {
    await this.pluginManager.stopAll();
    await this.pluginManager.disposeAll();
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

  createPlayer(): PlayerBuilderStart;
  createPlayer(guildId: string, options?: CreatePlayerOptions): Player;
  createPlayer(guildId?: string, options?: CreatePlayerOptions): Player | PlayerBuilderStart {
    if (guildId === undefined) {
      return new PlayerBuilder(this);
    }

    const existing = this.getPlayer(guildId);
    if (existing) {
      return existing;
    }

    const node = this.selectNode(guildId, options);
    if (!node) {
      throw new NodeUnavailableError({
        code: "NO_AVAILABLE_NODE",
        message: "No connected Lavalink nodes are available",
        context: {
          guildId,
          preferredNodeIds: options?.preferredNodeIds,
          region: options?.region,
        },
      });
    }

    const player = node.createPlayer(guildId, this.toPlayerOptions(options));
    this.playerNodes.set(guildId, node.id);
    return player;
  }

  /**
   * Starts a fluent node builder for registering a managed Lavalink node.
   */
  createNode(): NodeBuilderStart {
    return new NodeBuilder(this);
  }

  /**
   * Starts a fluent plugin builder for registering a typed Lunacord plugin.
   */
  createPlugin(name: string, version: string): PluginBuilder;
  createPlugin(metadata: PluginMetadata): PluginBuilder;
  createPlugin(nameOrMetadata: string | PluginMetadata, version = "0.0.0"): PluginBuilder {
    const metadata =
      typeof nameOrMetadata === "string"
        ? {
            name: nameOrMetadata,
            version,
            apiVersion: "2" as const,
          }
        : nameOrMetadata;
    return new PluginBuilder(this, metadata);
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
      throw new NodeUnavailableError({
        code: "NODE_NOT_FOUND",
        message: `Node ${nodeId} does not exist`,
        context: {
          nodeId,
        },
      });
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

  getLyrics(guildId: string, options?: LyricsRequestOptions): Promise<LyricsResult> {
    const player = this.getPlayer(guildId);
    if (!player) {
      return Promise.resolve<LyricsResult>({ status: "no_track" });
    }
    if (!this.lyricsProvider) {
      return Promise.resolve<LyricsResult>({ status: "unavailable", reason: "unsupported" });
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

    const sourcePlayer = sourceNode.getPlayer(guildId);
    if (!sourcePlayer) {
      throw new Error(`No player exists for guild ${guildId}`);
    }

    if (sourceNode.id === targetNode.id) {
      return sourcePlayer;
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
    this.pluginManager.use(plugin);
    return this;
  }

  private snapshotPlayer(guildId: string, nodeId: string): void {
    const adapter = this.persistenceAdapter;
    if (!adapter) {
      return;
    }
    const player = this.getPlayer(guildId);
    if (!player) {
      return;
    }
    try {
      const exported = player.export();
      Promise.resolve(
        adapter.save(guildId, {
          guildId,
          nodeId,
          ...(exported as unknown as Record<string, unknown>),
        })
      ).catch((error) => {
        this.emitDebug("manager", "Persistence save failed", {
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } catch (error) {
      this.emitDebug("manager", "Persistence export failed", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private removePersistedPlayer(guildId: string): void {
    const adapter = this.persistenceAdapter;
    if (!adapter) {
      return;
    }
    Promise.resolve(adapter.delete(guildId)).catch((error) => {
      this.emitDebug("manager", "Persistence delete failed", {
        guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private bindNodeEvents(node: Node): void {
    const emitObserved = <K extends keyof LunacordEvents>(
      type: K,
      payload: LunacordEvents[K]
    ): void => {
      this.emitObserved(type, payload);
    };
    const snapshot = (guildId: string): void => this.snapshotPlayer(guildId, node.id);

    node.on("playerCreate", (payload) => {
      this.playerNodes.set(payload.guildId, node.id);
      emitObserved("playerCreate", { ...payload, node });
      snapshot(payload.guildId);
    });
    node.on("playerConnect", (payload) => {
      emitObserved("playerConnect", { ...payload, node });
    });
    node.on("playerDisconnect", (payload) => {
      this.lyricsProvider?.markTrackInactive?.(payload.guildId);
      emitObserved("playerDisconnect", { ...payload, node });
    });
    node.on("playerDestroy", (payload) => {
      const { guildId } = payload;
      this.lyricsProvider?.markTrackInactive?.(guildId);
      if (this.playerNodes.get(guildId) === node.id) {
        this.playerNodes.delete(guildId);
      }
      emitObserved("playerDestroy", { ...payload, node });
      this.removePersistedPlayer(guildId);
    });
    node.on("playerPause", (payload) => {
      emitObserved("playerPause", { ...payload, node });
    });
    node.on("debug", (payload) => {
      let scope: DebugEvent["scope"] = "player";
      if (payload.category === "voice") {
        scope = "voice";
      } else if (payload.category === "ws") {
        scope = "ws";
      }
      const unified: DebugEvent = {
        scope,
        message: payload.message,
        nodeId: node.id,
        data: payload.context,
      };
      this.emit("debug", unified);
      this.options.logger?.debug?.(payload.message, unified);
    });
    node.on("playerFiltersClear", (payload) => {
      emitObserved("playerFiltersClear", { ...payload, node });
    });
    node.on("playerFiltersUpdate", (payload) => {
      emitObserved("playerFiltersUpdate", { ...payload, node });
    });
    node.on("playerPlay", (payload) => {
      this.lyricsProvider?.markTrackActive?.(payload.guildId, payload.track);
      emitObserved("playerPlay", { ...payload, node });
      snapshot(payload.guildId);
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
      this.lyricsProvider?.markTrackInactive?.(payload.guildId);
      emitObserved("playerStop", { ...payload, node });
    });
    node.on("ready", (payload) => {
      this.logDebug("Node ready", {
        nodeId: node.id,
        resumed: payload.resumed,
      });
      emitObserved("ready", { ...payload, node });
      emitObserved("nodeConnect", { ...payload, node });
      this.pluginManager.startAll().catch(() => {
        /* plugin errors are emitted via pluginError */
      });
      if (!payload.resumed) {
        this.restoreNodePlayers(node).catch(() => {
          /* errors handled inside */
        });
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
      this.lyricsProvider?.markTrackActive?.(payload.player.guildId, payload.track);
      emitObserved("trackStart", { ...payload, node });
      snapshot(payload.player.guildId);
    });
    node.on("trackEnd", (payload) => {
      this.lyricsProvider?.markTrackInactive?.(payload.player.guildId, payload.track);
      emitObserved("trackEnd", { ...payload, node });
      snapshot(payload.player.guildId);
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
            this.migratePlayersFromNode(node, this.resolveAutoMigratePreferredNodeIds()).catch(
              () => {
                /* migration errors emit playerMigrationFailed */
              }
            );
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

  private async connectAllNodes(): Promise<void> {
    await this.pluginManager.setupAll();
    await Promise.all(
      this.getNodes().map((node) =>
        node.connect().catch((error) => {
          throw new Error(
            `Failed to connect node ${node.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        })
      )
    );
  }

  private instantiateNode(nodeOptions: LunacordNodeOptions): Node {
    const id = nodeOptions.id ?? this.allocateAutoNodeId();
    return new Node(this.createNodeOptions(id, nodeOptions));
  }

  private registerNode(node: Node): void {
    if (this.nodes.has(node.id)) {
      throw new NodeUnavailableError({
        code: "NODE_ALREADY_REGISTERED",
        message: `Node ${node.id} is already registered`,
        context: {
          nodeId: node.id,
        },
      });
    }

    this.nodes.set(node.id, node);
    this.syncAutoNodeIdCounter(node.id);
    this.bindNodeEvents(node);
    this.attachNodeRestLogging(node);
    this.pluginManager.attachNode(node);

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
      numShards: () => this.boundNumShards,
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
      userId: () => this.boundUserId,
      webSocketFactory: this.options.webSocketFactory,
      lyricsClient: () => this.lyricsProvider,
    };
  }

  /**
   * Emit a unified debug event AND forward to the optional user-provided logger.
   * Plugins + framework adapters use this so a bot only needs one listener for observability.
   */
  emitDebug(scope: DebugEvent["scope"], message: string, data?: unknown): void {
    const event: DebugEvent = { scope, message, ...(data === undefined ? {} : { data }) };
    this.emit("debug", event);
    this.options.logger?.debug?.(message, data);
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
    this.pluginManager.dispatch({ type, ...payload } as LunacordPluginEvent);
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
          this.lyricsProvider?.markTrackActive?.(player.guildId, player.current);
        }
      } catch (error) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(`Failed to restore player ${player.guildId}: ${String(error)}`);
        const enriched = new LunacordError(normalizedError, node);
        this.logError("Failed to restore player", {
          guildId: player.guildId,
          nodeId: node.id,
          message: normalizedError.message,
        });
        this.emit("error", enriched);
        this.emit("nodeError", enriched);
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
      queueEndDestroyDelayMs: options.queueEndDestroyDelayMs,
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
      throw new NodeUnavailableError({
        code: "NO_AVAILABLE_NODE",
        message: `No migration target is available for node ${sourceNodeId}`,
        context: {
          nodeId: sourceNodeId,
          preferredNodeIds,
        },
      });
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
        return undefined;
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
    const match = AUTO_NODE_ID_REGEX.exec(nodeId);
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
