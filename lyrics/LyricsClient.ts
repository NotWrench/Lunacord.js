import type { Track } from "../structures/Track";
import type { GeniusOptions, LyricsRequestOptions, LyricsResult } from "../types";
import { GeniusClient } from "./GeniusClient";
import { LyricsOvhClient } from "./LyricsOvhClient";
import { normalizeForComparison } from "./shared";

export interface TrackLyricsClient {
  getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult>;
}

export class LyricsClient implements TrackLyricsClient {
  private readonly activeGuildsByCacheKey = new Map<string, Set<string>>();
  private readonly cache = new Map<string, LyricsResult>();
  private readonly cacheKeyByGuildId = new Map<string, string>();
  private readonly geniusClient: GeniusClient;
  private readonly inFlightRequests = new Map<string, Promise<LyricsResult>>();
  private readonly lyricsOvhClient: LyricsOvhClient;

  constructor(options?: { genius?: GeniusOptions; requestTimeoutMs?: number }) {
    this.geniusClient = new GeniusClient(options?.genius);
    this.lyricsOvhClient = new LyricsOvhClient({
      requestTimeoutMs: options?.requestTimeoutMs,
    });
  }

  markTrackActive(guildId: string, track: Track): void {
    const nextCacheKey = this.getTrackCacheKey(track);
    const previousCacheKey = this.cacheKeyByGuildId.get(guildId);

    if (previousCacheKey === nextCacheKey) {
      return;
    }

    if (previousCacheKey) {
      this.detachGuildFromCacheKey(guildId, previousCacheKey);
    }

    this.cacheKeyByGuildId.set(guildId, nextCacheKey);

    const activeGuilds = this.activeGuildsByCacheKey.get(nextCacheKey);
    if (activeGuilds) {
      activeGuilds.add(guildId);
      return;
    }

    this.activeGuildsByCacheKey.set(nextCacheKey, new Set([guildId]));
  }

  markTrackInactive(guildId: string, track?: Track): void {
    const activeCacheKey = this.cacheKeyByGuildId.get(guildId);
    if (activeCacheKey) {
      this.detachGuildFromCacheKey(guildId, activeCacheKey);
      this.cacheKeyByGuildId.delete(guildId);
      return;
    }

    if (!track) {
      return;
    }

    this.detachGuildFromCacheKey(guildId, this.getTrackCacheKey(track));
  }

  async getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult> {
    if (options?.query?.trim()) {
      return this.fetchLyrics(track, options);
    }

    const cacheKey = this.getTrackCacheKey(track);
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const inFlightRequest = this.inFlightRequests.get(cacheKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = this.fetchLyrics(track, options)
      .then((result) => {
        if (this.activeGuildsByCacheKey.has(cacheKey)) {
          this.cache.set(cacheKey, result);
        }

        return result;
      })
      .finally(() => {
        this.inFlightRequests.delete(cacheKey);
      });

    this.inFlightRequests.set(cacheKey, request);

    return request;
  }

  private detachGuildFromCacheKey(guildId: string, cacheKey: string): void {
    const activeGuilds = this.activeGuildsByCacheKey.get(cacheKey);
    if (!activeGuilds) {
      return;
    }

    activeGuilds.delete(guildId);

    if (activeGuilds.size > 0) {
      return;
    }

    this.activeGuildsByCacheKey.delete(cacheKey);
    this.cache.delete(cacheKey);
  }

  private async fetchLyrics(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult> {
    const primaryResult = await this.lyricsOvhClient.getLyricsForTrack(track, options);
    if (primaryResult.status === "found") {
      return primaryResult;
    }

    if (!this.geniusClient.isConfigured()) {
      return primaryResult.status === "not_found"
        ? primaryResult
        : {
            status: "unavailable",
            reason: "provider_unavailable",
          };
    }

    const fallbackResult = await this.geniusClient.getLyricsForTrack(track, options);
    if (fallbackResult.status === "found") {
      return fallbackResult;
    }

    if (primaryResult.status === "not_found" || fallbackResult.status === "not_found") {
      return {
        status: "not_found",
      };
    }

    return fallbackResult;
  }

  private getTrackCacheKey(track: Track): string {
    const normalizedIsrc = track.isrc?.trim().toLowerCase();
    if (normalizedIsrc) {
      return `isrc:${normalizedIsrc}`;
    }

    const normalizedSourceName = track.sourceName.trim().toLowerCase();
    const normalizedIdentifier = track.identifier.trim().toLowerCase();
    if (normalizedSourceName && normalizedIdentifier) {
      return `source:${normalizedSourceName}:${normalizedIdentifier}`;
    }

    const normalizedArtist = normalizeForComparison(track.author);
    const normalizedTitle = normalizeForComparison(track.title);
    if (normalizedArtist || normalizedTitle) {
      return `meta:${normalizedArtist}:${normalizedTitle}`;
    }

    return `encoded:${track.encoded}`;
  }
}
