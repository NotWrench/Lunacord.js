// core/Node.ts

import type { LyricsClient } from "../lyrics/LyricsClient";
import { Rest } from "../rest/Rest";
import type { SearchResult } from "../structures/SearchResult";
import { Track } from "../structures/Track";
import type {
  Exception,
  PlayerState,
  PlayerUpdatePayload,
  ReadyPayload,
  SearchProviderInput,
  Stats,
  TrackEvent,
} from "../types";
import { TypedEventEmitter } from "../utils/EventEmitter";
import { Socket, type WebSocketFactory } from "../websocket/Socket";
import {
  Player,
  type PlayerActionEvent,
  type PlayerExportData,
  type PlayerOptions,
} from "./Player";

export type NodeWsEvent =
  | {
      type: "nodeDisconnect";
      code: number;
      reason: string;
    }
  | {
      type: "nodeReconnecting";
      attempt: number;
      delay: number;
    };

export interface VoiceSocketClosedEvent {
  byRemote: boolean;
  code: number;
  guildId: string;
  reason: string;
}

export interface NodeDebugEvent {
  category: "player" | "voice" | "ws";
  context?: Record<string, unknown>;
  message: string;
}

type PlayerActionPayload<T extends PlayerActionEvent["type"]> = Omit<
  Extract<PlayerActionEvent, { type: T }>,
  "type"
>;

export interface PlayerConnectEvent {
  channelId: string;
  guildId: string;
  selfDeaf: boolean;
  selfMute: boolean;
}

export interface PlayerDisconnectEvent {
  guildId: string;
  reason: "manual" | "voiceSocketClosed" | "voiceStateUpdate";
}

export interface NodeEvents {
  debug: NodeDebugEvent;
  error: Error;
  playerConnect: PlayerConnectEvent;
  playerCreate: { guildId: string; player: Player };
  playerDestroy: { guildId: string };
  playerDisconnect: PlayerDisconnectEvent;
  playerFiltersClear: PlayerActionPayload<"playerFiltersClear">;
  playerFiltersUpdate: PlayerActionPayload<"playerFiltersUpdate">;
  playerPause: PlayerActionPayload<"playerPause">;
  playerPlay: PlayerActionPayload<"playerPlay">;
  playerQueueAdd: PlayerActionPayload<"playerQueueAdd">;
  playerQueueAddMany: PlayerActionPayload<"playerQueueAddMany">;
  playerQueueClear: PlayerActionPayload<"playerQueueClear">;
  playerQueueDedupe: PlayerActionPayload<"playerQueueDedupe">;
  playerQueueEmpty: PlayerActionPayload<"playerQueueEmpty">;
  playerQueueInsert: PlayerActionPayload<"playerQueueInsert">;
  playerQueueMove: PlayerActionPayload<"playerQueueMove">;
  playerQueueRemove: PlayerActionPayload<"playerQueueRemove">;
  playerQueueShuffle: PlayerActionPayload<"playerQueueShuffle">;
  playerRepeatQueue: PlayerActionPayload<"playerRepeatQueue">;
  playerRepeatTrack: PlayerActionPayload<"playerRepeatTrack">;
  playerResume: PlayerActionPayload<"playerResume">;
  playerSeek: PlayerActionPayload<"playerSeek">;
  playerSkip: PlayerActionPayload<"playerSkip">;
  playerStop: PlayerActionPayload<"playerStop">;
  playerUpdate: { guildId: string; state: PlayerState };
  playerVolumeUpdate: PlayerActionPayload<"playerVolumeUpdate">;
  ready: ReadyPayload;
  stats: Stats;
  trackEnd: { player: Player; track: Track; reason: string };
  trackException: { player: Player; track: Track; exception: Exception };
  trackStart: { player: Player; track: Track };
  trackStuck: { player: Player; track: Track; thresholdMs: number };
  voiceSocketClosed: VoiceSocketClosedEvent;
  ws: NodeWsEvent;
}

