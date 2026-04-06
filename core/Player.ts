// core/Player.ts

import type { Rest } from "../rest/Rest.ts";
import { Queue } from "../structures/Queue.ts";
import type { SearchResult } from "../structures/SearchResult.ts";
import { toSearchResult } from "../structures/SearchResult.ts";
import type { Track } from "../structures/Track.ts";
import type { PlayerUpdatePayload, SearchProvider } from "../types.ts";
import type { VoiceConnectOptions } from "./Node.ts";

const MAX_VOLUME = 1000;
const MIN_VOLUME = 0;

export type PlayerActionEvent =
  | {
      type: "playerPause";
      guildId: string;
    }
  | {
      type: "playerPlay";
      guildId: string;
      source: "direct" | "queue";
      track: Track;
    }
  | {
      type: "playerQueueAdd";
      guildId: string;
      queueSize: number;
      track: Track;
    }
  | {
      type: "playerQueueRemove";
      guildId: string;
      index: number;
      queueSize: number;
      track: Track;
    }
  | {
      type: "playerResume";
      guildId: string;
    }
  | {
      type: "playerSkip";
      guildId: string;
      nextTrack: Track | null;
      skippedTrack: Track | null;
    }
  | {
      type: "playerStop";
      destroyPlayer: boolean;
      disconnectVoice: boolean;
      guildId: string;
    }
  | {
      type: "playerVolumeUpdate";
      guildId: string;
      volume: number;
    };

export interface PlayerNodeAdapter {
  connectVoice?: (
    guildId: string,
    channelId: string,
    options?: VoiceConnectOptions
  ) => Promise<void>;
  destroyPlayer?: (guildId: string) => Promise<void>;
  disconnectVoice?: (guildId: string) => Promise<void>;
  emitPlayerEvent?: (event: PlayerActionEvent) => void;
  getVoicePayload?: (guildId: string) => NonNullable<PlayerUpdatePayload["voice"]> | undefined;
  readonly rest: Pick<Rest, "loadTracks" | "search" | "updatePlayer">;
  readonly sessionId: string | null;
}

export class Player {
  readonly guildId: string;
  readonly queue = new Queue();
  current: Track | null = null;
  paused = false;
  volume = 100;
  position = 0;
  connected = false;

  private readonly node: PlayerNodeAdapter;

  constructor(guildId: string, node: PlayerNodeAdapter) {
    this.guildId = guildId;
    this.node = node;
  }

  private emitActionEvent(event: PlayerActionEvent): void {
    this.node.emitPlayerEvent?.(event);
  }

  private getSessionId(): string {
    const sessionId = this.node.sessionId;
    if (!sessionId) {
      throw new Error("Node is not connected — sessionId is null");
    }
    return sessionId;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(channelId: string, options?: VoiceConnectOptions): Promise<void> {
    if (!this.node.connectVoice) {
      throw new Error("Player node adapter does not expose connectVoice");
    }

    await this.node.connectVoice(this.guildId, channelId, options);
    this.connected = true;
  }

  async play(track?: Track): Promise<void> {
    const target = track ?? this.queue.dequeue();
    const source: "direct" | "queue" = track ? "direct" : "queue";

    if (!target) {
      return;
    }

    this.current = target;
    this.paused = false;

    const voicePayload = this.node.getVoicePayload?.(this.guildId);
    const payload: PlayerUpdatePayload = {
      track: { encoded: target.encoded },
    };

    if (voicePayload) {
      payload.voice = voicePayload;
    }

    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, payload);
    this.emitActionEvent({
      type: "playerPlay",
      guildId: this.guildId,
      track: target,
      source,
    });
  }

  async pause(paused: boolean): Promise<void> {
    this.paused = paused;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      paused,
    });
    this.emitActionEvent({
      type: paused ? "playerPause" : "playerResume",
      guildId: this.guildId,
    });
  }

  async stop(destroyPlayer = true, disconnectVoice = true): Promise<void> {
    this.current = null;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      track: { encoded: null },
    });

    if (disconnectVoice) {
      this.connected = false;
      await this.node.disconnectVoice?.(this.guildId);
    }

    if (destroyPlayer) {
      await this.node.destroyPlayer?.(this.guildId);
    }

    this.emitActionEvent({
      type: "playerStop",
      guildId: this.guildId,
      destroyPlayer,
      disconnectVoice,
    });
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume));
    this.volume = clamped;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      volume: clamped,
    });
    this.emitActionEvent({
      type: "playerVolumeUpdate",
      guildId: this.guildId,
      volume: clamped,
    });
  }

  async skip(): Promise<void> {
    const skippedTrack = this.current;
    await this.stop(false, false);

    let nextTrack: Track | null = null;
    if (!this.queue.isEmpty) {
      await this.play();
      nextTrack = this.current;
    }

    this.emitActionEvent({
      type: "playerSkip",
      guildId: this.guildId,
      skippedTrack,
      nextTrack,
    });
  }

  async search(query: string, provider?: SearchProvider): Promise<SearchResult> {
    const result = await this.node.rest.search(query, provider);
    return toSearchResult(result);
  }

  async searchAndPlay(query: string, provider?: SearchProvider): Promise<SearchResult> {
    const result = await this.search(query, provider);

    if (result.loadType === "empty" || result.loadType === "error" || result.tracks.length === 0) {
      return result;
    }

    if (this.current) {
      this.queue.enqueueMany(result.loadType === "playlist" ? result.tracks : [result.tracks[0]!]);
      return result;
    }

    this.queue.enqueueMany(result.loadType === "playlist" ? result.tracks : [result.tracks[0]!]);
    await this.play();
    return result;
  }

  add(track: Track): void {
    this.queue.enqueue(track);
    this.emitActionEvent({
      type: "playerQueueAdd",
      guildId: this.guildId,
      track,
      queueSize: this.queue.size,
    });
  }

  remove(index: number): Track | undefined {
    const removed = this.queue.remove(index);
    if (removed) {
      this.emitActionEvent({
        type: "playerQueueRemove",
        guildId: this.guildId,
        track: removed,
        index,
        queueSize: this.queue.size,
      });
    }

    return removed;
  }
}
