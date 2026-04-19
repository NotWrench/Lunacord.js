import type { FilterBuilder } from "../domain/filter/Filter";
import { Filter } from "../domain/filter/Filter";

export {
  BASSBOOST_FILTERS,
  FilterBuilder,
  KARAOKE_FILTERS,
  NIGHTCORE_FILTERS,
  VAPORWAVE_FILTERS,
} from "../domain/filter/Filter";

import { Queue, type QueueRemoveDuplicateOptions } from "../domain/queue/Queue";
import { QueueHistory } from "../domain/queue/QueueHistory";
import type { SearchResult } from "../domain/track/SearchResult";
import { toSearchResult } from "../domain/track/SearchResult";
import { Track, type Track as TrackType } from "../domain/track/Track";
import { InvalidPlayerStateError } from "../errors/LunacordError";
import type { Rest } from "../transports/rest/Rest";
import type {
  Filters,
  LyricsRequestOptions,
  LyricsResult,
  PlayerState,
  PlayerUpdatePayload,
  RawTrack,
  SearchProviderInput,
} from "../types";
import type { LyricsProvider } from "../types/lyrics";
import type { VoiceConnectOptions } from "./Node";

const MAX_VOLUME = 1000;
const MIN_VOLUME = 0;
const DEFAULT_QUEUE_END_DESTROY_DELAY_MS = 120_000;

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
      type: "playerQueueAddMany";
      guildId: string;
      queueSize: number;
      tracks: Track[];
    }
  | {
      type: "playerQueueClear";
      clearedCount: number;
      guildId: string;
      queueSize: number;
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
      guildId: string;
      reason: "manual" | "trackEnd";
      type: "playerQueueEmpty";
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
  getVoiceChannelId?: (guildId: string) => string | undefined;
  getVoicePayload?: (guildId: string) => NonNullable<PlayerUpdatePayload["voice"]> | undefined;
  readonly lyricsClient?: LyricsProvider;
  readonly rest: Pick<Rest, "loadTracks" | "search" | "updatePlayer">;
  readonly sessionId: string | null;
  transformSearchResult?: (
    context: { guildId: string; player: Player; provider?: SearchProviderInput; query: string },
    result: SearchResult
  ) => Promise<SearchResult> | SearchResult;
}

export interface PlayerOptions {
  historyMaxSize?: number;
  onQueueEmpty?: (player: Player, reason: "manual" | "trackEnd") => Promise<void> | void;
  queueEndDestroyDelayMs?: number;
}

export interface PlayerExportData {
  connected: boolean;
  current: RawTrack | null;
  endTime: number | null;
  filters: Filters;
  history: RawTrack[];
  paused: boolean;
  position: number;
  queue: RawTrack[];
  repeatQueueEnabled: boolean;
  repeatTrackEnabled: boolean;
  shouldResume: boolean;
  textChannelId: string | null;
  voiceChannelId: string | null;
  volume: number;
}

export class Player {
  readonly guildId: string;
  readonly history: QueueHistory;
  readonly queue = new Queue();
  readonly filter: Filter;
  current: Track | null = null;
  endTime: number | null = null;
  paused = false;
  volume = 100;
  position = 0;
  ping = -1;
  connected = false;
  textChannelId: string | null = null;
  private repeatQueueEnabled = false;
  private repeatTrackEnabled = false;
  private lastStateTime = 0;
  private lastUpdateAt = 0;
  private queueEndDestroyTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly queueEndDestroyDelayMs: number;

  private readonly node: PlayerNodeAdapter;
  private readonly options: PlayerOptions;

  constructor(guildId: string, node: PlayerNodeAdapter, options: PlayerOptions = {}) {
    this.guildId = guildId;
    this.node = node;
    this.options = options;
    this.queueEndDestroyDelayMs = normalizeQueueEndDestroyDelay(options.queueEndDestroyDelayMs);
    this.history = new QueueHistory(options.historyMaxSize);
    this.filter = new Filter({
      guildId,
      getSessionId: () => this.getSessionId(),
      rest: this.node.rest,
      onClear: (filters) => {
        this.emitActionEvent({
          type: "playerFiltersClear",
          guildId: this.guildId,
          filters,
        });
      },
      onUpdate: (filters) => {
        this.emitActionEvent({
          type: "playerFiltersUpdate",
          guildId: this.guildId,
          filters,
        });
      },
    });
  }