export interface NodeOptions {
  clientName?: string;
  host: string;
  id?: string;
  initialReconnectDelayMs?: number;
  lyricsClient?: LyricsClient;
  maxReconnectAttempts?: number;
  maxReconnectDelayMs?: number;
  numShards: number;
  password: string;
  port: number;
  regions?: readonly string[];
  requestRetryAttempts?: number;
  requestRetryDelayMs?: number;
  requestTimeoutMs?: number;
  resume?: boolean;
  secure?: boolean;
  sendGatewayPayload?: (guildId: string, payload: GatewayVoiceStatePayload) => void | Promise<void>;
  timeout?: number;
  userId: string;
  webSocketFactory?: WebSocketFactory;
}

export interface GatewayVoiceStatePayload {
  d: {
    channel_id: string | null;
    guild_id: string;
    self_deaf: boolean;
    self_mute: boolean;
  };
  op: 4;
}

export interface VoiceConnectOptions {
  selfDeaf?: boolean;
  selfMute?: boolean;
  timeoutMs?: number;
}

export interface VoiceStateSnapshot {
  channelId: string;
  endpoint: string;
  sessionId: string;
  token: string;
}

const DEFAULT_CLIENT_NAME = "lavalink-client";
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_VOICE_TIMEOUT_MS = 10_000;
const DEFAULT_VOICE_CONNECT_OPTIONS: Required<Pick<VoiceConnectOptions, "selfDeaf" | "selfMute">> =
  {
    selfDeaf: true,
    selfMute: false,
  };
const AUTO_ADVANCE_REASONS = new Set(["finished", "loadFailed"] as const);
type AutoAdvanceReason = "finished" | "loadFailed";
type LavalinkVoicePayload = NonNullable<PlayerUpdatePayload["voice"]>;

interface VoiceStateCache {
  channelId: string;
  sessionId: string;
}

interface VoiceServerCache {
  endpoint: string;
  token: string;
}

interface VoiceWaiter {
  reject: (error: Error) => void;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
}

export class Node extends TypedEventEmitter<NodeEvents> {
  readonly id: string;
  sessionId: string | null = null;
  latestStats: Stats | null = null;
  readonly rest: Rest;
  readonly socket: Socket;

  private readonly options: NodeOptions;
  private readonly players = new Map<string, Player>();
  private readonly syncedVoiceStateKeys = new Map<string, string>();
  private readonly voiceServers = new Map<string, VoiceServerCache>();
  private readonly voiceStates = new Map<string, VoiceStateCache>();
  private readonly voiceWaiters = new Map<string, VoiceWaiter[]>();
  private connectPromise: Promise<void> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private searchResultTransformer?:
    | ((
        context: { guildId: string; player: Player; provider?: SearchProviderInput; query: string },
        result: SearchResult
      ) => Promise<SearchResult> | SearchResult)
    | undefined;
  private voicePacketForwardingEnabled = false;

  constructor(options: NodeOptions) {
    super();

    this.options = options;
    this.id = options.id ?? `${options.host}:${options.port}`;
    const clientName = options.clientName ?? DEFAULT_CLIENT_NAME;
    const protocol = options.secure ? "https" : "http";

    this.rest = new Rest({
      baseUrl: `${protocol}://${options.host}:${options.port}`,
      password: options.password,
      requestTimeoutMs: options.requestTimeoutMs,
      retryAttempts: options.requestRetryAttempts,
      retryDelayMs: options.requestRetryDelayMs,
    });

    this.socket = new Socket({
      host: options.host,
      port: options.port,
      secure: options.secure,
      password: options.password,
      userId: options.userId,
      numShards: options.numShards,
      clientName,
      initialReconnectDelayMs: options.initialReconnectDelayMs,
      maxReconnectAttempts: options.maxReconnectAttempts,
      maxReconnectDelayMs: options.maxReconnectDelayMs,
      webSocketFactory: options.webSocketFactory,
    });

    this.setupSocketListeners();
  }

