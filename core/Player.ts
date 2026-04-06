// core/Player.ts

import type { Rest } from "../rest/Rest.ts";
import { Queue, type QueueRemoveDuplicateOptions } from "../structures/Queue.ts";
import type { SearchResult } from "../structures/SearchResult.ts";
import { toSearchResult } from "../structures/SearchResult.ts";
import type { Track } from "../structures/Track.ts";
import type { Filters, PlayerState, PlayerUpdatePayload, SearchProvider } from "../types.ts";
import type { VoiceConnectOptions } from "./Node.ts";

const MAX_VOLUME = 1000;
const MIN_VOLUME = 0;

export const BASSBOOST_FILTERS: Filters = {
  equalizer: [
    { band: 0, gain: 0.15 },
    { band: 1, gain: 0.125 },
    { band: 2, gain: 0.1 },
  ],
};

export const NIGHTCORE_FILTERS: Filters = {
  timescale: {
    pitch: 1.2,
    rate: 1.0,
    speed: 1.15,
  },
};

export const VAPORWAVE_FILTERS: Filters = {
  timescale: {
    pitch: 0.85,
    rate: 1.0,
    speed: 0.8,
  },
};

export const KARAOKE_FILTERS: Filters = {
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
      by: "encoded" | "uri";
      guildId: string;
      removedCount: number;
      type: "playerQueueDedupe";
    }
  | {
      guildId: string;
      position: number;
      type: "playerSeek";
    }
  | {
      type: "playerQueueAdd";
      guildId: string;
      queueSize: number;
      track: Track;
    }
  | {
      from: number;
      guildId: string;
      to: number;
      type: "playerQueueMove";
    }
  | {
      type: "playerQueueRemove";
      guildId: string;
      index: number;
      queueSize: number;
      track: Track;
    }
  | {
      guildId: string;
      index: number;
      queueSize: number;
      track: Track;
      type: "playerQueueInsert";
    }
  | {
      guildId: string;
      queueSize: number;
      type: "playerQueueShuffle";
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
  transformSearchResult?: (
    context: { guildId: string; player: Player; provider?: SearchProvider; query: string },
    result: SearchResult
  ) => Promise<SearchResult> | SearchResult;
}

export class Player {
  readonly guildId: string;
  readonly queue = new Queue();
  current: Track | null = null;
  filters: Filters = {};
  paused = false;
  volume = 100;
  position = 0;
  ping = -1;
  connected = false;
  private repeatQueueEnabled = false;
  private repeatTrackEnabled = false;
  private lastStateTime = 0;
  private lastUpdateAt = 0;

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

