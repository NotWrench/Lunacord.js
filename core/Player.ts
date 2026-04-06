// core/Player.ts

import type { Rest } from "../rest/Rest.ts";
import { Queue } from "../structures/Queue.ts";
import type { SearchResult } from "../structures/SearchResult.ts";
import { toSearchResult } from "../structures/SearchResult.ts";
import type { Track } from "../structures/Track.ts";
import type { Filters, PlayerUpdatePayload, SearchProvider } from "../types.ts";
import type { VoiceConnectOptions } from "./Node.ts";

const MAX_VOLUME = 1000;
const MIN_VOLUME = 0;

const BASSBOOST_FILTERS: Filters = {
  equalizer: [
    { band: 0, gain: 0.15 },
    { band: 1, gain: 0.125 },
    { band: 2, gain: 0.1 },
  ],
};

const NIGHTCORE_FILTERS: Filters = {
  timescale: {
    pitch: 1.2,
    rate: 1.0,
    speed: 1.15,
  },
};

const VAPORWAVE_FILTERS: Filters = {
  timescale: {
    pitch: 0.85,
    rate: 1.0,
    speed: 0.8,
  },
};

const KARAOKE_FILTERS: Filters = {
  karaoke: {
    filterBand: 220,
    filterWidth: 100,
    level: 1,
    monoLevel: 1,
  },
};

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
      reason: "manual" | "repeatQueue" | "repeatTrack";
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
    }
  | {
      filters: Filters;
      guildId: string;
      type: "playerFiltersClear";
    }
  | {
      filters: Filters;
      guildId: string;
      type: "playerFiltersUpdate";
    }
  | {
      enabled: boolean;
      guildId: string;
      type: "playerRepeatQueue";
    }
  | {
      enabled: boolean;
      guildId: string;
      type: "playerRepeatTrack";
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
  filters: Filters = {};
  paused = false;
  volume = 100;
  position = 0;
  connected = false;
  private repeatQueueEnabled = false;
  private repeatTrackEnabled = false;

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

  get isRepeatQueueEnabled(): boolean {
    return this.repeatQueueEnabled;
  }

  get isRepeatTrackEnabled(): boolean {
    return this.repeatTrackEnabled;
  }

  repeatQueue(enabled?: boolean): boolean {
    const next = enabled ?? !this.repeatQueueEnabled;
    this.repeatQueueEnabled = next;

    if (next) {
      this.repeatTrackEnabled = false;
    }

    this.emitActionEvent({
      type: "playerRepeatQueue",
      guildId: this.guildId,
      enabled: this.repeatQueueEnabled,
    });

    return this.repeatQueueEnabled;
  }

  repeatTrack(enabled?: boolean): boolean {
    const next = enabled ?? !this.repeatTrackEnabled;
    this.repeatTrackEnabled = next;

    if (next) {
      this.repeatQueueEnabled = false;
    }

    this.emitActionEvent({
      type: "playerRepeatTrack",
      guildId: this.guildId,
      enabled: this.repeatTrackEnabled,
    });

    return this.repeatTrackEnabled;
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

  async setFilters(filters: Filters): Promise<void> {
    this.filters = cloneFilters(filters);
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      filters: this.filters,
    });
    this.emitActionEvent({
      type: "playerFiltersUpdate",
      guildId: this.guildId,
      filters: this.filters,
    });
  }

  async updateFilters(filters: Partial<Filters>): Promise<void> {
    await this.setFilters(mergeFilters(this.filters, filters));
  }

  async clearFilters(): Promise<void> {
    this.filters = {};
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      filters: this.filters,
    });
    this.emitActionEvent({
      type: "playerFiltersClear",
      guildId: this.guildId,
      filters: this.filters,
    });
  }

  setBassboost(): Promise<void> {
    return this.setFilters(BASSBOOST_FILTERS);
  }

  setNightcore(): Promise<void> {
    return this.setFilters(NIGHTCORE_FILTERS);
  }

  setVaporwave(): Promise<void> {
    return this.setFilters(VAPORWAVE_FILTERS);
  }

  setKaraoke(): Promise<void> {
    return this.setFilters(KARAOKE_FILTERS);
  }

  async skip(): Promise<void> {
    const skippedTrack = this.current;

    if (!skippedTrack) {
      this.emitActionEvent({
        type: "playerSkip",
        guildId: this.guildId,
        skippedTrack: null,
        nextTrack: null,
        reason: "manual",
      });
      return;
    }

    if (this.repeatTrackEnabled) {
      await this.stop(false, false);
      await this.play(skippedTrack);

      this.emitActionEvent({
        type: "playerSkip",
        guildId: this.guildId,
        skippedTrack,
        nextTrack: this.current,
        reason: "repeatTrack",
      });
      return;
    }

    if (this.repeatQueueEnabled) {
      this.add(skippedTrack);
    }

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
      reason: this.repeatQueueEnabled ? "repeatQueue" : "manual",
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

const cloneFilters = (filters: Filters): Filters => JSON.parse(JSON.stringify(filters)) as Filters;

const mergeFilters = (current: Filters, next: Partial<Filters>): Filters => ({
  ...current,
  ...next,
  channelMix: mergeObject(current.channelMix, next.channelMix),
  distortion: mergeObject(current.distortion, next.distortion),
  karaoke: mergeObject(current.karaoke, next.karaoke),
  lowPass: mergeObject(current.lowPass, next.lowPass),
  pluginFilters: mergeObject(current.pluginFilters, next.pluginFilters),
  rotation: mergeObject(current.rotation, next.rotation),
  timescale: mergeObject(current.timescale, next.timescale),
  tremolo: mergeObject(current.tremolo, next.tremolo),
  vibrato: mergeObject(current.vibrato, next.vibrato),
});

const mergeObject = <T extends object>(current?: T, next?: Partial<T>): T | undefined => {
  if (!current && !next) {
    return undefined;
  }

  return {
    ...current,
    ...next,
  } as T;
};
