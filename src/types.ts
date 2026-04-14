import { z } from "zod";
import {
  ChannelMixFilterSchema,
  DistortionFilterSchema,
  EqualizerBandSchema,
  ExceptionSchema,
  FiltersSchema,
  FrameStatsSchema,
  GitObjectSchema,
  InfoResponseSchema,
  KaraokeFilterSchema,
  LoadResultEmptySchema,
  LoadResultErrorSchema,
  LoadResultPlaylistSchema,
  LoadResultSchema,
  LoadResultSearchSchema,
  LoadResultTrackSchema,
  LowPassFilterSchema,
  LyricsSchema,
  PlayerSchema,
  PlayerStateSchema,
  PlayerUpdateOpSchema,
  PlayerUpdatePayloadSchema,
  PlaylistInfoSchema,
  PluginObjectSchema,
  ReadyPayloadSchema,
  RotationFilterSchema,
  RoutePlannerDetailsSchema,
  RoutePlannerFailingAddressSchema,
  RoutePlannerIpBlockSchema,
  RoutePlannerStatusSchema,
  SessionSchema,
  StatsSchema,
  TimescaleFilterSchema,
  TrackEndEventSchema,
  TrackEventSchema,
  TrackExceptionEventSchema,
  TrackInfoSchema,
  TrackSchema,
  TrackStartEventSchema,
  TrackStuckEventSchema,
  TremoloFilterSchema,
  VersionObjectSchema,
  VersionResponseSchema,
  VibratoFilterSchema,
  VoiceStateSchema,
  WebSocketClosedEventSchema,
  WebSocketMessageSchema,
} from "./schemas/lavalink";

export enum SearchProvider {
  YouTube = "ytsearch",
  YouTubeMusic = "ytmsearch",
  SoundCloud = "scsearch",
  Spotify = "spsearch",
  Deezer = "dzsearch",
  AppleMusic = "amsearch",
}

export type SearchProviderInput = SearchProvider | string;

export const DEFAULT_SEARCH_PROVIDER = SearchProvider.YouTube;

const URL_WRAPPER_REGEX = /^<(.+)>$/;

const parseHttpUrl = (value: string): URL | null => {
  const normalizedValue = value.replace(URL_WRAPPER_REGEX, "$1").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

export const buildSearchIdentifier = (
  query: string,
  provider: SearchProviderInput = DEFAULT_SEARCH_PROVIDER
): string => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Search query must not be empty");
  }

  const queryUrl = parseHttpUrl(trimmedQuery);
  if (queryUrl) {
    return queryUrl.toString();
  }

  const providerInput = provider?.trim() || DEFAULT_SEARCH_PROVIDER;
  const providerUrl = parseHttpUrl(providerInput);
  if (providerUrl) {
    return providerUrl.toString();
  }

  const resolvedProvider = providerInput;
  return `${resolvedProvider}:${trimmedQuery}`;
};

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

export type Exception = z.infer<typeof ExceptionSchema>;
export type TrackInfo = z.infer<typeof TrackInfoSchema>;
export type RawTrack = z.infer<typeof TrackSchema>;
export type Lyrics = z.infer<typeof LyricsSchema>;
export type PlaylistInfo = z.infer<typeof PlaylistInfoSchema>;
export type LoadResultTrack = z.infer<typeof LoadResultTrackSchema>;
export type LoadResultPlaylist = z.infer<typeof LoadResultPlaylistSchema>;
export type LoadResultSearch = z.infer<typeof LoadResultSearchSchema>;
export type LoadResultEmpty = z.infer<typeof LoadResultEmptySchema>;
export type LoadResultError = z.infer<typeof LoadResultErrorSchema>;
export type LoadResult = z.infer<typeof LoadResultSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type PlayerUpdate = z.infer<typeof PlayerUpdateOpSchema>;
export type FrameStats = z.infer<typeof FrameStatsSchema>;
export type Stats = z.infer<typeof StatsSchema>;
export type ReadyPayload = z.infer<typeof ReadyPayloadSchema>;
export type TrackStartEvent = z.infer<typeof TrackStartEventSchema>;
export type TrackEndEvent = z.infer<typeof TrackEndEventSchema>;
export type TrackExceptionEvent = z.infer<typeof TrackExceptionEventSchema>;
export type TrackStuckEvent = z.infer<typeof TrackStuckEventSchema>;
export type WebSocketClosedEvent = z.infer<typeof WebSocketClosedEventSchema>;
export type TrackEvent = z.infer<typeof TrackEventSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type VoiceState = z.infer<typeof VoiceStateSchema>;
export type EqualizerBand = z.infer<typeof EqualizerBandSchema>;
export type KaraokeFilter = z.infer<typeof KaraokeFilterSchema>;
export type TimescaleFilter = z.infer<typeof TimescaleFilterSchema>;
export type TremoloFilter = z.infer<typeof TremoloFilterSchema>;
export type VibratoFilter = z.infer<typeof VibratoFilterSchema>;
export type RotationFilter = z.infer<typeof RotationFilterSchema>;
export type DistortionFilter = z.infer<typeof DistortionFilterSchema>;
export type ChannelMixFilter = z.infer<typeof ChannelMixFilterSchema>;
export type LowPassFilter = z.infer<typeof LowPassFilterSchema>;
export type Filters = z.infer<typeof FiltersSchema>;
export type PlayerUpdatePayload = z.infer<typeof PlayerUpdatePayloadSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type VersionObject = z.infer<typeof VersionObjectSchema>;
export type VersionResponse = z.infer<typeof VersionResponseSchema>;
export type GitObject = z.infer<typeof GitObjectSchema>;
export type PluginObject = z.infer<typeof PluginObjectSchema>;
export type InfoResponse = z.infer<typeof InfoResponseSchema>;
export type RoutePlannerIpBlock = z.infer<typeof RoutePlannerIpBlockSchema>;
export type RoutePlannerFailingAddress = z.infer<typeof RoutePlannerFailingAddressSchema>;
export type RoutePlannerDetails = z.infer<typeof RoutePlannerDetailsSchema>;
export type RoutePlannerStatus = z.infer<typeof RoutePlannerStatusSchema>;
