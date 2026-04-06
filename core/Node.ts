// core/Node.ts

import { Rest } from "../rest/Rest.ts";
import { Track } from "../structures/Track.ts";
import type {
  Exception,
  PlayerState,
  PlayerUpdatePayload,
  ReadyPayload,
  Stats,
  TrackEvent,
} from "../types.ts";
import { TypedEventEmitter } from "../utils/EventEmitter.ts";
import { Socket } from "../websocket/Socket.ts";
import { Player, type PlayerActionEvent } from "./Player.ts";

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
  playerQueueRemove: PlayerActionPayload<"playerQueueRemove">;
  playerRepeatQueue: PlayerActionPayload<"playerRepeatQueue">;
  playerRepeatTrack: PlayerActionPayload<"playerRepeatTrack">;
  playerResume: PlayerActionPayload<"playerResume">;
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
  numShards: number;
  password: string;
  port: number;
  resume?: boolean;
  sendGatewayPayload?: (guildId: string, payload: GatewayVoiceStatePayload) => void | Promise<void>;
  timeout?: number;
  userId: string;
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
type VoicePayload = NonNullable<PlayerUpdatePayload["voice"]>;

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
  private voicePacketForwardingEnabled = false;

  constructor(options: NodeOptions) {
    super();

    this.options = options;
    this.id = options.id ?? `${options.host}:${options.port}`;
    const clientName = options.clientName ?? DEFAULT_CLIENT_NAME;

    this.rest = new Rest({
      baseUrl: `http://${options.host}:${options.port}`,
      password: options.password,
    });

    this.socket = new Socket({
      host: options.host,
      port: options.port,
      password: options.password,
      userId: options.userId,
      numShards: options.numShards,
      clientName,
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

  createPlayer(guildId: string): Player {
    const existing = this.players.get(guildId);
    if (existing) {
      return existing;
    }

    const player = new Player(guildId, this);
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

  get connected(): boolean {
    return this.sessionId !== null;
  }

  handleVoicePacket(packet: unknown): void {
    this.voicePacketForwardingEnabled = true;

    if (!this.isRecord(packet)) {
      return;
    }

    const packetType = packet["t"];
    const packetData = packet["d"];

    if (typeof packetType !== "string" || !this.isRecord(packetData)) {
      return;
    }

    if (packetType === "VOICE_STATE_UPDATE") {
      this.handleVoiceStatePacket(packetData);
      return;
    }

    if (packetType === "VOICE_SERVER_UPDATE") {
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
      case "playerQueueRemove":
        this.emit("playerQueueRemove", {
          guildId: event.guildId,
          track: event.track,
          index: event.index,
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
        player.position = update.state.position;
        player.connected = update.state.connected;
      }
      this.emit("playerUpdate", {
        guildId: update.guildId,
        state: update.state,
      });
    });

    this.socket.on("stats", (stats) => {
      this.emit("stats", stats);
    });

    this.socket.on("event", (event) => {
      this.handleTrackEvent(event);
    });

    this.socket.on("error", (error) => {
      this.emit("error", error);
    });

    this.socket.on("reconnecting", ({ attempt, delay }) => {
      this.emit("ws", {
        type: "nodeReconnecting",
        attempt,
        delay,
      });
    });

    this.socket.on("close", ({ code, reason }) => {
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
        const track = new Track(event.track);
        player.current = track;
        this.emit("trackStart", { player, track });
        break;
      }

      case "TrackEndEvent": {
        const track = new Track(event.track);
        player.current = null;
        this.emit("trackEnd", { player, track, reason: event.reason });
        void this.handleQueueAdvance(player, event.reason, track);
        break;
      }

      case "TrackExceptionEvent": {
        const track = new Track(event.track);
        this.emit("trackException", {
          player,
          track,
          exception: event.exception,
        });
        break;
      }

      case "TrackStuckEvent": {
        const track = new Track(event.track);
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

  getVoicePayload(guildId: string): VoicePayload | undefined {
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
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
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
      }

      return;
    }

    if (!this.shouldAutoAdvance(reason) || player.queue.isEmpty) {
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
}