  connect(): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        this.socket.off("ready", handleReady);
        this.socket.off("error", handleError);

        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        }

        this.connectPromise = null;
      };

      const handleReady = (): void => {
        cleanup();
        resolve();
      };

      const handleError = (error: Error): void => {
        cleanup();
        reject(error);
      };

      this.socket.once("ready", handleReady);
      this.socket.once("error", handleError);

      this.connectTimeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out connecting to Lavalink after ${DEFAULT_CONNECT_TIMEOUT_MS}ms`));
      }, DEFAULT_CONNECT_TIMEOUT_MS);

      this.socket.connect();
    });

    return this.connectPromise;
  }

  disconnect(): void {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }

    this.connectPromise = null;
    this.sessionId = null;
    this.socket.disconnect();
  }

  createPlayer(guildId: string, options?: PlayerOptions): Player {
    const existing = this.players.get(guildId);
    if (existing) {
      return existing;
    }

    const player = new Player(guildId, this, options);
    this.players.set(guildId, player);
    this.emit("playerCreate", { guildId, player });
    return player;
  }

  async destroyPlayer(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (!player) {
      return;
    }

    if (this.sessionId) {
      await this.rest.destroyPlayer(this.sessionId, guildId);
    }

    this.players.delete(guildId);
    this.voiceStates.delete(guildId);
    this.voiceServers.delete(guildId);
    this.syncedVoiceStateKeys.delete(guildId);
    this.rejectVoiceWaiters(guildId, new Error(`Player destroyed for guild ${guildId}`));
    this.emit("playerDestroy", { guildId });
  }

  getPlayer(guildId: string): Player | undefined {
    return this.players.get(guildId);
  }

  getPlayers(): Player[] {
    return [...this.players.values()];
  }

  get playerCount(): number {
    return this.players.size;
  }

  get regions(): readonly string[] {
    return this.options.regions ?? [];
  }

  get connected(): boolean {
    return this.sessionId !== null;
  }

  get lyricsClient(): LyricsClient | undefined {
    return this.options.lyricsClient;
  }

  handleVoicePacket(packet: unknown): void {
    this.voicePacketForwardingEnabled = true;

    if (!this.isRecord(packet)) {
      this.emitDebug("voice", "Ignored non-object voice packet");
      return;
    }

    const packetType = packet["t"];
    const packetData = packet["d"];

    if (typeof packetType !== "string" || !this.isRecord(packetData)) {
      this.emitDebug("voice", "Ignored malformed voice packet", {
        packetType: typeof packetType,
      });
      return;
    }

    if (packetType === "VOICE_STATE_UPDATE") {
      this.emitDebug("voice", "Received VOICE_STATE_UPDATE", {
        guildId: this.getString(packetData["guild_id"]),
      });
      this.handleVoiceStatePacket(packetData);
      return;
    }

    if (packetType === "VOICE_SERVER_UPDATE") {
      this.emitDebug("voice", "Received VOICE_SERVER_UPDATE", {
        guildId: this.getString(packetData["guild_id"]),
      });
      this.handleVoiceServerPacket(packetData);
    }
  }

  async connectVoice(
    guildId: string,
    channelId: string,
    options?: VoiceConnectOptions
  ): Promise<void> {
    if (!this.options.sendGatewayPayload) {
      throw new Error("Node was not configured with sendGatewayPayload");
    }

    const connectOptions = { ...DEFAULT_VOICE_CONNECT_OPTIONS, ...options };
    const cachedState = this.voiceStates.get(guildId);
    const hasCachedVoice = Boolean(cachedState && this.voiceServers.has(guildId));
    if (cachedState?.channelId === channelId && hasCachedVoice) {
      this.emitDebug("voice", "Reused cached voice state", {
        guildId,
        channelId,
      });

      const player = this.players.get(guildId);
      if (player) {
        player.connected = true;
      }

      this.emit("playerConnect", {
        guildId,
        channelId,
        selfDeaf: connectOptions.selfDeaf,
        selfMute: connectOptions.selfMute,
      });
      return;
    }

    if (cachedState?.channelId !== channelId) {
      this.voiceStates.delete(guildId);
      this.voiceServers.delete(guildId);
      this.syncedVoiceStateKeys.delete(guildId);
    }

    await this.sendVoiceStateUpdate(guildId, {
      channelId,
      selfDeaf: connectOptions.selfDeaf,
      selfMute: connectOptions.selfMute,
    });

    if (this.voicePacketForwardingEnabled) {
      await this.waitForVoice(guildId, connectOptions.timeoutMs ?? DEFAULT_VOICE_TIMEOUT_MS);
    }

    const player = this.players.get(guildId);
    if (player) {
      player.connected = true;
    }

    this.emit("playerConnect", {
      guildId,
      channelId,
      selfDeaf: connectOptions.selfDeaf,
      selfMute: connectOptions.selfMute,
    });
  }

  async disconnectVoice(guildId: string): Promise<void> {
    if (this.options.sendGatewayPayload) {
      await this.sendVoiceStateUpdate(guildId, {
        channelId: null,
        selfDeaf: false,
        selfMute: false,
      });
    }

    this.voiceStates.delete(guildId);
    this.voiceServers.delete(guildId);
    this.syncedVoiceStateKeys.delete(guildId);
    this.rejectVoiceWaiters(guildId, new Error(`Voice connection was closed for guild ${guildId}`));

    const player = this.players.get(guildId);
    if (player) {
      player.connected = false;
    }

    this.emit("playerDisconnect", {
      guildId,
      reason: "manual",
    });
  }

  emitPlayerEvent(event: PlayerActionEvent): void {
    switch (event.type) {
      case "playerPause":
        this.emit("playerPause", {
          guildId: event.guildId,
        });
        return;
      case "playerFiltersClear":
        this.emit("playerFiltersClear", {
          guildId: event.guildId,
          filters: event.filters,
        });
        return;
      case "playerFiltersUpdate":
        this.emit("playerFiltersUpdate", {
          guildId: event.guildId,
          filters: event.filters,
        });
        return;
      case "playerPlay":
        this.emit("playerPlay", {
          guildId: event.guildId,
          track: event.track,
          source: event.source,
        });
        return;
      case "playerQueueAdd":
        this.emit("playerQueueAdd", {
          guildId: event.guildId,
          track: event.track,
          queueSize: event.queueSize,
        });
        return;
      case "playerQueueAddMany":
        this.emit("playerQueueAddMany", {
          guildId: event.guildId,
          tracks: event.tracks,
          queueSize: event.queueSize,
        });
        return;
      case "playerQueueClear":
        this.emit("playerQueueClear", {
          guildId: event.guildId,
          clearedCount: event.clearedCount,
          queueSize: event.queueSize,
        });
        return;
      case "playerQueueDedupe":
        this.emit("playerQueueDedupe", {
          guildId: event.guildId,
          removedCount: event.removedCount,
          by: event.by,
        });
        return;
      case "playerQueueEmpty":
        this.emit("playerQueueEmpty", {
          guildId: event.guildId,
          reason: event.reason,
        });
        return;
      case "playerQueueInsert":
        this.emit("playerQueueInsert", {
          guildId: event.guildId,
          track: event.track,
          index: event.index,
          queueSize: event.queueSize,
        });
        return;
      case "playerQueueMove":
        this.emit("playerQueueMove", {
          guildId: event.guildId,
          from: event.from,
          to: event.to,
        });
        return;
      case "playerQueueRemove":
        this.emit("playerQueueRemove", {
          guildId: event.guildId,
          track: event.track,
          index: event.index,
          queueSize: event.queueSize,
        });
        return;
      case "playerQueueShuffle":
        this.emit("playerQueueShuffle", {
          guildId: event.guildId,
          queueSize: event.queueSize,
        });
        return;
      case "playerResume":
        this.emit("playerResume", {
          guildId: event.guildId,
        });
        return;
      case "playerRepeatQueue":
        this.emit("playerRepeatQueue", {
          guildId: event.guildId,
          enabled: event.enabled,
        });
        return;
      case "playerRepeatTrack":
        this.emit("playerRepeatTrack", {
          guildId: event.guildId,
          enabled: event.enabled,
        });
        return;
      case "playerSkip":
        this.emit("playerSkip", {
          guildId: event.guildId,
          skippedTrack: event.skippedTrack,
          nextTrack: event.nextTrack,
          reason: event.reason,
        });
        return;
      case "playerSeek":
        this.emit("playerSeek", {
          guildId: event.guildId,
          position: event.position,
        });
        return;
      case "playerStop":
        this.emit("playerStop", {
          guildId: event.guildId,
          destroyPlayer: event.destroyPlayer,
          disconnectVoice: event.disconnectVoice,
        });
        return;
      case "playerVolumeUpdate":
        this.emit("playerVolumeUpdate", {
          guildId: event.guildId,
          volume: event.volume,
        });
        return;
      default:
        return;
    }
  }

  private setupSocketListeners(): void {
    this.socket.on("ready", (payload) => {
      this.sessionId = payload.sessionId;
      this.syncedVoiceStateKeys.clear();
      this.emitDebug("ws", "Socket ready", {
        resumed: payload.resumed,
        sessionId: payload.sessionId,
      });

      if (this.options.resume) {
        this.rest.updateSession(this.sessionId, true, this.options.timeout).catch((err) => {
          this.emit(
            "error",
            new Error(
              `Failed to configure resuming: ${err instanceof Error ? err.message : String(err)}`
            )
          );
        });
      }

      this.emit("ready", payload);
    });

    this.socket.on("playerUpdate", (update) => {
      const player = this.players.get(update.guildId);
      if (player) {
        player.applyState(update.state);
      }
      this.emit("playerUpdate", {
        guildId: update.guildId,
        state: update.state,
      });
    });

    this.socket.on("stats", (stats) => {
      this.latestStats = stats;
      this.emit("stats", stats);
    });

    this.socket.on("event", (event) => {
      this.handleTrackEvent(event);
    });

    this.socket.on("error", (error) => {
      this.emitDebug("ws", "Socket error", {
        message: error.message,
      });
      this.emit("error", error);
    });

    this.socket.on("reconnecting", ({ attempt, delay }) => {
      this.emitDebug("ws", "Socket reconnecting", {
        attempt,
        delay,
      });
      this.emit("ws", {
        type: "nodeReconnecting",
        attempt,
        delay,
      });
    });

    this.socket.on("close", ({ code, reason }) => {
      this.emitDebug("ws", "Socket closed", {
        code,
        reason,
      });
      this.emit("ws", {
        type: "nodeDisconnect",
        code,
        reason,
      });
    });
  }

  private async sendVoiceStateUpdate(
    guildId: string,
    payload: {
      channelId: string | null;
      selfDeaf: boolean;
      selfMute: boolean;
    }
  ): Promise<void> {
    const sendGatewayPayload = this.options.sendGatewayPayload;
    if (!sendGatewayPayload) {
      return;
    }

    await sendGatewayPayload(guildId, {
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: payload.channelId,
        self_mute: payload.selfMute,
        self_deaf: payload.selfDeaf,
      },
    });
  }

  private handleTrackEvent(event: TrackEvent): void {
    if (event.type === "WebSocketClosedEvent") {
      const player = this.players.get(event.guildId);
      if (player) {
        player.connected = false;
      }

      this.emit("playerDisconnect", {
        guildId: event.guildId,
        reason: "voiceSocketClosed",
      });

      this.emit("voiceSocketClosed", {
        guildId: event.guildId,
        code: event.code,
        reason: event.reason,
        byRemote: event.byRemote,
      });
      return;
    }

    const player = this.players.get(event.guildId);
    if (!player) {
      return;
    }

    switch (event.type) {
      case "TrackStartEvent": {
        const track = Track.fromValidated(event.track);
        player.current = track;
        this.emit("trackStart", { player, track });
        break;
      }

      case "TrackEndEvent": {
        const track = Track.fromValidated(event.track);
        player.current = null;
        player.endTime = null;
        if (event.reason !== "cleanup" && event.reason !== "stopped") {
          player.pushHistory(track);
        }
        this.emit("trackEnd", { player, track, reason: event.reason });
        void this.handleQueueAdvance(player, event.reason, track);
        break;
      }

      case "TrackExceptionEvent": {
        const track = Track.fromValidated(event.track);
        this.emit("trackException", {
          player,
          track,
          exception: event.exception,
        });
        break;
      }

      case "TrackStuckEvent": {
        const track = Track.fromValidated(event.track);
        this.emit("trackStuck", {
          player,
          track,
          thresholdMs: event.thresholdMs,
        });
        break;
      }

      default:
        break;
    }
  }

  getVoicePayload(guildId: string): LavalinkVoicePayload | undefined {
    const state = this.voiceStates.get(guildId);
    const server = this.voiceServers.get(guildId);

    if (!state || !server) {
      return undefined;
    }

    return {
      channelId: state.channelId,
      endpoint: server.endpoint,
      sessionId: state.sessionId,
      token: server.token,
    };
  }

  getVoiceChannelId(guildId: string): string | undefined {
    return this.voiceStates.get(guildId)?.channelId;
  }

  getVoiceStateSnapshot(guildId: string): VoiceStateSnapshot | undefined {
    const state = this.voiceStates.get(guildId);
    const server = this.voiceServers.get(guildId);

    if (!state || !server) {
      return undefined;
    }

    return {
      channelId: state.channelId,
      endpoint: server.endpoint,
      sessionId: state.sessionId,
      token: server.token,
    };
  }

  setVoiceStateSnapshot(guildId: string, snapshot: VoiceStateSnapshot | undefined): void {
    if (!snapshot) {
      this.voiceStates.delete(guildId);
      this.voiceServers.delete(guildId);
      this.syncedVoiceStateKeys.delete(guildId);
      return;
    }

    this.voiceStates.set(guildId, {
      channelId: snapshot.channelId,
      sessionId: snapshot.sessionId,
    });
    this.voiceServers.set(guildId, {
      endpoint: snapshot.endpoint,
      token: snapshot.token,
    });
    this.syncedVoiceStateKeys.delete(guildId);
  }

  private handleVoiceServerPacket(packetData: Record<string, unknown>): void {
    const guildId = this.getString(packetData["guild_id"]);
    const token = this.getString(packetData["token"]);
    const endpoint = this.getString(packetData["endpoint"]);

    if (!guildId || !token || !endpoint) {
      return;
    }

    this.voiceServers.set(guildId, { token, endpoint });
    this.resolveVoiceWaiters(guildId);
    void this.trySyncVoiceState(guildId);
  }

  private handleVoiceStatePacket(packetData: Record<string, unknown>): void {
    const guildId = this.getString(packetData["guild_id"]);
    const userId = this.getString(packetData["user_id"]);

    if (!guildId || userId !== this.options.userId) {
      return;
    }

    const channelIdValue = packetData["channel_id"];
    if (channelIdValue === null) {
      const player = this.players.get(guildId);
      if (player) {
        player.connected = false;
      }

      this.emit("playerDisconnect", {
        guildId,
        reason: "voiceStateUpdate",
      });

      this.voiceStates.delete(guildId);
      this.voiceServers.delete(guildId);
      this.syncedVoiceStateKeys.delete(guildId);
      this.rejectVoiceWaiters(
        guildId,
        new Error(`Voice connection was closed for guild ${guildId}`)
      );
      return;
    }

    const channelId = this.getString(channelIdValue);
    const sessionId = this.getString(packetData["session_id"]);

    if (!channelId || !sessionId) {
      return;
    }

    this.voiceStates.set(guildId, { sessionId, channelId });

    const player = this.players.get(guildId);
    if (player) {
      player.connected = true;
    }

    this.resolveVoiceWaiters(guildId);
    void this.trySyncVoiceState(guildId);
  }

  private hasVoiceCredentials(guildId: string): boolean {
    return this.voiceStates.has(guildId) && this.voiceServers.has(guildId);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private getString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private resolveVoiceWaiters(guildId: string): void {
    if (!this.hasVoiceCredentials(guildId)) {
      return;
    }

    const waiters = this.voiceWaiters.get(guildId);
    if (!waiters) {
      return;
    }

    this.voiceWaiters.delete(guildId);

    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
  }

  private rejectVoiceWaiters(guildId: string, error: Error): void {
    const waiters = this.voiceWaiters.get(guildId);
    if (!waiters) {
      return;
    }

    this.voiceWaiters.delete(guildId);

    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  private async trySyncVoiceState(guildId: string): Promise<void> {
    const sessionId = this.sessionId;
    const voicePayload = this.getVoicePayload(guildId);

    if (!sessionId || !voicePayload) {
      return;
    }

    const voiceKey = `${sessionId}:${voicePayload.sessionId}:${voicePayload.channelId}:${voicePayload.endpoint}:${voicePayload.token}`;
    if (this.syncedVoiceStateKeys.get(guildId) === voiceKey) {
      return;
    }

    try {
      await this.rest.updatePlayer(sessionId, guildId, { voice: voicePayload });
      this.syncedVoiceStateKeys.set(guildId, voiceKey);
      this.emitDebug("voice", "Synchronized voice state to Lavalink", {
        guildId,
      });
    } catch (error) {
      this.emitDebug("voice", "Failed to synchronize voice state", {
        guildId,
        message: error instanceof Error ? error.message : String(error),
      });
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }

  private emitDebug(
    category: NodeDebugEvent["category"],
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.emit("debug", {
      category,
      message,
      context,
    });
  }

  private waitForVoice(guildId: string, timeoutMs: number): Promise<void> {
    if (this.hasVoiceCredentials(guildId)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const waiter: VoiceWaiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const waiters = this.voiceWaiters.get(guildId);

          if (waiters) {
            const nextWaiters = waiters.filter((candidate) => candidate !== waiter);

            if (nextWaiters.length === 0) {
              this.voiceWaiters.delete(guildId);
            } else {
              this.voiceWaiters.set(guildId, nextWaiters);
            }
          }

          reject(new Error(`Voice connection timed out for guild ${guildId}`));
        }, timeoutMs),
      };

      const guildWaiters = this.voiceWaiters.get(guildId);
      if (guildWaiters) {
        guildWaiters.push(waiter);
        return;
      }

      this.voiceWaiters.set(guildId, [waiter]);
    });
  }

  private async handleQueueAdvance(
    player: Player,
    reason: "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup",
    endedTrack: Track
  ): Promise<void> {
    if (reason === "finished" && player.isRepeatTrackEnabled) {
      await player.play(endedTrack);
      return;
    }

    if (reason === "finished" && player.isRepeatQueueEnabled) {
      player.add(endedTrack);

      if (!player.queue.isEmpty) {
        await player.play();
      } else {
        player.notifyQueueEmpty("trackEnd");
      }

      return;
    }

    if (!this.shouldAutoAdvance(reason)) {
      return;
    }

    if (player.queue.isEmpty) {
      player.notifyQueueEmpty("trackEnd");
      return;
    }

    try {
      await player.play();
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }

  private shouldAutoAdvance(
    reason: "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup"
  ): reason is AutoAdvanceReason {
    return AUTO_ADVANCE_REASONS.has(reason as AutoAdvanceReason);
  }

  setSearchResultTransformer(
    transformer:
      | ((
          context: {
            guildId: string;
            player: Player;
            provider?: SearchProviderInput;
            query: string;
          },
          result: SearchResult
        ) => Promise<SearchResult> | SearchResult)
      | undefined
  ): void {
    this.searchResultTransformer = transformer;
  }

  async transformSearchResult(
    context: { guildId: string; player: Player; provider?: SearchProviderInput; query: string },
    result: SearchResult
  ): Promise<SearchResult> {
    return (await this.searchResultTransformer?.(context, result)) ?? result;
  }

  async restorePlayer(player: Player): Promise<void> {
    if (!this.sessionId) {
      throw new Error(`Node ${this.id} is not connected`);
    }

    const snapshot = player.getRestoreState();
    const voicePayload = this.getVoicePayload(player.guildId);
    const payload: PlayerUpdatePayload = {};

    if (snapshot.current) {
      payload.track = { encoded: snapshot.current.encoded };
      if (snapshot.position > 0) {
        payload.position = snapshot.position;
      }
    }

    if (snapshot.endTime !== null) {
      payload.endTime = snapshot.endTime;
    }

    if (snapshot.volume !== 100) {
      payload.volume = snapshot.volume;
    }

    if (snapshot.paused) {
      payload.paused = true;
    }

    if (Object.keys(snapshot.filters).length > 0) {
      payload.filters = snapshot.filters;
    }

    if (voicePayload) {
      payload.voice = voicePayload;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    await this.rest.updatePlayer(this.sessionId, player.guildId, payload);
  }

  async importPlayer(
    guildId: string,
    snapshot: PlayerExportData,
    options?: PlayerOptions
  ): Promise<Player> {
    const player = this.createPlayer(guildId, options);
    await player.import(snapshot);
    return player;
  }
}