  async play(track?: Track, options?: { noReplace?: boolean }): Promise<void> {
    const target = track ?? this.queue.dequeue();
    const source: "direct" | "queue" = track ? "direct" : "queue";

    if (!target) {
      return;
    }

    this.current = target;
    this.paused = false;
    this.position = 0;
    this.lastStateTime = Date.now();
    this.lastUpdateAt = this.lastStateTime;

    const voicePayload = this.node.getVoicePayload?.(this.guildId);
    const payload: PlayerUpdatePayload = {
      track: { encoded: target.encoded },
    };

    if (voicePayload) {
      payload.voice = voicePayload;
    }

    if (options) {
      await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, payload, options);
    } else {
      await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, payload);
    }
    this.emitActionEvent({
      type: "playerPlay",
      guildId: this.guildId,
      track: target,
      source,
    });
  }

  async pause(paused: boolean): Promise<void> {
    this.position = this.getEstimatedPosition();
    this.lastStateTime = Date.now();
    this.lastUpdateAt = this.lastStateTime;
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
    this.position = 0;
    this.lastStateTime = 0;
    this.lastUpdateAt = 0;
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
    const searchResult = toSearchResult(result);
    return (
      (await this.node.transformSearchResult?.(
        {
          guildId: this.guildId,
          player: this,
          provider,
          query,
        },
        searchResult
      )) ?? searchResult
    );
  }

  async searchAndPlay(query: string, provider?: SearchProvider): Promise<SearchResult> {
    const result = await this.search(query, provider);

    if (result.loadType === "empty" || result.loadType === "error" || result.tracks.length === 0) {
      return result;
    }

    const tracksToQueue = result.loadType === "playlist" ? result.tracks : [result.tracks[0]!];
    this.enqueueTracks(tracksToQueue);

    if (!this.current) {
      await this.play();
    }
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

  private enqueueTracks(tracks: Track[]): void {
    for (const track of tracks) {
      this.add(track);
    }
  }

  insert(index: number, track: Track): void {
    this.queue.insert(index, track);
    this.emitActionEvent({
      type: "playerQueueInsert",
      guildId: this.guildId,
      track,
      index: Math.max(0, Math.min(index, this.queue.size - 1)),
      queueSize: this.queue.size,
    });
  }

  moveQueue(from: number, to: number): void {
    this.queue.move(from, to);
    this.emitActionEvent({
      type: "playerQueueMove",
      guildId: this.guildId,
      from,
      to: Math.max(0, Math.min(to, Math.max(this.queue.size - 1, 0))),
    });
  }

  shuffleQueue(): void {
    this.queue.shuffle();
    this.emitActionEvent({
      type: "playerQueueShuffle",
      guildId: this.guildId,
      queueSize: this.queue.size,
    });
  }

  removeDuplicateTracks(options?: QueueRemoveDuplicateOptions): number {
    const removedCount = this.queue.removeDuplicates(options);
    this.emitActionEvent({
      type: "playerQueueDedupe",
      guildId: this.guildId,
      removedCount,
      by: options?.by ?? "encoded",
    });
    return removedCount;
  }

  getQueue(): Track[] {
    return this.queue.toArray();
  }

  async seek(positionMs: number): Promise<void> {
    if (!this.current) {
      throw new Error("Cannot seek without a current track");
    }

    const nextPosition = clampPosition(positionMs, this.current);
    this.position = nextPosition;
    this.lastStateTime = Date.now();
    this.lastUpdateAt = this.lastStateTime;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      position: nextPosition,
    });
    this.emitActionEvent({
      type: "playerSeek",
      guildId: this.guildId,
      position: nextPosition,
    });
  }

  getEstimatedPosition(): number {
    if (!this.current) {
      return 0;
    }

    if (this.paused || !this.connected || this.lastUpdateAt === 0) {
      return clampPosition(this.position, this.current);
    }

    const elapsed = Math.max(0, Date.now() - this.lastUpdateAt);
    return clampPosition(this.position + elapsed, this.current);
  }

  applyState(state: PlayerState): void {
    this.position = state.position;
    this.connected = state.connected;
    this.ping = state.ping;
    this.lastStateTime = state.time;
    this.lastUpdateAt = Date.now();
  }

  getRestoreState(): {
    current: Track | null;
    filters: Filters;
    paused: boolean;
    position: number;
    queue: Track[];
    repeatQueueEnabled: boolean;
    repeatTrackEnabled: boolean;
    volume: number;
  } {
    return {
      current: this.current,
      filters: cloneFilters(this.filters),
      paused: this.paused,
      position: this.getEstimatedPosition(),
      queue: this.getQueue(),
      repeatQueueEnabled: this.repeatQueueEnabled,
      repeatTrackEnabled: this.repeatTrackEnabled,
      volume: this.volume,
    };
  }
}

const cloneFilters = (filters: Filters): Filters => JSON.parse(JSON.stringify(filters)) as Filters;

const mergeFilters = (current: Filters, next: Partial<Filters>): Filters => ({
  ...current,
  ...next,
  channelMix: mergeObject(current.channelMix, next.channelMix),
  distortion: mergeObject(current.distortion, next.distortion),
  equalizer: mergeEqualizer(current.equalizer, next.equalizer),
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

type EqualizerBand = NonNullable<Filters["equalizer"]>[number];

const mergeEqualizer = (
  current?: Filters["equalizer"],
  next?: Filters["equalizer"]
): Filters["equalizer"] => {
  if (!current && !next) {
    return undefined;
  }

  if (!current) {
    return next;
  }

  if (!next) {
    return current;
  }

  const merged = new Map<number, EqualizerBand>();

  for (const band of current) {
    merged.set(band.band, band);
  }

  for (const band of next) {
    merged.set(band.band, band);
  }

  return [...merged.values()].sort((left, right) => left.band - right.band);
};

const clampPosition = (positionMs: number, track: Track): number => {
  const nonNegativePosition = Math.max(0, positionMs);
  if (track.isStream) {
    return nonNegativePosition;
  }

  return Math.min(nonNegativePosition, track.duration);
};