  private emitActionEvent(event: PlayerActionEvent): void {
    this.node.emitPlayerEvent?.(event);
  }

  private getSessionId(): string {
    const sessionId = this.node.sessionId;
    if (!sessionId) {
      throw new InvalidPlayerStateError({
        code: "PLAYER_SESSION_UNAVAILABLE",
        message: "Cannot perform this operation before the node session is ready",
        context: {
          guildId: this.guildId,
          operation: "player.getSessionId",
        },
      });
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

  get filters(): Filters {
    return this.filter.value;
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
      throw new InvalidPlayerStateError({
        code: "PLAYER_CONNECT_UNSUPPORTED",
        message: "Player node adapter does not expose connectVoice",
        context: {
          guildId: this.guildId,
          operation: "player.connect",
        },
      });
    }

    await this.node.connectVoice(this.guildId, channelId, options);
    this.connected = true;
  }

  /**
   * Sets the text channel metadata associated with this player.
   */
  setTextChannel(channelId: string | null): this {
    this.textChannelId = channelId;
    return this;
  }

  async play(track?: Track, options?: { noReplace?: boolean }): Promise<void> {
    this.clearQueueEndDestroyTimer();
    const target = track ?? this.queue.dequeue();
    const source: "direct" | "queue" = track ? "direct" : "queue";

    if (!target) {
      return;
    }

    this.current = target;
    this.paused = false;
    this.position = 0;
    this.endTime = null;
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
    this.clearQueueEndDestroyTimer();
    this.current = null;
    this.position = 0;
    this.endTime = null;
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
    await this.filter.set(filters);
  }

  createFilterBuilder(): FilterBuilder {
    return this.filter.builder();
  }

  async updateFilters(filters: Partial<Filters>): Promise<void> {
    await this.filter.update(filters);
  }

  async clearFilters(): Promise<void> {
    await this.filter.clear();
  }

  async setFilterVolume(volume: number): Promise<void> {
    await this.filter.setVolume(volume);
  }

  async clearFilterVolume(): Promise<void> {
    await this.filter.clearVolume();
  }

  async setEqualizer(equalizer: Filters["equalizer"]): Promise<void> {
    await this.filter.setEqualizer(equalizer);
  }

  async updateEqualizer(equalizer: Filters["equalizer"]): Promise<void> {
    await this.filter.updateEqualizer(equalizer);
  }

  async setEqualizerBand(band: number, gain: number): Promise<void> {
    await this.filter.setEqualizerBand(band, gain);
  }

  async clearEqualizer(): Promise<void> {
    await this.filter.clearEqualizer();
  }

  async updateKaraokeFilter(filter: Partial<NonNullable<Filters["karaoke"]>>): Promise<void> {
    await this.filter.updateKaraoke(filter);
  }

  async clearKaraokeFilter(): Promise<void> {
    await this.filter.clearKaraoke();
  }

  async updateTimescaleFilter(filter: Partial<NonNullable<Filters["timescale"]>>): Promise<void> {
    await this.filter.updateTimescale(filter);
  }

  async clearTimescaleFilter(): Promise<void> {
    await this.filter.clearTimescale();
  }

  async updateTremoloFilter(filter: Partial<NonNullable<Filters["tremolo"]>>): Promise<void> {
    await this.filter.updateTremolo(filter);
  }

  async clearTremoloFilter(): Promise<void> {
    await this.filter.clearTremolo();
  }

  async updateVibratoFilter(filter: Partial<NonNullable<Filters["vibrato"]>>): Promise<void> {
    await this.filter.updateVibrato(filter);
  }

  async clearVibratoFilter(): Promise<void> {
    await this.filter.clearVibrato();
  }

  async updateRotationFilter(filter: Partial<NonNullable<Filters["rotation"]>>): Promise<void> {
    await this.filter.updateRotation(filter);
  }

  async clearRotationFilter(): Promise<void> {
    await this.filter.clearRotation();
  }

  async updateDistortionFilter(filter: Partial<NonNullable<Filters["distortion"]>>): Promise<void> {
    await this.filter.updateDistortion(filter);
  }

  async clearDistortionFilter(): Promise<void> {
    await this.filter.clearDistortion();
  }

  async updateChannelMixFilter(filter: Partial<NonNullable<Filters["channelMix"]>>): Promise<void> {
    await this.filter.updateChannelMix(filter);
  }

  async clearChannelMixFilter(): Promise<void> {
    await this.filter.clearChannelMix();
  }

  async updateLowPassFilter(filter: Partial<NonNullable<Filters["lowPass"]>>): Promise<void> {
    await this.filter.updateLowPass(filter);
  }

  async clearLowPassFilter(): Promise<void> {
    await this.filter.clearLowPass();
  }

  async setPluginFilters(pluginFilters: Filters["pluginFilters"]): Promise<void> {
    await this.filter.setPluginFilters(pluginFilters);
  }

  async updatePluginFilters(pluginFilters: NonNullable<Filters["pluginFilters"]>): Promise<void> {
    await this.filter.updatePluginFilters(pluginFilters);
  }

  async setPluginFilter(name: string, value: unknown): Promise<void> {
    await this.filter.setPluginFilter(name, value);
  }

  async removePluginFilter(name: string): Promise<void> {
    await this.filter.removePluginFilter(name);
  }

  async clearPluginFilters(): Promise<void> {
    await this.filter.clearPluginFilters();
  }

  setBassboost(): Promise<void> {
    return this.filter.setBassboost();
  }

  setNightcore(): Promise<void> {
    return this.filter.setNightcore();
  }

  setVaporwave(): Promise<void> {
    return this.filter.setVaporwave();
  }

  setKaraoke(): Promise<void> {
    return this.filter.setKaraoke();
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

    this.pushHistory(skippedTrack);

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
    if (this.queue.isEmpty) {
      this.notifyQueueEmpty("manual");
    } else {
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

  async search(query: string, provider?: SearchProviderInput): Promise<SearchResult> {
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

  /**
   * Applies a Lavalink load/search result to this player: always enqueues the resolved track(s).
   * If nothing is currently loaded as the active track (`current` is `null`), starts playback from
   * the queue; if a track is already loaded (playing or paused), new items are only queued.
   */
  async applySearchResult(result: SearchResult): Promise<SearchResult> {
    if (result.loadType === "empty" || result.loadType === "error" || result.tracks.length === 0) {
      return result;
    }

    const firstTrack = result.tracks[0];
    let tracksToQueue: Track[];
    if (result.loadType === "playlist") {
      tracksToQueue = result.tracks;
    } else if (firstTrack) {
      tracksToQueue = [firstTrack];
    } else {
      return result;
    }

    this.addMany(tracksToQueue);

    if (this.current === null) {
      await this.play();
    }

    return result;
  }

  /** Search Lavalink, then {@link applySearchResult}. */
  async searchAndPlay(query: string, provider?: SearchProviderInput): Promise<SearchResult> {
    const result = await this.search(query, provider);
    return this.applySearchResult(result);
  }

  add(track: Track): void {
    this.clearQueueEndDestroyTimer();
    this.queue.enqueue(track);
    this.emitActionEvent({
      type: "playerQueueAdd",
      guildId: this.guildId,
      track,
      queueSize: this.queue.size,
    });
  }

  addMany(tracks: Track[]): void {
    if (tracks.length === 0) {
      return;
    }

    this.clearQueueEndDestroyTimer();
    this.queue.enqueueMany(tracks);
    this.emitActionEvent({
      type: "playerQueueAddMany",
      guildId: this.guildId,
      tracks,
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

  insert(index: number, track: Track): void {
    this.clearQueueEndDestroyTimer();
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

  clearQueue(): void {
    const clearedCount = this.queue.size;
    this.queue.clear();
    this.emitActionEvent({
      type: "playerQueueClear",
      guildId: this.guildId,
      clearedCount,
      queueSize: this.queue.size,
    });
  }

  getQueue(): Track[] {
    return this.queue.toArray();
  }

  playNext(track: Track): void {
    this.insert(0, track);
  }

  getLyricsFor(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult> {
    if (!this.node.lyricsClient) {
      return Promise.resolve<LyricsResult>({
        status: "unavailable",
        reason: "provider_unavailable",
      });
    }

    return this.node.lyricsClient.getLyricsForTrack(track, options);
  }

  getLyrics(options?: LyricsRequestOptions): Promise<LyricsResult> {
    if (!this.current) {
      return Promise.resolve<LyricsResult>({ status: "no_track" });
    }

    return this.getLyricsFor(this.current, options);
  }

  async seek(positionMs: number): Promise<void> {
    if (!this.current) {
      throw new InvalidPlayerStateError({
        code: "PLAYER_NOT_PLAYING",
        message: "Cannot seek without a current track",
        context: {
          guildId: this.guildId,
          operation: "player.seek",
        },
      });
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

  async setEndTime(positionMs: number): Promise<void> {
    const nextEndTime = Math.max(0, positionMs);
    this.endTime = nextEndTime;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      endTime: nextEndTime,
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
    const rate = this.getPlaybackRate();
    return clampPosition(this.position + elapsed * rate, this.current);
  }

  private getPlaybackRate(): number {
    return this.filter.getPlaybackRate();
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
    endTime: number | null;
    filters: Filters;
    history: Track[];
    paused: boolean;
    position: number;
    queue: Track[];
    repeatQueueEnabled: boolean;
    repeatTrackEnabled: boolean;
    volume: number;
  } {
    return {
      current: this.current,
      endTime: this.endTime,
      filters: this.filters,
      history: this.history.toArray(),
      paused: this.paused,
      position: this.getEstimatedPosition(),
      queue: this.getQueue(),
      repeatQueueEnabled: this.repeatQueueEnabled,
      repeatTrackEnabled: this.repeatTrackEnabled,
      volume: this.volume,
    };
  }

  export(): PlayerExportData {
    return {
      connected: this.connected,
      current: this.current?.toJSON() ?? null,
      endTime: this.endTime,
      filters: this.filters,
      history: this.history.toArray().map((track) => track.toJSON()),
      paused: this.paused,
      position: this.getEstimatedPosition(),
      queue: this.getQueue().map((track) => track.toJSON()),
      repeatQueueEnabled: this.repeatQueueEnabled,
      repeatTrackEnabled: this.repeatTrackEnabled,
      shouldResume: Boolean(this.current && !this.paused),
      textChannelId: this.textChannelId,
      voiceChannelId: this.node.getVoiceChannelId?.(this.guildId) ?? null,
      volume: this.volume,
    };
  }

  async import(data: PlayerExportData): Promise<void> {
    this.queue.clear();
    this.history.clear();

    this.current = data.current ? Track.from(data.current) : null;
    this.endTime = data.endTime;
    this.paused = data.paused;
    this.position = data.position;
    this.connected = data.connected;
    this.textChannelId = data.textChannelId;
    this.volume = data.volume;
    this.repeatQueueEnabled = data.repeatQueueEnabled;
    this.repeatTrackEnabled = data.repeatTrackEnabled;

    if (data.queue.length > 0) {
      this.queue.enqueueMany(data.queue.map((track) => Track.from(track)));
    }

    for (const rawTrack of [...data.history].reverse()) {
      this.history.push(Track.from(rawTrack));
    }

    this.filter.applyLocally(data.filters);

    if (!(this.current && data.shouldResume && this.node.sessionId)) {
      return;
    }

    const payload: PlayerUpdatePayload = {
      track: { encoded: this.current.encoded },
      paused: this.paused,
      position: this.position,
      filters: this.filters,
      volume: this.volume,
    };

    if (this.endTime !== null) {
      payload.endTime = this.endTime;
    }

    const voicePayload = this.node.getVoicePayload?.(this.guildId);
    if (voicePayload) {
      payload.voice = voicePayload;
    }

    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, payload);
  }

  rewindTrack(): Track | null {
    const previousTrack = this.history.pop();
    if (!previousTrack) {
      return null;
    }

    if (this.current) {
      this.playNext(previousTrack);
    } else {
      this.add(previousTrack);
    }
    return previousTrack;
  }

  previous(): Track | null {
    return this.rewindTrack();
  }

  getLyricsForHistory(index: number, options?: LyricsRequestOptions): Promise<LyricsResult> {
    const track = this.history.toArray()[index];
    if (!track) {
      return Promise.resolve<LyricsResult>({
        status: "not_found",
      });
    }

    return this.getLyricsFor(track, options);
  }

  getCurrentLyricLine(lyrics: LyricsResult): string | null {
    if (lyrics.status !== "found" || !lyrics.lyrics.syncedLyrics || !this.current) {
      return null;
    }

    const position = this.getEstimatedPosition();
    let currentLine: string | null = null;

    for (const line of lyrics.lyrics.syncedLyrics) {
      if (line.timeMs > position) {
        break;
      }

      currentLine = line.text;
    }

    return currentLine;
  }

  getCreationOptions(): PlayerOptions {
    return {
      historyMaxSize: this.options.historyMaxSize,
      onQueueEmpty: this.options.onQueueEmpty,
      queueEndDestroyDelayMs: this.options.queueEndDestroyDelayMs,
    };
  }

  dispose(): void {
    this.clearQueueEndDestroyTimer();
  }

  pushHistory(track: Track): void {
    this.history.push(track);
  }

  notifyQueueEmpty(reason: "manual" | "trackEnd"): void {
    if (reason === "trackEnd") {
      this.scheduleQueueEndDestroy();
    } else {
      this.clearQueueEndDestroyTimer();
    }

    this.emitActionEvent({
      type: "playerQueueEmpty",
      guildId: this.guildId,
      reason,
    });
    Promise.resolve(this.options.onQueueEmpty?.(this, reason)).catch(() => {
      // onQueueEmpty failures are swallowed; not our concern.
    });
  }

  private scheduleQueueEndDestroy(): void {
    this.clearQueueEndDestroyTimer();

    this.queueEndDestroyTimer = setTimeout(() => {
      this.queueEndDestroyTimer = null;
      this.stop(true, false).catch(() => {
        // stop() already emits its own error events; swallow double-report here.
      });
    }, this.queueEndDestroyDelayMs);

    const timeoutHandle = this.queueEndDestroyTimer as unknown;
    if (
      typeof timeoutHandle === "object" &&
      timeoutHandle !== null &&
      "unref" in timeoutHandle &&
      typeof timeoutHandle.unref === "function"
    ) {
      timeoutHandle.unref();
    }
  }

  private clearQueueEndDestroyTimer(): void {
    if (!this.queueEndDestroyTimer) {
      return;
    }

    clearTimeout(this.queueEndDestroyTimer);
    this.queueEndDestroyTimer = null;
  }
}

const clampPosition = (positionMs: number, track: TrackType): number => {
  const nonNegativePosition = Math.max(0, positionMs);
  if (track.isStream) {
    return nonNegativePosition;
  }

  return Math.min(nonNegativePosition, track.duration);
};

const normalizeQueueEndDestroyDelay = (delayMs?: number): number => {
  if (typeof delayMs !== "number" || !Number.isFinite(delayMs)) {
    return DEFAULT_QUEUE_END_DESTROY_DELAY_MS;
  }

  return Math.max(0, delayMs);
};
