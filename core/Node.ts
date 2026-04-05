// core/Node.ts

import { Rest } from "../rest/Rest.ts";
import { Track } from "../structures/Track.ts";
import type { Exception, PlayerState, ReadyPayload, Stats, TrackEvent } from "../types.ts";
import { TypedEventEmitter } from "../utils/EventEmitter.ts";
import { Socket } from "../websocket/Socket.ts";
import { Player } from "./Player.ts";

interface NodeEvents {
  error: Error;
  playerUpdate: { guildId: string; state: PlayerState };
  ready: ReadyPayload;
  stats: Stats;
  trackEnd: { player: Player; track: Track; reason: string };
  trackException: { player: Player; track: Track; exception: Exception };
  trackStart: { player: Player; track: Track };
  trackStuck: { player: Player; track: Track; thresholdMs: number };
}

interface NodeOptions {
  clientName?: string;
  host: string;
  numShards: number;
  password: string;
  port: number;
  resume?: boolean;
  timeout?: number;
  userId: string;
}

const DEFAULT_CLIENT_NAME = "lavalink-client";
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const AUTO_ADVANCE_REASONS = new Set(["finished", "loadFailed"] as const);
type AutoAdvanceReason = "finished" | "loadFailed";

export class Node extends TypedEventEmitter<NodeEvents> {
  sessionId: string | null = null;
  readonly rest: Rest;
  readonly socket: Socket;

  private readonly options: NodeOptions;
  private readonly players = new Map<string, Player>();
  private connectPromise: Promise<void> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(options: NodeOptions) {
    super();

    this.options = options;
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

  createPlayer(guildId: string): Player {
    const existing = this.players.get(guildId);
    if (existing) {
      return existing;
    }

    const player = new Player(guildId, this);
    this.players.set(guildId, player);
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
  }

  getPlayer(guildId: string): Player | undefined {
    return this.players.get(guildId);
  }

  private setupSocketListeners(): void {
    this.socket.on("ready", (payload) => {
      this.sessionId = payload.sessionId;

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

    this.socket.on("close", ({ code, reason }) => {
      this.emit("error", new Error(`WebSocket closed: ${code} ${reason}`));
    });
  }

  private handleTrackEvent(event: TrackEvent): void {
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
        void this.handleQueueAdvance(player, event.reason);
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

      case "WebSocketClosedEvent":
        player.connected = false;
        this.emit(
          "error",
          new Error(
            `Voice WebSocket closed for guild ${event.guildId}: ${event.code} ${event.reason}`
          )
        );
        break;

      default:
        break;
    }
  }

  private async handleQueueAdvance(
    player: Player,
    reason: "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup"
  ): Promise<void> {
    if (!this.shouldAutoAdvance(reason) || player.queue.length === 0) {
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
