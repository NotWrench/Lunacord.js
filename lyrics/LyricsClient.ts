import type { Track } from "../structures/Track";
import type { GeniusOptions, LyricsRequestOptions, LyricsResult } from "../types";
import { GeniusClient } from "./GeniusClient";
import { LyricsOvhClient } from "./LyricsOvhClient";

export interface TrackLyricsClient {
  getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult>;
}

export class LyricsClient implements TrackLyricsClient {
  private readonly geniusClient: GeniusClient;
  private readonly lyricsOvhClient: LyricsOvhClient;

  constructor(options?: { genius?: GeniusOptions; requestTimeoutMs?: number }) {
    this.geniusClient = new GeniusClient(options?.genius);
    this.lyricsOvhClient = new LyricsOvhClient({
      requestTimeoutMs: options?.requestTimeoutMs,
    });
  }

  async getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult> {
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
}
