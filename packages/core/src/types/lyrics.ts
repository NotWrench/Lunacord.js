import type { z } from "zod";
import type { LyricsSchema } from "../schemas/lavalink";

export type Lyrics = z.infer<typeof LyricsSchema>;

export interface LyricsRequestOptions {
  query?: string;
}

export type LyricsUnavailableReason =
  | "invalid_token"
  | "missing_credentials"
  | "provider_unavailable"
  | "rate_limited"
  | "unsupported";

export type LyricsResult =
  | {
      lyrics: Lyrics;
      status: "found";
    }
  | {
      status: "not_found";
    }
  | {
      status: "no_track";
    }
  | {
      reason: LyricsUnavailableReason;
      status: "unavailable";
    };

/**
 * Minimal contract implemented by lyrics providers / clients. `@lunacord/lyrics` ships
 * a production client; tests and custom integrations can provide any object matching
 * this shape and hand it to `Lunacord.lyrics(provider)`.
 */
export interface LyricsProvider {
  getLyricsForTrack(
    track: { readonly title?: string; readonly author?: string; readonly uri?: string | null },
    options?: LyricsRequestOptions
  ): Promise<LyricsResult>;
  markTrackActive?(guildId: string, track: unknown): void;
  markTrackInactive?(guildId: string, track?: unknown): void;
}

export interface GeniusOptions {
  accessToken: string;
  clientId: string;
  clientSecret: string;
  requestTimeoutMs?: number;
}

export interface LyricsOptions {
  genius?: GeniusOptions;
  requestTimeoutMs?: number;
}
