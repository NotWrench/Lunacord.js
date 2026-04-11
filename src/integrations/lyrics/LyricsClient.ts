import type { Cache } from "../../cache/Cache";
import { buildTrackCacheKey } from "../../cache/utils";
import type { Track } from "../../domain/track/Track";
import type { GeniusOptions, LyricsRequestOptions, LyricsResult } from "../../types";
import { GeniusClient } from "./providers/GeniusClient";
import { LyricsOvhClient } from "./providers/LyricsOvhClient";

export interface TrackLyricsClient {
  getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult>;
}

interface LyricsClientDependencies {
  cache?: Cache;
}

export class LyricsClient implements TrackLyricsClient {
  private readonly activeGuildsByCacheKey = new Map<string, Set<string>>();
  private readonly cacheKeyByGuildId = new Map<string, string>();
  private readonly cache?: Cache;
  private readonly geniusClient: GeniusClient;
  private readonly inFlightRequests = new Map<string, Promise<LyricsResult>>();
  private readonly lyricsOvhClient: LyricsOvhClient;

  constructor(
    options?: { genius?: GeniusOptions; requestTimeoutMs?: number },
    dependencies?: LyricsClientDependencies
  ) {
    this.cache = dependencies?.cache;
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
    const cachedResult = await this.cache?.get<LyricsResult>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    if (!this.cache) {
      return this.fetchLyrics(track, options);
    }

    const inFlightRequest = this.inFlightRequests.get(cacheKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const request = this.fetchLyrics(track, options)
      .then(async (result) => {
        if (this.activeGuildsByCacheKey.has(cacheKey) && this.shouldCacheResult(result)) {
          await this.cache?.set(cacheKey, result);
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
    void this.cache?.delete(cacheKey);
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

  private shouldCacheResult(result: LyricsResult): boolean {
    return result.status !== "unavailable";
  }

  private getTrackCacheKey(track: Track): string {
    return buildTrackCacheKey(track);
  }
}
