import { z } from "zod";
import type { Track } from "../../../domain/track/Track";
import type { LyricsRequestOptions, LyricsResult, LyricsUnavailableReason } from "../../../types";
import {
  buildLyricsLookupCandidates,
  DEFAULT_LYRICS_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
} from "../shared";

const LYRICS_OVH_API_BASE_URL = "https://api.lyrics.ovh/v1";

const LyricsOvhResponseSchema = z.object({
  lyrics: z.string(),
});

export class LyricsOvhClient {
  private readonly requestTimeoutMs: number;

  constructor(options?: { requestTimeoutMs?: number }) {
    this.requestTimeoutMs = options?.requestTimeoutMs ?? DEFAULT_LYRICS_REQUEST_TIMEOUT_MS;
  }

  async getLyricsForTrack(track: Track, options?: LyricsRequestOptions): Promise<LyricsResult> {
    for (const candidate of buildLyricsLookupCandidates(track, options)) {
      const endpoint = this.createLyricsEndpoint(candidate.artist, candidate.title);
      const response = await fetchWithTimeout(endpoint, {}, this.requestTimeoutMs);

      if (response.status === 404) {
        continue;
      }

      if (!response.ok) {
        return unavailable(this.getUnavailableReason(response.status));
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return unavailable("provider_unavailable");
      }

      const parsed = LyricsOvhResponseSchema.safeParse(payload);
      if (!parsed.success) {
        return unavailable("provider_unavailable");
      }

      const lyricsText = parsed.data.lyrics.trim();
      if (!lyricsText) {
        return unavailable("provider_unavailable");
      }

      return {
        status: "found",
        lyrics: {
          title: track.title,
          artist: track.author,
          url: endpoint,
          lyricsText,
          albumArtUrl: track.artworkUrl ?? null,
        },
      };
    }

    return {
      status: "not_found",
    };
  }

  private createLyricsEndpoint(artist: string, title: string): string {
    return `${LYRICS_OVH_API_BASE_URL}/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  }

  private getUnavailableReason(status: number): LyricsUnavailableReason {
    switch (status) {
      case 400:
      case 405:
      case 501:
        return "unsupported";
      case 429:
        return "rate_limited";
      default:
        return "provider_unavailable";
    }
  }
}

const unavailable = (reason: LyricsUnavailableReason): LyricsResult => ({
  status: "unavailable",
  reason,
});
